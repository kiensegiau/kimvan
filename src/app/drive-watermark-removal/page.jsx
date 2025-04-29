'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DriveWatermarkRemovalPage() {
  const [driveLink, setDriveLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);
    
    try {
      const response = await fetch('/api/drive/remove-watermark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: 'api@test-watermark',
          driveLink: driveLink,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi không xác định khi xử lý file');
      }
      
      setResult(data);
    } catch (err) {
      console.error('Lỗi:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xử lý yêu cầu');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Xóa Watermark PDF từ Google Drive</h1>
      
      <div className="mb-8 bg-yellow-50 p-4 border border-yellow-200 rounded-lg">
        <h2 className="text-lg font-semibold mb-2 text-yellow-800">Yêu cầu hệ thống!</h2>
        <p className="mb-2 text-yellow-700">
          Để công cụ hoạt động chính xác, máy chủ cần phải cài đặt:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-yellow-700">
          <li><strong>Ghostscript</strong> - Công cụ xử lý PDF</li>
          <li><strong>Google Drive API</strong> - Đã được cấu hình</li>
        </ul>
        <p className="mt-2 text-yellow-700">
          Nếu gặp lỗi, hãy đảm bảo máy chủ đã cài đặt đầy đủ các phần mềm trên.
        </p>
      </div>
      
      <div className="mb-8 bg-blue-50 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Hướng dẫn:</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Dán link Google Drive đến file PDF cần xóa watermark</li>
          <li>Nhấn nút "Xử lý" và đợi trong vài phút</li>
          <li>Kết quả sẽ hiển thị link Google Drive đến file đã xóa watermark</li>
        </ol>
        <p className="mt-4 text-sm text-gray-600">
          <strong>Lưu ý:</strong> File PDF phải được chia sẻ công khai hoặc tài khoản Google của bạn phải có quyền truy cập.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <label htmlFor="driveLink" className="block mb-2 font-medium">
            Link Google Drive (PDF)
          </label>
          <input
            type="text"
            id="driveLink"
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            placeholder="https://drive.google.com/file/d/..."
            className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        
        <button
          type="submit"
          disabled={isLoading || !driveLink}
          className={`px-6 py-3 rounded-md font-medium text-white ${
            isLoading || !driveLink
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Đang xử lý...' : 'Xử lý'}
        </button>
      </form>
      
      {isLoading && (
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg">
          <h2 className="text-lg font-semibold text-yellow-700 mb-2">Đang xử lý...</h2>
          <p className="text-yellow-600">
            Quá trình xử lý có thể mất vài phút tùy thuộc vào kích thước PDF. Vui lòng không đóng trang này.
          </p>
          <div className="mt-4 w-full h-2 bg-yellow-200 overflow-hidden rounded-full">
            <div className="h-full bg-yellow-500 animate-pulse rounded-full"></div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mb-6 p-4 bg-red-50 rounded-lg border border-red-200">
          <h2 className="text-lg font-semibold text-red-700 mb-2">Lỗi</h2>
          <p className="text-red-600">{error}</p>
          
          {error.includes('Ghostscript') && (
            <div className="mt-4 pt-3 border-t border-red-200">
              <p className="font-medium text-red-700 mb-2">Thông tin bổ sung:</p>
              <p className="text-red-600">
                Lỗi này liên quan đến Ghostscript, một công cụ cần thiết để xử lý PDF.
                Máy chủ cần cài đặt Ghostscript để chức năng này hoạt động. Vui lòng liên hệ
                quản trị viên để cài đặt Ghostscript trên máy chủ.
              </p>
            </div>
          )}
        </div>
      )}
      
      {result && (
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h2 className="text-lg font-semibold text-green-700 mb-2">Xử lý thành công!</h2>
          
          <div className="mt-4 space-y-3">
            <div>
              <p className="font-medium">File gốc:</p>
              <p>{result.originalFilename}</p>
            </div>
            
            <div>
              <p className="font-medium">File đã xử lý:</p>
              <p>{result.processedFilename}</p>
            </div>
            
            <div className="pt-2">
              <p className="font-medium mb-2">Liên kết file đã xử lý:</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={result.viewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-center"
                >
                  Xem trên Drive
                </a>
                {result.downloadLink && (
                  <a
                    href={result.downloadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-center"
                  >
                    Tải xuống
                  </a>
                )}
              </div>
            </div>
            
            {result.processingDetails && (
              <div className="mt-4 pt-3 border-t border-green-200">
                <p className="font-medium mb-2">Chi tiết xử lý:</p>
                <ul className="list-disc pl-5 text-sm text-gray-700">
                  <li>Kích thước gốc: {result.processingDetails.originalSize}</li>
                  <li>Kích thước đã xử lý: {result.processingDetails.processedSize}</li>
                  <li>Thời gian xử lý: {result.processingDetails.processingTime}</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 