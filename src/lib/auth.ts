import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'

const TOKEN_EXPIRY = '30d'
const COOKIE_NAME = 'auth_token'

function getJwtSecret(): Uint8Array {
  const configured = process.env.JWT_SECRET
  if (configured && configured.length >= 32) return new TextEncoder().encode(configured)
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured with at least 32 characters')
  }
  return new TextEncoder().encode('local-development-secret-change-me-32')
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createToken(payload: { userId: string; email: string; isAdmin: boolean; tokenVersion: number }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(getJwtSecret())
}

export async function verifyToken(token: string | null | undefined): Promise<{ userId: string; email: string; isAdmin: boolean; tokenVersion: number } | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string' || typeof payload.tokenVersion !== 'number') {
      return null
    }
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      isAdmin: payload.isAdmin as boolean,
      tokenVersion: payload.tokenVersion,
    }
  } catch {
    return null
  }
}

export function getTokenFromCookie(cookies: string | null | undefined): string | null {
  if (!cookies) return null
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}

export function setAuthCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function clearAuthCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export const AUTH_COOKIE_NAME = COOKIE_NAME
