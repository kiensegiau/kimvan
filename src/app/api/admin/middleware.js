import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth-utils';
import { cookieConfig } from '@/config/env-config';

export async function adminAuthMiddleware(request) {
  // Bypass all authentication, create a new request with admin privileges
  const requestWithAdmin = new Request(request);
  requestWithAdmin.admin = {
    uid: 'mock-admin-id',
    email: 'admin@example.com',
    displayName: 'Admin User'
  };
  
  return requestWithAdmin;
} 