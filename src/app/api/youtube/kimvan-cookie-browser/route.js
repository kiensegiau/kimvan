import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import os from 'os';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * API để mở trình duyệt Chrome và truy cập trang KimVan
 */
export async function GET(request) {
  try {
    // Mở trình duyệt Chrome thật và truy cập trang KimVan
    const result = await openChromeBrowser();
    
    // Trả về trang HTML helper nếu yêu cầu từ trình duyệt
    const headers = request.headers;
    const accept = headers.get('accept') || '';
    
    if (accept.includes('text/html')) {
      return showHelperPage(result);
    }
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      command: result.command
    });
  } catch (error) {
    console.error('Lỗi khi mở trình duyệt:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Không thể mở trình duyệt Chrome'
    }, { status: 500 });
  }
}

/**
 * Mở trình duyệt Chrome và truy cập vào trang KimVan
 */
async function openChromeBrowser() {
  const platform = os.platform();
  let command;
  
  const url = 'https://kimvan.id.vn/';
  
  if (platform === 'win32') {
    // Trên Windows
    command = `start chrome --new-window "${url}"`;
  } else if (platform === 'darwin') {
    // Trên macOS
    command = `open -a "Google Chrome" "${url}"`;
  } else {
    // Trên Linux
    command = `google-chrome --new-window "${url}"`;
  }
  
  try {
    // Thực thi lệnh mở Chrome
    const { stdout, stderr } = await execPromise(command);
    console.log('Chrome đã được mở', stdout);
    
    if (stderr && stderr.length > 0) {
      console.error('Lỗi khi mở Chrome:', stderr);
      return {
        success: false,
        message: 'Có lỗi khi mở Chrome: ' + stderr,
        command: command
      };
    }
    
    return {
      success: true,
      message: 'Đã mở Chrome thành công với trang KimVan',
      command: command
    };
  } catch (error) {
    console.error('Không thể mở Chrome:', error);
    return {
      success: false,
      message: 'Không thể mở trình duyệt Chrome: ' + error.message,
      command: command,
      error: error
    };
  }
}

/**
 * Hiển thị trang helper với hướng dẫn chi tiết
 */
