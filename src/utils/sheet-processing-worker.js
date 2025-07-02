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
  console.log(`Starting processing of sheet ${sheetId} to database`);
  
  // Connect to MongoDB if needed
  if (mongoose.connection.readyState !== 1) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('Error connecting to MongoDB:', error);
      return { success: false, error: 'Database connection failed' };
    }
  }
  
  try {
    // Fetch data from Google Sheets (with caching)
    const sheetData = await fetchSheetDataWithCache(sheetId, options.useCache !== false && !options.forceRefresh);
    
    if (!sheetData.values || sheetData.values.length === 0) {
      return {
        success: false,
        error: 'Sheet has no data',
        processedCount: 0
      };
    }
    
    // Process the entire sheet
    const header = sheetData.values[0] || [];
    const rows = [];
    
    // Process each row (skip header)
    for (let rowIndex = 1; rowIndex < sheetData.values.length; rowIndex++) {
      const row = sheetData.values[rowIndex];
      if (!row || row.length === 0) continue;
      
      // Extract HTML data for this row if available
      const htmlRow = sheetData.htmlData?.[rowIndex]?.values || [];
      
      // Process the row
      const processedRow = {};
      const urls = [];
      
      row.forEach((cell, colIndex) => {
        // Store original cell value
        processedRow[`col${colIndex}`] = cell;
        
        // Process hyperlinks from HTML data
        const htmlCell = htmlRow[colIndex];
        const hyperlink = htmlCell?.hyperlink;
        
        if (hyperlink) {
          const cleanUrl = cleanGoogleUrl(hyperlink);
          if (isDriveUrl(cleanUrl)) {
            urls.push({
              colIndex,
              url: cleanUrl,
              source: 'hyperlink'
            });
          }
        } 
        // Extract URL from cell content if no hyperlink found
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
      
      // Add the processed row to the array
      rows.push({
        rowIndex: rowIndex - 1, // Adjust index to be 0-based for rows array
        data: row,
        processedData: {
          ...processedRow,
          urls
        }
      });
    }
    
    // Prepare htmlData in a format suitable for storage
    const formattedHtmlData = sheetData.htmlData ? 
      sheetData.htmlData.map(row => row?.values || []) : 
      [];
    
    // Create the sheet document
    const sheetDocument = {
      sheetId,
      totalRows: rows.length,
      header,
      rows,
      htmlData: formattedHtmlData,
      processedAt: new Date(),
      metadata: {
        source: 'Google Sheets',
        processedBy: options.processedBy || 'SheetProcessor'
      }
    };
    
    // Save to database (use upsert to update if exists or create if not)
    const result = await SheetContent.findOneAndUpdate(
      { sheetId },
      sheetDocument,
      { upsert: true, new: true }
    );
    
    console.log(`Processed and saved sheet ${sheetId} with ${rows.length} rows to database`);
    
    return {
      success: true,
      processedCount: rows.length,
      errors: 0,
      documentId: result._id
    };
  } catch (error) {
    console.error('Error processing sheet to database:', error);
    return {
      success: false,
      error: error.message,
      processedCount: 0
    };
  }
}

/**
 * Get processed sheet data from database
 * @param {string} sheetId - Google Sheet ID
 * @param {Object} options - Query options
 * @returns {Object} Processed sheet data
 */
export async function getProcessedSheetData(sheetId, options = {}) {
  try {
    // Find the sheet content in database
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
    
    // Apply pagination if requested
    const { page = 1, limit = 100 } = options;
    const skip = (page - 1) * limit;
    
    // Get a subset of rows based on pagination
    const paginatedRows = sheetContent.rows.slice(skip, skip + limit);
    
    return {
      data: {
        _id: sheetContent._id,
        sheetId: sheetContent.sheetId,
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
    console.error('Error getting processed sheet data:', error);
    throw error;
  }
}

/**
 * Delete all processed data for a sheet
 * @param {string} sheetId - Google Sheet ID
 * @returns {Object} Result of the operation
 */
export async function clearProcessedSheetData(sheetId) {
  try {
    const result = await SheetContent.deleteOne({ sheetId });
    
    return {
      success: true,
      deleted: result.deletedCount
    };
  } catch (error) {
    console.error('Error clearing processed sheet data:', error);
    throw error;
  }
}

// Helper function to fetch sheet data with caching
async function fetchSheetDataWithCache(sheetId, useCache) {
  const { fetchSheetDataWithCache } = await import('./sheet-cache-manager');
  return fetchSheetDataWithCache(sheetId, useCache);
} 