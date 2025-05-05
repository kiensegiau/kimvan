// Cấu hình cho trang test YouTube

// ID khóa học mặc định cho việc test
// Lưu ý: Bạn cần thay đổi ID này thành một ID khóa học thực sự từ cơ sở dữ liệu của bạn
export const DEFAULT_COURSE_ID = '65f5e8d1ab3a2c3a8d7c9f12';

// Các thiết lập khác
export const SETTINGS = {
  // Chế độ hiển thị mặc định cho video
  defaultVisibility: 'unlisted',
  
  // Số lượng video hiển thị trong danh sách
  maxVideoListItems: 20,
  
  // Định dạng file video được phép
  allowedVideoFormats: [
    'video/mp4',
    'video/avi',
    'video/mkv',
    'video/quicktime',
    'video/x-matroska',
    'video/x-msvideo'
  ]
}; 