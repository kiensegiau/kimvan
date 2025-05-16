// Script xử lý và tổ chức các file JSON đã lưu từ trình duyệt
const fs = require('fs');
const path = require('path');

// Đường dẫn đến thư mục results
const resultsDir = path.join(__dirname, '../../results');
// Đường dẫn đến thư mục processed để lưu kết quả đã xử lý
const processedDir = path.join(__dirname, '../../processed');

// Đảm bảo thư mục processed tồn tại
if (!fs.existsSync(processedDir)) {
  console.log(`Tạo thư mục processed: ${processedDir}`);
  fs.mkdirSync(processedDir, { recursive: true });
}

/**
 * Tìm tất cả các file JSON trong thư mục results
 * @returns {Array<string>} Danh sách đường dẫn đến các file JSON
 */
function findJsonFiles() {
  if (!fs.existsSync(resultsDir)) {
    console.error(`Thư mục results không tồn tại: ${resultsDir}`);
    return [];
  }
  
  const files = fs.readdirSync(resultsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(resultsDir, file));
  
  console.log(`Tìm thấy ${files.length} file JSON trong thư mục results`);
  return files;
}

/**
 * Tải dữ liệu từ file JSON
 * @param {string} filePath - Đường dẫn đến file JSON
 * @returns {Object|null} Dữ liệu JSON hoặc null nếu có lỗi
 */
function loadJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Lỗi khi đọc file ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Xác định loại dữ liệu JSON (danh sách sheet hoặc chi tiết sheet)
 * @param {Object} data - Dữ liệu JSON
 * @returns {string} 'list' hoặc 'detail' hoặc 'unknown'
 */
function detectDataType(data) {
  if (Array.isArray(data) && data.length > 0 && data[0].id && data[0].name) {
    return 'list';
  }
  
  if (data && data.sheets && Array.isArray(data.sheets)) {
    return 'detail';
  }
  
  return 'unknown';
}

/**
 * Xử lý và tổ chức các file JSON
 */
async function processJsonFiles() {
  // 1. Tìm tất cả các file JSON
  const jsonFiles = findJsonFiles();
  
  if (jsonFiles.length === 0) {
    console.log('Không tìm thấy file JSON nào để xử lý. Hãy chạy script open-browser.js trước.');
    return;
  }
  
  // 2. Tạo cấu trúc để lưu trữ dữ liệu đã xử lý
  const processedData = {
    timestamp: new Date().toISOString(),
    sheetLists: {},  // Lưu trữ danh sách sheet theo tên
    sheetDetails: {} // Lưu trữ chi tiết sheet theo ID
  };
  
  // 3. Đọc và phân loại dữ liệu từ mỗi file
  for (const filePath of jsonFiles) {
    const fileName = path.basename(filePath);
    console.log(`Đang xử lý file: ${fileName}`);
    
    const data = loadJsonFile(filePath);
    if (!data) continue;
    
    const dataType = detectDataType(data);
    
    if (dataType === 'list') {
      // Xác định tên sheet từ tên file
      const sheetNameMatch = fileName.match(/^(.+?)-list/);
      const sheetName = sheetNameMatch ? sheetNameMatch[1] : 'unknown';
      
      processedData.sheetLists[sheetName] = {
        source: fileName,
        timestamp: new Date().toISOString(),
        data: data
      };
      
      console.log(`File ${fileName} chứa danh sách sheet cho "${sheetName}" (${data.length} sheets)`);
      
    } else if (dataType === 'detail') {
      // Xác định ID sheet từ tên file hoặc từ nội dung
      const sheetIdMatch = fileName.match(/[^-]+-([a-zA-Z0-9_-]{10})/);
      const sheetId = sheetIdMatch ? sheetIdMatch[1] : 'unknown';
      
      processedData.sheetDetails[sheetId] = {
        source: fileName,
        timestamp: new Date().toISOString(),
        data: data
      };
      
      console.log(`File ${fileName} chứa chi tiết sheet với ID: ${sheetId}`);
      
    } else {
      console.log(`File ${fileName} có định dạng không xác định.`);
    }
  }
  
  // 4. Lưu dữ liệu đã xử lý
  const outputFilePath = path.join(processedDir, `kimvan-data-${Date.now()}.json`);
  fs.writeFileSync(outputFilePath, JSON.stringify(processedData, null, 2));
  
  console.log(`\nĐã xử lý ${jsonFiles.length} file JSON`);
  console.log(`Tìm thấy ${Object.keys(processedData.sheetLists).length} danh sách sheet`);
  console.log(`Tìm thấy ${Object.keys(processedData.sheetDetails).length} chi tiết sheet`);
  console.log(`Dữ liệu đã xử lý được lưu tại: ${outputFilePath}`);
  
  // 5. Tạo file index.json để dễ dàng truy cập
  const indexFilePath = path.join(processedDir, 'index.json');
  const indexData = {
    timestamp: new Date().toISOString(),
    lastProcessed: outputFilePath,
    sheetListCount: Object.keys(processedData.sheetLists).length,
    sheetDetailCount: Object.keys(processedData.sheetDetails).length,
    sheetNames: Object.keys(processedData.sheetLists),
    sheetIds: Object.keys(processedData.sheetDetails)
  };
  
  fs.writeFileSync(indexFilePath, JSON.stringify(indexData, null, 2));
  console.log(`File index đã được cập nhật: ${indexFilePath}`);
}

// Chạy hàm chính
processJsonFiles()
  .then(() => {
    console.log('Xử lý hoàn tất.');
  })
  .catch(err => {
    console.error('Lỗi:', err);
  }); 