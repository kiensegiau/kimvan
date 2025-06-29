import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import Course from '@/models/Course';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';

// GET /api/sheets/[id]/courses - Lấy danh sách khóa học liên kết với sheet
export async function GET(request, { params }) {
  try {
    const { id } = params;
    await dbMiddleware(request);
    
    // Kiểm tra xem sheet có tồn tại không
    const sheet = await Sheet.findById(id);
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet' }, 
        { status: 404 }
      );
    }
    
    // Tìm tất cả các khóa học có chứa sheet này
    const courses = await Course.find({
      sheets: { $in: [new ObjectId(id)] }
    });
    
    return NextResponse.json({ 
      success: true, 
      courses: courses 
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách khóa học liên kết với sheet:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể lấy danh sách khóa học liên kết với sheet' }, 
      { status: 500 }
    );
  }
} 