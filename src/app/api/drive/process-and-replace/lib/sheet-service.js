import { google } from 'googleapis';
import { dbMiddleware } from '@/utils/db-middleware';
import Course from '@/models/Course';
import Sheet from '@/models/Sheet';

/**
 * Cập nhật link đã xử lý vào sheet
 * @param {string} courseId - ID của khóa học
 * @param {number} sheetIndex - Index của sheet trong khóa học
 * @param {number} rowIndex - Index của hàng cần cập nhật
 * @param {number} cellIndex - Index của ô cần cập nhật
 * @param {string} originalUrl - URL gốc
 * @param {string} newUrl - URL mới sau khi xử lý
 * @param {string} displayText - Text hiển thị (nếu có)
 * @param {Request} request - Request object từ Next.js
 * @returns {Promise<Object>} - Kết quả cập nhật
 */
export async function updateSheetCell(courseId, sheetIndex, rowIndex, cellIndex, originalUrl, newUrl, displayText = null, request) {
  console.log(`Cập nhật link trong sheet: Course=${courseId}, Sheet=${sheetIndex}, Row=${rowIndex}, Cell=${cellIndex}`);
  console.log(`URL gốc: ${originalUrl}`);
  console.log(`URL mới: ${newUrl}`);
  
  try {
    await dbMiddleware(request);
    
    // Tìm khóa học trong database
    const course = await Course.findById(courseId);
    if (!course) {
      console.error(`Không tìm thấy khóa học với ID: ${courseId}`);
      return {
        success: false,
        error: 'Không tìm thấy khóa học'
      };
    }
    
    // Kiểm tra dữ liệu sheet
    if (!course.originalData?.sheets || !course.originalData.sheets[sheetIndex]) {
      console.error(`Không tìm thấy sheet với index: ${sheetIndex}`);
      return {
        success: false,
        error: 'Không tìm thấy dữ liệu sheet'
      };
    }
    
    const sheet = course.originalData.sheets[sheetIndex];
    if (!sheet.data || !sheet.data[0] || !sheet.data[0].rowData || !sheet.data[0].rowData[rowIndex]) {
      console.error(`Không tìm thấy dữ liệu hàng cần cập nhật: Row=${rowIndex}`);
      return {
        success: false,
        error: 'Không tìm thấy dữ liệu hàng cần cập nhật'
      };
    }
    
    // Kiểm tra và tạo mảng values nếu chưa có
    if (!sheet.data[0].rowData[rowIndex].values) {
      sheet.data[0].rowData[rowIndex].values = [];
    }
    
    // Đảm bảo mảng values đủ dài để chứa cellIndex
    while (sheet.data[0].rowData[rowIndex].values.length <= cellIndex) {
      sheet.data[0].rowData[rowIndex].values.push({ formattedValue: '' });
    }
    
    // Lấy ô hiện tại
    const currentCell = sheet.data[0].rowData[rowIndex].values[cellIndex];
    
    // Xác định text hiển thị
    const cellText = displayText || currentCell.formattedValue || 'Tài liệu đã xử lý';
    
    // Lấy thời gian hiện tại để ghi chú
    const currentTime = new Date().toLocaleString('vi-VN');
    
    // Cập nhật dữ liệu ô với màu nổi bật hơn
    const updatedCell = {
      ...currentCell,
      formattedValue: cellText,
      hyperlink: newUrl,
      note: `Link gốc: ${originalUrl}\nĐã xử lý lúc: ${currentTime}`,
      userEnteredFormat: {
        ...(currentCell.userEnteredFormat || {}),
        backgroundColor: {
          red: 0.9,
          green: 0.6,  // Giảm green để màu nổi bật hơn (xanh dương đậm hơn)
          blue: 1.0
        },
        textFormat: {
          link: { uri: newUrl },
          foregroundColor: { 
            red: 0.0,
            green: 0.0,
            blue: 0.7  // Chữ màu xanh đậm
          },
          bold: true  // In đậm text
        }
      }
    };
    
    // Thêm thông tin về quá trình xử lý
    updatedCell.processedLinks = {
      originalUrl: originalUrl,
      processedUrl: newUrl,
      processedAt: new Date(),
      position: {
        sheet: sheet.properties?.title || `Sheet ${sheetIndex}`,
        row: rowIndex,
        col: cellIndex
      }
    };
    
    // Cập nhật ô trong sheet
    sheet.data[0].rowData[rowIndex].values[cellIndex] = updatedCell;
    
    // Đánh dấu là đã sửa đổi để mongoose lưu thay đổi
    course.markModified('originalData');
    
    // Lưu lại vào database
    await course.save();
    
    console.log(`✅ Đã cập nhật link trong sheet thành công`);
    
    return {
      success: true,
      message: 'Cập nhật ô thành công',
      updatedCell: {
        sheetIndex,
        rowIndex,
        cellIndex,
        displayText: cellText,
        originalUrl,
        newUrl
      }
    };
  } catch (error) {
    console.error('Lỗi khi cập nhật ô trong sheet:', error);
    return {
      success: false,
      error: `Lỗi khi cập nhật ô: ${error.message}`
    };
  }
}

