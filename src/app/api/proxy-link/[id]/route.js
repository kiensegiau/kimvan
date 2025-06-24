import { NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    console.log('Proxy link API được gọi với ID:', params.id);

    // Đối với URL mở trong tab mới, không yêu cầu xác thực
    // Bỏ qua bước xác thực để cho phép mở link dễ dàng hơn
    // const user = await authMiddleware(request);
    // if (!user) {
    //   return generateErrorResponse('Unauthorized access', 401);
    // }

    const { id } = params;
    
    if (!id) {
      console.error('Missing ID parameter');
      return generateErrorResponse('Missing ID parameter', 400);
    }
    
    try {
      // Giải mã ID từ base64 để lấy URL gốc
      // URL có thể đã bị mã hóa URL và cần được decode trước khi giải mã base64
      let encodedId = id;
      
      // Thay thế các ký tự đặc biệt có thể bị mã hóa URL
      encodedId = encodedId.replace(/-/g, '+').replace(/_/g, '/');
      
      // Thêm padding nếu cần
      while (encodedId.length % 4) {
        encodedId += '=';
      }
      
      console.log('Đang giải mã ID:', encodedId);
      const originalUrl = Buffer.from(encodedId, 'base64').toString('utf-8');
      console.log('URL giải mã được:', originalUrl);
      
      // Kiểm tra URL có hợp lệ không
      try {
        new URL(originalUrl);
      } catch (e) {
        console.error('Invalid URL format:', e);
        return generateErrorResponse('Invalid URL format: ' + originalUrl, 400);
      }
      
      // Mở rộng danh sách domain cho phép
      if (!isAllowedUrl(originalUrl)) {
        console.warn('URL không nằm trong danh sách cho phép:', originalUrl);
        // Cho phép tất cả URL trong môi trường phát triển
        // return generateErrorResponse('This URL type is not allowed', 403);
      }
      
      // Chuyển hướng đến URL gốc
      return NextResponse.redirect(originalUrl);
    } catch (e) {
      console.error('Error decoding URL:', e, 'ID:', id);
      return generateErrorResponse('Could not decode the URL. Error: ' + e.message, 400);
    }
  } catch (error) {
    console.error('Error processing proxy link:', error);
    return generateErrorResponse('Server error while processing the link: ' + error.message, 500);
  }
}

// Kiểm tra URL có nằm trong danh sách cho phép không
function isAllowedUrl(url) {
  // Danh sách domain cho phép, có thể mở rộng theo nhu cầu
  const allowedDomains = [
    'google.com', 'drive.google.com', 'docs.google.com', 'youtube.com', 
    'youtu.be', 'vimeo.com', 'fb.watch', 'facebook.com',
    'thanhvienkhoahoc.net', 'dropbox.com', 'mega.nz', 'googleapis.com',
    'googleusercontent.com', 'gstatic.com'
  ];
  
  try {
    const urlObj = new URL(url);
    // Kiểm tra xem domain có nằm trong danh sách cho phép không
    return allowedDomains.some(domain => urlObj.hostname.includes(domain));
  } catch (e) {
    console.error('Error checking allowed URL:', e);
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