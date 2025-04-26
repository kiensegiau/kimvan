'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

/**
 * Modal hiển thị file PDF
 * @param {Object} props - Properties
 * @param {boolean} props.isOpen - Trạng thái hiển thị của modal
 * @param {string} props.fileUrl - URL của file PDF cần hiển thị
 * @param {string} props.title - Tiêu đề hiển thị trong modal
 * @param {Function} props.onClose - Hàm gọi khi đóng modal
 * @returns {JSX.Element|null}
 */
export default function PDFModal({ isOpen, fileUrl, title, onClose }) {
  if (!isOpen || !fileUrl) return null;
  
  const [pdfUrl, setPdfUrl] = useState('');
  const [isGDrive, setIsGDrive] = useState(false);
  
  // Kiểm tra xem URL có phải là Google Drive không
  const isGoogleDriveLink = (url) => {
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  };
  
  // Trích xuất ID từ Google Drive URL
  const extractGoogleDriveId = (url) => {
    // URL dạng https://drive.google.com/file/d/{fileId}/view
    const fileIdMatch = url.match(/\/file\/d\/([^\/]+)/);
    if (fileIdMatch) return fileIdMatch[1];
    
    // URL dạng https://drive.google.com/open?id={fileId}
    const openIdMatch = url.match(/[?&]id=([^&]+)/);
    if (openIdMatch) return openIdMatch[1];
    
    return null;
  };
  
  // Xử lý URL PDF khi component được mount
  useEffect(() => {
    if (isOpen && fileUrl) {
      try {
        // Kiểm tra Google Drive link
        if (isGoogleDriveLink(fileUrl)) {
          setIsGDrive(true);
          const driveId = extractGoogleDriveId(fileUrl);
          if (driveId) {
            // Sử dụng Google Drive viewer cho file Google Drive
            setPdfUrl(`https://drive.google.com/file/d/${driveId}/preview`);
          } else {
            setPdfUrl(fileUrl);
          }
        } 
        // Nếu là URL khác
        else {
          setIsGDrive(false);
          // Đảm bảo URL đã được mã hóa đúng cách
          const encodedUrl = encodeURIComponent(fileUrl);
          // Sử dụng Google PDF Viewer hoặc PDF.js nếu URL không bắt đầu bằng http(s)
          if (!fileUrl.startsWith('http')) {
            setPdfUrl(`https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`);
          } else {
            setPdfUrl(`${fileUrl}#toolbar=0&navpanes=0`);
          }
        }
      } catch (error) {
        console.error('Lỗi khi xử lý URL PDF:', error);
        setPdfUrl(fileUrl);
      }
    }
  }, [isOpen, fileUrl]);

  // Ngăn chặn sự kiện click tiếp tục truyền xuống
  const handleOverlayClick = (e) => {
    e.stopPropagation();
  };

  // Chuẩn bị URL cho chức năng tải xuống
  const getDownloadUrl = () => {
    if (isGoogleDriveLink(fileUrl)) {
      const driveId = extractGoogleDriveId(fileUrl);
      if (driveId) {
        return `https://drive.google.com/uc?export=download&id=${driveId}`;
      }
    }
    return fileUrl;
  };
  
  // Lấy URL để mở Google Drive trong tab mới
  const getGoogleViewerUrl = () => {
    if (isGoogleDriveLink(fileUrl)) {
      const driveId = extractGoogleDriveId(fileUrl);
      if (driveId) {
        return `https://drive.google.com/file/d/${driveId}/view`;
      }
    }
    return fileUrl;
  };

  return (
    <div 
      className="fixed inset-0 bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 truncate">
            {title || 'Tài liệu PDF'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="w-full relative" style={{ height: 'calc(80vh - 120px)' }}>
          {pdfUrl && (
            <iframe
              src={pdfUrl}
              className="w-full h-full"
              title={title || "PDF Viewer"}
              sandbox="allow-scripts allow-same-origin allow-forms"
              loading="lazy"
            />
          )}
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <div className="flex space-x-2">
            <a
              href={getDownloadUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Tải xuống
            </a>
            
            {isGDrive && (
              <a
                href={getGoogleViewerUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Mở trong Drive
              </a>
            )}
          </div>
          
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
} 