import { NextResponse } from 'next/server';

/**
 * API endpoint để lấy thông tin playlist YouTube
 * @param {Request} request - Request object
 */
export async function GET(request) {
  try {
    // Lấy ID playlist từ URL search params
    const url = new URL(request.url);
    const playlistId = url.searchParams.get('id');
    
    // Kiểm tra nếu không có playlistId
    if (!playlistId) {
      return NextResponse.json(
        { error: 'Thiếu ID playlist' },
        { status: 400 }
      );
    }
    
    try {
      // Tạo URL của playlist YouTube
      const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
      
      console.log('Đang tải playlist từ URL:', playlistUrl);
      
      // Lấy HTML của trang playlist
      const response = await fetch(playlistUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Không thể tải trang playlist (HTTP ${response.status})`);
      }
      
      const html = await response.text();
      
      // Trích xuất dữ liệu video từ HTML
      const videoIds = extractVideoIdsFromHtml(html);
      const videoTitles = extractVideoTitlesFromHtml(html);
      const thumbnails = extractThumbnailsFromHtml(html);
      
      console.log(`Đã tìm thấy ${videoIds.length} video trong playlist`);
      
      // Tạo mảng items theo định dạng tương tự YouTube API
      const items = videoIds.map((videoId, index) => ({
        id: `${index}-${videoId}`,
        snippet: {
          title: videoTitles[index] || `Video ${index + 1}`,
          resourceId: {
            videoId: videoId
          },
          thumbnails: {
            default: {
              url: thumbnails[index] || `https://i.ytimg.com/vi/${videoId}/default.jpg`
            },
            medium: {
              url: thumbnails[index] || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
            },
            high: {
              url: thumbnails[index] || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            }
          }
        }
      }));
      
      if (items.length === 0) {
        // Phương pháp dự phòng nếu không tìm thấy video trong HTML
        console.log('Không tìm thấy video trong HTML, sử dụng phương pháp dự phòng');
        
        // Tạo items giả bằng cách phân tích cú pháp videoId từ URL
        const firstVideoId = extractFirstVideoIdFromHtml(html);
        if (firstVideoId) {
          items.push({
            id: `0-${firstVideoId}`,
            snippet: {
              title: 'Video 1',
              resourceId: {
                videoId: firstVideoId
              },
              thumbnails: {
                default: {
                  url: `https://i.ytimg.com/vi/${firstVideoId}/default.jpg`
                },
                medium: {
                  url: `https://i.ytimg.com/vi/${firstVideoId}/mqdefault.jpg`
                },
                high: {
                  url: `https://i.ytimg.com/vi/${firstVideoId}/hqdefault.jpg`
                }
              }
            }
          });
        }
      }
      
      return NextResponse.json({ items });
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu playlist:', error);
      
      return NextResponse.json(
        { error: 'Không thể lấy thông tin playlist: ' + error.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Lỗi khi xử lý request:', error);
    
    return NextResponse.json(
      { error: 'Lỗi server: ' + error.message },
      { status: 500 }
    );
  }
}

/**
 * Hàm trích xuất ID video từ HTML của trang playlist YouTube
 * @param {string} html - HTML của trang playlist
 * @returns {Array} Mảng các ID video
 */
function extractVideoIdsFromHtml(html) {
  const videoIds = [];
  
  // Phương pháp 1: Tìm trong JSON data
  try {
    const initialDataRegex = /var\s+ytInitialData\s*=\s*({.+?});\s*<\/script>/;
    const match = html.match(initialDataRegex);
    if (match && match[1]) {
      const jsonData = JSON.parse(match[1]);
      
      // Tìm trong cấu trúc JSON
      const contents = jsonData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
                      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]
                      ?.playlistVideoListRenderer?.contents;
      
      if (contents && Array.isArray(contents)) {
        contents.forEach(item => {
          const videoId = item?.playlistVideoRenderer?.videoId;
          if (videoId) {
            videoIds.push(videoId);
          }
        });
        
        if (videoIds.length > 0) {
          return videoIds;
        }
      }
    }
  } catch (e) {
    console.log('Lỗi khi trích xuất ID từ JSON:', e);
  }
  
  // Phương pháp 2: Tìm URL pattern
  const regex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const videoId = match[1];
    if (!videoIds.includes(videoId)) {
      videoIds.push(videoId);
    }
  }
  
  // Phương pháp 3: Tìm trong chuỗi JSON
  const jsonRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
  while ((match = jsonRegex.exec(html)) !== null) {
    const videoId = match[1];
    if (!videoIds.includes(videoId)) {
      videoIds.push(videoId);
    }
  }
  
  return videoIds;
}

