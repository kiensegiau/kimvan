'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function TestSheets() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  // Hàm chuyển đổi URL giữa các chế độ edit và preview
  const toggleSheetMode = (inputUrl) => {
    if (!inputUrl) return '';
    
    // Đã là preview mode, chuyển về edit mode
    if (inputUrl.includes('/preview')) {
      return inputUrl.replace(/\/preview(\?|#|$)/, '/edit$1');
    }
    // Đang ở edit mode, chuyển sang preview mode
    else if (inputUrl.includes('/edit')) {
      return inputUrl.replace(/\/edit(\?|#|$)/, '/preview$1');
    }
    
    return inputUrl;
  };

  const handleTestBrowser = async () => {
    if (!url) {
      setError('Vui lòng nhập URL của Google Sheets');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSessionData(null);

    try {
      const response = await fetch(`/api/test-browser?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Có lỗi xảy ra khi mở trình duyệt');
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGoogleSheet = () => {
    const targetUrl = "https://docs.google.com/spreadsheets/d/1A-MW6L9JKAmHfaibkB6OTheoOwUwQtAFOXdmMbeZ5Ao/preview?gid=1410922682#gid=1410922682";
    setUrl(targetUrl);
  };

  const handleToggleMode = () => {
    setUrl(toggleSheetMode(url));
  };
  
  const handleCapturePage = async () => {
    if (!url) {
      setError('Vui lòng nhập URL của Google Sheets');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSessionData(null);

    try {
      const response = await fetch(`/api/extract-sheet?url=${encodeURIComponent(url)}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setSessionData(data);
      } else {
        setError(data.error || 'Có lỗi xảy ra khi chụp trang');
      }
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  // Xác định URL hiện tại là chế độ nào
  const isPreviewMode = url.includes('/preview');

  return (
    <div className={styles.container}>
      <h1>Xem và Chụp Google Sheets</h1>
      
      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="url">URL Google Sheets:</label>
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Nhập URL của Google Sheets"
            className={styles.urlInput}
          />
        </div>

        <div className={styles.buttonGroup}>
          <button 
            onClick={handleTestBrowser} 
            disabled={loading}
            className={styles.button}
          >
            {loading ? 'Đang xử lý...' : 'Mở trình duyệt & Google Sheets'}
          </button>
          
          <button
            onClick={handleOpenGoogleSheet}
            className={styles.linkButton}
          >
            Mở link sheet ở chế độ Preview
          </button>
          
          <button
            onClick={handleToggleMode}
            className={isPreviewMode ? styles.editButton : styles.previewButton}
            disabled={!url.includes('docs.google.com/spreadsheets')}
          >
            {isPreviewMode ? 'Chuyển sang chế độ Edit' : 'Chuyển sang chế độ Preview'}
          </button>
          
          <button
            onClick={handleCapturePage}
            className={styles.extractButton}
            disabled={loading || !url.includes('docs.google.com/spreadsheets')}
          >
            {loading ? 'Đang chụp trang...' : 'Chụp trang và lưu HTML'}
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <h3>Lỗi:</h3>
          <p>{error}</p>
        </div>
      )}

      {sessionData && (
        <div className={styles.sessionResult}>
          <h3>Kết quả chụp trang:</h3>
          <div className={styles.sessionInfo}>
            <div><strong>Tiêu đề:</strong> {sessionData.title}</div>
            <div><strong>Thư mục:</strong> {sessionData.sessionDir}</div>
            <div><strong>Thời gian:</strong> {new Date(sessionData.timestamp).toLocaleString()}</div>
          </div>
          
          <div className={styles.filesInfo}>
            <h4>Tệp đã tạo:</h4>
            <ul>
              {sessionData.files && Object.entries(sessionData.files).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {value}
                </li>
              ))}
            </ul>
          </div>
          
          <div className={styles.note}>
            <p>Các tệp HTML và ảnh chụp màn hình đã được lưu. Bạn có thể mở các tệp này để xem dữ liệu chi tiết.</p>
          </div>
        </div>
      )}

      {result && !sessionData && (
        <div className={styles.result}>
          <h3>Kết quả mở trình duyệt:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 