import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import CryptoJS from 'crypto-js';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { authMiddleware } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';

// Khóa mã hóa - phải giống với khóa ở phía client
const ENCRYPTION_KEY = 'kimvan-secure-key-2024';

// Hàm mã hóa dữ liệu với xử lý lỗi tốt hơn
const encryptData = (data) => {
  try {
    if (!data) {
      throw new Error("Không có dữ liệu để mã hóa");
    }
    
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Lỗi mã hóa:", error);
    throw new Error(`Không thể mã hóa dữ liệu: ${error.message}`);
  }
};

// GET: Lấy tất cả khóa học
export async function GET(request) {
  try {
    // Kiểm tra xác thực người dùng sử dụng Firebase Auth
    const user = await authMiddleware(request);
    
    // Luôn mã hóa dữ liệu, bất kể người dùng đã đăng nhập hay chưa
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Lấy danh sách khóa học từ MongoDB
    const courses = await Course.find({}).lean().exec();
    
    // Luôn mã hóa dữ liệu, bất kể tham số secure là gì
    try {
      const encryptedData = encryptData(courses);
      return NextResponse.json({ _secureData: encryptedData });
    } catch (encryptError) {
      console.error("Lỗi khi mã hóa dữ liệu:", encryptError);
      return NextResponse.json({ 
        error: 'Lỗi khi xử lý dữ liệu khóa học',
        message: encryptError.message 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi lấy dữ liệu khóa học. Vui lòng kiểm tra kết nối MongoDB.',
      error: error.message 
    }, { status: 500 });
  }
}

// POST: Tạo khóa học mới
export async function POST(request) {
  try {
    // Kiểm tra xác thực người dùng sử dụng Firebase Auth
    const user = await authMiddleware(request);
    if (!user) {
      return NextResponse.json({ error: "Bạn cần đăng nhập để thực hiện thao tác này" }, { status: 401 });
    }
    
    const body = await request.json();
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    const newCourse = {
      name: body.name,
      description: body.description,
      price: body.price,
      status: body.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    // Sử dụng Mongoose để tạo khóa học mới
    const createdCourse = await Course.create(newCourse);
    
    // Trả về thông tin khóa học đã tạo nhưng loại bỏ dữ liệu nhạy cảm
    const safeResponse = {
      _id: createdCourse._id,
      name: createdCourse.name,
      description: createdCourse.description,
      price: createdCourse.price,
      status: createdCourse.status,
      createdAt: createdCourse.createdAt,
    };
    
    // Mã hóa phản hồi
    const encryptedResponse = encryptData({
      success: true,
      message: 'Khóa học đã được tạo thành công',
      course: safeResponse
    });
    
    return NextResponse.json(
      { _secureData: encryptedResponse }, 
      { status: 201 }
    );
  } catch (error) {
    console.error('Lỗi khi tạo khóa học mới:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi tạo khóa học mới. Vui lòng kiểm tra kết nối MongoDB.',
      error: error.message 
    }, { status: 500 });
  }
} 