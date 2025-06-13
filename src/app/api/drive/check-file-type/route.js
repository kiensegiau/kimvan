/**
 * API kiểm tra loại nội dung của file Google Drive
 * 
 * API này sẽ:
 * 1. Nhận file ID
 * 2. Lấy thông tin từ Google Drive API
 * 3. Trả về loại nội dung (MIME type)
 * 
 * Tham số:
 * - fileId: ID của file Google Drive hoặc link đầy đủ
 */

import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { API_TOKEN } from '../remove-watermark/lib/config.js';
import { getTokenByType } from '../remove-watermark/lib/utils.js';
import fs from 'fs';
import { cookies } from 'next/headers';
import { cookieConfig } from '@/config/env-config';

// Hàm trích xuất Google Drive ID đơn giản hóa
function extractGoogleDriveFileId(url) {
  if (!url) {
    throw new Error('URL không hợp lệ');
  }
  
  // Format: https://drive.google.com/file/d/{fileId}/view
  const filePattern = /\/file\/d\/([^\/\?&]+)/;
  const fileMatch = url.match(filePattern);
  
  if (fileMatch && fileMatch[1]) {
    return { fileId: fileMatch[1].split('?')[0] };
  }
  
  // Format: https://drive.google.com/open?id={fileId}
  const openPattern = /[?&]id=([^&]+)/;
  const openMatch = url.match(openPattern);
  
  if (openMatch && openMatch[1]) {
    return { fileId: openMatch[1].split('&')[0] };
  }
  
  // Format: https://drive.google.com/drive/folders/{folderId}
  const folderPattern = /\/folders\/([^\/\?&]+)/;
  const folderMatch = url.match(folderPattern);
  
  if (folderMatch && folderMatch[1]) {
    return { fileId: folderMatch[1].split('?')[0] };
  }
  
  throw new Error('Không thể trích xuất ID từ URL Google Drive');
}

export async function POST(request) {
  try {
    console.log('🔍 API check-file-type: Bắt đầu xử lý request');
    
    // Lấy token từ cookie thay vì từ request body
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieConfig.authCookieName)?.value;
    const skipTokenValidation = true; // Luôn bỏ qua xác thực token không phụ thuộc vào môi trường

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
      console.log('✅ Đã parse JSON request body thành công');
    } catch (jsonError) {
      console.error('❌ Lỗi parse JSON request body:', jsonError.message);
      return NextResponse.json(
        { error: `Lỗi parse JSON request body: ${jsonError.message}` },
        { status: 400 }
      );
    }
    
    let { fileId, driveLink } = requestBody || {};

    // Hỗ trợ cả fileId và driveLink
    if (!fileId && driveLink) {
      try {
        console.log(`🔍 Trích xuất fileId từ driveLink: ${driveLink}`);
        const result = extractGoogleDriveFileId(driveLink);
        fileId = result.fileId;
        console.log(`✅ Đã trích xuất fileId: ${fileId}`);
      } catch (error) {
        console.error(`❌ Lỗi trích xuất fileId từ driveLink:`, error);
        return NextResponse.json(
          { error: `Không thể trích xuất ID từ link: ${error.message}` },
          { status: 400 }
        );
      }
    }

    // Validate fileId
    if (!fileId) {
      console.error('❌ Thiếu fileId trong request');
      return NextResponse.json(
        { error: 'Thiếu file ID.' },
        { status: 400 }
      );
    }

    // Trích xuất fileId nếu là URL đầy đủ
    if (typeof fileId === 'string' && fileId.includes('drive.google.com')) {
      try {
        console.log(`🔍 fileId là URL đầy đủ, trích xuất ID: ${fileId}`);
        const result = extractGoogleDriveFileId(fileId);
        fileId = result.fileId;
        console.log(`✅ Đã trích xuất fileId từ URL: ${fileId}`);
      } catch (error) {
        console.error(`❌ Lỗi trích xuất fileId từ URL:`, error);
        return NextResponse.json(
          { error: `Không thể trích xuất ID từ link: ${error.message}` },
          { status: 400 }
        );
      }
    }

    // Lấy token Google Drive
    const downloadToken = getTokenByType('download');
    if (!downloadToken) {
      console.error('❌ Không tìm thấy token Google Drive');
      return NextResponse.json(
        { error: 'Không tìm thấy token Google Drive.' },
        { status: 500 }
      );
    }

    // Khởi tạo OAuth2 client
    console.log('🔍 Khởi tạo OAuth2 client');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Thiết lập thông tin xác thực
    oauth2Client.setCredentials(downloadToken);

    // Xử lý refresh token nếu cần
    oauth2Client.on('tokens', (tokens) => {
      if (tokens.refresh_token) {
        const newToken = {...downloadToken, ...tokens};
        fs.writeFileSync(process.env.DOWNLOAD_TOKEN_PATH || './tokens/download_token.json', JSON.stringify(newToken));
      }
    });

    // Khởi tạo Google Drive API
    console.log(`🔍 Khởi tạo Google Drive API để kiểm tra file: ${fileId}`);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Lấy thông tin file
    console.log(`🔍 Gọi API Drive để lấy thông tin file: ${fileId}`);
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'id,name,mimeType,size,capabilities'
    });

    console.log(`✅ Đã lấy thông tin file thành công: ${fileMetadata.data.name} (${fileMetadata.data.mimeType})`);

    // Trả về kết quả
    return NextResponse.json({
      success: true,
      fileId: fileMetadata.data.id,
      fileName: fileMetadata.data.name,
      mimeType: fileMetadata.data.mimeType,
      size: fileMetadata.data.size || 0,
      isFolder: fileMetadata.data.mimeType === 'application/vnd.google-apps.folder',
      isPdf: fileMetadata.data.mimeType === 'application/pdf',
      isGoogleDoc: fileMetadata.data.mimeType.startsWith('application/vnd.google-apps.')
    });
    
  } catch (error) {
    console.error(`❌ Lỗi API check-file-type:`, error);
    
    // Log chi tiết lỗi để debug
    console.error(`*** CHI TIẾT LỖI CHECK-FILE-TYPE ***`);
    console.error(`- Message: ${error.message}`);
    console.error(`- Stack: ${error.stack}`);
    if (error.cause) {
      console.error(`- Cause: ${JSON.stringify(error.cause)}`);
    }
    console.error(`********************************`);
    
    return NextResponse.json(
      { 
        success: false,
        error: `Không thể kiểm tra loại file: ${error.message}`,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
} 