import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth-utils';
import { cookieConfig } from '@/config/env-config';

export async function adminAuthMiddleware(request) {
  try {
    console.log('🛡️ Admin Middleware - Bắt đầu kiểm tra xác thực');
    
    // Get admin token from cookies - sửa lỗi bằng cách gọi trực tiếp
    const adminToken = cookies().get(cookieConfig.authCookieName);
    const adminAccess = cookies().get('admin_access');
    
    console.log('🛡️ Admin Middleware - Kết quả kiểm tra cookie:');
    console.log('- Token:', adminToken ? 'Đã tìm thấy' : 'Không tìm thấy');
    console.log('- Admin access:', adminAccess?.value || 'Không có');
    
    if (!adminToken) {
      console.log('🛡️ Admin Middleware - Không tìm thấy token, từ chối truy cập');
      return NextResponse.json(
        { error: 'Unauthorized: Missing admin token' },
        { status: 401 }
      );
    }
    
    if (adminAccess?.value !== 'true') {
      console.log('🛡️ Admin Middleware - Không có cookie admin_access, từ chối truy cập');
      return NextResponse.json(
        { error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }
    
    // Verify admin token
    console.log('🛡️ Admin Middleware - Xác thực token...');
    const admin = await verifyToken(adminToken.value);
    
    if (!admin) {
      console.log('🛡️ Admin Middleware - Token không hợp lệ');
      return NextResponse.json(
        { error: 'Forbidden: Invalid admin token' },
        { status: 403 }
      );
    }
    
    // Kiểm tra role có phải là admin không
    console.log('🛡️ Admin Middleware - Kiểm tra vai trò:', admin.role || 'không có');
    if (!admin.role || admin.role !== 'admin') {
      console.log('🛡️ Admin Middleware - Không phải admin role');
      return NextResponse.json(
        { error: 'Forbidden: Admin privileges required' },
        { status: 403 }
      );
    }
    
    // Loại bỏ phần kiểm tra email admin, chỉ kiểm tra role
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