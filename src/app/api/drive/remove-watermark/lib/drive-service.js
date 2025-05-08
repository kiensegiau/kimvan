/**
 * Các hàm xử lý liên quan đến Google Drive
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';
import { getTokenByType, getExtensionFromMimeType, cleanupTempFiles, escapeDriveQueryString } from './utils.js';
import { TOKEN_PATHS } from './config.js';

// Thay thế hàm extractGoogleDriveFileId bằng phiên bản mới
export function extractGoogleDriveFileId(url) {
  // Handle different Drive URL formats
  let fileId = null;
  let resourceKey = null;
  
  // Format: https://drive.google.com/file/d/{fileId}/view
  const filePattern = /\/file\/d\/([^\/\?&]+)/;
  const fileMatch = url.match(filePattern);
  
  if (fileMatch && fileMatch[1]) {
    fileId = fileMatch[1].split('?')[0]; // Loại bỏ các tham số URL
  }
  
  // Format: https://drive.google.com/open?id={fileId}
  const openPattern = /[?&]id=([^&]+)/;
  const openMatch = url.match(openPattern);
  
  if (openMatch && openMatch[1]) {
    fileId = openMatch[1].split('&')[0]; // Loại bỏ các tham số khác
  }
  
  // Format: https://docs.google.com/document/d/{fileId}/edit
  const docsPattern = /\/document\/d\/([^\/\?&]+)/;
  const docsMatch = url.match(docsPattern);
  
  if (docsMatch && docsMatch[1]) {
    fileId = docsMatch[1].split('?')[0]; // Loại bỏ các tham số URL
  }
  
  // Format: https://drive.google.com/drive/folders/{folderId}
  // Format: https://drive.google.com/drive/u/0/folders/{folderId}
  // Format: https://drive.google.com/folders/{folderId}
  const folderPattern = /\/folders\/([^\/\?&]+)/;
  const folderMatch = url.match(folderPattern);
  
  if (folderMatch && folderMatch[1]) {
    fileId = folderMatch[1].split('?')[0]; // Loại bỏ các tham số URL
  }
  
  // Extract resourceKey from URL
  const resourceKeyPattern = /[?&]resourcekey=([^&]+)/i;
  const resourceKeyMatch = url.match(resourceKeyPattern);
  
  if (resourceKeyMatch && resourceKeyMatch[1]) {
    resourceKey = resourceKeyMatch[1];
  }
  
  if (!fileId) {
    throw new Error('Không thể trích xuất file ID từ URL Google Drive');
  }
  
  return { fileId, resourceKey };
}

// Thêm hàm tìm file bằng tên hoặc ID
export async function findFileByNameOrId(drive, nameOrId) {
  try {
    // Thử truy cập trực tiếp bằng ID trước
    try {
      const fileInfo = await drive.files.get({
        fileId: nameOrId,
        fields: 'id,name,mimeType,size,capabilities',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      
      return fileInfo.data;
    } catch (directError) {
      // Nếu không thể truy cập trực tiếp, thử tìm kiếm bằng tên/ID
      const response = await drive.files.list({
        q: `name contains '${nameOrId}' or fullText contains '${nameOrId}'`,
        fields: 'files(id,name,mimeType,size,capabilities)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageSize: 10
      });
      
      const files = response.data.files;
      if (files && files.length > 0) {
        // Trả về file đầu tiên tìm được
        return files[0];
      } else {
        throw new Error(`Không tìm thấy file nào khớp với: ${nameOrId}`);
      }
    }
  } catch (error) {
    throw error;
  }
}

// Cập nhật hàm downloadFromGoogleDrive
export async function downloadFromGoogleDrive(fileIdOrLink) {
  let fileId, resourceKey;
  
  try {
    // Create temp directory
    const tempDirName = uuidv4();
    const outputDir = path.join(os.tmpdir(), tempDirName);
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Extract file ID from link if needed
    if (typeof fileIdOrLink === 'string' && fileIdOrLink.includes('drive.google.com')) {
      try {
        const result = extractGoogleDriveFileId(fileIdOrLink);
        fileId = result.fileId;
        resourceKey = result.resourceKey;
      } catch (error) {
        throw new Error(`Không thể trích xuất ID từ link Google Drive: ${error.message}`);
      }
    } else {
      fileId = fileIdOrLink;
    }
    
    try {
      // Get stored token for download
      const downloadToken = getTokenByType('download');
      if (!downloadToken) {
        throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
      }
      
      // Create OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      
      // Set credentials
      oauth2Client.setCredentials(downloadToken);
      
      // Handle token refresh if needed
      oauth2Client.on('tokens', (tokens) => {
        if (tokens.refresh_token) {
          const newToken = {...downloadToken, ...tokens};
          fs.writeFileSync(TOKEN_PATHS[1], JSON.stringify(newToken));
        }
      });
      
      // Initialize Google Drive API
      const drive = google.drive({ version: 'v3', auth: oauth2Client });
      
      // Get file metadata
      const fileMetadata = await drive.files.get({
        fileId: fileId,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'name,mimeType,size'
      });
      
      // Check if file is a PDF (for watermark removal)
      const mimeType = fileMetadata.data.mimeType;
      if (mimeType !== 'application/pdf') {
        throw new Error(`File không phải là PDF. Loại file: ${mimeType}`);
      }
      
      // Download file content
      const response = await drive.files.get(
        {
          fileId: fileId,
          alt: 'media',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          ...(resourceKey ? { resourceKey } : {})
        },
        { responseType: 'arraybuffer' }
      );
      
      // Convert response to buffer
      const fileBuffer = Buffer.from(response.data);
      
      if (fileBuffer.length === 0) {
        throw new Error('File tải xuống rỗng (0 byte)');
      }
      
      const fileName = fileMetadata.data.name;
      const contentType = mimeType;
      
      // Create unique filename
      const fileExtension = path.extname(fileName) || getExtensionFromMimeType(contentType);
      const uniqueFileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join(outputDir, uniqueFileName);
      
      // Save file to temp directory
      fs.writeFileSync(filePath, fileBuffer);
      
      return {
        success: true,
        filePath: filePath,
        fileName: fileName,
        contentType: contentType,
        outputDir: outputDir,
        size: fileBuffer.length
      };
    } catch (error) {
      // Clean up temp directory on error
      cleanupTempFiles(outputDir);
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

// Upload processed file back to Google Drive
export async function uploadToDrive(filePath, fileName, mimeType, courseName = null) {
  try {
    // Kiểm tra file tồn tại
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại: ${filePath}`);
    }
    
    const fileSize = fs.statSync(filePath).size;
    if (fileSize === 0) {
      throw new Error(`File rỗng (0 byte): ${filePath}`);
    }
    
    // Lấy token tải lên (upload)
    const uploadToken = getTokenByType('upload');
    if (!uploadToken) {
      throw new Error('Không tìm thấy token tải lên Google Drive. Vui lòng thiết lập lại tài khoản tải lên.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(uploadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Tìm hoặc tạo thư mục "tài liệu khoá học" và thư mục con khóa học
    let courseFolderId = await findOrCreateCourseFolder(drive, courseName);
    
    // Xử lý tên file theo loại
    let outputFileName;
    if (mimeType === 'application/pdf') {
      // Giữ nguyên tên file PDF, không thêm "_clean"
      outputFileName = fileName;
    } else {
      // Nếu là loại file khác, giữ nguyên tên
      outputFileName = fileName;
    }
    
    // Kiểm tra xem file đã tồn tại trong thư mục chưa
    console.log(`Đang kiểm tra xem file "${outputFileName}" đã tồn tại trong thư mục đích chưa...`);
    const searchQuery = `name='${outputFileName}' and '${courseFolderId}' in parents and trashed=false`;
    const existingFileResponse = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, webViewLink, webContentLink)',
      spaces: 'drive'
    });
    
    // Nếu file đã tồn tại, trả về thông tin
    if (existingFileResponse.data.files && existingFileResponse.data.files.length > 0) {
      const existingFile = existingFileResponse.data.files[0];
      console.log(`File "${outputFileName}" đã tồn tại trong folder với ID: ${existingFile.id}`);
      
      return {
        success: true,
        fileId: existingFile.id,
        fileName: existingFile.name,
        webViewLink: existingFile.webViewLink,
        downloadLink: existingFile.webContentLink || null,
        isExisting: true
      };
    }
    
    console.log(`File "${outputFileName}" chưa tồn tại, đang tải lên...`);
    
    // Tạo metadata cho file
    const fileMetadata = {
      name: outputFileName,
      description: mimeType === 'application/pdf' ? 'File đã được xử lý xóa watermark bởi API' : 'File được tải lên bởi API',
      parents: [courseFolderId] // Thêm vào thư mục "tài liệu khoá học"
    };
    
    // Tạo media object
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };
    
    // Tải file lên Drive
    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink,webContentLink',
      supportsAllDrives: true
    });
    
    // Không đặt quyền chia sẻ, giữ nguyên quyền mặc định
    
    return {
      success: true,
      fileId: driveResponse.data.id,
      fileName: driveResponse.data.name,
      webViewLink: driveResponse.data.webViewLink,
      downloadLink: driveResponse.data.webContentLink || null,
      isNew: true
    };
  } catch (error) {
    throw error;
  }
}

// Hàm tìm hoặc tạo thư mục "tài liệu khoá học"
export async function findOrCreateCourseFolder(drive, courseName = null) {
  const rootFolderName = "tài liệu khoá học";
  
  try {
    // Tìm thư mục "tài liệu khoá học" nếu đã tồn tại
    const escapedRootFolderName = escapeDriveQueryString(rootFolderName);
    const response = await drive.files.list({
      q: `name='${escapedRootFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });
    
    // Nếu thư mục gốc đã tồn tại, sử dụng nó
    let rootFolderId;
    if (response.data.files && response.data.files.length > 0) {
      console.log(`Đã tìm thấy thư mục "${rootFolderName}" với ID: ${response.data.files[0].id}`);
      rootFolderId = response.data.files[0].id;
    } else {
      // Nếu không tìm thấy, tạo mới thư mục gốc
      console.log(`Không tìm thấy thư mục "${rootFolderName}", đang tạo mới...`);
      const folderMetadata = {
        name: rootFolderName,
        mimeType: 'application/vnd.google-apps.folder'
      };
      
      const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id'
      });
      
      console.log(`Đã tạo thư mục "${rootFolderName}" với ID: ${folder.data.id}`);
      rootFolderId = folder.data.id;
    }
    
    // Nếu không có tên khóa học, chỉ trả về thư mục gốc
    if (!courseName) {
      return rootFolderId;
    }
    
    // Tìm hoặc tạo thư mục khóa học
    try {
      // Làm sạch tên khóa học để dùng làm tên thư mục
      const sanitizedCourseName = courseName.trim().replace(/[/\\?%*:|"<>]/g, '-');
      
      // Tìm thư mục khóa học trong thư mục gốc
      const escapedCourseName = escapeDriveQueryString(sanitizedCourseName);
      const courseResponse = await drive.files.list({
        q: `name='${escapedCourseName}' and mimeType='application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed=false`,
        fields: 'files(id, name)',
        spaces: 'drive'
      });
      
      // Nếu đã tồn tại, sử dụng nó
      if (courseResponse.data.files && courseResponse.data.files.length > 0) {
        console.log(`Đã tìm thấy thư mục khóa học "${sanitizedCourseName}" với ID: ${courseResponse.data.files[0].id}`);
        return courseResponse.data.files[0].id;
      }
      
      // Nếu không tìm thấy, tạo mới
      console.log(`Không tìm thấy thư mục khóa học "${sanitizedCourseName}", đang tạo mới...`);
      const courseFolderMetadata = {
        name: sanitizedCourseName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolderId]
      };
      
      const courseFolder = await drive.files.create({
        resource: courseFolderMetadata,
        fields: 'id'
      });
      
      console.log(`Đã tạo thư mục khóa học "${sanitizedCourseName}" với ID: ${courseFolder.data.id}`);
      return courseFolder.data.id;
    } catch (courseError) {
      console.error(`Lỗi khi tìm/tạo thư mục khóa học: ${courseError.message}`);
      // Nếu lỗi khi tạo thư mục khóa học, trả về thư mục gốc
      return rootFolderId;
    }
  } catch (error) {
    console.error(`Lỗi khi tìm/tạo thư mục "${rootFolderName}": ${error.message}`);
    // Nếu có lỗi, sử dụng root làm fallback
    return 'root';
  }
}

// Hàm xử lý link folder
export async function processDriveFolder(folderIdOrLink) {
  let folderId, resourceKey;
  
  try {
    // Trích xuất folder ID từ link nếu cần
    if (typeof folderIdOrLink === 'string' && folderIdOrLink.includes('drive.google.com')) {
      try {
        const result = extractGoogleDriveFileId(folderIdOrLink);
        folderId = result.fileId;
        resourceKey = result.resourceKey;
      } catch (error) {
        throw new Error(`Không thể trích xuất ID folder từ link Google Drive: ${error.message}`);
      }
    } else {
      folderId = folderIdOrLink;
    }
    
    // Lấy token download
    const downloadToken = getTokenByType('download');
    if (!downloadToken) {
      throw new Error('Không tìm thấy token Google Drive. Vui lòng cấu hình API trong cài đặt.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(downloadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Lấy thông tin folder
    const folderMetadata = await drive.files.get({
      fileId: folderId,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'name,mimeType'
    });
    
    // Kiểm tra xem đây có phải là folder không
    if (folderMetadata.data.mimeType !== 'application/vnd.google-apps.folder') {
      throw new Error('ID được cung cấp không phải là folder Google Drive');
    }
    
    // Lấy danh sách các files trong folder
    const fileList = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });
    
    return {
      success: true,
      folderId: folderId,
      folderName: folderMetadata.data.name,
      files: fileList.data.files
    };
  } catch (error) {
    throw error;
  }
}

// Hàm tạo folder trên Google Drive
export async function createDriveFolder(folderName, courseName = null) {
  try {
    // Lấy token upload
    const uploadToken = getTokenByType('upload');
    if (!uploadToken) {
      throw new Error('Không tìm thấy token tải lên Google Drive. Vui lòng thiết lập lại tài khoản tải lên.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(uploadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Tìm hoặc tạo thư mục "tài liệu khoá học"
    let parentFolderId = await findOrCreateCourseFolder(drive, courseName);
    
    // Kiểm tra xem folder đã tồn tại trong thư mục cha chưa
    console.log(`Đang kiểm tra xem folder "${folderName}" đã tồn tại trong thư mục cha chưa...`);
    const escapedFolderName = escapeDriveQueryString(folderName);
    const existingFolderResponse = await drive.files.list({
      q: `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
      fields: 'files(id, name, webViewLink)',
      spaces: 'drive'
    });
    
    // Nếu folder đã tồn tại, trả về thông tin
    if (existingFolderResponse.data.files && existingFolderResponse.data.files.length > 0) {
      const existingFolder = existingFolderResponse.data.files[0];
      console.log(`Folder "${folderName}" đã tồn tại với ID: ${existingFolder.id}`);
      
      return {
        success: true,
        folderId: existingFolder.id,
        folderName: existingFolder.name,
        webViewLink: existingFolder.webViewLink,
        isExisting: true
      };
    }
    
    // Tạo metadata cho folder
    const folderMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId] // Đặt thư mục cha là thư mục đã xác định
    };
    
    // Tạo folder trên Drive
    console.log(`Folder "${folderName}" chưa tồn tại, đang tạo mới...`);
    const folderResponse = await drive.files.create({
      resource: folderMetadata,
      fields: 'id,name,webViewLink',
      supportsAllDrives: true
    });
    
    // Không đặt quyền truy cập cho folder, giữ nguyên mặc định
    
    return {
      success: true,
      folderId: folderResponse.data.id,
      folderName: folderResponse.data.name,
      webViewLink: folderResponse.data.webViewLink,
      isNew: true
    };
  } catch (error) {
    throw error;
  }
}

// Hàm tải file lên folder trên Google Drive
export async function uploadFileToDriveFolder(filePath, fileName, destinationFolderId) {
  try {
    // Kiểm tra file tồn tại
    if (!fs.existsSync(filePath)) {
      throw new Error(`File không tồn tại: ${filePath}`);
    }
    
    // Xác định loại MIME dựa trên phần mở rộng
    const extension = path.extname(fileName).toLowerCase();
    let mimeType = 'application/octet-stream'; // Mặc định
    
    // Xác định mime type dựa trên phần mở rộng
    if (extension === '.pdf') {
      mimeType = 'application/pdf';
    } else if (extension === '.jpg' || extension === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (extension === '.png') {
      mimeType = 'image/png';
    } else if (extension === '.gif') {
      mimeType = 'image/gif';
    } else if (extension === '.webp') {
      mimeType = 'image/webp';
    } else if (extension === '.bmp') {
      mimeType = 'image/bmp';
    } else if (extension === '.tiff' || extension === '.tif') {
      mimeType = 'image/tiff';
    }
    
    // Lấy token upload
    const uploadToken = getTokenByType('upload');
    if (!uploadToken) {
      throw new Error('Không tìm thấy token tải lên Google Drive.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(uploadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Kiểm tra xem file đã tồn tại trong folder chưa
    console.log(`Đang kiểm tra xem file "${fileName}" đã tồn tại trong thư mục đích chưa...`);
    const escapedFileName = escapeDriveQueryString(fileName);
    const searchQuery = `name='${escapedFileName}' and '${destinationFolderId}' in parents and trashed=false`;
    const existingFileResponse = await drive.files.list({
      q: searchQuery,
      fields: 'files(id, name, webViewLink, webContentLink)',
      spaces: 'drive'
    });
    
    // Nếu file đã tồn tại, trả về thông tin
    if (existingFileResponse.data.files && existingFileResponse.data.files.length > 0) {
      const existingFile = existingFileResponse.data.files[0];
      console.log(`File "${fileName}" đã tồn tại trong folder với ID: ${existingFile.id}`);
      
      return {
        success: true,
        fileId: existingFile.id,
        fileName: existingFile.name,
        webViewLink: existingFile.webViewLink,
        downloadLink: existingFile.webContentLink,
        isExisting: true
      };
    }
    
    console.log(`File "${fileName}" chưa tồn tại, đang tải lên...`);
    
    // Tạo metadata của file
    const fileMetadata = {
      name: fileName,
      parents: [destinationFolderId]
    };
    
    // Tạo media
    const media = {
      mimeType: mimeType,
      body: fs.createReadStream(filePath)
    };
    
    // Tải file lên Drive
    const driveResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
      supportsAllDrives: true
    });
    
    return {
      success: true,
      fileId: driveResponse.data.id,
      fileName: driveResponse.data.name,
      webViewLink: driveResponse.data.webViewLink,
      downloadLink: driveResponse.data.webContentLink,
      isNew: true
    };
  } catch (error) {
    throw error;
  }
}

// Hàm duy trì tương thích ngược để không phá vỡ code hiện tại
export async function uploadImageToDriveFolder(filePath, fileName, destinationFolderId) {
  return uploadFileToDriveFolder(filePath, fileName, destinationFolderId);
}

// Hàm tải xuống file từ Drive, hỗ trợ nhiều loại file
export async function downloadFileFromDrive(fileIdOrLink, allowedMimeTypes = []) {
  let fileId, resourceKey;
  
  try {
    // Tạo thư mục tạm
    const tempDirName = uuidv4();
    const outputDir = path.join(os.tmpdir(), tempDirName);
    fs.mkdirSync(outputDir, { recursive: true });
    
    // Trích xuất file ID từ link nếu cần
    if (typeof fileIdOrLink === 'string' && fileIdOrLink.includes('drive.google.com')) {
      try {
        const result = extractGoogleDriveFileId(fileIdOrLink);
        fileId = result.fileId;
        resourceKey = result.resourceKey;
      } catch (error) {
        throw new Error(`Không thể trích xuất ID từ link Google Drive: ${error.message}`);
      }
    } else {
      fileId = fileIdOrLink;
    }
    
    // Lấy token download
    const downloadToken = getTokenByType('download');
    if (!downloadToken) {
      throw new Error('Không tìm thấy token Google Drive.');
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(downloadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Lấy metadata của file
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: 'name,mimeType,size'
    });
    
    const mimeType = fileMetadata.data.mimeType;
    
    // Kiểm tra loại file nếu có danh sách cho phép
    if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(mimeType)) {
      throw new Error(`Loại file không được hỗ trợ: ${mimeType}`);
    }
    
    // Tải nội dung file
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: 'media',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        ...(resourceKey ? { resourceKey } : {})
      },
      { responseType: 'arraybuffer' }
    );
    
    // Chuyển response thành buffer
    const fileBuffer = Buffer.from(response.data);
    
    if (fileBuffer.length === 0) {
      throw new Error('File tải xuống rỗng (0 byte)');
    }
    
    const fileName = fileMetadata.data.name;
    const contentType = mimeType;
    
    // Tạo tên file duy nhất
    const fileExtension = path.extname(fileName) || getExtensionFromMimeType(contentType);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(outputDir, uniqueFileName);
    
    // Lưu file vào thư mục tạm
    fs.writeFileSync(filePath, fileBuffer);
    
    return {
      success: true,
      filePath: filePath,
      fileName: fileName,
      contentType: contentType,
      outputDir: outputDir,
      size: fileBuffer.length,
      isImage: contentType.startsWith('image/'),
      isPdf: contentType === 'application/pdf'
    };
  } catch (error) {
    throw error;
  }
}

// Hàm kiểm tra trạng thái của link Google Drive
export async function checkDriveLinkStatus(driveUrl) {
  try {
    // Trích xuất file ID từ URL
    let fileId, resourceKey;
    try {
      const result = extractGoogleDriveFileId(driveUrl);
      fileId = result.fileId;
      resourceKey = result.resourceKey;
    } catch (error) {
      console.error(`Không thể trích xuất ID từ link: ${error.message}`);
      return { 
        exists: false, 
        error: `Không thể trích xuất ID: ${error.message}` 
      };
    }
    
    // Lấy token cho việc kiểm tra - sử dụng token upload thay vì download
    const uploadToken = getTokenByType('upload');
    if (!uploadToken) {
      console.error('Không tìm thấy token Google Drive Upload');
      return { 
        exists: false, 
        error: 'Không tìm thấy token Google Drive Upload' 
      };
    }
    
    // Tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    // Thiết lập credentials
    oauth2Client.setCredentials(uploadToken);
    
    // Khởi tạo Google Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Thử lấy thông tin file từ Drive API
    try {
      const fileMetadata = await drive.files.get({
        fileId: fileId,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: 'id,name,mimeType'
      });
      
      // Nếu có dữ liệu trả về, file tồn tại
      return {
        exists: true,
        fileId: fileId,
        fileName: fileMetadata.data.name,
        mimeType: fileMetadata.data.mimeType,
        isFolder: fileMetadata.data.mimeType === 'application/vnd.google-apps.folder'
      };
    } catch (apiError) {
      // Nếu lỗi 404, file không tồn tại
      if (apiError.code === 404 || 
          (apiError.response && apiError.response.status === 404) || 
          apiError.message.includes('File not found')) {
        return { 
          exists: false, 
          error: 'File không tồn tại hoặc đã bị xóa'
        };
      }
      
      // Các lỗi khác có thể là do quyền truy cập
      if (apiError.code === 403 || 
          (apiError.response && apiError.response.status === 403) || 
          apiError.message.includes('permission')) {
        return { 
          exists: true, 
          error: 'Không có quyền truy cập file' 
        };
      }
      
      // Các lỗi khác
      return { 
        exists: false, 
        error: apiError.message
      };
    }
  } catch (error) {
    // Lỗi không xác định
    return { 
      exists: false, 
      error: `Lỗi không xác định: ${error.message}`
    };
  }
} 