import { NextResponse } from 'next/server';

/**
 * API để lấy dữ liệu trang KimVan đã được mở
 * API này chỉ cung cấp HTML giúp hỗ trợ lấy cookie KimVan
 */
export async function GET(request) {
  return NextResponse.json({
    success: true,
    message: 'API hỗ trợ lấy cookie từ trình duyệt',
    instructions: [
      'Đăng nhập vào tài khoản KimVan trong cửa sổ trình duyệt',
      'Nhấn F12 hoặc chuột phải và chọn "Inspect" để mở DevTools',
      'Chuyển đến tab "Application"',
      'Ở cột bên trái, mở rộng mục "Cookies" và chọn "https://kimvan.id.vn"',
      'Tìm cookie có tên "__Secure-authjs.session-token"',
      'Sao chép giá trị của cookie này'
    ],
    javaScriptSnippet: `
      // Sao chép đoạn mã này vào Console tab để lấy cookie
      (function() {
        try {
          const cookies = document.cookie.split(';');
          const authCookie = cookies.find(c => c.trim().startsWith('__Secure-authjs.session-token='));
          if (authCookie) {
            const value = authCookie.split('=')[1];
            console.log('%cTìm thấy cookie KimVan:', 'color: green; font-weight: bold');
            console.log('%c' + value, 'background: #f0f0f0; padding: 5px; border-radius: 3px;');
            console.log('%cHãy sao chép giá trị trên và dán vào ô nhập cookie trong trang quản trị.', 'color: blue;');
            return value;
          } else {
            console.log('%cKhông tìm thấy cookie KimVan. Vui lòng đăng nhập trước.', 'color: red;');
            return null;
          }
        } catch (e) {
          console.error('Lỗi khi lấy cookie:', e);
          return null;
        }
      })();
    `
  });
}

/**
 * API để tạo HTML helper hỗ trợ lấy cookie KimVan
 * API này trả về trang HTML với các công cụ giúp việc lấy cookie dễ dàng hơn
 */
export async function POST(request) {
  // HTML helper giúp người dùng lấy cookie dễ dàng
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>KimVan Cookie Helper</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        h1 {
          color: #2563eb;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
        }
        .card {
          background: #f9fafb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border: 1px solid #e5e7eb;
        }
        .steps {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
        }
        .code-block {
          background: #1e293b;
          color: #e2e8f0;
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
          font-family: monospace;
          margin: 10px 0;
        }
        button {
          background: #2563eb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }
        button:hover {
          background: #1d4ed8;
        }
        .result {
          margin-top: 10px;
          padding: 10px;
          background: #ecfdf5;
          border: 1px solid #10b981;
          border-radius: 4px;
          display: none;
        }
        .error {
          background: #fef2f2;
          border-color: #ef4444;
        }
        .hidden {
          display: none;
        }
      </style>
    </head>
    <body>
      <h1>KimVan Cookie Helper</h1>
      
      <div class="card steps">
        <h3>Hướng dẫn lấy cookie KimVan</h3>
        <ol>
          <li>Đảm bảo bạn đã <a href="https://kimvan.id.vn/login" target="_blank">đăng nhập vào tài khoản KimVan</a> trong một tab khác</li>
          <li>Nhấn nút "Lấy cookie KimVan" bên dưới</li>
          <li>Sao chép giá trị cookie được hiển thị</li>
          <li>Dán giá trị vào ô nhập cookie trong trang quản trị</li>
        </ol>
      </div>
      
      <div class="card">
        <h3>Lấy cookie KimVan tự động</h3>
        <p>Nhấn nút dưới đây để tự động lấy cookie KimVan từ trình duyệt hiện tại:</p>
        <button id="getCookie">Lấy cookie KimVan</button>
        <div id="cookieResult" class="result">
          <p>Cookie KimVan:</p>
          <div id="cookieValue" class="code-block"></div>
          <button id="copyCookie">Sao chép</button>
          <span id="copyStatus" class="hidden">Đã sao chép!</span>
        </div>
        <div id="cookieError" class="result error hidden">
          <p>Không thể lấy cookie. Vui lòng đảm bảo bạn đã đăng nhập vào KimVan trong trình duyệt này.</p>
        </div>
      </div>
      
      <div class="card">
        <h3>Đoạn mã JavaScript</h3>
        <p>Nếu nút trên không hoạt động, bạn có thể sao chép đoạn mã sau và chạy trong Console tab của DevTools:</p>
        <div class="code-block">
          (function() {
            try {
              const cookies = document.cookie.split(';');
              const authCookie = cookies.find(c => c.trim().startsWith('__Secure-authjs.session-token='));
              if (authCookie) {
                const value = authCookie.split('=')[1];
                console.log('%cTìm thấy cookie KimVan:', 'color: green; font-weight: bold');
                console.log('%c' + value, 'background: #f0f0f0; padding: 5px; border-radius: 3px;');
                console.log('%cHãy sao chép giá trị trên và dán vào ô nhập cookie trong trang quản trị.', 'color: blue;');
                return value;
              } else {
                console.log('%cKhông tìm thấy cookie KimVan. Vui lòng đăng nhập trước.', 'color: red;');
                return null;
              }
            } catch (e) {
              console.error('Lỗi khi lấy cookie:', e);
              return null;
            }
          })();
        </div>
        <button id="copyScript">Sao chép đoạn mã</button>
        <span id="copyScriptStatus" class="hidden">Đã sao chép!</span>
      </div>
      
      <script>
        document.getElementById('getCookie').addEventListener('click', function() {
          try {
            const cookies = document.cookie.split(';');
            const authCookie = cookies.find(c => c.trim().startsWith('__Secure-authjs.session-token='));
            
            if (authCookie) {
              const value = authCookie.split('=')[1];
              document.getElementById('cookieValue').textContent = value;
              document.getElementById('cookieResult').style.display = 'block';
              document.getElementById('cookieError').classList.add('hidden');
            } else {
              document.getElementById('cookieError').classList.remove('hidden');
              document.getElementById('cookieResult').style.display = 'none';
            }
          } catch (e) {
            console.error('Lỗi khi lấy cookie:', e);
            document.getElementById('cookieError').classList.remove('hidden');
            document.getElementById('cookieResult').style.display = 'none';
          }
        });
        
        document.getElementById('copyCookie').addEventListener('click', function() {
          const cookieValue = document.getElementById('cookieValue').textContent;
          navigator.clipboard.writeText(cookieValue).then(function() {
            const status = document.getElementById('copyStatus');
            status.classList.remove('hidden');
            setTimeout(function() {
              status.classList.add('hidden');
            }, 2000);
          });
        });
        
        document.getElementById('copyScript').addEventListener('click', function() {
          const scriptCode = document.querySelector('.code-block').textContent;
          navigator.clipboard.writeText(scriptCode).then(function() {
            const status = document.getElementById('copyScriptStatus');
            status.classList.remove('hidden');
            setTimeout(function() {
              status.classList.add('hidden');
            }, 2000);
          });
        });
      </script>
    </body>
    </html>
  `;

  return new NextResponse(htmlContent, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
} 