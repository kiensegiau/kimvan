import { NextResponse } from 'next/server';
import { 
  loadApiKeys, 
  saveApiKeys, 
  removeApiKey, 
  checkApiKeyCredits 
} from '@/utils/watermark-api-keys';

// GET - Retrieve all API keys
export async function GET() {
  try {
    const keys = loadApiKeys();
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('Error loading API keys:', error);
    return NextResponse.json(
      { error: `Failed to load API keys: ${error.message}` },
      { status: 500 }
    );
  }
}

// POST - Add a new API key
export async function POST(request) {
  try {
    const { apiKey } = await request.json();
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid API key provided' },
        { status: 400 }
      );
    }
    
    console.log(`Đang kiểm tra API key: ${apiKey.substring(0, 5)}...`);
    
    // Check if the API key is valid by checking credits
    try {
      const credits = await checkApiKeyCredits(apiKey);
      console.log(`API key ${apiKey.substring(0, 5)}... có ${credits} credits`);
      
      // Chỉ chấp nhận API key nếu có credits > 0
      if (credits <= 0) {
        return NextResponse.json(
          { error: 'API key has no credits' },
          { status: 400 }
        );
      }
      
      // Load existing keys
      const keys = loadApiKeys();
      
      // Check if key already exists
      if (keys.includes(apiKey)) {
        return NextResponse.json(
          { error: 'API key already exists' },
          { status: 400 }
        );
      }
      
      // Add new key
      keys.push(apiKey);
      
      // Save updated keys
      const saved = saveApiKeys(keys);
      
      if (!saved) {
        return NextResponse.json(
          { error: 'Failed to save API key' },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'API key added successfully',
        credits
      });
    } catch (creditError) {
      console.error(`Lỗi khi kiểm tra credits của API key: ${creditError.message}`);
      
      // Nếu lỗi là do không thể kết nối đến API kiểm tra credits,
      // vẫn thêm API key vào hệ thống để người dùng có thể thử lại sau
      if (creditError.message.includes('ECONNREFUSED') || 
          creditError.message.includes('timeout') ||
          creditError.message.includes('network') ||
          creditError.message.includes('socket')) {
        
        console.log(`Không thể kết nối đến API kiểm tra credits, thêm API key vào hệ thống để thử lại sau`);
        
        // Load existing keys
        const keys = loadApiKeys();
        
        // Check if key already exists
        if (keys.includes(apiKey)) {
          return NextResponse.json(
            { error: 'API key already exists' },
            { status: 400 }
          );
        }
        
        // Add new key
        keys.push(apiKey);
        
        // Save updated keys
        const saved = saveApiKeys(keys);
        
        if (!saved) {
          return NextResponse.json(
            { error: 'Failed to save API key' },
            { status: 500 }
          );
        }
        
        return NextResponse.json({ 
          success: true, 
          message: 'API key added successfully (credits could not be verified)',
          credits: 'unknown'
        });
      }
      
      return NextResponse.json(
        { error: `API key has no credits or is invalid: ${creditError.message}` },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error adding API key:', error);
    return NextResponse.json(
      { error: `Failed to add API key: ${error.message}` },
      { status: 500 }
    );
  }
}

// DELETE - Remove an API key
export async function DELETE(request) {
  try {
    const { apiKey } = await request.json();
    
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'Invalid API key provided' },
        { status: 400 }
      );
    }
    
    const removed = removeApiKey(apiKey);
    
    if (!removed) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'API key removed successfully' 
    });
  } catch (error) {
    console.error('Error removing API key:', error);
    return NextResponse.json(
      { error: `Failed to remove API key: ${error.message}` },
      { status: 500 }
    );
  }
} 