/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { MeetingsService } from './meetings.service';

import { CreateMeetingDto } from './dto/create-meeting.dto';

import { UpdateMeetingDto } from './dto/update-meeting.dto';

import { FileInterceptor } from '@nestjs/platform-express';

type AuthenticatedRequest = Request & { user: { id: number } };

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private meetingsService: MeetingsService) {}

  @Post()
  createMeeting(
    @Body()
    createMeetingDto: CreateMeetingDto,

    @Req() req: AuthenticatedRequest,
  ) {
    return this.meetingsService.createMeeting(createMeetingDto, req.user);
  }

  @Get()
  getMeetings(@Req() req: AuthenticatedRequest) {
    return this.meetingsService.getUserMeetings(req.user.id);
  }

  @Get(':id')
  getMeeting(
    @Param('id') id: string,

    @Req() req: AuthenticatedRequest,
  ) {
    return this.meetingsService.getMeetingById(Number(id), req.user.id);
  }

  @Patch(':id')
  updateMeeting(
    @Param('id') id: string,

    @Body()
    updateMeetingDto: UpdateMeetingDto,

    @Req() req: AuthenticatedRequest,
  ) {
    return this.meetingsService.updateMeeting(
      Number(id),
      req.user.id,
      updateMeetingDto,
    );
  }

  @Delete(':id')
  deleteMeeting(
    @Param('id') id: string,

    @Req() req: AuthenticatedRequest,
  ) {
    return this.meetingsService.deleteMeeting(Number(id), req.user.id);
  }

  @Get(':id/insights')
  @UseGuards(JwtAuthGuard)
  getMeetingInsights(@Param('id') id: string, @Req() req) {
    return this.meetingsService.getMeetingInsights(Number(id), req.user.id);
  }

  // @Get(':id/transcript')
  // @UseGuards(JwtAuthGuard)
  // getMeetingTranscript(@Param('id') id: number, @Req() req) {
  //   return this.meetingsService.getMeetingTranscript(id, req.user.id);
  // }

  @Get(':id/transcript')
  @UseGuards(JwtAuthGuard)
  getMeetingTranscript(@Param('id') id: string, @Req() req) {
    return this.meetingsService.getMeetingTranscript(Number(id), req.user.id);
  }

  @Post(':id/test-transcription')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async testTranscription(
    @Param('id') id: string,

    @UploadedFile()
    file: any,

    @Req()
    req,
  ) {
    return this.meetingsService.testTranscription(
      Number(id),
      req.user.id,
      file,
    );
  }
}
