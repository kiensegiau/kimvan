'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, PencilIcon, TrashIcon, ArrowPathIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function SheetDetailPage({ params }) {
  const router = useRouter();
  const { id } = params;
  
  const [sheet, setSheet] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    fetchSheetDetail();
  }, [id]);

  const fetchSheetDetail = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/sheets/${id}`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      setSheet(result.sheet);
      setEditForm({
        name: result.sheet.name,
        description: result.sheet.description || '',
      });
    } catch (error) {
      console.error('Lỗi khi lấy chi tiết sheet:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSheetData = async () => {
    if (!sheet) return;
    
    setLoadingData(true);
    try {
      const response = await fetch(`/api/sheets/${id}?fetchData=true`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      setSheetData(result.sheet.data);
    } catch (error) {
      console.error('Lỗi khi lấy dữ liệu sheet:', error);
      setError(error.message);
    } finally {
      setLoadingData(false);
    }
  };

  const handleUpdateSheet = async () => {
    try {
      const response = await fetch(`/api/sheets/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể cập nhật sheet');
      }

      const result = await response.json();
      setSheet(result.sheet);
      setShowEditModal(false);
      alert('Đã cập nhật sheet thành công!');
    } catch (error) {
      console.error('Lỗi khi cập nhật sheet:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  const handleDeleteSheet = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa sheet này?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sheets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể xóa sheet');
      }

      alert('Đã xóa sheet thành công!');
      router.push('/admin/sheets');
    } catch (error) {
      console.error('Lỗi khi xóa sheet:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  const handleOpenGoogleSheet = () => {
    if (!sheet || !sheet.sheetUrl) return;
    window.open(sheet.sheetUrl, '_blank');
  };

  const handleExportData = () => {
    if (!sheetData) return;
    
    try {
      // Tạo file JSON để tải xuống
      const blob = new Blob([JSON.stringify(sheetData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Tạo thẻ a và kích hoạt sự kiện click để tải xuống
      const a = document.createElement('a');
      a.href = url;
      a.download = `sheet-data-${sheet.name.replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Dọn dẹp
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Lỗi khi xuất dữ liệu:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  // Hàm xử lý nội dung cell để phát hiện và chuyển đổi URL thành liên kết
  const renderCellContent = (content) => {
    if (!content) return '';
    
    // Kiểm tra công thức HYPERLINK từ Google Sheets
    const hyperlinkRegex = /=HYPERLINK\("([^"]+)"(?:,\s*"([^"]+)")?\)/i;
    const hyperlinkMatch = typeof content === 'string' ? content.match(hyperlinkRegex) : null;
    
    if (hyperlinkMatch) {
      let url = hyperlinkMatch[1];
      const displayText = hyperlinkMatch[2] || url;
      
      // Kiểm tra loại link để hiển thị icon phù hợp
      let icon = null;
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
      } else if (url.includes('drive.google.com')) {
        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
      } else if (url.includes('docs.google.com/document')) {
        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
      }
      
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline"
        >
          {icon}{displayText}
        </a>
      );
    }
    
    // Kiểm tra xem nội dung có phải là URL không
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Nếu nội dung chỉ chứa URL
    if (typeof content === 'string' && urlRegex.test(content) && content.trim().match(urlRegex)[0] === content.trim()) {
      // Xác định loại URL để hiển thị icon phù hợp
      let icon = null;
      if (content.includes('youtube.com') || content.includes('youtu.be')) {
        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
      } else if (content.includes('drive.google.com')) {
        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
      } else if (content.includes('docs.google.com/document')) {
        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
      }
      
      return (
        <a 
          href={content} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-blue-600 hover:underline"
        >
          {icon}{content}
        </a>
      );
    }
    
    return content;
  };

  const renderTable = () => {
    if (!sheetData || !sheetData.values || sheetData.values.length === 0) {
      return (
        <div className="bg-gray-100 p-6 rounded-lg text-center">
          <p className="text-gray-600">Không có dữ liệu để hiển thị.</p>
        </div>
      );
    }

    return (
      <div className="overflow-x-auto bg-white shadow-md rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {sheetData.values[0].map((header, index) => (
                <th 
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sheetData.values.slice(1).map((row, rowIndex) => {
              // Lấy dữ liệu HTML tương ứng nếu có
              const htmlRow = sheetData.htmlData?.[rowIndex + 1]?.values || [];
              
              return (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    // Kiểm tra xem có dữ liệu HTML không
                    const htmlCell = htmlRow[cellIndex];
                    const hyperlink = htmlCell?.hyperlink;
                    
                    // Nếu có hyperlink trong dữ liệu HTML
                    if (hyperlink) {
                      // Xác định loại liên kết để hiển thị icon phù hợp
                      let icon = null;
                      if (hyperlink.includes('youtube.com') || hyperlink.includes('youtu.be')) {
                        icon = <span className="text-red-500 mr-1" title="YouTube Video">🎬</span>;
                      } else if (hyperlink.includes('drive.google.com')) {
                        icon = <span className="text-blue-500 mr-1" title="Google Drive">📄</span>;
                      } else if (hyperlink.includes('docs.google.com/document')) {
                        icon = <span className="text-green-500 mr-1" title="Google Docs">📝</span>;
                      }
                      
                      return (
                        <td key={cellIndex} className="px-6 py-4 whitespace-nowrap">
                          <a 
                            href={hyperlink} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:underline"
                          >
                            {icon}{cell}
                          </a>
                        </td>
                      );
                    }
                    
                    return (
                      <td key={cellIndex} className="px-6 py-4 whitespace-nowrap">
                        {renderCellContent(cell)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4">
      <div className="flex items-center mb-6">
        <Link href="/admin/sheets" className="mr-4">
          <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold flex-grow">
          {loading ? 'Đang tải...' : sheet ? sheet.name : 'Chi tiết Sheet'}
        </h1>
        <div className="space-x-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="bg-indigo-600 text-white px-3 py-1 rounded-md"
          >
            <PencilIcon className="h-5 w-5 inline-block" />
          </button>
          <button
            onClick={handleDeleteSheet}
            className="bg-red-600 text-white px-3 py-1 rounded-md"
          >
            <TrashIcon className="h-5 w-5 inline-block" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      ) : (
        <>
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-lg font-semibold mb-2">Thông tin Sheet</h2>
                <p><span className="font-medium">Tên:</span> {sheet.name}</p>
                <p><span className="font-medium">Mô tả:</span> {sheet.description || 'Không có mô tả'}</p>
                <p><span className="font-medium">ID Sheet:</span> {sheet.sheetId}</p>
                <p>
                  <span className="font-medium">Ngày tạo:</span> {new Date(sheet.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-2">Thao tác</h2>
                <div className="space-y-2">
                  <button
                    onClick={handleOpenGoogleSheet}
                    className="bg-green-600 text-white px-4 py-2 rounded-md w-full"
                  >
                    Mở Google Sheet
                  </button>
                  <button
                    onClick={fetchSheetData}
                    disabled={loadingData}
                    className={`bg-blue-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center ${
                      loadingData ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {loadingData ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        Đang tải dữ liệu...
                      </>
                    ) : (
                      <>
                        <ArrowPathIcon className="h-5 w-5 mr-2" />
                        Tải dữ liệu Sheet
                      </>
                    )}
                  </button>
                  {sheetData && (
                    <button
                      onClick={handleExportData}
                      className="bg-purple-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center"
                    >
                      <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                      Xuất dữ liệu (JSON)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {sheetData ? (
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Dữ liệu Sheet</h2>
              {renderTable()}
            </div>
          ) : (
            <div className="bg-gray-100 p-6 rounded-lg text-center">
              <p className="text-gray-600">
                Nhấn "Tải dữ liệu Sheet" để xem nội dung của Google Sheet này.
              </p>
            </div>
          )}
        </>
      )}

      {/* Modal chỉnh sửa sheet */}
      {showEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Chỉnh sửa Sheet</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên Sheet</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập tên sheet"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả (tùy chọn)</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập mô tả cho sheet"
                    rows="3"
                  ></textarea>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateSheet}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}