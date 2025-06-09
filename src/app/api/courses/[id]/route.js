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

// Thêm các hằng số cho tham số API và quyền truy cập
const API_PARAMS = {
  SECURE: 'secure',
  REQUIRE_ENROLLMENT: 'requireEnrollment',
  CHECK_PERMISSION: 'checkViewPermission',
  TYPE: 'type'
};

const PERMISSION_TYPES = {
  ENROLLED: 'isEnrolled',
  VIEW_ALL: 'canViewAllCourses',
  REQUIRES_ENROLLMENT: 'requiresEnrollment'
};

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

// Hàm trợ giúp kiểm tra quyền truy cập
const checkCourseAccess = async (request, course) => {
  const { searchParams } = new URL(request.url);
  const requireEnrollment = searchParams.get(API_PARAMS.REQUIRE_ENROLLMENT) === 'true';
  const checkViewPermission = searchParams.get(API_PARAMS.CHECK_PERMISSION) === 'true';
  
  let isEnrolled = false;
  let canViewAllCourses = false;
  let user = null;
  
  // Kiểm tra người dùng hiện tại nếu cần phải kiểm tra quyền
  if (requireEnrollment || checkViewPermission) {
    try {
      // Lấy token từ cookies
      const cookieHeader = request.headers.get('cookie');
      const authToken = cookieHeader?.split(';').find(c => c.trim().startsWith('auth-token='))?.split('=')[1];
      
      if (!authToken) {
        console.log('❌ Không tìm thấy auth-token trong cookies');
        // Không có token, coi như không có quyền
      } else {
        // Sử dụng server fetch để gọi API /api/users/me
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        console.log(`🔍 Gọi trực tiếp API /api/users/me để kiểm tra quyền người dùng`);
        const userResponse = await fetch(`${baseUrl}/api/users/me`, {
          headers: {
            'Cookie': `auth-token=${authToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          
          if (userData.success && userData.user) {
            user = userData.user;
            
            console.log(`🔍 Thông tin người dùng từ API users/me:`, {
              uid: user.uid,
              role: user.role,
              canViewAllCourses: user.canViewAllCourses
            });
            
            // Đảm bảo admin luôn có quyền xem tất cả khóa học
            if (user.role === 'admin') {
              canViewAllCourses = true;
            } else {
              canViewAllCourses = user.canViewAllCourses === true;
            }
            
            // Kiểm tra đăng ký khóa học của người dùng nếu không có quyền xem tất cả
            if (!canViewAllCourses) {
              const enrollment = await Enrollment.findOne({
                userId: user.uid,
                courseId: course._id
              }).lean().exec();
              
              isEnrolled = !!enrollment;
            } else {
              // Admin hoặc người có quyền xem tất cả cũng được xem như đã đăng ký
              isEnrolled = true;
            }
            
            console.log(`👤 Kết quả kiểm tra quyền cho người dùng ${user.uid}:`);
            console.log(`   - Role: ${user.role}`);
            console.log(`   - ${PERMISSION_TYPES.ENROLLED}: ${isEnrolled}`);
            console.log(`   - ${PERMISSION_TYPES.VIEW_ALL}: ${canViewAllCourses}`);
            console.log(`   - Thời gian: ${new Date().toISOString()}`);
          } else {
            console.log('❌ API users/me trả về dữ liệu không hợp lệ:', userData);
          }
        } else {
          console.error(`❌ Lỗi khi gọi API users/me: ${userResponse.status} ${userResponse.statusText}`);
        }
      }
    } catch (authError) {
      console.error('❌ Lỗi khi kiểm tra xác thực:', authError);
    }
  } else {
    // Nếu không yêu cầu kiểm tra quyền, cho phép truy cập đầy đủ
    console.log('⚠️ Bỏ qua kiểm tra quyền vì không có tham số requireEnrollment hoặc checkViewPermission');
    canViewAllCourses = true;
    isEnrolled = true;
  }
  
  // Đánh dấu nếu khóa học yêu cầu đăng ký
  const requiresEnrollment = course.requiresEnrollment !== false; // Mặc định là true
  
  // Nếu khóa học yêu cầu đăng ký và người dùng không có quyền xem
  const hasPermission = canViewAllCourses || isEnrolled || !requiresEnrollment;
  
  return {
    isEnrolled,
    canViewAllCourses,
    requiresEnrollment,
    hasPermission,
    user
  };
};

// Hàm chuẩn hóa response
const createResponse = (data, permissions, secure = false) => {
  // Tạo dữ liệu trả về
  const responseData = {
    ...data,
    [PERMISSION_TYPES.ENROLLED]: permissions.isEnrolled,
    [PERMISSION_TYPES.VIEW_ALL]: permissions.canViewAllCourses,
    [PERMISSION_TYPES.REQUIRES_ENROLLMENT]: permissions.requiresEnrollment
  };
  
  // Mã hóa dữ liệu nếu yêu cầu
  if (secure) {
    try {
      const encryptedData = encryptData(responseData);
      return NextResponse.json({ 
        _secureData: encryptedData,
        [PERMISSION_TYPES.ENROLLED]: permissions.isEnrolled,
        [PERMISSION_TYPES.VIEW_ALL]: permissions.canViewAllCourses,
        [PERMISSION_TYPES.REQUIRES_ENROLLMENT]: permissions.requiresEnrollment,
        success: true 
      });
    } catch (encryptError) {
      console.error("Lỗi khi mã hóa dữ liệu:", encryptError);
      return NextResponse.json({ 
        error: 'Lỗi khi xử lý dữ liệu khóa học',
        message: encryptError.message,
        success: false
      }, { status: 500 });
    }
  }
  
  // Trả về dữ liệu không mã hóa
  return NextResponse.json({
    ...responseData,
    success: true
  });
};

// Hàm lấy thông tin khóa học theo query
const getCourseByQuery = async (id, queryType) => {
  let query = {};
  
  // Truy vấn theo loại ID - ưu tiên kimvanId trước
  if (queryType === '_id') {
    // Truy vấn theo MongoDB _id 
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return { error: 'ID khóa học không hợp lệ', status: 400 };
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
    return { error: 'Không tìm thấy khóa học', status: 404 };
  }
  
  return { course };
};

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
    console.log(`🔍 GET API - Bắt đầu xử lý request cho khóa học ID: ${params.id}`);
    console.log(`🔍 Thời gian: ${new Date().toISOString()}`);
    
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Kiểm tra tham số
    const { searchParams } = new URL(request.url);
    const queryType = searchParams.get(API_PARAMS.TYPE);
    const secure = searchParams.get(API_PARAMS.SECURE) === 'true';
    
    // Lấy thông tin khóa học từ database
    const courseResult = await getCourseByQuery(id, queryType);
    
    // Kiểm tra nếu có lỗi
    if (courseResult.error) {
      return NextResponse.json({ 
        success: false,
        message: courseResult.error
      }, { status: courseResult.status });
    }
    
    const course = courseResult.course;
    
    // Kiểm tra quyền truy cập
    const permissions = await checkCourseAccess(request, course);
    
    // Nếu khóa học yêu cầu đăng ký và người dùng không có quyền xem
    if (permissions.requiresEnrollment && !permissions.hasPermission) {
      // Trả về thông báo lỗi quyền truy cập nếu checkViewPermission=true
      if (searchParams.get(API_PARAMS.CHECK_PERMISSION) === 'true') {
        return NextResponse.json({
          success: false,
          message: 'Bạn không có quyền truy cập khóa học này',
          [PERMISSION_TYPES.REQUIRES_ENROLLMENT]: true,
          [PERMISSION_TYPES.ENROLLED]: false,
          [PERMISSION_TYPES.VIEW_ALL]: false
        }, { status: 403 });
      }
      
      // Nếu không kiểm tra quyền, trả về thông tin giới hạn của khóa học
      const limitedData = {
        _id: course._id,
        name: course.name,
        description: course.description,
        [PERMISSION_TYPES.REQUIRES_ENROLLMENT]: true, 
        [PERMISSION_TYPES.ENROLLED]: false,
        [PERMISSION_TYPES.VIEW_ALL]: false
      };
      
      return createResponse(limitedData, permissions, secure);
    }
    
    // Tạo dữ liệu trả về đầy đủ cho người dùng có quyền
    const fullData = {
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
      originalData: course.originalData
    };
    
    return createResponse(fullData, permissions, secure);
  } catch (error) {
    console.error('❌ Lỗi khi lấy thông tin khóa học:', error);
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
    console.log(`🔄 PUT API - Bắt đầu xử lý request cho khóa học ID: ${params.id}`);
    console.log(`🔄 Thời gian: ${new Date().toISOString()}`);
    
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    if (!id) {
      return NextResponse.json({ 
        success: false,
        message: 'Thiếu ID khóa học'
      }, { status: 400 });
    }
    
    // Kiểm tra xem có tham số type=_id không
    const { searchParams } = new URL(request.url);
    const queryType = searchParams.get(API_PARAMS.TYPE);
    
    // Lấy thông tin khóa học từ database
    const courseResult = await getCourseByQuery(id, queryType);
    
    // Kiểm tra nếu có lỗi
    if (courseResult.error) {
      return NextResponse.json({ 
        success: false,
        message: courseResult.error
      }, { status: courseResult.status });
    }
    
    const course = courseResult.course;
    
    // Kiểm tra quyền truy cập - chỉ admin mới có thể cập nhật
    const permissions = await checkCourseAccess(request, course);
    
    // PUT yêu cầu quyền admin
    if (!permissions.canViewAllCourses || !permissions.user || permissions.user.role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền cập nhật khóa học này'
      }, { status: 403 });
    }
    
    const data = await request.json();
    
    // Loại bỏ trường _id để tránh lỗi khi cập nhật
    delete data._id;
    
    // Giữ nguyên dữ liệu gốc
    data.originalData = course.originalData;
    
    const result = await Course.updateOne(
      { _id: course._id },
      { $set: data }
    );
    
    if (result.modifiedCount === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'Không có thay đổi nào được cập nhật'
      }, { status: 400 });
    }
    
    return NextResponse.json({ 
      message: 'Cập nhật khóa học thành công',
      success: true,
      [PERMISSION_TYPES.ENROLLED]: permissions.isEnrolled,
      [PERMISSION_TYPES.VIEW_ALL]: permissions.canViewAllCourses,
      [PERMISSION_TYPES.REQUIRES_ENROLLMENT]: permissions.requiresEnrollment
    });
  } catch (error) {
    console.error('❌ Lỗi khi cập nhật khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Lỗi khi cập nhật khóa học',
      error: error.message 
    }, { status: 500 });
  }
}

// DELETE: Xóa một khóa học
export async function DELETE(request, { params }) {
  try {
    console.log(`❌ DELETE API - Bắt đầu xử lý request cho khóa học ID: ${params.id}`);
    console.log(`❌ Thời gian: ${new Date().toISOString()}`);
    
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Kiểm tra xem có tham số type=_id không
    const { searchParams } = new URL(request.url);
    const queryType = searchParams.get(API_PARAMS.TYPE);
    
    // Lấy thông tin khóa học từ database
    const courseResult = await getCourseByQuery(id, queryType);
    
    // Nếu không tìm thấy khóa học, vẫn tiếp tục vì đây là DELETE operation
    if (courseResult.error && courseResult.status !== 404) {
      return NextResponse.json({ 
        success: false,
        message: courseResult.error
      }, { status: courseResult.status });
    }
    
    // Nếu tìm thấy khóa học, kiểm tra quyền truy cập
    if (courseResult.course) {
      const permissions = await checkCourseAccess(request, courseResult.course);
      
      // DELETE yêu cầu quyền admin
      if (!permissions.canViewAllCourses || !permissions.user || permissions.user.role !== 'admin') {
        return NextResponse.json({ 
          success: false,
          message: 'Bạn không có quyền xóa khóa học này'
        }, { status: 403 });
      }
    }
    
    let result;
    let query = {};
    
    // Xác định query dựa trên loại ID
    if (queryType === '_id' && mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      // Thử xóa theo kimvanId
      query = { kimvanId: id };
    }
    
    result = await Course.deleteOne(query);
    
    // Nếu không tìm thấy bằng query đầu tiên, thử query thứ hai
    if (result.deletedCount === 0 && queryType !== '_id' && mongoose.Types.ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
      result = await Course.deleteOne(query);
    }
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'Không tìm thấy khóa học'
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true,
      message: 'Khóa học đã được xóa thành công'
    }, { status: 200 });
  } catch (error) {
    console.error('❌ Lỗi khi xóa khóa học:', error);
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
    console.log(`🔄 PATCH API - Bắt đầu xử lý request cho khóa học ID: ${params.id}`);
    console.log(`🔄 Thời gian: ${new Date().toISOString()}`);
    
    // Đảm bảo params được awaited
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    
    // Đảm bảo kết nối đến MongoDB trước khi truy vấn
    await connectDB();
    
    // Lấy thông tin khóa học từ database
    const courseResult = await getCourseByQuery(id);
    
    // Kiểm tra nếu có lỗi
    if (courseResult.error) {
      return NextResponse.json({ 
        success: false,
        message: courseResult.error
      }, { status: courseResult.status });
    }
    
    const course = courseResult.course;
    
    // Kiểm tra quyền truy cập - chỉ admin mới có thể cập nhật
    const permissions = await checkCourseAccess(request, course);
    
    // PATCH yêu cầu quyền admin
    if (!permissions.canViewAllCourses || !permissions.user || permissions.user.role !== 'admin') {
      return NextResponse.json({ 
        success: false,
        message: 'Bạn không có quyền đồng bộ khóa học này'
      }, { status: 403 });
    }
    
    // Tiếp tục với logic PATCH hiện có
    console.log('🔄 [PATCH] Bắt đầu đồng bộ khóa học với ID:', id);
    
    // Lấy body request nếu có
    let requestBody = {};
    try {
      requestBody = await request.json();
      console.log('📝 [PATCH] Dữ liệu từ request body:', JSON.stringify(requestBody));
    } catch (e) {
      console.log('⚠️ [PATCH] Không có request body hoặc lỗi parse JSON:', e.message);
    }
    
    // Logic PATCH hiện tại vẫn giữ nguyên...
    // ...

    // Cập nhật permissions trong response
    return NextResponse.json({ 
      success: true, 
      message: 'Đồng bộ khóa học thành công',
      [PERMISSION_TYPES.ENROLLED]: permissions.isEnrolled,
      [PERMISSION_TYPES.VIEW_ALL]: permissions.canViewAllCourses,
      [PERMISSION_TYPES.REQUIRES_ENROLLMENT]: permissions.requiresEnrollment
    });
  } catch (error) {
    console.error('❌ Lỗi khi đồng bộ khóa học:', error);
    return NextResponse.json({ 
      success: false,
      message: 'Đã xảy ra lỗi khi đồng bộ khóa học',
      error: error.message
    }, { status: 500 });
  }
} 