import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Đường dẫn đến script đăng nhập YouTube
const LOGIN_SCRIPT_PATH = path.join(process.cwd(), 'youtube-persistent-login.js');

/**
 * API endpoint để chạy script đăng nhập YouTube
 */
export async function GET(request) {
  try {
    // Kiểm tra xem file script tồn tại không
    if (!fs.existsSync(LOGIN_SCRIPT_PATH)) {
      return NextResponse.json({
        success: false,
        message: 'Không tìm thấy script đăng nhập YouTube'
      }, { status: 404 });
    }

    // Tạo process để chạy script đăng nhập
    const process = spawn('node', [LOGIN_SCRIPT_PATH], {
      detached: true,
      stdio: 'ignore'
    });

    // Tách process ra khỏi parent process
    process.unref();

    return NextResponse.json({
      success: true,
      message: 'Đã khởi động quá trình đăng nhập YouTube'
    });
  } catch (error) {
    console.error('Lỗi khi chạy script đăng nhập YouTube:', error);
    return NextResponse.json({
      success: false,
      message: 'Lỗi khi chạy script đăng nhập YouTube',
      error: error.message
    }, { status: 500 });
  }
} 