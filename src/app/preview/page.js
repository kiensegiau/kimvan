'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function Preview() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTestBrowser = async () => {
    if (!url) {
      setError('Vui lòng nhập URL của Google Sheets');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

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
    const targetUrl = "https://docs.google.com/spreadsheets/d/1A-MW6L9JKAmHfaibkB6OTheoOwUwQtAFOXdmMbeZ5Ao/edit?gid=1410922682#gid=1410922682";
    setUrl(targetUrl);
  };

  return (
    <div className={styles.container}>
      <h1>Preview Google Sheets</h1>
      
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
            {loading ? 'Đang xử lý...' : 'Mở trình duyệt & xem sheet'}
          </button>
          
          <button
            onClick={handleOpenGoogleSheet}
            className={styles.linkButton}
          >
            Mở link sheet mẫu
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <h3>Lỗi:</h3>
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <h3>Kết quả:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 