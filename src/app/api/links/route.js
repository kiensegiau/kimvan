import { NextResponse } from 'next/server';
import { authMiddleware } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { connectDB } from '@/lib/mongodb';
import mongoose from 'mongoose';

// Create Link schema if it doesn't exist
let LinkSchema;
let Link;
try {
  Link = mongoose.model('Link');
} catch {
  LinkSchema = new mongoose.Schema({
    originalUrl: {
      type: String,
      required: true
    },
    linkId: {
      type: String,
      required: true,
      unique: true
    },
    title: String,
    createdBy: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: '30d' // Links expire after 30 days
    }
  });
  Link = mongoose.models.Link || mongoose.model('Link', LinkSchema);
}

// Middleware to check authentication
async function checkAuth(request) {
  const user = await authMiddleware(request);
  if (!user) {
    return {
      isAuthorized: false,
      response: NextResponse.json(
        { success: false, error: 'Unauthorized access' },
        { status: 401 }
      )
    };
  }
  return { isAuthorized: true, user };
}

// POST /api/links - Create a new proxied link
export async function POST(request) {
  try {
    // Check auth
    const auth = await checkAuth(request);
    if (!auth.isAuthorized) {
      return auth.response;
    }

    const data = await request.json();
    const { url, title } = data;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Create a unique ID for the link
    const linkId = uuidv4();
    
    // Save the link to the database
    const newLink = new Link({
      originalUrl: url,
      linkId,
      title: title || 'Untitled',
      createdBy: auth.user.email
    });
    
    await newLink.save();
    
    return NextResponse.json({
      success: true,
      message: 'Link created successfully',
      link: {
        id: linkId,
        url: `/api/links/${linkId}`,
        title: newLink.title
      }
    });
  } catch (error) {
    console.error('Error creating proxied link:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create proxied link' },
      { status: 500 }
    );
  }
}

// GET /api/links - Get all links (admin only)
export async function GET(request) {
  try {
    // Check auth
    const auth = await checkAuth(request);
    if (!auth.isAuthorized) {
      return auth.response;
    }
    
    // Only admin can list all links
    if (auth.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    await connectDB();
    
    // Get all links
    const links = await Link.find({})
      .sort({ createdAt: -1 })
      .limit(100);
    
    return NextResponse.json({
      success: true,
      links: links.map(link => ({
        id: link.linkId,
        url: `/api/links/${link.linkId}`,
        originalUrl: link.originalUrl,
        title: link.title,
        createdBy: link.createdBy,
        createdAt: link.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching links:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch links' },
      { status: 500 }
    );
  }
} 