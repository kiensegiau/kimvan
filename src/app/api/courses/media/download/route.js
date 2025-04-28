import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/prisma';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'Không có quyền truy cập' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { courseId, mediaIds } = body;

    if (!courseId || !mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Thiếu thông tin cần thiết' },
        { status: 400 }
      );
    }

    // Verify course exists and user has permission
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { instructor: true }
    });

    if (!course) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy khóa học' },
        { status: 404 }
      );
    }

    if (course.instructor.email !== session.user.email) {
      return NextResponse.json(
        { success: false, message: 'Bạn không có quyền quản lý khóa học này' },
        { status: 403 }
      );
    }

    // Get the media items
    const mediaItems = await prisma.media.findMany({
      where: {
        id: { in: mediaIds },
        courseId: courseId
      }
    });

    if (mediaItems.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy tập tin media' },
        { status: 404 }
      );
    }

    // Create temporary directory for downloads
    const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-downloads-'));
    const results = {
      success: 0,
      failed: 0,
      details: []
    };

    // Download each media file
    for (const media of mediaItems) {
      try {
        const fileExtension = media.type === 'video' ? '.mp4' : '.pdf';
        const fileName = `${media.title}${fileExtension}`;
        const filePath = path.join(downloadDir, fileName);

        // Skip if file doesn't have a URL
        if (!media.url) {
          results.failed++;
          results.details.push({
            id: media.id,
            title: media.title,
            success: false,
            message: 'URL không hợp lệ'
          });
          continue;
        }

        // Download the file
        const response = await axios({
          method: 'get',
          url: media.url,
          responseType: 'stream'
        });

        await pipeline(response.data, fs.createWriteStream(filePath));

        // Update stats
        results.success++;
        results.details.push({
          id: media.id,
          title: media.title,
          success: true,
          filePath: filePath, // Note: This is only for tracking in the backend
          localFileName: fileName
        });

        // Update the media file to indicate it's been downloaded
        await prisma.mediaDownload.create({
          data: {
            mediaId: media.id,
            courseId: courseId,
            downloadedById: session.user.id
          }
        });
      } catch (error) {
        console.error(`Download error for media ${media.id}: ${error.message}`);
        results.failed++;
        results.details.push({
          id: media.id,
          title: media.title,
          success: false,
          message: error.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      downloadDirectory: downloadDir,
      successCount: results.success,
      failedCount: results.failed,
      details: results.details
    });
  } catch (error) {
    console.error('Media download error:', error);
    return NextResponse.json(
      { success: false, message: `Error: ${error.message}` },
      { status: 500 }
    );
  }
} 