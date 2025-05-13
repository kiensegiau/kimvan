import { NextResponse } from 'next/server';

// Hàm redirection để chuyển hướng từ API cũ sang API mới
export async function POST(request) {
  // Chuyển hướng đến API mới
  console.log('[DEPRECATED] Redirecting POST request from kimvan-cookie to kimvan-token');
  const data = await request.json();
  const response = await fetch(new URL('/api/youtube/kimvan-token', request.url), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });
  
  return response;
}

export async function GET(request) {
  // Chuyển hướng đến API mới
  console.log('[DEPRECATED] Redirecting GET request from kimvan-cookie to kimvan-token');
  const response = await fetch(new URL('/api/youtube/kimvan-token', request.url), {
    method: 'GET'
  });
  
  return response;
}

export async function DELETE(request) {
  // Chuyển hướng đến API mới
  console.log('[DEPRECATED] Redirecting DELETE request from kimvan-cookie to kimvan-token');
  const response = await fetch(new URL('/api/youtube/kimvan-token', request.url), {
    method: 'DELETE'
  });
  
  return response;
} 