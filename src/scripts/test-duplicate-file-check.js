const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { uploadToGoogleDrive } = require('../app/api/drive/process-and-replace/lib/upload-service');

// Hàm tạo OAuth2Client
function createOAuth2Client() {
  const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, '../drive_token_upload.json'), 'utf8'));
  
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  oauth2Client.setCredentials(credentials);
  return oauth2Client;
}

// Hàm tạo file test
async function createTestFile(fileName) {
  const testFilePath = path.join(__dirname, `../${fileName}`);
  fs.writeFileSync(testFilePath, 'Đây là file test cho việc kiểm tra logic trùng lặp');
  console.log(`Đã tạo file test: ${testFilePath}`);
  return testFilePath;
}

// Hàm kiểm tra logic file trùng lặp
async function testDuplicateFileCheck() {
  try {
    console.log('=== BẮT ĐẦU KIỂM TRA LOGIC FILE TRÙNG LẶP ===');
    
    // Tạo file test
    const fileName = `test-duplicate-${Date.now()}.txt`;
    const filePath = await createTestFile(fileName);
    
    // Tạo folder test
    const testFolderName = `Test-Duplicate-${Date.now()}`;
    
    console.log(`\n1. Tải lên file lần đầu tiên với tên "${fileName}" vào folder "${testFolderName}"`);
    const firstUpload = await uploadToGoogleDrive(
      filePath,
      fileName,
      'text/plain',
      null, // Không chỉ định folderId
      testFolderName // Tên folder
    );
    
    console.log('\nKết quả tải lên lần đầu:');
    console.log(`- Success: ${firstUpload.success}`);
    console.log(`- File ID: ${firstUpload.fileId}`);
    console.log(`- File Name: ${firstUpload.fileName}`);
    console.log(`- Link: ${firstUpload.webViewLink}`);
    console.log(`- isExisting: ${firstUpload.isExisting ? 'Có' : 'Không'}`);
    console.log(`- Folder ID: ${firstUpload.folderId}`);
    console.log(`- Folder Name: ${firstUpload.folderName}`);
    
    // Chờ 2 giây
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n2. Tải lên file với tên giống hệt vào cùng folder');
    const secondUpload = await uploadToGoogleDrive(
      filePath,
      fileName,
      'text/plain',
      firstUpload.folderId, // Sử dụng folderId từ lần upload đầu tiên
      testFolderName
    );
    
    console.log('\nKết quả tải lên lần thứ hai:');
    console.log(`- Success: ${secondUpload.success}`);
    console.log(`- File ID: ${secondUpload.fileId}`);
    console.log(`- File Name: ${secondUpload.fileName}`);
    console.log(`- Link: ${secondUpload.webViewLink}`);
    console.log(`- isExisting: ${secondUpload.isExisting ? 'Có' : 'Không'}`);
    
    // Kiểm tra xem ID file có giống nhau không
    const isSameFile = firstUpload.fileId === secondUpload.fileId;
    console.log(`\n=> File ID giống nhau: ${isSameFile ? 'Có ✅' : 'Không ❌'}`);
    console.log(`=> Logic kiểm tra file trùng lặp: ${secondUpload.isExisting ? 'Hoạt động đúng ✅' : 'Chưa hoạt động đúng ❌'}`);
    
    // Xóa file test
    try {
      fs.unlinkSync(filePath);
      console.log(`\nĐã xóa file test: ${filePath}`);
    } catch (error) {
      console.error(`Lỗi khi xóa file test: ${error.message}`);
    }
    
    console.log('\n=== KẾT THÚC KIỂM TRA ===');
  } catch (error) {
    console.error('Lỗi khi kiểm tra logic file trùng lặp:', error);
  }
}

// Chạy hàm kiểm tra
testDuplicateFileCheck(); 