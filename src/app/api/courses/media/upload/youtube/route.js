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
        error: 'Google account not connected or missing YouTube permissions. Please connect your Google account with YouTube scope.' 
      }, { status: 403 });
    }

    // Setup Google OAuth with user's access token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: userAccount.access_token,
      refresh_token: userAccount.refresh_token,
      expiry_date: userAccount.expires_at * 1000,
    });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Track upload results
    const results = {
      successCount: 0,
      failedCount: 0,
      details: []
    };

    // Process each media item
    for (const mediaItem of mediaItems) {
      try {
        // Check if the file is a video format
        const fileExtension = path.extname(mediaItem.url).toLowerCase();
        const supportedVideoFormats = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv'];
        
        if (!supportedVideoFormats.includes(fileExtension)) {
          results.failedCount++;
          results.details.push({
            id: mediaItem.id,
            title: mediaItem.title || mediaItem.fileName || 'Unknown file',
            success: false,
            message: 'File format not supported for YouTube upload'
          });
          continue;
        }

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

        // Create a readable stream for the video file
        const fileStream = fs.createReadStream(filePath);

        // Prepare video metadata
        const title = mediaItem.title || `Course: ${course.title} - Video`;
        const description = mediaItem.description || `Video from the course: ${course.title}`;

        // Upload to YouTube
        const response = await youtube.videos.insert({
          part: 'snippet,status',
          requestBody: {
            snippet: {
              title,
              description,
              tags: ['course', 'education', course.title],
              categoryId: '27' // Education category
            },
            status: {
              privacyStatus: 'unlisted' // Default to unlisted for privacy
            }
          },
          media: {
            body: fileStream
          }
        });

        const videoId = response.data.id;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Update the media item in the database with YouTube information
        await prisma.media.update({
          where: { id: mediaItem.id },
          data: {
            youtubeVideoId: videoId,
            youtubeUrl: videoUrl,
          }
        });

        // Update success results
        results.successCount++;
        results.details.push({
          id: mediaItem.id,
          title: title,
          success: true,
          youtubeUrl: videoUrl,
          youtubeVideoId: videoId
        });

      } catch (error) {
        console.error('Error uploading to YouTube:', error);
        
        results.failedCount++;
        results.details.push({
          id: mediaItem.id,
          title: mediaItem.title || mediaItem.fileName || 'Unknown file',
          success: false,
          message: error.message || 'Failed to upload to YouTube'
        });
      }
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('YouTube upload API error:', error);
    return NextResponse.json({ error: error.message || 'An unexpected error occurred' }, { status: 500 });
  }
} 