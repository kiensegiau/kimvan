import { NextResponse } from 'next/server';

// This will run when the file is loaded - check terminal for this message
console.log('🚨 MIDDLEWARE.JS LOADED - CHECK TERMINAL FOR THIS MESSAGE');

export function middleware(request) {
  // This will run on each matched request
  console.log('🚨 MIDDLEWARE EXECUTED FOR:', request.nextUrl.pathname);
  
  // This header will be visible in browser dev tools
  const response = NextResponse.next();
  response.headers.set('x-middleware-active', 'true');
  
  return response;
}

// Match specific routes, exclude Next.js internals & static files
export const config = {
  matcher: [
    // Simplified pattern without nested capturing groups
    '/((?!_next|api|favicon.ico).*)',
  ],
  // Add this to fix edge runtime issues
  skipMiddlewareUrlNormalize: true
}; 