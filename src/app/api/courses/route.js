import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import CryptoJS from 'crypto-js';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import Enrollment from '@/models/Enrollment';
import { authMiddleware } from '@/lib/auth';
import { dbMiddleware } from '@/utils/db-middleware';

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
    await dbMiddleware(request);
    
    // Lấy danh sách courses từ database
    const courses = await Course.find().sort({ createdAt: -1 });
    
    return NextResponse.json({ success: true, courses });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách khóa học:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể lấy danh sách khóa học' }, 
      { status: 500 }
    );
  }
}

// POST: Tạo khóa học mới
export async function POST(request) {
  try {
    await dbMiddleware(request);
    const data = await request.json();
    
    // Kiểm tra dữ liệu đầu vào
    if (!data.name) {
      return NextResponse.json(
        { success: false, error: 'Thiếu thông tin bắt buộc (tên khóa học)' }, 
        { status: 400 }
      );
    }
    
    // Tạo khóa học mới
    const newCourse = new Course({
      name: data.name,
      description: data.description || '',
      price: data.price || 0,
      originalPrice: data.originalPrice || 0,
      status: data.status || 'active',
      kimvanId: data.kimvanId || null,
      sheets: data.sheets || []
    });
    
    await newCourse.save();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Đã tạo khóa học thành công', 
      course: newCourse 
    }, { status: 201 });
  } catch (error) {
    console.error('Lỗi khi tạo khóa học mới:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tạo khóa học mới' }, 
      { status: 500 }
    );
  }
} 