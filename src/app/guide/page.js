'use client';

import React from 'react';
import styles from './page.module.css';

export default function GuidePage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Hướng dẫn trích xuất dữ liệu từ Google Sheets</h1>
      </header>

      <main className={styles.main}>
        <section className={styles.section}>
          <h2>Cách tự động trích xuất HTML từ Google Sheets</h2>
          <p>Chúng tôi đã tạo một script tự động để trích xuất HTML từ Google Sheets mà bạn có thể sử dụng trong Chrome (cả phiên bản cũ).</p>
          
          <h3>Cách 1: Sử dụng Bookmarklet (Đơn giản nhất)</h3>
          <div className={styles.step}>
            <ol>
              <li>Tạo một bookmark mới trong Chrome (nhấp chuột phải vào thanh bookmark &gt; Thêm trang...)</li>
              <li>Đặt tên là "Trích xuất Google Sheets"</li>
              <li>Trong trường URL, dán đoạn mã sau:
                <pre className={styles.code}>
                  {`javascript:(function(){var d=document,s=d.createElement('script');s.src='${process.env.NEXT_PUBLIC_BASE_URL || ''}/autoExtract.js?t='+new Date().getTime();d.body.appendChild(s)})();`}
                </pre>
              </li>
              <li>Lưu bookmark</li>
              <li>Mở Google Sheets của bạn</li>
              <li>Nhấp vào bookmark "Trích xuất Google Sheets" vừa tạo</li>
              <li>Đợi vài giây, file HTML sẽ tự động tải xuống</li>
            </ol>
          </div>

          <h3>Cách 2: Sử dụng Console</h3>
          <div className={styles.step}>
            <ol>
              <li>Mở Google Sheets của bạn</li>
              <li>Mở Developer Tools (F12 hoặc Ctrl+Shift+I)</li>
              <li>Chuyển đến tab Console</li>
              <li>Dán đoạn mã sau và nhấn Enter:
                <pre className={styles.code}>
                  {`fetch('${process.env.NEXT_PUBLIC_BASE_URL || ''}/autoExtract.js')
  .then(response => response.text())
  .then(code => {
    eval(code);
  });`}
                </pre>
              </li>
              <li>Đợi vài giây, file HTML sẽ tự động tải xuống</li>
            </ol>
          </div>
          
          <div className={styles.note}>
            <h3>Chú ý:</h3>
            <ul>
              <li>Script này hoạt động với hầu hết các phiên bản Chrome, bao gồm cả phiên bản cũ</li>
              <li>Nếu không tải được file, một cửa sổ mới sẽ mở ra với HTML và bạn có thể lưu bằng Ctrl+S</li>
              <li>Script sẽ tự động tìm và trích xuất dữ liệu bảng từ Google Sheets</li>
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Các phương pháp trích xuất thủ công</h2>
          
          <h3>Phương pháp 1: Sử dụng Developer Tools (F12)</h3>
          <div className={styles.step}>
            <ol>
              <li>Mở trang Google Sheets trong chế độ xem trước (đổi "/edit" thành "/preview" trong URL)</li>
              <li>Nhấn F12 để mở Developer Tools</li>
              <li>Nhấp chuột phải vào bảng tính &gt; Inspect (Kiểm tra)</li>
              <li>Tìm thẻ div chứa lưới dữ liệu (thường có id kết thúc bằng "-grid-container")</li>
              <li>Nhấp chuột phải vào thẻ div đó &gt; Copy &gt; Copy outerHTML</li>
              <li>Dán HTML vào một file .html</li>
            </ol>
          </div>

          <h3>Phương pháp 2: Sử dụng JavaScript để sao chép nhanh HTML</h3>
          <div className={styles.step}>
            <p>Sao chép đoạn mã sau vào Console và chạy:</p>
            <pre className={styles.code}>
              {`// Tìm grid container
const gridContainer = document.querySelector('[id$="-grid-container"]') || 
                      document.querySelector('[class*="grid-container"]') || 
                      document.querySelector('[role="grid"]');

// Copy HTML
if (gridContainer) {
  const htmlContent = gridContainer.outerHTML;
  navigator.clipboard.writeText(htmlContent)
    .then(() => console.log('HTML đã được sao chép vào clipboard!'))
    .catch(err => console.error('Lỗi khi sao chép: ', err));
} else {
  console.error('Không tìm thấy grid container!');
}`}
            </pre>
          </div>

          <h3>Phương pháp 3: Sử dụng Bookmarklet để trích xuất HTML</h3>
          <div className={styles.step}>
            <p>Tạo bookmark với URL là đoạn mã JavaScript sau:</p>
            <pre className={styles.code}>
              {`javascript:(function(){
  const gridContainer = document.querySelector('[id$="-grid-container"]') || document.querySelector('[class*="grid-container"]') || document.querySelector('[role="grid"]');
  if (gridContainer) {
    const html = '<!DOCTYPE html>\\n<html>\\n<head>\\n<title>Google Sheet HTML</title>\\n</head>\\n<body>\\n' + gridContainer.outerHTML + '\\n</body>\\n</html>';
    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'google-sheet-' + new Date().getTime() + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    alert('Không tìm thấy dữ liệu bảng tính!');
  }
})();`}
            </pre>
          </div>
        </section>
      </main>
    </div>
  );
} 