import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const { method } = await request.json();
    
    if (!id) {
      return NextResponse.json(
        { success: false, message: 'ID khóa học không hợp lệ' },
        { status: 400 }
      );
    }
    
    if (!method) {
      return NextResponse.json(
        { success: false, message: 'Phương thức xử lý không được cung cấp' },
        { status: 400 }
      );
    }
    
    // Kết nối với cơ sở dữ liệu MongoDB
    const { db } = await connectToDatabase();
    
    // Lấy dữ liệu khóa học
    const course = await db.collection('courses').findOne({ 
      _id: new ObjectId(id) 
    });
    
    if (!course) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy khóa học' },
        { status: 404 }
      );
    }
    
    // Xử lý dữ liệu dựa trên phương thức
    let processedData = {};
    let updateFields = {};
    let processingMessage = '';
    
    switch (method) {
      case 'normalize_data':
        // Chuẩn hóa dữ liệu
        processedData = normalizeData(course);
        updateFields = {
          ...processedData,
          updatedAt: new Date()
        };
        processingMessage = 'Chuẩn hóa dữ liệu khóa học thành công';
        break;
        
      case 'reindex_sheets':
        // Đánh chỉ mục lại sheets
        processedData = reindexSheets(course);
        updateFields = {
          originalData: processedData,
          updatedAt: new Date()
        };
        processingMessage = 'Đánh chỉ mục lại sheets thành công';
        break;
        
      case 'clean_urls':
        // Làm sạch URLs
        processedData = cleanUrls(course);
        updateFields = {
          originalData: processedData,
          updatedAt: new Date()
        };
        processingMessage = 'Làm sạch URLs thành công';
        break;
        
      case 'validate_links':
        // Kiểm tra links
        processedData = await validateLinks(course);
        updateFields = {
          originalData: processedData,
          updatedAt: new Date()
        };
        processingMessage = 'Kiểm tra links thành công';
        break;
        
      case 'extract_metadata':
        // Trích xuất metadata
        processedData = extractMetadata(course);
        updateFields = {
          metadata: processedData,
          updatedAt: new Date()
        };
        processingMessage = 'Trích xuất metadata thành công';
        break;
        
      default:
        return NextResponse.json(
          { success: false, message: 'Phương thức xử lý không được hỗ trợ' },
          { status: 400 }
        );
    }
    
    // Cập nhật khóa học với dữ liệu đã xử lý
    const updateResult = await db.collection('courses').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );
    
    if (updateResult.modifiedCount === 0) {
      return NextResponse.json(
        { success: false, message: 'Không thể cập nhật khóa học' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: processingMessage,
      summary: {
        method: method,
        courseId: id,
        timeProcessed: new Date()
      }
    });
  } catch (error) {
    console.error('Lỗi khi xử lý dữ liệu khóa học:', error);
    return NextResponse.json(
      { success: false, message: `Đã xảy ra lỗi: ${error.message}` },
      { status: 500 }
    );
  }
}

// HELPER FUNCTIONS FOR DATA PROCESSING

// Hàm chuẩn hóa dữ liệu
function normalizeData(course) {
  // Chuẩn hóa tên và mô tả
  let normalizedName = course.name ? course.name.trim() : '';
  let normalizedDescription = course.description ? course.description.trim() : '';
  
  // Chuẩn hóa giá (đảm bảo là số)
  let normalizedPrice = typeof course.price === 'number' ? course.price : parseInt(course.price) || 0;
  
  // Chuẩn hóa trạng thái
  let normalizedStatus = ['active', 'inactive'].includes(course.status) ? course.status : 'inactive';
  
  return {
    name: normalizedName,
    description: normalizedDescription,
    price: normalizedPrice,
    status: normalizedStatus
  };
}

// Hàm đánh chỉ mục lại sheets
function reindexSheets(course) {
  if (!course.originalData || !course.originalData.sheets) {
    return course.originalData;
  }
  
  const originalData = { ...course.originalData };
  
  // Đánh số thứ tự cho sheets
  originalData.sheets = originalData.sheets.map((sheet, index) => {
    if (sheet.properties) {
      sheet.properties.index = index;
    }
    return sheet;
  });
  
  return originalData;
}

