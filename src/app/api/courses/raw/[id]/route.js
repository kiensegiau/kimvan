import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { adminAuthMiddleware } from '@/app/api/admin/middleware';

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

// GET: Lấy một khóa học theo ID mà không mã hóa dữ liệu - CHỈ CHO ADMIN
export async function GET(request, { params }) {
  try {
    // Sử dụng middleware admin để xác thực
    const adminRequest = await adminAuthMiddleware(request);
    if (adminRequest instanceof NextResponse) {
      // Nếu trả về NextResponse, nghĩa là có lỗi xác thực
      return adminRequest;
    }
    
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'slug';
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Tìm khóa học theo ID hoặc slug
    let course;
    if (type === '_id') {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ 
          success: false,
          message: 'ID không hợp lệ' 
        }, { status: 400 });
      }
      course = await Course.findById(id).lean().exec();
    } else {
      course = await Course.findOne({ slug: id }).lean().exec();
    }
    
    if (!course) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học' 
      }, { status: 404 });
    }
    
    // Trả về dữ liệu khóa học không mã hóa - CHỈ CHO ADMIN
    return NextResponse.json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Lỗi server',
      error: error.message 
    }, { status: 500 });
  }
} 