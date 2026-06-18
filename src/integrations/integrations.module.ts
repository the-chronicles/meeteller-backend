import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { Integration } from './integration.entity';
import { User } from '../users/user.entity';
import { Meeting } from '../meetings/meeting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integration, User, Meeting]),
  ],
  providers: [IntegrationsService],
  controllers: [IntegrationsController],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
