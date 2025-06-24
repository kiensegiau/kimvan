import { NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    // Kiểm tra xác thực người dùng
    const user = await authMiddleware(request);
    if (!user) {
      return generateErrorResponse('Unauthorized access', 401);
    }

    const { id } = params;
    
    if (!id) {
      return generateErrorResponse('Missing ID parameter', 400);
    }
    
    try {
      // Giải mã ID từ base64 để lấy URL gốc
      const originalUrl = Buffer.from(id, 'base64').toString('utf-8');
      
      // Kiểm tra URL có hợp lệ không
      try {
        new URL(originalUrl);
      } catch (e) {
        return generateErrorResponse('Invalid URL format', 400);
      }
      
      // Kiểm tra URL có phải là một loại URL an toàn không
      if (!isAllowedUrl(originalUrl)) {
        return generateErrorResponse('This URL type is not allowed', 403);
      }
      
      // Chuyển hướng đến URL gốc
      return NextResponse.redirect(originalUrl);
    } catch (e) {
      console.error('Error decoding URL:', e);
      return generateErrorResponse('Could not decode the URL', 400);
    }
  } catch (error) {
    console.error('Error processing proxy link:', error);
    return generateErrorResponse('Server error while processing the link', 500);
  }
}

// Kiểm tra URL có nằm trong danh sách cho phép không
function isAllowedUrl(url) {
  // Danh sách domain cho phép, có thể mở rộng theo nhu cầu
  const allowedDomains = [
    'google.com', 'drive.google.com', 'docs.google.com', 'youtube.com', 
    'youtu.be', 'vimeo.com', 'fb.watch', 'facebook.com',
    'thanhvienkhoahoc.net', 'dropbox.com', 'mega.nz'
  ];
  
  try {
    const urlObj = new URL(url);
    // Kiểm tra xem domain có nằm trong danh sách cho phép không
    return allowedDomains.some(domain => urlObj.hostname.endsWith(domain));
  } catch (e) {
    return false;
  }
}

// Tạo trang lỗi thân thiện
function generateErrorResponse(message, status) {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Link Error</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      background-color: #f7f9fc;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .error-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      padding: 40px;
      max-width: 500px;
      text-align: center;
    }
    .error-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #e53935;
      margin-bottom: 16px;
      font-size: 24px;
    }
    p {
      color: #546e7a;
      margin-bottom: 24px;
      font-size: 16px;
      line-height: 1.6;
    }
    .back-button {
      background-color: #4361ee;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 12px 24px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.3s;
    }
    .back-button:hover {
      background-color: #3a56d4;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">🔒</div>
    <h1>Link Error</h1>
    <p>${message}</p>
    <button class="back-button" onclick="window.history.back()">Go Back</button>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html' },
  });
} 