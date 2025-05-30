import { NextResponse } from 'next/server';

/**
 * API endpoint đơn giản để kiểm tra trạng thái server
 * Trả về status 200 và thời gian hiện tại của server
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    message: 'Server đang hoạt động bình thường'
  });
} 