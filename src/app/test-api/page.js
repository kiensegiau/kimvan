'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TestAPI() {
  // State cho API đơn giản
  const [id, setId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State cho API chuyển hướng
  const [redirectId, setRedirectId] = useState('');
  const [type, setType] = useState('');
  const [course, setCourse] = useState('');

  // Hàm gọi API đơn giản
  const fetchData = async () => {
    if (!id) {
      setError('Vui lòng nhập ID');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/spreadsheets/${id}`);
      if (!response.ok) {
        throw new Error(`Lỗi API: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  // Hàm gọi API redirect
  const redirectToURL = () => {
    if (!redirectId || !type || !course) {
      setError('Vui lòng nhập đầy đủ thông tin ID, Type và Course');
      return;
    }
    
    // Mở URL trong tab mới
    const encodedCourse = encodeURIComponent(course);
    window.open(`/api/spreadsheets/${redirectId}/${type}/${encodedCourse}/redirect`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">
            API Testing Tool
          </h1>
          <Link href="/" className="text-blue-500 hover:underline">
            ← Trở về trang chủ
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Test API đơn giản */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-blue-700">Test API Dữ liệu JSON</h2>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">ID Spreadsheet:</label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập ID (ví dụ: HYEhMjJ8eMyeH0kfby7XhNXJnl_X2n24f6KOe_JvaEVfFWsQc-rZttHoGLDKh6UMFNI2k4x7tW1vL6YQFwp-wZwnOPpJDvVE)"
              />
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : 'Gọi API'}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
                {error}
              </div>
            )}

            {result && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Kết quả:</h3>
                <div className="bg-gray-100 p-4 rounded overflow-auto max-h-60">
                  <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>

          {/* Test API chuyển hướng */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-blue-700">Test API Chuyển hướng</h2>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">ID:</label>
              <input
                type="text"
                value={redirectId}
                onChange={(e) => setRedirectId(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập ID"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Type:</label>
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập Type (ví dụ: LIVE, TÀI LIỆU, BTVN, TEST)"
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Course:</label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nhập Course (ví dụ: KHOÁ I - LUYỆN THI THPT MÔN VẬT LÝ NĂM 2025)"
              />
            </div>
            <button
              onClick={redirectToURL}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Chuyển hướng
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-blue-700">Hướng dẫn sử dụng</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">1. API Dữ liệu JSON</h3>
              <p className="text-gray-700">Nhập ID để lấy dữ liệu JSON từ API kimvan.</p>
              <p className="text-gray-500 text-sm mt-1">Endpoint: /api/spreadsheets/[id]</p>
            </div>
            <div>
              <h3 className="font-semibold">2. API Chuyển hướng</h3>
              <p className="text-gray-700">Nhập ID, Type và Course để chuyển hướng đến URL đích.</p>
              <p className="text-gray-500 text-sm mt-1">Endpoint: /api/spreadsheets/[id]/[type]/[course]/redirect</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 