import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';

// Constants
const CACHE_DIR = path.join(process.cwd(), 'processed');
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Ensure cache directory exists
 */
const ensureCacheDir = () => {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
};

/**
 * Gets cache file path for a sheet
 * @param {string} sheetId - Google Sheet ID
 * @returns {string} Cache file path
 */
const getCacheFilePath = (sheetId) => {
  return path.join(CACHE_DIR, `sheet-${sheetId}.json`);
};

/**
 * Checks if a cached file is valid (exists and not expired)
 * @param {string} sheetId - Google Sheet ID
 * @returns {boolean} Whether cache is valid
 */
const isCacheValid = (sheetId) => {
  const cacheFilePath = getCacheFilePath(sheetId);
  
  if (!fs.existsSync(cacheFilePath)) {
    return false;
  }
  
  try {
    const stats = fs.statSync(cacheFilePath);
    const fileAge = Date.now() - stats.mtimeMs;
    return fileAge < CACHE_EXPIRY;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
};

/**
 * Gets sheet data from cache
 * @param {string} sheetId - Google Sheet ID
 * @returns {Object|null} Cached sheet data or null if not found
 */
const getFromCache = (sheetId) => {
  const cacheFilePath = getCacheFilePath(sheetId);
  
  if (!isCacheValid(sheetId)) {
    return null;
  }
  
  try {
    const cachedData = fs.readFileSync(cacheFilePath, 'utf8');
    return JSON.parse(cachedData);
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
};

/**
 * Saves sheet data to cache
 * @param {string} sheetId - Google Sheet ID
 * @param {Object} data - Sheet data to cache
 */
const saveToCache = (sheetId, data) => {
  ensureCacheDir();
  const cacheFilePath = getCacheFilePath(sheetId);
  
  try {
    fs.writeFileSync(cacheFilePath, JSON.stringify(data, null, 2));
    console.log(`Cached sheet data for ${sheetId}`);
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
};

/**
 * Processes a batch of data (chunks)
 * @param {Array} data - Full data array
 * @param {number} batchSize - Size of each batch
 * @param {Function} processFn - Function to process each batch
 * @returns {Array} Processed results
 */
const processBatch = async (data, batchSize = 50, processFn) => {
  const results = [];
  const totalItems = data.length;
  
  for (let i = 0; i < totalItems; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(totalItems/batchSize)}`);
    
    try {
      const batchResults = await processFn(batch, i);
      results.push(...batchResults);
    } catch (error) {
      console.error(`Error processing batch ${i}-${i+batch.length}:`, error);
    }
    
    // Add a small delay between batches to prevent overloading the server
    if (i + batchSize < totalItems) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
};

/**
 * Fetches sheet data from Google API with authentication
 * @param {string} sheetId - Google Sheet ID
 * @param {boolean} useCache - Whether to check cache first
 * @returns {Object} Sheet data
 */
const fetchSheetDataWithCache = async (sheetId, useCache = true) => {
  // Check cache first if enabled
  if (useCache) {
    const cachedData = getFromCache(sheetId);
    if (cachedData) {
      console.log(`Using cached data for sheet ${sheetId}`);
      return cachedData;
    }
  }
  
  console.log(`Fetching fresh data for sheet ${sheetId}`);
  
  try {
    // Authentication logic
    let auth;
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (credentialsPath && fs.existsSync(credentialsPath)) {
      auth = new google.auth.GoogleAuth({
        keyFile: credentialsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
    } else if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
      });
    } else {
      throw new Error('Google API authentication credentials not found');
    }

    const sheets = google.sheets({ version: 'v4', auth });
    
    // Get spreadsheet info first to find the first sheet name
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId
    });
    
    const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
    
    // Get data with FORMULA format to preserve formulas
    const formulaResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: firstSheetName,
      valueRenderOption: 'FORMULA',
    });
    
    // Get data with HTML format to preserve hyperlinks
    const htmlResponse = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      ranges: [firstSheetName],
      includeGridData: true,
    });
    
    // Combine the data
    const combinedData = {
      values: formulaResponse.data.values || [],
      htmlData: htmlResponse.data.sheets?.[0]?.data?.[0]?.rowData || [],
      range: formulaResponse.data.range,
      majorDimension: formulaResponse.data.majorDimension,
      merges: htmlResponse.data.sheets?.[0]?.merges || [],
      fetchedAt: Date.now()
    };
    
    // Save to cache
    saveToCache(sheetId, combinedData);
    
    return combinedData;
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    throw error;
  }
};

/**
 * Process sheet data and sync to database in batches
 * @param {string} sheetId - Google Sheet ID
 * @param {Function} processRowFn - Function to process each row of data
 * @param {Function} saveToDbFn - Function to save processed data to database
 * @param {Object} options - Additional options
 * @returns {Object} Processing results
 */
const processAndSyncSheet = async (sheetId, processRowFn, saveToDbFn, options = {}) => {
  const {
    batchSize = 50,
    useCache = true,
    forceRefresh = false
  } = options;
  
  try {
    // Fetch data (with caching)
    const sheetData = await fetchSheetDataWithCache(sheetId, useCache && !forceRefresh);
    
    if (!sheetData.values || sheetData.values.length === 0) {
      return {
        success: false,
        error: 'Sheet has no data',
        processedCount: 0
      };
    }
    
    // Skip header row and process in batches
    const dataRows = sheetData.values.slice(1);
    const htmlRows = sheetData.htmlData?.slice(1) || [];
    
    const processedResults = await processBatch(
      dataRows, 
      batchSize,
      async (batch, startIndex) => {
        const batchResults = [];
        
        for (let i = 0; i < batch.length; i++) {
          const rowIndex = startIndex + i + 1; // +1 because we skipped header
          const htmlRow = htmlRows[rowIndex - 1]?.values || []; // -1 because htmlRows is already without header
          
          try {
            const processedRow = await processRowFn(batch[i], rowIndex, htmlRow);
            batchResults.push(processedRow);
          } catch (error) {
            console.error(`Error processing row ${rowIndex}:`, error);
            batchResults.push({ error: error.message, rowIndex });
          }
        }
        
        // Save this batch to database
        if (saveToDbFn && batchResults.length > 0) {
          try {
            await saveToDbFn(batchResults);
          } catch (dbError) {
            console.error('Error saving batch to database:', dbError);
          }
        }
        
        return batchResults;
      }
    );
    
    return {
      success: true,
      processedCount: processedResults.length,
      errors: processedResults.filter(r => r.error).length,
      results: processedResults
    };
  } catch (error) {
    console.error('Error in processAndSyncSheet:', error);
    return {
      success: false,
      error: error.message,
      processedCount: 0
    };
  }
};

export {
  fetchSheetDataWithCache,
  processAndSyncSheet,
  processBatch,
  getFromCache,
  saveToCache,
  isCacheValid
}; 