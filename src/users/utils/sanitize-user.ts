/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function sanitizeUser(user: any) {
  const { password, resetToken, resetTokenExpiry, ...safeUser } = user;

  return safeUser;
}
