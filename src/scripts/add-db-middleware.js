/**
 * Script để thay thế lệnh gọi connectDB() bằng dbMiddleware(request) trong các API routes
 * Chạy script này bằng lệnh: node src/scripts/add-db-middleware.js
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const readDirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);

// Đường dẫn thư mục API
const API_DIR = path.join(__dirname, '..', 'app', 'api');

// Regex để tìm các lệnh gọi connectDB()
const CONNECT_DB_REGEX = /await\s+connectDB\(\);/g;

// Regex để tìm import connectDB
const IMPORT_CONNECT_DB_REGEX = /import\s+{\s*connectDB\s*}\s*from\s+['"]@\/lib\/mongodb['"];?/g;

// Danh sách các file đã được sửa
const modifiedFiles = [];
// Danh sách các file có lỗi
const errorFiles = [];

/**
 * Kiểm tra và sửa file
 * @param {string} filePath - Đường dẫn đến file cần kiểm tra
 */
async function processFile(filePath) {
  try {
    // Đọc nội dung file
    const content = await readFileAsync(filePath, 'utf8');
    
    // Kiểm tra xem file có import connectDB không
    const hasConnectDBImport = IMPORT_CONNECT_DB_REGEX.test(content);
    
    // Đặt lại regex để tránh lỗi lastIndex
    CONNECT_DB_REGEX.lastIndex = 0;
    
    // Kiểm tra xem file có gọi connectDB() không
    const hasConnectDBCall = CONNECT_DB_REGEX.test(content);
    
    // Nếu file có cả import và gọi connectDB()
    if (hasConnectDBImport && hasConnectDBCall) {
      console.log(`Đang xử lý file: ${filePath}`);
      
      // Thay thế import connectDB bằng import dbMiddleware
      let newContent = content.replace(
        IMPORT_CONNECT_DB_REGEX,
        `import { dbMiddleware } from '@/utils/db-middleware';`
      );
      
      // Thay thế các lệnh gọi connectDB() bằng dbMiddleware(request)
      newContent = newContent.replace(
        CONNECT_DB_REGEX,
        `await dbMiddleware(request);`
      );
      
      // Ghi nội dung mới vào file
      await writeFileAsync(filePath, newContent, 'utf8');
      
      // Thêm vào danh sách file đã sửa
      modifiedFiles.push(filePath);
      
      console.log(`✅ Đã sửa file: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Lỗi khi xử lý file ${filePath}:`, error);
    errorFiles.push({ path: filePath, error: error.message });
  }
}

/**
 * Duyệt qua thư mục và xử lý các file
 * @param {string} dirPath - Đường dẫn thư mục cần duyệt
 */
async function processDirectory(dirPath) {
  try {
    const entries = await readDirAsync(dirPath);
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const stats = await statAsync(entryPath);
      
      if (stats.isDirectory()) {
        // Đệ quy vào thư mục con
        await processDirectory(entryPath);
      } else if (stats.isFile() && (entry.endsWith('.js') || entry.endsWith('.jsx'))) {
        // Xử lý file JavaScript
        await processFile(entryPath);
      }
    }
  } catch (error) {
    console.error(`❌ Lỗi khi duyệt thư mục ${dirPath}:`, error);
  }
}

// Hàm chính
async function main() {
  console.log('🔍 Bắt đầu thay thế lệnh gọi connectDB() bằng dbMiddleware(request)...');
  
  // Xử lý thư mục API
  await processDirectory(API_DIR);
  
  // In kết quả
  console.log('\n===== KẾT QUẢ =====');
  console.log(`Đã sửa ${modifiedFiles.length} file:`);
  modifiedFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });
  
  if (errorFiles.length > 0) {
    console.log(`\nCó ${errorFiles.length} file lỗi:`);
    errorFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file.path}: ${file.error}`);
    });
  }
  
  console.log('\n✅ Hoàn tất!');
}

// Chạy hàm chính
main().catch(error => {
  console.error('❌ Lỗi:', error);
  process.exit(1);
}); 