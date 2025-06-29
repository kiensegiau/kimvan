import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyToken } from '@/utils/auth-utils';
import { cookieConfig } from '@/config/env-config';

export async function adminAuthMiddleware(request) {
  try {
    // Lấy headers từ request
    const headersList = headers();
    const authToken = headersList.get('x-auth-token'); 
    const userRole = headersList.get('x-user-role');
    
    if (!authToken) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing admin token' },
        { status: 401 }
      );
    }
    
    if (userRole !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }
    
    // Verify admin token
    const admin = await verifyToken(authToken);
    
    if (!admin) {
      return NextResponse.json(
        { error: 'Forbidden: Invalid admin token' },
        { status: 403 }
      );
    }
    
    // Add verified admin data to the request
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