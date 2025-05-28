import { NextResponse } from 'next/server';

// Danh sách các API công khai có thể sử dụng
const PUBLIC_APIS = [
  'https://invidious.snopyta.org/api/v1/playlists/',
  'https://vid.puffyan.us/api/v1/playlists/',
  'https://invidious.namazso.eu/api/v1/playlists/',
  'https://invidious.kavin.rocks/api/v1/playlists/',
  'https://inv.riverside.rocks/api/v1/playlists/',
  'https://y.com.sb/api/v1/playlists/',
  'https://invidio.xamh.de/api/v1/playlists/'
];

// API không chính thức khác cũng có thể sử dụng
const ALTERNATIVE_APIS = [
  'https://pipedapi.kavin.rocks/playlists/',
  'https://ytapi.grtn.org/playlists/'
];

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
      // Thử tất cả các API công khai
      let data = null;
      let error = null;
      
      // Thử với API Invidious
      for (const apiUrl of PUBLIC_APIS) {
        try {
          const response = await fetch(`${apiUrl}${playlistId}`);
          
          if (response.ok) {
            data = await response.json();
            
            // Chuyển đổi dữ liệu sang định dạng tương tự như YouTube API
            const formattedData = {
              items: data.videos.map((video, index) => ({
                id: `${index}-${video.videoId}`,
                snippet: {
                  title: video.title,
                  resourceId: {
                    videoId: video.videoId
                  },
                  thumbnails: {
                    default: {
                      url: video.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${video.videoId}/default.jpg`
                    },
                    medium: {
                      url: video.videoThumbnails?.[4]?.url || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`
                    },
                    high: {
                      url: video.videoThumbnails?.[2]?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
                    }
                  }
                }
              }))
            };
            
            return NextResponse.json(formattedData);
          }
        } catch (apiError) {
          error = apiError;
          console.error(`Lỗi khi gọi API ${apiUrl}:`, apiError);
          // Tiếp tục thử API tiếp theo
        }
      }
      
      // Thử với API thay thế
      for (const altApiUrl of ALTERNATIVE_APIS) {
        try {
          const response = await fetch(`${altApiUrl}${playlistId}`);
          
          if (response.ok) {
            const altData = await response.json();
            
            // Chuyển đổi từ định dạng Piped
            if (altData.relatedStreams || altData.videos) {
              const videos = altData.relatedStreams || altData.videos;
              
              const formattedData = {
                items: videos.map((video, index) => ({
                  id: `${index}-${video.id || video.videoId}`,
                  snippet: {
                    title: video.title,
                    resourceId: {
                      videoId: video.id || video.videoId
                    },
                    thumbnails: {
                      default: {
                        url: video.thumbnail || `https://i.ytimg.com/vi/${video.id || video.videoId}/default.jpg`
                      },
                      medium: {
                        url: video.thumbnail || `https://i.ytimg.com/vi/${video.id || video.videoId}/mqdefault.jpg`
                      },
                      high: {
                        url: video.thumbnail || `https://i.ytimg.com/vi/${video.id || video.videoId}/hqdefault.jpg`
                      }
                    }
                  }
                }))
              };
              
              return NextResponse.json(formattedData);
            }
          }
        } catch (altApiError) {
          console.error(`Lỗi khi gọi API thay thế ${altApiUrl}:`, altApiError);
          // Tiếp tục thử API tiếp theo
        }
      }
      
      // Thử với phương pháp scraping nếu tất cả API đều thất bại
      // Tạo URL của playlist YouTube
      const playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
      
      // Lấy HTML của trang playlist
      const response = await fetch(playlistUrl);
      const html = await response.text();
      
      // Trích xuất dữ liệu video từ HTML
      const videoIds = extractVideoIdsFromHtml(html);
      const videoTitles = extractVideoTitlesFromHtml(html);
      
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
              url: `https://i.ytimg.com/vi/${videoId}/default.jpg`
            },
            medium: {
              url: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
            },
            high: {
              url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
            }
          }
        }
      }));
      
      if (items.length > 0) {
        return NextResponse.json({ items });
      }
      
      throw new Error('Không thể lấy thông tin playlist từ bất kỳ nguồn nào');
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
  const regex = /\/watch\?v=([a-zA-Z0-9_-]{11})/g;
  let match;
  
  while ((match = regex.exec(html)) !== null) {
    const videoId = match[1];
    if (!videoIds.includes(videoId)) {
      videoIds.push(videoId);
    }
  }
  
  // Phương pháp dự phòng: tìm videoId trong chuỗi JSON
  if (videoIds.length === 0) {
    const jsonRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
    while ((match = jsonRegex.exec(html)) !== null) {
      const videoId = match[1];
      if (!videoIds.includes(videoId)) {
        videoIds.push(videoId);
      }
    }
  }
  
  return videoIds;
}

/**
 * Hàm trích xuất tiêu đề video từ HTML của trang playlist YouTube
 * @param {string} html - HTML của trang playlist
 * @returns {Array} Mảng các tiêu đề video
 */
function extractVideoTitlesFromHtml(html) {
  const titles = [];
  
  // Cải thiện regex để tìm tiêu đề chính xác hơn
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
  
  // Phương pháp dự phòng: tìm kiếm tiêu đề bằng cách khác nếu không tìm thấy
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