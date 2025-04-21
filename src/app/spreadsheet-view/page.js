'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function SpreadsheetView() {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSpreadsheetData = async () => {
    if (!spreadsheetId) {
      setError('Vui lòng nhập ID Spreadsheet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/spreadsheets/${spreadsheetId}`);
      if (!response.ok) {
        throw new Error(`Lỗi API: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Hàm xử lý kiểu dữ liệu và định dạng
  const renderCellValue = (cell) => {
    if (!cell) return null;
    
    // Nếu có hyperlink
    if (cell.hyperlink && cell.formattedValue) {
      let linkUrl = '';
      
      // Lấy URL từ hyperlink hoặc từ định dạng liên kết
      if (cell.userEnteredFormat?.textFormat?.link?.uri) {
        linkUrl = cell.userEnteredFormat.textFormat.link.uri;
      } else {
        linkUrl = `/api/spreadsheets/${cell.hyperlink}/redirect`;
      }
      
      return (
        <a 
          href={linkUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {cell.formattedValue}
        </a>
      );
    }
    
    // Nếu chỉ có formattedValue
    if (cell.formattedValue) {
      // Lấy màu chữ nếu có
      let textColor = 'text-black';
      if (cell.userEnteredFormat?.textFormat?.foregroundColor) {
        const color = cell.userEnteredFormat.textFormat.foregroundColor;
        if (color.red === 1 && !color.green && !color.blue) textColor = 'text-red-600';
        else if (!color.red && !color.green && color.blue === 1) textColor = 'text-blue-600';
      }
      
      // Lấy độ đậm
      const fontWeight = cell.userEnteredFormat?.textFormat?.bold ? 'font-bold' : 'font-normal';
      
      return (
        <span className={`${textColor} ${fontWeight}`}>
          {cell.formattedValue}
        </span>
      );
    }
    
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">
            Google Spreadsheet Viewer
          </h1>
          <Link href="/" className="text-blue-500 hover:underline">
            ← Trở về trang chủ
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <input
              type="text"
              value={spreadsheetId}
              onChange={(e) => setSpreadsheetId(e.target.value)}
              className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nhập ID Spreadsheet"
            />
            <button
              onClick={fetchSpreadsheetData}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Đang tải...' : 'Xem dữ liệu'}
            </button>
          </div>
          
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          )}
        </div>

        {data && (
          <div className="bg-white rounded-lg shadow-md overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead>
                {data.sheets && data.sheets[0]?.data && data.sheets[0].data[0]?.rowData && (
                  <tr className="bg-blue-50 text-blue-700">
                    {data.sheets[0].data[0].rowData[0]?.values?.map((header, idx) => (
                      <th key={idx} className="py-3 px-4 text-center font-bold border">
                        {renderCellValue(header)}
                      </th>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                {data.sheets && data.sheets[0]?.data && data.sheets[0].data[0]?.rowData && 
                  data.sheets[0].data[0].rowData.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      {row.values?.map((cell, cellIdx) => (
                        <td key={cellIdx} className="py-2 px-4 border text-center">
                          {renderCellValue(cell)}
                        </td>
                      ))}
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        )}
        
        {data && (
          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">Dữ liệu gốc:</h2>
            <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
              <pre className="text-sm whitespace-pre-wrap">
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 