import fs from 'fs';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { 
  createOAuth2Client 
} from '@/utils/drive-utils';
import { processPDF } from '@/app/api/drive/remove-watermark/lib/drive-fix-blockdown.js';
import { addLogoToPDF } from './pdf-service';
import { v4 as uuidv4 } from 'uuid';
import { sanitizeFileName } from '@/utils/file-utils';
import { getAccessToken } from '@/utils/auth-utils';

/**
 * Lấy thông tin email từ token
 * @returns {Promise<string>} Email của token
 */
async function getTokenEmail() {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${await getAccessToken()}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.email;
  } catch (error) {
    console.error('Lỗi khi lấy email từ token:', error);
    return null;
  }
}

/**
 * Thử tải file bằng token download
 * @param {string} fileId - ID của file trên Google Drive
 * @param {string} downloadToken - Token download từ Google Drive
 * @returns {Promise<Object>} - Kết quả tải xuống
 */
async function downloadWithToken(fileId, downloadToken) {
  console.log(`Thử tải file ${fileId} bằng token download`);
  
  try {
    const response = await fetch(
      `https://drive.google.com/uc?id=${fileId}&export=download&confirm=t&uuid=${downloadToken}`,
      {
        method: 'GET',
        headers: {
          'Cookie': `download_warning_13058876_${fileId}=1`
        },
        signal: AbortSignal.timeout(180000) // 3 phút timeout
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Kiểm tra content-type để xác định có phải file thật không
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      throw new Error('Không phải file thật (HTML response)');
    }

    return response;
  } catch (error) {
    console.log(`Lỗi khi tải bằng token: ${error.message}`);
    return null;
  }
}

/**
 * Lấy URL tải xuống trực tiếp từ Google Drive
 * @param {string} fileId - ID của file
 * @returns {Promise<string>} URL tải xuống
 */
async function getDownloadUrl(fileId) {
  try {
    // Lấy thông tin file bao gồm webContentLink
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=webContentLink,webViewLink`,
      {
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Ưu tiên dùng webContentLink (link tải trực tiếp)
    if (data.webContentLink) {
      return data.webContentLink;
    }
    
    // Nếu không có webContentLink, dùng webViewLink
    if (data.webViewLink) {
      return data.webViewLink.replace('/view', '/export?format=pdf');
    }

    throw new Error('Không tìm thấy link tải xuống');
  } catch (error) {
    console.error('Lỗi khi lấy URL tải xuống:', error);
    return null;
  }
}

/**
 * Tải xuống file từ Google Drive
 * @param {string} fileId - ID của file trên Google Drive
 * @returns {Promise<Object>} - Kết quả tải xuống
 */
export async function downloadFromGoogleDrive(fileId) {
  console.log(`Bắt đầu tải xuống file với ID: ${fileId}`);
  
  // Tạo thư mục tạm để lưu file
  const outputDir = path.join(os.tmpdir(), uuidv4());
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`Đã tạo thư mục tạm: ${outputDir}`);

  // Thêm cơ chế retry
  const MAX_RETRIES = 3;
  let lastError = null;
  
  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      if (retryCount > 0) {
        console.log(`Thử lại lần ${retryCount}/${MAX_RETRIES} cho file ID: ${fileId}`);
        const delayTime = Math.min(Math.pow(2, retryCount) * 2000, 30000);
        console.log(`Đợi ${delayTime/1000} giây trước khi thử lại...`);
        await new Promise(resolve => setTimeout(resolve, delayTime));
      }

      // Lấy access token
      const accessToken = await getAccessToken();
      console.log('Đã lấy access token');

      // Tạo URL download với token
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      console.log('URL tải xuống:', downloadUrl);

      // Tải file với token
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': '*/*'
        }
      });

      if (!response.ok) {
        // Nếu lỗi 404, thử dùng cookie
        if (response.status === 404) {
          console.log('API báo 404, thử dùng cookie...');
          
          let cookies = '';
          try {
            // Kiểm tra file cookie tồn tại
            if (!fs.existsSync('kimvan-cookie.json')) {
              throw new Error('Không tìm thấy file kimvan-cookie.json');
            }

            // Đọc và parse file cookie
            const cookieContent = fs.readFileSync('kimvan-cookie.json', 'utf8');
            const cookieData = JSON.parse(cookieContent);

            // Kiểm tra format cookie
            if (!cookieData || !Array.isArray(cookieData.cookies)) {
              throw new Error('Format cookie không hợp lệ. Vui lòng xem hướng dẫn trong docs/kimvan-chrome-cookie.md');
            }

            // Tạo cookie string
            cookies = cookieData.cookies
              .filter(cookie => cookie && cookie.name && cookie.value)
              .map(cookie => `${cookie.name}=${cookie.value}`)
              .join('; ');

            if (!cookies) {
              throw new Error('Không tìm thấy cookie hợp lệ');
            }

            console.log('Đã đọc cookie từ file');

            // Tạo URL download trực tiếp
            const directUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
            console.log('URL tải xuống trực tiếp:', directUrl);

            // Tải file với cookie
            const cookieResponse = await fetch(directUrl, {
              headers: {
                'Cookie': cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              }
            });

            if (!cookieResponse.ok) {
              throw new Error(`Lỗi khi tải file với cookie (HTTP ${cookieResponse.status})`);
            }

            // Kiểm tra content-type
            const contentType = cookieResponse.headers.get('content-type');
            console.log('Content-Type:', contentType);

            if (contentType && contentType.includes('text/html')) {
              // Xử lý trang xác nhận download
              const html = await cookieResponse.text();
              const confirmMatch = html.match(/confirm=([^&"]+)/);
              
              if (confirmMatch) {
                const confirmToken = confirmMatch[1];
                console.log('Tìm thấy token xác nhận, thử tải lại...');
                
                // Tải lại với token xác nhận
                const confirmUrl = `${directUrl}&confirm=${confirmToken}`;
                const confirmResponse = await fetch(confirmUrl, {
                  headers: {
                    'Cookie': cookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                  }
                });
                
                if (!confirmResponse.ok) {
                  throw new Error(`Lỗi khi tải file sau khi xác nhận (HTTP ${confirmResponse.status})`);
                }
                
                // Lưu file
                const dest = fs.createWriteStream(path.join(outputDir, 'downloaded_file'));
                const reader = confirmResponse.body.getReader();
                
                while (true) {
                  const { done, value } = await reader.read();
                  
                  if (done) {
                    console.log('Hoàn tất tải xuống');
                    break;
                  }
                  
                  dest.write(Buffer.from(value));
                }
                
                await new Promise((resolve, reject) => {
                  dest.end();
                  dest.on('finish', resolve);
                  dest.on('error', reject);
                });
                
                return {
                  success: true,
                  filePath: path.join(outputDir, 'downloaded_file'),
                  outputDir,
                  mimeType: confirmResponse.headers.get('content-type')
                };
              } else {
                throw new Error('Không tìm thấy token xác nhận trong HTML');
              }
            }

            // Lưu file
            const dest = fs.createWriteStream(path.join(outputDir, 'downloaded_file'));
            const reader = cookieResponse.body.getReader();
            
            while (true) {
              const { done, value } = await reader.read();
              
              if (done) {
                console.log('Hoàn tất tải xuống');
                break;
              }
              
              dest.write(Buffer.from(value));
            }
            
            await new Promise((resolve, reject) => {
              dest.end();
              dest.on('finish', resolve);
              dest.on('error', reject);
            });

            return {
              success: true,
              filePath: path.join(outputDir, 'downloaded_file'),
              outputDir,
              mimeType: contentType
            };

          } catch (cookieError) {
            console.error('Lỗi khi dùng cookie:', cookieError);
            throw new Error(`Không thể tải file với cookie: ${cookieError.message}`);
          }
        }

        const errorText = await response.text();
        throw new Error(`Lỗi khi tải file (HTTP ${response.status}): ${errorText}`);
      }

      // Lưu file
      const mimeType = response.headers.get('content-type');
      let extension = '';
      
      // Xác định đuôi file dựa vào MIME type
      if (mimeType) {
        switch (mimeType.toLowerCase()) {
          case 'application/pdf':
            extension = '.pdf';
            break;
          case 'image/jpeg':
            extension = '.jpg';
            break;
          case 'image/png':
            extension = '.png';
            break;
          case 'image/gif':
            extension = '.gif';
            break;
          case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            extension = '.docx';
            break;
          case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
            extension = '.xlsx';
            break;
          case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
            extension = '.pptx';
            break;
          default:
            console.log('⚠️ MIME type không xác định:', mimeType);
            break;
        }
      }

      const outputFile = `downloaded_file${extension}`;
      const outputPath = path.join(outputDir, outputFile);
      const dest = fs.createWriteStream(outputPath);
      const reader = response.body.getReader();
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Hoàn tất tải xuống');
          break;
        }
        
        dest.write(Buffer.from(value));
      }
      
      await new Promise((resolve, reject) => {
        dest.end();
        dest.on('finish', resolve);
        dest.on('error', reject);
      });

      const result = {
        success: true,
        filePath: outputPath,
        outputDir,
        mimeType: mimeType
      };

      // Log chi tiết về file
      console.log('✅ Tải file thành công:', result.filePath);
      console.log('📄 MIME type:', result.mimeType);
      console.log('📦 Kích thước:', Math.round(fs.statSync(result.filePath).size / 1024 / 1024 * 100) / 100, 'MB');
      console.log('⏰ Thời gian:', new Date().toLocaleString());
      console.log('🆔 File ID:', fileId);

      return result;

    } catch (error) {
      console.error(`Lỗi khi tải xuống file (lần thử ${retryCount + 1}/${MAX_RETRIES + 1}):`, error);
      lastError = error;
      
      if (retryCount === MAX_RETRIES) {
        throw new Error(`Không thể tải xuống file sau ${MAX_RETRIES + 1} lần thử: ${error.message}`);
      }
      
      try {
        if (fs.existsSync(outputDir)) {
          fs.rmSync(outputDir, { recursive: true });
          console.log(`Đã xóa thư mục tạm ${outputDir} do lỗi`);
        }
      } catch (cleanupError) {
        console.error('Lỗi khi dọn dẹp thư mục tạm:', cleanupError);
      }
    }
  }
}

/**
 * Kiểm tra thông tin và quyền truy cập file
 * @param {string} fileId - ID của file trên Google Drive
 * @returns {Promise<Object>} - Thông tin file
 */
export async function checkFileInfo(fileId) {
  console.log(`Kiểm tra thông tin file ${fileId}...`);
  
  try {
    // Lấy thông tin chi tiết của file, bao gồm permissions và owner
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,fileExtension,capabilities,permissions,owners,sharingUser`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${await getAccessToken()}`
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Lỗi khi lấy thông tin file: ${errorText}`);
      
      if (response.status === 404) {
        return {
          success: false,
          error: 'File không tồn tại hoặc đã bị xóa',
          status: 404
        };
      }
      
      if (response.status === 403) {
        return {
          success: false,
          error: 'Không có quyền truy cập file',
          status: 403
        };
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const fileInfo = await response.json();
    
    // Log thông tin chi tiết để debug
    console.log('Chi tiết file:', {
      id: fileInfo.id,
      name: fileInfo.name,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      capabilities: fileInfo.capabilities,
      owner: fileInfo.owners?.[0] ? {
        displayName: fileInfo.owners[0].displayName,
        emailAddress: fileInfo.owners[0].emailAddress,
        permissionId: fileInfo.owners[0].permissionId,
        kind: fileInfo.owners[0].kind
      } : null,
      sharingUser: fileInfo.sharingUser ? {
        displayName: fileInfo.sharingUser.displayName,
        emailAddress: fileInfo.sharingUser.emailAddress,
        permissionId: fileInfo.sharingUser.permissionId,
        kind: fileInfo.sharingUser.kind
      } : null
    });

    // Kiểm tra quyền truy cập
    const canDownload = fileInfo.capabilities?.canDownload;
    if (!canDownload) {
      return {
        success: false,
        error: 'Không có quyền tải xuống file',
        status: 403,
        fileInfo
      };
    }

    return {
      success: true,
      fileInfo
    };
  } catch (error) {
    console.error('Lỗi khi kiểm tra file:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Liệt kê tất cả các file trong một folder Google Drive
 * @param {string} folderId - ID của folder cần liệt kê
 * @returns {Promise<Array>} - Danh sách các file trong folder
 */
export async function listFilesInFolder(folderId) {
  console.log(`Đang liệt kê các file trong folder ${folderId}...`);
  
  try {
    // Tạo OAuth2 client với khả năng tự động refresh token
    const oauth2Client = createOAuth2Client(1); // Sử dụng token tải xuống
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    // Kiểm tra quyền truy cập folder
    try {
      const folderInfo = await drive.files.get({
        fileId: folderId,
        fields: 'name,mimeType,capabilities'
      });
      
      // Kiểm tra xem đây có phải là folder không
      if (folderInfo.data.mimeType !== 'application/vnd.google-apps.folder') {
        return {
          success: false,
          error: 'ID được cung cấp không phải là folder',
          errorCode: 'NOT_A_FOLDER'
        };
      }
      
      // Kiểm tra quyền truy cập
      if (folderInfo.data.capabilities && !folderInfo.data.capabilities.canListChildren) {
        return {
          success: false,
          error: `Không có quyền liệt kê nội dung của folder: ${folderInfo.data.name || folderId}`,
          errorCode: 'PERMISSION_DENIED'
        };
      }
      
      console.log(`Đã xác nhận quyền truy cập vào folder: ${folderInfo.data.name}`);
    } catch (error) {
      // Xử lý lỗi khi kiểm tra folder
      if (error.code === 404 || error.response?.status === 404) {
        return {
          success: false,
          error: `Folder không tồn tại (404): ${folderId}`,
          errorCode: 'FOLDER_NOT_FOUND'
        };
      }
      
      if (error.code === 403 || error.response?.status === 403) {
        return {
          success: false,
          error: `Không có quyền truy cập folder (403): ${folderId}`,
          errorCode: 'PERMISSION_DENIED'
        };
      }
      
      return {
        success: false,
        error: `Lỗi khi kiểm tra folder: ${error.message}`,
        errorCode: 'CHECK_FOLDER_ERROR'
      };
    }
    
    let files = [];
    let pageToken = null;
    
    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'nextPageToken, files(id, name, mimeType, size)',
        pageToken: pageToken,
        pageSize: 1000
      });
      
      files = files.concat(response.data.files);
      pageToken = response.data.nextPageToken;
    } while (pageToken);
    
    console.log(`Đã tìm thấy ${files.length} file/folder trong folder ${folderId}`);
    return {
      success: true,
      files: files
    };
  } catch (error) {
    console.error(`Lỗi khi liệt kê file trong folder ${folderId}:`, error);
    
    // Phân loại lỗi
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = error.message;
    
    if (error.code === 404 || error.response?.status === 404) {
      errorCode = 'FOLDER_NOT_FOUND';
      errorMessage = `Folder không tồn tại (404): ${folderId}`;
    } else if (error.code === 403 || error.response?.status === 403) {
      errorCode = 'PERMISSION_DENIED';
      errorMessage = `Không có quyền truy cập folder (403): ${folderId}`;
    } else if (error.code === 401 || error.response?.status === 401) {
      errorCode = 'UNAUTHORIZED';
      errorMessage = `Không được xác thực để truy cập folder (401): ${folderId}`;
    }
    
    return {
      success: false,
      error: errorMessage,
      errorCode: errorCode
    };
  }
} 