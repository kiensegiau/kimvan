import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Enrollment from '@/models/Enrollment';
import { authMiddleware } from '@/lib/auth';
import mongoose from 'mongoose';

// GET: Lấy thông tin chi tiết của một đăng ký khóa học
export async function GET(request, { params }) {
  try {
    // Kiểm tra xác thực người dùng
    const user = await authMiddleware(request);
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bạn cần đăng nhập để xem thông tin đăng ký khóa học' 
      }, { status: 401 });
    }
    
    const { id } = params;
    
    // Kiểm tra ID đăng ký
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID đăng ký không hợp lệ' 
      }, { status: 400 });
    }
    
    // Kết nối đến MongoDB
    await connectDB();
    
    // Tìm đăng ký và populate thông tin khóa học
    const enrollment = await Enrollment.findById(id)
      .populate('courseId')
      .lean()
      .exec();
    
    // Kiểm tra đăng ký tồn tại
    if (!enrollment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không tìm thấy đăng ký khóa học' 
      }, { status: 404 });
    }
    
    // Kiểm tra quyền (chỉ người dùng đã đăng ký mới có thể xem)
    if (enrollment.userId !== user.uid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bạn không có quyền xem thông tin đăng ký này' 
      }, { status: 403 });
    }
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      data: {
        id: enrollment._id,
        courseId: enrollment.courseId._id,
        courseName: enrollment.courseId.name,
        courseDescription: enrollment.courseId.description,
        courseImage: enrollment.courseId.image,
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt,
        progress: enrollment.progress,
        completedLessons: enrollment.completedLessons,
        totalTimeSpent: enrollment.totalTimeSpent,
        status: enrollment.status,
        notes: enrollment.notes
      }
    });
  } catch (error) {
    console.error('Lỗi khi lấy thông tin đăng ký khóa học:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi lấy thông tin đăng ký khóa học' 
    }, { status: 500 });
  }
}

// PATCH: Cập nhật thông tin đăng ký khóa học
export async function PATCH(request, { params }) {
  try {
    // Kiểm tra xác thực người dùng
    const user = await authMiddleware(request);
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bạn cần đăng nhập để cập nhật thông tin đăng ký khóa học' 
      }, { status: 401 });
    }
    
    const { id } = params;
    
    // Kiểm tra ID đăng ký
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ 
        success: false, 
        error: 'ID đăng ký không hợp lệ' 
      }, { status: 400 });
    }
    
    // Lấy dữ liệu từ request
    const body = await request.json();
    const { progress, completedLessons, totalTimeSpent, notes } = body;
    
    // Kết nối đến MongoDB
    await connectDB();
    
    // Tìm đăng ký
    const enrollment = await Enrollment.findById(id).exec();
    
    // Kiểm tra đăng ký tồn tại
    if (!enrollment) {
      return NextResponse.json({ 
        success: false, 
        error: 'Không tìm thấy đăng ký khóa học' 
      }, { status: 404 });
    }
    
    // Kiểm tra quyền (chỉ người dùng đã đăng ký mới có thể cập nhật)
    if (enrollment.userId !== user.uid) {
      return NextResponse.json({ 
        success: false, 
        error: 'Bạn không có quyền cập nhật thông tin đăng ký này' 
      }, { status: 403 });
    }
    
    // Cập nhật thông tin
    const updateData = {
      lastAccessedAt: new Date()
    };
    
    if (progress !== undefined) {
      updateData.progress = Math.min(Math.max(progress, 0), 100);
    }
    
    if (completedLessons !== undefined) {
      updateData.completedLessons = completedLessons;
    }
    
    if (totalTimeSpent !== undefined) {
      updateData.totalTimeSpent = totalTimeSpent;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    // Cập nhật trạng thái nếu tiến độ đạt 100%
    if (updateData.progress === 100) {
      updateData.status = 'completed';
    }
    
    // Lưu thay đổi vào database
    const updatedEnrollment = await Enrollment.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean().exec();
    
    // Trả về kết quả
    return NextResponse.json({
      success: true,
      message: 'Cập nhật thông tin đăng ký khóa học thành công',
      data: {
        id: updatedEnrollment._id,
        progress: updatedEnrollment.progress,
        completedLessons: updatedEnrollment.completedLessons,
        totalTimeSpent: updatedEnrollment.totalTimeSpent,
        status: updatedEnrollment.status,
        lastAccessedAt: updatedEnrollment.lastAccessedAt
      }
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật thông tin đăng ký khóa học:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Lỗi khi cập nhật thông tin đăng ký khóa học' 
    }, { status: 500 });
  }
} 