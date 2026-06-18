import { Controller, Get, Post, Query, Req, Res, UseGuards, Param, HttpCode, HttpStatus, Delete } from '@nestjs/common';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IntegrationsService } from './integrations.service';

type AuthenticatedRequest = express.Request & { user: { id: number } };

@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrationsService: IntegrationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getUserIntegrations(@Req() req: AuthenticatedRequest) {
    return this.integrationsService.getUserIntegrations(req.user.id);
  }

  @Delete(':provider')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteIntegration(
    @Param('provider') provider: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.integrationsService.deleteIntegration(req.user.id, provider);
  }

  @Get('google/auth')
  @UseGuards(JwtAuthGuard)
  getGoogleAuth(@Req() req: AuthenticatedRequest) {
    const url = this.integrationsService.getGoogleAuthUrl(req.user.id);
    return { url };
  }

  @Get('google/callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: express.Response,
  ) {
    const userId = Number(state);
    await this.integrationsService.handleGoogleCallback(userId, code);
    
    // Redirect to frontend settings or success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/settings?google=success`);
  }

  @Get('zoom/auth')
  @UseGuards(JwtAuthGuard)
  getZoomAuth(@Req() req: AuthenticatedRequest) {
    const url = this.integrationsService.getZoomAuthUrl(req.user.id);
    return { url };
  }

  @Get('zoom/callback')
  async handleZoomCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: express.Response,
  ) {
    const userId = Number(state);
    await this.integrationsService.handleZoomCallback(userId, code);

    // Redirect to frontend settings or success page
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl}/settings?zoom=success`);
  }

  @Get('sync')
  @UseGuards(JwtAuthGuard)
  async syncCalendar(@Req() req: AuthenticatedRequest) {
    return this.integrationsService.syncGoogleCalendar(req.user.id);
  }

  @Post('meeting/google-meet/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createGoogleMeet(
    @Param('id') meetingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.integrationsService.createGoogleMeet(req.user.id, Number(meetingId));
  }

  @Post('meeting/zoom/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createZoomMeeting(
    @Param('id') meetingId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.integrationsService.createZoomMeeting(req.user.id, Number(meetingId));
  }
}
