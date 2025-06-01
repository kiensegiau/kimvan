import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import CryptoJS from 'crypto-js';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { connectDB } from '@/lib/mongodb';
import Enrollment from '@/models/Enrollment';
import { authMiddleware } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

// Khóa mã hóa - phải giống với khóa ở phía client
const ENCRYPTION_KEY = 'kimvan-secure-key-2024';

// Hàm mã hóa dữ liệu với xử lý lỗi tốt hơn
const encryptData = (data) => {
  try {
    if (!data) {
      throw new Error("Không có dữ liệu để mã hóa");
    }
    
    const jsonString = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Lỗi mã hóa:", error);
    throw new Error(`Không thể mã hóa dữ liệu: ${error.message}`);
  }
};

// Hàm mã hóa toàn bộ đối tượng
const encryptEntireObject = (obj) => {
  try {
    const jsonString = JSON.stringify(obj);
    return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error("Lỗi mã hóa toàn bộ đối tượng:", error);
    throw new Error(`Không thể mã hóa: ${error.message}`);
  }
};

// GET: Lấy một khóa học theo ID
export async function GET(request, { params }) {
  try {
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Kiểm tra xem có tham số type=_id không
    const { searchParams } = new URL(request.url);
    const queryType = searchParams.get('type');
    const secure = searchParams.get('secure') === 'true';
    const responseType = queryType || 'full';
    const requireEnrollment = searchParams.get('requireEnrollment') !== 'false'; // Mặc định yêu cầu đăng ký
    const checkViewPermission = searchParams.get('checkViewPermission') === 'true'; // Kiểm tra quyền xem
    
    let query = {};
    
    // Truy vấn theo loại ID - ưu tiên kimvanId trước
    if (queryType === '_id') {
      // Truy vấn theo MongoDB _id 
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ 
          success: false,
          message: 'ID khóa học không hợp lệ' 
        }, { status: 400 });
      }
      query = { _id: new ObjectId(id) };
    } else {
      // Truy vấn theo kimvanId
      query = { kimvanId: id };
      
      // Nếu không tìm thấy bằng kimvanId, thử tìm bằng _id
      const courseByKimvanId = await Course.findOne(query).lean().exec();
      if (!courseByKimvanId && mongoose.Types.ObjectId.isValid(id)) {
        query = { _id: new ObjectId(id) };
      }
    }
    
    // Tìm khóa học theo query đã xác định
    const course = await Course.findOne(query).lean().exec();
    
    if (!course) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học' 
      }, { status: 404 });
    }
    
    // Kiểm tra xác thực người dùng (không bắt buộc)
    let user = null;
    let isEnrolled = false;
    let canViewAllCourses = false; // Biến mới để kiểm tra quyền xem tất cả khóa học
    
    try {
      user = await authMiddleware(request);
      
      if (user) {
        // Kiểm tra xem người dùng đã đăng ký khóa học này chưa
        const enrollment = await Enrollment.findOne({
          userId: user.uid,
          courseId: course._id.toString()
        }).lean().exec();
        
        isEnrolled = !!enrollment;
        
        // Kiểm tra quyền xem tất cả khóa học từ MongoDB
        if (checkViewPermission) {
          try {
            const client = await clientPromise;
            const db = client.db(process.env.MONGODB_DB || 'kimvan');
            const userDetails = await db.collection('users').findOne({ firebaseId: user.uid });
            
            // Sử dụng trường canViewAllCourses từ MongoDB
            canViewAllCourses = !!(userDetails && userDetails.canViewAllCourses);
          } catch (dbError) {
            console.log('Lỗi khi kiểm tra quyền từ MongoDB:', dbError.message);
          }
        } else {
          console.log('DEBUG API - Không kiểm tra quyền xem tất cả khóa học (checkViewPermission=false)');
        }
      }
    } catch (authError) {
      console.log('Không có thông tin xác thực người dùng:', authError.message);
      // Không trả về lỗi, chỉ tiếp tục với thông tin khóa học
    }
    
    // Tạo dữ liệu trả về
    const responseData = {
      _id: course._id,
      name: course.name,
      description: course.description,
      price: course.price,
      originalPrice: course.originalPrice,
      status: course.status,
      kimvanId: course.kimvanId,
      spreadsheetId: course.spreadsheetId,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      processedDriveFiles: course.processedDriveFiles || [],
      isEnrolled: isEnrolled,
      canViewAllCourses: canViewAllCourses // Thêm trường này để client biết người dùng có quyền xem tất cả khóa học không
    };
    
    // Thêm dữ liệu gốc nếu:
    // 1. Yêu cầu dữ liệu đầy đủ VÀ
    // 2. (Không yêu cầu đăng ký HOẶC người dùng đã đăng ký HOẶC người dùng có quyền xem tất cả khóa học)
    if ((responseType === 'full' || responseType === 'auto') && 
        (!requireEnrollment || isEnrolled || canViewAllCourses)) {
      responseData.originalData = course.originalData;
    } else if (requireEnrollment && !isEnrolled && !canViewAllCourses && 
               (responseType === 'full' || responseType === 'auto')) {
      // Nếu yêu cầu đăng ký nhưng người dùng chưa đăng ký và không có quyền xem tất cả khóa học
      responseData.requiresEnrollment = true;
    }
    
    // Mã hóa dữ liệu nếu yêu cầu
    if (secure) {
      try {
        const encryptedData = encryptData(responseData);
        return NextResponse.json({ _secureData: encryptedData });
      } catch (encryptError) {
        console.error("Lỗi khi mã hóa dữ liệu:", encryptError);
        return NextResponse.json({ 
          error: 'Lỗi khi xử lý dữ liệu khóa học',
          message: encryptError.message 
        }, { status: 500 });
      }
    }
    
    // Trả về dữ liệu không mã hóa
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Lỗi khi lấy thông tin khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi lấy thông tin khóa học',
      error: error.message 
    }, { status: 500 });
  }
}

