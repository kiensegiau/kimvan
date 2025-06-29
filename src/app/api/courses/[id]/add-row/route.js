import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import Course from '@/models/Course';

export async function POST(request, { params }) {
  try {
    await dbMiddleware(request);
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

    // Thêm hàng mới vào vị trí được chỉ định
    const sheet = course.originalData.sheets[sheetIndex];
    if (!sheet.data || !sheet.data[0] || !sheet.data[0].rowData) {
      sheet.data = [{ rowData: [] }];
    }

    // Tạo object hàng mới với định dạng đúng
    const newRow = {
      values: rowData
    };

    // Chèn hàng mới vào vị trí rowIndex
    sheet.data[0].rowData.splice(rowIndex, 0, newRow);

    // Cập nhật STT cho các hàng sau vị trí chèn nếu cần
    // Tìm header row để xác định cột STT
    const headerRow = sheet.data[0].rowData[0];
    if (headerRow && headerRow.values) {
      const sttColumnIndex = headerRow.values.findIndex(cell => {
        const headerText = (cell.formattedValue || '').toLowerCase();
        return headerText.includes('stt') || headerText.includes('số thứ tự') || headerText === '#';
      });

      // Nếu tìm thấy cột STT, cập nhật STT cho các hàng phía sau
      if (sttColumnIndex !== -1) {
        for (let i = rowIndex + 1; i < sheet.data[0].rowData.length; i++) {
          const row = sheet.data[0].rowData[i];
          if (row && row.values && row.values[sttColumnIndex]) {
            const currentStt = row.values[sttColumnIndex].formattedValue;
            // Chỉ cập nhật nếu STT là số
            if (currentStt && !isNaN(parseInt(currentStt))) {
              const newStt = (i).toString();
              row.values[sttColumnIndex].formattedValue = newStt;
            }
          }
        }
      }
    }

    // Đánh dấu là đã sửa đổi để mongoose lưu thay đổi
    course.markModified('originalData');
    
    // Lưu lại vào database
    await course.save();

    return NextResponse.json({ 
      success: true, 
      message: 'Thêm hàng thành công' 
    });
  } catch (error) {
    console.error('Lỗi khi thêm hàng:', error);
    return NextResponse.json({ 
      success: false, 
      message: `Lỗi khi thêm hàng: ${error.message}` 
    }, { status: 500 });
  }
} 