/**
 * PDF Toolkit - Công cụ xử lý PDF đa năng
 * 
 * Bao gồm các chức năng:
 * - Xóa watermark (song song)
 * - Xem thông tin PDF
 * - Chuyển đổi ảnh sang PDF
 */

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

// API validation token
const API_TOKEN = 'api@test-watermark';

// Đường dẫn file lưu token
const TOKEN_PATH = path.join(process.cwd(), 'youtube_token.json');

// Đọc token từ file
function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
      console.log('Đọc token từ file:', TOKEN_PATH);
      if (tokenContent.length === 0) {
        console.error('File token tồn tại nhưng trống');
        return null;
      }
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        console.log('Phân tích token thành công. Trường có sẵn:', Object.keys(parsedToken).join(', '));
        console.log('Token scope:', parsedToken.scope);
        return parsedToken;
      } catch (parseError) {
        console.error('Lỗi phân tích JSON token:', parseError);
        return null;
      }
    } else {
      console.error('File token không tồn tại tại đường dẫn:', TOKEN_PATH);
    }
  } catch (error) {
    console.error('Lỗi đọc file token:', error);
  }
  return null;
}

// Extract file ID from Google Drive link
function extractGoogleDriveFileId(url) {
  // Handle different Drive URL formats
  let fileId = null;
  
  // Format: https://drive.google.com/file/d/{fileId}/view
  const filePattern = /\/file\/d\/([^\/\?&]+)/;
  const fileMatch = url.match(filePattern);
  
  if (fileMatch && fileMatch[1]) {
    fileId = fileMatch[1].split('?')[0]; // Loại bỏ các tham số URL
    return fileId;
  }
  
  // Format: https://drive.google.com/open?id={fileId}
  const openPattern = /[?&]id=([^&]+)/;
  const openMatch = url.match(openPattern);
  
  if (openMatch && openMatch[1]) {
    fileId = openMatch[1].split('&')[0]; // Loại bỏ các tham số khác
    return fileId;
  }
  
  // Format: https://docs.google.com/document/d/{fileId}/edit
  const docsPattern = /\/document\/d\/([^\/\?&]+)/;
  const docsMatch = url.match(docsPattern);
  
  if (docsMatch && docsMatch[1]) {
    fileId = docsMatch[1].split('?')[0]; // Loại bỏ các tham số URL
    return fileId;
  }
  
  if (!fileId) {
    throw new Error('Could not extract file ID from Google Drive URL');
  }
  
  return fileId;
}

// Download file from Google Drive using API
async function downloadFromGoogleDrive(fileId) {
  console.log(`Downloading file from Google Drive with ID: ${fileId}`);
  
  // Create temp directory if it doesn't exist
  const tempDir = path.join(os.tmpdir(), 'drive-download-');
  const outputDir = fs.mkdtempSync(tempDir);
  
  try {
    // Get stored token
    const storedToken = getStoredToken();
    if (!storedToken) {
      throw new Error('Google Drive token not found. Please configure the API in settings.');
    }
    
    // Create OAuth2 client and Drive API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(storedToken);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    
    console.log('Checking Drive access...');
    try {
      // Check if token has Drive access
      const aboutResponse = await drive.about.get({
        fields: 'user'
      });
      
      console.log(`Valid Drive token. User: ${aboutResponse.data.user?.displayName || 'Unknown'}`);
      console.log(`User email: ${aboutResponse.data.user?.emailAddress || 'Unknown'}`);
      
      // Try to get file information
      try {
        console.log(`Getting Google Drive file info: ${fileId}`);
        const fileInfo = await drive.files.get({
          fileId: fileId,
          fields: 'id,name,mimeType,size,capabilities'
        });
        
        console.log('Google Drive file info:');
        console.log(`- Name: ${fileInfo.data.name}`);
        console.log(`- Type: ${fileInfo.data.mimeType}`);
        console.log(`- Size: ${fileInfo.data.size || 'Unknown'}`);
        
        if (fileInfo.data.capabilities) {
          console.log('- Your permissions:');
          console.log(`  - Edit: ${fileInfo.data.capabilities.canEdit ? 'Yes' : 'No'}`);
          console.log(`  - Download: ${fileInfo.data.capabilities.canDownload ? 'Yes' : 'No'}`);
        }
        
        const fileName = fileInfo.data.name || `google-drive-${fileId}`;
        const contentType = fileInfo.data.mimeType || 'application/octet-stream';
        
        // Check if can download
        if (fileInfo.data.capabilities && !fileInfo.data.capabilities.canDownload) {
          console.warn('WARNING: You do not have permission to download this file!');
          
          // Try to create a copy if possible
          if (fileInfo.data.capabilities.canCopy) {
            console.log('Trying to create a copy of the file...');
            
            const copyResult = await drive.files.copy({
              fileId: fileId,
              resource: {
                name: `Copy of ${fileName}`
              },
              fields: 'id,name,mimeType,size'
            });
            
            console.log('Successfully created a copy:', copyResult.data);
            fileId = copyResult.data.id; // Update to new ID
          } else {
            throw new Error('You do not have permission to download or copy this file');
          }
        }
        
        // Download file
        console.log(`Downloading Google Drive file: ${fileId}`);
        const response = await drive.files.get({
          fileId: fileId,
          alt: 'media'
        }, {
          responseType: 'arraybuffer'
        });
        
        const fileBuffer = Buffer.from(response.data);
        console.log(`Successfully downloaded Google Drive file (${fileBuffer.length} bytes)`);
        
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
        
      } catch (fileError) {
        console.error(`Error accessing file: ${fileError.message}`);
        
        if (fileError.message.includes('File not found') || 
            fileError.message.includes('not found')) {
          throw new Error(`File ID "${fileId}" does not exist or you don't have access. 
          
          Possible reasons:
          1. Incorrect file ID
          2. File belongs to another Google account not shared with you
          3. File has been deleted
          
          Solutions:
          - Check the link and file ID
          - If the file is yours, make sure you're using the correct Google account
          - If the file belongs to someone else, ask them to share it with edit permissions`);
        }
        
        if (fileError.message.includes('Insufficient Permission')) {
          throw new Error(`You don't have sufficient permissions to access file "${fileId}".
          
          Solutions:
          - If the file is yours: Make sure you're using the correct Google account
          - If the file belongs to someone else: Ask them to share the file with edit permissions (not just view)
          - Try accessing the file directly in your browser: https://drive.google.com/file/d/${fileId}/view`);
        }
        
        throw fileError;
      }
    } catch (driveError) {
      console.error('Drive API Error:', driveError.message);
      
      if (driveError.message.includes('invalid_grant') || 
          driveError.message.includes('token')) {
        throw new Error(`Google Drive token is invalid or expired. Please reconfigure the API in settings.`);
      }
      
      throw driveError;
    }
  } catch (error) {
    // Clean up temp directory on error
    cleanupTempFiles(outputDir);
    throw error;
  }
}