// PUT: Cập nhật một khóa học
export async function PUT(request, { params }) {
  try {
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }
    
    // Kiểm tra xem có tham số type=_id không
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    let query = {};
    
    // Truy vấn theo loại ID - ưu tiên kimvanId trước
    if (type === '_id') {
      // Truy vấn theo MongoDB _id 
      try {
        query = { _id: new ObjectId(id) };
      } catch (err) {
        return NextResponse.json(
          { message: 'ID không hợp lệ' },
          { status: 400 }
        );
      }
    } else {
      // Truy vấn theo kimvanId
      query = { kimvanId: id };
      
      // Nếu không tìm thấy bằng kimvanId, thử tìm bằng _id
      const course = await Course.findOne(query).lean().exec();
      if (!course) {
        try {
          if (mongoose.Types.ObjectId.isValid(id)) {
            query = { _id: new ObjectId(id) };
          }
        } catch (err) {
          // Nếu không phải ObjectId hợp lệ, giữ nguyên query kimvanId
        }
      }
    }
    
    const course = await Course.findOne(query).lean().exec();
    if (!course) {
      return NextResponse.json(
        { message: 'Không tìm thấy khóa học' },
        { status: 404 }
      );
    }
    
    const data = await request.json();
    
    // Loại bỏ trường _id để tránh lỗi khi cập nhật
    delete data._id;
    
    // Giữ nguyên dữ liệu gốc
    data.originalData = course.originalData;
    
    const result = await Course.updateOne(
      query,
      { $set: data }
    );
    
    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { message: 'Không có thay đổi nào được cập nhật' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ 
      message: 'Cập nhật khóa học thành công',
      success: true
    });
  } catch (error) {
    console.error('Lỗi khi cập nhật khóa học:', error);
    return NextResponse.json(
      { 
        message: 'Lỗi khi cập nhật khóa học',
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// DELETE: Xóa một khóa học
export async function DELETE(request, { params }) {
  try {
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Kiểm tra xem có tham số type=_id không
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    let query = {};
    let result;
    
    // Truy vấn theo loại ID
    if (type === '_id') {
      // Xóa theo MongoDB _id
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ 
          success: false,
          message: 'ID không hợp lệ' 
        }, { status: 400 });
      }
      result = await Course.deleteOne({ _id: new ObjectId(id) });
    } else {
      // Thử xóa theo kimvanId trước
      result = await Course.deleteOne({ kimvanId: id });
      
      // Nếu không tìm thấy bằng kimvanId, thử xóa bằng _id
      if (result.deletedCount === 0 && mongoose.Types.ObjectId.isValid(id)) {
        result = await Course.deleteOne({ _id: new ObjectId(id) });
      }
    }
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học' 
      }, { status: 404 });
    }
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Khóa học đã được xóa thành công' 
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error('Lỗi khi xóa khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi xóa khóa học. Vui lòng kiểm tra kết nối MongoDB.',
      error: error.message
    }, { status: 500 });
  }
}

