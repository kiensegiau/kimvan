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

// Thêm hàm trích xuất ID Google Drive từ URL
function extractGoogleDriveId(url) {
  if (!url) return null;
  if (!url.includes('drive.google.com/file/d/')) return null;
  
  try {
    const match = url.match(/\/file\/d\/([^\/\?#]+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error(`❌ Lỗi khi trích xuất Google Drive ID từ URL: ${url}`, error);
    return null;
  }
}

// Thêm hàm tạo bản đồ vị trí cho các URL đã xử lý từ originalData
function createPositionMap(originalData) {
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
    console.log(`🔍 [PATCH] Đang quét sheet "${sheetTitle}"`);
    
    if (sheet.data && Array.isArray(sheet.data)) {
      sheet.data.forEach((sheetData, dataIndex) => {
        console.log(`🔍 [PATCH] Đang quét data #${dataIndex} trong sheet "${sheetTitle}"`);
        
        if (sheetData.rowData && Array.isArray(sheetData.rowData)) {
          console.log(`🔍 [PATCH] Số hàng trong data #${dataIndex}: ${sheetData.rowData.length}`);
          
          sheetData.rowData.forEach((row, rowIndex) => {
            if (row.values && Array.isArray(row.values)) {
              row.values.forEach((cell, cellIndex) => {
                // Kiểm tra các loại URL và trạng thái của cell
                const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || 
                                  cell.hyperlink || 
                                  cell.originalUrl; // Kiểm tra cả trường originalUrl đã lưu
                const linkRemoved = cell.linkRemoved === true;
                const isFakeLink = cell.isFakeLink === true;
                
                // Kiểm tra xem cell này có chứa link đã xử lý không
                // Kiểm tra cả các trường cũ và mới
                const processedUrl = cell.processedUrl || 
                                   (cell.processedLinks && cell.processedLinks.url);
                const processedAt = cell.processedAt || 
                                   (cell.processedLinks && cell.processedLinks.processedAt);
                
                // Lưu TẤT CẢ các vị trí có link (hoặc đã từng có link) để bảo toàn cấu trúc
                if (originalUrl || linkRemoved) {
                  // Tạo khóa vị trí
                  const positionKey = `${sheetTitle}|${rowIndex}|${cellIndex}`;
                  
                  // Lưu thông tin về link
                  positionMap.set(positionKey, {
                    originalUrl: originalUrl || null,
                    processedUrl: processedUrl || null,
                    processedAt: processedAt || null,
                    isProcessed: !!processedUrl,
                    linkRemoved: linkRemoved,
                    isFakeLink: isFakeLink,
                    position: {
                      sheet: sheetTitle,
                      row: rowIndex,
                      col: cellIndex
                    }
                  });
                  
                  if (processedUrl) {
                    console.log(`📍 [PATCH] Đã lưu vị trí cho link đã xử lý: ${positionKey}`);
                    console.log(`   - URL gốc: ${originalUrl ? originalUrl.substring(0, 50) + '...' : '[Link đã bị xóa]'}`);
                    console.log(`   - URL đã xử lý: ${processedUrl.substring(0, 50)}...`);
                  } else if (linkRemoved) {
                    console.log(`📍 [PATCH] Đã lưu vị trí cho link đã bị xóa: ${positionKey}`);
                    if (originalUrl) {
                      console.log(`   - URL gốc (đã lưu): ${originalUrl.substring(0, 50)}...`);
                    }
                  }
                }
              });
            }
          });
        }
      });
    }
  });
  
  // Kiểm tra trong processedDriveFiles nếu chưa tìm thấy link đã xử lý nào
  const processedCount = Array.from(positionMap.values()).filter(item => item.isProcessed).length;
  
  if (processedCount === 0) {
    console.log(`⚠️ [PATCH] Không tìm thấy link đã xử lý trong originalData, đang kiểm tra trong processedDriveFiles...`);
    
    // Kiểm tra xem có processedDriveFiles không
    if (originalData.processedDriveFiles && Array.isArray(originalData.processedDriveFiles) && originalData.processedDriveFiles.length > 0) {
      console.log(`🔍 [PATCH] Tìm thấy ${originalData.processedDriveFiles.length} link đã xử lý trong processedDriveFiles`);
      
      // Chuyển từ processedDriveFiles sang positionMap
      originalData.processedDriveFiles.forEach((file, index) => {
        // Nếu có thông tin position
        if (file.position && file.position.sheet && typeof file.position.row === 'number' && typeof file.position.col === 'number') {
          const positionKey = `${file.position.sheet}|${file.position.row}|${file.position.col}`;
          
          positionMap.set(positionKey, {
            originalUrl: file.originalUrl,
            processedUrl: file.processedUrl,
            processedAt: file.processedAt || new Date(),
            isProcessed: true,
            position: file.position
          });
          
          console.log(`📍 [PATCH] Đã thêm từ processedDriveFiles: ${positionKey}`);
        } else {
          console.log(`⚠️ [PATCH] File #${index} không có thông tin vị trí: ${file.originalUrl.substring(0, 50)}...`);
        }
      });
    } else {
      console.log(`⚠️ [PATCH] Không tìm thấy processedDriveFiles hoặc mảng trống`);
    }
  }
  
  // Cập nhật lại số lượng link đã xử lý
  const finalProcessedCount = Array.from(positionMap.values()).filter(item => item.isProcessed).length;
  console.log(`📊 [PATCH] Đã tạo bản đồ vị trí với ${positionMap.size} entries tổng, ${finalProcessedCount} đã xử lý`);
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
    
    // Kiểm tra dữ liệu originalData
    console.log('=== THÔNG TIN DỮ LIỆU GỐC ===');
    const hasOriginalData = !!existingCourse.originalData;
    console.log('1. Có dữ liệu gốc:', hasOriginalData);
    
    if (hasOriginalData) {
      const sheetCount = existingCourse.originalData.sheets?.length || 0;
      console.log('2. Số lượng sheets trong dữ liệu gốc:', sheetCount);
      
      if (sheetCount > 0) {
        const sampleSheet = existingCourse.originalData.sheets[0];
        const rowCount = sampleSheet?.data?.[0]?.rowData?.length || 0;
        console.log('3. Số lượng hàng trong sheet đầu tiên:', rowCount);
        
        // Kiểm tra xem có link đã xử lý trong dữ liệu gốc không
        let processedLinkCount = 0;
        if (sampleSheet?.data?.[0]?.rowData) {
          sampleSheet.data[0].rowData.forEach(row => {
            if (row.values) {
              row.values.forEach(cell => {
                const processedUrl = cell.processedUrl || (cell.processedLinks && cell.processedLinks.url);
                if (processedUrl) processedLinkCount++;
              });
            }
          });
        }
        console.log('4. Số lượng link đã xử lý tìm thấy trong sheet đầu tiên:', processedLinkCount);
      }
    }
    
    // Tạo bản đồ vị trí từ dữ liệu gốc (chứa cả link đã xử lý)
    const positionMap = createPositionMap(existingCourse.originalData);
    console.log(`📊 [PATCH] Đã tạo bản đồ vị trí với ${positionMap.size} vị trí đã xử lý`);
    
    // Log chi tiết về positionMap để debug
    console.log('=== THÔNG TIN CHI TIẾT POSITION MAP ===');
    const positionKeys = Array.from(positionMap.keys());
    console.log('1. Số lượng vị trí trong map:', positionKeys.length);
    
    if (positionKeys.length > 0) {
      console.log('2. Mẫu vài vị trí đầu tiên:', positionKeys.slice(0, 5));
      
      // Phân tích định dạng key
      const keySample = positionKeys[0];
      const keyParts = keySample.split('|');
      console.log('3. Định dạng key:', {
        sheet: keyParts[0],
        row: keyParts[1],
        col: keyParts[2],
        full: keySample
      });
      
      // Lấy mẫu giá trị của position đầu tiên
      const firstPositionValue = positionMap.get(positionKeys[0]);
      console.log('4. Mẫu dữ liệu tại vị trí đầu tiên:', firstPositionValue);
    }
    
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
      
      // Chuẩn bị options cho fetch request
      const fetchOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Nếu có originalId, thêm vào body của request
      if (requestBody.originalId) {
        console.log(`📎 [PATCH] Thêm originalId: ${requestBody.originalId} vào request`);
        fetchOptions.method = 'POST';
        fetchOptions.body = JSON.stringify({
          originalId: requestBody.originalId
        });
      }
      
      const kimvanResponse = await fetch(kimvanApiUrl, fetchOptions);
      
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
    let processedLinksInNewData = 0;
    let totalLinks = 0;
    
    console.log(`🔄 [PATCH] Bắt đầu xử lý dữ liệu từ KimVan, kiểm tra khớp với dữ liệu đã xử lý...`);
    
    if (kimvanData.sheets && Array.isArray(kimvanData.sheets)) {
      kimvanData.sheets.forEach((sheet, sheetIndex) => {
        const sheetTitle = sheet?.properties?.title || `Sheet ${sheetIndex + 1}`;
        console.log(`🔍 [PATCH] Đang xử lý sheet "${sheetTitle}"`);
        
        if (sheet.data && Array.isArray(sheet.data)) {
          sheet.data.forEach((sheetData, dataIndex) => {
            if (sheetData.rowData && Array.isArray(sheetData.rowData)) {
              sheetData.rowData.forEach((row, rowIndex) => {
                if (row.values && Array.isArray(row.values)) {
                  row.values.forEach((cell, cellIndex) => {
                    // Kiểm tra nếu cell có link hoặc đã bị xóa link
                    const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink || cell.originalUrl;
                    const wasLinkRemoved = cell.linkRemoved === true;
                    
                    if (originalUrl || wasLinkRemoved) {
                      totalLinks++;
                      
                      // Kiểm tra xem link có được đánh dấu là giả không từ API spreadsheets
                      const isFakeLink = cell.isFakeLink === true;
                      
                      if (isFakeLink || wasLinkRemoved) {
                        console.log(`🚫 [PATCH] ${wasLinkRemoved ? 'Link giả mạo đã bị xóa' : 'Phát hiện link giả mạo'} tại Sheet ${sheetTitle}, Hàng ${rowIndex + 1}, Cột ${cellIndex + 1}`);
                      }
                      
                      // CHỈ sử dụng vị trí để tìm kiếm, bỏ qua nội dung URL
                      const positionKey = `${sheetTitle}|${rowIndex}|${cellIndex}`;
                      
                      // Tìm kiếm dựa trên vị trí
                      if (positionMap.has(positionKey)) {
                        const processedInfo = positionMap.get(positionKey);
                        
                        // Kiểm tra xem có originalUrl hay processedUrl không
                        // Ưu tiên sử dụng processedUrl nếu có, nếu không thì dùng originalUrl
                        const urlToUse = processedInfo.processedUrl || processedInfo.originalUrl;
                        
                        if (urlToUse) {
                          processedLinksInNewData++;
                          
                          // Thêm thông tin về file đã xử lý vào cell - ĐẢM BẢO LƯU VÀO MONGODB
                          if (!cell.processedLinks) {
                            cell.processedLinks = {};
                          }
                          
                          // Lưu cả processedUrl và originalUrl để tham chiếu
                          cell.processedLinks.url = processedInfo.processedUrl || null;
                          cell.processedLinks.originalUrl = processedInfo.originalUrl;
                          cell.processedLinks.processedAt = processedInfo.processedAt;
                          cell.processedLinks.usedOriginalUrl = !processedInfo.processedUrl; // Đánh dấu đã sử dụng URL gốc
                          
                          // Thêm thông tin vị trí để dễ truy xuất sau này
                          cell.processedLinks.position = {
                            sheet: sheetTitle,
                            row: rowIndex,
                            col: cellIndex
                          };
                          
                          // Cách cũ - có thể bị MongoDB bỏ qua
                          cell.processedUrl = processedInfo.processedUrl;
                          cell.processedAt = processedInfo.processedAt;
                          
                          // QUAN TRỌNG: Đảm bảo URL được thêm vào cấu trúc cell để hiển thị trong UI
                          // Tạo lại cấu trúc link trong cell
                          if (!cell.userEnteredFormat) {
                            cell.userEnteredFormat = {};
                          }
                          if (!cell.userEnteredFormat.textFormat) {
                            cell.userEnteredFormat.textFormat = {};
                          }
                          if (!cell.userEnteredFormat.textFormat.link) {
                            cell.userEnteredFormat.textFormat.link = {};
                          }
                          
                          // Thêm URL vào cả hai vị trí để đảm bảo hiển thị
                          cell.userEnteredFormat.textFormat.link.uri = urlToUse;
                          cell.hyperlink = urlToUse;
                          
                          // Nếu không có text hiển thị, thêm một text mặc định
                          if (!cell.formattedValue) {
                            cell.formattedValue = processedInfo.processedUrl ? "Tài liệu đã xử lý" : "Tài liệu gốc";
                          }
                          
                          console.log(`✅ [PATCH] Sheet ${sheetTitle}, Hàng ${rowIndex + 1}, Cột ${cellIndex + 1}: Đã áp dụng link theo vị trí`);
                          if (wasLinkRemoved) {
                            console.log(`   - Link gốc: [Đã xóa link giả mạo]`);
                          } else {
                            console.log(`   - Link gốc: ${originalUrl ? originalUrl.substring(0, 50) + '...' : '[Unknown]'}`);
                          }
                          
                          if (processedInfo.processedUrl) {
                            console.log(`   - Link đã xử lý: ${processedInfo.processedUrl.substring(0, 50)}...`);
                          } else {
                            console.log(`   - Sử dụng link gốc (chưa xử lý): ${processedInfo.originalUrl.substring(0, 50)}...`);
                          }
                          
                          console.log(`   - Đã thêm link vào cấu trúc cell để hiển thị trong UI`);
                        } else if (isFakeLink || wasLinkRemoved) {
                          // Nếu là link giả đã bị xóa, nhưng không có bản đã xử lý
                          console.log(`ℹ️ [PATCH] Sheet ${sheetTitle}, Hàng ${rowIndex + 1}, Cột ${cellIndex + 1}: Link giả mạo chưa được xử lý`);
                        }
                      } else {
                        // Không tìm thấy trong positionMap
                        console.log(`ℹ️ [PATCH] Sheet ${sheetTitle}, Hàng ${rowIndex + 1}, Cột ${cellIndex + 1}: Không tìm thấy link trong bản đồ vị trí`);
                        
                        // Nếu là link giả mạo, sử dụng hyperlink thay vì URL giả
                        if (isFakeLink && cell.hyperlink) {
                          console.log(`🔄 [PATCH] Sử dụng hyperlink làm dự phòng: ${cell.hyperlink}`);
                          
                          // Thêm thông tin về file vào cell
                          if (!cell.processedLinks) {
                            cell.processedLinks = {};
                          }
                          
                          cell.processedLinks.url = cell.hyperlink;
                          cell.processedLinks.originalUrl = originalUrl;
                          cell.processedLinks.processedAt = new Date();
                          cell.processedLinks.usedHyperlink = true; // Đánh dấu đã sử dụng hyperlink
                          
                          // Thêm thông tin vị trí để dễ truy xuất sau này
                          cell.processedLinks.position = {
                            sheet: sheetTitle,
                            row: rowIndex,
                            col: cellIndex
                          };
                          
                          // Đảm bảo URL được thêm vào cấu trúc cell để hiển thị trong UI
                          if (!cell.userEnteredFormat) {
                            cell.userEnteredFormat = {};
                          }
                          if (!cell.userEnteredFormat.textFormat) {
                            cell.userEnteredFormat.textFormat = {};
                          }
                          if (!cell.userEnteredFormat.textFormat.link) {
                            cell.userEnteredFormat.textFormat.link = {};
                          }
                          
                          // Thêm hyperlink vào các vị trí để đảm bảo hiển thị
                          cell.userEnteredFormat.textFormat.link.uri = cell.hyperlink;
                          
                          // Đánh dấu đã sử dụng hyperlink
                          processedLinksInNewData++;
                          
                          console.log(`✅ [PATCH] Sheet ${sheetTitle}, Hàng ${rowIndex + 1}, Cột ${cellIndex + 1}: Đã sử dụng hyperlink làm dự phòng`);
                        }
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
      processedDriveFiles: existingCourse.processedDriveFiles || [],
      originalData: kimvanData
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
        preservedProcessedFiles: positionMap.size
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
      },
      // Thêm danh sách processedLinks để có thể phân tích
      processedLinks: Array.from(positionMap.entries()).map(([key, value]) => {
        const parts = key.split('|');
        return {
          position: {
            key,
            sheet: parts[0],
            row: parseInt(parts[1]),
            col: parseInt(parts[2])
          },
          originalUrl: value.originalUrl,
          processedUrl: value.processedUrl,
          processedAt: value.processedAt
        };
      }),
      // Thêm thông tin về link giả mạo
      fakeLinksInfo: {
        detectionEnabled: true,
        removalEnabled: true,
        message: "API KimVan trả về các link giả mạo. Các link giả mạo đã bị xóa hoàn toàn khỏi dữ liệu."
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
                    const originalUrl = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink || cell.originalUrl;
                    const wasLinkRemoved = cell.linkRemoved === true;
                    const isFakeLink = cell.isFakeLink === true;
                    const processedUrl = cell.processedUrl || (cell.processedLinks && cell.processedLinks.url);
                    
                    if (originalUrl || wasLinkRemoved) {
                      const displayText = cell.formattedValue || "Link đã bị xóa";
                      const position = {
                        sheet: sheetTitle,
                        row: rowIndex,
                        col: cellIndex
                      };
                      
                      // Chuẩn bị thông tin link
                      const linkInfo = {
                        originalUrl: originalUrl || "Link đã bị xóa",
                        displayText,
                        position,
                        wasLinkRemoved,
                        isFakeLink
                      };
                      
                      // Phân loại link
                      if (processedUrl) {
                        linkInfo.processedUrl = processedUrl;
                        linkInfo.processedAt = cell.processedAt || (cell.processedLinks && cell.processedLinks.processedAt);
                        previewData.allLinks.processed.push(linkInfo);
                      } else {
                        previewData.allLinks.unprocessed.push(linkInfo);
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
    
    // Trước khi cập nhật dữ liệu, đảm bảo giữ lại thông tin processedDriveFiles hiện có
    newCourseData.processedDriveFiles = existingCourse.processedDriveFiles || [];
    
    // Thêm thông tin từ positionMap vào processedDriveFiles nếu chưa có
    // Việc này giúp lưu trữ thông tin vị trí cho các lần đồng bộ sau
    if (positionMap.size > 0) {
      console.log(`📝 [PATCH] Cập nhật thông tin vị trí vào processedDriveFiles`);
      
      // Lấy tất cả các entry từ positionMap, kể cả chưa xử lý
      // Chỉ cần đảm bảo có thông tin vị trí
      const allEntries = Array.from(positionMap.entries())
        .map(([key, value]) => {
          const parts = key.split('|');
          return {
            originalUrl: value.originalUrl,
            processedUrl: value.processedUrl, // Có thể null
            processedAt: value.processedAt, // Có thể null
            position: {
              sheet: parts[0],
              row: parseInt(parts[1]),
              col: parseInt(parts[2])
            }
          };
        });
      
      // Tạo Map cho các processedDriveFiles hiện có để dễ dàng tìm kiếm
      const existingFilesByPosition = {};
      newCourseData.processedDriveFiles.forEach(file => {
        if (file.position) {
          const posKey = `${file.position.sheet}|${file.position.row}|${file.position.col}`;
          existingFilesByPosition[posKey] = file;
        }
      });
      
      // Thêm hoặc cập nhật các entries
      allEntries.forEach(entry => {
        const posKey = `${entry.position.sheet}|${entry.position.row}|${entry.position.col}`;
        
        if (existingFilesByPosition[posKey]) {
          // Vị trí đã tồn tại, kiểm tra xem có cần cập nhật không
          const existingFile = existingFilesByPosition[posKey];
          
          // Chỉ cập nhật nếu có dữ liệu mới
          if (entry.processedUrl && entry.processedUrl !== existingFile.processedUrl) {
            existingFile.processedUrl = entry.processedUrl;
            existingFile.processedAt = entry.processedAt || new Date();
            console.log(`🔄 [PATCH] Đã cập nhật link đã xử lý cho vị trí ${posKey}`);
          }
          
          // Luôn cập nhật originalUrl mới (URL từ API)
          existingFile.originalUrl = entry.originalUrl;
        } 
        else if (!existingFilesByPosition[posKey]) {
          // Vị trí chưa tồn tại, thêm mới vào processedDriveFiles
          newCourseData.processedDriveFiles.push(entry);
          console.log(`➕ [PATCH] Đã thêm vị trí mới vào processedDriveFiles: ${posKey}`);
        }
      });
      
      console.log(`📊 [PATCH] processedDriveFiles sau khi cập nhật: ${newCourseData.processedDriveFiles.length} entries`);
    }
    
    // Đảm bảo dữ liệu processed links được lưu đúng cách
    // Chuyển đổi đối tượng sang chuỗi JSON và ngược lại để bảo toàn tất cả thuộc tính
    const serializedData = JSON.stringify(kimvanData);
    const deserializedData = JSON.parse(serializedData);
    newCourseData.originalData = deserializedData;
    
    console.log(`🔧 [PATCH] Dữ liệu đã được serialize để đảm bảo lưu đúng các link đã xử lý`);
    
    // Cập nhật thông tin về processedLinks cho previewData
    if (previewMode) {
      // Thống kê số lượng link giả mạo
      let fakeLinksCount = 0;
      let removedLinksCount = 0;
      let totalProcessedFakeLinks = 0;
      let totalProcessedRemovedLinks = 0;
      
      // Đếm trong processed links
      if (previewData.allLinks && previewData.allLinks.processed) {
        totalProcessedFakeLinks = previewData.allLinks.processed.filter(link => link.isFakeLink).length;
        totalProcessedRemovedLinks = previewData.allLinks.processed.filter(link => link.wasLinkRemoved).length;
        fakeLinksCount += totalProcessedFakeLinks;
        removedLinksCount += totalProcessedRemovedLinks;
      }
      
      // Đếm trong unprocessed links
      let totalUnprocessedFakeLinks = 0;
      let totalUnprocessedRemovedLinks = 0;
      if (previewData.allLinks && previewData.allLinks.unprocessed) {
        totalUnprocessedFakeLinks = previewData.allLinks.unprocessed.filter(link => link.isFakeLink).length;
        totalUnprocessedRemovedLinks = previewData.allLinks.unprocessed.filter(link => link.wasLinkRemoved).length;
        fakeLinksCount += totalUnprocessedFakeLinks;
        removedLinksCount += totalUnprocessedRemovedLinks;
      }
      
      // Thêm debug info
      previewData.debug = {
        positionMapInfo: {
          totalEntries: positionMap.size,
          processedEntries: Array.from(positionMap.values()).filter(v => v.isProcessed).length,
          sampleEntries: Array.from(positionMap.entries()).slice(0, 5).map(([key, value]) => ({
            key,
            originalUrl: value.originalUrl ? value.originalUrl.substring(0, 50) + '...' : null,
            processedUrl: value.processedUrl ? value.processedUrl.substring(0, 50) + '...' : null,
            isProcessed: value.isProcessed
          }))
        },
        matchingStats: {
          totalLinks,
          processedMatches: processedLinksInNewData,
          totalFakeLinks: fakeLinksCount,
          totalRemovedLinks: removedLinksCount,
          processedFakeLinks: totalProcessedFakeLinks,
          processedRemovedLinks: totalProcessedRemovedLinks,
          unprocessedFakeLinks: totalUnprocessedFakeLinks,
          unprocessedRemovedLinks: totalUnprocessedRemovedLinks
        }
      };
      
      // Thêm thông tin từ processedDriveFiles nếu có
      if (existingCourse.processedDriveFiles && Array.isArray(existingCourse.processedDriveFiles)) {
        console.log(`🔍 [PATCH] Đang thêm thông tin từ ${existingCourse.processedDriveFiles.length} processedDriveFiles vào previewData`);
        
        // Thêm debug info về processedDriveFiles
        previewData.debug.processedDriveFilesInfo = {
          totalFiles: existingCourse.processedDriveFiles.length,
          filesWithPosition: existingCourse.processedDriveFiles.filter(f => f.position).length,
          sampleFiles: existingCourse.processedDriveFiles.slice(0, 5).map(f => ({
            originalUrl: f.originalUrl ? f.originalUrl.substring(0, 50) + '...' : null,
            processedUrl: f.processedUrl ? f.processedUrl.substring(0, 50) + '...' : null,
            hasPosition: !!f.position,
            position: f.position ? `${f.position.sheet}|${f.position.row}|${f.position.col}` : null
          }))
        };
        
        // Chuyển đổi processedDriveFiles thành dạng phù hợp với previewData.processedLinks
        const additionalLinks = existingCourse.processedDriveFiles
          .filter(file => file.position && file.position.sheet && typeof file.position.row === 'number' && typeof file.position.col === 'number')
          .map(file => ({
            position: {
              key: `${file.position.sheet}|${file.position.row}|${file.position.col}`,
              sheet: file.position.sheet,
              row: file.position.row,
              col: file.position.col
            },
            originalUrl: file.originalUrl,
            processedUrl: file.processedUrl,
            processedAt: file.processedAt || new Date(),
            fromProcessedDriveFiles: true
          }));
        
        console.log(`✅ [PATCH] Đã tìm thấy ${additionalLinks.length} link có thông tin vị trí trong processedDriveFiles`);
        
        // Thêm vào previewData.processedLinks nếu chưa có
        if (additionalLinks.length > 0) {
          // Tạo Map từ processedLinks hiện có để dễ dàng kiểm tra trùng lặp
          const existingPositionKeys = new Set(
            previewData.processedLinks.map(link => `${link.position.sheet}|${link.position.row}|${link.position.col}`)
          );
          
          // Thêm các link không trùng lặp
          additionalLinks.forEach(link => {
            const posKey = `${link.position.sheet}|${link.position.row}|${link.position.col}`;
            if (!existingPositionKeys.has(posKey)) {
              previewData.processedLinks.push(link);
              console.log(`➕ [PATCH] Đã thêm link từ processedDriveFiles vào previewData.processedLinks: ${posKey}`);
            }
          });
          
          console.log(`📊 [PATCH] Tổng số link trong previewData.processedLinks sau khi cập nhật: ${previewData.processedLinks.length}`);
        }
      }
    }
    
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
        preservedProcessedFiles: positionMap.size,
        fakeLinksHandled: true,
        fakeLinksRemoved: true
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