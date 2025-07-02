'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, PlusIcon, PencilIcon, TrashIcon, ArrowPathIcon, DocumentArrowDownIcon, DocumentTextIcon, LinkIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { use } from 'react';

export default function SheetDetailPage({ params }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const [sheet, setSheet] = useState(null);
  const [sheetData, setSheetData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddRelatedModal, setShowAddRelatedModal] = useState(false);
  const [showLinkCourseModal, setShowLinkCourseModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
  });
  const [relatedSheet, setRelatedSheet] = useState({
    name: '',
    description: '',
    sheetUrl: '',
  });
  const [addingRelated, setAddingRelated] = useState(false);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [linkingCourse, setLinkingCourse] = useState(false);
  const [linkedCourses, setLinkedCourses] = useState([]);
  const [loadingLinkedCourses, setLoadingLinkedCourses] = useState(false);
  const [coursesError, setCoursesError] = useState(null);
  const [showCellEditModal, setShowCellEditModal] = useState(false);
  const [cellEditData, setCellEditData] = useState({
    rowIndex: 0,
    columnIndex: 0,
    value: '',
    url: '',
  });
  const [updatingCell, setUpdatingCell] = useState(false);
  const [processingPdf, setProcessingPdf] = useState(false);
  const [processingPdfResult, setProcessingPdfResult] = useState(null);
  const [showProcessPdfModal, setShowProcessPdfModal] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState('');
  const [processingLinks, setProcessingLinks] = useState(false);
  const [processLinksResult, setProcessLinksResult] = useState(null);
  const [showProcessLinksModal, setShowProcessLinksModal] = useState(false);
  const [testDriveLink, setTestDriveLink] = useState('');
  
  // State cho xử lý dữ liệu vào database
  const [processingToDb, setProcessingToDb] = useState(false);
  const [dbProcessingStatus, setDbProcessingStatus] = useState(null);
  const [showDbProcessingModal, setShowDbProcessingModal] = useState(false);
  const [storageOptions, setStorageOptions] = useState({
    storeHtmlData: true,
  });

  useEffect(() => {
    fetchSheetDetail();
    fetchLinkedCourses();
  }, [id]);

  // Tự động tải dữ liệu sheet khi có thông tin sheet
  useEffect(() => {
    if (sheet && sheet.sheetId) {
      console.log('Tự động tải dữ liệu sheet:', sheet.name);
      fetchSheetData();
    }
  }, [sheet]);

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

  const fetchLinkedCourses = async () => {
    setLoadingLinkedCourses(true);
    try {
      const response = await fetch(`/api/sheets/${id}/courses`);
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi lấy danh sách khóa học liên kết');
      }
      
      setLinkedCourses(result.courses || []);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách khóa học liên kết:', error);
    } finally {
      setLoadingLinkedCourses(false);
    }
  };

  const fetchCourses = async () => {
    setLoadingCourses(true);
    setCoursesError(null);
    try {
      const response = await fetch('/api/courses');
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi lấy danh sách khóa học');
      }
      
      setCourses(result.courses || []);
    } catch (error) {
      console.error('Lỗi khi lấy danh sách khóa học:', error);
      setCoursesError(error.message);
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleOpenLinkCourseModal = () => {
    fetchCourses();
    setShowLinkCourseModal(true);
  };

  const handleLinkCourse = async () => {
    if (!selectedCourse) {
      alert('Vui lòng chọn một khóa học');
      return;
    }

    setLinkingCourse(true);
    try {
      const response = await fetch(`/api/courses/${selectedCourse}/sheets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể liên kết sheet với khóa học');
      }

      const result = await response.json();
      
      // Cập nhật danh sách khóa học liên kết
      fetchLinkedCourses();
      
      // Đóng modal và reset form
      setShowLinkCourseModal(false);
      setSelectedCourse('');
      
      alert('Đã liên kết sheet với khóa học thành công!');
    } catch (error) {
      console.error('Lỗi khi liên kết sheet với khóa học:', error);
      alert(`Lỗi: ${error.message}`);
    } finally {
      setLinkingCourse(false);
    }
  };

  const handleUnlinkCourse = async (courseId) => {
    if (!confirm('Bạn có chắc chắn muốn hủy liên kết sheet này với khóa học?')) {
      return;
    }

    try {
      const response = await fetch(`/api/courses/${courseId}/sheets/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể hủy liên kết sheet với khóa học');
      }

      // Cập nhật danh sách khóa học liên kết
      fetchLinkedCourses();
      
      alert('Đã hủy liên kết sheet với khóa học thành công!');
    } catch (error) {
      console.error('Lỗi khi hủy liên kết sheet với khóa học:', error);
      alert(`Lỗi: ${error.message}`);
    }
  };

  const fetchSheetData = async (sheetId = null, options = {}) => {
    if (!sheet && !sheetId) return;
    
    const targetId = sheetId || id;
    
    setLoadingData(true);
    try {
      // Thử lấy dữ liệu từ database trước
      const useDb = options.useDb !== false;
      let response;
      
      if (useDb) {
        console.log('Đang lấy dữ liệu từ database...');
        response = await fetch(`/api/sheets/${targetId}/from-db?fallbackToApi=true`);
      } else {
        // Lấy trực tiếp từ Google Sheets API nếu không dùng DB
        console.log('Đang lấy dữ liệu trực tiếp từ Google Sheets API...');
        response = await fetch(`/api/sheets/${targetId}?fetchData=true`);
      }
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi lấy dữ liệu');
      }
      
      // Log nguồn dữ liệu nếu có
      if (useDb && result.source) {
        console.log(`Dữ liệu được lấy từ: ${result.source}`);
      }
      
      // Đối với dữ liệu từ database, nó đã được định dạng giống Google Sheets API
      if (result.data) {
        setSheetData(result.data);
      } else if (result.sheet && result.sheet.data) {
        setSheetData(result.sheet.data);
      } else {
        console.warn('Không tìm thấy dữ liệu trong kết quả trả về');
      }
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

  const handleAddRelatedSheet = async () => {
    if (!relatedSheet.name || !relatedSheet.sheetUrl) {
      alert('Vui lòng nhập tên và URL của Google Sheet liên quan');
      return;
    }

    setAddingRelated(true);
    try {
      // Trích xuất ID từ URL
      const sheetId = extractSheetId(relatedSheet.sheetUrl);
      
      if (!sheetId) {
        throw new Error('Không thể trích xuất ID từ URL Google Sheet. Vui lòng kiểm tra lại URL.');
      }
      
      const response = await fetch(`/api/sheets/${id}/related`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: relatedSheet.name,
          description: relatedSheet.description,
          sheetId: sheetId,
          sheetUrl: relatedSheet.sheetUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể thêm sheet liên quan');
      }

      const result = await response.json();
      setSheet(result.sheet);
      
      // Reset form và đóng modal
      setRelatedSheet({
        name: '',
        description: '',
        sheetUrl: '',
      });
      setShowAddRelatedModal(false);
      
      alert('Đã thêm sheet liên quan thành công!');
    } catch (error) {
      console.error('Lỗi khi thêm sheet liên quan:', error);
      alert(`Lỗi: ${error.message}`);
    } finally {
      setAddingRelated(false);
    }
  };

  const handleDeleteRelatedSheet = async (relatedId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa sheet liên quan này?')) {
      return;
    }

    try {
      const response = await fetch(`/api/sheets/${id}/related?relatedId=${relatedId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Không thể xóa sheet liên quan');
      }

      const result = await response.json();
      setSheet(result.sheet);
      alert('Đã xóa sheet liên quan thành công!');
    } catch (error) {
      console.error('Lỗi khi xóa sheet liên quan:', error);
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

  const handleOpenGoogleSheet = (url = null) => {
    const sheetUrl = url || (sheet && sheet.sheetUrl);
    if (!sheetUrl) return;
    window.open(sheetUrl, '_blank');
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

  const handleUpdateCell = async () => {
    if (!sheet || !sheet._id) return;
    
    try {
      setUpdatingCell(true);
      
      // Call API to update the cell
      const response = await fetch(`/api/sheets/${id}/update-cell`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: cellEditData.rowIndex,
          columnIndex: cellEditData.columnIndex,
          value: cellEditData.value,
          url: cellEditData.url,
        }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Không thể cập nhật ô');
      }
      
      // Refresh sheet data to show updated values
      await fetchSheetData();
      
      // Close modal
      setShowCellEditModal(false);
      
      // Success notification
      alert('Đã cập nhật ô thành công!');
      
    } catch (error) {
      console.error('Lỗi khi cập nhật ô:', error);
      alert(`Lỗi: ${error.message}`);
    } finally {
      setUpdatingCell(false);
    }
  };

  const handleEditCell = (rowIndex, columnIndex, value, url = null) => {
    setCellEditData({
      rowIndex,
      columnIndex,
      value: value || '',
      url: url || '',
    });
    setShowCellEditModal(true);
  };

  const extractUrlFromCell = (cell) => {
    if (typeof cell === 'string') {
      // Check for HYPERLINK formula
      const hyperlinkRegex = /=HYPERLINK\("([^"]+)"(?:,\s*"([^"]+)")?\)/i;
      const hyperlinkMatch = cell.match(hyperlinkRegex);
      if (hyperlinkMatch) {
        return hyperlinkMatch[1];
      }
      
      // Check if cell content is a URL
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urlMatch = cell.match(urlRegex);
      if (urlMatch) {
        return urlMatch[0];
      }
    }
    return null;
  };

  // Extract Sheet ID from Google Sheet URL
  const extractSheetId = (url) => {
    if (!url) return null;
    
    // Pattern for Google Sheets URLs
    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/, // Standard format
      /\/spreadsheets\/u\/\d+\/d\/([a-zA-Z0-9-_]+)/, // User-specific format
      /^([a-zA-Z0-9-_]+)$/ // Direct ID
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  };

  const renderTable = () => {
    if (!sheetData || !sheetData.values || sheetData.values.length === 0) {
      return (
        <div className="bg-gray-100 p-6 rounded-lg text-center">
          <p className="text-gray-600">Không có dữ liệu để hiển thị.</p>
        </div>
      );
    }

    // Kiểm tra xem có dữ liệu hyperlink tối ưu không
    const hasOptimizedData = sheetData.optimizedHtmlData && sheetData.optimizedHtmlData.length > 0;
    
    // Hàm để lấy hyperlink từ dữ liệu tối ưu
    const getOptimizedHyperlink = (rowIndex, colIndex) => {
      if (!hasOptimizedData) return null;
      
      const optimizedRow = sheetData.optimizedHtmlData.find(row => row.rowIndex === rowIndex);
      if (!optimizedRow || !optimizedRow.hyperlinks) return null;
      
      const hyperlink = optimizedRow.hyperlinks.find(link => link.col === colIndex);
      return hyperlink ? hyperlink.url : null;
    };

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
              // Lấy dữ liệu HTML tương ứng từ cả hai cấu trúc
              const htmlRow = sheetData.htmlData?.[rowIndex + 1]?.values || [];
              
              return (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => {
                    // Thử lấy hyperlink từ htmlData đầy đủ
                    const htmlCell = htmlRow[cellIndex];
                    let hyperlink = htmlCell?.hyperlink;
                    
                    // Nếu không có, thử lấy từ dữ liệu tối ưu
                    if (!hyperlink && hasOptimizedData) {
                      hyperlink = getOptimizedHyperlink(rowIndex + 1, cellIndex);
                    }
                    
                    // Nếu có hyperlink
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
                        <td key={cellIndex} className="px-6 py-4 whitespace-nowrap group relative">
                          <div className="flex items-center justify-between">
                            <a 
                              href={hyperlink} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:underline"
                            >
                              {icon}{cell}
                            </a>
                            <button
                              onClick={() => handleEditCell(rowIndex + 1, cellIndex, cell, hyperlink)}
                              className="ml-2 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                              title={`Sửa ô ${String.fromCharCode(65 + cellIndex)}${rowIndex + 2}`}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      );
                    }
                    
                    return (
                      <td key={cellIndex} className="px-6 py-4 whitespace-nowrap group relative">
                        <div className="flex items-center justify-between">
                          <span>{renderCellContent(cell)}</span>
                          <button
                            onClick={() => handleEditCell(rowIndex + 1, cellIndex, cell, extractUrlFromCell(cell))}
                            className="ml-2 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                            title={`Sửa ô ${String.fromCharCode(65 + cellIndex)}${rowIndex + 2}`}
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                        </div>
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

  // Hàm xử lý PDF từ Google Drive
  const handleProcessPdf = async () => {
    if (!selectedPdfUrl) {
      alert('Vui lòng nhập URL của file PDF từ Google Drive');
      return;
    }

    try {
      setProcessingPdf(true);
      setProcessingPdfResult(null);
      
      const response = await fetch('/api/drive/process-and-replace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driveLink: selectedPdfUrl
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể xử lý file PDF');
      }
      
      const result = await response.json();
      setProcessingPdfResult(result);
      
      // Đóng modal sau khi xử lý thành công
      setTimeout(() => {
        setShowProcessPdfModal(false);
      }, 3000);
      
    } catch (error) {
      console.error('Lỗi khi xử lý PDF:', error);
      alert(`Lỗi: ${error.message}`);
      setProcessingPdfResult({
        success: false,
        error: error.message
      });
    } finally {
      setProcessingPdf(false);
    }
  };

  // Hàm xử lý dữ liệu vào database
  const handleProcessToDatabase = async () => {
    const confirmMessage = `Bạn có chắc chắn muốn xử lý dữ liệu sheet "${sheet.name}" (ID: ${sheet.sheetId}) vào database?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }
    
    try {
      setProcessingToDb(true);
      setDbProcessingStatus({
        inProgress: true,
        message: 'Đang xử lý dữ liệu vào database...'
      });
      
      const response = await fetch(`/api/sheets/${id}/process-to-db`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          background: false // Luôn xử lý đồng bộ
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể xử lý dữ liệu sheet vào database');
      }
      
      const result = await response.json();
      
      setDbProcessingStatus({
        inProgress: false,
        success: result.success,
        message: result.message || 'Đã xử lý dữ liệu vào database thành công',
        stats: result.stats || {}
      });
      
      // Tải dữ liệu từ database sau khi xử lý thành công
      if (result.success) {
        await fetchSheetData(null, { useDb: true });
        
        // Đóng modal sau một khoảng thời gian
        setTimeout(() => {
          setShowDbProcessingModal(false);
        }, 3000);
      }
      
    } catch (error) {
      console.error('Lỗi khi xử lý dữ liệu vào database:', error);
      setDbProcessingStatus({
        inProgress: false,
        success: false,
        message: `Lỗi: ${error.message}`
      });
    } finally {
      setProcessingToDb(false);
    }
  };

  // Thêm hàm xử lý với tùy chọn xóa dữ liệu cũ
  const handleProcessWithCleanup = () => {
    handleProcessToDatabase({ forceCleanup: true });
  };

  // Hàm xử lý tất cả link trong sheet
  const handleProcessAllLinks = async () => {
    if (!confirm('Bạn có chắc chắn muốn xử lý tất cả link Google Drive trong sheet này? Quá trình này có thể mất nhiều thời gian.')) {
      return;
    }

    try {
      setProcessingLinks(true);
      setProcessLinksResult(null);
      setShowProcessLinksModal(true);
      
      const requestBody = {};
      if (testDriveLink) {
        requestBody.testDriveLink = testDriveLink;
      }
      
      const response = await fetch(`/api/sheets/${id}/process-all-links`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể xử lý các link trong sheet');
      }
      
      const result = await response.json();
      setProcessLinksResult(result);
      
      // Tải lại dữ liệu sheet sau khi xử lý xong
      if (result.success && result.processed > 0) {
        await fetchSheetData();
      }
      
    } catch (error) {
      console.error('Lỗi khi xử lý tất cả link:', error);
      setProcessLinksResult({
        success: false,
        error: error.message
      });
    } finally {
      setProcessingLinks(false);
    }
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
                    onClick={() => handleOpenGoogleSheet()}
                    className="bg-green-600 text-white px-4 py-2 rounded-md w-full"
                  >
                    Mở Google Sheet
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => fetchSheetData(null, { useDb: true })}
                      disabled={loadingData}
                      className={`bg-green-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center ${
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
                          Tải từ DB
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => fetchSheetData(null, { useDb: false })}
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
                          Tải từ API
                        </>
                      )}
                    </button>
                  </div>
                  {sheetData && (
                    <button
                      onClick={handleExportData}
                      className="bg-purple-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center"
                    >
                      <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
                      Xuất dữ liệu (JSON)
                    </button>
                  )}
                  <button
                    onClick={handleOpenLinkCourseModal}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center"
                  >
                    <PlusIcon className="h-5 w-5 mr-2" />
                    Liên kết với khóa học
                  </button>
                  <button
                    onClick={() => setShowProcessPdfModal(true)}
                    className="bg-red-500 text-white px-4 py-2 rounded-md w-full flex items-center justify-center"
                  >
                    <DocumentTextIcon className="h-5 w-5 mr-2" />
                    Xử lý file PDF từ Drive
                  </button>
                  <button
                    onClick={handleProcessAllLinks}
                    disabled={!sheetData || processingLinks}
                    className={`bg-indigo-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center ${
                      (!sheetData || processingLinks) ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    <LinkIcon className="h-5 w-5 mr-2" />
                    Xử lý tất cả link Drive
                  </button>
                  
                  <button
                    onClick={() => setShowDbProcessingModal(true)}
                    disabled={!sheet || processingToDb}
                    className={`bg-green-600 text-white px-4 py-2 rounded-md w-full flex items-center justify-center ${
                      (!sheet || processingToDb) ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    <ArrowPathIcon className="h-5 w-5 mr-2" />
                    Xử lý dữ liệu vào DB
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Phần Khóa học liên kết */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Khóa học liên kết</h2>
              <button
                onClick={handleOpenLinkCourseModal}
                className="bg-blue-600 text-white px-3 py-1 rounded-md flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Liên kết khóa học
              </button>
            </div>
            
            {loadingLinkedCourses ? (
              <div className="flex justify-center items-center h-20">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : !linkedCourses || linkedCourses.length === 0 ? (
              <div className="bg-gray-100 p-4 rounded-lg text-center">
                <p className="text-gray-600">Chưa có khóa học nào được liên kết với sheet này.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên khóa học</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {linkedCourses.map((course) => (
                      <tr key={course._id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <Link href={`/admin/courses/${course._id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                            {course.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm text-gray-500">{course.description || 'Không có mô tả'}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {course.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                          </span>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <Link
                              href={`/admin/courses/${course._id}`}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Xem chi tiết"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>
                            <button
                              onClick={() => handleUnlinkCourse(course._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Hủy liên kết"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Phần Sheet liên quan */}
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Sheet liên quan</h2>
              <button
                onClick={() => setShowAddRelatedModal(true)}
                className="bg-blue-600 text-white px-3 py-1 rounded-md flex items-center"
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Thêm Sheet liên quan
              </button>
            </div>
            
            {!sheet.relatedSheets || sheet.relatedSheets.length === 0 ? (
              <div className="bg-gray-100 p-4 rounded-lg text-center">
                <p className="text-gray-600">Chưa có sheet liên quan nào.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tên</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mô tả</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Sheet</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sheet.relatedSheets.map((related) => (
                      <tr key={related._id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{related.name}</div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm text-gray-500">{related.description || 'Không có mô tả'}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <div className="text-sm text-gray-500">{related.sheetId}</div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleOpenGoogleSheet(related.sheetUrl)}
                              className="text-green-600 hover:text-green-900"
                              title="Mở Google Sheet"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteRelatedSheet(related._id)}
                              className="text-red-600 hover:text-red-900"
                              title="Xóa"
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

      {/* Modal thêm sheet liên quan */}
      {showAddRelatedModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Thêm Sheet liên quan</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên Sheet</label>
                  <input
                    type="text"
                    value={relatedSheet.name}
                    onChange={(e) => setRelatedSheet({ ...relatedSheet, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập tên sheet liên quan"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả (tùy chọn)</label>
                  <textarea
                    value={relatedSheet.description}
                    onChange={(e) => setRelatedSheet({ ...relatedSheet, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập mô tả cho sheet liên quan"
                    rows="3"
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Sheet</label>
                  <input
                    type="text"
                    value={relatedSheet.sheetUrl}
                    onChange={(e) => setRelatedSheet({ ...relatedSheet, sheetUrl: e.target.value })}
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
                  onClick={() => setShowAddRelatedModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleAddRelatedSheet}
                  disabled={addingRelated}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center ${
                    addingRelated ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {addingRelated ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Thêm Sheet liên quan'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal liên kết với khóa học */}
      {showLinkCourseModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Liên kết với khóa học</h2>
              
              <div className="space-y-4">
                {loadingCourses ? (
                  <div className="flex justify-center items-center h-20">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : coursesError ? (
                  <div className="bg-red-100 p-4 rounded-lg text-center">
                    <p className="text-red-600">{coursesError}</p>
                    <button 
                      onClick={fetchCourses}
                      className="mt-2 px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : courses.length === 0 ? (
                  <div className="bg-gray-100 p-4 rounded-lg text-center">
                    <p className="text-gray-600">Không tìm thấy khóa học nào.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chọn khóa học</label>
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
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowLinkCourseModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleLinkCourse}
                  disabled={linkingCourse || !selectedCourse || loadingCourses || coursesError}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center ${
                    (linkingCourse || !selectedCourse || loadingCourses || coursesError) ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {linkingCourse ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Liên kết'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal chỉnh sửa cell */}
      {showCellEditModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                Chỉnh sửa ô {String.fromCharCode(65 + cellEditData.columnIndex)}{cellEditData.rowIndex}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị</label>
                  <textarea
                    value={cellEditData.value}
                    onChange={(e) => setCellEditData({ ...cellEditData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nhập giá trị cho ô"
                    rows="3"
                  ></textarea>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL (tùy chọn)</label>
                  <input
                    type="text"
                    value={cellEditData.url}
                    onChange={(e) => setCellEditData({ ...cellEditData, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Để trống nếu không muốn thêm liên kết
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCellEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleUpdateCell}
                  disabled={updatingCell}
                  className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center ${
                    updatingCell ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {updatingCell ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang cập nhật...
                    </>
                  ) : (
                    'Lưu thay đổi'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal xử lý PDF */}
      {showProcessPdfModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                Xử lý file PDF từ Google Drive
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL Google Drive</label>
                  <input
                    type="text"
                    value={selectedPdfUrl}
                    onChange={(e) => setSelectedPdfUrl(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://drive.google.com/file/d/..."
                    disabled={processingPdf}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Nhập URL của file PDF từ Google Drive cần xử lý
                  </p>
                </div>
                
                {processingPdfResult && (
                  <div className={`p-4 rounded-md ${processingPdfResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                    {processingPdfResult.success ? (
                      <div>
                        <p className="font-medium text-green-800">Xử lý thành công!</p>
                        <p className="text-sm text-green-700 mt-1">File đã được xử lý và tải lên Drive.</p>
                        <a 
                          href={processingPdfResult.processedFile.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline mt-2 inline-block"
                        >
                          Mở file đã xử lý
                        </a>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-red-800">Xử lý thất bại</p>
                        <p className="text-sm text-red-700 mt-1">{processingPdfResult.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowProcessPdfModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={processingPdf}
                >
                  Đóng
                </button>
                <button
                  onClick={handleProcessPdf}
                  disabled={processingPdf || !selectedPdfUrl}
                  className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center ${
                    (processingPdf || !selectedPdfUrl) ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {processingPdf ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Xử lý PDF'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal xử lý tất cả link */}
      {showProcessLinksModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                Xử lý tất cả link Google Drive trong sheet
              </h2>
              
              <div className="space-y-4">
                {processingLinks ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-lg">Đang xử lý các link trong sheet...</p>
                    <p className="text-sm text-gray-500 mt-2">Quá trình này có thể mất vài phút tùy thuộc vào số lượng link.</p>
                  </div>
                ) : processLinksResult ? (
                  <div>
                    {processLinksResult.success ? (
                      <div>
                        <div className="bg-green-50 p-4 rounded-md mb-4">
                          <p className="text-green-800 font-medium">Xử lý hoàn tất!</p>
                          <p className="text-green-700 mt-1">
                            Đã xử lý {processLinksResult.processed} / {processLinksResult.totalLinks} link.
                            {processLinksResult.failed > 0 && ` (${processLinksResult.failed} link thất bại)`}
                          </p>
                        </div>
                        
                        {processLinksResult.processed > 0 && (
                          <div className="mt-4">
                            <h3 className="font-medium text-gray-900 mb-2">Link đã xử lý:</h3>
                            <div className="max-h-60 overflow-y-auto bg-gray-50 rounded-md p-3">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Vị trí</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Link gốc</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Link mới</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {processLinksResult.processedCells.map((cell, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                                        {String.fromCharCode(65 + cell.colIndex)}{cell.rowIndex + 1}
                                      </td>
                                      <td className="px-3 py-2 text-sm">
                                        <a 
                                          href={cell.originalUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="text-blue-600 hover:underline truncate block max-w-xs"
                                        >
                                          {cell.originalUrl}
                                        </a>
                                      </td>
                                      <td className="px-3 py-2 text-sm">
                                        <a 
                                          href={cell.newUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="text-green-600 hover:underline truncate block max-w-xs"
                                        >
                                          {cell.newUrl}
                                        </a>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        
                        {processLinksResult.failed > 0 && (
                          <div className="mt-4">
                            <h3 className="font-medium text-gray-900 mb-2">Link lỗi:</h3>
                            <div className="max-h-40 overflow-y-auto bg-red-50 rounded-md p-3">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-red-100">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Vị trí</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Link</th>
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Lỗi</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {processLinksResult.errors.map((error, index) => (
                                    <tr key={index} className="hover:bg-red-100">
                                      <td className="px-3 py-2 whitespace-nowrap text-sm">
                                        {String.fromCharCode(65 + error.colIndex)}{error.rowIndex + 1}
                                      </td>
                                      <td className="px-3 py-2 text-sm">
                                        <a 
                                          href={error.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="text-blue-600 hover:underline truncate block max-w-xs"
                                        >
                                          {error.url}
                                        </a>
                                      </td>
                                      <td className="px-3 py-2 text-sm text-red-600">
                                        {error.error}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-red-50 p-4 rounded-md">
                        <p className="text-red-800 font-medium">Xử lý thất bại</p>
                        <p className="text-red-700 mt-1">{processLinksResult.error}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-600">
                      Nhấn nút "Bắt đầu xử lý" để tìm và xử lý tất cả link Google Drive trong sheet.
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Quá trình này sẽ tải xuống từng file, xử lý và tải lên lại Drive với bản đã xử lý.
                    </p>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1 text-left">Link test (tùy chọn)</label>
                      <input
                        type="text"
                        value={testDriveLink}
                        onChange={(e) => setTestDriveLink(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="https://drive.google.com/file/d/..."
                      />
                      <p className="text-sm text-gray-500 mt-1 text-left">
                        Nếu không tìm thấy link nào trong sheet, hệ thống sẽ sử dụng link này để test.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowProcessLinksModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  disabled={processingLinks}
                >
                  {processLinksResult ? 'Đóng' : 'Hủy'}
                </button>
                {!processLinksResult && (
                  <button
                    onClick={handleProcessAllLinks}
                    disabled={processingLinks}
                    className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center ${
                      processingLinks ? 'opacity-70 cursor-not-allowed' : ''
                    }`}
                  >
                    {processingLinks ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                        Đang xử lý...
                      </>
                    ) : (
                      'Bắt đầu xử lý'
                    )}
                  </button>
                )}
                {processLinksResult && processLinksResult.success && (
                  <button
                    onClick={() => fetchSheetData()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Tải lại dữ liệu sheet
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal xử lý dữ liệu vào DB */}
      {showDbProcessingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-blue-600 text-white px-4 py-3 flex justify-between items-center">
              <h3 className="text-lg font-semibold">Xử lý dữ liệu sheet vào database</h3>
              <button 
                onClick={() => setShowDbProcessingModal(false)}
                className="text-white hover:text-gray-200"
                disabled={processingToDb}
              >
                &times;
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4">
                <p className="text-gray-700 mb-2">
                  Tính năng này sẽ xử lý dữ liệu từ Google Sheet và lưu vào database để giảm tải cho server.
                </p>
                
                {/* Thêm phần hiển thị thông tin sheet */}
                <div className="bg-blue-50 p-3 rounded-md mb-4">
                  <p className="text-sm text-blue-800 font-medium">Thông tin sheet:</p>
                  <p className="text-sm text-blue-700">Tên: {sheet?.name}</p>
                  <p className="text-sm text-blue-700">ID: {sheet?.sheetId}</p>
                  <p className="text-sm text-blue-700">Mô tả: {sheet?.description || 'Không có mô tả'}</p>
                </div>
              </div>
              
              <div className="mb-6 flex justify-center">
                <button
                  onClick={handleProcessToDatabase}
                  disabled={processingToDb}
                  className={`px-6 py-3 rounded ${processingToDb ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white font-medium text-lg`}
                >
                  {processingToDb ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-2"></div>
                      Đang xử lý...
                    </div>
                  ) : (
                    'Xử lý dữ liệu vào DB'
                  )}
                </button>
              </div>
              
              {dbProcessingStatus && (
                <div className={`mt-4 p-4 rounded-md ${
                  dbProcessingStatus.inProgress ? 'bg-blue-50 text-blue-700' :
                  dbProcessingStatus.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  <p className="font-medium">{dbProcessingStatus.message}</p>
                  
                  {dbProcessingStatus.inProgress && (
                    <div className="flex justify-center mt-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-700"></div>
                    </div>
                  )}
                  
                  {dbProcessingStatus.stats && (
                    <div className="mt-2 text-sm">
                      <p>Số hàng đã xử lý: {dbProcessingStatus.stats.processedCount || 0}</p>
                      <p>Số lỗi: {dbProcessingStatus.stats.errors || 0}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}