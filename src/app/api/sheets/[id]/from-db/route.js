import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import SheetContent from '@/models/SheetContent';
import Sheet from '@/models/Sheet';
import { ObjectId } from 'mongodb';
import { authMiddleware } from '@/lib/auth';
import { getProcessedSheetData } from '@/utils/sheet-processing-worker';
import { fetchSheetDataWithCache } from '@/utils/sheet-cache-manager';

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
    return {
      values: [],
      htmlData: []
    };
  }
  
  // Extract header
  const header = sheetContent.header || [];
  
  // Create values array (starts with header)
  const values = [header];
  
  // Add data rows
  sheetContent.rows.forEach(row => {
    values.push(row.data);
  });
  
  // Create htmlData structure if available
  let htmlData = [];
  if (sheetContent.htmlData && sheetContent.htmlData.length > 0) {
    htmlData = sheetContent.htmlData;
  } else {
    // Create basic htmlData from rows if not available
    htmlData = values.map(row => ({
      values: row.map(cell => ({ formattedValue: cell }))
    }));
  }
  
  return {
    values,
    htmlData,
    fetchedAt: sheetContent.processedAt
  };
}

// GET /api/sheets/[id]/from-db - Get sheet data from database
export async function GET(request, { params }) {
  try {
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
    
    // Find processed content
    const sheetContent = await SheetContent.findOne({ sheetId }).lean();
    
    // If no content in database and fallback is requested
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
    
    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedRows = sheetContent.rows.slice(skip, skip + limit);
    
    // Convert data to Google Sheets API format
    const values = [sheetContent.header || []];
    
    // Add rows data
    paginatedRows.forEach(row => {
      if (row.data && Array.isArray(row.data)) {
        values.push(row.data);
      }
    });
    
    // Format HTML data based on storage mode
    let htmlData = [];
    
    // Chế độ lưu trữ đầy đủ
    if (sheetContent.htmlData && Array.isArray(sheetContent.htmlData)) {
      htmlData = sheetContent.htmlData;
    } 
    // Chế độ lưu trữ tối ưu
    else if (sheetContent.optimizedHtmlData && sheetContent.optimizedHtmlData.length > 0) {
      // Tạo cấu trúc tương thích với cấu trúc cũ
      // Mỗi hàng là một mảng chứa các đối tượng ô có thuộc tính values
      const maxRows = Math.max(...sheetContent.optimizedHtmlData.map(row => row.rowIndex)) + 1;
      htmlData = Array(maxRows).fill(null).map(() => ({ values: [] }));
      
      // Điền thông tin hyperlink vào cấu trúc
      sheetContent.optimizedHtmlData.forEach(row => {
        if (!row.hyperlinks || !row.rowIndex) return;
        
        // Đảm bảo hàng tồn tại
        if (!htmlData[row.rowIndex]) {
          htmlData[row.rowIndex] = { values: [] };
        }
        
        // Điền hyperlink vào các ô tương ứng
        row.hyperlinks.forEach(link => {
          if (!htmlData[row.rowIndex].values[link.col]) {
            htmlData[row.rowIndex].values[link.col] = {};
          }
          htmlData[row.rowIndex].values[link.col].hyperlink = link.url;
        });
      });
    }
    
    // Format response similar to Google Sheets API
    const responseData = {
      values,
      htmlData,
      optimizedHtmlData: sheetContent.optimizedHtmlData || null, // Giữ cả cấu trúc tối ưu để client sử dụng trực tiếp
      totalRows: sheetContent.totalRows,
      processedAt: sheetContent.processedAt,
      storageMode: sheetContent.metadata?.storageMode || 'full'
    };
    
    // Return response
    return NextResponse.json({
      success: true,
      source: 'database',
      sheet: sheet || { sheetId },
      data: responseData,
      pagination: {
        page,
        limit,
        total: sheetContent.totalRows || 0,
        pages: Math.ceil((sheetContent.totalRows || 0) / limit)
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