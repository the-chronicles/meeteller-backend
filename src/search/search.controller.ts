import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';
import { IsString, IsNotEmpty, IsOptional, IsNumberString } from 'class-validator';

export class SemanticSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsOptional()
  @IsNumberString()
  meetingId?: string;

  @IsOptional()
  @IsNumberString()
  workspaceId?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}

export class ChatBodyDto {
  @IsString()
  @IsNotEmpty()
  question!: string;
}

type AuthenticatedRequest = Request & { user: { id: number } };

@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async semanticSearch(
    @Query() queryDto: SemanticSearchQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.searchService.semanticSearch(userId, queryDto.query, {
      meetingId: queryDto.meetingId ? Number(queryDto.meetingId) : undefined,
      workspaceId: queryDto.workspaceId ? Number(queryDto.workspaceId) : undefined,
      limit: queryDto.limit ? Number(queryDto.limit) : undefined,
    });
  }

  @Post('chat/:meetingId')
  async chat(
    @Param('meetingId') meetingId: string,
    @Body() chatBodyDto: ChatBodyDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;
    return this.searchService.aiChat(
      userId,
      chatBodyDto.question,
      Number(meetingId),
    );
  }
}
