import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cookieConfig } from '@/config/env-config';
import { rateLimit } from '@/utils/rate-limit';
import firebaseAdmin from '@/lib/firebase-admin';
import { createUserWithEmailPassword } from '@/utils/firebase-auth-helper';

// Hằng số CSRF
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_FORM_FIELD = '_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Kiểm tra CSRF token
 */
async function validateCsrfToken(providedToken) {
  if (!providedToken) return false;
  
  const cookieStore = await cookies();
  const storedToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  if (!storedToken) return false;
  
  // So sánh token một cách an toàn, tránh timing attacks
  return timingSafeEqual(providedToken, storedToken);
}

/**
 * So sánh hai string một cách an toàn, tránh timing attacks
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * API route xử lý đăng ký người dùng mới
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, [CSRF_FORM_FIELD]: csrfToken } = body;
    
    // Lấy IP của client để áp dụng rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    
    // Giới hạn số lần đăng ký
    const rateLimitInfo = rateLimit(ip, 3, 60 * 60 * 1000); // 3 lần/giờ
    
    // Nếu quá giới hạn, trả về lỗi 429
    if (rateLimitInfo.isLimited) {
      return NextResponse.json(
        { error: 'Quá nhiều lần đăng ký, vui lòng thử lại sau.' },
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
    
    // Xác thực CSRF token
    if (!await validateCsrfToken(csrfToken)) {
      return NextResponse.json(
        { error: 'CSRF token không hợp lệ. Vui lòng thử lại.' },
        { status: 403 }
      );
    }
    
    // Kiểm tra dữ liệu đầu vào
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email và mật khẩu là bắt buộc' },
        { status: 400 }
      );
    }
    
    // Kiểm tra độ mạnh mật khẩu
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }
    
    try {
      // Trong môi trường phát triển, sử dụng giả lập đăng ký
      if (process.env.NODE_ENV === 'development') {
        // Giả lập tạo người dùng mới
        const uid = `new-user-${Date.now()}`;
        
        // Tạo custom token cho user mới
        const customToken = await firebaseAdmin.auth().createCustomToken(uid);
        
        // Thiết lập cookie token
        const cookieStore = await cookies();
        await cookieStore.set(cookieConfig.authCookieName, customToken, {
          path: '/',
          maxAge: cookieConfig.defaultMaxAge,
          httpOnly: true,
          secure: cookieConfig.secure,
          sameSite: cookieConfig.sameSite,
        });
        
        // Trả về thông tin người dùng (không bao gồm thông tin nhạy cảm)
        return NextResponse.json({
          success: true,
          user: {
            uid: uid,
            email: email,
            emailVerified: false,
          }
        });
      } else {
        // Trong môi trường production, sử dụng Firebase Auth REST API
        // Tạo người dùng mới với Firebase REST API
        const authResult = await createUserWithEmailPassword(email, password);
        
        // Tạo custom token cho người dùng mới
        const customToken = await firebaseAdmin.auth().createCustomToken(authResult.uid);
        
        // Thiết lập cookie token
        const cookieStore = await cookies();
        await cookieStore.set(cookieConfig.authCookieName, customToken, {
          path: '/',
          maxAge: cookieConfig.defaultMaxAge,
          httpOnly: true,
          secure: cookieConfig.secure,
          sameSite: cookieConfig.sameSite,
        });
        
        // Trả về thông tin người dùng (không bao gồm thông tin nhạy cảm)
        return NextResponse.json({
          success: true,
          user: {
            uid: authResult.uid,
            email: authResult.email,
            emailVerified: authResult.emailVerified,
          }
        });
      }
    } catch (error) {
      console.error('Lỗi đăng ký:', error);
      
      // Xử lý lỗi Firebase Auth
      let message = 'Đã xảy ra lỗi khi đăng ký';
      let status = 500;
      
      if (error.message === 'EMAIL_EXISTS') {
        message = 'Email đã được sử dụng';
        status = 400;
      } else if (error.message === 'INVALID_EMAIL') {
        message = 'Email không hợp lệ';
        status = 400;
      } else if (error.message === 'WEAK_PASSWORD') {
        message = 'Mật khẩu quá yếu. Vui lòng sử dụng ít nhất 6 ký tự';
        status = 400;
      }
      
      return NextResponse.json({ error: message }, { status });
    }
  } catch (error) {
    console.error('Lỗi server khi đăng ký:', error);
    
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
} 