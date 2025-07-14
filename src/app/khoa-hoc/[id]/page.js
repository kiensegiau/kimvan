'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { decodeProxyLink, getUpdatedUrl } from '@/utils/proxy-utils';
import { ArrowLeftIcon, CloudArrowDownIcon, ExclamationCircleIcon, XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import YouTubeModal from '../components/YouTubeModal';
import YouTubePlaylistModal from '../components/YouTubePlaylistModal';
import LoadingOverlay from '../components/LoadingOverlay';
import CryptoJS from 'crypto-js';

// Khóa mã hóa - phải giống với khóa ở phía server
const ENCRYPTION_KEY = 'kimvan-secure-key-2024';
// Thời gian cache - 12 giờ tính bằng milliseconds
const CACHE_DURATION = 12 * 60 * 60 * 1000;

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;
  
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [youtubeModal, setYoutubeModal] = useState({
    isOpen: false,
    videoId: '',
    title: ''
  });
  const [youtubePlaylistModal, setYoutubePlaylistModal] = useState({
    isOpen: false,
    playlistId: '',
    videoId: '',
    title: ''
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const [processingLink, setProcessingLink] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [cacheStatus, setCacheStatus] = useState('');
  const [permissionChecked, setPermissionChecked] = useState(false);
  const [showScrollGuide, setShowScrollGuide] = useState(true);
  const [hidingScrollGuide, setHidingScrollGuide] = useState(false);
  
  // Hàm giải mã dữ liệu với xử lý lỗi tốt hơn
  const decryptData = (encryptedData) => {
    try {
      if (!encryptedData) {
        throw new Error("Không có dữ liệu được mã hóa");
      }
      
      // Giải mã dữ liệu
      const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
      if (!decryptedBytes) {
        throw new Error("Giải mã không thành công");
      }
      
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedText || decryptedText.length === 0) {
        throw new Error("Dữ liệu giải mã không hợp lệ");
      }
      
      return JSON.parse(decryptedText);
    } catch (error) {
      // Xử lý lỗi im lặng
      throw new Error(`Không thể giải mã: ${error.message}`);
    }
  };

  // Hàm lấy thông tin chi tiết của khóa học
  const fetchCourseDetail = async () => {
    setLoading(true);
    setError(null); // Reset error trước khi fetch
    
    try {
      // Kiểm tra xem đã đăng nhập hay chưa và lấy thông tin quyền truy cập
      let hasPermissionChange = false;
      try {
        const permissionResponse = await fetch('/api/users/me');
        if (permissionResponse.ok) {
          const userData = await permissionResponse.json();
          // Kiểm tra xem người dùng có quyền xem tất cả khóa học không
          if (userData && userData.canViewAllCourses) {
            // Xóa cache không cần kiểm tra để đảm bảo luôn tải dữ liệu mới nhất
            try {
              localStorage.removeItem(`course-${id}`);
              hasPermissionChange = true;
            } catch (cacheError) {
              // Bỏ qua lỗi khi xóa cache
            }
          }
        }
      } catch (permError) {
        // Bỏ qua lỗi khi kiểm tra quyền
      }

      // Kiểm tra cache trước nếu không có thay đổi quyền
      if (!hasPermissionChange) {
        const cachedCourse = getFromCache();
        if (cachedCourse) {
          // Sử dụng dữ liệu cache
          setCourse(cachedCourse);
          setPermissionChecked(true); // Đánh dấu đã kiểm tra quyền khi dùng cache
          setLoading(false);
          
          // Hiệu ứng fade-in
          setTimeout(() => {
            setIsLoaded(true);
          }, 50); // Giảm thời gian chờ xuống 50ms
          
          // Tải lại dữ liệu mới ngay lập tức nếu đã đăng nhập để cập nhật quyền
          refreshCourseData(false);
          return;
        }
      }
      
      // Nếu không có cache hoặc cache hết hạn, fetch từ API
      await refreshCourseData(true);
      
    } catch (error) {
      console.error('Lỗi khi lấy thông tin khóa học:', error);
      setError(`Không thể lấy thông tin khóa học: ${error.message}`);
      setLoading(false);
      
      // Xóa cache nếu có lỗi để buộc tải lại dữ liệu trong lần tới
      try {
        localStorage.removeItem(`course-${id}`);
      } catch (e) {
        // Bỏ qua lỗi khi xóa cache
      }
    }
  };
  
  // Hàm tải lại dữ liệu từ API
  const refreshCourseData = async (showLoading = true) => {
    try {
      // Sử dụng tham số secure=true để nhận dữ liệu được mã hóa hoàn toàn
      // Thêm tham số requireEnrollment=true để kiểm tra quyền truy cập
      const response = await fetch(`/api/courses/${id}?type=auto&secure=true&requireEnrollment=true&checkViewPermission=true`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Xử lý các mã lỗi cụ thể
        if (response.status === 400) {
          throw new Error(`ID khóa học không hợp lệ. Vui lòng kiểm tra lại đường dẫn.`);
        } else if (response.status === 404) {
          throw new Error(`Không tìm thấy khóa học với ID: ${id}`);
        } else {
          const errorMessage = errorData.message || errorData.error || `Lỗi ${response.status}: ${response.statusText}`;
          throw new Error(errorMessage);
        }
      }
      
      const encryptedResponse = await response.json();
      let fullCourseData;
      
      // Kiểm tra nếu nhận được dữ liệu được mã hóa hoàn toàn
      if (encryptedResponse._secureData) {
        try {
          // Giải mã toàn bộ đối tượng
          fullCourseData = decryptData(encryptedResponse._secureData);
          
          setCourse(fullCourseData);
          setPermissionChecked(true); // Đánh dấu đã kiểm tra quyền
          // Lưu vào cache
          saveToCache(fullCourseData);
        } catch (decryptError) {
          setError(`Không thể giải mã dữ liệu khóa học: ${decryptError.message}. Vui lòng liên hệ quản trị viên.`);
          setPermissionChecked(false);
          if (showLoading) setLoading(false);
          return;
        }
      } else if (encryptedResponse._encryptedData) {
        // Xử lý trường hợp chỉ mã hóa dữ liệu nhạy cảm
        try {
          // Giải mã dữ liệu nhạy cảm
          const decryptedData = decryptData(encryptedResponse._encryptedData);
          
          // Khôi phục dữ liệu gốc
          fullCourseData = {
            ...encryptedResponse,
            originalData: decryptedData
          };
          delete fullCourseData._encryptedData;
          
          setCourse(fullCourseData);
          setPermissionChecked(true); // Đánh dấu đã kiểm tra quyền
          // Lưu vào cache
          saveToCache(fullCourseData);
        } catch (decryptError) {
          setError(`Không thể giải mã dữ liệu khóa học: ${decryptError.message}. Vui lòng liên hệ quản trị viên.`);
          setPermissionChecked(false);
          if (showLoading) setLoading(false);
          return;
        }
      } else if (!encryptedResponse.originalData && encryptedResponse.requiresEnrollment) {
        // Trường hợp API trả về yêu cầu đăng ký
        fullCourseData = encryptedResponse;
        setCourse(fullCourseData);
        setPermissionChecked(true); // Đánh dấu đã kiểm tra quyền
        // Lưu vào cache
        saveToCache(fullCourseData);
      } else if (!encryptedResponse.originalData) {
        // Kiểm tra nếu không có dữ liệu gốc
        setError('Khóa học không có dữ liệu chi tiết.');
        setPermissionChecked(true); // Đánh dấu đã kiểm tra quyền
        if (showLoading) setLoading(false);
        return;
      } else {
        // Trường hợp dữ liệu không được mã hóa
        fullCourseData = encryptedResponse;
        setCourse(fullCourseData);
        setPermissionChecked(true); // Đánh dấu đã kiểm tra quyền
        // Lưu vào cache
        saveToCache(fullCourseData);
      }
      
      if (showLoading) setLoading(false);
      
      // Hiệu ứng fade-in
      setTimeout(() => {
        setIsLoaded(true);
      }, 50); // Giảm thời gian chờ xuống 50ms
      
    } catch (error) {
      console.error('Lỗi khi lấy thông tin khóa học:', error);
        setError(`Không thể lấy thông tin khóa học: ${error.message}`);
      if (showLoading) setLoading(false);
    }
  };

  // Hàm lưu dữ liệu vào localStorage
  const saveToCache = (data) => {
    try {
      // Tạo bản sao của dữ liệu để tránh tham chiếu
      const cacheData = JSON.parse(JSON.stringify(data));
      
      // Loại bỏ dữ liệu lớn không cần thiết để giảm kích thước cache
      if (cacheData.originalData && cacheData.originalData.sheets) {
        // Giữ lại tối đa 2 sheets đầu tiên để tiết kiệm không gian
        if (cacheData.originalData.sheets.length > 2) {
          cacheData.originalData.sheets = cacheData.originalData.sheets.slice(0, 2);
        }
        
        // Giới hạn số lượng dòng trong mỗi sheet
        cacheData.originalData.sheets.forEach(sheet => {
          if (sheet.data && sheet.data[0] && sheet.data[0].rowData && sheet.data[0].rowData.length > 50) {
            sheet.data[0].rowData = sheet.data[0].rowData.slice(0, 50);
          }
        });
      }
      
      const cacheItem = {
        data: cacheData,
        timestamp: Date.now()
      };
      
      // Kiểm tra kích thước dữ liệu trước khi lưu
      const cacheString = JSON.stringify(cacheItem);
      const cacheSize = new Blob([cacheString]).size;
      
      // Giới hạn kích thước cache là 2MB
      if (cacheSize > 2 * 1024 * 1024) {
        return;
      }
      
      // Xóa các cache cũ để giải phóng không gian
      try {
        const keys = Object.keys(localStorage);
        const courseCacheKeys = keys.filter(key => key.startsWith('course-'));
        
        // Nếu có nhiều hơn 5 cache khóa học, xóa các cache cũ nhất
        if (courseCacheKeys.length > 5) {
          const cacheItems = courseCacheKeys.map(key => {
            try {
              const item = JSON.parse(localStorage.getItem(key));
              return { key, timestamp: item.timestamp };
            } catch (e) {
              return { key, timestamp: 0 };
            }
          });
          
          // Sắp xếp theo thời gian, cũ nhất lên đầu
          cacheItems.sort((a, b) => a.timestamp - b.timestamp);
          
          // Xóa các cache cũ nhất
          for (let i = 0; i < cacheItems.length - 5; i++) {
            localStorage.removeItem(cacheItems[i].key);
          }
        }
      } catch (e) {
        // Bỏ qua lỗi khi dọn dẹp cache
      }
      
      // Thử lưu cache
      try {
        localStorage.setItem(`course-${id}`, cacheString);
        setCacheStatus('saved');
      } catch (storageError) {
        // Nếu vẫn bị lỗi, xóa tất cả cache khóa học và thử lại
        const keys = Object.keys(localStorage);
        keys.filter(key => key.startsWith('course-')).forEach(key => {
          localStorage.removeItem(key);
        });
        
        // Thử lưu lại một lần nữa
        try {
          localStorage.setItem(`course-${id}`, cacheString);
          setCacheStatus('saved');
        } catch (finalError) {
          // Nếu vẫn lỗi, bỏ qua việc cache
        }
      }
    } catch (error) {
      // Xử lý lỗi im lặng
    }
  };

  // Hàm lấy dữ liệu từ localStorage
  const getFromCache = () => {
    try {
      const cachedData = localStorage.getItem(`course-${id}`);
      if (!cachedData) {
        return null;
      }
      
      const cacheItem = JSON.parse(cachedData);
      const now = Date.now();
      
      // Kiểm tra xem cache có còn hiệu lực không (12 giờ)
      if (now - cacheItem.timestamp > CACHE_DURATION) {
        localStorage.removeItem(`course-${id}`);
        setCacheStatus('expired');
        return null;
      }
      
      setCacheStatus('hit');
      return cacheItem.data;
    } catch (error) {
      // Xử lý lỗi im lặng
      return null;
    }
  };

  // Hàm lấy tiêu đề của sheet
  const getSheetTitle = (index, sheets) => {
    if (!sheets || !sheets[index]) return `Khóa ${index + 1}`;
    const sheet = sheets[index];
    return sheet?.title || sheet?.name || sheet?.properties?.title || `Khóa ${index + 1}`;
  };

  // Hàm kiểm tra và sử dụng sheetsData thay vì originalData.sheets
  const getSheetData = () => {
    // Ưu tiên sử dụng sheetsData nếu có
    if (course?.sheetsData && course.sheetsData.length > 0) {
      return {
        sheets: course.sheetsData,
        usingSheetsData: true
      };
    } 
    // Backup: Sử dụng originalData.sheets nếu sheetsData không có
    else if (course?.originalData?.sheets && course.originalData.sheets.length > 0) {
      return {
        sheets: course.originalData.sheets,
        usingSheetsData: false
      };
    }
    return { sheets: [], usingSheetsData: false };
  };

  // Hàm lấy dữ liệu hàng và cột từ sheet
  const getSheetRows = (sheet, sheetIndex, useSheetData) => {
    if (useSheetData) {
      const header = sheet.header || [];
      let rows = [];

      if (sheet.values && Array.isArray(sheet.values)) {
        // Bỏ qua row đầu tiên vì là header
        rows = sheet.values.slice(1).map((row, idx) => {
          if (!Array.isArray(row)) return new Array(header.length).fill('');
          
          const normalizedRow = new Array(header.length).fill('');
          row.forEach((cell, colIdx) => {
            if (colIdx < header.length) {
              normalizedRow[colIdx] = cell;
            }
          });
          return normalizedRow;
        });
      }

      return {
        rows: rows,
        header: header,
        hasRows: rows.length > 0
      }
    } else {
      // Lấy từ originalData.sheets
      const header = sheet?.data?.[0]?.rowData?.[0]?.values || [];
      let rows = [];

      if (sheet?.data?.[0]?.rowData) {
        // Bỏ qua row đầu tiên vì là header
        rows = sheet.data[0].rowData.slice(1).map(row => {
          const values = row.values || [];
          const normalizedRow = new Array(header.length).fill('');
          
          values.forEach((cell, idx) => {
            if (idx < header.length) {
              normalizedRow[idx] = cell;
            }
          });
          return normalizedRow;
        });
      }

      return {
        rows: rows,
        header: header,
        hasRows: rows.length > 0
      };
    }
  };

  // Hàm trả về giá trị hiển thị từ một ô trong bảng
  const getCellValue = (cell, useSheetData, colIndex) => {
    let value;
    if (useSheetData) {
      // Giá trị từ sheetsData
      value = cell || '';
    } else {
      // Giá trị từ originalData.sheets
      value = cell?.formattedValue || '';
    }

    // Chỉ xử lý chuyển đổi ngày cho các cột không phải cột đầu tiên
    // Cột đầu tiên sẽ được xử lý bởi hàm formatDate
    if (colIndex > 0) {
      const strValue = String(value).trim();
      if (/^\d+$/.test(strValue)) {
        try {
          const numValue = parseInt(strValue);
          // Số ngày Excel thường > 1000 (tương ứng với năm >1902)
          if (numValue > 1000 && numValue < 2958465) { // Giới hạn hợp lý cho số ngày Excel
            const date = excelSerialDateToJSDate(numValue);
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            // Kiểm tra năm hợp lý (để tránh chuyển đổi nhầm các số khác)
            if (year >= 1900 && year <= 2100) {
              return `${day}/${month}/${year}`;
            }
          }
        } catch (error) {
          // Bỏ qua lỗi và trả về giá trị gốc
        }
      }
    }

    return value;
  };

  // Hàm trích xuất hyperlinks từ sheet data
  const extractHyperlinks = (sheet) => {
    // Mảng lưu trữ tất cả hyperlinks tìm thấy
    const allLinks = [];
    
    // Kiểm tra nếu sheet có trường hyperlinks
    if (sheet.hyperlinks && Array.isArray(sheet.hyperlinks)) {
      // Thêm tất cả hyperlinks vào mảng
      allLinks.push(...sheet.hyperlinks);
      
      // Tạo các bản sao với định dạng khác để tăng khả năng tìm kiếm
      sheet.hyperlinks.forEach(link => {
        // Đảm bảo link có cả row và col
        if (link.row !== undefined && link.col !== undefined) {
          // Tạo bản sao với rowIndex và colIndex (một số API trả về dạng này)
          allLinks.push({
            ...link,
            rowIndex: link.row,
            colIndex: link.col
          });
          
          // Tạo bản sao với key (một số API trả về dạng này)
          allLinks.push({
            ...link,
            key: `${link.row},${link.col}`
          });
          
          // Thêm bản sao với row và col dạng số (để xử lý trường hợp row/col là chuỗi)
          allLinks.push({
            ...link,
            row: Number(link.row),
            col: Number(link.col)
          });
        }
      });
    }
    
    // Kiểm tra nếu sheet có trường links
    if (sheet.links && Array.isArray(sheet.links)) {
      allLinks.push(...sheet.links);
    }
    
    // Kiểm tra nếu sheet có trường hyperlinkMap
    if (sheet.hyperlinkMap && typeof sheet.hyperlinkMap === 'object') {
      Object.entries(sheet.hyperlinkMap).forEach(([key, url]) => {
        allLinks.push({ key, url });
      });
    }
    
    // Kiểm tra nếu sheet có trường data với hyperlinks
    if (sheet.data && Array.isArray(sheet.data) && sheet.data.length > 0) {
      sheet.data.forEach(dataObj => {
        if (dataObj.hyperlinks && Array.isArray(dataObj.hyperlinks)) {
          allLinks.push(...dataObj.hyperlinks);
        }
      });
    }
    
    // Kiểm tra nếu sheet có trường htmlData với hyperlinks
    if (sheet.htmlData && typeof sheet.htmlData === 'string') {
      // Tìm tất cả các thẻ <a> trong htmlData
      const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/g;
      let match;
      while ((match = linkRegex.exec(sheet.htmlData)) !== null) {
        const url = match[1];
        const text = match[2].replace(/<[^>]*>/g, ''); // Loại bỏ HTML tags
        allLinks.push({ url, text });
      }
    }
    
    // Kiểm tra nếu sheet có trường optimizedHtmlData với hyperlinks
    if (sheet.optimizedHtmlData && typeof sheet.optimizedHtmlData === 'string') {
      // Tìm tất cả các thẻ <a> trong optimizedHtmlData
      const linkRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/g;
      let match;
      while ((match = linkRegex.exec(sheet.optimizedHtmlData)) !== null) {
        const url = match[1];
        const text = match[2].replace(/<[^>]*>/g, ''); // Loại bỏ HTML tags
        allLinks.push({ url, text });
      }
    }
    
    // Kiểm tra nếu sheet có trường values (mảng 2 chiều)
    if (sheet.values && Array.isArray(sheet.values)) {
      // Tạo bản đồ các ô có thể chứa URL
      sheet.values.forEach((row, rowIdx) => {
        if (Array.isArray(row)) {
          row.forEach((cell, colIdx) => {
            if (typeof cell === 'string' && (
              cell.startsWith('http://') || 
              cell.startsWith('https://') || 
              cell.startsWith('www.')
            )) {
              allLinks.push({
                row: rowIdx + 1, // Chuyển từ 0-based sang 1-based
                col: colIdx,
                rowIndex: rowIdx + 1,
                colIndex: colIdx,
                url: cell,
                text: cell
              });
            }
          });
        }
      });
    }
    
    return allLinks;
  };

  // Hàm kiểm tra xem một chuỗi có chứa URL không
  const extractUrlFromText = (text) => {
    if (!text || typeof text !== 'string') return null;
    
    // Regex để tìm URL trong văn bản
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/i;
    const match = text.match(urlRegex);
    
    if (match) {
      let url = match[0];
      // Thêm http:// nếu URL bắt đầu bằng www.
      if (url.startsWith('www.')) {
        url = 'http://' + url;
      }
      return url;
    }
    
    return null;
  };

  // Hàm lấy URL liên kết từ ô trong bảng
  const getCellLink = (cell, cellData, rowIndex, cellIndex, useSheetData) => {
    if (useSheetData) {
      // Lấy liên kết từ sheetsData (hyperlinks)
      if (course.sheetsData && course.sheetsData[activeSheet]) {
        // Trích xuất tất cả hyperlinks từ sheet
        const allLinks = extractHyperlinks(course.sheetsData[activeSheet]);
        
        if (allLinks.length > 0) {
          // Tìm chính xác theo row và col (cấu trúc mới)
          const hyperlinkByRowCol = allLinks.find(h => 
            (h.row === rowIndex && h.col === cellIndex)
          );
          
          if (hyperlinkByRowCol && hyperlinkByRowCol.url) {
            return hyperlinkByRowCol.url;
          }
          
          // Tìm theo row và col (có thể là số hoặc chuỗi)
          const hyperlinkByRowColStr = allLinks.find(h => 
            (String(h.row) === String(rowIndex) && String(h.col) === String(cellIndex))
          );
          
          if (hyperlinkByRowColStr && hyperlinkByRowColStr.url) {
            return hyperlinkByRowColStr.url;
          }
          
          // Tìm theo row và col (index bắt đầu từ 0)
          const hyperlinkByRowColZeroBased = allLinks.find(h => 
            (h.row === rowIndex-1 && h.col === cellIndex-1)
          );
          
          if (hyperlinkByRowColZeroBased && hyperlinkByRowColZeroBased.url) {
            return hyperlinkByRowColZeroBased.url;
          }
          
          // Tạo các khóa tìm kiếm khác nhau (các định dạng có thể có)
          const possibleKeys = [
            `${rowIndex},${cellIndex}`,
            `${rowIndex-1},${cellIndex-1}`, // Có thể index bắt đầu từ 0
            `R${rowIndex}C${cellIndex}`,
            `R${rowIndex-1}C${cellIndex-1}`
          ];
          
          // Tìm theo key
          for (const key of possibleKeys) {
            const hyperlink = allLinks.find(h => h.key === key);
            if (hyperlink && hyperlink.url) {
              return hyperlink.url;
            }
          }
          
          // Tìm theo vị trí (cấu trúc cũ)
          const hyperlinkByPosition = allLinks.find(h => 
            (h.rowIndex === rowIndex && h.colIndex === cellIndex) ||
            (h.rowIndex === rowIndex-1 && h.colIndex === cellIndex-1)
          );
          
          if (hyperlinkByPosition && hyperlinkByPosition.url) {
            return hyperlinkByPosition.url;
          }
          
          // Tìm theo nội dung text
          if (cell) {
            const cellStr = String(cell);
            const hyperlinkByText = allLinks.find(h => 
              (h.text && (h.text === cellStr || cellStr.includes(h.text) || (h.text && h.text.includes(cellStr))))
            );
            
            if (hyperlinkByText && hyperlinkByText.url) {
              return hyperlinkByText.url;
            }
          }
        }
      }
      
      // Kiểm tra xem cell có phải là URL không hoặc có chứa URL không
      if (cell?.formattedValue) {
        const extractedUrl = extractUrlFromText(cell.formattedValue);
        if (extractedUrl) return extractedUrl;
      }
      
      return null;
    }
  };

  // Hàm xử lý khi click vào link
  const handleLinkClick = async (url, title) => {
    if (!url) return;
    
    // Giải mã URL proxy
    const { url: decodedUrl, isProxy, originalUrl } = getUpdatedUrl(url);
    
    if (!decodedUrl) return;
    
    setProcessingLink(true);
    
    try {
      // Xử lý theo loại link
      if (isYoutubeLink(decodedUrl)) {
        // Kiểm tra xem có phải playlist không
        if (isYoutubePlaylist(decodedUrl)) {
          const playlistId = extractYoutubePlaylistId(decodedUrl);
          const videoId = extractVideoIdFromPlaylist(decodedUrl);
          
          if (playlistId) {
            setYoutubePlaylistModal({
              isOpen: true,
              playlistId,
              videoId: videoId || '',
              title: title || 'YouTube Playlist'
            });
          }
        } else {
          // Link video đơn lẻ
          const videoId = extractYoutubeId(decodedUrl);
          
          if (videoId) {
            setYoutubeModal({
              isOpen: true,
              videoId,
              title: title || 'YouTube Video'
            });
          } else {
            // Thử lấy videoId từ URL gốc nếu decode không thành công
            const originalVideoId = extractYoutubeId(originalUrl);
            
            if (originalVideoId) {
              setYoutubeModal({
                isOpen: true,
                videoId: originalVideoId,
                title: title || 'YouTube Video'
              });
            } else {
              // Nếu không phải YouTube hoặc không có videoId, mở trong tab mới
              window.open(decodedUrl, '_blank');
            }
          }
        }
      } else if (isPdfLink(decodedUrl)) {
        // Mở PDF trong tab mới thay vì modal
        window.open(decodedUrl, '_blank');
      } else if (isGoogleDriveLink(decodedUrl)) {
        // Mở tất cả các liên kết Google Drive trong tab mới
        window.open(decodedUrl, '_blank');
      } else {
        // Kiểm tra URL gốc nếu decoded URL không phải YouTube
        if (isYoutubeLink(originalUrl)) {
          const videoId = extractYoutubeId(originalUrl);
          
          if (videoId) {
            setYoutubeModal({
              isOpen: true,
              videoId,
              title: title || 'YouTube Video'
            });
          } else {
            // Nếu không phải YouTube, mở trong tab mới
            window.open(decodedUrl || originalUrl, '_blank');
          }
        } else {
          // Mở tất cả các liên kết khác trong tab mới
          window.open(decodedUrl || originalUrl, '_blank');
        }
      }
    } catch (error) {
      console.error('Lỗi khi xử lý link:', error);
      alert(`Không thể mở liên kết: ${error.message}`);
      // Nếu có lỗi, vẫn cố gắng mở liên kết trong tab mới
      try {
        window.open(decodedUrl || originalUrl || url, '_blank');
      } catch (e) {
        // Bỏ qua lỗi nếu không thể mở
      }
    } finally {
      setProcessingLink(false);
    }
  };

  // Hàm đăng ký khóa học - chỉ hiển thị thông báo
  const enrollCourse = async () => {
    alert('Chỉ quản trị viên mới có thể đăng ký khóa học cho người dùng. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
  };

  // Tải thông tin khóa học khi component được tạo
  useEffect(() => {
    fetchCourseDetail();
  }, [id]);

  // Set sheet đầu tiên nếu có dữ liệu sheets
  useEffect(() => {
    if (course?.originalData?.sheets && course.originalData.sheets.length > 0) {
      setActiveSheet(0);
    }
  }, [course]);

  // Điều chỉnh kích thước cột dựa trên nội dung
  useEffect(() => {
    setTimeout(() => {
      const adjustColumnWidths = () => {
        const contentCells = document.querySelectorAll('.column-content');
        
        contentCells.forEach(cell => {
          const textLength = cell.textContent?.trim().length || 0;
          
          if (textLength < 30) {
            cell.style.width = 'fit-content';
            cell.style.minWidth = '100px';
            cell.style.maxWidth = '150px';
          } else if (textLength < 100) {
            cell.style.width = 'fit-content';
            cell.style.minWidth = '150px';
            cell.style.maxWidth = '250px';
          } else {
            cell.style.width = 'auto';
            cell.style.minWidth = '200px';
            cell.style.maxWidth = '350px';
          }
        });
      };
      
      adjustColumnWidths();
    }, 100);
  }, [activeSheet, course]);

  // Hàm chuyển đổi số ngày Excel thành Date
  const excelSerialDateToJSDate = (serialDate) => {
    try {
      // Excel bắt đầu từ 1/1/1900, nhưng có lỗi tính năm nhuận nên trừ đi 1
      // Nếu serialDate < 60, không cần điều chỉnh
      // Nếu serialDate >= 60, cần trừ đi 1 để bù cho lỗi năm nhuận 1900 của Excel
      const adjustedSerialDate = serialDate >= 60 ? serialDate - 1 : serialDate;
      
      // Số ngày tính từ 1/1/1970 (Unix epoch)
      const utc_days = Math.floor(adjustedSerialDate - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      
      // Đảm bảo múi giờ địa phương
      const offset = date_info.getTimezoneOffset();
      return new Date(date_info.getTime() + (offset * 60 * 1000));
    } catch (error) {
      console.error('Lỗi chuyển đổi ngày Excel:', error);
      return new Date(); // Trả về ngày hiện tại nếu có lỗi
    }
  };

  // Hàm format ngày tháng
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    
    // Đảm bảo dateStr là chuỗi
    const strValue = String(dateStr).trim();
    
    // Kiểm tra nếu là số ngày kiểu Excel (số nguyên)
    if (/^\d+$/.test(strValue)) {
      try {
        const numValue = parseInt(strValue);
        // Số ngày Excel thường > 1000 (tương ứng với năm >1902)
        if (numValue > 1000) {
          const date = excelSerialDateToJSDate(numValue);
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear();
          // Kiểm tra năm hợp lý (để tránh chuyển đổi nhầm các số khác)
          if (year >= 1900 && year <= 2100) {
            return (
              <>
                <div className="font-medium">{day}/{month}</div>
                <div className="text-xs opacity-80">{year}</div>
              </>
            );
          }
        }
      } catch (error) {
        console.error('Lỗi chuyển đổi ngày:', error);
      }
    }

    // Xử lý định dạng dd/mm/yyyy đã được định dạng từ getCellValue hoặc từ dữ liệu gốc
    const parts = strValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (parts) {
      return (
        <>
          <div className="font-medium">{parts[1]}/{parts[2]}</div>
          <div className="text-xs opacity-80">{parts[3]}</div>
        </>
      );
    }

    return strValue;
  };

  // Hàm xử lý và thay thế link drive cũ bằng link mới từ processedDriveFiles
  const getProcessedDriveUrl = (originalUrl) => {
    if (!originalUrl) {
      return { url: originalUrl, isProcessed: false };
    }
    
    // Kiểm tra xem processedDriveFiles ở đâu trong cấu trúc dữ liệu
    const processedFiles = course?.processedDriveFiles || [];
    
    if (processedFiles.length === 0) {
      return { url: originalUrl, isProcessed: false };
    }

    // Tìm trong danh sách các file đã xử lý
    const processedFile = processedFiles.find(file => 
      file.originalUrl === originalUrl && file.processedUrl
    );

    if (processedFile) {
      return { url: processedFile.processedUrl, isProcessed: true };
    }

    return { url: originalUrl, isProcessed: false };
  };

  // Thử lại khi gặp lỗi
  const handleRetry = () => {
    // Xóa cache khi thử lại để đảm bảo lấy dữ liệu mới
    try {
      localStorage.removeItem(`course-${id}`);
      setCacheStatus('cleared');
      // Hiển thị thông báo đang tải lại
      setLoading(true);
      setError(null);
      
      // Sử dụng hàm refreshCourseData để tải lại dữ liệu
      refreshCourseData(true);
    } catch (error) {
      // Xử lý lỗi im lặng và vẫn tiếp tục fetch
      refreshCourseData(true);
    }
  };

  // Hàm trích xuất YouTube video ID từ URL
  const extractYoutubeId = (url) => {
    if (!url) return null;
    
    // Hỗ trợ nhiều định dạng URL YouTube
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    return (match && match[2].length === 11) ? match[2] : null;
  };
  
  // Hàm trích xuất YouTube playlist ID từ URL
  const extractYoutubePlaylistId = (url) => {
    if (!url) return null;
    
    // Tìm list= trong URL và lấy ID sau nó
    const listMatch = url.match(/[?&]list=([^&#]*)/);
    if (listMatch && listMatch[1]) {
      return listMatch[1];
    }
    
    // Nếu URL có định dạng /playlist/{id}
    const playlistPathMatch = url.match(/\/playlist\/([^/?&#]*)/);
    if (playlistPathMatch && playlistPathMatch[1]) {
      return playlistPathMatch[1];
    }
    
    return null;
  };
  
  // Hàm trích xuất video ID từ URL playlist (nếu có)
  const extractVideoIdFromPlaylist = (url) => {
    if (!url) return null;
    
    // Nếu là URL watch với tham số list và v
    if (url.includes('youtube.com/watch') && url.includes('list=') && url.includes('v=')) {
      const videoIdMatch = url.match(/v=([^&]*)/);
      return videoIdMatch && videoIdMatch[1] ? videoIdMatch[1] : null;
    }
    
    return null;
  };
  
  // Hàm kiểm tra xem URL có phải là YouTube link không
  const isYoutubeLink = (url) => {
    if (!url) return false;
    return url.includes('youtube.com') || url.includes('youtu.be');
  };
  
  // Hàm kiểm tra xem URL có phải là YouTube playlist không
  const isYoutubePlaylist = (url) => {
    if (!url) return false;
    
    // Kiểm tra các mẫu URL phổ biến của playlist
    if (url.includes('youtube.com/playlist?list=')) {
      return true;
    }
    
    // Kiểm tra URL có chứa tham số list= và không phải là index=
    if ((url.includes('youtube.com/watch') || url.includes('youtu.be/')) && 
        url.includes('list=') && 
        !url.includes('index=')) {
      return true;
    }
    
    // Kiểm tra URL có chứa playlist trong đường dẫn
    if (url.match(/youtube\.com\/(.*?)playlist/)) {
      return true;
    }
    
    return false;
  };
  
  // Hàm kiểm tra xem URL có phải là PDF không
  const isPdfLink = (url) => {
    if (!url) return false;
    return url.toLowerCase().endsWith('.pdf');
  };
  
  // Hàm kiểm tra xem URL có phải là Google Drive link không
  const isGoogleDriveLink = (url) => {
    if (!url) return false;
    return url.includes('drive.google.com') || url.includes('docs.google.com');
  };

  // Hàm kiểm tra xem URL có phải là thư mục Google Drive không
  const isGoogleDriveFolder = (url) => {
    if (!url) return false;
    return url.includes('/folders/') || 
           url.includes('/drive/folders/') || 
           url.includes('/drive/u/0/folders/');
  };
  
  // Hàm mở modal YouTube
  const openYoutubeModal = (url, title = '') => {
    // Kiểm tra xem URL có phải là playlist không
    if (isYoutubePlaylist(url)) {
      const playlistId = extractYoutubePlaylistId(url);
      const videoId = extractVideoIdFromPlaylist(url);
      
      if (playlistId) {
        setYoutubePlaylistModal({ 
          isOpen: true, 
          playlistId, 
          videoId, 
          title 
        });
        return;
      }
    }
    
    // Xử lý như video đơn nếu không phải playlist
    const videoId = extractYoutubeId(url);
    if (videoId) {
      setYoutubeModal({ isOpen: true, videoId, title });
    } else {
      // Nếu không phải YouTube link, mở URL bình thường
      window.open(url, '_blank');
    }
  };
  
  // Hàm mở modal YouTube Playlist
  const openYoutubePlaylistModal = (playlistId, videoId, title) => {
    setYoutubePlaylistModal({ 
      isOpen: true, 
      playlistId, 
      videoId, 
      title 
    });
  };
  
  // Hàm đóng modal YouTube
  const closeYoutubeModal = () => {
    setYoutubeModal({ isOpen: false, videoId: null, title: '' });
  };
  
  // Hàm đóng modal YouTube Playlist
  const closeYoutubePlaylistModal = () => {
    setYoutubePlaylistModal({ 
      isOpen: false, 
      playlistId: null, 
      videoId: null, 
      title: '' 
    });
  };

  // Hàm xử lý đóng hướng dẫn cuộn với hiệu ứng
  const handleCloseScrollGuide = () => {
    setHidingScrollGuide(true);
    setTimeout(() => {
      setShowScrollGuide(false);
      setHidingScrollGuide(false);
    }, 800); // Tăng thời gian để hiệu ứng mượt mà hơn
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 relative overflow-hidden">
          <div className="relative z-10">
          <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-lg text-gray-700 font-medium">Đang tải thông tin khóa học...</p>
              <p className="text-gray-500 text-sm">Vui lòng đợi trong giây lát</p>
              {cacheStatus === 'hit' && (
                <p className="text-xs text-indigo-600 mt-2">Đang tải từ bộ nhớ đệm...</p>
              )}
            </div>
          </div>
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 to-purple-600 animate-pulse"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 relative">
          <div className="bg-red-50 p-6 rounded-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center">
              <div className="flex-shrink-0 bg-red-100 rounded-full p-3 mr-4 mb-4 sm:mb-0">
                <ExclamationCircleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-800 mb-2">Đã xảy ra lỗi</h3>
                <div className="mt-2 text-sm text-red-700 mb-4">
                  <p>{error}</p>
                  {error.includes('ID khóa học không hợp lệ') && (
                    <p className="mt-2 text-gray-600">
                      ID khóa học không đúng định dạng hoặc không hợp lệ. Vui lòng kiểm tra lại đường dẫn hoặc quay lại danh sách khóa học.
                    </p>
                  )}
                  {error.includes('Bad Request') && (
                    <p className="mt-2 text-gray-600">
                      Yêu cầu không hợp lệ. Có thể ID khóa học không đúng định dạng hoặc có lỗi trong quá trình xử lý.
                    </p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={handleRetry}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200 shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Thử lại
                  </button>
                  <button
                    onClick={() => router.push('/khoa-hoc')}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 shadow-md"
                  >
                    <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
                    Quay lại danh sách
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 relative">
          <div className="text-center py-10">
            <div className="inline-block text-amber-500 mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Không tìm thấy khóa học</h2>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
            <button
              onClick={() => router.push('/khoa-hoc')}
              className="inline-flex items-center px-5 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 transition-all duration-200 shadow-md"
            >
              <ArrowLeftIcon className="-ml-0.5 mr-2 h-5 w-5" />
              Quay lại danh sách khóa học
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Kiểm tra quyền truy cập - nếu khóa học chưa đăng ký và người dùng không có quyền xem tất cả khóa học, hiển thị thông báo yêu cầu đăng ký
  if (!loading && course && permissionChecked && !course.isEnrolled && !course.canViewAllCourses) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Header với thông tin cơ bản của khóa học */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-6 md:p-8 relative">
            <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] opacity-10"></div>
            <button
              onClick={() => router.push('/khoa-hoc')}
              className="inline-flex items-center text-white hover:text-indigo-100 mb-4 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              <span className="text-sm font-medium">Quay lại danh sách</span>
            </button>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
              {course.name || 'Chi tiết khóa học'}
            </h1>
            <p className="text-indigo-100 text-base md:text-lg mb-4 max-w-3xl">
              {course.description || 'Khóa học chất lượng cao được thiết kế bởi các chuyên gia hàng đầu.'}
            </p>
            <div className="flex items-center text-white bg-white bg-opacity-20 rounded-lg px-4 py-2 inline-block">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="font-medium">Yêu cầu đăng ký</span>
            </div>
          </div>
          
          {/* Nội dung thông báo yêu cầu đăng ký */}
          <div className="p-6 md:p-8">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-yellow-800">Truy cập bị hạn chế</h3>
                  <p className="mt-2 text-yellow-700">
                    Vui lòng đăng nhập để truy cập khóa học.
                  </p>
                  <div className="mt-3">
                    <a
                      href="/login"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="-ml-0.5 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                      Đăng nhập
                    </a>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Thông tin khóa học */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Thông tin khóa học</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-5 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Tổng quan</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Khóa học chất lượng cao</span>
                    </li>
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Nội dung được cập nhật thường xuyên</span>
                    </li>
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Hỗ trợ từ giảng viên</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-5 rounded-lg">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Bạn sẽ học được gì</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Kiến thức chuyên sâu về chủ đề</span>
                    </li>
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Kỹ năng thực hành qua các bài tập</span>
                    </li>
                    <li className="flex items-start">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Chứng chỉ hoàn thành khóa học</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Nút quay lại */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => router.push('/khoa-hoc')}
                className="inline-flex items-center justify-center px-6 py-3 border border-indigo-600 rounded-lg text-base font-medium text-indigo-700 bg-white hover:bg-indigo-50 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Quay lại danh sách
              </button>
              <button 
                onClick={enrollCourse}
                className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-lg text-base font-medium text-white bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Thông tin đăng ký
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-2 sm:p-6">
      {/* Loading overlay khi đang xử lý link */}
      <LoadingOverlay isVisible={processingLink} message="Đang tải tài nguyên..." />
      
      <div className="mx-auto bg-white rounded-xl shadow-lg">
        {/* Tiêu đề và thông tin khóa học */}
        <div className="pt-6 px-4 sm:px-8 pb-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-indigo-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <button
                onClick={() => router.push('/khoa-hoc')}
                className="inline-flex items-center text-indigo-600 hover:text-indigo-800 mb-4 transition-colors"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-1" />
                <span className="text-sm font-medium">Quay lại</span>
              </button>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {course.name || 'Chi tiết khóa học'}
              </h1>
            </div>
            <div className="flex items-center space-x-3">
              {course.isEnrolled ? (
                <div className="flex items-center px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Đã đăng ký</span>
                </div>
              ) : course.canViewAllCourses ? (
                <div className="flex items-center px-4 py-2 bg-purple-100 text-purple-700 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  <span className="font-medium">Quyền xem tất cả</span>
                </div>
              ) : (
                <div className="flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Chưa đăng ký</span>
                </div>
              )}
              <button
                onClick={handleRetry}
                className="flex items-center px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                title="Làm mới dữ liệu"
                disabled={loading}
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className={`h-5 w-5 mr-1 ${loading ? 'animate-spin' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? 'Đang tải...' : 'Làm mới'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Dữ liệu khóa học */}
        {(course.sheetsData || course.originalData) && (
          <div className="">
            {/* Hiển thị dữ liệu dưới dạng bảng */}
            {(() => {
              const { sheets, usingSheetsData } = getSheetData();
              if (sheets.length === 0) return null;
              
              // Lấy dữ liệu của sheet hiện tại
              const { header, rows, hasRows } = getSheetRows(sheets[activeSheet], activeSheet, usingSheetsData);
              
              if (!hasRows) {
                return (
                  <div className="p-8 text-center text-gray-500">
                    Không có dữ liệu khóa học.
                  </div>
                );
              }

              return (
                <div className="mt-6 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {sheets.length > 1 && (
                    <div className="border-b border-gray-200 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
                      <h3 className="text-base font-medium text-gray-800 mb-3 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                        Chọn khóa học:
                      </h3>
                      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                          {sheets.map((sheet, index) => {
                            // Lấy số dòng
                            const { rows, hasRows } = getSheetRows(sheet, index, usingSheetsData);
                            const rowCount = usingSheetsData ? 
                              (rows.length - 1) || 0 : 
                              (hasRows ? (rows.length - 1) || 0 : 0);
                            
                            return (
                          <button
                            key={index}
                            onClick={() => setActiveSheet(index)}
                            className={`
                              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                              ${activeSheet === index 
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md' 
                                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                              }
                            `}
                          >
                            <div className="flex items-center">
                                  <span>{getSheetTitle(index, sheets)}</span>
                                <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                                  activeSheet === index ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                    {rowCount}
                                </span>
                            </div>
                          </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Hướng dẫn cuộn ngang cho mobile */}
                  {showScrollGuide && (
                    <div className={`scroll-guide md:hidden ${hidingScrollGuide ? 'hiding' : ''}`}>
                      <div className="scroll-guide-inner">
                        <div className="hand-icon">
                          <span></span>
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <div className="scroll-icon-container">
                          <div className="scroll-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                            </svg>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                            </svg>
                          </div>
                        </div>
                        <div className="scroll-text">Vuốt ngang để xem toàn bộ bảng</div>
                        <button 
                          className="scroll-close" 
                          onClick={handleCloseScrollGuide}
                          aria-label="Đóng hướng dẫn"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="relative overflow-x-auto shadow-md sm:rounded-lg border border-gray-200" 
                       onScroll={() => handleCloseScrollGuide()}>
                    <table className="min-w-full divide-y divide-gray-200 table-with-vertical-borders">
                      <thead>
                        <tr className="bg-gradient-to-r from-indigo-600 to-indigo-700">
                          {header.map((headerCell, headerIndex) => (
                            <th
                              key={headerIndex}
                              className={`
                                px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider
                                ${headerIndex === 0 ? 'bg-indigo-700' : ''}
                              `}
                            >
                              <div className="flex items-center space-x-1">
                                <span>
                                  {getCellValue(headerCell, usingSheetsData, headerIndex)}
                                </span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-gray-50">
                            {header.map((_, colIndex) => {
                              const cell = row[colIndex];
                              const cellValue = getCellValue(cell, usingSheetsData, colIndex);
                              
                              const originalUrl = getCellLink(
                                cell, 
                                row,
                                rowIndex,
                                colIndex,
                                usingSheetsData
                              );

                              return (
                                <td
                                  key={colIndex}
                                  className={`
                                    px-6 py-4 text-sm
                                    ${colIndex === 0 ? 'bg-white font-medium text-indigo-600' : 'text-gray-900'}
                                  `}
                                >
                                  {colIndex === 0 ? (
                                    // Cột đầu tiên - thường là ngày/buổi học
                                    <div className="text-center">
                                      {formatDate(cellValue)}
                                    </div>
                                  ) : originalUrl ? (
                                    // Các ô có link
                                    <button
                                      onClick={() => handleLinkClick(originalUrl, cellValue)}
                                      className="text-blue-600 hover:text-blue-800 hover:underline flex items-center space-x-1"
                                    >
                                      <span>
                                        {cellValue}
                                      </span>
                                    </button>
                                  ) : cellValue ? ( // Chỉ hiển thị span nếu có giá trị
                                    <span>
                                      {cellValue}
                                    </span>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
        
        {/* YouTube Modal */}
        {youtubeModal.isOpen && (
          <YouTubeModal
            isOpen={youtubeModal.isOpen}
            onClose={closeYoutubeModal}
            videoId={youtubeModal.videoId}
            title={youtubeModal.title}
          />
        )}
        
        {/* YouTube Playlist Modal */}
        {youtubePlaylistModal.isOpen && (
          <YouTubePlaylistModal
            isOpen={youtubePlaylistModal.isOpen}
            onClose={closeYoutubePlaylistModal}
            playlistId={youtubePlaylistModal.playlistId}
            videoId={youtubePlaylistModal.videoId}
            title={youtubePlaylistModal.title}
          />
        )}

        {/* Footer */}
        <div className="mt-6 border-t border-gray-200 pt-6 pb-2 px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm text-gray-500">
            <div className="mb-4 sm:mb-0">
              <p>© {new Date().getFullYear()} Khoá học 6.0. Hệ thống quản lý học tập.</p>
            </div>
            <div className="flex space-x-4">
              <button onClick={() => router.push('/khoa-hoc')} className="text-indigo-600 hover:text-indigo-800 transition-colors">
                Danh sách khóa học
              </button>
              <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="text-indigo-600 hover:text-indigo-800 transition-colors">
                Lên đầu trang
              </button>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        .word-break-all {
          word-break: break-all;
        }
        .word-wrap-breakword {
          word-wrap: break-word;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        /* Thêm thanh cột dọc */
        .table-with-vertical-borders th,
        .table-with-vertical-borders td {
          padding: 0.75rem 1rem;
          text-align: left;
          border-right: 1px solid #e5e7eb;
        }
        .table-with-vertical-borders th:last-child,
        .table-with-vertical-borders td:last-child {
          border-right: none;
        }
        th:first-child, td:first-child {
          font-weight: 500;
          background-color: #f9fafb;
          border-right: 2px solid #e5e7eb;
        }
        .overflow-x-auto {
          overflow-x: auto;
          scrollbar-width: thin;
        }
        .overflow-x-auto::-webkit-scrollbar {
          height: 8px;
        }
        .overflow-x-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        .overflow-x-auto::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 20px;
        }
        tr:hover {
          background-color: #f3f4f6;
        }
        tr {
          border-bottom: 1px solid #e5e7eb;
        }
        @media (max-width: 640px) {
          th, td {
            padding: 0.5rem;
          }
        }
        
        /* Hướng dẫn cuộn ngang */
        .scroll-guide {
          position: relative;
          padding: 1rem;
          background: linear-gradient(90deg, rgba(79, 70, 229, 0.15) 0%, rgba(99, 102, 241, 0.25) 100%);
          border-bottom: 2px solid rgba(79, 70, 229, 0.3);
          animation: fadeIn 0.5s ease-out, pulse 2s infinite;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15);
          transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), 
                     max-height 0.8s cubic-bezier(0.4, 0, 0.2, 1), 
                     padding 0.8s cubic-bezier(0.4, 0, 0.2, 1),
                     margin 0.8s cubic-bezier(0.4, 0, 0.2, 1),
                     transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
          max-height: 120px;
          overflow: hidden;
          opacity: 1;
          transform: translateY(0) scale(1);
          will-change: transform, opacity, max-height;
        }
        
        /* Hiệu ứng biến mất từ từ */
        .scroll-guide.hiding {
          opacity: 0;
          max-height: 0;
          padding-top: 0;
          padding-bottom: 0;
          margin-top: 0;
          margin-bottom: 0;
          transform: translateY(-15px) scale(0.97);
          pointer-events: none;
          border-bottom-width: 0;
        }
        
        .scroll-guide-inner {
          transition: opacity 0.4s ease;
          opacity: 1;
        }
        
        .scroll-guide.hiding .scroll-guide-inner {
          opacity: 0;
        }
        
        .scroll-icon-container {
          position: relative;
          overflow: hidden;
          width: 60px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .scroll-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #4f46e5;
          font-weight: bold;
          animation: swipeAcross 2s infinite;
          transform-origin: center;
        }
        
        /* Hiệu ứng bàn tay vuốt */
        .hand-icon {
          position: relative;
          width: 24px;
          height: 24px;
        }
        
        .hand-icon span {
          position: absolute;
          left: 0;
          top: 0;
          width: 24px;
          height: 24px;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%234f46e5' viewBox='0 0 24 24'%3E%3Cpath d='M9.5 11c.3 0 .5-.2.5-.5V6.5c0-.3-.2-.5-.5-.5s-.5.2-.5.5V10.5c0 .3.2.5.5.5zm5-2c.3 0 .5-.2.5-.5V6.5c0-.3-.2-.5-.5-.5s-.5.2-.5.5V8.5c0 .3.2.5.5.5zm-2 0c.3 0 .5-.2.5-.5V4.5c0-.3-.2-.5-.5-.5s-.5.2-.5.5V8.5c0 .3.2.5.5.5zm-6 0c.3 0 .5-.2.5-.5V8c0-.3-.2-.5-.5-.5s-.5.2-.5.5v.5c0 .3.2.5.5.5zm13 1c0-2.2-1.8-4-4-4h-3V5c0-2.8-2.2-5-5-5S2.5 2.2 2.5 5v10.5c0 4.1 3.4 7.5 7.5 7.5h.5c2 0 3.9-.8 5.3-2.2l3.1-3.1c.2-.2.1-.6-.2-.6h-1.6c-1.1 0-1.7-.6-1.7-1.7v-4.1l2.7-1.3c.2-.1.4-.4.4-.6 0-.6-.4-1-1-1z'/%3E%3C/svg%3E");
          background-size: contain;
          animation: handFade 2s infinite;
          opacity: 0;
        }
        
        .hand-icon span:nth-child(1) {
          animation-delay: 0s;
        }
        
        .hand-icon span:nth-child(2) {
          animation-delay: 0.5s;
          transform: translateX(8px);
        }
        
        .hand-icon span:nth-child(3) {
          animation-delay: 1s;
          transform: translateX(16px);
        }
        
        .hand-icon span:nth-child(4) {
          animation-delay: 1.5s;
          transform: translateX(24px);
        }
        
        .scroll-text {
          font-size: 0.95rem;
          font-weight: 600;
          color: #4338ca;
          text-shadow: 0 0 5px rgba(255, 255, 255, 0.7);
          letter-spacing: 0.01em;
          animation: glow 2s infinite;
        }
        
        .scroll-close {
          position: absolute;
          right: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2rem;
          height: 2rem;
          border-radius: 9999px;
          background-color: rgba(79, 70, 229, 0.15);
          color: #4f46e5;
          border: 1px solid rgba(79, 70, 229, 0.3);
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .scroll-close:hover {
          background-color: rgba(79, 70, 229, 0.25);
          transform: translateY(-50%) scale(1.05);
        }
        
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.4);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(79, 70, 229, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(79, 70, 229, 0);
          }
        }
        
        @keyframes swipeAcross {
          0%, 100% {
            transform: translateX(-10px);
          }
          50% {
            transform: translateX(10px);
          }
        }
        
        @keyframes handFade {
          0% {
            opacity: 0;
            transform: translateX(0px) scale(0.9);
          }
          20% {
            opacity: 1;
            transform: translateX(8px) scale(1);
          }
          80% {
            opacity: 1;
            transform: translateX(24px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(32px) scale(0.9);
          }
        }
        
        @keyframes glow {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
