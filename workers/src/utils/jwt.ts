import { SignJWT, jwtVerify } from 'jose';
import { AuthPayload, Env } from '@/types';

const encoder = new TextEncoder();

export async function generateTokens(
  userId: string,
  email: string,
  role: string,
  academyId: string,
  env: Env
): Promise<{ accessToken: string; refreshToken: string; refreshTokenId: string }> {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = parseInt(env.JWT_EXPIRES_IN) || 3600;
  const refreshExpiresIn = parseInt(env.REFRESH_TOKEN_EXPIRES_IN) || 2592000;
  if (!env.JWT_SECRET || !env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be configured');
  }
  const jwtSecret = encoder.encode(env.JWT_SECRET);
  const refreshSecret = encoder.encode(env.JWT_REFRESH_SECRET);

  // Access Token (1시간)
  const accessToken = await new SignJWT({
    userId,
    email,
    role,
    academyId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(jwtSecret);

  // Refresh Token (30일)
  const refreshTokenId = crypto.randomUUID();
  const refreshToken = await new SignJWT({
    tokenId: refreshTokenId,
    userId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + refreshExpiresIn)
    .sign(refreshSecret);

  return { accessToken, refreshToken, refreshTokenId };
}

export async function verifyAccessToken(
  token: string,
  env: Env
): Promise<AuthPayload | null> {
  try {
    if (!env.JWT_SECRET) throw new Error('JWT_SECRET must be configured');
    const jwtSecret = encoder.encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, jwtSecret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as any,
      academyId: payload.academyId as string,
      iat: payload.iat || 0,
      exp: payload.exp || 0,
    };
  } catch (error) {
    return null;
  }
}

export async function verifyRefreshToken(token: string, env: Env): Promise<any | null> {
  try {
    if (!env.JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET must be configured');
    const refreshSecret = encoder.encode(env.JWT_REFRESH_SECRET);
    const { payload } = await jwtVerify(token, refreshSecret);
    return payload;
  } catch (error) {
    return null;
  }
}

export function createTokenExpiry(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}
