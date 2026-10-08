import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getTokenFromCookie, verifyToken } from '@/lib/auth'

const publicRoutes = [
  '/',
  '/sign-in',
  '/sign-up',
  '/precos',
  '/termos',
  '/privacidade',
  '/esqueci-senha',
  '/redefinir-senha',
  '/verificar-email',
  '/api/auth/signin',
  '/api/auth/signup',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/signout',
  '/api/auth/me',
  '/api/health',
  '/api/webhooks/nuvemshop',
  '/pdf.worker.min.mjs',
]

const publicPrefixes = ['/_next', '/images', '/favicon.ico']

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(route + '/'))
    || publicPrefixes.some((prefix) => pathname.startsWith(prefix))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (isPublicRoute(pathname)) return NextResponse.next()

  const payload = await verifyToken(getTokenFromCookie(request.headers.get('cookie')))
  if (!payload) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect', pathname)
    const response = NextResponse.redirect(signInUrl)
    response.headers.set('Set-Cookie', 'auth_token=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0')
    return response
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$).*)'],
}
