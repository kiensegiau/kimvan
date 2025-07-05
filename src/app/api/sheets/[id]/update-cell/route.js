import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';
import { google } from 'googleapis';
import fs from 'fs';

export async function PUT(request, { params }) {
  try {
    await dbMiddleware(request);
    const { id } = await params;
    const { rowIndex, columnIndex, value, url, originalUrl } = await request.json();

    // Find the sheet in the database
    let sheet;
    if (ObjectId.isValid(id)) {
      sheet = await Sheet.findById(id);
    } else {
      // If not an ObjectId, assume it's a sheetId
      sheet = await Sheet.findOne({ sheetId: id });
    }

    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy sheet' }, 
        { status: 404 }
      );
    }

    // Update the sheet data in Google Sheets API
    try {
      // Set up authentication using the same method as fetchSheetData
      let auth;
      
      // Kiểm tra xem có file credentials không
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      console.log('Đường dẫn credentials:', credentialsPath);
      
      if (credentialsPath && fs.existsSync(credentialsPath)) {
        // Xác thực với file credentials
        auth = new google.auth.GoogleAuth({
          keyFile: credentialsPath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        console.log('Sử dụng xác thực từ file credentials');
      } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
        // Xác thực với biến môi trường
        auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
          },
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        console.log('Sử dụng xác thực từ biến môi trường');
      } else {
        console.error('Không tìm thấy thông tin xác thực Google API');
        throw new Error('Không tìm thấy thông tin xác thực Google API');
      }
      
      const sheets = google.sheets({ version: 'v4', auth });

      // Lấy thông tin thực tế về sheet
      let actualSheetId = 0;
      try {
        const sheetInfo = await sheets.spreadsheets.get({
          spreadsheetId: sheet.sheetId,
          fields: 'sheets.properties'
        });
        
        if (sheetInfo.data.sheets && sheetInfo.data.sheets[0].properties) {
          actualSheetId = sheetInfo.data.sheets[0].properties.sheetId;
          console.log(`Tìm thấy sheet ID thực tế: ${actualSheetId}`);
        }
      } catch (sheetLookupError) {
        console.warn(`Không tìm thấy sheet ID, sử dụng mặc định 0: ${sheetLookupError.message}`);
      }

      // Convert to A1 notation (column letters + row number)
      const columnLetter = String.fromCharCode(65 + columnIndex); // A=65, B=66, etc.
      const rowNumber = rowIndex + 1; // 0-indexed to 1-indexed
      const cellRange = `${columnLetter}${rowNumber}`;

      console.log(`Cập nhật ô ${cellRange} với giá trị: ${value}`);

      // Prepare the update request
      let updateRequest = {
        spreadsheetId: sheet.sheetId,
        range: cellRange,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[value]]
        }
      };

      // Update the cell value
      await sheets.spreadsheets.values.update(updateRequest);

      // If URL is provided, update the cell hyperlink
      if (url) {
        console.log(`Thêm hyperlink: ${url}`);
        
        // Lấy thời gian hiện tại để ghi chú
        const currentTime = new Date().toLocaleString('vi-VN');
        
        // Tạo ghi chú với URL gốc nếu có hoặc ghi chú đơn giản nếu không có
        const noteText = originalUrl 
          ? `Link gốc: ${originalUrl}\nĐã xử lý lúc: ${currentTime}` 
          : `Đã cập nhật lúc: ${currentTime}`;
        
        const updateCellRequest = {
          spreadsheetId: sheet.sheetId,
          resource: {
            requests: [
              {
                updateCells: {
                  range: {
                    sheetId: actualSheetId, // Sử dụng sheet ID thực tế thay vì mặc định 0
                    startRowIndex: rowIndex,
                    endRowIndex: rowIndex + 1,
                    startColumnIndex: columnIndex,
                    endColumnIndex: columnIndex + 1
                  },
                  rows: [
                    {
                      values: [
                        {
                          userEnteredValue: { stringValue: value },
                          userEnteredFormat: {
                            backgroundColor: {
                              red: 0.9,
                              green: 0.6,  // Màu xanh dương nổi bật
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
                          note: noteText
                        }
                      ]
                    }
                  ],
                  fields: 'userEnteredValue,userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.link,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.textFormat.bold,note'
                }
              }
            ]
          }
        };

        await sheets.spreadsheets.batchUpdate(updateCellRequest);
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Đã cập nhật ô thành công'
      });
    } catch (error) {
      console.error('Lỗi khi cập nhật dữ liệu Google Sheets:', error);
      return NextResponse.json(
        { success: false, error: `Lỗi khi cập nhật Google Sheets: ${error.message}` }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật ô:', error);
    return NextResponse.json(
      { success: false, error: `Không thể cập nhật ô: ${error.message}` }, 
      { status: 500 }
    );
  }
} 