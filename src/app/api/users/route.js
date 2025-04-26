import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';
import clientPromise from '@/lib/mongodb';

// GET /api/users - Lấy danh sách người dùng
export async function GET(request) {
  try {
    // Kết nối đến MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    // Lấy danh sách người dùng từ Firebase Auth
    const { users } = await admin.auth().listUsers();
    
    // Lấy thông tin bổ sung từ MongoDB
    const userIds = users.map(user => user.uid);
    const userDetails = await db.collection('users').find({
      firebaseId: { $in: userIds }
    }).toArray();
    
    // Kết hợp dữ liệu từ cả hai nguồn
    const combinedUsers = users.map(firebaseUser => {
      const mongoUser = userDetails.find(u => u.firebaseId === firebaseUser.uid) || {};
      
      return {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || '',
        phoneNumber: firebaseUser.phoneNumber || '',
        photoURL: firebaseUser.photoURL || '',
        emailVerified: firebaseUser.emailVerified,
        disabled: firebaseUser.disabled,
        createdAt: firebaseUser.metadata.creationTime,
        lastLoginAt: firebaseUser.metadata.lastSignInTime,
        // Thông tin bổ sung từ MongoDB
        role: mongoUser.role || 'user',
        status: mongoUser.status || 'active',
        additionalInfo: mongoUser.additionalInfo || {},
        // Các thông tin khác từ MongoDB nếu có
        ...mongoUser
      };
    });
    
    return NextResponse.json({ 
      success: true,
      data: combinedUsers
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi lấy danh sách người dùng: ' + error.message 
    }, { status: 500 });
  }
}

// POST /api/users - Tạo người dùng mới
export async function POST(request) {
  try {
    // Kết nối đến MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    // Lấy dữ liệu từ request
    const body = await request.json();
    const { email, password, displayName, phoneNumber, role, status, additionalInfo } = body;

    // Kiểm tra dữ liệu bắt buộc
    if (!email || !password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email và mật khẩu là bắt buộc' 
      }, { status: 400 });
    }

    // Tạo người dùng trong Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
      phoneNumber,
      disabled: status === 'inactive'
    });

    // Lưu thông tin bổ sung vào MongoDB
    await db.collection('users').insertOne({
      firebaseId: userRecord.uid,
      email,
      displayName,
      phoneNumber,
      role: role || 'user',
      status: status || 'active',
      additionalInfo: additionalInfo || {},
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return NextResponse.json({ 
      success: true,
      data: {
        id: userRecord.uid,
        email,
        displayName,
        role,
        status
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi tạo người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi tạo người dùng: ' + error.message 
    }, { status: 500 });
  }
}

// PATCH /api/users/[id] - Cập nhật thông tin người dùng
export async function PATCH(request) {
  try {
    // Lấy ID người dùng từ URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thiếu ID người dùng' 
      }, { status: 400 });
    }

    // Kết nối đến MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    // Lấy dữ liệu từ request
    const body = await request.json();
    const { displayName, phoneNumber, role, status, additionalInfo } = body;
    
    // Cập nhật trong Firebase Auth
    const updateData = {};
    if (displayName !== undefined) updateData.displayName = displayName;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (status !== undefined) updateData.disabled = status === 'inactive';
    
    // Chỉ cập nhật Firebase nếu có thông tin cần cập nhật
    if (Object.keys(updateData).length > 0) {
      await admin.auth().updateUser(id, updateData);
    }
    
    // Cập nhật trong MongoDB
    const mongoUpdateData = {
      updatedAt: new Date()
    };
    
    if (displayName !== undefined) mongoUpdateData.displayName = displayName;
    if (phoneNumber !== undefined) mongoUpdateData.phoneNumber = phoneNumber;
    if (role !== undefined) mongoUpdateData.role = role;
    if (status !== undefined) mongoUpdateData.status = status;
    if (additionalInfo !== undefined) mongoUpdateData.additionalInfo = additionalInfo;
    
    // Kiểm tra xem bản ghi đã tồn tại trong MongoDB chưa
    const existingUser = await db.collection('users').findOne({ firebaseId: id });
    
    if (existingUser) {
      // Cập nhật bản ghi hiện có
      await db.collection('users').updateOne(
        { firebaseId: id },
        { $set: mongoUpdateData }
      );
    } else {
      // Tạo bản ghi mới nếu chưa tồn tại
      const userRecord = await admin.auth().getUser(id);
      
      await db.collection('users').insertOne({
        firebaseId: id,
        email: userRecord.email,
        displayName: userRecord.displayName || displayName || '',
        phoneNumber: userRecord.phoneNumber || phoneNumber || '',
        role: role || 'user',
        status: status || 'active',
        additionalInfo: additionalInfo || {},
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Cập nhật người dùng thành công'
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi cập nhật người dùng: ' + error.message 
    }, { status: 500 });
  }
}

// DELETE /api/users/[id] - Xóa người dùng
export async function DELETE(request) {
  try {
    // Lấy ID người dùng từ URL
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thiếu ID người dùng' 
      }, { status: 400 });
    }

    // Kết nối đến MongoDB
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'kimvan');
    
    // Xóa người dùng trong Firebase Auth
    await admin.auth().deleteUser(id);
    
    // Xóa thông tin trong MongoDB
    await db.collection('users').deleteOne({ firebaseId: id });

    return NextResponse.json({ 
      success: true,
      message: 'Xóa người dùng thành công'
    });
  } catch (error) {
    console.error('Lỗi khi xóa người dùng:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi xóa người dùng: ' + error.message 
    }, { status: 500 });
  }
} 