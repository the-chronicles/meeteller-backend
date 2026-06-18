import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MeetingsModule } from './meetings/meetings.module';
import { RealtimeModule } from './realtime/realtime.module';
import { TranscriptsModule } from './transcripts/transcripts.module';
import { AiModule } from './ai/ai.module';
import { QueuesModule } from './queues/queues.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { SearchModule } from './search/search.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: true, // ⚠️ dev only
    }),

    AuthModule,
    UsersModule,
    MeetingsModule,
    RealtimeModule,
    TranscriptsModule,
    AiModule,
    QueuesModule,
    IntegrationsModule,
    WorkspacesModule,
    SearchModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
