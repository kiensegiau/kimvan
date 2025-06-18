import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { authMiddleware, checkAuthAndRole } from '@/lib/auth';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import { cookies } from 'next/headers';

// GET: Lấy tất cả khóa học cho admin và CTV (không mã hóa)
export async function GET(request) {
  try {
    console.log('🔒 API Courses - Kiểm tra quyền truy cập');
    
    // Kiểm tra quyền admin hoặc CTV từ cookie
    const cookieStore = cookies();
    const adminAccess = cookieStore.get('admin_access');
    const ctvAccess = cookieStore.get('ctv_access');
    
    console.log('Cookie admin_access:', adminAccess ? adminAccess.value : 'không có');
    console.log('Cookie ctv_access:', ctvAccess ? ctvAccess.value : 'không có');
    
    // Kiểm tra quyền admin từ header 
    const headersList = headers();
    const userRole = headersList.get('x-user-role');
    console.log('Header x-user-role:', userRole || 'không có');
    
    // Cho phép truy cập nếu là admin hoặc CTV
    if (userRole === 'admin' || userRole === 'ctv' || 
        (adminAccess && adminAccess.value === 'true') || 
        (ctvAccess && ctvAccess.value === 'true')) {
      console.log('🔒 API Courses - Người dùng có quyền truy cập, cho phép truy cập');
      
      // Kết nối đến MongoDB
      await connectDB();
      
      // Lấy tất cả khóa học
      const courses = await Course.find({}).sort({ createdAt: -1 }).lean();
      console.log(`🔒 API Courses - Đã tìm thấy ${courses.length} khóa học`);
      
      // Trả về thông tin khóa học
      return NextResponse.json({ courses });
    } else {
      console.log('⚠️ API Courses - Không có quyền truy cập, từ chối truy cập');
      return NextResponse.json(
        { error: 'Không có quyền truy cập' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Lỗi khi lấy danh sách khóa học:', error);
    return NextResponse.json({ error: 'Lỗi khi lấy danh sách khóa học' }, { status: 500 });
  }
}

// POST: Tạo khóa học mới chỉ cho admin
export async function POST(request) {
  try {
    console.log('🔒 Admin API - Kiểm tra quyền truy cập');
    
    // Kiểm tra quyền admin từ cookie
    const cookieStore = cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    // Kiểm tra quyền admin từ header 
    const headersList = headers();
    const userRole = headersList.get('x-user-role');
    
    // Cho phép truy cập nếu là admin
    if (userRole === 'admin' || (adminAccess && adminAccess.value === 'true')) {
      console.log('🔒 Admin API - Người dùng có quyền admin, cho phép truy cập');
      
      // Kết nối đến MongoDB
      await connectDB();
      
      // Parse body request
      const requestBody = await request.json();
      const {
        name,
        description,
        category,
        status,
        price,
        originalPrice,
        image,
        content,
        level,
        discount
      } = requestBody;
      
      // Kiểm tra thông tin khóa học
      if (!name || !description) {
        return NextResponse.json({
          error: 'Thiếu thông tin khóa học'
        }, { status: 400 });
      }
      
      // Tạo khóa học mới
      const newCourse = new Course({
        name,
        description,
        category: category || 'Không phân loại',
        status: status || 'draft',
        price: price || 0,
        originalPrice: originalPrice || 0,
        image: image || '',
        content: content || '',
        level: level || 'Beginner',
        discount: discount || 0
      });
      
      // Lưu khóa học vào database
      await newCourse.save();
      
      // Trả về thông tin khóa học mới
      return NextResponse.json({
        message: 'Đã tạo khóa học mới thành công',
        course: newCourse
      });
    } else {
      console.log('⚠️ Admin API - Không có quyền admin, từ chối truy cập');
      return NextResponse.json({
        error: 'Không có quyền truy cập'
      }, { status: 403 });
    }
  } catch (error) {
    console.error('Lỗi khi tạo khóa học mới:', error);
    return NextResponse.json({ error: 'Lỗi khi tạo khóa học mới' }, { status: 500 });
  }
} 