// Hàm trích xuất YouTube video ID từ URL
export const extractYoutubeId = (url) => {
  if (!url) return null;
  
  // Hỗ trợ nhiều định dạng URL YouTube
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  
  return (match && match[2].length === 11) ? match[2] : null;
};

// Hàm kiểm tra xem URL có phải là YouTube link không
export const isYoutubeLink = (url) => {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
};

// Hàm kiểm tra xem URL có phải là PDF không
export const isPdfLink = (url) => {
  if (!url) return false;
  return url.toLowerCase().endsWith('.pdf');
};

// Hàm kiểm tra xem URL có phải là Google Drive link không
export const isGoogleDriveLink = (url) => {
  if (!url) return false;
  return url.includes('drive.google.com') || url.includes('docs.google.com');
};

// Hàm kiểm tra xem URL có phải là Google Drive PDF không
export const isGoogleDrivePdf = (url) => {
  if (!url) return false;
  return (url.includes('drive.google.com') || url.includes('docs.google.com')) && 
         (url.toLowerCase().endsWith('.pdf') || url.includes('pdf'));
}; 