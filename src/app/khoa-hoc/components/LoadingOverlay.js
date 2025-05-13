import React from 'react';

const LoadingOverlay = ({ isVisible, message = 'Đang tải tài nguyên...' }) => {
  if (!isVisible) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4 flex flex-col items-center animate-fadeIn">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-4"></div>
          <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
            <div className="h-8 w-8 rounded-full bg-indigo-100"></div>
          </div>
        </div>
        <p className="text-lg text-gray-700 font-medium text-center mb-2">{message}</p>
        <div className="flex space-x-2 mt-2">
          <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
          <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
          <div className="h-2 w-2 bg-indigo-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay; 