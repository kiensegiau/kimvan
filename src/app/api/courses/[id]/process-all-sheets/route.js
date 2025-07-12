import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Course from '@/models/Course';
import Sheet from '@/models/Sheet';
import mongoose from 'mongoose';

// Thêm route GET để kiểm tra dữ liệu sheetsData
export async function GET(req, { params }) {
  const { id } = params;
  
  try {
    await connectToDatabase();
    const course = await Course.findById(id).lean();
    
    if (!course) {
      return NextResponse.json({ success: false, message: 'Course not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      course: {
        _id: course._id,
        name: course.name,
        hasSheets: Array.isArray(course.sheets),
        sheetsCount: Array.isArray(course.sheets) ? course.sheets.length : 0,
        hasSheetsData: Array.isArray(course.sheetsData),
        sheetsDataCount: Array.isArray(course.sheetsData) ? course.sheetsData.length : 0,
        lastSyncedAt: course.lastSyncedAt
      }
    });
  } catch (error) {
    console.error(`❌ [API] process-all-sheets GET: Error:`, error);
    return NextResponse.json({ 
      success: false, 
      message: `Error getting course data: ${error.message}` 
    }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { id } = params;
  console.log(`🔄 [API] process-all-sheets: Starting process for course ID: ${id}`);
  
  try {
    // Connect to the database using the existing utility
    console.log(`🔄 [API] process-all-sheets: Connecting to database...`);
    await connectToDatabase();
    console.log(`✅ [API] process-all-sheets: Connected to database successfully`);

    // Find the course by ID
    console.log(`🔄 [API] process-all-sheets: Finding course with ID ${id}...`);
    const course = await Course.findById(id).lean();
    if (!course) {
      console.error(`❌ [API] process-all-sheets: Course not found with ID ${id}`);
      return NextResponse.json({ success: false, message: 'Course not found' }, { status: 404 });
    }
    console.log(`✅ [API] process-all-sheets: Found course: ${course.name}`);
    console.log(`🔄 [API] process-all-sheets: Course schema has sheetsData:`, 
               !!Course.schema.paths.sheetsData, 
               'Type:', Course.schema.paths.sheetsData ? Course.schema.paths.sheetsData.instance : 'undefined');

    // Get all sheets related to this course
    console.log(`🔄 [API] process-all-sheets: Finding sheets for course ID ${id}...`);
    console.log(`🔄 [API] process-all-sheets: Course.sheets array:`, course.sheets);
    
    const sheets = await Sheet.find({ _id: { $in: course.sheets || [] } }).lean();
    console.log(`✅ [API] process-all-sheets: Found ${sheets.length} sheets`);
    
    if (!sheets || sheets.length === 0) {
      console.error(`❌ [API] process-all-sheets: No sheets found for course ${id}`);
      return NextResponse.json({ success: false, message: 'No sheets found for this course' }, { status: 404 });
    }

    const results = [];
    const errors = [];
    const updatedSheetData = [];

    // Process each sheet - this updates the database with sheet data
    console.log(`🔄 [API] process-all-sheets: Processing ${sheets.length} sheets...`);
    for (const sheet of sheets) {
      try {
        console.log(`🔄 [API] process-all-sheets: Processing sheet ID ${sheet._id} (${sheet.title || sheet.name || 'Unnamed'})...`);
        console.log(`🔄 [API] process-all-sheets: Sheet data keys:`, Object.keys(sheet));
        console.log(`🔄 [API] process-all-sheets: Sheet data structure:`, {
          hasValues: !!sheet.values,
          valuesType: sheet.values ? typeof sheet.values : 'undefined',
          valuesLength: sheet.values ? sheet.values.length : 0,
          hasData: !!sheet.data,
          dataType: sheet.data ? typeof sheet.data : 'undefined'
        });
        
        // Lấy dữ liệu chi tiết từ sheet từ endpoint from-db
        console.log(`🔄 [API] process-all-sheets: Fetching detailed data for sheet ${sheet._id}...`);
        const detailedSheetResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/sheets/${sheet._id}/from-db`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': req.headers.get('cookie') || ''
          }
        });
        
        if (!detailedSheetResponse.ok) {
          throw new Error(`Failed to fetch detailed sheet data: ${detailedSheetResponse.status}`);
        }
        
        const detailedSheetData = await detailedSheetResponse.json();
        console.log(`✅ [API] process-all-sheets: Retrieved detailed sheet data:`, {
          success: detailedSheetData.success,
          hasSheet: !!detailedSheetData.sheet,
          sheetDataKeys: detailedSheetData.sheet ? Object.keys(detailedSheetData.sheet) : []
        });
        
        if (!detailedSheetData.success || !detailedSheetData.sheet) {
          throw new Error('Failed to get detailed sheet data');
        }
        
        const detailedSheet = detailedSheetData.sheet;
        
        // Update the sheet in the database
        const updatedSheet = await Sheet.findByIdAndUpdate(
          sheet._id,
          {
            $set: {
              values: detailedSheet.values || [],
              rows: detailedSheet.rows || [],
              header: detailedSheet.header || [],
              hyperlinks: detailedSheet.hyperlinks || [],
              htmlData: detailedSheet.htmlData || [],
              merges: detailedSheet.merges || [],
              updatedAt: new Date()
            }
          },
          { new: true }
        ).lean();

        console.log(`✅ [API] process-all-sheets: Sheet ${sheet._id} updated successfully`);
        console.log(`✅ [API] process-all-sheets: Updated sheet data structure:`, {
          hasValues: !!updatedSheet.values,
          valuesType: updatedSheet.values ? typeof updatedSheet.values : 'undefined',
          valuesLength: updatedSheet.values ? updatedSheet.values.length : 0
        });

        // Add to the updated sheet data array
        updatedSheetData.push({
          _id: updatedSheet._id,
          title: updatedSheet.title,
          name: updatedSheet.name,
          values: detailedSheet.values || [],
          rows: detailedSheet.rows || [],
          header: detailedSheet.header || [],
          hyperlinks: detailedSheet.hyperlinks || [],
          htmlData: detailedSheet.htmlData || [],
          merges: detailedSheet.merges || []
        });

        results.push({
          sheetId: sheet._id,
          title: sheet.title || sheet.name,
          success: true
        });
      } catch (error) {
        console.error(`❌ [API] process-all-sheets: Error processing sheet ${sheet._id}:`, error);
        errors.push({
          sheetId: sheet._id,
          title: sheet.title || sheet.name,
          error: error.message
        });
      }
    }

    // Update the course's lastSyncedAt field AND the sheetsData field
    console.log(`🔄 [API] process-all-sheets: Updating course with sheets data...`);
    console.log(`🔄 [API] process-all-sheets: updatedSheetData array length: ${updatedSheetData.length}`);
    console.log(`🔄 [API] process-all-sheets: Sample sheet data:`, 
                updatedSheetData.length > 0 ? {
                  _id: updatedSheetData[0]._id,
                  title: updatedSheetData[0].title,
                  name: updatedSheetData[0].name,
                  hasValues: !!updatedSheetData[0].values,
                  valueCount: updatedSheetData[0].values ? updatedSheetData[0].values.length : 0
                } : 'No sheets');
    
    const beforeUpdate = await Course.findById(id).lean();
    console.log(`🔄 [API] process-all-sheets: Before update, course has sheetsData:`, !!beforeUpdate.sheetsData);
    
    // Dump course schema
    console.log(`🔄 [API] process-all-sheets: Course model schema keys:`, Object.keys(Course.schema.paths));
    
    const updateData = {
      lastSyncedAt: new Date(),
      sheetsData: updatedSheetData
    };
    
    console.log(`🔄 [API] process-all-sheets: Update data:`, {
      lastSyncedAt: updateData.lastSyncedAt,
      sheetsDataLength: updateData.sheetsData.length
    });
    
    const updatedCourse = await Course.findByIdAndUpdate(id, {
      $set: updateData
    }, { new: true }).lean();

    console.log(`✅ [API] process-all-sheets: Course updated successfully: ${!!updatedCourse}`);
    console.log(`✅ [API] process-all-sheets: Updated course has sheetsData:`, !!updatedCourse.sheetsData);
    console.log(`✅ [API] process-all-sheets: Updated course sheetsData length:`, 
                updatedCourse.sheetsData ? updatedCourse.sheetsData.length : 0);

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} sheets successfully${errors.length > 0 ? ` with ${errors.length} errors` : ''}`,
      results,
      courseUpdated: !!updatedCourse,
      hasSheetsData: !!updatedCourse.sheetsData,
      sheetsDataCount: updatedCourse.sheetsData ? updatedCourse.sheetsData.length : 0,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error(`❌ [API] process-all-sheets: Error processing all sheets:`, error);
    return NextResponse.json({ 
      success: false, 
      message: `Error processing sheets: ${error.message}` 
    }, { status: 500 });
  }
} 