import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,

    BullModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',

          port: configService.get<number>('REDIS_PORT') || 6379,
        },
      }),
    }),

    BullModule.registerQueue({
      name: 'meeting-insights',
    }),
  ],

  exports: [BullModule],
})
export class QueuesModule {}
