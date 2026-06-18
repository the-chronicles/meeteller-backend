/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';

import { Server, Socket } from 'socket.io';

import * as jwt from 'jsonwebtoken';
import { MeetingsService } from 'src/meetings/meetings.service';
import { SessionService } from './session/session.service';
import { ensureHostAccess } from './utils/session-authorizer';
import { AudioSessionManager } from './audio-session.manager';
import type { AudioChunkPayload } from './types/audio-stream.types';
import { RealtimeTranscriptionService } from './realtime-transcription.service';
import { TranscriptsService } from 'src/transcripts/transcripts.service';
import { MeetingInsightsQueue } from 'src/ai/meeting-insights.queue';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        socket.disconnect();

        return;
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET as string);

      socket.data.user = decoded;

      console.log('Socket connected:', socket.id);
    } catch (error) {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    this.meetingParticipants.forEach((participants, meetingId) => {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);

        const participantCount = participants.size;

        this.server.to(`meeting:${meetingId}`).emit('meetingPresence', {
          participantCount,
        });
      }
    });

    console.log('Socket disconnected:', socket.id);
  }

  @SubscribeMessage('joinMeeting')
  async handleJoinMeeting(
    @MessageBody()
    data: {
      meetingId: number;
    },

    @ConnectedSocket()
    socket: Socket,
  ) {
    const room = `meeting:${data.meetingId}`;
    const userId = socket.data.user?.sub;

    if (!userId) {
      throw new WsException('Unauthorized meeting access');
    }

    try {
      await this.meetingsService.getMeetingById(data.meetingId, userId);
    } catch (error) {
      throw new WsException('Unauthorized meeting access');
    }

    socket.join(room);

    if (!this.meetingParticipants.has(data.meetingId)) {
      this.meetingParticipants.set(data.meetingId, new Set());
    }

    this.meetingParticipants.get(data.meetingId)?.add(socket.id);

    const participantCount =
      this.meetingParticipants.get(data.meetingId)?.size || 0;

    this.server.to(room).emit('meetingPresence', {
      participantCount,
    });

    socket.to(room).emit('participantJoined', {
      user: socket.data.user,
    });

    return {
      joined: true,
      participantCount,
    };
  }

  @SubscribeMessage('leaveMeeting')
  handleLeaveMeeting(
    @MessageBody()
    data: {
      meetingId: number;
    },

    @ConnectedSocket()
    socket: Socket,
  ) {
    const room = `meeting:${data.meetingId}`;

    socket.leave(room);

    socket.to(room).emit('participantLeft', {
      user: socket.data.user,
    });

    return {
      message: 'Left meeting',
    };
  }

  // private activeMeetings = new Map<
  //   number,
  //   {
  //     hostId: number;

  //     participants: Set<number>;

  //     startedAt: Date;

  //     isLive: boolean;
  //   }
  // >();

  private meetingParticipants = new Map<number, Set<string>>();

  constructor(
    private sessionService: SessionService,
    private meetingsService: MeetingsService,
    private audioSessionManager: AudioSessionManager,
    private realtimeTranscriptionService: RealtimeTranscriptionService,
    private transcriptsService: TranscriptsService,
    private meetingInsightsQueue: MeetingInsightsQueue,
  ) {}

  private liveConnections = new Map<
    number,
    Awaited<ReturnType<RealtimeTranscriptionService['createLiveConnection']>>
  >();

  private activeTranscripts = new Map<number, number>();

  @SubscribeMessage('startSession')
  async handleStartSession(
    @MessageBody()
    data: {
      meetingId: number;
    },

    @ConnectedSocket()
    socket: Socket,
  ) {
    const userId = socket.data.user?.sub;

    if (!userId) {
      throw new WsException('Unauthorized');
    }

    const meeting = await this.meetingsService.getMeetingById(
      data.meetingId,
      userId,
    );

    ensureHostAccess(meeting.owner.id, userId);

    const session = await this.sessionService.createSession(meeting);

    this.server.to(`meeting:${meeting.id}`).emit('sessionStarted', {
      session,
    });

    return {
      success: true,
      session,
    };
  }

  @SubscribeMessage('pauseSession')
  async handlePauseSession(
    @MessageBody()
    data: {
      sessionId: number;
    },

    @ConnectedSocket()
    socket: Socket,
  ) {
    const userId = socket.data.user?.sub;

    if (!userId) {
      throw new WsException('Unauthorized');
    }

    const session = await this.sessionService.getSessionById(data.sessionId);

    ensureHostAccess(session.meeting.owner.id, userId);

    const updatedSession = await this.sessionService.updateSessionState(
      data.sessionId,
      'paused',
    );

    this.server.to(`meeting:${session.meeting.id}`).emit('sessionPaused', {
      session: updatedSession,
    });

    return updatedSession;
  }

  @SubscribeMessage('resumeSession')
  async handleResumeSession(
    @MessageBody()
    data: {
      sessionId: number;
    },
  ) {
    const session = await this.sessionService.updateSessionState(
      data.sessionId,
      'live',
    );

    this.server.to(`meeting:${session.meeting.id}`).emit('sessionResumed', {
      session,
    });

    return session;
  }

  @SubscribeMessage('endSession')
  async handleEndSession(
    @MessageBody()
    data: {
      sessionId: number;
    },
  ) {
    const session = await this.sessionService.updateSessionState(
      data.sessionId,
      'completed',
    );

    this.server.to(`meeting:${session.meeting.id}`).emit('sessionEnded', {
      session,
    });

    this.audioSessionManager.stopStream(session.id);

    const transcriptId = this.activeTranscripts.get(session.id);

    if (transcriptId) {
      await this.transcriptsService.completeTranscript(transcriptId);

      await this.meetingInsightsQueue.generateInsights(session.meeting.id, transcriptId);

      this.activeTranscripts.delete(session.id);
    }

    const connection = this.liveConnections.get(session.id);

    if (connection) {
      connection.sendCloseStream({ type: 'CloseStream' });

      this.liveConnections.delete(session.id);
    }

    return session;
  }

  @SubscribeMessage('startAudioStream')
  handleStartAudioStream(
    @MessageBody()
    data: {
      meetingId: number;

      sessionId: number;

      sourceType: string;
    },
  ) {
    this.audioSessionManager.startStream(data.sessionId, data.sourceType);

    this.server.to(`meeting:${data.meetingId}`).emit('audioStreamStarted', {
      sessionId: data.sessionId,
    });

    return {
      started: true,
    };
  }

  @SubscribeMessage('audioChunk')
  handleAudioChunk(
    @MessageBody()
    data: AudioChunkPayload,
  ) {
    this.audioSessionManager.incrementChunkCount(data.sessionId);

    const connection = this.liveConnections.get(data.sessionId);

    if (connection) {
      connection.sendMedia(data.chunk);
    }

    return {
      received: true,
    };
  }

  @SubscribeMessage('startTranscription')
  async handleStartTranscription(
    @MessageBody()
    data: {
      sessionId: number;

      meetingId: number;
    },
  ) {
    const session = await this.sessionService.getSessionById(data.sessionId);

    const transcript = await this.transcriptsService.createTranscript(
      session.meeting,
      session,
    );

    this.activeTranscripts.set(data.sessionId, transcript.id);

    const connection =
      await this.realtimeTranscriptionService.createLiveConnection();

    this.liveConnections.set(data.sessionId, connection);

    connection.on('message', (event) => {
      if (event.type !== 'Results') return;

      const transcript = event.channel.alternatives[0]?.transcript;

      if (!transcript) return;

      this.server.to(`meeting:${data.meetingId}`).emit('transcript', {
        text: transcript,

        isFinal: event.is_final,

        sessionId: data.sessionId,
      });

      if (event.is_final) {
        const transcriptId = this.activeTranscripts.get(data.sessionId);

        if (transcriptId) {
          void this.transcriptsService.addSegment(
            transcriptId,
            transcript,
            true,
          );
        }
      }
    });

    return {
      started: true,
    };
  }
}
