import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import Course from '@/models/Course';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';
import mongoose from 'mongoose';

// POST /api/courses/[id]/sheets - Liên kết sheet với khóa học
export async function POST(request, { params }) {
  try {
    const { id } = params;
    await dbMiddleware(request);
    const data = await request.json();
    
    // Kiểm tra dữ liệu đầu vào
    if (!data.sheetId) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ID của sheet' }, 
        { status: 400 }
      );
    }
    
    // Kiểm tra xem khóa học có tồn tại không
    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy khóa học' }, 
        { status: 404 }
      );
    }
    
    // Kiểm tra xem sheet có tồn tại không
    const sheet = await Sheet.findById(data.sheetId);
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet' }, 
        { status: 404 }
      );
    }
    
    // Kiểm tra xem sheet đã được liên kết với khóa học chưa
    if (!course.sheets) {
      course.sheets = [];
    }
    
    // Kiểm tra xem sheet đã được liên kết chưa
    const isLinked = course.sheets.some(sheetId => 
      sheetId.toString() === data.sheetId
    );
    
    if (isLinked) {
      return NextResponse.json(
        { success: false, error: 'Sheet này đã được liên kết với khóa học' }, 
        { status: 400 }
      );
    }
    
    // Thêm sheet vào danh sách sheets của khóa học
    course.sheets.push(data.sheetId);
    
    // Lưu thay đổi
    await course.save();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Đã liên kết sheet với khóa học thành công', 
      course: course 
    });
  } catch (error) {
    console.error('Lỗi khi liên kết sheet với khóa học:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể liên kết sheet với khóa học' }, 
      { status: 500 }
    );
  }
}

// GET /api/courses/[id]/sheets - Lấy danh sách sheets của khóa học
export async function GET(request, { params }) {
  try {
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    await dbMiddleware(request);
    
    // Tạo query dựa trên loại ID
    let query = {};
    
    // Kiểm tra xem id có phải là MongoDB ObjectId hợp lệ không
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      // Nếu không phải ObjectId, tìm theo kimvanId
      query = { kimvanId: id };
    }
    
    // Kiểm tra xem khóa học có tồn tại không
    const course = await Course.findOne(query).populate('sheets');
    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy khóa học' }, 
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      sheets: course.sheets || [] 
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sheets của khóa học:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể lấy danh sách sheets của khóa học' }, 
      { status: 500 }
    );
  }
} 