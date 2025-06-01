import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import CryptoJS from 'crypto-js';
import mongoose from 'mongoose';
import Course from '@/models/Course';
import { connectDB } from '@/lib/mongodb';
import Enrollment from '@/models/Enrollment';
import { authMiddleware } from '@/lib/auth';

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

// Thêm hàm phân tích và chuẩn hóa URL để so sánh chính xác hơn
function normalizeUrl(url) {
  if (!url) return '';
  
  try {
    // Xử lý các trường hợp đặc biệt
    let normalizedUrl = url.trim();
    
    // Loại bỏ các tham số theo dõi và UTM nếu có
    try {
      const urlObj = new URL(normalizedUrl);
      urlObj.searchParams.delete('utm_source');
      urlObj.searchParams.delete('utm_medium');
      urlObj.searchParams.delete('utm_campaign');
      normalizedUrl = urlObj.toString();
    } catch (e) {
      // Nếu không phân tích được URL, giữ nguyên
      console.log(`⚠️ Không thể phân tích URL: ${url}`);
    }
    
    // Xử lý các URL Google Drive
    if (normalizedUrl.includes('drive.google.com')) {
      // Trích xuất ID của file Google Drive từ nhiều định dạng khác nhau
      const driveIdMatch = normalizedUrl.match(/\/d\/([^\/\?#]+)/);
      const altDriveIdMatch = normalizedUrl.match(/id=([^&]+)/);
      const driveId = driveIdMatch ? driveIdMatch[1] : (altDriveIdMatch ? altDriveIdMatch[1] : null);
      
      if (driveId) {
        // Chuẩn hóa thành định dạng URL Google Drive tiêu chuẩn
        return `https://drive.google.com/file/d/${driveId}`;
      }
    }
    
    return normalizedUrl;
  } catch (error) {
    console.error(`❌ Lỗi khi chuẩn hóa URL: ${url}`, error);
    return url; // Trả về URL gốc nếu có lỗi
  }
}

// Thêm hàm so sánh URL sử dụng thuật toán đo lường độ tương đồng (Levenshtein)
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // Tính toán khoảng cách Levenshtein
  const track = Array(str2.length + 1).fill(null).map(() => 
    Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  
  // Tính toán % giống nhau
  const maxLength = Math.max(str1.length, str2.length);
  const distance = track[str2.length][str1.length];
  const similarity = ((maxLength - distance) / maxLength) * 100;
  
  return similarity;
}

// Hàm tìm URL đã xử lý dựa trên độ tương đồng
function findProcessedUrl(originalUrl, processedFiles) {
  if (!originalUrl || !processedFiles || processedFiles.length === 0) {
    return null;
  }
  
  // Chuẩn hóa URL để so sánh
  const normalizedUrl = normalizeUrl(originalUrl);
  
  // Tìm kiếm khớp chính xác trước
  const exactMatch = processedFiles.find(file => normalizeUrl(file.originalUrl) === normalizedUrl);
  if (exactMatch) {
    console.log(`✅ [PATCH] Tìm thấy khớp chính xác cho URL: ${originalUrl.substring(0, 50)}...`);
    return exactMatch;
  }
  
  // Nếu không có khớp chính xác, tìm kiếm URL tương tự
  const SIMILARITY_THRESHOLD = 80; // Ngưỡng % tương đồng (80%)
  
  // Đối với Google Drive, kiểm tra ID của tài liệu
  if (normalizedUrl.includes('drive.google.com')) {
    const driveIdMatch = normalizedUrl.match(/\/d\/([^\/\?#]+)/);
    const urlDriveId = driveIdMatch ? driveIdMatch[1] : null;
    
    if (urlDriveId) {
      for (const file of processedFiles) {
        const fileUrlNormalized = normalizeUrl(file.originalUrl);
        const fileIdMatch = fileUrlNormalized.match(/\/d\/([^\/\?#]+)/);
        const fileId = fileIdMatch ? fileIdMatch[1] : null;
        
        if (fileId && fileId === urlDriveId) {
          console.log(`✅ [PATCH] Tìm thấy khớp ID Google Drive cho URL: ${originalUrl.substring(0, 50)}...`);
          return file;
        }
      }
    }
  }
  
  // Tính toán độ tương đồng cho tất cả các URL đã xử lý
  let bestMatch = null;
  let highestSimilarity = 0;
  
  for (const file of processedFiles) {
    const fileUrlNormalized = normalizeUrl(file.originalUrl);
    const similarity = calculateSimilarity(normalizedUrl, fileUrlNormalized);
    
    if (similarity > highestSimilarity && similarity >= SIMILARITY_THRESHOLD) {
      highestSimilarity = similarity;
      bestMatch = file;
    }
  }
  
  if (bestMatch) {
    console.log(`✅ [PATCH] Tìm thấy URL tương tự (${highestSimilarity.toFixed(2)}%) cho: ${originalUrl.substring(0, 50)}...`);
    return bestMatch;
  }
  
  return null;
}

// Thêm hàm tạo bản đồ vị trí cho các URL đã xử lý
function createPositionMap(originalData, processedFiles) {
  // Lưu trữ các link đã xử lý theo vị trí
  const positionMap = new Map();
  
  if (!originalData || !originalData.sheets || !Array.isArray(originalData.sheets)) {
    console.log('⚠️ [PATCH] Không có dữ liệu sheets trong dữ liệu gốc để tạo bản đồ vị trí');
    return positionMap;
  }
  
  console.log(`📊 [PATCH] Bắt đầu tạo bản đồ vị trí từ dữ liệu gốc với ${originalData.sheets.length} sheets`);
  
  // Duyệt qua toàn bộ dữ liệu để tìm vị trí của link đã xử lý
  originalData.sheets.forEach((sheet, sheetIndex) => {
    const sheetTitle = sheet?.properties?.title || `Sheet ${sheetIndex + 1}`;
    
    if (sheet.data && Array.isArray(sheet.data)) {
      sheet.data.forEach((sheetData) => {
        if (sheetData.rowData && Array.isArray(sheetData.rowData)) {
          sheetData.rowData.forEach((row, rowIndex) => {
            if (row.values && Array.isArray(row.values)) {
              row.values.forEach((cell, cellIndex) => {
                const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
                
                if (originalUrl) {
                  // Tìm trong danh sách processedFiles
                  const processedFile = processedFiles.find(file => file.originalUrl === originalUrl);
                  
                  if (processedFile) {
                    // Tạo khóa vị trí
                    const positionKey = `${sheetTitle}|${rowIndex}|${cellIndex}`;
                    positionMap.set(positionKey, processedFile);
                    console.log(`📍 [PATCH] Đã lưu vị trí cho link đã xử lý: ${positionKey}`);
                  }
                }
              });
            }
          });
        }
      });
    }
  });
  
  console.log(`📊 [PATCH] Đã tạo bản đồ vị trí với ${positionMap.size} entries`);
  return positionMap;
}

// Thêm biến để lưu trữ dữ liệu tạm thời
const kimvanDataCache = new Map();

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
    
    // Bypass authentication check - always return full course data
    const isEnrolled = true;
    const canViewAllCourses = true;
    
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
      canViewAllCourses: canViewAllCourses,
      originalData: course.originalData
    };
    
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
    
    console.log('🔄 [PATCH] Bắt đầu đồng bộ khóa học với ID:', id);
    
    // Lấy body request nếu có
    let requestBody = {};
    try {
      requestBody = await request.json();
      console.log('📝 [PATCH] Dữ liệu từ request body:', JSON.stringify(requestBody));
    } catch (e) {
      console.log('⚠️ [PATCH] Không có request body hoặc lỗi parse JSON:', e.message);
    }
    
    // Kiểm tra chế độ xem trước và các tham số khác
    const previewMode = requestBody.preview === true;
    const applyProcessedLinks = requestBody.applyProcessedLinks === true;
    const useCache = requestBody.useCache === true || applyProcessedLinks === true;
    
    console.log(`🔍 [PATCH] Chế độ xem trước: ${previewMode ? 'Bật' : 'Tắt'}`);
    console.log(`🔗 [PATCH] Áp dụng link đã xử lý: ${applyProcessedLinks ? 'Bật' : 'Tắt'}`);
    console.log(`💾 [PATCH] Sử dụng dữ liệu đã lưu tạm: ${useCache ? 'Bật' : 'Tắt'}`);
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    if (!id) {
      return NextResponse.json(
        { message: 'Thiếu ID khóa học' },
        { status: 400 }
      );
    }
    
    // Kiểm tra xem khóa học có tồn tại không
    console.log('🔍 [PATCH] Tìm kiếm khóa học trong database với kimvanId:', id);
    const existingCourse = await Course.findOne({ kimvanId: id }).lean().exec();
    if (!existingCourse) {
      console.log('❌ [PATCH] Không tìm thấy khóa học với kimvanId:', id);
      return NextResponse.json(
        { 
          success: false,
          message: 'Không tìm thấy khóa học để đồng bộ' 
        },
        { status: 404 }
      );
    }
    
    console.log('✅ [PATCH] Đã tìm thấy khóa học:', existingCourse._id.toString());
    
    // Lưu danh sách các file đã xử lý từ khóa học hiện tại
    const processedFiles = existingCourse.processedDriveFiles || [];
    console.log(`📊 [PATCH] Số lượng file đã xử lý từ dữ liệu cũ: ${processedFiles.length}`);
    
    // Thay đổi: Tạo bản đồ vị trí thay vì bản đồ URL
    const positionMap = createPositionMap(existingCourse.originalData, processedFiles);
    console.log(`📊 [PATCH] Đã tạo bản đồ vị trí với ${positionMap.size} vị trí đã xử lý`);
    
    // Khai báo biến để lưu dữ liệu Kimvan
    let kimvanData;
    
    // Kiểm tra nếu sử dụng dữ liệu từ bộ nhớ tạm
    if (useCache && kimvanDataCache.has(id)) {
      console.log('💾 [PATCH] Sử dụng dữ liệu đã lưu trong bộ nhớ tạm');
      kimvanData = kimvanDataCache.get(id);
    } else {
      // Gọi API để lấy dữ liệu mới từ Kimvan
      console.log(`🔄 [PATCH] Đang gọi API kimvan với ID: ${id}`);
      const kimvanUrl = new URL(request.url);
      const origin = kimvanUrl.origin;
      const kimvanApiUrl = `${origin}/api/spreadsheets/${id}`;
      console.log(`🌐 [PATCH] URL đích: ${kimvanApiUrl}`);
      
      const kimvanResponse = await fetch(kimvanApiUrl);
      
      if (!kimvanResponse.ok) {
        console.log(`❌ [PATCH] Lỗi khi gọi API: ${kimvanResponse.status}`);
        return NextResponse.json(
          { 
            success: false,
            message: 'Không thể lấy dữ liệu từ Kimvan API',
            error: `Lỗi: ${kimvanResponse.status}` 
          },
          { status: 500 }
        );
      }
      
      console.log('✅ [PATCH] Đã nhận dữ liệu từ kimvan API thành công!');
      kimvanData = await kimvanResponse.json();
      
      // Lưu dữ liệu vào bộ nhớ tạm nếu đang ở chế độ xem trước
      if (previewMode) {
        console.log('💾 [PATCH] Lưu dữ liệu vào bộ nhớ tạm');
        kimvanDataCache.set(id, kimvanData);
        
        // Thiết lập xóa cache sau 30 phút
        setTimeout(() => {
          console.log(`🗑️ [PATCH] Xóa dữ liệu tạm cho khóa học ${id}`);
          kimvanDataCache.delete(id);
        }, 30 * 60 * 1000);
      }
    }
    
    // Thêm log để kiểm tra xem kimvanData có chứa thông tin đã xử lý không
    console.log(`🔍 [PATCH] Kiểm tra dữ liệu trước khi lưu:`);
    let processedUrlCount = 0;
    if (kimvanData.sheets && Array.isArray(kimvanData.sheets)) {
      kimvanData.sheets.forEach(sheet => {
        if (sheet.data && Array.isArray(sheet.data)) {
          sheet.data.forEach(sheetData => {
            if (sheetData.rowData && Array.isArray(sheetData.rowData)) {
              sheetData.rowData.forEach(row => {
                if (row.values && Array.isArray(row.values)) {
                  row.values.forEach(cell => {
                    if (cell.processedLinks && cell.processedLinks.url) {
                      processedUrlCount++;
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
    console.log(`🔢 [PATCH] Số link đã xử lý trong dữ liệu sẽ lưu: ${processedUrlCount}`);

    // Đếm số lượng link trong dữ liệu mới
    let totalLinks = 0;
    let processedLinksInNewData = 0;
    
    // Sửa phần xử lý link trong dữ liệu mới
    if (kimvanData.sheets && Array.isArray(kimvanData.sheets)) {
      console.log(`📊 [PATCH] Số lượng sheets trong dữ liệu mới: ${kimvanData.sheets.length}`);
      
      kimvanData.sheets.forEach((sheet, sheetIndex) => {
        const sheetTitle = sheet?.properties?.title || `Sheet ${sheetIndex + 1}`;
        console.log(`📝 [PATCH] Xử lý sheet ${sheetIndex + 1}: ${sheetTitle}`);
        
        if (sheet.data && Array.isArray(sheet.data)) {
          sheet.data.forEach((sheetData, dataIndex) => {
            if (sheetData.rowData && Array.isArray(sheetData.rowData)) {
              console.log(`📊 [PATCH] Sheet ${sheetIndex + 1}, Data ${dataIndex + 1}: ${sheetData.rowData.length} hàng`);
              
              sheetData.rowData.forEach((row, rowIndex) => {
                if (row.values && Array.isArray(row.values)) {
                  row.values.forEach((cell, cellIndex) => {
                    // Kiểm tra nếu cell có link
                    const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
                    if (originalUrl) {
                      totalLinks++;
                      
                      // Tạo khóa vị trí tương ứng
                      const positionKey = `${sheetTitle}|${rowIndex}|${cellIndex}`;
                      
                      // Tìm kiếm URL đã xử lý dựa trên vị trí
                      if (positionMap.has(positionKey)) {
                        const processedFile = positionMap.get(positionKey);
                        processedLinksInNewData++;
                        
                        // Thêm thông tin về file đã xử lý vào cell - ĐẢM BẢO LƯU VÀO MONGODB
                        // Cần đảm bảo thuộc tính này được lưu vào schema MongoDB
                        if (!cell.processedLinks) {
                          cell.processedLinks = {};
                        }
                        cell.processedLinks.url = processedFile.processedUrl;
                        cell.processedLinks.processedAt = processedFile.processedAt;
                        
                        // Cách cũ - có thể bị MongoDB bỏ qua
                        cell.processedUrl = processedFile.processedUrl;
                        cell.processedAt = processedFile.processedAt;
                        
                        console.log(`✅ [PATCH] Sheet ${sheetTitle}, Hàng ${rowIndex + 1}, Cột ${cellIndex + 1}: Đã áp dụng link đã xử lý`);
                        console.log(`   - Link gốc (mới): ${originalUrl.substring(0, 50)}...`);
                        console.log(`   - Link gốc (cũ): ${processedFile.originalUrl.substring(0, 50)}...`);
                        console.log(`   - Link đã xử lý: ${processedFile.processedUrl.substring(0, 50)}...`);
                      } else {
                        console.log(`ℹ️ [PATCH] Sheet ${sheetTitle}, Hàng ${rowIndex + 1}, Cột ${cellIndex + 1}: Không tìm thấy link đã xử lý cho vị trí này`);
                        console.log(`   - Link: ${originalUrl.substring(0, 50)}...`);
                      }
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
    
    console.log(`📊 [PATCH] Tổng số link trong dữ liệu mới: ${totalLinks}`);
    console.log(`📊 [PATCH] Số link đã xử lý được áp dụng: ${processedLinksInNewData}`);
    
    // Xử lý dữ liệu dựa vào cấu trúc thực tế từ API
    let courseName = '';
    
    // Kiểm tra cấu trúc dữ liệu và lấy tên khóa học
    if (kimvanData && typeof kimvanData === 'object') {
      if (kimvanData.name) {
        courseName = kimvanData.name;
      } else if (kimvanData.data && kimvanData.data.name) {
        courseName = kimvanData.data.name;
      } else if (Array.isArray(kimvanData) && kimvanData.length > 0 && kimvanData[0].name) {
        courseName = kimvanData[0].name;
      }
    }
    
    console.log('📝 [PATCH] Tên khóa học được xác định:', courseName || 'Không xác định được tên');
    
    // Tạo document mới để thay thế dữ liệu cũ
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
      processedDriveFiles: processedFiles, // Giữ nguyên danh sách file đã xử lý
      originalData: kimvanData // Dữ liệu mới đã được ghi đè thông tin xử lý
    };
    
    // Thêm log để kiểm tra xem dữ liệu đã xử lý đúng chưa
    console.log(`💾 [PATCH] Lưu dữ liệu đã xử lý với ${processedLinksInNewData} link đã áp dụng`);

    // Tạo dữ liệu xem trước để trả về client
    const previewData = {
      courseInfo: {
        name: newCourseData.name,
        description: newCourseData.description,
        price: newCourseData.price,
        status: newCourseData.status
      },
      stats: {
        totalLinks,
        processedLinks: processedLinksInNewData,
        totalSheets: kimvanData.sheets?.length || 0,
        preservedProcessedFiles: processedFiles.length
      },
      sampleSheet: kimvanData.sheets && kimvanData.sheets.length > 0 
        ? {
            title: kimvanData.sheets[0]?.properties?.title || 'Sheet 1',
            rowCount: kimvanData.sheets[0]?.data?.[0]?.rowData?.length || 0,
            firstFewRows: kimvanData.sheets[0]?.data?.[0]?.rowData?.slice(0, 5) || []
          }
        : null,
      // Thêm danh sách đầy đủ các link
      allLinks: {
        processed: [],
        unprocessed: []
      }
    };
    
    // Thu thập tất cả các link
    if (kimvanData.sheets && Array.isArray(kimvanData.sheets)) {
      kimvanData.sheets.forEach((sheet, sheetIndex) => {
        const sheetTitle = sheet?.properties?.title || `Sheet ${sheetIndex + 1}`;
        
        if (sheet.data && Array.isArray(sheet.data)) {
          sheet.data.forEach((sheetData) => {
            if (sheetData.rowData && Array.isArray(sheetData.rowData)) {
              sheetData.rowData.forEach((row, rowIndex) => {
                if (row.values && Array.isArray(row.values)) {
                  row.values.forEach((cell, cellIndex) => {
                    const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
                    if (originalUrl) {
                      const displayText = cell.formattedValue || originalUrl;
                      const position = {
                        sheet: sheetTitle,
                        row: rowIndex,
                        col: cellIndex
                      };
                      
                      // Sửa đoạn này để kiểm tra cả hai thuộc tính
                      if (cell.processedUrl || (cell.processedLinks && cell.processedLinks.url)) {
                        // Link đã xử lý
                        previewData.allLinks.processed.push({
                          originalUrl,
                          processedUrl: cell.processedUrl || cell.processedLinks.url,
                          processedAt: cell.processedAt || cell.processedLinks.processedAt,
                          displayText,
                          position
                        });
                      } else {
                        // Link chưa xử lý
                        previewData.allLinks.unprocessed.push({
                          originalUrl,
                          displayText,
                          position
                        });
                      }
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
    
    console.log(`📊 [PATCH] Số link đã xử lý trong danh sách: ${previewData.allLinks.processed.length}`);
    console.log(`📊 [PATCH] Số link chưa xử lý trong danh sách: ${previewData.allLinks.unprocessed.length}`);
    
    // Nếu ở chế độ xem trước, chỉ trả về dữ liệu xem trước
    if (previewMode || requestBody.preview === true) {
      console.log('🔍 [PATCH] Trả về dữ liệu xem trước và không cập nhật database');
      return NextResponse.json({
        success: true,
        message: 'Xem trước dữ liệu đồng bộ - Database chưa được cập nhật',
        preview: true,
        previewData
      });
    }
    
    // Nếu không phải chế độ xem trước, cập nhật database
    console.log('💾 [PATCH] Cập nhật dữ liệu vào database');
    
    // Đảm bảo dữ liệu processed links được lưu đúng cách
    // Chuyển đổi đối tượng sang chuỗi JSON và ngược lại để bảo toàn tất cả thuộc tính
    const serializedData = JSON.stringify(kimvanData);
    const deserializedData = JSON.parse(serializedData);
    newCourseData.originalData = deserializedData;
    
    console.log(`🔧 [PATCH] Dữ liệu đã được serialize để đảm bảo lưu đúng các link đã xử lý`);
    
    const result = await Course.replaceOne(
      { kimvanId: id },
      newCourseData
    );
    
    if (result.modifiedCount === 0) {
      console.log('⚠️ [PATCH] Không có dữ liệu nào được cập nhật');
      return NextResponse.json(
        { 
          success: false,
          message: 'Không có dữ liệu nào được cập nhật' 
        },
        { status: 400 }
      );
    }
    
    console.log('✅ [PATCH] Đồng bộ khóa học thành công');
    return NextResponse.json({
      success: true,
      message: 'Đồng bộ khóa học thành công - Dữ liệu đã được làm mới hoàn toàn',
      stats: {
        totalLinks,
        processedLinks: processedLinksInNewData,
        preservedProcessedFiles: processedFiles.length
      },
      updatedFields: Object.keys(newCourseData)
    });
  } catch (error) {
    console.error('❌ [PATCH] Lỗi khi đồng bộ khóa học:', error);
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