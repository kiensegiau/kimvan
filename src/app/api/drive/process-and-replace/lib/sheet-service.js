import { google } from 'googleapis';
import { dbMiddleware } from '@/utils/db-middleware';
import Course from '@/models/Course';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
export async function updateSheetCell(courseId, sheetIndex, rowIndex, cellIndex, originalUrl, newUrl, displayText, request, options = {}) {
  try {
    const { skipProcessing = false, originalLink = null, processedTime = null } = options;

    console.log(`\n📝 Cập nhật sheet sử dụng Google Sheets API trực tiếp:`);
    console.log(`- courseId: ${courseId}`);
    console.log(`- sheetIndex: ${sheetIndex}`);
    console.log(`- rowIndex: ${rowIndex}`);
    console.log(`- cellIndex: ${cellIndex}`);
    console.log(`- displayText: ${displayText}`);
    console.log(`- originalUrl: ${originalUrl}`);
    console.log(`- newUrl: ${newUrl || '(undefined)'}`);
    
    // Kiểm tra URL mới có tồn tại không
    if (!newUrl) {
      console.warn('⚠️ URL mới không được cung cấp, sử dụng URL gốc thay thế');
      newUrl = originalUrl || '#';
    }

    // Trước tiên lấy thông tin sheet từ database
    await dbMiddleware(request);
    const course = await Course.findById(courseId).populate('sheets');
    
    if (!course) {
      throw new Error(`Không tìm thấy khóa học với ID: ${courseId}`);
    }

    if (!course.sheets || !course.sheets[sheetIndex]) {
      throw new Error(`Không tìm thấy sheet với index: ${sheetIndex}`);
    }

    const sheet = course.sheets[sheetIndex];
    const sheetId = sheet.sheetId;
    const sheetName = sheet.name || `Sheet ${sheetIndex + 1}`;
    
    console.log(`🔍 Đã tìm thấy sheet: ${sheetName} (ID: ${sheetId})`);

    // Thiết lập Google Sheets API
    let auth;
    
    // Kiểm tra xem có file credentials không
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      // Xác thực với file credentials
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      // Xác thực với biến môi trường
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    } else {
      throw new Error('Không tìm thấy thông tin xác thực Google API');
    }
    
    const sheets = google.sheets({ version: 'v4', auth });

    // Lấy thông tin thực tế về sheet
    let actualSheetId = 0;
    try {
      const sheetInfo = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'sheets.properties'
      });
      
      if (sheetInfo.data.sheets && sheetInfo.data.sheets[0].properties) {
        actualSheetId = sheetInfo.data.sheets[0].properties.sheetId;
        console.log(`✅ Tìm thấy sheet ID thực tế: ${actualSheetId}`);
      }
    } catch (sheetLookupError) {
      console.warn(`⚠️ Không tìm thấy sheet ID, sử dụng mặc định 0: ${sheetLookupError.message}`);
    }

    // Lấy thời gian hiện tại để ghi chú
    const currentTime = new Date().toLocaleString('vi-VN');
    
    // Chuẩn bị ghi chú
    const noteContent = skipProcessing 
      ? `Link gốc: ${originalLink || originalUrl}\nĐã bỏ qua xử lý lúc: ${currentTime}\nLý do: File gốc từ khoahocshare6.0@gmail.com`
      : `Link gốc: ${originalUrl}\nĐã xử lý lúc: ${currentTime}`;

    // Sử dụng batchUpdate để cập nhật ô với đầy đủ định dạng và ghi chú
    console.log(`🔄 Cập nhật ô [${rowIndex + 1},${cellIndex + 1}] bằng batchUpdate...`);
    
    try {
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
                  startColumnIndex: cellIndex,
                  endColumnIndex: cellIndex + 1
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: displayText // Giữ nguyên text hiển thị
                        },
                        userEnteredFormat: {
                          backgroundColor: {
                            red: 0.9,
                            green: 0.6,  // Màu xanh dương nổi bật
                            blue: 1.0
                          },
                          textFormat: {
                            link: { uri: skipProcessing ? (originalLink || originalUrl) : newUrl },
                            foregroundColor: { 
                              red: 0.0,
                              green: 0.0,
                              blue: 0.7  // Chữ màu xanh đậm
                            },
                            bold: true  // In đậm text
                          }
                        },
                        note: noteContent
                      }
                    ]
                  }
                ],
                fields: 'userEnteredValue,userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.link,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.textFormat.bold,note'
              }
            }
          ]
        }
      });
      
      console.log(`✅ Cập nhật ô thành công!`);
      return {
        success: true,
        message: skipProcessing ? 'Đã cập nhật cell (bỏ qua xử lý)' : 'Đã cập nhật cell',
        sheetId: sheetId,
        rowIndex,
        cellIndex,
        displayText
      };
    } catch (batchUpdateError) {
      console.error(`❌ Lỗi khi sử dụng batchUpdate: ${batchUpdateError.message}`);
      
      // Phương pháp thay thế sử dụng values.update với HYPERLINK
      console.log(`⚠️ Thử phương pháp thay thế với values.update...`);
      
      try {
        // Tạo công thức hyperlink
        const formula = `=HYPERLINK("${skipProcessing ? (originalLink || originalUrl) : newUrl}","${displayText.replace(/"/g, '""')}")`;
        
        const cellLetter = String.fromCharCode(65 + cellIndex);
        const cellNumber = rowIndex + 1;
        
        // Cập nhật giá trị với công thức hyperlink
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${cellLetter}${cellNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[formula]]
          }
        });
        
        // Cập nhật định dạng và ghi chú riêng
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              updateCells: {
                range: {
                  sheetId: actualSheetId,
                  startRowIndex: rowIndex,
                  endRowIndex: rowIndex + 1,
                  startColumnIndex: cellIndex,
                  endColumnIndex: cellIndex + 1
                },
                rows: [{
                  values: [{
                    userEnteredFormat: {
                      backgroundColor: { red: 0.9, green: 0.6, blue: 1.0 },
                      textFormat: { bold: true }
                    },
                    note: noteContent
                  }]
                }],
                fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold,note'
              }
            }]
          }
        });
        
        console.log(`✅ Cập nhật ô thành công với phương pháp thay thế!`);
        return {
          success: true,
          message: 'Đã cập nhật cell với phương pháp thay thế',
          sheetId: sheetId,
          rowIndex,
          cellIndex,
          displayText
        };
      } catch (error) {
        console.error(`❌ Lỗi khi sử dụng phương pháp thay thế: ${error.message}`);
        throw error;
      }
    }
  } catch (error) {
    console.error(`❌ Lỗi khi cập nhật cell: ${error.message}`);
    return {
      success: false,
      error: `Lỗi khi cập nhật cell: ${error.message}`
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
export async function updateGoogleSheetCell(sheetId, sheetName, rowIndex, cellIndex, displayText, newUrl, originalUrl, request, options = {}) {
  try {
    const { skipProcessing = false, originalLink, processedTime } = options;
    
    console.log(`\n📝 Cập nhật Google Sheet trực tiếp với Google API:`);
    console.log(`- sheetId: ${sheetId}`);
    console.log(`- sheetName: ${sheetName || 'Không có tên'}`);
    console.log(`- rowIndex: ${rowIndex}`);
    console.log(`- cellIndex: ${cellIndex}`);
    console.log(`- displayText: ${displayText}`);
    console.log(`- originalUrl: ${originalUrl}`);
    console.log(`- newUrl: ${newUrl || '(undefined)'}`);

    // Kiểm tra URL mới có tồn tại không
    if (!newUrl) {
      console.warn('⚠️ URL mới không được cung cấp, sử dụng URL gốc thay thế');
      newUrl = originalUrl || '#';
    }

    // Thiết lập Google Sheets API
    let auth;
    
    // Kiểm tra xem có file credentials không
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      // Xác thực với file credentials
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      // Xác thực với biến môi trường
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
    } else {
      throw new Error('Không tìm thấy thông tin xác thực Google API');
    }
    
    const sheets = google.sheets({ version: 'v4', auth });

    // Lấy thông tin thực tế về sheet
    let actualSheetId = 0;
    try {
      const sheetInfo = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'sheets.properties'
      });
      
      if (sheetInfo.data.sheets && sheetInfo.data.sheets.length > 0) {
        // Tìm sheet có tên trùng với sheetName nếu có
        if (sheetName) {
          const targetSheet = sheetInfo.data.sheets.find(s => 
            s.properties && s.properties.title && s.properties.title.toLowerCase() === sheetName.toLowerCase()
          );
          
          if (targetSheet && targetSheet.properties) {
            actualSheetId = targetSheet.properties.sheetId;
            console.log(`✅ Tìm thấy sheet '${sheetName}' với ID: ${actualSheetId}`);
          } else {
            actualSheetId = sheetInfo.data.sheets[0].properties.sheetId;
            console.warn(`⚠️ Không tìm thấy sheet '${sheetName}', sử dụng sheet đầu tiên với ID: ${actualSheetId}`);
          }
        } else {
          actualSheetId = sheetInfo.data.sheets[0].properties.sheetId;
          console.log(`✅ Sử dụng sheet đầu tiên với ID: ${actualSheetId}`);
        }
      }
    } catch (sheetLookupError) {
      console.warn(`⚠️ Không thể lấy thông tin sheet, sử dụng ID mặc định 0: ${sheetLookupError.message}`);
    }

    // Lấy thời gian hiện tại để ghi chú
    const currentTime = new Date().toLocaleString('vi-VN');
    
    // Chuẩn bị ghi chú
    const noteContent = skipProcessing 
      ? `Link gốc: ${originalLink || originalUrl}\nĐã bỏ qua xử lý lúc: ${currentTime}\nLý do: File gốc từ khoahocshare6.0@gmail.com`
      : `Link gốc: ${originalUrl}\nĐã xử lý lúc: ${currentTime}`;

    // Sử dụng batchUpdate để cập nhật ô với đầy đủ định dạng và ghi chú
    console.log(`🔄 Cập nhật ô [${rowIndex + 1},${cellIndex + 1}] bằng batchUpdate...`);
    
    try {
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
                  startColumnIndex: cellIndex,
                  endColumnIndex: cellIndex + 1
                },
                rows: [
                  {
                    values: [
                      {
                        userEnteredValue: {
                          stringValue: displayText // Giữ nguyên text hiển thị
                        },
                        userEnteredFormat: {
                          backgroundColor: {
                            red: 0.9,
                            green: 0.6,  // Màu xanh dương nổi bật
                            blue: 1.0
                          },
                          textFormat: {
                            link: { uri: skipProcessing ? (originalLink || originalUrl) : newUrl },
                            foregroundColor: { 
                              red: 0.0,
                              green: 0.0,
                              blue: 0.7  // Chữ màu xanh đậm
                            },
                            bold: true  // In đậm text
                          }
                        },
                        note: noteContent
                      }
                    ]
                  }
                ],
                fields: 'userEnteredValue,userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.link,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.textFormat.bold,note'
              }
            }
          ]
        }
      });
      
      console.log(`✅ Cập nhật ô thành công!`);
      return {
        success: true,
        message: skipProcessing ? 'Đã cập nhật cell (bỏ qua xử lý)' : 'Đã cập nhật cell',
        sheetId,
        rowIndex,
        cellIndex,
        displayText
      };
    } catch (batchUpdateError) {
      console.error(`❌ Lỗi khi sử dụng batchUpdate: ${batchUpdateError.message}`);
      
      // Phương pháp thay thế sử dụng values.update với HYPERLINK
      console.log(`⚠️ Thử phương pháp thay thế với values.update...`);
      
      try {
        // Tạo công thức hyperlink
        const formula = `=HYPERLINK("${skipProcessing ? (originalLink || originalUrl) : newUrl}","${displayText.replace(/"/g, '""')}")`;
        
        const cellLetter = String.fromCharCode(65 + cellIndex);
        const cellNumber = rowIndex + 1;
        
        // Cập nhật giá trị với công thức hyperlink
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${sheetName ? `${sheetName}!` : ''}${cellLetter}${cellNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[formula]]
          }
        });
        
        // Cập nhật định dạng và ghi chú riêng
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              updateCells: {
                range: {
                  sheetId: actualSheetId,
                  startRowIndex: rowIndex,
                  endRowIndex: rowIndex + 1,
                  startColumnIndex: cellIndex,
                  endColumnIndex: cellIndex + 1
                },
                rows: [{
                  values: [{
                    userEnteredFormat: {
                      backgroundColor: { red: 0.9, green: 0.6, blue: 1.0 },
                      textFormat: { bold: true }
                    },
                    note: noteContent
                  }]
                }],
                fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold,note'
              }
            }]
          }
        });
        
        console.log(`✅ Cập nhật ô thành công với phương pháp thay thế!`);
        return {
          success: true,
          message: 'Đã cập nhật cell với phương pháp thay thế',
          sheetId,
          rowIndex,
          cellIndex,
          displayText
        };
      } catch (error) {
        console.error(`❌ Lỗi khi sử dụng phương pháp thay thế: ${error.message}`);
        throw error;
      }
    }
  } catch (error) {
    console.error(`❌ Lỗi khi cập nhật Google Sheet cell: ${error.message}`);
    return {
      success: false,
      error: `Lỗi khi cập nhật Google Sheet cell: ${error.message}`
    };
  }
} 