// Hàm làm sạch URLs
function cleanUrls(course) {
  if (!course.originalData || !course.originalData.sheets) {
    return course.originalData;
  }
  
  const originalData = JSON.parse(JSON.stringify(course.originalData));
  
  // Duyệt qua từng sheet
  originalData.sheets.forEach(sheet => {
    if (sheet.data && sheet.data.length > 0) {
      sheet.data.forEach(data => {
        if (data.rowData && data.rowData.length > 0) {
          // Bỏ qua dòng đầu tiên (header)
          for (let i = 1; i < data.rowData.length; i++) {
            const row = data.rowData[i];
            if (row.values) {
              row.values.forEach(cell => {
                // Làm sạch URLs
                if (cell.userEnteredFormat && cell.userEnteredFormat.textFormat && cell.userEnteredFormat.textFormat.link) {
                  const url = cell.userEnteredFormat.textFormat.link.uri;
                  if (url) {
                    // Xóa bỏ khoảng trắng ở đầu và cuối URL
                    cell.userEnteredFormat.textFormat.link.uri = url.trim();
                    
                    // Thêm https:// nếu bị thiếu
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                      cell.userEnteredFormat.textFormat.link.uri = 'https://' + url.trim();
                    }
                  }
                }
                
                // Kiểm tra hyperlink
                if (cell.hyperlink) {
                  const url = cell.hyperlink;
                  if (url) {
                    // Xóa bỏ khoảng trắng ở đầu và cuối URL
                    cell.hyperlink = url.trim();
                    
                    // Thêm https:// nếu bị thiếu
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                      cell.hyperlink = 'https://' + url.trim();
                    }
                  }
                }
              });
            }
          }
        }
      });
    }
  });
  
  return originalData;
}

// Hàm kiểm tra links
async function validateLinks(course) {
  if (!course.originalData || !course.originalData.sheets) {
    return course.originalData;
  }
  
  const originalData = JSON.parse(JSON.stringify(course.originalData));
  
  // Danh sách các URLs cần kiểm tra
  const urlsToCheck = [];
  
  // Duyệt qua từng sheet để thu thập URLs
  originalData.sheets.forEach(sheet => {
    if (sheet.data && sheet.data.length > 0) {
      sheet.data.forEach(data => {
        if (data.rowData && data.rowData.length > 0) {
          // Bỏ qua dòng đầu tiên (header)
          for (let i = 1; i < data.rowData.length; i++) {
            const row = data.rowData[i];
            if (row.values) {
              row.values.forEach(cell => {
                // Thu thập URLs từ textFormat.link
                if (cell.userEnteredFormat && cell.userEnteredFormat.textFormat && cell.userEnteredFormat.textFormat.link) {
                  const url = cell.userEnteredFormat.textFormat.link.uri;
                  if (url && !urlsToCheck.some(item => item.url === url)) {
                    urlsToCheck.push({
                      url,
                      type: 'textFormat',
                      cell
                    });
                  }
                }
                
                // Thu thập URLs từ hyperlink
                if (cell.hyperlink) {
                  const url = cell.hyperlink;
                  if (url && !urlsToCheck.some(item => item.url === url)) {
                    urlsToCheck.push({
                      url,
                      type: 'hyperlink',
                      cell
                    });
                  }
                }
              });
            }
          }
        }
      });
    }
  });
  
  // Giới hạn số lượng URLs kiểm tra (để tránh quá tải)
  const limitedUrls = urlsToCheck.slice(0, 50);
  
  // Metadata chứa thông tin về kết quả kiểm tra
  if (!originalData.metadata) {
    originalData.metadata = {};
  }
  
  originalData.metadata.linkValidation = {
    totalLinks: urlsToCheck.length,
    checkedLinks: limitedUrls.length,
    timestamp: new Date().toISOString(),
    details: {}
  };
  
  // Chỉ thực hiện kiểm tra URLs nếu có URLs
  if (limitedUrls.length > 0) {
    // Sử dụng Promise.all để gửi các yêu cầu đồng thời
    const checkResults = await Promise.allSettled(limitedUrls.map(async (item) => {
      try {
        const { url } = item;
        // Kiểm tra URL (chỉ HEAD request để tiết kiệm băng thông)
        const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
        return {
          url,
          valid: response.ok,
          status: response.status,
          statusText: response.statusText
        };
      } catch (error) {
        return {
          url: item.url,
          valid: false,
          error: error.message
        };
      }
    }));
    
    // Lưu kết quả kiểm tra vào metadata
    checkResults.forEach(result => {
      if (result.status === 'fulfilled') {
        originalData.metadata.linkValidation.details[result.value.url] = {
          valid: result.value.valid,
          status: result.value.status,
          statusText: result.value.statusText,
          error: result.value.error
        };
      } else {
        originalData.metadata.linkValidation.details[result.reason.url] = {
          valid: false,
          error: 'Lỗi khi kiểm tra URL: ' + result.reason
        };
      }
    });
  }
  
  return originalData;
}

