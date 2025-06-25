import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cookieConfig } from '@/config/env-config';
import { rateLimit } from '@/utils/rate-limit';
import { trackFailedLogin, trackSuccessfulLogin, isIPBlocked, isEmailLocked } from '@/utils/auth-monitor';
import firebaseAdmin from '@/lib/firebase-admin';

/**
 * Xử lý POST request để đăng nhập
 */
export async function POST(request) {
  try {
    console.log('🔒 API đăng nhập được gọi');
    
    // Lấy thông tin từ request
    const body = await request.json();
    const { idToken, rememberMe } = body;
    
    console.log('🔑 ID Token có được cung cấp:', !!idToken);
    console.log('🔄 Remember me:', !!rememberMe);

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
    
    // Kiểm tra rate limit
    const rateLimitInfo = rateLimit(ip, 5, 15 * 60 * 1000); // 5 lần/15 phút
    console.log('⏱️ Rate limit info:', rateLimitInfo);
    
    // Nếu quá giới hạn, trả về lỗi 429
    if (rateLimitInfo.isLimited) {
      console.log('⚠️ Rate limit exceeded');
      
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
    
    // Kiểm tra thông tin đăng nhập
    if (!idToken) {
      console.log('⚠️ Thiếu ID token');
      return NextResponse.json(
        { error: 'ID token là bắt buộc' },
        { status: 400 }
      );
    }
    
    try {
      console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
      
      // Xác thực ID token bằng Firebase Admin SDK
      console.log('🔍 Đang xác thực ID token...');
      const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;
      console.log('✅ Xác thực token thành công, uid:', uid);
      
      // Lấy thông tin chi tiết về người dùng từ Firebase Admin
      console.log('👤 Đang lấy thông tin chi tiết về người dùng');
      const userRecord = await firebaseAdmin.auth().getUser(uid);
      console.log('✅ Đã lấy thông tin người dùng thành công');
      
      // Kiểm tra xem email có bị tạm khóa không
      const email = userRecord.email;
      const emailLocked = email && isEmailLocked(email);
      console.log('🔒 Email có bị khóa:', emailLocked);
      if (emailLocked) {
        return NextResponse.json(
          { error: 'Tài khoản này đã bị tạm thời khóa do quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau hoặc đặt lại mật khẩu.' },
          { status: 403 }
        );
      }
      
      // Thiết lập thời gian sống của cookie
      const maxAge = rememberMe ? cookieConfig.extendedMaxAge : cookieConfig.defaultMaxAge;
      console.log('⏱️ Thời gian sống của cookie:', maxAge);
      
      // Thiết lập cookie token
      console.log('🍪 Đang thiết lập cookie auth token');
      const cookieStore = await cookies();
      await cookieStore.set(cookieConfig.authCookieName, idToken, {
        path: '/',
        maxAge,
        httpOnly: true,
        secure: cookieConfig.secure,
        sameSite: cookieConfig.sameSite,
      });
      console.log('✅ Đã thiết lập cookie thành công');
      
      // Ghi nhận đăng nhập thành công
      trackSuccessfulLogin(email, ip, uid);
      
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
      
      // Xử lý lỗi Firebase Auth
      let message = 'Token không hợp lệ hoặc hết hạn';
      let status = 401;
      
      if (error.code === 'auth/id-token-expired') {
        message = 'Token đã hết hạn. Vui lòng đăng nhập lại';
      } else if (error.code === 'auth/id-token-revoked') {
        message = 'Token đã bị thu hồi. Vui lòng đăng nhập lại';
      } else if (error.code === 'auth/invalid-id-token') {
        message = 'Token không hợp lệ';
      } else if (error.code === 'auth/user-disabled') {
        message = 'Tài khoản đã bị vô hiệu hóa';
        status = 403;
      }
      
      return NextResponse.json({ error: message }, { status });
    }
  } catch (error) {
    console.error('❌ Lỗi API đăng nhập:', error);
    return NextResponse.json(
      { error: 'Lỗi máy chủ nội bộ' },
      { status: 500 }
    );
  }
} 