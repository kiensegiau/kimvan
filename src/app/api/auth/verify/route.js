import { NextResponse } from 'next/server';
import { verifyServerAuthToken } from '@/utils/server-auth';

/**
 * API route để xác thực token
 * Sử dụng bởi các trang client-side và server components
 */
export async function POST(request) {
  try {
    console.log('📝 API verify: Đang xử lý yêu cầu xác thực token');
    const body = await request.json();
    const { token } = body;

    if (!token) {
      console.log('❌ API verify: Không có token trong request');
      return NextResponse.json(
        { valid: false, error: 'Không có token' },
        { status: 400 }
      );
    }

    console.log('🔍 API verify: Đang xác thực token...');
    // Xác thực token với Firebase Admin
    const user = await verifyServerAuthToken(token);

    if (!user) {
      console.log('❌ API verify: Token không hợp lệ hoặc đã hết hạn');
      return NextResponse.json(
        { valid: false, error: 'Token không hợp lệ hoặc đã hết hạn' },
        { status: 401 }
      );
    }

    console.log('✅ API verify: Token hợp lệ, trả về thông tin người dùng');
    // Trả về thông tin người dùng nếu token hợp lệ
    return NextResponse.json({
      valid: true,
      user: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: user.role || 'user',
        tokenExpiration: user.tokenExpiration || null,
      }
    });

  } catch (error) {
    console.error('❌ API verify: Lỗi xác thực token:', error);
    return NextResponse.json(
      { valid: false, error: 'Lỗi xác thực token: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * API route để lấy thông tin người dùng từ cookie token
 * Sử dụng bởi server components
 */
export async function GET(request) {
  try {
    console.log('📝 API verify GET: Đang xử lý yêu cầu lấy thông tin người dùng');
    // Lấy token từ cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      console.log('❌ API verify GET: Không có token trong cookie');
      return NextResponse.json(
        { authenticated: false, error: 'Không có token' },
        { status: 401 }
      );
    }

    console.log('🔍 API verify GET: Đang xác thực token từ cookie...');
    // Xác thực token với Firebase Admin
    const user = await verifyServerAuthToken(token);

    if (!user) {
      console.log('❌ API verify GET: Token không hợp lệ hoặc đã hết hạn');
      return NextResponse.json(
        { authenticated: false, error: 'Token không hợp lệ hoặc đã hết hạn' },
        { status: 401 }
      );
    }

    console.log('✅ API verify GET: Token hợp lệ, trả về thông tin người dùng');
    // Trả về thông tin người dùng nếu token hợp lệ
    return NextResponse.json({
      authenticated: true,
      user: {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        role: user.role || 'user',
        tokenExpiration: user.tokenExpiration || null,
      }
    });

  } catch (error) {
    console.error('❌ API verify GET: Lỗi xác thực token:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Lỗi xác thực token: ' + error.message },
      { status: 500 }
    );
  }
} 