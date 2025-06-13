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
      const response = await fetch(`/api/sheets/${spreadsheetId}?debug=true`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể lấy dữ liệu từ Google Sheets');
      }
      
      const data = await response.json();
      console.log('Dữ liệu từ API:', data);
      
      // Kiểm tra dữ liệu trả về
      if (data && data.values) {
        console.log('Số hàng:', data.values.length);
        console.log('Dữ liệu hàng đầu tiên:', data.values[0]);
        
        // Kiểm tra xem có công thức HYPERLINK không
        let hasHyperlinks = false;
        data.values.forEach((row, rowIndex) => {
          row.forEach((cell, cellIndex) => {
            if (typeof cell === 'string' && cell.includes('HYPERLINK')) {
              hasHyperlinks = true;
              console.log(`Tìm thấy HYPERLINK tại hàng ${rowIndex+1}, cột ${cellIndex+1}:`, cell);
            }
          });
        });
        
        if (!hasHyperlinks) {
          console.log('Không tìm thấy công thức HYPERLINK nào trong dữ liệu');
        }
      }
      
      setSheetData(data);
    } catch (err) {
      setError(err.message || 'Có lỗi xảy ra khi lấy dữ liệu');
      console.error('Lỗi:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenGoogleSheet = () => {
    const targetUrl = "https://docs.google.com/spreadsheets/d/1A-MW6L9JKAmHfaibkB6OTheoOwUwQtAFOXdmMbeZ5Ao/edit?gid=1410922682#gid=1410922682";
    setUrl(targetUrl);
  };

  // Hàm làm sạch URL từ Google Sheets
  const cleanGoogleUrl = (url) => {
    if (!url) return url;
    
    // Xử lý URL chuyển hướng từ Google
    if (url.startsWith('https://www.google.com/url?q=')) {
      try {
        // Trích xuất URL từ tham số q
        const urlObj = new URL(url);
        const redirectUrl = urlObj.searchParams.get('q');
        if (redirectUrl) {
          // Giải mã URL (Google thường mã hóa URL hai lần)
          let decodedUrl = redirectUrl;
          try {
            decodedUrl = decodeURIComponent(redirectUrl);
          } catch (e) {
            console.error('Lỗi khi giải mã URL:', e);
          }
          
          // Xóa các tham số không cần thiết từ Google
          try {
            const cleanUrlObj = new URL(decodedUrl);
            ['sa', 'source', 'usg', 'ust'].forEach(param => {
              cleanUrlObj.searchParams.delete(param);
            });
            return cleanUrlObj.toString();
          } catch (e) {
            console.error('Lỗi khi làm sạch URL:', e);
            return decodedUrl;
          }
        }
      } catch (err) {
        console.error('Lỗi khi xử lý URL chuyển hướng:', err, url);
      }
    }
    
    // Xử lý các URL đặc biệt khác
    try {
      const urlObj = new URL(url);
      
      // Xử lý YouTube
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        // Giữ lại chỉ các tham số cần thiết cho YouTube
        const videoId = urlObj.searchParams.get('v') || 
                       (urlObj.hostname === 'youtu.be' ? urlObj.pathname.substring(1) : null);
        
        if (videoId) {
          return `https://www.youtube.com/watch?v=${videoId}`;
        }
      }
      
      // Xử lý Google Drive
      if (urlObj.hostname.includes('drive.google.com')) {
        // Làm sạch URL Google Drive
        let fileId = null;
        
        // Trích xuất ID từ URL Google Drive
        if (url.includes('file/d/')) {
          const match = url.match(/\/file\/d\/([^/]+)/);
          if (match && match[1]) fileId = match[1];
        } else if (url.includes('open?id=')) {
          fileId = urlObj.searchParams.get('id');
        }
        
        if (fileId) {
          return `https://drive.google.com/file/d/${fileId}/view`;
        }
      }
    } catch (err) {
      console.error('Lỗi khi xử lý URL:', err, url);
    }
    
    return url;
  };

  // Hàm xử lý nội dung cell để phát hiện và chuyển đổi URL thành liên kết
  const renderCellContent = (content) => {
    if (!content) return '';
    
    // Kiểm tra công thức HYPERLINK từ Google Sheets
    const hyperlinkRegex = /=HYPERLINK\("([^"]+)"(?:,\s*"([^"]+)")?\)/i;
    const hyperlinkMatch = typeof content === 'string' ? content.match(hyperlinkRegex) : null;
    
    if (hyperlinkMatch) {
      let url = hyperlinkMatch[1];
      const displayText = hyperlinkMatch[2] || url;
      
      // Làm sạch URL
      url = cleanGoogleUrl(url);
      
      // Kiểm tra loại link để hiển thị icon phù hợp
      let icon = null;
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        icon = <span className={styles.youtubeIcon} title="YouTube Video">🎬</span>;
      } else if (url.includes('drive.google.com')) {
        icon = <span className={styles.driveIcon} title="Google Drive">📄</span>;
      } else if (url.includes('docs.google.com/document')) {
        icon = <span className={styles.docsIcon} title="Google Docs">📝</span>;
      }
      
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className={styles.cellLink}
        >
          {icon && <span className={styles.linkIcon}>{icon}</span>}
          {displayText}
        </a>
      );
    }
    
    // Xử lý các URL YouTube
    const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
    const youtubeMatch = typeof content === 'string' ? content.match(youtubeRegex) : null;
    
    if (youtubeMatch) {
      const videoId = youtubeMatch[4];
      const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
      return (
        <a 
          href={fullUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className={`${styles.cellLink} ${styles.youtubeLink}`}
        >
          <span className={styles.linkIcon}>🎬</span>
          {content}
        </a>
      );
    }
    
    // Xử lý các URL Google Drive
    const driveRegex = /https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/i;
    const driveMatch = typeof content === 'string' ? content.match(driveRegex) : null;
    
    if (driveMatch) {
      // Làm sạch URL
      const cleanUrl = cleanGoogleUrl(content);
      return (
        <a 
          href={cleanUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className={`${styles.cellLink} ${styles.driveLink}`}
        >
          <span className={styles.linkIcon}>📄</span>
          {content}
        </a>
      );
    }
    
    // Kiểm tra xem nội dung có phải là URL không
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Nếu nội dung chỉ chứa URL
    if (typeof content === 'string' && urlRegex.test(content) && content.trim().match(urlRegex)[0] === content.trim()) {
      // Làm sạch URL
      const cleanUrl = cleanGoogleUrl(content);
      
      // Xác định loại URL để hiển thị icon phù hợp
      let icon = null;
      if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
        icon = <span className={styles.youtubeIcon} title="YouTube Video">🎬</span>;
      } else if (cleanUrl.includes('drive.google.com')) {
        icon = <span className={styles.driveIcon} title="Google Drive">📄</span>;
      } else if (cleanUrl.includes('docs.google.com/document')) {
        icon = <span className={styles.docsIcon} title="Google Docs">📝</span>;
      }
      
      return (
        <a 
          href={cleanUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className={styles.cellLink}
        >
          {icon && <span className={styles.linkIcon}>{icon}</span>}
          {cleanUrl}
        </a>
      );
    }
    
    // Nếu nội dung có chứa URL nhưng còn có text khác
    if (typeof content === 'string') {
      const parts = content.split(urlRegex);
      const matches = content.match(urlRegex) || [];
      
      if (matches.length === 0) return content;
      
      return (
        <>
          {parts.map((part, i) => {
            // Nếu là phần text thường
            if (i % 2 === 0) {
              return part;
            }
            // Nếu là URL
            const url = matches[Math.floor(i/2)];
            // Làm sạch URL
            const cleanUrl = cleanGoogleUrl(url);
            
            // Xác định loại URL để hiển thị icon phù hợp
            let icon = null;
            if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
              icon = <span className={styles.youtubeIcon} title="YouTube Video">🎬</span>;
            } else if (cleanUrl.includes('drive.google.com')) {
              icon = <span className={styles.driveIcon} title="Google Drive">📄</span>;
            } else if (cleanUrl.includes('docs.google.com/document')) {
              icon = <span className={styles.docsIcon} title="Google Docs">📝</span>;
            }
            
            return (
              <a 
                key={i} 
                href={cleanUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.cellLink}
              >
                {icon && <span className={styles.linkIcon}>{icon}</span>}
                {url}
              </a>
            );
          })}
        </>
      );
    }
    
    return content;
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
            {sheetData.values.slice(1).map((row, rowIndex) => {
              // Lấy dữ liệu HTML tương ứng nếu có
              const htmlRow = sheetData.htmlData?.[rowIndex + 1]?.values || [];
              
              return (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    // Kiểm tra xem có dữ liệu HTML không
                    const htmlCell = htmlRow[cellIndex];
                    const hyperlink = htmlCell?.hyperlink;
                    
                    // Nếu có hyperlink trong dữ liệu HTML
                    if (hyperlink) {
                      // Xác định loại liên kết để hiển thị icon phù hợp
                      let icon = null;
                      if (hyperlink.includes('youtube.com') || hyperlink.includes('youtu.be')) {
                        icon = <span className={styles.youtubeIcon} title="YouTube Video">🎬</span>;
                      } else if (hyperlink.includes('drive.google.com')) {
                        icon = <span className={styles.driveIcon} title="Google Drive">📄</span>;
                      } else if (hyperlink.includes('docs.google.com/document')) {
                        icon = <span className={styles.docsIcon} title="Google Docs">📝</span>;
                      }
                      
                      return (
                        <td key={cellIndex}>
                          <a 
                            href={hyperlink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className={`${styles.cellLink} ${
                              hyperlink.includes('youtube.com') || hyperlink.includes('youtu.be') 
                                ? styles.youtubeLink 
                                : hyperlink.includes('drive.google.com') 
                                  ? styles.driveLink 
                                  : ''
                            }`}
                          >
                            {icon && <span className={styles.linkIcon}>{icon}</span>}
                            {cell}
                          </a>
                        </td>
                      );
                    }
                    
                    return (
                      <td key={cellIndex}>
                        {renderCellContent(cell)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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