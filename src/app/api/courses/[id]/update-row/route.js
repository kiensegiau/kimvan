import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongoose';
import Course from '@/models/Course';

export async function PUT(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const { sheetIndex, rowIndex, rowData } = await request.json();

    // Tìm khóa học trong database
    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy khóa học' }, { status: 404 });
    }

    // Kiểm tra dữ liệu sheet
    if (!course.originalData?.sheets || !course.originalData.sheets[sheetIndex]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy dữ liệu sheet' }, { status: 400 });
    }

    const sheet = course.originalData.sheets[sheetIndex];
    if (!sheet.data || !sheet.data[0] || !sheet.data[0].rowData || !sheet.data[0].rowData[rowIndex]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy dữ liệu hàng cần cập nhật' }, { status: 400 });
    }

    // Cập nhật dữ liệu hàng
    sheet.data[0].rowData[rowIndex].values = rowData;

    // Đánh dấu là đã sửa đổi để mongoose lưu thay đổi
    course.markModified('originalData');
    
    // Lưu lại vào database
    await course.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Cập nhật hàng thành công' 
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật hàng:', error);
    return NextResponse.json({ 
      success: false, 
      message: `Lỗi khi cập nhật hàng: ${error.message}` 
    }, { status: 500 });
  }
} 