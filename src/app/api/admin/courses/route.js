import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { authMiddleware, checkAuthAndRole } from '@/lib/auth';
import { headers, cookies } from 'next/headers';
import { dbMiddleware } from '@/utils/db-middleware';

// GET: Lấy tất cả khóa học cho admin và CTV (không mã hóa)
export async function GET(request) {
  try {
    // Kiểm tra quyền từ cookie
    const cookieStore = cookies();
    // Sử dụng phương thức truy cập cookie an toàn
    let adminAccess = false;
    let ctvAccess = false;
    
    try {
      // Truy cập cookies một cách an toàn
      adminAccess = await cookieStore.has('admin_access');
      ctvAccess = await cookieStore.has('ctv_access');
    } catch (cookieError) {
      console.error('Error accessing cookies:', cookieError);
    }
    
    // Kiểm tra quyền admin từ header 
    const headersList = headers();
    const userRole = await headersList.get('x-user-role');
    
    // Cho phép truy cập nếu là admin/ctv thông qua cookie hoặc header
    const hasAdminAccess = adminAccess || userRole === 'admin';
    const hasCTVAccess = ctvAccess;
    
    if (hasAdminAccess || hasCTVAccess) {
      // Kết nối đến MongoDB
      await dbMiddleware(request);
      
      // Lấy tất cả khóa học
      const courses = await Course.find({}).sort({ createdAt: -1 }).lean();
      
      // Trả về thông tin khóa học
      return NextResponse.json({ courses });
    } else {
      // Thử check authorization header cho API
      const hasAccess = await checkAuthAndRole(request, ['admin', 'ctv']);
      
      if (hasAccess) {
        // Kết nối đến MongoDB
        await dbMiddleware(request);
        
        // Lấy tất cả khóa học
        const courses = await Course.find({}).sort({ createdAt: -1 }).lean();
        
        // Trả về thông tin khóa học
        return NextResponse.json({ courses });
      }
      
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

// POST: Tạo khóa học mới cho admin
export async function POST(request) {
  try {
    // Kiểm tra quyền admin từ cookie
    const cookieStore = cookies();
    // Sử dụng phương thức truy cập cookie an toàn
    let adminAccess = false;
    
    try {
      // Truy cập cookies một cách an toàn
      adminAccess = await cookieStore.has('admin_access');
    } catch (cookieError) {
      console.error('Error accessing cookies:', cookieError);
    }
    
    // Kiểm tra quyền admin từ header 
    const headersList = headers();
    const userRole = await headersList.get('x-user-role');
    
    // Cho phép truy cập nếu là admin
    if (adminAccess || userRole === 'admin') {
      // Kết nối đến MongoDB
      await dbMiddleware(request);
      
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
      // Thử check authorization header cho API
      const hasAccess = await checkAuthAndRole(request, 'admin');
      
      if (hasAccess) {
        // Kết nối đến MongoDB
        await dbMiddleware(request);
        
        // Parse body request và xử lý giống như trên...
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
      }
      
      return NextResponse.json({
        error: 'Không có quyền truy cập'
      }, { status: 403 });
    }
  } catch (error) {
    console.error('Lỗi khi tạo khóa học mới:', error);
    return NextResponse.json({ error: 'Lỗi khi tạo khóa học mới' }, { status: 500 });
  }
} 