/**
 * Lấy videoId đầu tiên từ HTML khi các phương pháp khác thất bại
 */
function extractFirstVideoIdFromHtml(html) {
  // Tìm videoId trong URL
  const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
  if (match && match[1]) {
    return match[1];
  }
  
  // Tìm trong chuỗi JSON
  const jsonMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
  if (jsonMatch && jsonMatch[1]) {
    return jsonMatch[1];
  }
  
  return null;
}

/**
 * Hàm trích xuất tiêu đề video từ HTML của trang playlist YouTube
 * @param {string} html - HTML của trang playlist
 * @returns {Array} Mảng các tiêu đề video
 */
function extractVideoTitlesFromHtml(html) {
  const titles = [];
  
  // Phương pháp 1: Tìm trong JSON data
  try {
    const initialDataRegex = /var\s+ytInitialData\s*=\s*({.+?});\s*<\/script>/;
    const match = html.match(initialDataRegex);
    if (match && match[1]) {
      const jsonData = JSON.parse(match[1]);
      
      // Tìm trong cấu trúc JSON
      const contents = jsonData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
                      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]
                      ?.playlistVideoListRenderer?.contents;
      
      if (contents && Array.isArray(contents)) {
        contents.forEach(item => {
          const title = item?.playlistVideoRenderer?.title?.runs?.[0]?.text;
          if (title) {
            titles.push(title);
          }
        });
        
        if (titles.length > 0) {
          return titles;
        }
      }
    }
  } catch (e) {
    console.log('Lỗi khi trích xuất tiêu đề từ JSON:', e);
  }
  
  // Phương pháp 2: Regex tìm tiêu đề
  const regex = /"title":\s*{\s*"runs":\s*\[\s*{\s*"text":\s*"([^"]+)"/g;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    // Decode HTML entities
    const title = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    
    titles.push(title);
  }
  
  // Phương pháp 3: Tìm kiếm tiêu đề bằng cách khác
  if (titles.length === 0) {
    const altRegex = /videoTitle":"([^"]+)"/g;
    while ((match = altRegex.exec(html)) !== null) {
      const title = match[1]
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
      
      titles.push(title);
    }
  }
  
  return titles;
}

/**
 * Hàm trích xuất hình thu nhỏ từ HTML của trang playlist YouTube
 * @param {string} html - HTML của trang playlist
 * @returns {Array} Mảng các URL hình thu nhỏ
 */
function extractThumbnailsFromHtml(html) {
  const thumbnails = [];
  
  // Phương pháp 1: Tìm trong JSON data
  try {
    const initialDataRegex = /var\s+ytInitialData\s*=\s*({.+?});\s*<\/script>/;
    const match = html.match(initialDataRegex);
    if (match && match[1]) {
      const jsonData = JSON.parse(match[1]);
      
      // Tìm trong cấu trúc JSON
      const contents = jsonData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
                      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents?.[0]
                      ?.playlistVideoListRenderer?.contents;
      
      if (contents && Array.isArray(contents)) {
        contents.forEach(item => {
          const thumb = item?.playlistVideoRenderer?.thumbnail?.thumbnails?.[0]?.url;
          if (thumb) {
            thumbnails.push(thumb);
          }
        });
        
        if (thumbnails.length > 0) {
          return thumbnails;
        }
      }
    }
  } catch (e) {
    console.log('Lỗi khi trích xuất hình thu nhỏ từ JSON:', e);
  }
  
  // Phương pháp 2: Regex tìm URL hình thu nhỏ
  const regex = /"thumbnail":\s*{\s*"thumbnails":\s*\[\s*{\s*"url":\s*"([^"]+)"/g;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    thumbnails.push(match[1]);
  }
  
  return thumbnails;
} 