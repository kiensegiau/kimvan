import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { ObjectId } from 'mongodb';
import { checkAuthAndRole } from '@/lib/auth';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';
import { adminAuthMiddleware } from '@/app/api/admin/middleware';

// GET: Lấy một khóa học theo ID mà không mã hóa dữ liệu - CHỈ CHO ADMIN
export async function GET(request, { params }) {
  try {
    console.log('🔒 Raw API - Bắt đầu xử lý yêu cầu tới API không mã hóa');
    
    // Kiểm tra cookie admin_access trước
    const cookieStore = await cookies();
    const adminAccess = cookieStore.get('admin_access');
    
    if (adminAccess && adminAccess.value === 'true') {
      console.log('🔒 Raw API - Đã có cookie admin_access, cho phép truy cập');
      
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
      } else if (type === 'kimvanId') {
        course = await Course.findOne({ kimvanId: id }).lean().exec();
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
      console.log('✅ Raw API - Đã tìm thấy khóa học, trả về dữ liệu không mã hóa');
      return NextResponse.json({
        success: true,
        data: course
      });
    }
    
    // Nếu không có cookie admin_access, thử xác thực Firebase token
    console.log('🔒 Raw API - Gọi middleware xác thực admin');
    const adminRequest = await adminAuthMiddleware(request);
    
    // Kiểm tra kết quả từ middleware
    if (adminRequest instanceof NextResponse) {
      console.log('❌ Raw API - Xác thực admin thất bại, từ chối truy cập');
      // Ghi log response để debug
      const responseClone = adminRequest.clone();
      const responseBody = await responseClone.json();
      console.log('❌ Raw API - Chi tiết lỗi:', JSON.stringify(responseBody));
      
      // Nếu trả về NextResponse, nghĩa là có lỗi xác thực
      return adminRequest;
    }
    
    console.log('✅ Raw API - Xác thực admin thành công, tiếp tục xử lý');
    
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
    } else if (type === 'kimvanId') {
      course = await Course.findOne({ kimvanId: id }).lean().exec();
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
    console.log('✅ Raw API - Đã tìm thấy khóa học, trả về dữ liệu không mã hóa');
    return NextResponse.json({
      success: true,
      data: course
    });
  } catch (error) {
    console.error('❌ Raw API - Lỗi khi lấy thông tin khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Lỗi server',
      error: error.message 
    }, { status: 500 });
  }
} 