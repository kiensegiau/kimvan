import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { authMiddleware, checkAuthAndRole } from '@/lib/auth';
import { cookies } from 'next/headers';

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

// GET: Lấy tất cả khóa học cho admin (không mã hóa)
export async function GET(request) {
  try {
    // Kiểm tra cookie admin_access
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    console.log('Admin API được gọi, cookie admin_access:', adminAccess ? adminAccess.value : 'không có');
    
    // Nếu có cookie admin_access, cho phép truy cập
    if (adminAccess && adminAccess.value === 'true') {
      console.log('🔒 Admin API - Đã có cookie admin_access, cho phép truy cập');
      
      // Đảm bảo kết nối đến MongoDB trước khi truy vấn
      await connectDB();
      
      // Lấy danh sách khóa học từ MongoDB
      const courses = await Course.find({}).lean().exec();
      
      // Trả về dữ liệu không mã hóa cho admin
      return NextResponse.json(courses);
    }
    
    // Kiểm tra xác thực người dùng và quyền admin
    const hasAccess = await checkAuthAndRole(request, 'admin');
    console.log('Kết quả kiểm tra quyền admin:', hasAccess);
    
    if (!hasAccess) {
      console.log('❌ Admin API - Không có quyền admin');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền truy cập vào tài nguyên này' 
      }, { status: 403 });
    }
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Lấy danh sách khóa học từ MongoDB
    const courses = await Course.find({}).lean().exec();
    
    // Trả về dữ liệu không mã hóa cho admin
    return NextResponse.json(courses);
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu khóa học cho admin:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi lấy dữ liệu khóa học. Vui lòng kiểm tra kết nối MongoDB.',
      error: error.message 
    }, { status: 500 });
  }
}

// POST: Tạo khóa học mới cho admin
export async function POST(request) {
  try {
    // Kiểm tra cookie admin_access
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    // Nếu có cookie admin_access, cho phép truy cập
    if (adminAccess && adminAccess.value === 'true') {
      console.log('🔒 Admin API - Đã có cookie admin_access, cho phép truy cập');
      
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
      
      return NextResponse.json({
        success: true,
        message: 'Khóa học đã được tạo thành công',
        course: createdCourse
      }, { status: 201 });
    }
    
    // Kiểm tra xác thực người dùng và quyền admin
    const hasAccess = await checkAuthAndRole(request, 'admin');
    
    if (!hasAccess) {
      console.log('❌ Admin API - Không có quyền admin');
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền thực hiện hành động này' 
      }, { status: 403 });
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
    
    return NextResponse.json({
      success: true,
      message: 'Khóa học đã được tạo thành công',
      course: createdCourse
    }, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi tạo khóa học mới:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi tạo khóa học mới. Vui lòng kiểm tra kết nối MongoDB.',
      error: error.message 
    }, { status: 500 });
  }
} 