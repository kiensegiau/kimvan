import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
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

    // Get Google OAuth2 tokens from the user's account
    const userAccount = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google'
      }
    });

    if (!userAccount || !userAccount.access_token) {
      return NextResponse.json({ 
        error: 'Google account not connected or missing Drive permissions. Please connect your Google account with Drive scope.' 
      }, { status: 403 });
    }

    // Setup Google Drive API with user's access token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: userAccount.access_token,
      refresh_token: userAccount.refresh_token,
      expiry_date: userAccount.expires_at * 1000,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

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