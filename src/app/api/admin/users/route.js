import { NextResponse } from 'next/server';
import { adminAuthMiddleware } from '../middleware';
import clientPromise from '@/lib/mongodb';

// Hàm gọi API thêm người dùng vào Google Group
async function addUserToGoogleGroup(email) {
  try {
    const groupEmail = 'kha-hc-60@googlegroups.com'; // Email của Google Group
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/google-group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        groupEmail,
        role: 'MEMBER'
      }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Lỗi khi thêm người dùng vào Google Group:', data.error);
      return false;
    }
    
    console.log(`Đã thêm người dùng ${email} vào Google Group ${groupEmail} thành công`);
    return true;
  } catch (error) {
    console.error('Lỗi khi gọi API Google Group:', error);
    return false;
  }
}

export async function GET(request) {
  // Kiểm tra xác thực admin
  const authResult = await adminAuthMiddleware(request);
  
  // Nếu kết quả là Response, có nghĩa là middleware đã trả về lỗi
  if (authResult instanceof Response) {
    return authResult;
  }
  
  try {
    // Kết nối MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    // Lấy danh sách người dùng từ collection users
    const users = await db.collection('users')
      .find({})
      .project({ 
        email: 1, 
        displayName: 1, 
        role: 1, 
        createdAt: 1,
        lastLogin: 1
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    
    return NextResponse.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error);
    return NextResponse.json({
      success: false,
      error: 'Lỗi khi lấy danh sách người dùng: ' + error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  // Kiểm tra xác thực admin
  const authResult = await adminAuthMiddleware(request);
  
  // Nếu kết quả là Response, có nghĩa là middleware đã trả về lỗi
  if (authResult instanceof Response) {
    return authResult;
  }
  
  try {
    const body = await request.json();
    
    // Kiểm tra dữ liệu đầu vào
    if (!body.email || !body.displayName || !body.role) {
      return NextResponse.json({
        success: false,
        error: 'Thiếu thông tin người dùng bắt buộc'
      }, { status: 400 });
    }
    
    // Kết nối MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await db.collection('users').findOne({ email: body.email });
    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'Email đã tồn tại trong hệ thống'
      }, { status: 409 });
    }
    
    // Tạo người dùng mới
    const newUser = {
      email: body.email,
      displayName: body.displayName,
      role: body.role,
      createdAt: new Date(),
      createdBy: authResult.admin.email
    };
    
    const result = await db.collection('users').insertOne(newUser);
    
    // Thêm người dùng vào Google Group nếu được yêu cầu
    if (body.addToGoogleGroup) {
      await addUserToGoogleGroup(body.email);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        id: result.insertedId,
        ...newUser
      },
      message: 'Tạo người dùng thành công'
    });
  } catch (error) {
    console.error('Lỗi khi tạo người dùng:', error);
    return NextResponse.json({
      success: false,
      error: 'Lỗi khi tạo người dùng: ' + error.message
    }, { status: 500 });
  }
} 