/**
 * Cập nhật link trong Google Sheets API
 * @param {string} sheetId - ID của Google Sheet
 * @param {string} sheetName - Tên của sheet
 * @param {number} rowIndex - Index của hàng (0-based)
 * @param {number} colIndex - Index của cột (0-based)
 * @param {string} displayText - Text hiển thị
 * @param {string} url - URL cần thêm vào ô
 * @param {string} originalUrl - URL gốc trước khi xử lý
 * @param {Request} request - Request object từ Next.js
 * @returns {Promise<Object>} - Kết quả cập nhật
 */
export async function updateGoogleSheetCell(sheetId, sheetName, rowIndex, colIndex, displayText, url, originalUrl, request) {
  console.log(`Cập nhật trực tiếp vào Google Sheet: ID=${sheetId}, Sheet=${sheetName}, Row=${rowIndex + 1}, Col=${colIndex + 1}`);
  
  try {
    // Tìm sheet trong database để lấy thông tin xác thực
    await dbMiddleware(request);
    const sheet = await Sheet.findOne({ sheetId });
    
    if (!sheet) {
      console.error(`Không tìm thấy thông tin sheet với ID: ${sheetId}`);
      return {
        success: false,
        error: 'Không tìm thấy thông tin sheet'
      };
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: sheet.accessToken,
      refresh_token: sheet.refreshToken,
      expiry_date: sheet.expiryDate
    });
    
    // Tạo đối tượng sheets
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    
    // Tạo A1 notation cho ô cần cập nhật
    const cellA1Notation = `${sheetName}!${String.fromCharCode(65 + colIndex)}${rowIndex + 1}`;
    
    // Lấy thời gian hiện tại để ghi chú
    const currentTime = new Date().toLocaleString('vi-VN');
    
    // Cập nhật giá trị ô
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: cellA1Notation,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[displayText]]
      }
    });
    
    // Lấy sheetId thực tế từ API nếu không biết
    let actualSheetId = 0;
    try {
      const sheetInfo = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        ranges: [sheetName],
        fields: 'sheets.properties'
      });
      
      if (sheetInfo.data.sheets && sheetInfo.data.sheets[0].properties) {
        actualSheetId = sheetInfo.data.sheets[0].properties.sheetId;
        console.log(`Tìm thấy sheet ID thực tế: ${actualSheetId}`);
      }
    } catch (sheetLookupError) {
      console.warn(`Không tìm thấy sheet ID, sử dụng mặc định 0: ${sheetLookupError.message}`);
    }
    
    // Cập nhật định dạng hyperlink với màu nổi bật
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: actualSheetId,
                startRowIndex: rowIndex,
                endRowIndex: rowIndex + 1,
                startColumnIndex: colIndex,
                endColumnIndex: colIndex + 1
              },
              rows: [
                {
                  values: [
                    {
                      userEnteredValue: { stringValue: displayText },
                      userEnteredFormat: {
                        backgroundColor: {
                          red: 0.9,
                          green: 0.6,  // Giảm green để màu nổi bật hơn (xanh dương đậm hơn)
                          blue: 1.0
                        },
                        textFormat: {
                          link: { uri: url },
                          foregroundColor: { 
                            red: 0.0,
                            green: 0.0,
                            blue: 0.7  // Chữ màu xanh đậm
                          },
                          bold: true  // In đậm text
                        }
                      },
                      note: `Link gốc: ${originalUrl}\nĐã xử lý lúc: ${currentTime}`
                    }
                  ]
                }
              ],
              fields: 'userEnteredValue,userEnteredFormat.textFormat.link,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.textFormat.bold,userEnteredFormat.backgroundColor,note'
            }
          }
        ]
      }
    });
    
    console.log(`✅ Đã cập nhật trực tiếp vào Google Sheet thành công`);
    
    return {
      success: true,
      message: 'Cập nhật Google Sheet thành công'
    };
  } catch (error) {
    console.error('Lỗi khi cập nhật Google Sheet:', error);
    return {
      success: false,
      error: `Lỗi khi cập nhật Google Sheet: ${error.message}`
    };
  }
} 