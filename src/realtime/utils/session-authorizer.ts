import { WsException } from '@nestjs/websockets';

export function ensureHostAccess(
  meetingOwnerId: number,
  currentUserId: number,
) {
  if (meetingOwnerId !== currentUserId) {
    throw new WsException('Only meeting host can perform this action');
  }
}
