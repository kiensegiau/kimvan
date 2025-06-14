import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Course from '@/models/Course';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';

// DELETE /api/courses/[id]/sheets/[sheetId] - Hủy liên kết sheet với khóa học
export async function DELETE(request, { params }) {
  try {
    const { id, sheetId } = params;
    await connectDB();
    
    // Kiểm tra xem khóa học có tồn tại không
    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy khóa học' }, 
        { status: 404 }
      );
    }
    
    // Kiểm tra xem sheet có tồn tại không
    const sheet = await Sheet.findById(sheetId);
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet' }, 
        { status: 404 }
      );
    }
    
    // Kiểm tra xem sheet có được liên kết với khóa học không
    if (!course.sheets || course.sheets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Khóa học này không có sheet nào được liên kết' }, 
        { status: 404 }
      );
    }
    
    // Tìm vị trí của sheet trong danh sách
    const sheetIndex = course.sheets.findIndex(
      id => id.toString() === sheetId
    );
    
    if (sheetIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Sheet này không được liên kết với khóa học' }, 
        { status: 404 }
      );
    }
    
    // Xóa sheet khỏi danh sách
    course.sheets.splice(sheetIndex, 1);
    
    // Lưu thay đổi
    await course.save();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Đã hủy liên kết sheet với khóa học thành công',
      course: course
    });
  } catch (error) {
    console.error('Lỗi khi hủy liên kết sheet với khóa học:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể hủy liên kết sheet với khóa học' }, 
      { status: 500 }
    );
  }
} 