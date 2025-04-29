import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { stat, readFile } from 'fs/promises';

/**
 * API để download file từ thư mục temp
 * Phương thức: GET
 * Query params:
 * - file: Tên file cần download
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const fileName = url.searchParams.get('file');

    if (!fileName) {
      return NextResponse.json(
        { success: false, message: 'Thiếu tham số file' },
        { status: 400 }
      );
    }

    // Chỉ cho phép file trong thư mục temp
    const tempDir = path.join(process.cwd(), 'temp');
    const filePath = path.join(tempDir, fileName);

    // Kiểm tra xem file có tồn tại không
    try {
      await stat(filePath);
    } catch (error) {
      console.error(`File không tồn tại: ${filePath}`);
      return NextResponse.json(
        { success: false, message: 'File không tồn tại' },
        { status: 404 }
      );
    }

    // Đọc file
    const fileBuffer = await readFile(filePath);

    // Xác định Content-Type
    let contentType = 'application/octet-stream';
    const fileExt = path.extname(fileName).toLowerCase();
    
    if (fileExt === '.pdf') {
      contentType = 'application/pdf';
    } else if (fileExt === '.jpg' || fileExt === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (fileExt === '.png') {
      contentType = 'image/png';
    } else if (fileExt === '.mp4') {
      contentType = 'video/mp4';
    } else if (fileExt === '.mp3') {
      contentType = 'audio/mpeg';
    } else if (fileExt === '.docx') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (fileExt === '.xlsx') {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (fileExt === '.pptx') {
      contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (fileExt === '.zip') {
      contentType = 'application/zip';
    }

    // Tạo header cho response
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    headers.set('Content-Length', fileBuffer.length.toString());

    // Trả về file
    return new NextResponse(fileBuffer, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Lỗi khi download file:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
} 