/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, NotFoundException } from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';
import { Session } from '../session.entity';

@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(Session)
    private sessionsRepository: Repository<Session>,
  ) {}

  async createSession(meeting: any) {
    const existing = await this.sessionsRepository.findOne({
      where: {
        meeting: {
          id: meeting.id,
        },

        status: 'live',
      },
    });

    if (existing) {
      return existing;
    }

    const session = this.sessionsRepository.create({
      meeting,

      status: 'live',

      startedAt: new Date(),
    });

    return this.sessionsRepository.save(session);
  }

  async getSessionById(id: number) {
    const session = await this.sessionsRepository.findOne({
      where: { id },

      relations: ['meeting', 'meeting.owner'],
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async updateSessionState(sessionId: number, status: string) {
    const session = await this.getSessionById(sessionId);

    session.status = status;

    if (status === 'completed') {
      session.endedAt = new Date();
    }

    return this.sessionsRepository.save(session);
  }
}
