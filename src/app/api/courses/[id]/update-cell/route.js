import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Course from '@/models/Course';

export async function PUT(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const { sheetIndex, rowIndex, cellIndex, cellData } = await request.json();

    console.log('Cập nhật ô:', { id, sheetIndex, rowIndex, cellIndex });

    // Tìm khóa học theo ID
    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy khóa học' }, { status: 404 });
    }

    // Kiểm tra dữ liệu gốc
    if (!course.originalData || !course.originalData.sheets || !course.originalData.sheets[sheetIndex]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy dữ liệu sheet' }, { status: 400 });
    }

    // Kiểm tra tồn tại của hàng
    if (!course.originalData.sheets[sheetIndex].data[0].rowData[rowIndex]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy hàng cần cập nhật' }, { status: 400 });
    }

    // Kiểm tra tồn tại của mảng values trong hàng
    if (!course.originalData.sheets[sheetIndex].data[0].rowData[rowIndex].values) {
      course.originalData.sheets[sheetIndex].data[0].rowData[rowIndex].values = [];
    }

    // Đảm bảo có đủ các ô trong hàng
    while (course.originalData.sheets[sheetIndex].data[0].rowData[rowIndex].values.length <= cellIndex) {
      course.originalData.sheets[sheetIndex].data[0].rowData[rowIndex].values.push({ formattedValue: '' });
    }

    // Cập nhật giá trị cho ô
    course.originalData.sheets[sheetIndex].data[0].rowData[rowIndex].values[cellIndex] = {
      formattedValue: cellData.formattedValue || '',
      // Giữ lại các thuộc tính khác nếu có
      ...(cellData.userEnteredFormat && { userEnteredFormat: cellData.userEnteredFormat }),
      ...(cellData.hyperlink && { hyperlink: cellData.hyperlink })
    };

    // Đánh dấu là đã sửa đổi để Mongoose cập nhật đúng
    course.markModified('originalData');
    
    // Lưu thay đổi vào database
    await course.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Cập nhật ô thành công',
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật ô:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
} 