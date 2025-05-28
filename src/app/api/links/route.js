import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

// Khóa mã hóa cho URL - phải giống với khóa ở phía client
const URL_ENCRYPTION_KEY = 'kimvan-secure-url-key-2024';

// Hàm xác thực request
function validateRequest(req) {
  // Kiểm tra origin của request để ngăn CSRF
  const origin = req.headers.get('origin');
  // Thêm logic xác thực nếu cần
  return true;
}

// Hàm mã hóa URL để bảo vệ
function encryptUrl(url) {
  if (!url) return '';
  return CryptoJS.AES.encrypt(url, URL_ENCRYPTION_KEY).toString();
}

// Hàm giải mã URL
function decryptUrl(encryptedUrl) {
  if (!encryptedUrl) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedUrl, URL_ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Lỗi giải mã URL:', error);
    return '';
  }
}

// Hàm trích xuất YouTube video ID từ URL
function extractYoutubeId(url) {
  if (!url) return null;
  
  // Hỗ trợ nhiều định dạng URL YouTube
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  
  return (match && match[2].length === 11) ? match[2] : null;
}

// Hàm trích xuất YouTube playlist ID từ URL
function extractYoutubePlaylistId(url) {
  if (!url) return null;
  
  // Tìm list= trong URL và lấy ID sau nó
  const listMatch = url.match(/[?&]list=([^&#]*)/);
  if (listMatch && listMatch[1]) {
    return listMatch[1];
  }
  
  // Nếu URL có định dạng /playlist/{id}
  const playlistPathMatch = url.match(/\/playlist\/([^/?&#]*)/);
  if (playlistPathMatch && playlistPathMatch[1]) {
    return playlistPathMatch[1];
  }
  
  return null;
}

// Hàm kiểm tra xem URL có phải là YouTube playlist không
function isYoutubePlaylist(url) {
  if (!url) return false;
  
  // Kiểm tra các mẫu URL phổ biến của playlist
  if (url.includes('youtube.com/playlist?list=')) {
    return true;
  }
  
  // Kiểm tra URL có chứa tham số list= và không phải là index=
  if ((url.includes('youtube.com/watch') || url.includes('youtu.be/')) && 
      url.includes('list=') && 
      !url.includes('index=')) {
    return true;
  }
  
  // Kiểm tra URL có chứa playlist trong đường dẫn
  if (url.match(/youtube\.com\/(.*?)playlist/)) {
    return true;
  }
  
  return false;
}

// Hàm kiểm tra xem URL có phải là thư mục Google Drive không
function isGoogleDriveFolder(url) {
  if (!url) return false;
  return url.includes('/folders/') || 
         url.includes('/drive/folders/') || 
         url.includes('/drive/u/0/folders/');
}

// Hàm xử lý link Google Drive
function processGoogleDriveLink(url) {
  // Kiểm tra nếu là thư mục thì không xử lý
  if (isGoogleDriveFolder(url)) {
    return url;
  }
  
  // Nếu là link chia sẻ thông thường
  if (url.includes('drive.google.com/file/d/')) {
    // Trích xuất ID file
    const fileIdMatch = url.match(/\/file\/d\/([^/]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      // Tạo link xem trước trực tiếp
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  }
  
  // Nếu là link view
  if (url.includes('drive.google.com/open?id=')) {
    const fileIdMatch = url.match(/id=([^&]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      const fileId = fileIdMatch[1];
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  }
  
  // Nếu là link docs, sheets, slides
  if (url.includes('docs.google.com') || 
      url.includes('sheets.google.com') || 
      url.includes('slides.google.com')) {
    // Đảm bảo link có /preview ở cuối
    if (!url.includes('/preview') && !url.includes('/edit')) {
      return url + '/preview';
    }
    // Chuyển từ /edit sang /preview
    if (url.includes('/edit')) {
      return url.replace('/edit', '/preview');
    }
  }
  
  return url;
}

// Hàm xử lý các loại link khác nhau
function processLink(url, type = 'unknown') {
  if (!url) {
    throw new Error('URL không được cung cấp');
  }

  // Kiểm tra nếu là thư mục Google Drive
  if (isGoogleDriveFolder(url)) {
    return url; // Không xử lý thư mục, trả về URL gốc
  }

  // Xử lý link YouTube Playlist
  if (type === 'youtube_playlist' || isYoutubePlaylist(url)) {
    // Đối với playlist, trả về URL gốc vì cần xử lý đặc biệt ở client
    return url;
  }

  // Xử lý link YouTube
  if (type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
    // Kiểm tra xem có phải là playlist không
    if (isYoutubePlaylist(url)) {
      return url; // Trả về URL gốc cho playlist
    }
    
    const videoId = extractYoutubeId(url);
    if (videoId) {
      // Trả về URL embed để sử dụng trong iframe
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
  }

  // Xử lý link Google Drive
  if (type === 'drive' || url.includes('drive.google.com') || url.includes('docs.google.com')) {
    return processGoogleDriveLink(url);
  }
  
  // Xử lý link PDF
  if (type === 'pdf' || url.toLowerCase().endsWith('.pdf')) {
    // Nếu là PDF trên Google Drive, chuyển sang xem trước
    if (url.includes('drive.google.com')) {
      return processGoogleDriveLink(url);
    }
    // Giữ nguyên link PDF
    return url;
  }

  // Trả về URL gốc nếu không có xử lý đặc biệt
  return url;
}

// POST handler - nhận URL và trả về URL đã xử lý
export async function POST(req) {
  try {
    // Xác thực request
    if (!validateRequest(req)) {
      return NextResponse.json({ error: 'Không được phép truy cập' }, { status: 403 });
    }

    // Parse body từ request
    const body = await req.json();
    const { url, type } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL không được cung cấp' }, { status: 400 });
    }

    // Xử lý URL dựa trên loại
    const processedUrl = processLink(url, type);
    
    // Kiểm tra xem URL có phải là playlist YouTube không
    const isPlaylist = isYoutubePlaylist(url);
    let playlistId = null;
    
    if (isPlaylist) {
      playlistId = extractYoutubePlaylistId(url);
    }

    // Mã hóa URL gốc để bảo vệ
    const encryptedOriginalUrl = encryptUrl(url);

    // Trả về URL đã xử lý
    return NextResponse.json({ 
      originalUrl: encryptedOriginalUrl, // URL gốc đã được mã hóa
      processedUrl: processedUrl,
      type: isPlaylist ? 'youtube_playlist' : (type || 'unknown'),
      playlistId: playlistId, // Thêm playlistId vào response nếu có
      isPlaylist
    });
  } catch (error) {
    console.error('Lỗi xử lý link:', error);
    return NextResponse.json({ error: error.message || 'Lỗi xử lý link' }, { status: 500 });
  }
}

// GET handler - giải mã URL đã mã hóa
export async function GET(req) {
  try {
    // Lấy URL từ query string
    const { searchParams } = new URL(req.url);
    const encryptedUrl = searchParams.get('url');

    if (!encryptedUrl) {
      return NextResponse.json({ error: 'URL không được cung cấp' }, { status: 400 });
    }

    // Giải mã URL
    const originalUrl = decryptUrl(encryptedUrl);

    if (!originalUrl) {
      return NextResponse.json({ error: 'URL không hợp lệ hoặc đã hết hạn' }, { status: 400 });
    }

    // Chuyển hướng đến URL gốc
    return NextResponse.redirect(originalUrl);
  } catch (error) {
    console.error('Lỗi giải mã URL:', error);
    return NextResponse.json({ error: 'Không thể giải mã URL' }, { status: 500 });
  }
} 