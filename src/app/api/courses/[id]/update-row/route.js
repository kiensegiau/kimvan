import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Course from '@/models/Course';

export async function PUT(request, { params }) {
  try {
    await connectDB();
    const { id } = params;
    const { sheetIndex, rowIndex, rowData } = await request.json();

    console.log('Cập nhật hàng:', { id, sheetIndex, rowIndex });

    // Tìm khóa học theo ID
    const course = await Course.findById(id);
    if (!course) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy khóa học' }, { status: 404 });
    }

    // Kiểm tra dữ liệu gốc
    if (!course.originalData || !course.originalData.sheets || !course.originalData.sheets[sheetIndex]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy dữ liệu sheet' }, { status: 400 });
    }

    // Cập nhật dữ liệu hàng
    if (!course.originalData.sheets[sheetIndex].data[0].rowData[rowIndex]) {
      return NextResponse.json({ success: false, message: 'Không tìm thấy hàng cần cập nhật' }, { status: 400 });
    }

    // Cập nhật giá trị cho các ô trong hàng
    course.originalData.sheets[sheetIndex].data[0].rowData[rowIndex].values = rowData.map(item => ({
      formattedValue: item.formattedValue || '',
      // Giữ lại các thuộc tính khác nếu có
      ...(item.userEnteredFormat && { userEnteredFormat: item.userEnteredFormat }),
      ...(item.hyperlink && { hyperlink: item.hyperlink })
    }));

    // Đánh dấu là đã sửa đổi để Mongoose cập nhật đúng
    course.markModified('originalData');
    
    // Lưu thay đổi vào database
    await course.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Cập nhật hàng thành công',
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật hàng:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
} 