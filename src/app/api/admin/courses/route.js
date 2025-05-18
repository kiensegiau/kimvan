import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { authMiddleware, checkAuthAndRole } from '@/lib/auth';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/mongodb';

// GET: Lấy tất cả khóa học cho admin (không mã hóa)
export async function GET(request) {
  try {
    // Kiểm tra quyền truy cập
    const adminAccess = await checkAuthAndRole(cookies(), 'admin');
    if (!adminAccess.success) {
      return NextResponse.json({
        error: 'Không có quyền truy cập'
      }, { status: 403 });
    }
    
    // Kết nối đến MongoDB
    await connectDB();
    
    // Lấy tất cả khóa học
    const courses = await Course.find({}).sort({ createdAt: -1 }).lean();
    
    // Trả về thông tin khóa học
    return NextResponse.json({ courses });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách khóa học:', error);
    return NextResponse.json({ error: 'Lỗi khi lấy danh sách khóa học' }, { status: 500 });
  }
}

// POST: Tạo khóa học mới cho admin
export async function POST(request) {
  try {
    // Kiểm tra quyền truy cập
    const adminAccess = await checkAuthAndRole(cookies(), 'admin');
    if (!adminAccess.success) {
      return NextResponse.json({
        error: 'Không có quyền truy cập'
      }, { status: 403 });
    }
    
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
  } catch (error) {
    console.error('Lỗi khi tạo khóa học mới:', error);
    return NextResponse.json({ error: 'Lỗi khi tạo khóa học mới' }, { status: 500 });
  }
} 