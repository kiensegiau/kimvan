import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { loginWithEmailPassword } from '@/utils/auth';
import { cookieConfig } from '@/config/env-config';
import { rateLimit } from '@/utils/rate-limit';
import { trackFailedLogin, trackSuccessfulLogin, isIPBlocked, isEmailLocked } from '@/utils/auth-monitor';

// Hằng số CSRF
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_FORM_FIELD = '_csrf';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

// Lưu trữ rate limit localy cho login attempts
const loginRateLimits = new Map();

/**
 * Kiểm tra CSRF token
 */
async function validateCsrfToken(providedToken) {
  if (!providedToken) return false;
  
  const cookieStore = cookies();
  const storedToken = (await cookieStore.get(CSRF_COOKIE_NAME))?.value;
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
 * Xử lý POST request để đăng nhập
 */
export async function POST(request) {
  try {
    // Lấy thông tin từ request
    const body = await request.json();
    const { email, password, rememberMe, [CSRF_FORM_FIELD]: csrfToken } = body;

    // Lấy IP của client
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    
    // Kiểm tra xem IP có bị chặn không
    if (isIPBlocked(ip)) {
      return NextResponse.json(
        { error: 'Địa chỉ IP của bạn đã bị tạm thời chặn do quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau.' },
        { status: 403 }
      );
    }
    
    // Kiểm tra xem email có bị tạm khóa không
    if (email && isEmailLocked(email)) {
      return NextResponse.json(
        { error: 'Tài khoản này đã bị tạm thời khóa do quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau hoặc đặt lại mật khẩu.' },
        { status: 403 }
      );
    }
    
    // Kiểm tra rate limit
    const rateLimitInfo = rateLimit(ip, 5, 15 * 60 * 1000); // 5 lần/15 phút
    
    // Nếu quá giới hạn, trả về lỗi 429
    if (rateLimitInfo.isLimited) {
      // Ghi nhận lần thất bại do rate limit
      if (email) {
        trackFailedLogin(email, ip, 'rate_limit_exceeded');
      }
      
      return NextResponse.json(
        { error: 'Quá nhiều lần thử đăng nhập, vui lòng thử lại sau.' },
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
      // Ghi nhận lần thất bại do CSRF không hợp lệ
      if (email) {
        trackFailedLogin(email, ip, 'invalid_csrf');
      }
      
      return NextResponse.json(
        { error: 'CSRF token không hợp lệ. Vui lòng thử lại.' },
        { status: 403 }
      );
    }
    
    // Kiểm tra thông tin đăng nhập
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email và mật khẩu là bắt buộc' },
        { status: 400 }
      );
    }
    
    try {
      // Đăng nhập với Firebase
      const userCredential = await loginWithEmailPassword(email, password);
      
      // Lấy token từ người dùng đã đăng nhập
      const token = await userCredential.user.getIdToken();
      
      // Thiết lập thời gian sống của cookie
      const maxAge = rememberMe ? cookieConfig.extendedMaxAge : cookieConfig.defaultMaxAge;
      
      // Thiết lập cookie token
      const cookieStore = cookies();
      await cookieStore.set(cookieConfig.authCookieName, token, {
        path: '/',
        maxAge,
        httpOnly: true,
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
      });
      
      // Reset rate limit counter nếu đăng nhập thành công
      if (loginRateLimits.has(ip)) {
        loginRateLimits.delete(ip);
      }
      
      // Ghi nhận đăng nhập thành công
      trackSuccessfulLogin(email, ip, userCredential.user.uid);
      
      // Trả về thông tin người dùng (không bao gồm thông tin nhạy cảm)
      return NextResponse.json({
        success: true,
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          emailVerified: userCredential.user.emailVerified,
          displayName: userCredential.user.displayName,
          photoURL: userCredential.user.photoURL,
        }
      });
    } catch (error) {
      // Ghi nhận lần đăng nhập thất bại
      trackFailedLogin(email, ip, error.code || 'unknown_error');
      
      // Xử lý lỗi Firebase Auth
      let message = 'Đã xảy ra lỗi khi đăng nhập';
      let status = 500;
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'Email hoặc mật khẩu không đúng';
        status = 401;
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ít phút';
        status = 429;
      } else if (error.code === 'auth/user-disabled') {
        message = 'Tài khoản đã bị vô hiệu hóa';
        status = 403;
      }
      
      return NextResponse.json({ error: message }, { status });
    }
    
  } catch (error) {
    console.error('Lỗi server khi đăng nhập:', error);
    
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
} 