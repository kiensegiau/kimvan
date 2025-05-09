import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import CryptoJS from 'crypto-js';
import mongoose from 'mongoose';
import Course from '@/models/Course';

// Khóa mã hóa - phải giống với khóa ở phía client
const ENCRYPTION_KEY = 'kimvan-secure-key-2024';

// Đảm bảo kết nối MongoDB được thiết lập
let isConnected = false;
const connectDB = async () => {
  if (isConnected) return;
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    isConnected = true;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

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
    // Lấy tham số secure từ URL
    const { searchParams } = new URL(request.url);
    const secure = searchParams.get('secure') === 'true';
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Lấy danh sách khóa học từ MongoDB
    const courses = await Course.find({}).lean().exec();
    
    if (secure) {
      // Mã hóa toàn bộ danh sách khóa học nếu yêu cầu bảo mật cao
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
    } else {
      // Lọc dữ liệu nhạy cảm và chỉ trả về các trường cần thiết
      const safeCourses = courses.map(course => ({
        _id: course._id,
        name: course.name,
        description: course.description,
        price: course.price,
        status: course.status,
        updatedAt: course.updatedAt,
        createdAt: course.createdAt,
        // Không bao gồm originalData và các trường nhạy cảm khác
      }));
      
      return NextResponse.json(safeCourses);
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
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Khóa học đã được tạo thành công', 
        course: safeResponse
      }, 
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