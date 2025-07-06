import { NextResponse } from 'next/server';
import { decodeProxyLink } from '@/utils/proxy-utils';

// Hàm decodeBase64Url đã được thay thế bằng decodeProxyLink từ utils/proxy-utils.js

/**
 * Xử lý yêu cầu GET cho endpoint proxy-link
 * @param {Request} request - Yêu cầu HTTP
 * @param {Object} params - Tham số từ đường dẫn
 * @returns {Response} Phản hồi HTTP
 */
export async function GET(request, { params }) {
  try {
    // Lấy ID từ tham số đường dẫn
    const { id } = params;
    
    if (!id) {
      return NextResponse.json({ 
        error: 'Thiếu ID liên kết' 
      }, { status: 400 });
    }
    
    // Giải mã URL từ base64 sử dụng utility function
    const decodedUrl = decodeProxyLink(`/api/proxy-link/${id}`);
    
    if (!decodedUrl) {
      return NextResponse.json({ 
        error: 'Không thể giải mã liên kết' 
      }, { status: 400 });
    }
    
    console.log('Proxy Link:', { id, decodedUrl });
    
    // Kiểm tra loại URL để xử lý phù hợp
    if (decodedUrl.includes('youtube.com') || decodedUrl.includes('youtu.be')) {
      // Chuyển hướng đến YouTube
      return NextResponse.redirect(decodedUrl);
    } else if (decodedUrl.includes('drive.google.com')) {
      // Chuyển hướng đến Google Drive
      return NextResponse.redirect(decodedUrl);
    } else if (decodedUrl.toLowerCase().endsWith('.pdf')) {
      // Chuyển hướng đến file PDF
      return NextResponse.redirect(decodedUrl);
    } else {
      // Chuyển hướng đến URL khác
      return NextResponse.redirect(decodedUrl);
    }
  } catch (error) {
    console.error('Lỗi khi xử lý liên kết proxy:', error);
    return NextResponse.json({ 
      error: 'Lỗi khi xử lý liên kết proxy',
      message: error.message
    }, { status: 500 });
  }
} 