import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    // Xác thực với Google API sử dụng Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
    });

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Lấy dữ liệu từ sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: id,
      range: 'Sheet1', // Có thể thay đổi tùy theo tên sheet của bạn
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