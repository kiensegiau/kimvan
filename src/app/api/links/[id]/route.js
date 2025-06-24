import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import mongoose from 'mongoose';

// Get Link model if it exists
let Link;
try {
  Link = mongoose.model('Link');
} catch {
  const LinkSchema = new mongoose.Schema({
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

// GET /api/links/[id] - Redirect to the original URL
export async function GET(request, { params }) {
  try {
    const { id } = params;

    await connectDB();
    
    // Find link by ID
    const link = await Link.findOne({ linkId: id });
    
    if (!link) {
      return NextResponse.json(
        { success: false, error: 'Link not found' }, 
        { status: 404 }
      );
    }
    
    // Redirect to the original URL
    return NextResponse.redirect(link.originalUrl);
  } catch (error) {
    console.error('Error accessing link:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to access link' },
      { status: 500 }
    );
  }
} 