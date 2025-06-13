'use client';

import { useState } from 'react';
import styles from './page.module.css';

export default function Preview() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [sheetData, setSheetData] = useState(null);
  const [error, setError] = useState(null);

  const handleFetchSheetData = async () => {
    if (!url) {
      setError('Vui lòng nhập URL của Google Sheets');
      return;
    }

    setLoading(true);
    setError(null);
    setSheetData(null);

    try {
      // Trích xuất ID từ URL Google Sheets
      const matches = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!matches || !matches[1]) {
        throw new Error('URL không hợp lệ. Không tìm thấy ID của Google Sheets');
      }
      
      const spreadsheetId = matches[1];
      const response = await fetch(`/api/sheets/${spreadsheetId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể lấy dữ liệu từ Google Sheets');
      }
      
      const data = await response.json();
      setSheetData(data);
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi lấy dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGoogleSheet = () => {
    const targetUrl = "https://docs.google.com/spreadsheets/d/1A-MW6L9JKAmHfaibkB6OTheoOwUwQtAFOXdmMbeZ5Ao/edit?gid=1410922682#gid=1410922682";
    setUrl(targetUrl);
  };

  const renderTable = () => {
    if (!sheetData || !sheetData.values || sheetData.values.length === 0) {
      return null;
    }

    return (
      <div className={styles.tableContainer}>
        <table className={styles.dataTable}>
          <thead>
            <tr>
              {sheetData.values[0].map((header, index) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheetData.values.slice(1).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <h1>Google Sheets Data</h1>
      
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
            onClick={handleFetchSheetData} 
            disabled={loading}
            className={styles.button}
          >
            {loading ? 'Đang lấy dữ liệu...' : 'Lấy dữ liệu từ Sheet'}
          </button>
          
          <button
            onClick={handleOpenGoogleSheet}
            className={styles.linkButton}
          >
            Dùng sheet mẫu
          </button>
        </div>
      </div>

      {error && (
        <div className={styles.error}>
          <h3>Lỗi:</h3>
          <p>{error}</p>
        </div>
      )}

      {sheetData && renderTable()}
    </div>
  );
} 