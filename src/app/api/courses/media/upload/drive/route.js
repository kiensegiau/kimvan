import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// File path để lưu token
const TOKEN_PATH = path.join(process.cwd(), 'youtube_token.json');

// Đọc token từ file
function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
      console.log('Token file found. Content length:', tokenContent.length);
      if (tokenContent.length === 0) {
        console.error('Token file exists but is empty');
        return null;
      }
      
      try {
        const parsedToken = JSON.parse(tokenContent);
        console.log('Token parsed successfully. Available fields:', Object.keys(parsedToken).join(', '));
        console.log('Token scope:', parsedToken.scope);
        console.log('Token scopes object:', parsedToken.scopes ? JSON.stringify(parsedToken.scopes) : 'undefined');
        return parsedToken;
      } catch (parseError) {
        console.error('Error parsing token JSON:', parseError);
        return null;
      }
    } else {
      console.error('Token file does not exist at path:', TOKEN_PATH);
    }
  } catch (error) {
    console.error('Error reading token file:', error);
  }
  return null;
}

// Lưu token vào file
function saveToken(token) {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
    console.log('Token saved to', TOKEN_PATH);
  } catch (error) {
    console.error('Error saving token:', error);
  }
}

export async function POST(request) {
  try {
    console.log('Starting Drive upload process...');
    
    // Check user authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request data
    const data = await request.json();
    const { courseId, mediaItems } = data;

    // Validate required fields
    if (!courseId || !mediaItems || !Array.isArray(mediaItems) || mediaItems.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the course belongs to the current user
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        userId: session.user.id
      }
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found or you do not have permission to access it' }, { status: 404 });
    }

    // Lấy token từ file thay vì user account
    const storedToken = getStoredToken();
    if (!storedToken) {
      return NextResponse.json({ 
        error: 'Token not found or invalid. Please run setup process again.',
        setupRequired: true
      }, { status: 403 });
    }

    // Kiểm tra scope dùng nhiều cách khác nhau
    console.log('Checking Drive scope in token...');
    
    // Cách 1: Kiểm tra trong scope string
    const scopeStr = storedToken.scope || '';
    const hasDriveInScope = scopeStr.includes('drive');
    console.log('Drive in scope string:', hasDriveInScope, 'Scope:', scopeStr);
    
    // Cách 2: Kiểm tra trong scopes object (được tạo trong google-callback)
    const hasDriveInScopesObj = storedToken.scopes && storedToken.scopes.drive === true;
    console.log('Drive in scopes object:', hasDriveInScopesObj);
    
    const hasGoogleDriveScope = hasDriveInScope || hasDriveInScopesObj;
    
    // Nếu không có quyền drive, thử dùng token trực tiếp và xem lỗi
    if (!hasGoogleDriveScope) {
      console.log('WARNING: Drive scope not found in token. Trying anyway...');
      // Chúng ta sẽ tiếp tục và để API trả về lỗi chi tiết nếu không có quyền
    }

    // Setup Google Drive API với token từ file
    console.log('Setting up Google Drive API client...');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials(storedToken);

    // Xử lý token khi được làm mới
    oauth2Client.on('tokens', (tokens) => {
      console.log('Token refreshed:', Object.keys(tokens).join(', '));
      const updatedTokens = { ...storedToken, ...tokens };
      saveToken(updatedTokens);
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    console.log('Testing Drive API access...');
    try {
      // Kiểm tra quyền truy cập Drive bằng cách gọi một API đơn giản
      const aboutResponse = await drive.about.get({
        fields: 'user'
      });
      console.log('Drive API access successful. User:', aboutResponse.data.user?.displayName || 'unknown');
    } catch (driveTestError) {
      console.error('Error testing Drive API access:', driveTestError.message);
      return NextResponse.json({ 
        error: `Drive API access failed: ${driveTestError.message}. Please run setup process to get proper permissions.`,
        setupRequired: true,
        details: driveTestError.message
      }, { status: 403 });
    }

    // Create a folder for the course uploads if it doesn't exist
    const folderName = `Course: ${course.title}`;
    let folderId;

    // Check if folder already exists
    const folderResponse = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (folderResponse.data.files.length > 0) {
      folderId = folderResponse.data.files[0].id;
    } else {
      // Create a new folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      };

      const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id',
      });

      folderId = folder.data.id;
    }

    // Track upload results
    const results = {
      successCount: 0,
      failedCount: 0,
      details: []
    };

    // Upload each file to Google Drive
    for (const mediaItem of mediaItems) {
      try {
        // Get the file path
        const filePath = path.join(process.cwd(), 'public', mediaItem.url);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          results.failedCount++;
          results.details.push({
            id: mediaItem.id,
            title: mediaItem.title || mediaItem.fileName || 'Unknown file',
            success: false,
            message: 'File not found on server'
          });
          continue;
        }

        // Get file extension and set mime type
        const fileExtension = path.extname(mediaItem.url).toLowerCase();
        let mimeType = 'application/octet-stream'; // Default mime type
        
        // Set correct mime type based on file extension
        switch (fileExtension) {
          case '.pdf':
            mimeType = 'application/pdf';
            break;
          case '.mp4':
            mimeType = 'video/mp4';
            break;
          case '.mov':
            mimeType = 'video/quicktime';
            break;
          case '.webm':
            mimeType = 'video/webm';
            break;
          case '.jpg':
          case '.jpeg':
            mimeType = 'image/jpeg';
            break;
          case '.png':
            mimeType = 'image/png';
            break;
        }

        const fileName = mediaItem.title || mediaItem.fileName || path.basename(mediaItem.url);

        // Upload file to Google Drive
        const fileMetadata = {
          name: fileName,
          parents: [folderId]
        };

        const media = {
          mimeType: mimeType,
          body: fs.createReadStream(filePath)
        };

        const uploadResponse = await drive.files.create({
          resource: fileMetadata,
          media: media,
          fields: 'id, name, webViewLink',
        });

        const fileId = uploadResponse.data.id;
        const webViewLink = uploadResponse.data.webViewLink;

        // Update the media item in the database with Drive information
        await prisma.media.update({
          where: { id: mediaItem.id },
          data: {
            driveFileId: fileId,
            driveUrl: webViewLink,
          }
        });

        // Update success results
        results.successCount++;
        results.details.push({
          id: mediaItem.id,
          title: fileName,
          success: true,
          driveUrl: webViewLink,
          driveFileId: fileId
        });

      } catch (error) {
        console.error('Error uploading file to Drive:', error);
        
        results.failedCount++;
        results.details.push({
          id: mediaItem.id,
          title: mediaItem.title || mediaItem.fileName || 'Unknown file',
          success: false,
          message: error.message || 'Failed to upload to Drive'
        });
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Drive upload API error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
} 