import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const role = request.cookies.get('role')?.value;
  const { pathname } = request.nextUrl;

  // Rotas públicas que não requerem autenticação
  const publicPaths = ['/login', '/api'];
  if (publicPaths.some((p) => pathname.startsWith(p)) || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Se não estiver autenticado e tentar acessar rotas protegidas
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Controle de permissões por papel (RBAC)
  if (pathname.startsWith('/portal-contador') && role === 'CLIENTE') {
    return NextResponse.redirect(new URL('/portal-cliente', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/portal-contador/:path*', '/portal-cliente/:path*'],
};
