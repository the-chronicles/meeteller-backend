import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './user.entity';

import { sanitizeUser } from './utils/sanitize-user';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findById(id: number) {
    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findByGoogleId(googleId: string) {
    return this.usersRepository.findOne({
      where: { googleId },
    });
  }

  async createGoogleUser(data: Partial<User>) {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({
      where: { email },
    });
  }

  async createUser(data: Partial<User>) {
    const user = this.usersRepository.create(data);

    return this.usersRepository.save(user);
  }

  async updateUser(id: number, data: Partial<User>) {
    await this.usersRepository.update(id, data);

    return this.usersRepository.findOne({
      where: { id },
    });
  }

  async findOneByResetToken(token: string) {
    return this.usersRepository.findOne({
      where: {
        resetToken: token,
      },
    });
  }
}
