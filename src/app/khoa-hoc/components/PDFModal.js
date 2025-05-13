import React, { useEffect, useState } from 'react';

const PDFModal = ({ isOpen, onClose, fileUrl, title = '', isUpdating = false }) => {
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
    } else {
      setLoading(false);
    }
  }, [fileUrl]);

  if (!isOpen) return null;

  // Xác định loại file và cách hiển thị
  const isGoogleDriveFile = fileUrl && (
    fileUrl.includes('drive.google.com') || 
    fileUrl.includes('docs.google.com')
  );
  
  const isPDF = fileUrl && fileUrl.toLowerCase().endsWith('.pdf');

  // Hiển thị thông báo khi tài liệu đang được cập nhật
  if (isUpdating) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-5xl w-full max-h-[85vh] relative">
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
          
          <div className="p-12 flex flex-col items-center justify-center">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-8 max-w-lg w-full mb-6">
              <div className="flex justify-center mb-6">
                <div className="rounded-full bg-amber-100 p-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-lg font-medium text-amber-800 text-center mb-2">Tài liệu đang được cập nhật</h3>
              <p className="text-amber-700 text-center mb-4">
                Tài liệu này đang trong quá trình cập nhật để cải thiện chất lượng. Vui lòng thử lại sau.
              </p>
              <div className="flex justify-center">
                <div className="animate-pulse flex space-x-2">
                  <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
                  <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
                  <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between">
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
  }

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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-blue-800 mb-2">Khóa học đang được cập nhật</h3>
                <p className="text-gray-600 mb-4">Tài liệu này đang được cập nhật hoặc đã xảy ra sự cố. Vui lòng báo cáo cho quản trị viên.</p>
                <div className="mt-2 flex justify-center">
                  <div className="animate-pulse flex space-x-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between">
          {fileUrl && (
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
          )}
          
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