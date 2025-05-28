import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { cookieConfig } from '@/config/env-config';
import firebaseAdmin from '@/lib/firebase-admin';
import { verifyServerAuthToken } from '@/utils/server-auth';

/**
 * API route để làm mới token xác thực
 * Sẽ được gọi tự động bởi middleware khi token gần hết hạn
 */
export async function POST(request) {
  try {
    // Lấy dữ liệu từ request body
    const body = await request.json();
    const { token: tokenFromBody, rememberMe } = body;
    
    // Lấy token hiện tại từ cookie hoặc request body
    const cookieStore = cookies();
    const tokenFromCookie = await cookieStore.get(cookieConfig.authCookieName)?.value;
    
    // Ưu tiên sử dụng token từ body nếu có
    const currentToken = tokenFromBody || tokenFromCookie;
    
    // Nếu không có token, trả về lỗi
    if (!currentToken) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy token xác thực' },
        { status: 401 }
      );
    }

    // Xác thực token hiện tại
    const user = await verifyServerAuthToken(currentToken);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Token không hợp lệ hoặc đã hết hạn' },
        { status: 401 }
      );
    }

    // Tạo token mới với thời gian sống dài hơn
    const customToken = await firebaseAdmin.auth().createCustomToken(user.uid);
    
    // Đổi custom token thành ID token bằng cách gọi Firebase Auth REST API
    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    if (!firebaseApiKey) {
      throw new Error('Firebase API Key không được cấu hình');
    }
    
    // Gọi Firebase Auth REST API để đổi custom token thành ID token
    const tokenResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: customToken,
          returnSecureToken: true,
        }),
      }
    );
    
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('Lỗi khi đổi custom token thành ID token:', tokenData.error);
      throw new Error('Không thể tạo ID token mới');
    }
    
    // Lấy ID token mới từ kết quả
    const newIdToken = tokenData.idToken;
    
    // Thiết lập thời gian sống của cookie
    const maxAge = rememberMe ? cookieConfig.extendedMaxAge : cookieConfig.defaultMaxAge;
    
    // Thiết lập cookie với token mới
    await cookieStore.set(cookieConfig.authCookieName, newIdToken, {
      path: '/',
      maxAge,
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
    });

    // Trả về kết quả thành công với token mới
    return NextResponse.json({
      success: true,
      message: 'Token đã được làm mới thành công',
      token: newIdToken
    });
  } catch (error) {
    console.error('Lỗi khi làm mới token:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi làm mới token: ' + error.message },
      { status: 500 }
    );
  }
} 