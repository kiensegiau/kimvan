// Script opens browser to access KimVan API
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure results directory exists
const resultsDir = path.join(__dirname, '../../results');
if (!fs.existsSync(resultsDir)) {
  console.log(`Creating results directory: ${resultsDir}`);
  fs.mkdirSync(resultsDir, { recursive: true });
}

/**
 * Open Chrome browser
 * @param {string} url - URL to open
 */
function openBrowser(url) {
  return new Promise((resolve, reject) => {
    // Command to open Chrome (Windows)
    const command = `start chrome "${url}"`;
    
    console.log(`Opening Chrome with URL: ${url}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error opening Chrome: ${error.message}`);
        // Try default browser if Chrome fails
        exec(`start "" "${url}"`, (err, out, errout) => {
          if (err) {
            console.error(`Error opening default browser: ${err.message}`);
            reject(err);
            return;
          }
          console.log('Opened URL with default browser');
          resolve(out);
        });
        return;
      }
      if (stderr) {
        console.error(`stderr error: ${stderr}`);
      }
      resolve(stdout);
    });
  });
}

/**
 * Create URL for sheet list
 * @param {string} sheetName - Sheet name
 * @param {number} timestamp - Timestamp to avoid cache
 * @returns {string} Full URL
 */
function createListUrl(sheetName, timestamp) {
  const baseUrl = `https://kimvan.id.vn/api/spreadsheets/create/${encodeURIComponent(sheetName)}`;
  // Add timestamp to URL to avoid cache
  return `${baseUrl}?t=${timestamp}`;
}

/**
 * Create URL for sheet details
 * @param {string} sheetId - Sheet ID
 * @param {number} timestamp - Timestamp to avoid cache
 * @returns {string} Full URL
 */
function createDetailUrl(sheetId, timestamp) {
  const baseUrl = `https://kimvan.id.vn/api/spreadsheets/${encodeURIComponent(sheetId)}`;
  // Add timestamp to URL to avoid cache
  return `${baseUrl}?t=${timestamp}`;
}

/**
 * Check if file exists in results directory
 * @param {string} fileName - File name to check
 * @returns {boolean} true if file exists
 */
function checkFileExists(fileName) {
  const filePath = path.join(resultsDir, fileName);
  return fs.existsSync(filePath);
}

/**
 * Process URLs and open browser
 * @param {string} sheetName - Sheet name
 * @param {Array<string>} sheetIds - Sheet IDs list
 * @param {Object} options - Process options
 */