// Fallback to direct download when API fails
async function downloadDirect(fileId, outputDir) {
  console.log(`Falling back to direct download for Google Drive ID: ${fileId}`);
  
  try {
    // Direct download link using file ID
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    
    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream'
    });
    
    // Get content type from response headers
    const contentType = response.headers['content-type'];
    console.log(`Content-Type: ${contentType}`);
    
    // Create a unique filename
    const fileExtension = getExtensionFromMimeType(contentType);
    const uniqueFileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join(outputDir, uniqueFileName);
    
    const writer = createWriteStream(filePath);
    await pipeline(response.data, writer);
    
    const fileSize = fs.statSync(filePath).size;
    console.log(`Downloaded file size: ${fileSize} bytes`);
    
    return {
      success: true,
      filePath: filePath,
      fileName: `google-drive-${fileId}${fileExtension}`,
      contentType: contentType || 'application/octet-stream',
      outputDir: outputDir,
      size: fileSize
    };
  } catch (error) {
    console.error('Error downloading file directly from Google Drive:', error.message);
    throw new Error(`Failed to download file: ${error.message}`);
  }
}

// Get file extension from MIME type
function getExtensionFromMimeType(mimeType) {
  if (!mimeType) return '.bin';
  
  const mimeToExt = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'audio/mpeg': '.mp3',
    'text/plain': '.txt',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx'
  };
  
  for (const [mime, ext] of Object.entries(mimeToExt)) {
    if (mimeType.includes(mime)) return ext;
  }
  
  return '.bin';
}

// Clean up temporary files
function cleanupTempFiles(tempDir) {
  console.log('Cleaning up temporary files...');
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      fs.unlinkSync(path.join(tempDir, file));
    }
    fs.rmdirSync(tempDir, { recursive: true });
  }
}

// Next.js API route handler
export async function POST(request) {
  let tempDir = null;
  
  try {
    // Check if request contains proper authorization
    const { token, driveLink } = await request.json();

    // Validate API token
    if (!token || token !== API_TOKEN) {
      return NextResponse.json(
        { error: 'Unauthorized. Invalid API token.' },
        { status: 401 }
      );
    }

    // Validate drive link
    if (!driveLink) {
      return NextResponse.json(
        { error: 'Missing Google Drive link.' },
        { status: 400 }
      );
    }

    console.log(`Processing request with Drive link: ${driveLink}`);
    
    // Extract file ID from Drive link
    const fileId = extractGoogleDriveFileId(driveLink);
    console.log(`Extracted Google Drive file ID: ${fileId}`);
    
    let downloadResult;
    
    try {
      // First try to download using Google Drive API
      downloadResult = await downloadFromGoogleDrive(fileId);
      tempDir = downloadResult.outputDir;
    } catch (apiError) {
      console.error('Google Drive API download failed, falling back to direct download:', apiError.message);
      
      // Create temp directory if API method didn't create one
      if (!tempDir) {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-download-'));
      }
      
      // Try direct download as fallback
      downloadResult = await downloadDirect(fileId, tempDir);
    }
    
    // Read downloaded file
    const fileContent = fs.readFileSync(downloadResult.filePath);
    
    // Clean up temp files
    cleanupTempFiles(tempDir);
    tempDir = null; // Prevent double cleanup
    
    // Return downloaded file as binary stream
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': downloadResult.contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(downloadResult.fileName)}"`,
        'Content-Length': downloadResult.size.toString()
      }
    });
    
  } catch (error) {
    console.error('Error processing request:', error.message);
    
    // Clean up temp directory on error
    if (tempDir && fs.existsSync(tempDir)) {
      cleanupTempFiles(tempDir);
    }
    
    return NextResponse.json(
      { error: `Failed to download file: ${error.message}` },
      { status: 500 }
    );
  }
}

// For testing purposes
export async function GET() {
  return NextResponse.json(
    { 
      message: 'Google Drive Download API is running.',
      usage: 'Send a POST request with token and driveLink parameters' 
    },
    { status: 200 }
  );
} 