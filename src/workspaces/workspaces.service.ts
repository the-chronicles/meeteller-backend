import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from './workspace.entity';
import { WorkspaceMember } from './workspace-member.entity';
import { User } from '../users/user.entity';
import { sanitizeUser } from '../users/utils/sanitize-user';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceMember)
    private readonly memberRepo: Repository<WorkspaceMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async createWorkspace(name: string, description: string, ownerId: number): Promise<Workspace> {
    const user = await this.userRepo.findOne({ where: { id: ownerId } });
    if (!user) {
      throw new NotFoundException('Owner user not found');
    }

    const workspace = this.workspaceRepo.create({ name, description });
    const savedWorkspace = await this.workspaceRepo.save(workspace);

    const membership = this.memberRepo.create({
      workspace: savedWorkspace,
      user,
      role: 'owner',
    });
    await this.memberRepo.save(membership);

    return savedWorkspace;
  }

  async getUserWorkspaces(userId: number) {
    const memberships = await this.memberRepo.find({
      where: { user: { id: userId } },
      relations: ['workspace'],
      order: { createdAt: 'DESC' },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      description: m.workspace.description,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
      role: m.role,
    }));
  }

  async getWorkspaceMembers(workspaceId: number, userId: number) {
    // Check if user is a member of the workspace
    const requesterMembership = await this.memberRepo.findOne({
      where: { workspace: { id: workspaceId }, user: { id: userId } },
    });

    if (!requesterMembership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const memberships = await this.memberRepo.find({
      where: { workspace: { id: workspaceId } },
      relations: ['user'],
    });

    return memberships.map((m) => ({
      id: m.id,
      role: m.role,
      user: sanitizeUser(m.user),
    }));
  }

  async addMember(workspaceId: number, email: string, role: string, adminUserId: number) {
    // 1. Verify requester is admin or owner
    const requesterMembership = await this.memberRepo.findOne({
      where: { workspace: { id: workspaceId }, user: { id: adminUserId } },
    });

    if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
      throw new ForbiddenException('Only owners and admins can manage members');
    }

    // 2. Validate role
    const validRoles = ['admin', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role. Allowed roles are: ${validRoles.join(', ')}`);
    }

    // 3. Find user
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User with this email not found');
    }

    // 4. Check existing membership
    const existing = await this.memberRepo.findOne({
      where: { workspace: { id: workspaceId }, user: { id: user.id } },
    });

    if (existing) {
      throw new BadRequestException('User is already a member of this workspace');
    }

    // Check subscription plan limits for workspace owner
    const ownerMembership = await this.memberRepo.findOne({
      where: { workspace: { id: workspaceId }, role: 'owner' },
      relations: ['user'],
    });

    if (ownerMembership) {
      const owner = ownerMembership.user;
      if (owner.subscriptionPlan === 'basic' || owner.subscriptionPlan === 'personal') {
        throw new ForbiddenException(
          "Collaboration is restricted on the owner's current plan. Please upgrade to the Teams Plan.",
        );
      }

      if (owner.subscriptionPlan === 'teams') {
        const count = await this.memberRepo.count({
          where: { workspace: { id: workspaceId } },
        });
        if (count >= 20) {
          throw new ForbiddenException(
            'Workspace member limit of 20 reached.',
          );
        }
      }
    }

    // 5. Create membership
    const newMember = this.memberRepo.create({
      workspace: { id: workspaceId } as Workspace,
      user,
      role,
    });

    const saved = await this.memberRepo.save(newMember);
    return {
      id: saved.id,
      role: saved.role,
      user: sanitizeUser(user),
    };
  }

  async removeMember(workspaceId: number, targetUserId: number, adminUserId: number) {
    // 1. Verify requester membership
    const requesterMembership = await this.memberRepo.findOne({
      where: { workspace: { id: workspaceId }, user: { id: adminUserId } },
    });

    if (!requesterMembership || !['owner', 'admin'].includes(requesterMembership.role)) {
      throw new ForbiddenException('Only owners and admins can remove members');
    }

    // 2. Find target membership
    const targetMembership = await this.memberRepo.findOne({
      where: { workspace: { id: workspaceId }, user: { id: targetUserId } },
    });

    if (!targetMembership) {
      throw new NotFoundException('Member not found in this workspace');
    }

    // 3. Admin rules
    if (requesterMembership.role === 'admin') {
      // Admins cannot remove owners or other admins
      if (['owner', 'admin'].includes(targetMembership.role)) {
        throw new ForbiddenException('Admins cannot remove other admins or owners');
      }
    }

    // 4. Owner protection (cannot remove the last owner)
    if (targetMembership.role === 'owner') {
      const ownersCount = await this.memberRepo.count({
        where: { workspace: { id: workspaceId }, role: 'owner' },
      });
      if (ownersCount <= 1) {
        throw new BadRequestException('Cannot remove the last owner of the workspace');
      }
    }

    await this.memberRepo.remove(targetMembership);
    return { success: true, message: 'Member removed successfully' };
  }

  async isMember(workspaceId: number, userId: number): Promise<boolean> {
    const membership = await this.memberRepo.findOne({
      where: { workspace: { id: workspaceId }, user: { id: userId } },
    });
    return !!membership;
  }

  async getMemberRole(workspaceId: number, userId: number): Promise<string | null> {
    const membership = await this.memberRepo.findOne({
      where: { workspace: { id: workspaceId }, user: { id: userId } },
    });
    return membership ? membership.role : null;
  }
}
