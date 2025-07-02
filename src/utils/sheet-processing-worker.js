import { processAndSyncSheet } from './sheet-cache-manager';
import SheetContent from '@/models/SheetContent';
import mongoose from 'mongoose';
import { extractUrlFromCell, isDriveUrl, cleanGoogleUrl } from '@/utils/drive-utils';

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
    if (sheetData.htmlData) {
      sheetData.htmlData.forEach((row, rowIndex) => {
        if (row && row.values) {
          row.values.forEach((cell, cellIndex) => {
            if (cell && cell.hyperlink) {
              hyperlinkCount++;
              console.log(`Tìm thấy hyperlink tại [${rowIndex},${cellIndex}]: ${cell.hyperlink}`);
            }
          });
        }
      });
    }
    console.log(`Tổng số hyperlink tìm thấy trong dữ liệu gốc: ${hyperlinkCount}`);
    
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
          
          const cleanUrl = cleanGoogleUrl(hyperlink);
          if (isDriveUrl(cleanUrl)) {
            urls.push({
              colIndex,
              url: cleanUrl,
              source: 'hyperlink'
            });
          }
        } 
        // Trích xuất URL từ nội dung ô nếu không có hyperlink
        else if (cell && typeof cell === 'string') {
          const extractedUrl = extractUrlFromCell(cell);
          if (extractedUrl && isDriveUrl(extractedUrl)) {
            urls.push({
              colIndex,
              url: extractedUrl,
              source: 'text'
            });
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
    
    // Đảm bảo dữ liệu HTML được giữ nguyên
    let formattedHtmlData = [];
    if (sheetData.htmlData && Array.isArray(sheetData.htmlData)) {
      // Chuẩn hóa cấu trúc dữ liệu HTML
      formattedHtmlData = sheetData.htmlData.map((row, rowIndex) => {
        if (!row) return { values: [] };
        
        // Nếu row đã có cấu trúc { values: [...] }
        if (row.values && Array.isArray(row.values)) {
          return row;
        }
        // Nếu row là một mảng, chuyển đổi sang cấu trúc chuẩn
        else if (Array.isArray(row)) {
          return {
            values: row.map(cell => {
              // Giữ lại thông tin hyperlink nếu có
              if (cell && typeof cell === 'object') {
                return cell;
              }
              // Chuyển đổi giá trị đơn giản thành đối tượng
              return { formattedValue: cell };
            })
          };
        }
        // Trường hợp khác, trả về đối tượng rỗng
        return { values: [] };
      });
      
      // Kiểm tra và log số lượng hyperlink sau khi chuẩn hóa
      let hyperlinkCount = 0;
      formattedHtmlData.forEach((row, rowIndex) => {
        if (row && row.values && Array.isArray(row.values)) {
          row.values.forEach((cell, cellIndex) => {
            if (cell && cell.hyperlink) {
              hyperlinkCount++;
              console.log(`Hyperlink sau chuẩn hóa [${rowIndex},${cellIndex}]: ${cell.hyperlink}`);
            }
          });
        }
      });
      console.log(`Tổng số hyperlink sau chuẩn hóa: ${hyperlinkCount}`);
    }
    
    // Tạo document sheet
    const sheetDocument = {
      sheetId,
      totalRows: rows.length,
      header,
      rows,
      htmlData: formattedHtmlData,
      processedAt: new Date(),
      metadata: {
        source: 'Google Sheets',
        processedBy: options.processedBy || 'SheetProcessor',
        version: '3.0',
        preserveHyperlinks: true
      }
    };
    
    // Tạo mới document
    const newSheetContent = new SheetContent(sheetDocument);
    const result = await newSheetContent.save();
    
    console.log(`Đã xử lý và lưu sheet ${sheetId} với ${rows.length} hàng vào database`);
    
    return {
      success: true,
      processedCount: rows.length,
      hyperlinkCount,
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
        header: sheetContent.header,
        rows: paginatedRows,
        htmlData: sheetContent.htmlData,
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