async function processUrls(sheetName, sheetIds = [], options = {}) {
  const waitTimeBetweenRequests = options.waitTime || 5000; // Default 5 seconds
  const skipExisting = options.skipExisting !== false; // Skip existing files (default true)
  const timestamp = options.timestamp || Date.now(); // Use provided timestamp or create new
  
  try {
    // Skip login step as requested
    
    // Check if list file exists
    const listFileName = `${sheetName}-list.json`;
    const listFileExists = checkFileExists(listFileName);
    
    if (listFileExists && skipExisting) {
      console.log(`List file ${listFileName} already exists. Skipping list step.`);
    } else {
      // 1. Open sheet list URL
      console.log(`\n[1/${sheetIds.length + 1}] Opening list for "${sheetName}"`);
      const listUrl = createListUrl(sheetName, timestamp);
      console.log(`URL: ${listUrl} (added timestamp ${timestamp} to avoid cache)`);
      await openBrowser(listUrl);
      
      // Wait for user to save results
      console.log('Browser opened. Please save JSON content to results directory');
      console.log(`Suggested filename: ${listFileName}`);
      console.log(`Waiting ${waitTimeBetweenRequests/1000} seconds to avoid rate limit...`);
      await new Promise(resolve => setTimeout(resolve, waitTimeBetweenRequests));
    }
    
    // 2. If sheet IDs provided, open each detail
    if (sheetIds && sheetIds.length > 0) {
      for (let i = 0; i < sheetIds.length; i++) {
        const sheetId = sheetIds[i];
        const shortId = sheetId.substring(0, 10);
        const detailFileName = `${sheetName}-${shortId}-detail.json`;
        
        // Check if detail file exists
        const detailFileExists = checkFileExists(detailFileName);
        
        if (detailFileExists && skipExisting) {
          console.log(`Detail file ${detailFileName} already exists. Skipping.`);
          continue;
        }
        
        console.log(`\n[${i + 2}/${sheetIds.length + 1}] Opening sheet details: ${shortId}...`);
        
        const detailUrl = createDetailUrl(sheetId, timestamp);
        console.log(`URL: ${detailUrl} (added timestamp ${timestamp} to avoid cache)`);
        await openBrowser(detailUrl);
        
        // Wait between requests
        console.log(`Opened sheet ID: ${sheetId}`);
        console.log('Please save JSON content to results directory');
        console.log(`Suggested filename: ${detailFileName}`);
        
        // Wait for user to save file
        if (i < sheetIds.length - 1) {
          console.log(`Waiting ${waitTimeBetweenRequests/1000} seconds before opening next sheet (to avoid rate limit)...`);
          await new Promise(resolve => setTimeout(resolve, waitTimeBetweenRequests));
        }
      }
    } else if (!listFileExists || !skipExisting) {
      console.log('\n===== INSTRUCTIONS =====');
      console.log('1. Save JSON files from browser to results directory');
      console.log('2. To get sheet details, copy IDs from list and run script again:');
      console.log('   node src/scripts/open-browser.js fullcombokhoa2k8 "ID1,ID2,ID3"');
      console.log('   Or with wait time option:');
      console.log('   node src/scripts/open-browser.js fullcombokhoa2k8 "ID1,ID2,ID3" --wait=5');
      console.log('========================\n');
    }
    
    console.log('\nComplete! Check results directory for saved files.');
    console.log('Next step: Run data processing script:');
    console.log('node src/scripts/process-results.js');
    
  } catch (error) {
    console.error('Error during processing:', error);
  }
}

// Get command line arguments
const sheetName = process.argv[2] || 'fullcombokhoa2k8';
let sheetIds = [];
const options = {
  waitTime: 5000, // Default 5 seconds 
  skipExisting: true,
  timestamp: Date.now() // Default to current timestamp
};

// Check if sheet IDs provided
if (process.argv.length > 3) {
  // IDs are comma-separated
  const arg3 = process.argv[3];
  if (!arg3.startsWith('--')) {
    sheetIds = arg3.split(',').map(id => id.trim());
    console.log(`Provided ${sheetIds.length} sheet IDs`);
  }
}

// Process command line options
for (let i = 3; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--wait=')) {
    const waitSec = parseInt(arg.split('=')[1]);
    if (!isNaN(waitSec) && waitSec > 0) {
      options.waitTime = waitSec * 1000; // Convert seconds to milliseconds
      console.log(`Set wait time: ${waitSec} seconds`);
    }
  }
  if (arg === '--force') {
    options.skipExisting = false;
    console.log('Force mode: Will get all data, even if already exists');
  }
  if (arg.startsWith('--timestamp=')) {
    const ts = parseInt(arg.split('=')[1]);
    if (!isNaN(ts) && ts > 0) {
      options.timestamp = ts;
      console.log(`Set timestamp: ${ts}`);
    }
  }
}

// Display configuration
console.log('\n===== EXECUTION INFO =====');
console.log(`Sheet name: ${sheetName}`);
console.log(`Number of IDs: ${sheetIds.length}`);
console.log(`Wait time: ${options.waitTime/1000} seconds`);
console.log(`Skip existing files: ${options.skipExisting ? 'Yes' : 'No'}`);
console.log(`Timestamp: ${options.timestamp}`);
console.log('==========================\n');

// Run main function
processUrls(sheetName, sheetIds, options)
  .then(() => {
    console.log('Script completed.');
  })
  .catch(err => {
    console.error('Error:', err);
  }); 