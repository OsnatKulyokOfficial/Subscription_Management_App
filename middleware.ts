import { NextResponse, type NextRequest } from 'next/server'

const KEY = 'app_session'

export function middleware(request: NextRequest) {
  const raw = request.cookies.get(KEY)?.value

  if (!raw) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const session = JSON.parse(decodeURIComponent(raw))
    const { pathname } = request.nextUrl

    if (pathname.startsWith('/coach') && session.role !== 'coach') {
      return NextResponse.redirect(new URL('/trainee', request.url))
    }
    if (pathname.startsWith('/trainee') && session.role !== 'trainee') {
      return NextResponse.redirect(new URL('/coach', request.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/trainee/:path*', '/coach/:path*'],
}
