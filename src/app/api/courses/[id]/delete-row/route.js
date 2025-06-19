import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Course from '@/models/Course';

export async function DELETE(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const { sheetIndex, rowIndex } = await request.json();

    console.log('Xóa hàng:', { id, sheetIndex, rowIndex });

    // Tìm khóa học theo ID
    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy khóa học' }, { status: 404 });
    }

    // Kiểm tra dữ liệu gốc
    if (!course.originalData || !course.originalData.sheets || !course.originalData.sheets[sheetIndex]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy dữ liệu sheet' }, { status: 400 });
    }

    // Kiểm tra rowIndex có hợp lệ
    const rowData = course.originalData.sheets[sheetIndex].data[0]?.rowData;
    if (!rowData || rowIndex < 1 || rowIndex >= rowData.length) {
      return NextResponse.json({ 
        success: false, 
        message: 'Vị trí hàng không hợp lệ hoặc là hàng tiêu đề',
        currentLength: rowData ? rowData.length : 0
      }, { status: 400 });
    }

    // Không cho phép xóa hàng header (rowIndex = 0)
    if (rowIndex === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Không thể xóa hàng tiêu đề' 
      }, { status: 400 });
    }

    // Xóa hàng tại vị trí chỉ định
    course.originalData.sheets[sheetIndex].data[0].rowData.splice(rowIndex, 1);

    // Đánh dấu là đã sửa đổi để Mongoose cập nhật đúng
    course.markModified('originalData');
    
    // Lưu thay đổi vào database
    await course.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Xóa hàng thành công',
      newLength: course.originalData.sheets[sheetIndex].data[0].rowData.length
    });
  } catch (error) {
    console.error('Lỗi khi xóa hàng:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
} 