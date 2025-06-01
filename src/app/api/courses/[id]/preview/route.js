import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import Course from '@/models/Course';
import { connectDB } from '@/lib/mongodb';
import path from 'path';
import fs from 'fs';

// GET: Lấy preview thay đổi trước khi đồng bộ
export async function GET(request, { params }) {
  try {
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Kiểm tra xem khóa học có tồn tại không
    const existingCourse = await Course.findOne({ kimvanId: id }).lean().exec();
    if (!existingCourse) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Không tìm thấy khóa học để đồng bộ' 
        },
        { status: 404 }
      );
    }

    // Lấy token KimVan từ file
    const tokenPath = path.join(process.cwd(), 'kimvan_token.json');
    let kimvanToken = null;
    try {
      if (fs.existsSync(tokenPath)) {
        const tokenContent = fs.readFileSync(tokenPath, 'utf8');
        kimvanToken = JSON.parse(tokenContent);
      }
    } catch (error) {
      console.error('Lỗi khi đọc token KimVan:', error);
    }
    
    // Chuẩn bị headers cho request
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
    };
    
    // Thêm header xác thực nếu có token
    if (kimvanToken) {
      if (kimvanToken.token_type === 'jwt') {
        headers['Authorization'] = `Bearer ${kimvanToken.value}`;
      } else if (kimvanToken.cookie_string) {
        headers['Cookie'] = kimvanToken.cookie_string;
      }
    }

    // Gọi API để lấy dữ liệu mới từ Kimvan
    const kimvanUrl = new URL(request.url);
    const origin = kimvanUrl.origin;
    const kimvanApiUrl = `${origin}/api/spreadsheets/${id}`;
    
    const kimvanResponse = await fetch(kimvanApiUrl, {
      headers: headers
    });
    
    if (!kimvanResponse.ok) {
      if (kimvanResponse.status === 401 || kimvanResponse.status === 403) {
        return NextResponse.json(
          { 
            success: false,
            message: 'Lỗi xác thực với Kimvan API. Vui lòng đăng nhập lại.',
            error: `Unauthorized: ${kimvanResponse.status}` 
          },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false,
          message: 'Không thể lấy dữ liệu từ Kimvan API',
          error: `Lỗi: ${kimvanResponse.status}` 
        },
        { status: 500 }
      );
    }

    const kimvanData = await kimvanResponse.json();
    
    // Phân tích dữ liệu để tạo preview
    let previewData = {
      currentData: {
        rowCount: 0,
        headers: [],
        sampleRows: []
      },
      newData: {
        rowCount: 0,
        headers: [],
        sampleRows: []
      },
      changes: {
        added: [],
        updated: [],
        unchanged: []
      }
    };

    // Phân tích dữ liệu hiện tại
    if (existingCourse.originalData?.sheets?.[0]?.data?.[0]?.rowData) {
      const currentRowData = existingCourse.originalData.sheets[0].data[0].rowData;
      if (currentRowData.length >= 2) {
        const headerRow = currentRowData[1];
        previewData.currentData.headers = headerRow.values?.map(cell => cell.formattedValue) || [];
        previewData.currentData.rowCount = currentRowData.length - 2; // Trừ hàng trống và header
        previewData.currentData.sampleRows = currentRowData.slice(2, 5); // Lấy 3 hàng đầu làm mẫu
      }
    }

    // Phân tích dữ liệu mới
    if (kimvanData?.sheets?.[0]?.data?.[0]?.rowData) {
      const newRowData = kimvanData.sheets[0].data[0].rowData;
      if (newRowData.length >= 2) {
        const headerRow = newRowData[1];
        previewData.newData.headers = headerRow.values?.map(cell => cell.formattedValue) || [];
        previewData.newData.rowCount = newRowData.length - 2;
        previewData.newData.sampleRows = newRowData.slice(2, 5);

        // Phân tích các thay đổi
        const currentRows = new Set(
          existingCourse.originalData?.sheets?.[0]?.data?.[0]?.rowData
            ?.slice(2)
            ?.map(row => JSON.stringify(row.values?.map(cell => cell.formattedValue))) || []
        );

        newRowData.slice(2).forEach((row, index) => {
          const rowString = JSON.stringify(row.values?.map(cell => cell.formattedValue));
          if (currentRows.has(rowString)) {
            previewData.changes.unchanged.push(index);
          } else {
            if (index < currentRows.size) {
              previewData.changes.updated.push(index);
            } else {
              previewData.changes.added.push(index);
            }
          }
        });
      }
    }

    return NextResponse.json({
      success: true,
      preview: previewData,
      message: 'Lấy preview thành công'
    });

  } catch (error) {
    console.error('Lỗi khi lấy preview đồng bộ:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Đã xảy ra lỗi khi lấy preview đồng bộ',
        error: error.message 
      },
      { status: 500 }
    );
  }
} 