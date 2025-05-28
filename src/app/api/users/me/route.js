import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { cookies } from 'next/headers';
import { verifyServerAuthToken } from '@/utils/server-auth';
import { cookieConfig } from '@/config/env-config';
import { ObjectId } from 'mongodb';
import { authMiddleware } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import mongoose from 'mongoose';

export async function GET(request) {
  try {
    // Xác thực người dùng
    const user = await authMiddleware(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy thông tin người dùng' },
        { status: 401 }
      );
    }
    
    // Kết nối đến MongoDB để lấy thêm thông tin
    await connectDB();
    
    // Tìm thông tin người dùng trong MongoDB
    const db = mongoose.connection.db;
    const userCollection = db.collection('users');
    
    const userDetails = await userCollection.findOne({ firebaseId: user.uid });
    
    // Kết hợp thông tin từ Firebase và MongoDB
    const userData = {
      ...user,
      // Thêm các thông tin từ MongoDB nếu có
      canViewAllCourses: userDetails?.canViewAllCourses || false,
      additionalInfo: userDetails?.additionalInfo || {},
      enrollments: userDetails?.enrollments || []
    };
    
    return NextResponse.json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin người dùng:', error);
    return NextResponse.json(
      { success: false, message: 'Đã xảy ra lỗi khi lấy thông tin người dùng', error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    // Xác thực người dùng
    const user = await authMiddleware(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy thông tin người dùng' },
        { status: 401 }
      );
    }
    
    // Lấy dữ liệu từ request
    const requestData = await request.json();
    const { displayName, phoneNumber, additionalInfo } = requestData;
    
    // Kết nối đến MongoDB
    await connectDB();
    const db = mongoose.connection.db;
    const userCollection = db.collection('users');
    
    // Chuẩn bị dữ liệu cập nhật
    const updateData = {
      $set: {
        updatedAt: new Date()
      }
    };
    
    // Thêm các trường cần cập nhật nếu có
    if (displayName !== undefined) {
      updateData.$set.displayName = displayName;
    }
    
    if (phoneNumber !== undefined) {
      updateData.$set.phoneNumber = phoneNumber;
    }
    
    if (additionalInfo !== undefined) {
      updateData.$set.additionalInfo = additionalInfo;
    }
    
    // Cập nhật trong MongoDB
    const result = await userCollection.updateOne(
      { firebaseId: user.uid },
      updateData,
      { upsert: true }
    );
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      user: {
        ...user,
        displayName: displayName !== undefined ? displayName : user.displayName,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : user.phoneNumber,
        additionalInfo: additionalInfo !== undefined ? additionalInfo : user.additionalInfo
      }
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật thông tin người dùng:', error);
    return NextResponse.json(
      { success: false, message: 'Đã xảy ra lỗi khi cập nhật thông tin người dùng', error: error.message },
      { status: 500 }
    );
  }
} 