// Hàm trích xuất metadata
function extractMetadata(course) {
  const metadata = {
    timeExtracted: new Date().toISOString(),
    courseName: course.name,
    courseId: course._id.toString(),
    sheets: []
  };
  
  // Trích xuất metadata từ originalData nếu có
  if (course.originalData && course.originalData.sheets) {
    // Tính tổng số sheet và bài học
    metadata.totalSheets = course.originalData.sheets.length;
    let totalLessons = 0;
    
    course.originalData.sheets.forEach((sheet, sheetIndex) => {
      const sheetMeta = {
        title: sheet.properties ? sheet.properties.title : `Khóa ${sheetIndex + 1}`,
        index: sheetIndex,
        lessons: 0,
        links: {
          youtube: 0,
          pdf: 0,
          drive: 0,
          other: 0
        }
      };
      
      // Đếm số bài học và links trong sheet
      if (sheet.data && sheet.data.length > 0) {
        sheet.data.forEach(data => {
          if (data.rowData && data.rowData.length > 0) {
            // Bỏ qua dòng đầu tiên (header)
            sheetMeta.lessons = data.rowData.length - 1;
            totalLessons += sheetMeta.lessons;
            
            // Đếm các loại links
            for (let i = 1; i < data.rowData.length; i++) {
              const row = data.rowData[i];
              if (row.values) {
                row.values.forEach(cell => {
                  // Kiểm tra link từ textFormat
                  if (cell.userEnteredFormat && cell.userEnteredFormat.textFormat && cell.userEnteredFormat.textFormat.link) {
                    const url = cell.userEnteredFormat.textFormat.link.uri;
                    if (url) {
                      if (url.includes('youtube.com') || url.includes('youtu.be')) {
                        sheetMeta.links.youtube++;
                      } else if (url.toLowerCase().endsWith('.pdf')) {
                        sheetMeta.links.pdf++;
                      } else if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
                        sheetMeta.links.drive++;
                      } else {
                        sheetMeta.links.other++;
                      }
                    }
                  }
                  
                  // Kiểm tra link từ hyperlink
                  if (cell.hyperlink) {
                    const url = cell.hyperlink;
                    if (url) {
                      if (url.includes('youtube.com') || url.includes('youtu.be')) {
                        sheetMeta.links.youtube++;
                      } else if (url.toLowerCase().endsWith('.pdf')) {
                        sheetMeta.links.pdf++;
                      } else if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
                        sheetMeta.links.drive++;
                      } else {
                        sheetMeta.links.other++;
                      }
                    }
                  }
                });
              }
            }
          }
        });
      }
      
      metadata.sheets.push(sheetMeta);
    });
    
    metadata.totalLessons = totalLessons;
    
    // Tính tổng số links theo loại
    metadata.totalLinks = {
      youtube: metadata.sheets.reduce((sum, sheet) => sum + sheet.links.youtube, 0),
      pdf: metadata.sheets.reduce((sum, sheet) => sum + sheet.links.pdf, 0),
      drive: metadata.sheets.reduce((sum, sheet) => sum + sheet.links.drive, 0),
      other: metadata.sheets.reduce((sum, sheet) => sum + sheet.links.other, 0)
    };
    
    metadata.totalLinks.all = 
      metadata.totalLinks.youtube + 
      metadata.totalLinks.pdf + 
      metadata.totalLinks.drive + 
      metadata.totalLinks.other;
  }
  
  return metadata;
} 