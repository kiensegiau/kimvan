import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';
import { google } from 'googleapis';
import fs from 'fs';

export async function PUT(request, { params }) {
  try {
    await dbMiddleware(request);
    const { id } = params;
    const { rowIndex, columnIndex, value, url } = await request.json();

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
        const updateCellRequest = {
          spreadsheetId: sheet.sheetId,
          resource: {
            requests: [
              {
                updateCells: {
                  range: {
                    sheetId: 0, // Assuming first sheet
                    startRowIndex: rowIndex - 1, // Adjust for 0-based index
                    endRowIndex: rowIndex,
                    startColumnIndex: columnIndex,
                    endColumnIndex: columnIndex + 1
                  },
                  rows: [
                    {
                      values: [
                        {
                          userEnteredValue: { stringValue: value },
                          userEnteredFormat: {
                            textFormat: {
                              link: { uri: url }
                            }
                          }
                        }
                      ]
                    }
                  ],
                  fields: 'userEnteredValue,userEnteredFormat.textFormat.link'
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