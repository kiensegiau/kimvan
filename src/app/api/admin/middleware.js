import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyToken } from '@/utils/auth-utils';
import { cookieConfig } from '@/config/env-config';

export async function adminAuthMiddleware(request) {
  try {
    console.log('🛡️ Admin Middleware - Bắt đầu kiểm tra xác thực');
    
    // Lấy headers từ request
    const headersList = headers();
    const authToken = headersList.get('x-auth-token'); 
    const userRole = headersList.get('x-user-role');
    
    console.log('🛡️ Admin Middleware - Kết quả kiểm tra headers:');
    console.log('- Token:', authToken ? 'Đã tìm thấy' : 'Không tìm thấy');
    console.log('- User role:', userRole || 'Không có');
    
    if (!authToken) {
      console.log('🛡️ Admin Middleware - Không tìm thấy token, từ chối truy cập');
      return NextResponse.json(
        { error: 'Unauthorized: Missing admin token' },
        { status: 401 }
      );
    }
    
    if (userRole !== 'admin') {
      console.log('🛡️ Admin Middleware - Không có quyền admin, từ chối truy cập');
      return NextResponse.json(
        { error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }
    
    // Verify admin token
    console.log('🛡️ Admin Middleware - Xác thực token...');
    const admin = await verifyToken(authToken);
    
    if (!admin) {
      console.log('🛡️ Admin Middleware - Token không hợp lệ');
      return NextResponse.json(
        { error: 'Forbidden: Invalid admin token' },
        { status: 403 }
      );
    }
    
    // Kiểm tra role có phải là admin không - Đã kiểm tra từ header nên không cần kiểm tra lại
    console.log('🛡️ Admin Middleware - User admin hợp lệ:', admin.email);
    
    // Add verified admin data to the request
    console.log('🛡️ Admin Middleware - Xác thực thành công, thêm thông tin admin vào request');
    const requestWithAdmin = new Request(request);
    requestWithAdmin.admin = {
      uid: admin.uid,
      email: admin.email,
      displayName: admin.displayName || admin.name,
      role: 'admin',
      isAdmin: true
    };
    
    return requestWithAdmin;
  } catch (error) {
    console.error('🛡️ Admin Middleware - Lỗi xác thực:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
} 