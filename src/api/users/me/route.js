import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { connectDB } from '@/lib/database';
import User from '@/models/User';
import { verifyToken, generateTokenHash } from '@/utils/auth-utils';

export async function GET(req) {
  try {
    // Lấy token từ cookie
    const cookieName = process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME || 'auth-token';
    const token = req.cookies.get(cookieName)?.value;
    
    // Kiểm tra token có tồn tại không
    if (!token) {
      console.warn('GET /api/users/me - Không có token');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized',
        message: 'No auth token found'
      }, { status: 401 });
    }
    
    // Xác thực token
    const tokenData = await verifyToken(token);
    if (!tokenData || !tokenData.uid) {
      console.warn('GET /api/users/me - Token không hợp lệ');
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized',
        message: 'Invalid token'
      }, { status: 401 });
    }
    
    // Lấy thông tin người dùng từ MongoDB
    const { db } = await connectDB();
    const user = await User.findOne({ _id: tokenData.uid });
    
    if (!user) {
      console.warn('GET /api/users/me - Không tìm thấy user với ID:', tokenData.uid);
      return NextResponse.json({ 
        success: false, 
        error: 'Not Found',
        message: 'User not found'
      }, { status: 404 });
    }
    
    // Tạo hash từ token để client có thể kiểm tra tính hợp lệ của cache
    const tokenHash = generateTokenHash(token);
    
    // Trả về thông tin người dùng
    return NextResponse.json({ 
      success: true, 
      user: {
        uid: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        roleDisplayName: user.role === 'admin' ? 'Admin' : 
                         user.role === 'ctv' ? 'Cộng tác viên' : 'Học viên',
        additionalInfo: user.additionalInfo || {},
        enrollments: user.enrollments || []
      },
      tokenHash
    });
  } catch (error) {
    console.error('GET /api/users/me - Lỗi:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal Server Error',
      message: error.message
    }, { status: 500 });
  }
} 