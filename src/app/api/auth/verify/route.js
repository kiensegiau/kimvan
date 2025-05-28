import { NextResponse } from 'next/server';
import { verifyServerAuthToken } from '@/utils/server-auth';

/**
 * API route để xác thực token
 * Sử dụng bởi các trang client-side và server components
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Không có token' },
        { status: 400 }
      );
    }

    // Xác thực token với Firebase Admin
    const user = await verifyServerAuthToken(token);

    if (!user) {
      return NextResponse.json(
        { valid: false, error: 'Token không hợp lệ hoặc đã hết hạn' },
        { status: 401 }
      );
    }

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
    console.error('Lỗi xác thực token:', error);
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
    // Lấy token từ cookie
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'Không có token' },
        { status: 401 }
      );
    }

    // Xác thực token với Firebase Admin
    const user = await verifyServerAuthToken(token);

    if (!user) {
      return NextResponse.json(
        { authenticated: false, error: 'Token không hợp lệ hoặc đã hết hạn' },
        { status: 401 }
      );
    }

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
    console.error('Lỗi xác thực token:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Lỗi xác thực token: ' + error.message },
      { status: 500 }
    );
  }
} 