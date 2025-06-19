import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { authMiddleware, checkAuthAndRole } from '@/lib/auth';
import { headers, cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';

// GET: Lấy tất cả khóa học cho admin và CTV (không mã hóa)
export async function GET(request) {
  try {
    console.log('🔒 Admin/CTV API - Kiểm tra quyền truy cập');
    
    // Kiểm tra quyền từ cookie
    const cookieStore = cookies();
    const adminAccess = cookieStore.get('admin_access');
    const ctvAccess = cookieStore.get('ctv_access');
    
    console.log(`🔑 Cookie check - adminAccess: ${adminAccess?.value}, ctvAccess: ${ctvAccess?.value}`);
    
    // Kiểm tra quyền admin từ header 
    const headersList = headers();
    const userRole = headersList.get('x-user-role');
    
    console.log(`🔑 Header check - userRole: ${userRole}`);
    
    // Cho phép truy cập nếu là admin/ctv thông qua cookie hoặc header
    const hasAdminAccess = (adminAccess && adminAccess.value === 'true') || userRole === 'admin';
    const hasCTVAccess = (ctvAccess && ctvAccess.value === 'true');
    
    if (hasAdminAccess || hasCTVAccess) {
      if (hasAdminAccess) {
        console.log('🔒 Admin API - Người dùng có quyền admin, cho phép truy cập');
      } else {
        console.log('🔒 CTV API - Người dùng có quyền CTV, cho phép truy cập');
      }
      
      // Kết nối đến MongoDB
      await connectDB();
      
      // Lấy tất cả khóa học
      const courses = await Course.find({}).sort({ createdAt: -1 }).lean();
      
      console.log(`✅ Lấy thành công ${courses.length} khóa học`);
      
      // Trả về thông tin khóa học
      return NextResponse.json({ courses });
    } else {
      // Thử check authorization header cho API
      console.log('🔍 Checking auth through headers...');
      const hasAccess = await checkAuthAndRole(request, ['admin', 'ctv']);
      
      if (hasAccess) {
        console.log('✅ Access granted through auth header');
        
        // Kết nối đến MongoDB
        await connectDB();
        
        // Lấy tất cả khóa học
        const courses = await Course.find({}).sort({ createdAt: -1 }).lean();
        
        console.log(`✅ Lấy thành công ${courses.length} khóa học`);
        
        // Trả về thông tin khóa học
        return NextResponse.json({ courses });
      }
      
      console.log('⚠️ Admin/CTV API - Không có quyền truy cập, từ chối');
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
    console.log('🔒 Admin API - Kiểm tra quyền truy cập');
    
    // Kiểm tra quyền admin từ cookie
    const cookieStore = cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    // Kiểm tra quyền admin từ header 
    const headersList = headers();
    const userRole = headersList.get('x-user-role');
    
    // Cho phép truy cập nếu là admin
    if ((adminAccess && adminAccess.value === 'true') || userRole === 'admin') {
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
      // Thử check authorization header cho API
      const hasAccess = await checkAuthAndRole(request, 'admin');
      
      if (hasAccess) {
        // Kết nối đến MongoDB
        await connectDB();
        
        // Parse body request và xử lý giống như trên...
        // [code tương tự phần trên]
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