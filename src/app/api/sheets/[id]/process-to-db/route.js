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
    
    if (!params || !params.id) {
      return NextResponse.json(
        { success: false, error: 'Missing sheet ID parameter' },
        { status: 400 }
      );
    }
    
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
    
    // Parse request body
    let requestBody = {};
    try {
      requestBody = await request.json();
    } catch (error) {
      console.log('No request body or invalid JSON, using defaults');
    }
    
    // Xử lý dữ liệu sheet vào database
    console.log(`Bắt đầu xử lý sheet: ${sheet.name} (ID: ${sheet.sheetId})`);
    
    // Nếu yêu cầu xử lý đồng bộ
    if (requestBody.background === false) {
      const result = await processSheetToDatabase(sheet.sheetId);
      
      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Đã xử lý dữ liệu sheet vào database' : result.error,
        sheet: {
          _id: sheet._id,
          name: sheet.name,
          sheetId: sheet.sheetId
        },
        stats: {
          processedCount: result.processedCount || 0,
          errors: result.errors || 0
        }
      });
    }
    
    // Nếu xử lý nền (background)
    processSheetToDatabase(sheet.sheetId).then(result => {
      console.log(`Hoàn tất xử lý sheet ${sheet.sheetId} trong nền:`, result);
    }).catch(error => {
      console.error(`Lỗi xử lý sheet ${sheet.sheetId} trong nền:`, error);
    });
    
    return NextResponse.json({
      success: true,
      message: 'Đã bắt đầu xử lý sheet trong nền',
      sheet: {
        _id: sheet._id,
        name: sheet.name,
        sheetId: sheet.sheetId
      }
    });
  } catch (error) {
    console.error('Lỗi xử lý sheet vào database:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi xử lý sheet: ' + error.message },
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
    
    if (!params || !params.id) {
      return NextResponse.json(
        { success: false, error: 'Missing sheet ID parameter' },
        { status: 400 }
      );
    }
    
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
    const sheetContent = await SheetContent.findOne({ sheetId: sheet.sheetId }).select('_id totalRows processedAt metadata').lean();
    
    if (!sheetContent) {
      return NextResponse.json({
        success: true,
        sheet: {
          _id: sheet._id,
          name: sheet.name,
          sheetId: sheet.sheetId
        },
        processed: false,
        message: 'Sheet chưa được xử lý vào database'
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
        processedAt: sheetContent.processedAt,
        version: sheetContent.metadata?.version || 'unknown'
      }
    });
  } catch (error) {
    console.error('Lỗi kiểm tra trạng thái xử lý:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi kiểm tra trạng thái: ' + error.message },
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
    
    if (!params || !params.id) {
      return NextResponse.json(
        { success: false, error: 'Missing sheet ID parameter' },
        { status: 400 }
      );
    }
    
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
      message: 'Đã xóa dữ liệu sheet đã xử lý',
      sheet: {
        _id: sheet._id,
        name: sheet.name,
        sheetId: sheet.sheetId
      },
      deleted: result.deleted
    });
  } catch (error) {
    console.error('Lỗi khi xóa dữ liệu sheet đã xử lý:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi xóa dữ liệu đã xử lý: ' + error.message },
      { status: 500 }
    );
  }
} 