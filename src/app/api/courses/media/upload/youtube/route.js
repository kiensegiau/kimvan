import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';

// File path để lưu token
const TOKEN_PATH = path.join(process.cwd(), 'youtube_token.json');

// Đọc token từ file
function getStoredToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const tokenContent = fs.readFileSync(TOKEN_PATH, 'utf8');
      return JSON.parse(tokenContent);
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
    // Parse request data
    const data = await request.json();
    const { courseId, mediaItems } = data;

    // Validate required fields
    if (!courseId || !mediaItems || !Array.isArray(mediaItems) || mediaItems.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify the course exists
    const course = await prisma.course.findFirst({
      where: {
        id: courseId
      }
    });

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Setup YouTube API client with environment variables and token file
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Lấy token từ file
    const storedToken = getStoredToken();
    if (!storedToken) {
      return NextResponse.json({ 
        error: 'YouTube token not found. Please run setup process first.',
        setupRequired: true
      }, { status: 403 });
    }

    oauth2Client.setCredentials(storedToken);

    // Xử lý token khi được làm mới
    oauth2Client.on('tokens', (tokens) => {
      const updatedTokens = { ...storedToken, ...tokens };
      saveToken(updatedTokens);
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