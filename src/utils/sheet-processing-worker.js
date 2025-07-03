import { processAndSyncSheet } from './sheet-cache-manager';
import SheetContent from '@/models/SheetContent';
import mongoose from 'mongoose';
import { extractUrlFromCell, isDriveUrl, cleanGoogleUrl } from '@/utils/drive-utils';

// Helper function to check if URL is a YouTube link
function isYoutubeUrl(url) {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
}

// Helper function to clean YouTube URL
function cleanYoutubeUrl(url) {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    
    // Handle youtu.be format
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.substring(1);
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    // Handle youtube.com format
    if (urlObj.hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) {
        return `https://www.youtube.com/watch?v=${videoId}`;
      }
    }
    
    return url;
  } catch (error) {
    console.error('Error cleaning YouTube URL:', error);
    return url;
  }
}

/**
 * Process sheet data and store in the database as a single document
 * @param {string} sheetId - Google Sheet ID
 * @param {Object} options - Processing options
 * @returns {Object} Processing results
 */
export async function processSheetToDatabase(sheetId, options = {}) {
  console.log(`Bắt đầu xử lý sheet ${sheetId} vào database`);
  
  // Kết nối MongoDB nếu cần
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Đã kết nối với MongoDB');
    } catch (error) {
      console.error('Lỗi kết nối MongoDB:', error);
      return { success: false, error: 'Không thể kết nối database' };
    }
  }
  
  try {
    // Xóa dữ liệu cũ trước khi xử lý
    const deleteResult = await SheetContent.deleteOne({ sheetId });
    console.log(`Đã xóa ${deleteResult.deletedCount} bản ghi cũ của sheet ${sheetId}`);
    
    // Tìm thông tin sheet từ database để lấy tên
    let sheetName = options.sheetName || '';
    if (!sheetName) {
      const sheetInfo = await mongoose.models.Sheet.findOne({ sheetId }).lean();
      if (sheetInfo) {
        sheetName = sheetInfo.name;
      } else {
        console.warn(`Không tìm thấy thông tin sheet ${sheetId} trong database`);
      }
    }
    
    // Lấy dữ liệu từ Google Sheets
    const sheetData = await fetchSheetDataWithCache(sheetId, false);
    
    if (!sheetData.values || sheetData.values.length === 0) {
      return {
        success: false,
        error: 'Sheet không có dữ liệu',
        processedCount: 0
      };
    }
    
    // Xử lý dữ liệu sheet
    const header = sheetData.values[0] || [];
    const rows = [];
    
    // Kiểm tra và log hyperlink
    let hyperlinkCount = 0;
    let youtubeCount = 0;
    if (sheetData.htmlData) {
      sheetData.htmlData.forEach((row, rowIndex) => {
        if (row && row.values) {
          row.values.forEach((cell, cellIndex) => {
            if (cell && cell.hyperlink) {
              hyperlinkCount++;
              if (isYoutubeUrl(cell.hyperlink)) {
                youtubeCount++;
                console.log(`Tìm thấy YouTube link tại [${rowIndex},${cellIndex}]: ${cell.hyperlink}`);
              } else {
                console.log(`Tìm thấy hyperlink tại [${rowIndex},${cellIndex}]: ${cell.hyperlink}`);
              }
            }
          });
        }
      });
    }
    console.log(`Tổng số hyperlink tìm thấy trong dữ liệu gốc: ${hyperlinkCount} (trong đó có ${youtubeCount} YouTube links)`);
    
    // Xử lý từng hàng (bỏ qua header)
    for (let rowIndex = 1; rowIndex < sheetData.values.length; rowIndex++) {
      const row = sheetData.values[rowIndex];
      if (!row || row.length === 0) continue;
      
      // Lấy dữ liệu HTML cho hàng này nếu có
      const htmlRow = sheetData.htmlData?.[rowIndex]?.values || [];
      
      // Xử lý hàng
      const processedRow = {};
      const urls = [];
      const hyperlinks = [];
      
      row.forEach((cell, colIndex) => {
        // Lưu giá trị gốc của ô
        processedRow[`col${colIndex}`] = cell;
        
        // Xử lý hyperlink từ dữ liệu HTML
        const htmlCell = htmlRow[colIndex];
        const hyperlink = htmlCell?.hyperlink;
        
        if (hyperlink) {
          // Lưu hyperlink vào danh sách
          hyperlinks.push({
            col: colIndex,
            url: hyperlink
          });
          
          // Xử lý URL dựa trên loại
          if (isYoutubeUrl(hyperlink)) {
            const cleanUrl = cleanYoutubeUrl(hyperlink);
            urls.push({
              colIndex,
              url: cleanUrl,
              source: 'hyperlink',
              type: 'youtube'
            });
          } else if (isDriveUrl(hyperlink)) {
            const cleanUrl = cleanGoogleUrl(hyperlink);
            urls.push({
              colIndex,
              url: cleanUrl,
              source: 'hyperlink',
              type: 'drive'
            });
          }
        } 
        // Trích xuất URL từ nội dung ô nếu không có hyperlink
        else if (cell && typeof cell === 'string') {
          const extractedUrl = extractUrlFromCell(cell);
          if (extractedUrl) {
            if (isYoutubeUrl(extractedUrl)) {
              const cleanUrl = cleanYoutubeUrl(extractedUrl);
              urls.push({
                colIndex,
                url: cleanUrl,
                source: 'text',
                type: 'youtube'
              });
            } else if (isDriveUrl(extractedUrl)) {
              const cleanUrl = cleanGoogleUrl(extractedUrl);
              urls.push({
                colIndex,
                url: cleanUrl,
                source: 'text',
                type: 'drive'
              });
            }
          }
        }
      });
      
      // Thêm hàng đã xử lý vào mảng
      rows.push({
        rowIndex: rowIndex - 1, // Điều chỉnh index để bắt đầu từ 0 cho mảng rows
        data: row,
        processedData: {
          ...processedRow,
          urls
        },
        hyperlinks: hyperlinks.length > 0 ? hyperlinks : undefined
      });
    }
    
    // Tạo document sheet
    const sheetDocument = {
      sheetId,
      name: sheetName,
      totalRows: rows.length,
      header,
      rows,
      processedAt: new Date(),
      metadata: {
        source: 'Google Sheets',
        processedBy: options.processedBy || 'SheetProcessor',
        version: '3.1',
        preserveHyperlinks: true,
        stats: {
          totalHyperlinks: hyperlinkCount,
          youtubeLinks: youtubeCount
        }
      }
    };
    
    // Tạo mới document
    const newSheetContent = new SheetContent(sheetDocument);
    const result = await newSheetContent.save();
    
    console.log(`Đã xử lý và lưu sheet ${sheetId} với ${rows.length} hàng vào database`);
    console.log(`Thống kê: ${youtubeCount} YouTube links, ${hyperlinkCount} tổng số hyperlinks`);
    
    return {
      success: true,
      processedCount: rows.length,
      hyperlinkCount,
      youtubeCount,
      errors: 0,
      documentId: result._id
    };
  } catch (error) {
    console.error('Lỗi xử lý sheet vào database:', error);
    return {
      success: false,
      error: error.message,
      processedCount: 0
    };
  }
}