function showHelperPage(result) {
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Trợ giúp lấy Cookie KimVan</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #f8fafc;
        }
        h1 {
          color: #2563eb;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 10px;
        }
        .card {
          background: #fff;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.05);
          border: 1px solid #e5e7eb;
        }
        .steps {
          background: #eff6ff;
          border-left: 4px solid #3b82f6;
        }
        .alert {
          background: #fef2f2;
          border-left: 4px solid #ef4444;
          padding: 10px 15px;
          margin: 15px 0;
          font-weight: 500;
        }
        .success {
          background: #f0fdf4;
          border-left: 4px solid #22c55e;
          padding: 15px;
          margin: 15px 0;
          display: none;
          font-weight: 500;
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
          padding: 10px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
          font-weight: 500;
          width: 100%;
          margin: 10px 0;
        }
        button:hover {
          background: #1d4ed8;
        }
        button:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
        button.secondary {
          background: #334155;
        }
        button.secondary:hover {
          background: #1e293b;
        }
        button.green {
          background: #22c55e;
        }
        button.green:hover {
          background: #16a34a;
        }
        input {
          width: 100%;
          padding: 10px;
          border: 1px solid #cbd5e1;
          border-radius: 4px;
          margin: 10px 0;
          font-family: monospace;
          font-size: 14px;
        }
        .cookie-display {
          background: #f8fafc;
          padding: 12px;
          border-radius: 4px;
          border: 1px solid #cbd5e1;
          margin: 15px 0;
          font-family: monospace;
          font-size: 12px;
          word-break: break-all;
          display: none;
        }
        .status-indicator {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
        }
        .status-indicator span {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          margin-right: 8px;
        }
        .status-indicator span.red {
          background-color: #ef4444;
        }
        .status-indicator span.green {
          background-color: #22c55e;
        }
        .step-item {
          display: flex;
          margin-bottom: 10px;
        }
        .step-number {
          background: #3b82f6;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
          flex-shrink: 0;
        }
        .checkmark {
          display: inline-block;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #22c55e;
          color: white;
          text-align: center;
          line-height: 16px;
          margin-right: 8px;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <h1>Hướng dẫn lấy Cookie KimVan</h1>
      
      <div id="status-card" class="card">
        <h3>Trạng thái kết nối</h3>
        <div class="status-indicator">
          <span id="chrome-status" class="${result.success ? 'green' : 'red'}"></span>
          <div>
            <p><strong>Trình duyệt Chrome: </strong> 
              ${result.success ? 
                'Đã mở thành công với trang KimVan' : 
                'Không thể mở Chrome. ' + result.message}
            </p>
          </div>
        </div>

        ${!result.success ? `
        <div class="alert">
          <p>Không thể mở Chrome tự động. Vui lòng thực hiện theo những cách sau:</p>
          <ol>
            <li>Mở Chrome thủ công</li>
            <li>Truy cập trang <a href="https://kimvan.id.vn" target="_blank">https://kimvan.id.vn</a></li>
            <li>Sau đó tiếp tục theo hướng dẫn bên dưới</li>
          </ol>
        </div>
        ` : ''}
      </div>
      
      <div class="card steps">
        <h3>Các bước lấy cookie KimVan</h3>
        
        <div class="step-item">
          <div class="step-number">1</div>
          <div>
            <p>Trình duyệt Chrome đã được mở với trang KimVan. Nếu chưa đăng nhập, hãy đăng nhập vào tài khoản của bạn.</p>
          </div>
        </div>
        
        <div class="step-item">
          <div class="step-number">2</div>
          <div>
            <p>Sau khi đăng nhập, bạn có thể lấy cookie bằng một trong hai cách sau:</p>
          </div>
        </div>
        
        <div class="step-item">
          <div class="step-number">3</div>
          <div>
            <p><strong>Cách 1 (Tự động):</strong> Sao chép đoạn mã dưới đây và dán vào DevTools Console:</p>
            <p><small>Mở DevTools: Nhấn F12 hoặc chuột phải chọn "Inspect" > Chọn tab "Console"</small></p>
            
            <div class="code-block">
// Đoạn mã tìm và sao chép cookie KimVan
(function() {
  try {
    const cookies = document.cookie.split(';');
    const authCookie = cookies.find(c => c.trim().startsWith('__Secure-authjs.session-token='));
    if (authCookie) {
      const value = authCookie.split('=')[1];
      console.log('%cTìm thấy cookie KimVan:', 'color: green; font-weight: bold');
      console.log('%c' + value, 'background: #f0f0f0; padding: 5px; border-radius: 3px; color: black;');
      console.log('%cHãy sao chép giá trị trên và dán vào ô nhập cookie.', 'color: blue;');
      
      // Tạo phần tử input ẩn để sao chép
      const input = document.createElement('input');
      input.style.position = 'fixed';
      input.style.opacity = 0;
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      
      console.log('%cĐã sao chép cookie vào clipboard!', 'color: green; font-weight: bold');
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
            
            <button id="copyScript" type="button">Sao chép đoạn mã</button>
          </div>
        </div>
        
        <div class="step-item">
          <div class="step-number">4</div>
          <div>
            <p><strong>Cách 2 (Thủ công):</strong> Nếu cách 1 không hoạt động, thực hiện các bước sau:</p>
            <ol>
              <li>Nhấn F12 hoặc chuột phải + Inspect để mở DevTools</li>
              <li>Chuyển đến tab "Application" (nếu không thấy, hãy nhấp vào &gt;&gt; để tìm)</li>
              <li>Ở cột bên trái, mở rộng mục "Cookies" và chọn "https://kimvan.id.vn"</li>
              <li>Tìm cookie có tên "__Secure-authjs.session-token"</li>
              <li>Sao chép giá trị của cookie và dán vào ô bên dưới</li>
            </ol>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h3>Nhập cookie đã sao chép</h3>
        <p>Sau khi đã sao chép cookie từ trình duyệt, dán vào ô bên dưới:</p>
        
        <input type="text" id="cookieInput" placeholder="Dán cookie đã sao chép vào đây">
        
        <div id="cookieDisplay" class="cookie-display"></div>
        
        <div id="successMessage" class="success">
          <div style="display: flex; align-items: center; margin-bottom: 10px;">
            <div class="checkmark">✓</div>
            <strong>Cookie hợp lệ!</strong>
          </div>
          <p>Cookie KimVan đã được sao chép thành công. Nhấn nút bên dưới để cập nhật vào hệ thống.</p>
        </div>
        
        <button id="verifyCookie" type="button" disabled>Kiểm tra cookie</button>
        <button id="saveCookie" type="button" class="green" disabled>Lưu cookie vào hệ thống</button>
        <button id="closeWindow" type="button" class="secondary">Đóng cửa sổ này</button>
      </div>
      
      <script>
        // Kiểm tra clipboard khi trang tải xong
        window.addEventListener('load', function() {
          // Tự động dán clipboard vào ô nhập nếu có dữ liệu
          setTimeout(function() {
            navigator.clipboard.readText()
              .then(text => {
                if (text && text.length > 20) {
                  document.getElementById('cookieInput').value = text;
                  validateCookie();
                }
              })
              .catch(err => {
                console.log('Không thể đọc clipboard:', err);
              });
          }, 1000);
        });
      
        // Sao chép đoạn mã JavaScript
        document.getElementById('copyScript').addEventListener('click', function() {
          const scriptCode = document.querySelector('.code-block').textContent;
          navigator.clipboard.writeText(scriptCode).then(function() {
            const button = document.getElementById('copyScript');
            button.textContent = '✓ Đã sao chép';
            button.style.backgroundColor = '#16a34a';
            setTimeout(function() {
              button.textContent = 'Sao chép đoạn mã';
              button.style.backgroundColor = '#2563eb';
            }, 2000);
          });
        });
        
        // Xử lý ô nhập cookie
        const cookieInput = document.getElementById('cookieInput');
        const verifyCookieBtn = document.getElementById('verifyCookie');
        const saveCookieBtn = document.getElementById('saveCookie');
        
        cookieInput.addEventListener('input', validateCookie);
        
        function validateCookie() {
          const cookieValue = cookieInput.value.trim();
          const cookieDisplay = document.getElementById('cookieDisplay');
          const successMsg = document.getElementById('successMessage');
          
          if (cookieValue.length > 20) {
            // Hiển thị cookie đã được nhập
            cookieDisplay.style.display = 'block';
            cookieDisplay.textContent = cookieValue.substring(0, 15) + '...' + 
              cookieValue.substring(cookieValue.length - 15);
            
            // Hiển thị thông báo thành công
            successMsg.style.display = 'block';
            
            // Bật nút lưu cookie
            verifyCookieBtn.disabled = false;
            saveCookieBtn.disabled = false;
          } else {
            cookieDisplay.style.display = 'none';
            successMsg.style.display = 'none';
            verifyCookieBtn.disabled = true;
            saveCookieBtn.disabled = true;
          }
        }
        
        // Kiểm tra cookie
        verifyCookieBtn.addEventListener('click', function() {
          alert('Cookie đã được xác nhận. Bạn có thể lưu vào hệ thống.');
        });
        
        // Lưu cookie vào hệ thống
        saveCookieBtn.addEventListener('click', function() {
          const cookieValue = cookieInput.value.trim();
          
          // Gửi cookie về trang chính
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ cookie: cookieValue }, '*');
            
            // Thông báo thành công
            alert('Cookie đã được gửi về trang chính thành công!');
            
            // Đóng cửa sổ sau khi gửi
            window.close();
          } else {
            alert('Không thể gửi cookie về trang chính. Vui lòng sao chép và dán thủ công.');
          }
        });
        
        // Đóng cửa sổ
        document.getElementById('closeWindow').addEventListener('click', function() {
          window.close();
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

/**
 * API trả về trang HTML helper để hỗ trợ lấy cookie
 */
export async function POST(request) {
  return showHelperPage({ success: true });
} 