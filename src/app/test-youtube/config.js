/**
 * Cấu hình cho trang test YouTube
 */

// ID khóa học mặc định cho việc tải video
// Gán 'auto' để tự động tạo khóa học mới nếu cần
export const DEFAULT_COURSE_ID = "auto";

// Các cài đặt khác
export const SETTINGS = {
  // Quyền xem video mặc định (public, private, unlisted)
  defaultVisibility: "unlisted",
  
  // Thư mục lưu hồ sơ Chrome
  chromeProfilePath: process.env.USERPROFILE || process.env.HOME 
    ? `${process.env.USERPROFILE || process.env.HOME}/youtube-upload-profile`
    : "C:/Users/Admin/youtube-upload-profile",
  
  // Kích thước tối đa của video (MB)
  maxVideoSize: 1024,
  
  // Các định dạng video được hỗ trợ
  supportedFormats: ["mp4", "mov", "avi", "mkv", "webm"]
}; 