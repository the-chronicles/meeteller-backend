import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import * as express from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { AddMemberDto } from './dto/add-member.dto';

type AuthenticatedRequest = express.Request & { user: { id: number } };

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  createWorkspace(
    @Body() createDto: CreateWorkspaceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workspacesService.createWorkspace(
      createDto.name,
      createDto.description || '',
      req.user.id,
    );
  }

  @Get()
  getUserWorkspaces(@Req() req: AuthenticatedRequest) {
    return this.workspacesService.getUserWorkspaces(req.user.id);
  }

  @Get(':id/members')
  getWorkspaceMembers(
    @Param('id') workspaceId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workspacesService.getWorkspaceMembers(Number(workspaceId), req.user.id);
  }

  @Post(':id/members')
  addMember(
    @Param('id') workspaceId: string,
    @Body() addMemberDto: AddMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workspacesService.addMember(
      Number(workspaceId),
      addMemberDto.email,
      addMemberDto.role,
      req.user.id,
    );
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  removeMember(
    @Param('id') workspaceId: string,
    @Param('userId') targetUserId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workspacesService.removeMember(
      Number(workspaceId),
      Number(targetUserId),
      req.user.id,
    );
  }
}
