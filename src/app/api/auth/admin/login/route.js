import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import admin from '@/lib/firebase-admin';
import clientPromise from '@/lib/mongodb';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email và mật khẩu là bắt buộc' 
      }, { status: 400 });
    }

    // Kiểm tra quyền admin trong MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');

    // Xác thực thông qua Firebase Admin
    try {
      // Trong thực tế, bạn sẽ sử dụng signInWithEmailAndPassword từ Firebase
      // Nhưng ở đây chúng ta sẽ giả lập việc đó bằng cách lấy người dùng từ Firebase Admin
      const userRecord = await admin.auth().getUserByEmail(email);
      
      // Kiểm tra xem người dùng có quyền admin không (từ MongoDB)
      const adminUser = await db.collection('users').findOne({
        firebaseId: userRecord.uid,
        role: 'admin'
      });
      
      if (!adminUser) {
        return NextResponse.json({ 
          success: false, 
          error: 'Người dùng không có quyền quản trị' 
        }, { status: 403 });
      }
      
      // Tạo mã thông báo quản trị (trong thực tế, bạn sẽ tạo JWT)
      const token = generateAdminToken(userRecord.uid);
      
      // Thiết lập cookie
      const cookieStore = cookies();
      cookieStore.set('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24, // 1 ngày
        path: '/',
      });
      
      return NextResponse.json({ 
        success: true,
        message: 'Đăng nhập thành công',
        user: {
          id: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || adminUser.displayName,
          role: adminUser.role,
        },
      });
    } catch (error) {
      console.error('Lỗi xác thực:', error);
      
      // Giả lập đăng nhập cho mục đích phát triển
      if (process.env.NODE_ENV === 'development' && email === 'admin@example.com' && password === 'admin123') {
        // Tạo mã thông báo quản trị giả
        const token = generateAdminToken('admin-mock');
        
        // Thiết lập cookie
        const cookieStore = cookies();
        cookieStore.set('admin_token', token, {
          httpOnly: true,
          secure: false,
          maxAge: 60 * 60 * 24, // 1 ngày
          path: '/',
        });
        
        return NextResponse.json({ 
          success: true,
          message: 'Đăng nhập thành công (chế độ phát triển)',
          user: {
            id: 'admin-mock',
            email: 'admin@example.com',
            displayName: 'Quản trị viên',
            role: 'admin',
          },
        });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: 'Email hoặc mật khẩu không đúng' 
      }, { status: 401 });
    }
  } catch (error) {
    console.error('Lỗi đăng nhập admin:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi đăng nhập: ' + error.message 
    }, { status: 500 });
  }
}

// Hàm tạo mã thông báo quản trị (trong thực tế, sẽ sử dụng JWT)
function generateAdminToken(uid) {
  return `admin-${uid}-${Date.now()}-${Math.random().toString(36).substr(2, 10)}`;
} 