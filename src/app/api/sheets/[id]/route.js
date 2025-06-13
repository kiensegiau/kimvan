import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    let auth;
    
    // Kiểm tra xem có file credentials không
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      // Xác thực với file credentials
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      console.log('Sử dụng xác thực từ file credentials');
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      // Xác thực với biến môi trường
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
      console.log('Sử dụng xác thực từ biến môi trường');
    } else {
      throw new Error('Không tìm thấy thông tin xác thực Google API');
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Lấy thông tin về spreadsheet để biết tên của các sheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: id
    });
    
    // Lấy tên sheet đầu tiên hoặc sử dụng 'Sheet1' nếu không tìm thấy
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
    
    // Lấy dữ liệu từ sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: firstSheetName,
    });
    
    return NextResponse.json(response.data);
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu từ Google Sheets:', error);
    return NextResponse.json(
      { error: error.message || 'Không thể lấy dữ liệu từ Google Sheets' }, 
      { status: 500 }
    );
  }
} 