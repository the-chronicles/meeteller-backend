import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meeting } from './meeting.entity';
import { MeetingInsight } from 'src/ai/meeting-insight.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { sanitizeUser } from 'src/users/utils/sanitize-user';
import { TranscriptsService } from 'src/transcripts/transcripts.service';
import { WorkspaceMember } from '../workspaces/workspace-member.entity';
import { User } from 'src/users/user.entity';
import { IntegrationsService } from '../integrations/integrations.service';

@Injectable()
export class MeetingsService {
  constructor(
    @InjectRepository(Meeting)
    private meetingsRepository: Repository<Meeting>,
    @InjectRepository(MeetingInsight)
    private meetingInsightRepository: Repository<MeetingInsight>,
    @InjectRepository(WorkspaceMember)
    private workspaceMemberRepository: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private transcriptsService: TranscriptsService,
    private integrationsService: IntegrationsService,
  ) {}

  async createMeeting(createMeetingDto: CreateMeetingDto, owner: any) {
    const user = await this.userRepository.findOne({ where: { id: owner.id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.subscriptionPlan === 'basic') {
      const count = await this.meetingsRepository.count({
        where: { owner: { id: owner.id } },
      });
      if (count >= 2) {
        throw new ForbiddenException(
          'Meeting limit reached. Please upgrade your plan to create more meetings.',
        );
      }
    }

    const { workspaceId, ...rest } = createMeetingDto;

    let workspace: any = null;
    if (workspaceId) {
      const membership = await this.workspaceMemberRepository.findOne({
        where: { workspace: { id: workspaceId }, user: { id: owner.id } },
      });
      if (!membership) {
        throw new ForbiddenException('You are not a member of this workspace');
      }
      workspace = { id: workspaceId };
    }

    const meeting = this.meetingsRepository.create({
      ...rest,
      owner,
      workspace,
    });

    const savedMeeting = await this.meetingsRepository.save(meeting);

    if (rest.meetingType === 'google_meet') {
      try {
        await this.integrationsService.createGoogleMeet(owner.id, savedMeeting.id);
        const reloaded = await this.meetingsRepository.findOne({
          where: { id: savedMeeting.id },
          relations: ['owner', 'workspace'],
        });
        return reloaded;
      } catch (err) {
        await this.meetingsRepository.delete(savedMeeting.id);
        const message = err instanceof Error ? err.message : 'Google Meet integration failed. Please connect your Google account in Settings.';
        throw new BadRequestException(message);
      }
    } else if (rest.meetingType === 'zoom') {
      try {
        await this.integrationsService.createZoomMeeting(owner.id, savedMeeting.id);
        const reloaded = await this.meetingsRepository.findOne({
          where: { id: savedMeeting.id },
          relations: ['owner', 'workspace'],
        });
        return reloaded;
      } catch (err) {
        await this.meetingsRepository.delete(savedMeeting.id);
        const message = err instanceof Error ? err.message : 'Zoom integration failed. Please connect your Zoom account in Settings.';
        throw new BadRequestException(message);
      }
    }

    return savedMeeting;
  }

  async getUserMeetings(ownerId: number) {
    const memberships = await this.workspaceMemberRepository.find({
      where: { user: { id: ownerId } },
      relations: ['workspace'],
    });

    const workspaceIds = memberships.map((m) => m.workspace.id);

    const query = this.meetingsRepository.createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.owner', 'owner')
      .leftJoinAndSelect('meeting.workspace', 'workspace');

    if (workspaceIds.length > 0) {
      query.where('owner.id = :ownerId OR workspace.id IN (:...workspaceIds)', {
        ownerId,
        workspaceIds,
      });
    } else {
      query.where('owner.id = :ownerId', { ownerId });
    }

    query.orderBy('meeting.createdAt', 'DESC');
    const meetings = await query.getMany();

    const meetingsWithInsights = await Promise.all(
      meetings.map(async (meeting) => {
        const insights = await this.meetingInsightRepository.findOne({
          where: { meeting: { id: meeting.id } },
          order: { createdAt: 'DESC' },
        });
        return {
          ...meeting,
          owner: sanitizeUser(meeting.owner),
          insights,
        };
      })
    );

    return meetingsWithInsights;
  }

  async getMeetingById(id: number, userId: number) {
    const meeting = await this.meetingsRepository.findOne({
      where: { id },
      relations: ['owner', 'workspace'],
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    const isOwner = meeting.owner.id === userId;
    let isWorkspaceMember = false;

    if (meeting.workspace) {
      const membership = await this.workspaceMemberRepository.findOne({
        where: { workspace: { id: meeting.workspace.id }, user: { id: userId } },
      });
      isWorkspaceMember = !!membership;
    }

    if (!isOwner && !isWorkspaceMember) {
      throw new ForbiddenException('You do not have access to this meeting');
    }

    return {
      ...meeting,
      owner: sanitizeUser(meeting.owner),
    };
  }

  async updateMeeting(
    id: number,
    ownerId: number,
    updateMeetingDto: UpdateMeetingDto,
  ) {
    const meeting = await this.getMeetingById(id, ownerId);

    Object.assign(meeting, updateMeetingDto);

    const updatedMeeting = await this.meetingsRepository.save(meeting);

    return {
      ...updatedMeeting,

      owner: sanitizeUser(updatedMeeting.owner),
    };
  }

  async deleteMeeting(id: number, ownerId: number) {
    const meeting = await this.getMeetingById(id, ownerId);

    await this.meetingsRepository.remove(meeting);

    return {
      message: 'Meeting deleted successfully',
    };
  }

  async getMeetingTranscript(meetingId: number, userId: number) {
    await this.getMeetingById(meetingId, userId);

    return this.transcriptsService.getTranscriptByMeetingId(meetingId);
  }

  async getMeetingInsights(meetingId: number, userId: number) {
    await this.getMeetingById(meetingId, userId);

    return this.meetingInsightRepository.findOne({
      where: {
        meeting: {
          id: meetingId,
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async testTranscription(meetingId: number, userId: number, file: any) {
    const meeting = await this.getMeetingById(meetingId, userId);

    return {
      meeting,
      filename: file.originalname,
      size: file.size,
    };
  }
}
