import { NextResponse } from 'next/server';
import firebaseAdmin from '@/lib/firebase-admin';
import { rateLimit } from '@/utils/rate-limit';
import { sendPasswordResetEmail } from '@/utils/firebase-auth-helper';

/**
 * API route xử lý yêu cầu đặt lại mật khẩu
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = body;
    
    // Lấy IP của client để áp dụng rate limiting
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    
    // Giới hạn số lần yêu cầu đặt lại mật khẩu
    const rateLimitInfo = rateLimit(ip, 3, 60 * 60 * 1000); // 3 lần/giờ
    
    // Nếu quá giới hạn, trả về lỗi 429
    if (rateLimitInfo.isLimited) {
      return NextResponse.json(
        { error: 'Quá nhiều lần yêu cầu, vui lòng thử lại sau.' },
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
    
    // Kiểm tra dữ liệu đầu vào
    if (!email) {
      return NextResponse.json(
        { error: 'Email là bắt buộc' },
        { status: 400 }
      );
    }
    
    try {
      // Trong môi trường phát triển, giả lập gửi email đặt lại mật khẩu
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Gửi email đặt lại mật khẩu cho: ${email}`);
        
        // Trả về thành công
        return NextResponse.json({
          success: true,
          message: 'Email đặt lại mật khẩu đã được gửi (chế độ phát triển)'
        });
      }
      
      // Trong môi trường production, sử dụng Firebase Auth REST API
      await sendPasswordResetEmail(email);
      
      // Trả về thành công
      return NextResponse.json({
        success: true,
        message: 'Email đặt lại mật khẩu đã được gửi'
      });
    } catch (error) {
      console.error('Lỗi gửi email đặt lại mật khẩu:', error);
      
      // Xử lý lỗi Firebase Auth
      let message = 'Đã xảy ra lỗi khi gửi email đặt lại mật khẩu';
      let status = 500;
      
      if (error.message === 'EMAIL_NOT_FOUND') {
        // Không tiết lộ thông tin về việc email có tồn tại hay không để tránh tấn công
        return NextResponse.json({
          success: true,
          message: 'Nếu email tồn tại, một liên kết đặt lại mật khẩu sẽ được gửi'
        });
      } else if (error.message === 'INVALID_EMAIL') {
        message = 'Email không hợp lệ';
        status = 400;
      }
      
      return NextResponse.json({ error: message }, { status });
    }
  } catch (error) {
    console.error('Lỗi server khi xử lý yêu cầu đặt lại mật khẩu:', error);
    
    return NextResponse.json(
      { error: 'Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.' },
      { status: 500 }
    );
  }
} 