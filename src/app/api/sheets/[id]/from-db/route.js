import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import SheetContent from '@/models/SheetContent';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';
import { authMiddleware } from '@/lib/auth';
import { getProcessedSheetData } from '@/utils/sheet-processing-worker';
import { fetchSheetDataWithCache } from '@/utils/sheet-cache-manager';
import { processSheetToDatabase } from '@/utils/sheet-processing-worker';

// Middleware helper function to verify user authentication
async function checkAuth(request) {
  const user = await authMiddleware(request);
  if (!user) {
    return {
      isAuthorized: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    };
  }
  return { isAuthorized: true, user };
}

// Helper function to format sheet data from DB to match the Google Sheets API format
function formatSheetDataFromDb(sheetContent) {
  if (!sheetContent || !sheetContent.rows || sheetContent.rows.length === 0) {
    // Nếu không có dữ liệu rows, trả về cấu trúc gốc
    return sheetContent || {
      values: [],
      htmlData: [],
      header: [],
      rows: [],
      fetchedAt: null,
      name: sheetContent?.name || ''
    };
  }
  
  // Extract header
  const header = sheetContent.header || [];
  
  // Create values array (starts with header)
  const values = [header];
  
  // Add data rows from processedData
  sheetContent.rows.forEach(row => {
    const rowData = [];
    // Lấy dữ liệu từ processedData.colX
    for (let i = 0; i < header.length; i++) {
      rowData.push(row.processedData[`col${i}`] || '');
    }
    values.push(rowData);
  });
  
  // Create structured rows with header keys
  const structuredRows = sheetContent.rows.map(row => {
    const rowObj = {};
    header.forEach((headerCol, index) => {
      rowObj[headerCol] = row.processedData[`col${index}`] || '';
    });
    
    // Extract hyperlinks from processedData.urls if available
    if (row.processedData && Array.isArray(row.processedData.urls)) {
      rowObj._hyperlinks = {};
      row.processedData.urls.forEach(urlData => {
        if (urlData && urlData.colIndex !== undefined && urlData.url) {
          const colIndex = urlData.colIndex;
          if (colIndex >= 0 && colIndex < header.length) {
            // Sử dụng URL đã có sẵn (có thể là proxy URL)
            rowObj._hyperlinks[header[colIndex]] = urlData.url;
          }
        }
      });
    }
    
    return rowObj;
  });
  
  // Extract all hyperlinks into a separate array
  let hyperlinks = [];
  sheetContent.rows.forEach((row, rowIndex) => {
    if (row.processedData && Array.isArray(row.processedData.urls)) {
      row.processedData.urls.forEach(urlData => {
        if (urlData && urlData.colIndex !== undefined && urlData.url) {
          hyperlinks.push({
            row: rowIndex,
            col: urlData.colIndex,
            url: urlData.url  // Use the URL as-is, already proxy URL
          });
        }
      });
    }
  });
  
  // Also extract hyperlinks from optimized storage if available
  if (sheetContent.metadata?.storageMode === 'optimized' && sheetContent.optimizedHtmlData) {
    sheetContent.optimizedHtmlData.forEach(row => {
      if (row.hyperlinks && Array.isArray(row.hyperlinks)) {
        hyperlinks = hyperlinks.concat(row.hyperlinks.map(link => ({
          row: row.rowIndex,
          col: link.col,
          url: link.url  // Use the URL as-is, already proxy URL
        })));
      }
    });
  }
  
  // Trả về dữ liệu đã định dạng
  return {
    values,
    rows: structuredRows,
    header,
    hyperlinks,
    htmlData: sheetContent.htmlData || [],
    optimizedHtmlData: sheetContent.optimizedHtmlData || null,
    storageMode: sheetContent.metadata?.storageMode || 'full',
    fetchedAt: sheetContent.processedAt,
    name: sheetContent.name || ''
  };
}

// GET /api/sheets/[id]/from-db - Get sheet data from database
export async function GET(request, { params }) {
  try {
    // Check authentication
    const auth = await checkAuth(request);
    if (!auth.isAuthorized) {
      return auth.response;
    }

    await dbMiddleware(request);
    
    // Get parameters
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing sheet ID' },
        { status: 400 }
      );
    }
    
    // Get URL parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const fallbackToApi = url.searchParams.get('fallbackToApi') === 'true';
    
    // Find sheet
    let sheet;
    let sheetId = id;
    
    if (ObjectId.isValid(id)) {
      sheet = await Sheet.findById(id).lean();
      if (sheet) {
        sheetId = sheet.sheetId;
      }
    } else {
      sheet = await Sheet.findOne({ sheetId: id }).lean();
    }
    
    if (!sheet && !fallbackToApi) {
      return NextResponse.json(
        { success: false, error: 'Sheet not found' },
        { status: 404 }
      );
    }
    
    // Lấy dữ liệu từ database
    const sheetContent = await SheetContent.findOne({ sheetId }).lean();
    
    // Nếu không có dữ liệu, kiểm tra fallbackToApi
    if (!sheetContent) {
      if (fallbackToApi) {
        return NextResponse.json({
          success: true,
          source: 'none',
          needsFallback: true,
          message: 'No processed data found in database'
        });
      }
      
      return NextResponse.json(
        { success: false, error: 'No processed data found for this sheet' },
        { status: 404 }
      );
    }
    
    // Format dữ liệu và trả về
    const formattedData = formatSheetDataFromDb(sheetContent);
    
    // Thêm tên sheet từ Sheet model nếu có
    if (sheet && sheet.name && !formattedData.name) {
      formattedData.name = sheet.name;
    }
    
    // Return response
    return NextResponse.json({
      success: true,
      source: 'database',
      sheet: formattedData,
      pagination: {
        page,
        limit,
        total: sheetContent.rows?.length || 0,
        pages: Math.ceil((sheetContent.rows?.length || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Error getting sheet data from DB:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
} 