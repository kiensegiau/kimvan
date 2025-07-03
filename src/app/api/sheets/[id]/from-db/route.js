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
  
  // Add data rows
  sheetContent.rows.forEach(row => {
    values.push(row.data);
  });
  
  // Create structured rows with header keys
  const structuredRows = sheetContent.rows.map(row => {
    const rowObj = {};
    header.forEach((headerCol, index) => {
      rowObj[headerCol] = row.data[index] || '';
    });
    
    // Extract hyperlinks from processedData.urls if available
    if (row.processedData && Array.isArray(row.processedData.urls)) {
      rowObj._hyperlinks = {};
      row.processedData.urls.forEach(urlData => {
        if (urlData && urlData.colIndex !== undefined && urlData.url) {
          const colIndex = urlData.colIndex;
          if (colIndex >= 0 && colIndex < header.length) {
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
            url: urlData.url
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
          url: link.url
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
    
    // Find processed content
    const sheetContent = await SheetContent.findOne({ sheetId }).lean();
    
    // If no content in database, try to process it first
    if (!sheetContent) {
      try {
        // Process the sheet data
        const result = await processSheetToDatabase(sheetId);
        
        if (result.success) {
          // Get the newly processed content
          const newSheetContent = await SheetContent.findOne({ sheetId }).lean();
          
          if (newSheetContent) {
            // Format and return the newly processed data
            const formattedData = formatSheetDataFromDb(newSheetContent);
            
            // Add sheet name from Sheet model if available
            if (sheet && sheet.name && !formattedData.name) {
              formattedData.name = sheet.name;
            }
            
            return NextResponse.json({
              success: true,
              source: 'database',
              sheet: formattedData,
              pagination: {
                page: 1,
                limit,
                total: newSheetContent.rows?.length || 0,
                pages: Math.ceil((newSheetContent.rows?.length || 0) / limit)
              }
            });
          }
        }
      } catch (error) {
        console.error('Error processing sheet data:', error);
      }
      
      // If processing failed or no data was found
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
    
    // Format data using helper function
    const formattedData = formatSheetDataFromDb(sheetContent);
    
    // Add sheet name from Sheet model if available
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