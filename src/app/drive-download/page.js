'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';

export default function DriveDownloadPage() {
  const [driveLink, setDriveLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [downloadType, setDownloadType] = useState('direct');
  const downloadLinkRef = useRef(null);

  // API token
  const API_TOKEN = 'drive-download-api';

  // Xử lý submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      if (!driveLink || driveLink.trim() === '') {
        throw new Error('Vui lòng nhập liên kết Google Drive');
      }

      if (downloadType === 'direct') {
        // Gửi yêu cầu tải trực tiếp
        window.open(`/api/drive/download-direct?token=${API_TOKEN}&driveLink=${encodeURIComponent(driveLink)}`);
        setResult({
          message: 'Đã bắt đầu tải xuống. Nếu trình duyệt không tải xuống, hãy thử phương pháp tạo link.'
        });
      } else {
        // Gửi yêu cầu tạo link
        const response = await fetch('/api/drive/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: API_TOKEN,
            driveLink,
            downloadType: 'link'
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Không thể tải xuống file');
        }

        setResult(data);
      }
    } catch (error) {
      console.error('Lỗi:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Tạo URL tải xuống trực tiếp
  const getDirectDownloadUrl = () => {
    return `/api/drive/download?token=${API_TOKEN}&driveLink=${encodeURIComponent(driveLink)}&downloadType=direct`;
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6 text-center">Tải File từ Google Drive</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="driveLink" className="block text-sm font-medium text-gray-700 mb-1">
              Link Google Drive
            </label>
            <input
              type="text"
              id="driveLink"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://drive.google.com/file/d/..."
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Hỗ trợ các định dạng: drive.google.com/file/d/..., docs.google.com/...
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phương thức tải xuống
            </label>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="downloadType"
                  value="direct"
                  checked={downloadType === 'direct'}
                  onChange={() => setDownloadType('direct')}
                />
                <span className="ml-2">Tải trực tiếp</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="downloadType"
                  value="link"
                  checked={downloadType === 'link'}
                  onChange={() => setDownloadType('link')}
                />
                <span className="ml-2">Tạo link tải xuống</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-300 ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isLoading}
          >
            {isLoading ? 'Đang xử lý...' : 'Tải xuống'}
          </button>
        </form>

        {/* Hiển thị lỗi */}
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
            <p className="font-medium">Lỗi:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Hiển thị kết quả */}
        {result && (
          <div className="mt-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-md">
            <p className="font-medium">Trạng thái:</p>
            <p>{result.message || 'Thành công'}</p>
            
            {result.fileName && (
              <div className="mt-2">
                <p><strong>Tên file:</strong> {result.fileName}</p>
                <p><strong>Kích thước:</strong> {Math.round(result.fileSize / 1024)} KB</p>
              </div>
            )}
            
            {downloadType === 'direct' && (
              <div className="mt-3">
                <a
                  ref={downloadLinkRef}
                  href={getDirectDownloadUrl()}
                  className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-md text-sm transition duration-300"
                  download
                >
                  Tải xuống lại
                </a>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="text-sm text-center text-gray-600">
        <p>Công cụ này cho phép tải xuống file từ Google Drive ngay cả khi gặp các hạn chế thông thường.</p>
        <p className="mt-1">
          <Link href="/" className="text-blue-600 hover:underline">
            Quay lại trang chủ
          </Link>
        </p>
      </div>
    </div>
  );
} 