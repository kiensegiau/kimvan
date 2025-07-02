import { NextResponse } from 'next/server';
import { dbMiddleware } from '@/utils/db-middleware';
import Sheet from '@/models/Sheet';
import SheetContent from '@/models/SheetContent';
import { ObjectId } from 'mongodb';
import { authMiddleware } from '@/lib/auth';
import { processSheetToDatabase, clearProcessedSheetData } from '@/utils/sheet-processing-worker';

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

// POST /api/sheets/[id]/process-to-db - Process sheet data to database
export async function POST(request, { params }) {
  try {
    // Check authentication
    const auth = await checkAuth(request);
    if (!auth.isAuthorized) {
      return auth.response;
    }

    await dbMiddleware(request);
    const { id } = await params;
    
    // Parse request body
    let requestBody = {};
    try {
      requestBody = await request.json();
    } catch (error) {
      // If no body or invalid JSON, use default options
      console.log('No request body or invalid JSON, using defaults');
    }
    
    const options = {
      useCache: requestBody.useCache !== false,
      forceRefresh: requestBody.forceRefresh === true,
      processedBy: 'API Request'
    };
    
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
    
    // Start processing in the background
    // We'll return a success response immediately and continue processing
    const processingPromise = processSheetToDatabase(sheet.sheetId, options);
    
    // If background is false, wait for processing to complete
    if (requestBody.background === false) {
      const result = await processingPromise;
      return NextResponse.json({
        success: true,
        message: 'Sheet processing completed',
        sheet: {
          _id: sheet._id,
          name: sheet.name,
          sheetId: sheet.sheetId
        },
        stats: {
          processedCount: result.processedCount,
          errors: result.errors || 0
        }
      });
    }
    
    // Otherwise, return immediately with a background processing message
    return NextResponse.json({
      success: true,
      message: 'Sheet processing started in background',
      sheet: {
        _id: sheet._id,
        name: sheet.name,
        sheetId: sheet.sheetId
      }
    });
  } catch (error) {
    console.error('Error processing sheet to database:', error);
    return NextResponse.json(
      { success: false, error: 'Error processing sheet: ' + error.message },
      { status: 500 }
    );
  }
}

// GET /api/sheets/[id]/process-to-db - Check processing status
export async function GET(request, { params }) {
  try {
    // Check authentication
    const auth = await checkAuth(request);
    if (!auth.isAuthorized) {
      return auth.response;
    }

    await dbMiddleware(request);
    const { id } = await params;
    
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
    
    // Check if sheet content exists
    const sheetContent = await SheetContent.findOne({ sheetId: sheet.sheetId }).select('_id totalRows processedAt').lean();
    
    if (!sheetContent) {
      return NextResponse.json({
        success: true,
        sheet: {
          _id: sheet._id,
          name: sheet.name,
          sheetId: sheet.sheetId
        },
        processed: false,
        message: 'Sheet has not been processed to database yet'
      });
    }
    
    return NextResponse.json({
      success: true,
      sheet: {
        _id: sheet._id,
        name: sheet.name,
        sheetId: sheet.sheetId
      },
      processed: true,
      stats: {
        totalRows: sheetContent.totalRows || 0,
        processedAt: sheetContent.processedAt
      }
    });
  } catch (error) {
    console.error('Error checking processing status:', error);
    return NextResponse.json(
      { success: false, error: 'Error checking status: ' + error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/sheets/[id]/process-to-db - Clear processed sheet data
export async function DELETE(request, { params }) {
  try {
    // Check authentication
    const auth = await checkAuth(request);
    if (!auth.isAuthorized) {
      return auth.response;
    }

    await dbMiddleware(request);
    const { id } = await params;
    
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
    
    // Clear processed data
    const result = await clearProcessedSheetData(sheet.sheetId);
    
    return NextResponse.json({
      success: true,
      message: 'Processed sheet data cleared',
      sheet: {
        _id: sheet._id,
        name: sheet.name,
        sheetId: sheet.sheetId
      },
      deleted: result.deleted
    });
  } catch (error) {
    console.error('Error clearing processed sheet data:', error);
    return NextResponse.json(
      { success: false, error: 'Error clearing processed data: ' + error.message },
      { status: 500 }
    );
  }
} 