// PATCH: Đồng bộ một khóa học từ Kimvan
export async function PATCH(request, { params }) {
  try {
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }
    
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
    
    // Gọi API để lấy dữ liệu mới từ Kimvan - sử dụng API đúng
    console.log(`Đang gọi API kimvan với ID: ${id}`);
    const kimvanUrl = new URL(request.url);
    const origin = kimvanUrl.origin;
    const kimvanApiUrl = `${origin}/api/spreadsheets/${id}`;
    console.log(`URL đích: ${kimvanApiUrl}`);
    
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
    
    const kimvanResponse = await fetch(kimvanApiUrl, {
      headers: headers
    });
    
    if (!kimvanResponse.ok) {
      // Kiểm tra nếu là lỗi xác thực
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
    
    console.log('Đã nhận dữ liệu từ kimvan API thành công!');
    const kimvanData = await kimvanResponse.json();
    
    // Xử lý dữ liệu dựa vào cấu trúc thực tế từ API
    let courseName = '';
    let sheetData = null;
    
    // Chuyển đổi dữ liệu Google Sheet thành mảng các hàng
    if (kimvanData && kimvanData.sheets && kimvanData.sheets.length > 0) {
      const firstSheet = kimvanData.sheets[0];
      courseName = firstSheet.properties?.title || '';
      
      if (firstSheet.data?.[0]?.rowData) {
        // Bỏ qua hàng đầu tiên trống ({}) và lấy header từ hàng thứ hai
        const rowData = firstSheet.data[0].rowData;
        if (rowData.length >= 2) {
          // Lấy header từ hàng thứ hai (index 1)
          const headerRow = rowData[1];
          
          // Chuyển đổi các hàng dữ liệu từ hàng thứ 3 trở đi (index 2+)
          sheetData = rowData.slice(2).map(row => {
            if (!row.values) return null;
            
            const rowObj = {};
            row.values.forEach((cell, colIndex) => {
              // Lấy tên cột từ header
              if (headerRow.values?.[colIndex]) {
                const columnName = headerRow.values[colIndex].formattedValue || `column${colIndex}`;
                
                rowObj[columnName] = {
                  value: cell.formattedValue || '',
                  hyperlink: cell.hyperlink || '',
                  format: cell.userEnteredFormat || {}
                };

                // Nếu có link trong textFormat, thêm vào
                if (cell.userEnteredFormat?.textFormat?.link?.uri) {
                  rowObj[columnName].hyperlink = cell.userEnteredFormat.textFormat.link.uri;
                }
              }
            });
            return rowObj;
          }).filter(row => row !== null);
          
          console.log('Đã chuyển đổi dữ liệu sheet thành công');
          console.log('Số hàng sau khi chuyển đổi:', sheetData.length);

          // Tạo cấu trúc dữ liệu mới giống với cấu trúc gốc
          const newSheetData = {
            sheets: [
              {
                properties: {
                  title: courseName || (existingCourse.sheets?.[0]?.properties?.title || '')
                },
                data: [
                  {
                    rowData: [
                      {}, // Giữ lại hàng trống đầu tiên
                      headerRow, // Giữ nguyên header row với format
                      ...sheetData.map(row => ({
                        values: Object.entries(row).map(([key, data]) => ({
                          formattedValue: data.value || '',
                          hyperlink: data.hyperlink || '',
                          userEnteredFormat: data.format || {}
                        }))
                      }))
                    ]
                  }
                ]
              }
            ]
          };

          // Tạo document mới với dữ liệu đã được hợp nhất
          const newCourseData = {
            _id: existingCourse._id,
            kimvanId: existingCourse.kimvanId,
            name: courseName || existingCourse.name,
            description: courseName 
              ? `Khóa học ${courseName}` 
              : existingCourse.description,
            price: existingCourse.price || 500000, 
            status: existingCourse.status || 'active',
            createdAt: existingCourse.createdAt || new Date(),
            updatedAt: new Date(),
            originalData: newSheetData
          };

          // Cập nhật document với dữ liệu đã được hợp nhất
          const result = await Course.findOneAndUpdate(
            { kimvanId: id },
            { $set: newCourseData },
            { new: true }
          );

          return NextResponse.json({
            success: true,
            message: 'Đồng bộ khóa học thành công - Dữ liệu đã được làm mới hoàn toàn',
            updatedFields: Object.keys(newCourseData)
          });
        } else {
          return NextResponse.json({
            success: false,
            message: 'Dữ liệu sheet không hợp lệ: Không có đủ hàng header'
          }, { status: 400 });
        }
      } else {
        return NextResponse.json({
          success: false,
          message: 'Không thể đọc dữ liệu từ sheet. Cấu trúc dữ liệu không hợp lệ.'
        }, { status: 400 });
      }
    }
    
    console.log('Tên khóa học được xác định:', courseName);
    
    // Hàm xóa URL giả từ Google Drive chỉ cho dữ liệu mới
    const cleanGoogleDriveUrls = (cell) => {
      const newCell = {...cell};
      if (newCell.userEnteredFormat?.textFormat?.link?.uri?.includes('drive.google.com')) {
        delete newCell.userEnteredFormat.textFormat.link;
      }
      return newCell;
    };

    // Hàm tìm cell tương ứng từ dữ liệu cũ dựa trên formattedValue
    const findMatchingCell = (formattedValue, oldData) => {
      if (!oldData || !Array.isArray(oldData)) return null;
      
      for (const row of oldData) {
        if (!row.values) continue;
        for (const cell of row.values) {
          if (cell.formattedValue === formattedValue) {
            return cell;
          }
        }
      }
      return null;
    };

    // Lấy dữ liệu cũ
    const existingData = existingCourse.originalData || {};
    
    // Kiểm tra cấu trúc dữ liệu cũ
    console.log('Cấu trúc dữ liệu cũ:', {
      isArray: Array.isArray(existingData),
      type: typeof existingData,
      hasSheets: existingData.sheets ? 'yes' : 'no'
    });

    // Lấy dữ liệu sheet cũ (nếu có) - giữ nguyên không xóa URL
    let existingRowData = [];
    if (existingData.sheets?.[0]?.data?.[0]?.rowData) {
      existingRowData = existingData.sheets[0].data[0].rowData;
      console.log('Số hàng trong dữ liệu cũ:', existingRowData.length);
    }
    
    console.log('Số hàng trong dữ liệu mới:', sheetData.length);

    // Tạo Map để lưu trữ các hàng duy nhất và Map để lưu trữ dữ liệu cũ
    const uniqueRows = new Map();
    const oldDataMap = new Map(); // Map để lưu trữ dữ liệu cũ theo formattedValue
    let updatedCount = 0;
    let newCount = 0;

    // Thêm dữ liệu cũ vào Map
    existingRowData.forEach((row, index) => {
      if (!row.values || index === 0) return; // Bỏ qua hàng header
      const rowKey = JSON.stringify(row.values.map(cell => cell.formattedValue));
      uniqueRows.set(rowKey, row);
      
      // Lưu từng cell vào oldDataMap để dễ tìm kiếm
      row.values.forEach(cell => {
        if (cell.formattedValue) {
          oldDataMap.set(cell.formattedValue, cell);
        }
      });
    });

    console.log('Số hàng unique từ dữ liệu cũ:', uniqueRows.size);

    // Chuyển đổi và thêm dữ liệu mới
    const newRowData = sheetData.map(row => {
      const values = Object.entries(row).map(([key, data]) => {
        // Tìm cell tương ứng từ dữ liệu cũ
        const oldCell = findMatchingCell(data.value, existingRowData);
        
        // Tạo cell mới
        const newCell = {
          formattedValue: data.value || '',
          userEnteredFormat: {...data.format}
        };

        // Nếu có cell cũ và có hyperlink hoặc link trong textFormat, sử dụng từ dữ liệu cũ
        if (oldCell) {
          if (oldCell.hyperlink) {
            newCell.hyperlink = oldCell.hyperlink;
          }
          
          if (oldCell.userEnteredFormat?.textFormat?.link) {
            newCell.userEnteredFormat = {
              ...newCell.userEnteredFormat,
              textFormat: {
                ...newCell.userEnteredFormat?.textFormat,
                link: oldCell.userEnteredFormat.textFormat.link
              }
            };
          }
        }

        return newCell;
      });
      
      const rowKey = JSON.stringify(values.map(cell => cell.formattedValue));
      
      if (uniqueRows.has(rowKey)) {
        updatedCount++;
        // Sử dụng dữ liệu cũ nếu có
        return uniqueRows.get(rowKey);
      } else {
        newCount++;
        const newRow = { values };
        uniqueRows.set(rowKey, newRow);
        return newRow;
      }
    });

    // Tạo dữ liệu sheet mới với header từ dữ liệu cũ nếu có
    const headerRow = existingRowData[0] || (() => {
      // Nếu không có header cũ, tạo header mới và xóa URL giả
      const newHeader = newRowData[0];
      if (newHeader?.values) {
        newHeader.values = newHeader.values.map(cleanGoogleDriveUrls);
      }
      return newHeader;
    })();
    
    const mergedRowData = [headerRow, ...Array.from(uniqueRows.values())];

    console.log('Thống kê sau khi hợp nhất:');
    console.log('- Số hàng được cập nhật:', updatedCount);
    console.log('- Số hàng mới được thêm:', newCount);
    console.log('- Tổng số hàng sau khi hợp nhất:', mergedRowData.length);

    // Tạo cấu trúc dữ liệu mới giống với cấu trúc gốc
    const newSheetData = {
      sheets: [
        {
          properties: {
            title: courseName || (existingData.sheets?.[0]?.properties?.title || '')
          },
          data: [
            {
              rowData: newRowData
            }
          ]
        }
      ]
    };

    // Tạo document mới với dữ liệu đã được hợp nhất
    const newCourseData = {
      _id: existingCourse._id,
      kimvanId: existingCourse.kimvanId,
      name: courseName || existingCourse.name,
      description: courseName 
        ? `Khóa học ${courseName}` 
        : existingCourse.description,
      price: existingCourse.price || 500000, 
      status: existingCourse.status || 'active',
      createdAt: existingCourse.createdAt || new Date(),
      updatedAt: new Date(),
      originalData: newSheetData
    };
    
    // Cập nhật document với dữ liệu đã được hợp nhất
    const result = await Course.findOneAndUpdate(
      { kimvanId: id },
      { $set: newCourseData },
      { new: true }
    );
    
    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { 
          success: false,
          message: 'Không có dữ liệu nào được cập nhật' 
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Đồng bộ khóa học thành công - Dữ liệu đã được làm mới hoàn toàn',
      updatedFields: Object.keys(newCourseData)
    });
  } catch (error) {
    console.error('Lỗi khi đồng bộ khóa học:', error);
    return NextResponse.json(
      { 
        success: false,
        message: 'Đã xảy ra lỗi khi đồng bộ khóa học',
        error: error.message 
      },
      { status: 500 }
    );
  }
} 