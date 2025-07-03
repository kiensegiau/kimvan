import React, { useEffect } from 'react';

const PDFModal = ({ isOpen, onClose, fileUrl, title = '', isUpdating = false }) => {
  // Mở PDF trong tab mới khi modal được mở
  useEffect(() => {
    if (isOpen && fileUrl && !isUpdating) {
      // Mở PDF trong tab mới
      window.open(fileUrl, '_blank');
      // Đóng modal ngay lập tức
      onClose();
    }
  }, [isOpen, fileUrl, onClose, isUpdating]);

  // Nếu đang cập nhật, hiển thị thông báo
  if (!isOpen || !isUpdating) return null;

  // Chỉ hiển thị modal khi tài liệu đang được cập nhật
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
};

export default PDFModal; 