import { NextResponse } from 'next/server';
import { rateLimit } from '@/utils/rate-limit';
import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';

const CSRF_COOKIE_NAME = 'csrf-token';

/**
 * Tạo CSRF token mới
 */
function generateCsrfToken() {
  return randomBytes(32).toString('hex');
}

/**
 * Lưu CSRF token vào cookie
 */
async function setCsrfCookie(token, maxAge = 3600) {
  const cookieStore = await cookies();
  await cookieStore.set(CSRF_COOKIE_NAME, token, {
    path: '/',
    maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}

/**
 * Xử lý GET request để cung cấp CSRF token mới
 */
export async function GET(request) {
  // Lấy IP của client để áp dụng rate limiting
  const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
  
  // Giới hạn 20 token mỗi phút cho mỗi IP
  const rateLimitInfo = rateLimit(ip, 20, 60 * 1000);
  
  // Nếu quá giới hạn, trả về lỗi
  if (rateLimitInfo.isLimited) {
    return NextResponse.json(
      { error: 'Yêu cầu quá nhiều CSRF token, vui lòng thử lại sau.' },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitInfo.retryAfter,
          'X-RateLimit-Limit': rateLimitInfo.limit,
          'X-RateLimit-Remaining': rateLimitInfo.remaining,
          'X-RateLimit-Reset': rateLimitInfo.resetTime,
        }
      }
    );
  }
  
  try {
    // Tạo CSRF token mới và lưu vào cookie
    const token = generateCsrfToken();
    await setCsrfCookie(token);
    
    // Trả về token để client có thể sử dụng
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Lỗi tạo CSRF token:', error);
    return NextResponse.json(
      { error: 'Không thể tạo CSRF token' },
      { status: 500 }
    );
  }
} 