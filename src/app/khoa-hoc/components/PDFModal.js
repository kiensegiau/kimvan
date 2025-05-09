import React, { useEffect, useState } from 'react';

const PDFModal = ({ isOpen, onClose, fileUrl, title = '' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Xử lý khi nhấn phím Escape để đóng modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      // Vô hiệu hóa cuộn trang khi modal mở
      document.body.style.overflow = 'hidden';
    }

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscKey);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // Reset loading và error khi fileUrl thay đổi
  useEffect(() => {
    if (fileUrl) {
      setLoading(true);
      setError(null);
    }
  }, [fileUrl]);

  if (!isOpen) return null;

  // Xác định loại file và cách hiển thị
  const isGoogleDriveFile = fileUrl && (
    fileUrl.includes('drive.google.com') || 
    fileUrl.includes('docs.google.com')
  );
  
  const isPDF = fileUrl && fileUrl.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-5xl w-full h-[85vh] relative">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 truncate pr-8">
            {title || 'Xem tài liệu'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="relative w-full h-[calc(100%-120px)] bg-gray-100">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            </div>
          )}
          
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-red-50 p-4 rounded-lg max-w-md text-center">
                <div className="flex justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-red-800 mb-2">Không thể tải tài liệu</h3>
                <p className="text-sm text-red-700">{error}</p>
                <div className="mt-4">
                  <a 
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(fileUrl, '_blank');
                    }}
                    href="#"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Mở trong tab mới
                  </a>
                </div>
              </div>
            </div>
          )}
          
          {isGoogleDriveFile ? (
            <iframe
              src={fileUrl}
              className="w-full h-full"
              frameBorder="0"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Không thể tải tài liệu từ Google Drive. Vui lòng thử lại sau hoặc mở trong tab mới.');
              }}
              title={title || "Google Drive Document"}
              allowFullScreen
            ></iframe>
          ) : isPDF ? (
            <iframe
              src={fileUrl}
              className="w-full h-full"
              frameBorder="0"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError('Không thể tải tài liệu PDF. Vui lòng thử lại sau hoặc mở trong tab mới.');
              }}
              title={title || "PDF Document"}
              allowFullScreen
            ></iframe>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-blue-50 p-6 rounded-lg max-w-md text-center">
                <div className="flex justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-blue-800 mb-2">Không thể xem trước tài liệu này</h3>
                <p className="text-gray-600 mb-4">Loại tài liệu này không hỗ trợ xem trước trong ứng dụng.</p>
                <a 
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(fileUrl, '_blank');
                  }}
                  href="#"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Mở trong tab mới
                </a>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          <a 
            onClick={(e) => {
              e.preventDefault();
              window.open(fileUrl, '_blank');
            }}
            href="#"
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Mở trong tab mới
          </a>
          
          <button
            onClick={onClose}
            className="inline-flex justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFModal; 