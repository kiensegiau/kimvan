import { google } from 'googleapis';
import { dbMiddleware } from '@/utils/db-middleware';
import Course from '@/models/Course';
import Sheet from '@/models/Sheet';

/**
 * Cập nhật link đã xử lý vào sheet
 * @param {string} courseId - ID của khóa học
 * @param {number} sheetIndex - Index của sheet trong khóa học
 * @param {number} rowIndex - Index của hàng cần cập nhật
 * @param {number} cellIndex - Index của ô cần cập nhật
 * @param {string} originalUrl - URL gốc
 * @param {string} newUrl - URL mới sau khi xử lý
 * @param {string} displayText - Text hiển thị (nếu có)
 * @param {Request} request - Request object từ Next.js
 * @returns {Promise<Object>} - Kết quả cập nhật
 */
export async function updateSheetCell(courseId, sheetIndex, rowIndex, cellIndex, originalUrl, newUrl, displayText, request, options = {}) {
  try {
    const { skipProcessing = false, originalLink, processedTime } = options;
    
    const noteContent = skipProcessing 
      ? `Link gốc: ${originalLink}\nĐã bỏ qua xử lý lúc: ${new Date().toLocaleString('vi-VN')}\nLý do: File gốc từ khoahocshare6.0@gmail.com`
      : `Link gốc: ${originalUrl}\nĐã xử lý lúc: ${new Date().toLocaleString('vi-VN')}`;

    // Tạo cell data với định dạng và hyperlink
    const cellData = {
      formattedValue: displayText,
      hyperlink: skipProcessing ? originalLink : newUrl,
      userEnteredFormat: {
        backgroundColor: { red: 0.9, green: 0.6, blue: 1.0 },
        textFormat: {
          foregroundColor: { red: 0, green: 0, blue: 0.8 },
          bold: true,
          link: { uri: skipProcessing ? originalLink : newUrl }
        }
      },
      note: noteContent
    };

    // Xác định base URL
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 
                   (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

    // Gọi API update-cell
    const response = await fetch(`${baseUrl}/api/courses/${courseId}/update-cell`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        sheetIndex,
        rowIndex,
        columnIndex: cellIndex,
        cellData
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Lỗi không xác định khi cập nhật cell');
    }

    return {
      success: true,
      message: skipProcessing ? 'Đã cập nhật cell (bỏ qua xử lý)' : 'Đã cập nhật cell',
      updatedCell: result
    };
  } catch (error) {
    console.error('Lỗi khi cập nhật cell:', error);
    return {
      success: false,
      error: `Lỗi khi cập nhật cell: ${error.message}`
    };
  }
}

/**
 * Cập nhật link trong Google Sheets API
 * @param {string} sheetId - ID của Google Sheet
 * @param {string} sheetName - Tên của sheet
 * @param {number} rowIndex - Index của hàng (0-based)
 * @param {number} colIndex - Index của cột (0-based)
 * @param {string} displayText - Text hiển thị
 * @param {string} url - URL cần thêm vào ô
 * @param {string} originalUrl - URL gốc trước khi xử lý
 * @param {Request} request - Request object từ Next.js
 * @returns {Promise<Object>} - Kết quả cập nhật
 */
export async function updateGoogleSheetCell(sheetId, sheetName, rowIndex, cellIndex, displayText, newUrl, originalUrl, request, options = {}) {
  try {
    const { skipProcessing = false, originalLink, processedTime } = options;
    
    const noteContent = skipProcessing 
      ? `Link gốc: ${originalLink}\nĐã bỏ qua xử lý lúc: ${new Date().toLocaleString('vi-VN')}\nLý do: File gốc từ khoahocshare6.0@gmail.com`
      : `Link gốc: ${originalUrl}\nĐã xử lý lúc: ${new Date().toLocaleString('vi-VN')}`;

    // Xác định base URL
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 
                   (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

    // Gọi API update-cell
    const response = await fetch(`${baseUrl}/api/sheets/${sheetId}/update-cell`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({
        rowIndex,
        columnIndex: cellIndex,
        value: displayText,
        url: skipProcessing ? originalLink : newUrl,
        originalUrl
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Lỗi không xác định khi cập nhật cell');
    }

    return {
      success: true,
      message: skipProcessing ? 'Đã cập nhật Google Sheet cell (bỏ qua xử lý)' : 'Đã cập nhật Google Sheet cell',
      updatedCell: result
    };
  } catch (error) {
    console.error('Lỗi khi cập nhật Google Sheet cell:', error);
    return {
      success: false,
      error: `Lỗi khi cập nhật Google Sheet cell: ${error.message}`
    };
  }
} 