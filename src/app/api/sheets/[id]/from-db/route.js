import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import Sheet from '@/models/Sheet';
import SheetContent from '@/models/SheetContent';
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
  const { id } = await params;
  try {
    // Check authentication
    const auth = await checkAuth(request);
    if (!auth.isAuthorized) {
      return auth.response;
    }

    await dbMiddleware(request);
    
    // Parse URL parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '1000');
    const fallbackToApi = url.searchParams.get('fallbackToApi') !== 'false';
    
    // Find sheet in the database
    let sheet;
    if (ObjectId.isValid(id)) {
      sheet = await Sheet.findById(id);
    } else {
      sheet = await Sheet.findOne({ sheetId: id });
    }
    
    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Sheet not found' },
        { status: 404 }
      );
    }
    
    // Get content directly from SheetContent collection
    const sheetContent = await SheetContent.findOne({ sheetId: sheet.sheetId }).lean();
    
    // If no data in DB and fallback is enabled, get from Google Sheets API
    if (!sheetContent && fallbackToApi) {
      console.log('No data in database, falling back to Google Sheets API');
      
      try {
        // Try to get from cache or API
        const apiData = await fetchSheetDataWithCache(sheet.sheetId);
        
        return NextResponse.json({
          success: true,
          source: 'api',
          sheetId: sheet.sheetId,
          sheet: {
            _id: sheet._id,
            name: sheet.name,
            sheetId: sheet.sheetId
          },
          data: apiData,
          pagination: {
            page: 1,
            limit: apiData.values?.length || 0,
            total: apiData.values?.length || 0,
            pages: 1
          }
        });
      } catch (apiError) {
        console.error('Error fetching from API:', apiError);
        return NextResponse.json(
          { 
            success: false, 
            error: 'No data found in database and failed to fetch from Google Sheets API' 
          },
          { status: 404 }
        );
      }
    }
    
    if (sheetContent) {
      // Format data to match Google Sheets API format
      const formattedData = formatSheetDataFromDb(sheetContent);
      
      return NextResponse.json({
        success: true,
        source: 'database',
        sheetId: sheet.sheetId,
        sheet: {
          _id: sheet._id,
          name: sheet.name,
          sheetId: sheet.sheetId
        },
        data: formattedData,
        pagination: {
          page: 1,
          limit: sheetContent.rows?.length || 0,
          total: sheetContent.totalRows || 0,
          pages: 1
        },
        processedAt: sheetContent.processedAt
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'No data found for this sheet in database' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error getting sheet data from database:', error);
    return NextResponse.json(
      { success: false, error: 'Error getting sheet data: ' + error.message },
      { status: 500 }
    );
  }
} 