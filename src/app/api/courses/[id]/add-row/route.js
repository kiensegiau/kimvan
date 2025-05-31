import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Course from '@/models/Course';

export async function POST(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const { sheetIndex, rowData } = await request.json();

    console.log('Thêm hàng mới:', { id, sheetIndex });

    // Tìm khóa học theo ID
    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy khóa học' }, { status: 404 });
    }

    // Kiểm tra dữ liệu gốc
    if (!course.originalData || !course.originalData.sheets || !course.originalData.sheets[sheetIndex]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy dữ liệu sheet' }, { status: 400 });
    }

    // Tạo dữ liệu hàng mới
    const newRow = {
      values: rowData.map(item => ({
        formattedValue: item.formattedValue || '',
        // Thêm các thuộc tính khác nếu cần
        ...(item.userEnteredFormat && { userEnteredFormat: item.userEnteredFormat }),
        ...(item.hyperlink && { hyperlink: item.hyperlink })
      }))
    };

    // Thêm hàng mới vào cuối danh sách
    course.originalData.sheets[sheetIndex].data[0].rowData.push(newRow);

    // Đánh dấu là đã sửa đổi để Mongoose cập nhật đúng
    course.markModified('originalData');
    
    // Lưu thay đổi vào database
    await course.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Thêm hàng mới thành công',
    });
  } catch (error) {
    console.error('Lỗi khi thêm hàng mới:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
} 