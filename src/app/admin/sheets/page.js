'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, TrashIcon, PencilIcon, ArrowPathIcon, DocumentArrowDownIcon, LinkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function SheetsAdminPage() {
  const router = useRouter();
  const [sheets, setSheets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSheet, setNewSheet] = useState({
    name: '',
    description: '',
    sheetUrl: '',
  });
  const [addingSheet, setAddingSheet] = useState(false);
  const [processingPDFs, setProcessingPDFs] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({
    current: 0,
    total: 0,
    currentSheet: '',
    results: []
  });
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  
  // State cho chức năng liên kết sheet vào khóa học
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [linkingSheets, setLinkingSheets] = useState(false);
  const [linkingResults, setLinkingResults] = useState(null);

  useEffect(() => {
    fetchSheets();
  }, []);

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sheets');
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setSheets(data.sheets || []);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách sheets:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Hàm lấy danh sách khóa học
  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      const response = await fetch('/api/admin/courses');
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      
      // Xử lý dữ liệu trả về có thể là mảng hoặc object với thuộc tính courses
      const coursesList = Array.isArray(data) ? data : (data.courses || []);
      setCourses(coursesList);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách khóa học:', error);
      alert('Không thể tải danh sách khóa học. Vui lòng thử lại sau.');
    } finally {
      setLoadingCourses(false);
    }
  };

  // Hàm xử lý khi chọn/bỏ chọn một sheet
  const handleSelectSheet = (sheetId) => {
    setSelectedSheets(prevSelected => {
      if (prevSelected.includes(sheetId)) {
        return prevSelected.filter(id => id !== sheetId);
      } else {
        return [...prevSelected, sheetId];
      }
    });
  };

  // Hàm xử lý khi chọn/bỏ chọn tất cả sheet
  const handleSelectAllSheets = (e) => {
    if (e.target.checked) {
      setSelectedSheets(sheets.map(sheet => sheet._id));
    } else {
      setSelectedSheets([]);
    }
  };

  // Hàm mở modal liên kết và tải danh sách khóa học
  const handleOpenLinkModal = () => {
    if (selectedSheets.length === 0) {
      alert('Vui lòng chọn ít nhất một sheet để liên kết');
      return;
    }
    
    setShowLinkModal(true);
    fetchCourses();
    setSelectedCourse('');
    setLinkingResults(null);
  };

  // Hàm xử lý liên kết các sheet đã chọn vào khóa học
  const handleLinkSheetsToCourse = async () => {
    if (!selectedCourse) {
      alert('Vui lòng chọn một khóa học để liên kết');
      return;
    }

    setLinkingSheets(true);
    setLinkingResults({
      success: true,
      inProgress: true,
      message: 'Đang liên kết sheets vào khóa học...',
      results: []
    });

    try {
      const results = [];
      
      // Xử lý tuần tự từng sheet
      for (const sheetId of selectedSheets) {
        try {
          const sheet = sheets.find(s => s._id === sheetId);
          
          // Gọi API để liên kết sheet với khóa học
          const response = await fetch(`/api/courses/${selectedCourse}/sheets`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sheetId: sheetId
            }),
          });

          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || `Không thể liên kết sheet ${sheet?.name || sheetId}`);
          }
          
          results.push({
            sheetId,
            sheetName: sheet?.name || 'Unknown',
            success: true,
            message: 'Liên kết thành công'
          });
        } catch (error) {
          console.error(`Lỗi khi liên kết sheet ${sheetId}:`, error);
          
          const sheet = sheets.find(s => s._id === sheetId);
          results.push({
            sheetId,
            sheetName: sheet?.name || 'Unknown',
            success: false,
            message: error.message
          });
        }
      }
      
      // Cập nhật kết quả
      const successCount = results.filter(r => r.success).length;
      setLinkingResults({
        success: successCount > 0,
        inProgress: false,
        message: `Đã liên kết ${successCount}/${selectedSheets.length} sheets vào khóa học`,
        results
      });
      
      // Nếu tất cả thành công, xóa danh sách đã chọn
      if (successCount === selectedSheets.length) {
        setTimeout(() => {
          setSelectedSheets([]);
        }, 2000);
      }
    } catch (error) {
      console.error('Lỗi khi liên kết sheets:', error);
      setLinkingResults({
        success: false,
        inProgress: false,
        message: `Lỗi: ${error.message}`,
        results: []
      });
    } finally {
      setLinkingSheets(false);
    }
  };

  // Hàm trích xuất ID từ URL Google Sheets
  const extractSheetId = (url) => {
    try {
      // Kiểm tra xem URL có hợp lệ không
      if (!url || typeof url !== 'string') return null;
      
      // Kiểm tra xem đã là ID thuần túy chưa (không chứa dấu / hoặc .)
      if (/^[a-zA-Z0-9_-]+$/.test(url) && url.length > 20) {
        return url;
      }
      
      // Trích xuất ID từ URL đầy đủ
      const regex = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
      const match = url.match(regex);
      
      if (match && match[1]) {
        return match[1];
      }
      
      // Kiểm tra định dạng URL rút gọn
      const shortRegex = /\/([a-zA-Z0-9_-]{20,})\//;
      const shortMatch = url.match(shortRegex);
      
      if (shortMatch && shortMatch[1]) {
        return shortMatch[1];
      }
      
      return null;
    } catch (error) {
      console.error('Lỗi khi trích xuất ID sheet:', error);
      return null;
    }
  };

  const handleAddSheet = async () => {
    if (!newSheet.name || !newSheet.sheetUrl) {
      alert('Vui lòng nhập tên và URL của Google Sheet');
      return;
    }

    setAddingSheet(true);
    try {
      // Trích xuất ID từ URL
      const sheetId = extractSheetId(newSheet.sheetUrl);
      
      if (!sheetId) {
        throw new Error('Không thể trích xuất ID từ URL Google Sheet. Vui lòng kiểm tra lại URL.');
      }
      
      const response = await fetch('/api/sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newSheet.name,
          description: newSheet.description,
          sheetId: sheetId,
          sheetUrl: newSheet.sheetUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể tạo sheet mới');
      }

      // Làm mới danh sách sheets
      await fetchSheets();
      
      // Reset form và đóng modal
      setNewSheet({
        name: '',
        description: '',
        sheetUrl: '',
      });
      setShowAddModal(false);
      
      alert('Đã thêm sheet mới thành công!');
    } catch (error) {
      console.error('Lỗi khi thêm sheet:', error);
      alert(`Lỗi: ${error.message}`);
    } finally {
      setAddingSheet(false);
    }
  };

  const handleDeleteSheet = async (id) => {
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

      // Cập nhật danh sách sheets sau khi xóa
      setSheets(sheets.filter(sheet => sheet._id !== id));
      alert('Đã xóa sheet thành công!');
    } catch (error) {
      console.error('Lỗi khi xóa sheet:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  // Hàm xử lý tất cả PDF trong các sheets
  const handleProcessAllPDFs = async () => {
    if (!confirm('Bạn có chắc chắn muốn xử lý tất cả PDF trong tất cả sheets? Quá trình này có thể mất nhiều thời gian.')) {
      return;
    }

    setProcessingPDFs(true);
    setShowProcessingModal(true);
    setProcessingStatus({
      current: 0,
      total: sheets.length,
      currentSheet: '',
      results: []
    });

    try {
      // Xử lý tuần tự từng sheet
      for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        setProcessingStatus(prev => ({
          ...prev,
          current: i + 1,
          currentSheet: sheet.name
        }));

        try {
          // Gọi API để xử lý tất cả link trong sheet
          const response = await fetch(`/api/sheets/${sheet._id}/process-all-links`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Không thể xử lý sheet ${sheet.name}`);
          }

          const result = await response.json();
          
          // Cập nhật kết quả
          setProcessingStatus(prev => ({
            ...prev,
            results: [...prev.results, {
              sheetName: sheet.name,
              sheetId: sheet._id,
              success: true,
              processed: result.processed || 0,
              failed: result.failed || 0,
              total: result.totalCells || 0,
              uniqueLinks: result.uniqueLinks || 0
            }]
          }));
        } catch (error) {
          console.error(`Lỗi khi xử lý sheet ${sheet.name}:`, error);
          
          // Cập nhật kết quả lỗi
          setProcessingStatus(prev => ({
            ...prev,
            results: [...prev.results, {
              sheetName: sheet.name,
              sheetId: sheet._id,
              success: false,
              error: error.message
            }]
          }));
        }
        
        // Đợi 2 giây giữa các sheet để tránh quá tải
        if (i < sheets.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.error('Lỗi khi xử lý tất cả PDF:', error);
    } finally {
      setProcessingPDFs(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quản lý Google Sheets</h1>
        <div className="flex space-x-3">
          {selectedSheets.length > 0 && (
            <button
              onClick={handleOpenLinkModal}
              className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-indigo-700"
            >
              <LinkIcon className="h-5 w-5 mr-2" />
              Liên kết vào khóa học ({selectedSheets.length})
            </button>
          )}
          <button
            onClick={handleProcessAllPDFs}
            disabled={processingPDFs || sheets.length === 0}
            className={`bg-green-600 text-white px-4 py-2 rounded-md flex items-center ${
              processingPDFs || sheets.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'
            }`}
          >
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            {processingPDFs ? 'Đang xử lý...' : 'Xử lý tất cả PDF'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Thêm Sheet mới
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
      ) : sheets.length === 0 ? (
        <div className="bg-gray-100 p-6 rounded-lg text-center">
          <p className="text-gray-600">Chưa có Google Sheet nào. Hãy thêm sheet mới để bắt đầu.</p>
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    onChange={handleSelectAllSheets}
                    checked={selectedSheets.length === sheets.length && sheets.length > 0}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Sheet</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sheets.map((sheet) => (
                <tr key={sheet._id} className={`hover:bg-gray-50 ${selectedSheets.includes(sheet._id) ? 'bg-indigo-50' : ''}`}>
                  <td className="px-2 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedSheets.includes(sheet._id)}
                      onChange={() => handleSelectSheet(sheet._id)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/admin/sheets/${sheet._id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                      {sheet.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500">{sheet.description || 'Không có mô tả'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{sheet.sheetId}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(sheet.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Link
                        href={`/admin/sheets/${sheet._id}`}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </Link>
                      <button
                        onClick={() => handleDeleteSheet(sheet._id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal thêm sheet mới */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Thêm Google Sheet mới</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên Sheet</label>
                  <input
                    type="text"
                    value={newSheet.name}
                    onChange={(e) => setNewSheet({ ...newSheet, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập tên sheet"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả (tùy chọn)</label>
                  <textarea
                    value={newSheet.description}
                    onChange={(e) => setNewSheet({ ...newSheet, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập mô tả cho sheet"
                    rows="3"
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Sheet</label>
                  <input
                    type="text"
                    value={newSheet.sheetUrl}
                    onChange={(e) => setNewSheet({ ...newSheet, sheetUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Dán liên kết đến Google Sheet. Đảm bảo sheet đã được chia sẻ công khai hoặc có quyền truy cập.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddSheet}
                  disabled={addingSheet}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center ${
                    addingSheet ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {addingSheet ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Thêm Sheet'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal hiển thị tiến trình xử lý PDF */}
      {showProcessingModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Xử lý PDF từ tất cả Google Sheets</h2>
              
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Tiến trình: {processingStatus.current}/{processingStatus.total} sheets</span>
                  <span className="text-sm">{Math.round((processingStatus.current / processingStatus.total) * 100) || 0}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full" 
                    style={{ width: `${(processingStatus.current / processingStatus.total) * 100}%` }}
                  ></div>
                </div>
                {processingPDFs && (
                  <p className="text-sm text-gray-600 mt-2">
                    Đang xử lý: {processingStatus.currentSheet}
                  </p>
                )}
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sheet</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đã xử lý</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thất bại</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tổng links</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {processingStatus.results.map((result, index) => (
                      <tr key={index} className={result.success ? 'bg-green-50' : 'bg-red-50'}>
                        <td className="px-4 py-3 text-sm">{result.sheetName}</td>
                        <td className="px-4 py-3 text-sm">
                          {result.success ? (
                            <span className="text-green-600 font-medium">Thành công</span>
                          ) : (
                            <span className="text-red-600 font-medium">Lỗi: {result.error}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{result.processed || 0}</td>
                        <td className="px-4 py-3 text-sm">{result.failed || 0}</td>
                        <td className="px-4 py-3 text-sm">{result.total || 0} ({result.uniqueLinks || 0} duy nhất)</td>
                      </tr>
                    ))}
                    {processingPDFs && processingStatus.results.length < processingStatus.total && (
                      <tr>
                        <td colSpan="5" className="px-4 py-3 text-center text-sm">
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                            Đang xử lý...
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowProcessingModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  disabled={processingPDFs}
                >
                  {processingPDFs ? 'Đang xử lý...' : 'Đóng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal liên kết sheet vào khóa học */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Liên kết Sheet vào Khóa học</h2>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600">
                  Bạn đã chọn {selectedSheets.length} sheet để liên kết. Vui lòng chọn khóa học để liên kết các sheet này.
                </p>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Chọn khóa học</label>
                {loadingCourses ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                    <span className="text-sm text-gray-500">Đang tải danh sách khóa học...</span>
                  </div>
                ) : courses.length === 0 ? (
                  <p className="text-sm text-red-500">Không có khóa học nào. Vui lòng tạo khóa học trước.</p>
                ) : (
                  <select
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn khóa học --</option>
                    {courses.map((course) => (
                      <option key={course._id} value={course._id}>
                        {course.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              {/* Hiển thị kết quả liên kết nếu có */}
              {linkingResults && (
                <div className={`mb-4 p-3 rounded-md ${linkingResults.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-sm font-medium ${linkingResults.success ? 'text-green-700' : 'text-red-700'}`}>
                    {linkingResults.message}
                  </p>
                  
                  {linkingResults.results.length > 0 && !linkingResults.inProgress && (
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      <ul className="text-xs space-y-1">
                        {linkingResults.results.map((result, index) => (
                          <li key={index} className={`py-1 px-2 rounded ${result.success ? 'bg-green-100' : 'bg-red-100'}`}>
                            <span className="font-medium">{result.sheetName}</span>: {result.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Đóng
                </button>
                <button
                  onClick={handleLinkSheetsToCourse}
                  disabled={linkingSheets || !selectedCourse || courses.length === 0}
                  className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center ${
                    linkingSheets || !selectedCourse || courses.length === 0 ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {linkingSheets ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang liên kết...
                    </>
                  ) : (
                    <>
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Liên kết
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 