/**
 * Xóa tất cả dữ liệu đã xử lý của một sheet
 * @param {string} sheetId - Google Sheet ID
 * @returns {Object} Kết quả của thao tác
 */
export async function clearProcessedSheetData(sheetId) {
  try {
    const deleteResult = await SheetContent.deleteOne({ sheetId });
    console.log(`Đã xóa ${deleteResult.deletedCount} bản ghi của sheet ${sheetId}`);
    
    return {
      success: true,
      deleted: deleteResult.deletedCount
    };
  } catch (error) {
    console.error('Lỗi khi xóa dữ liệu sheet đã xử lý:', error);
    throw error;
  }
}

/**
 * Lấy dữ liệu sheet đã xử lý từ database
 * @param {string} sheetId - Google Sheet ID
 * @param {Object} options - Tùy chọn truy vấn
 * @returns {Object} Dữ liệu sheet đã xử lý
 */
export async function getProcessedSheetData(sheetId, options = {}) {
  try {
    // Tìm nội dung sheet trong database
    const sheetContent = await SheetContent.findOne({ sheetId }).lean();
    
    if (!sheetContent) {
      return {
        data: null,
        pagination: {
          page: 1,
          limit: 0,
          total: 0,
          pages: 0
        }
      };
    }
    
    // Áp dụng phân trang nếu yêu cầu
    const { page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;
    
    // Lấy một tập con các hàng dựa trên phân trang
    const paginatedRows = sheetContent.rows.slice(skip, skip + limit);
    
    return {
      data: {
        _id: sheetContent._id,
        sheetId: sheetContent.sheetId,
        name: sheetContent.name || '',
        header: sheetContent.header,
        rows: paginatedRows,
        totalRows: sheetContent.totalRows,
        processedAt: sheetContent.processedAt
      },
      pagination: {
        page,
        limit,
        total: sheetContent.totalRows,
        pages: Math.ceil(sheetContent.totalRows / limit)
      }
    };
  } catch (error) {
    console.error('Lỗi khi lấy dữ liệu sheet đã xử lý:', error);
    throw error;
  }
}

// Hàm trợ giúp để lấy dữ liệu sheet với cache
async function fetchSheetDataWithCache(sheetId, useCache) {
  const { fetchSheetDataWithCache } = await import('./sheet-cache-manager');
  return fetchSheetDataWithCache(sheetId, useCache);
} 