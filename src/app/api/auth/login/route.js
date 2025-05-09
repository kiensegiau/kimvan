import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cookieConfig } from '@/config/env-config';
import { rateLimit } from '@/utils/rate-limit';
import { trackFailedLogin, trackSuccessfulLogin, isIPBlocked, isEmailLocked } from '@/utils/auth-monitor';
import firebaseAdmin from '@/lib/firebase-admin';
import { verifyEmailPassword } from '@/utils/firebase-auth-helper';

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
 * Xử lý POST request để đăng nhập
 */
export async function POST(request) {
  try {
    console.log('🔒 API đăng nhập được gọi');
    
    // Lấy thông tin từ request
    const body = await request.json();
    const { email, password, rememberMe, [CSRF_FORM_FIELD]: csrfToken } = body;
    
    console.log('📧 Email đăng nhập:', email);
    console.log('🔐 Mật khẩu có được cung cấp:', !!password);
    console.log('🔄 Remember me:', !!rememberMe);
    console.log('🛡️ CSRF token có được cung cấp:', !!csrfToken);

    // Lấy IP của client
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    console.log('🌐 IP của client:', ip);
    
    // Kiểm tra xem IP có bị chặn không
    const ipBlocked = isIPBlocked(ip);
    console.log('🚫 IP có bị chặn:', ipBlocked);
    if (ipBlocked) {
      return NextResponse.json(
        { error: 'Địa chỉ IP của bạn đã bị tạm thời chặn do quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau.' },
        { status: 403 }
      );
    }
    
    // Kiểm tra xem email có bị tạm khóa không
    const emailLocked = email && isEmailLocked(email);
    console.log('🔒 Email có bị khóa:', emailLocked);
    if (emailLocked) {
      return NextResponse.json(
        { error: 'Tài khoản này đã bị tạm thời khóa do quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau hoặc đặt lại mật khẩu.' },
        { status: 403 }
      );
    }
    
    // Kiểm tra rate limit
    const rateLimitInfo = rateLimit(ip, 5, 15 * 60 * 1000); // 5 lần/15 phút
    console.log('⏱️ Rate limit info:', rateLimitInfo);
    
    // Nếu quá giới hạn, trả về lỗi 429
    if (rateLimitInfo.isLimited) {
      console.log('⚠️ Rate limit exceeded');
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
    const csrfValid = await validateCsrfToken(csrfToken);
    console.log('🛡️ CSRF token hợp lệ:', csrfValid);
    if (!csrfValid) {
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
      console.log('⚠️ Thiếu email hoặc mật khẩu');
      return NextResponse.json(
        { error: 'Email và mật khẩu là bắt buộc' },
        { status: 400 }
      );
    }
    
    try {
      console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
      
      // Luôn sử dụng Firebase Auth thực, bỏ qua chế độ giả lập
      console.log('🚀 Đang sử dụng Firebase Auth API để xác thực');
      try {
        // Xác thực người dùng bằng email và mật khẩu
        console.log('👤 Đang xác thực người dùng với email:', email);
        const authResult = await verifyEmailPassword(email, password);
        console.log('✅ Xác thực thành công, uid:', authResult.uid);
        
        // Tạo custom token cho người dùng
        console.log('🔑 Đang tạo custom token cho uid:', authResult.uid);
        const customToken = await firebaseAdmin.auth().createCustomToken(authResult.uid);
        console.log('✅ Đã tạo custom token thành công');
        
        // Thiết lập thời gian sống của cookie
        const maxAge = rememberMe ? cookieConfig.extendedMaxAge : cookieConfig.defaultMaxAge;
        console.log('⏱️ Thời gian sống của cookie:', maxAge);
        
        // Thiết lập cookie token
        console.log('🍪 Đang thiết lập cookie auth token');
        const cookieStore = await cookies();
        await cookieStore.set(cookieConfig.authCookieName, customToken, {
          path: '/',
          maxAge,
          httpOnly: true,
          secure: cookieConfig.secure,
          sameSite: cookieConfig.sameSite,
        });
        console.log('✅ Đã thiết lập cookie thành công');
        
        // Reset rate limit counter nếu đăng nhập thành công
        if (loginRateLimits.has(ip)) {
          loginRateLimits.delete(ip);
        }
        
        // Ghi nhận đăng nhập thành công
        trackSuccessfulLogin(email, ip, authResult.uid);
        
        // Lấy thông tin chi tiết về người dùng từ Firebase Admin
        console.log('👤 Đang lấy thông tin chi tiết về người dùng');
        const userRecord = await firebaseAdmin.auth().getUser(authResult.uid);
        console.log('✅ Đã lấy thông tin người dùng thành công');
        
        // Trả về thông tin người dùng (không bao gồm thông tin nhạy cảm)
        return NextResponse.json({
          success: true,
          user: {
            uid: userRecord.uid,
            email: userRecord.email,
            emailVerified: userRecord.emailVerified,
            displayName: userRecord.displayName || null,
            photoURL: userRecord.photoURL || null,
          }
        });
      } catch (error) {
        // Ghi nhận lần đăng nhập thất bại
        console.error('❌ Lỗi xác thực:', error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        
        trackFailedLogin(email, ip, error.message || 'unknown_error');
        
        // Xử lý lỗi Firebase Auth
        let message = 'Email hoặc mật khẩu không đúng';
        let status = 401;
        
        if (error.message === 'EMAIL_NOT_FOUND' || error.message === 'INVALID_PASSWORD') {
          message = 'Email hoặc mật khẩu không đúng';
        } else if (error.message === 'USER_DISABLED') {
          message = 'Tài khoản đã bị vô hiệu hóa';
          status = 403;
        } else if (error.message === 'TOO_MANY_ATTEMPTS_TRY_LATER') {
          message = 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau ít phút';
          status = 429;
        }
        
        return NextResponse.json({ error: message }, { status });
      }
      
    } catch (error) {
      // Ghi nhận lần đăng nhập thất bại
      console.error('❌ Lỗi ngoài cùng:', error);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
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
    console.error('❌ Lỗi server khi đăng nhập:', error);
    
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
} 