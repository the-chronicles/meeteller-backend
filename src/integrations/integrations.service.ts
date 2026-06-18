import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from './integration.entity';
import { User } from '../users/user.entity';
import { Meeting } from '../meetings/meeting.entity';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepo: Repository<Integration>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Meeting)
    private readonly meetingRepo: Repository<Meeting>,
  ) {}

  private getBackendUrl(): string {
    return process.env.BACKEND_URL || 'http://localhost:3001';
  }

  getGoogleAuthUrl(userId: number): string {
    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: `${this.getBackendUrl()}/integrations/google/callback`,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      access_type: 'offline',
      response_type: 'code',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' '),
      state: userId.toString(),
    };

    const qs = new URLSearchParams(options).toString();
    return `${rootUrl}?${qs}`;
  }

  getZoomAuthUrl(userId: number): string {
    const rootUrl = 'https://zoom.us/oauth/authorize';
    const options = {
      response_type: 'code',
      client_id: process.env.ZOOM_CLIENT_ID || '',
      redirect_uri: `${this.getBackendUrl()}/integrations/zoom/callback`,
      state: userId.toString(),
    };

    const qs = new URLSearchParams(options).toString();
    return `${rootUrl}?${qs}`;
  }

  async handleGoogleCallback(userId: number, code: string) {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const body = {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirect_uri: `${this.getBackendUrl()}/integrations/google/callback`,
      grant_type: 'authorization_code',
    };

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`Failed to exchange Google OAuth code: ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

    let integration = await this.integrationRepo.findOne({
      where: { userId, provider: 'google' },
    });

    if (!integration) {
      integration = this.integrationRepo.create({
        userId,
        provider: 'google',
      });
    }

    integration.accessToken = data.access_token;
    if (data.refresh_token) {
      integration.refreshToken = data.refresh_token;
    }
    integration.expiresAt = expiresAt;
    integration.scope = data.scope;

    await this.integrationRepo.save(integration);
    return { success: true };
  }

  async handleZoomCallback(userId: number, code: string) {
    const tokenUrl = 'https://zoom.us/oauth/token';
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID || ''}:${process.env.ZOOM_CLIENT_SECRET || ''}`
    ).toString('base64');

    const params = new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${this.getBackendUrl()}/integrations/zoom/callback`,
    });

    const response = await fetch(`${tokenUrl}?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`Failed to exchange Zoom OAuth code: ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

    let integration = await this.integrationRepo.findOne({
      where: { userId, provider: 'zoom' },
    });

    if (!integration) {
      integration = this.integrationRepo.create({
        userId,
        provider: 'zoom',
      });
    }

    integration.accessToken = data.access_token;
    if (data.refresh_token) {
      integration.refreshToken = data.refresh_token;
    }
    integration.expiresAt = expiresAt;
    integration.scope = data.scope;

    await this.integrationRepo.save(integration);
    return { success: true };
  }

  async getValidIntegration(userId: number, provider: string): Promise<Integration> {
    const integration = await this.integrationRepo.findOne({
      where: { userId, provider },
    });

    if (!integration) {
      throw new NotFoundException(`No integration found for provider: ${provider}`);
    }

    // Refresh if expiring within 1 minute
    const bufferTime = new Date();
    bufferTime.setMinutes(bufferTime.getMinutes() + 1);

    if (integration.expiresAt < bufferTime) {
      if (provider === 'google') {
        await this.refreshGoogleToken(integration);
      } else if (provider === 'zoom') {
        await this.refreshZoomToken(integration);
      }
    }

    return integration;
  }

  private async refreshGoogleToken(integration: Integration) {
    if (!integration.refreshToken) {
      throw new BadRequestException('No refresh token available for Google integration');
    }

    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const body = {
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: integration.refreshToken,
      grant_type: 'refresh_token',
    };

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to refresh Google access token');
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
    };

    integration.accessToken = data.access_token;
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);
    integration.expiresAt = expiresAt;

    await this.integrationRepo.save(integration);
  }

  private async refreshZoomToken(integration: Integration) {
    if (!integration.refreshToken) {
      throw new BadRequestException('No refresh token available for Zoom integration');
    }

    const tokenUrl = 'https://zoom.us/oauth/token';
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID || ''}:${process.env.ZOOM_CLIENT_SECRET || ''}`
    ).toString('base64');

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
    });

    const response = await fetch(`${tokenUrl}?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to refresh Zoom access token');
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    integration.accessToken = data.access_token;
    if (data.refresh_token) {
      integration.refreshToken = data.refresh_token;
    }
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);
    integration.expiresAt = expiresAt;

    await this.integrationRepo.save(integration);
  }

  async syncGoogleCalendar(userId: number) {
    const integration = await this.getValidIntegration(userId, 'google');
    const eventsUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      maxResults: '20',
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    const response = await fetch(`${eventsUrl}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new BadRequestException('Failed to fetch calendar events from Google');
    }

    return response.json();
  }

  async createGoogleMeet(userId: number, meetingId: number) {
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId, owner: { id: userId } },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found or you are not the owner');
    }

    const integration = await this.getValidIntegration(userId, 'google');
    const eventsUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1';
    
    const start = meeting.startedAt || new Date();
    const end = meeting.endedAt || new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour

    const body = {
      summary: meeting.title,
      description: meeting.description || 'Scheduled via Meeteller',
      start: {
        dateTime: start.toISOString(),
      },
      end: {
        dateTime: end.toISOString(),
      },
      conferenceData: {
        createRequest: {
          requestId: `meeteller-${meetingId}-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      },
    };

    const response = await fetch(eventsUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new BadRequestException(`Failed to create Google Meet event: ${err}`);
    }

    const eventData = await response.json() as {
      id: string;
      htmlLink: string;
      conferenceData?: {
        entryPoints?: Array<{
          entryPointType: string;
          uri: string;
        }>;
      };
    };

    const meetEntryPoint = eventData.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video'
    );

    meeting.externalMeetingId = eventData.id;
    meeting.externalMeetingUrl = meetEntryPoint?.uri || eventData.htmlLink;
    meeting.meetingType = 'google_meet';
    meeting.providerMetadata = JSON.stringify(eventData);

    await this.meetingRepo.save(meeting);

    return {
      meetingId: meeting.id,
      externalMeetingId: meeting.externalMeetingId,
      externalMeetingUrl: meeting.externalMeetingUrl,
    };
  }

  async createZoomMeeting(userId: number, meetingId: number) {
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId, owner: { id: userId } },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found or you are not the owner');
    }

    const integration = await this.getValidIntegration(userId, 'zoom');
    const zoomUrl = 'https://api.zoom.us/v2/users/me/meetings';

    const start = meeting.startedAt || new Date();

    const body = {
      topic: meeting.title,
      type: 2, // Scheduled meeting
      start_time: start.toISOString(),
      duration: 60, // Default 60 mins
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        mute_upon_entry: true,
      },
    };

    const response = await fetch(zoomUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new BadRequestException(`Failed to create Zoom meeting: ${err}`);
    }

    const zoomData = await response.json() as {
      id: number;
      join_url: string;
    };

    meeting.externalMeetingId = zoomData.id.toString();
    meeting.externalMeetingUrl = zoomData.join_url;
    meeting.meetingType = 'zoom';
    meeting.providerMetadata = JSON.stringify(zoomData);

    await this.meetingRepo.save(meeting);

    return {
      meetingId: meeting.id,
      externalMeetingId: meeting.externalMeetingId,
      externalMeetingUrl: meeting.externalMeetingUrl,
    };
  }

  async getUserIntegrations(userId: number) {
    const integrations = await this.integrationRepo.find({
      where: { userId },
    });
    const providers = integrations.map((i) => i.provider);
    return {
      google: providers.includes('google'),
      zoom: providers.includes('zoom'),
    };
  }

  async deleteIntegration(userId: number, provider: string) {
    const result = await this.integrationRepo.delete({
      userId,
      provider,
    });
    if (result.affected === 0) {
      throw new NotFoundException(`No connected integration found for provider: ${provider}`);
    }
    return { success: true };
  }
}
