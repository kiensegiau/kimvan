'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';

export default function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        setLoading(true);
        const decodedId = decodeURIComponent(id);
        console.log('Đang tìm kiếm khóa học với ID đã giải mã:', decodedId);
        
        // Sử dụng API của chúng ta làm trung gian kết nối đến kimvan.id.vn
        const apiUrl = `/api/spreadsheets/${decodedId}`;
        console.log('Đang kết nối qua API của chúng ta:', apiUrl);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Log toàn bộ dữ liệu để kiểm tra
        console.log('Dữ liệu khóa học đầy đủ:', data);
        
        // Thêm log chi tiết định dạng gốc
        console.log('Dữ liệu chi tiết với định dạng:', JSON.stringify(data, null, 2));
        
        // Xử lý metadata của khóa học (nếu có)
        let courseMetadata = {};
        if (data.metadata) {
          courseMetadata = data.metadata;
          console.log('Metadata khóa học:', courseMetadata);
        }
        
        // Tạo thông tin cơ bản cho khóa học từ ID
        let courseName = "Khóa học Full Combo 2K8";
        
        // Nếu có dữ liệu sheets và có thông tin về tên
        if (data.sheets && data.sheets[0] && data.sheets[0].properties) {
          courseName = data.sheets[0].properties.title || courseName;
        }
        
        // Tạo đối tượng khóa học
        setCourse({
          id: decodedId,
          name: courseName,
          details: data,
          metadata: courseMetadata,
        });
        
        // Xử lý các phần (sections) trong khóa học
        if (data.sheets && data.sheets.length > 0) {
          const sectionsData = data.sheets.map((sheet, index) => {
            return {
              id: index,
              title: sheet.properties?.title || `Phần ${index + 1}`,
              lessons: [] // Sẽ được điền sau
            };
          });
          
          setSections(sectionsData);
          
          // Xử lý dữ liệu bài học từ sheet đầu tiên
          processSheetData(data.sheets[0], 0, decodedId);
        }
        
        console.log('Đã tải dữ liệu khóa học thành công:', decodedId);
        
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu khóa học:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCourseData();
    }
  }, [id]);
  
  // Hàm xử lý dữ liệu từ một sheet cụ thể
  const processSheetData = (sheet, sectionIndex, decodedId) => {
    if (!sheet || !sheet.data || !sheet.data[0] || !sheet.data[0].rowData) {
      console.error('Dữ liệu sheet không hợp lệ', sheet);
      return [];
    }
    
    // Log toàn bộ dữ liệu sheet
    console.log(`Xử lý sheet ${sectionIndex} với tên:`, sheet.properties?.title);
    console.log('Toàn bộ dữ liệu sheet:', sheet);
    
    const rowData = sheet.data[0].rowData;
    
    // Tìm hàng tiêu đề 
    let headerRowIndex = -1;
    
    // Lưu lại mọi thông tin về sheet
    const sheetMetadata = {
      title: sheet.properties?.title || `Phần ${sectionIndex + 1}`,
      sheetId: sheet.properties?.sheetId,
      gridProperties: sheet.properties?.gridProperties,
      hidden: sheet.properties?.hidden,
      tabColor: sheet.properties?.tabColor,
      additionalProperties: {} // Lưu các thuộc tính khác
    };
    
    // Thu thập mọi thuộc tính khác có thể có
    for (const key in sheet.properties) {
      if (!['title', 'sheetId', 'gridProperties', 'hidden', 'tabColor'].includes(key)) {
        sheetMetadata.additionalProperties[key] = sheet.properties[key];
      }
    }
    
    // Tìm hàng tiêu đề bằng nhiều cách khác nhau
    for (let i = 0; i < Math.min(20, rowData.length); i++) {
      const row = rowData[i];
      if (!row || !row.values) continue;
      
      const headerCells = row.values.map(cell => cell?.formattedValue?.toString().toUpperCase() || '');
      const headerText = headerCells.join('|');
      
      // Log để kiểm tra
      console.log(`Hàng ${i}:`, headerText);
      
      // Kiểm tra nhiều mẫu tiêu đề có thể có
      const possibleHeaderPatterns = [
        // Mẫu chuẩn
        ['STT', 'NGÀY', 'TÊN', 'LIVE', 'TÀI LIỆU', 'BTVN'],
        // Mẫu khác có thể có
        ['STT', 'THỜI GIAN', 'NỘI DUNG', 'VIDEO', 'TÀI LIỆU', 'BÀI TẬP'],
        ['STT', 'NGÀY', 'BÀI', 'LINK', 'DOCUMENT', 'HOMEWORK'],
        ['#', 'DATE', 'LESSON', 'VIDEO', 'MATERIAL', 'HOMEWORK']
      ];
      
      for (const pattern of possibleHeaderPatterns) {
        if (pattern.every(keyword => 
          headerCells.some(cell => cell.includes(keyword))
        )) {
          headerRowIndex = i;
          console.log(`Tìm thấy hàng tiêu đề tại ${i}:`, headerCells);
          break;
        }
      }
      
      // Nếu đã tìm thấy hàng tiêu đề thì thoát vòng lặp
      if (headerRowIndex !== -1) break;
    }
    
    // Nếu không tìm thấy hàng tiêu đề rõ ràng, thử tìm hàng có định dạng đặc biệt
    if (headerRowIndex === -1) {
      for (let i = 0; i < Math.min(20, rowData.length); i++) {
        const row = rowData[i];
        if (!row || !row.values) continue;
        
        // Kiểm tra xem hàng này có vẻ như là hàng tiêu đề không (ví dụ: định dạng đặc biệt)
        const hasSpecialFormatting = row.values.some(cell => 
          cell?.userEnteredFormat?.textFormat?.bold ||
          cell?.userEnteredFormat?.backgroundColor ||
          cell?.userEnteredFormat?.borders?.top?.style === 'SOLID'
        );
        
        const hasMultipleNonEmptyCells = row.values.filter(cell => 
          cell?.formattedValue?.toString().trim() !== ''
        ).length >= 3;
        
        if (hasSpecialFormatting && hasMultipleNonEmptyCells) {
          headerRowIndex = i;
          console.log(`Tìm thấy hàng tiêu đề bằng định dạng tại ${i}`);
          break;
        }
      }
    }
    
    // Nếu vẫn không tìm thấy, sử dụng hàng đầu tiên
    if (headerRowIndex === -1 && rowData.length > 0) {
      headerRowIndex = 0;
      console.log('Không tìm thấy hàng tiêu đề rõ ràng, sử dụng hàng đầu tiên');
    }
    
    // Nếu không có dữ liệu
    if (headerRowIndex === -1 || !rowData[headerRowIndex]?.values) {
      console.log('Không tìm thấy dữ liệu hợp lệ trong sheet');
      return [];
    }
    
    const headerRow = rowData[headerRowIndex].values || [];
    
    // Thu thập tất cả các tiêu đề cột có thể có
    const allColumnHeaders = headerRow.map((cell, idx) => ({
      index: idx,
      title: cell?.formattedValue || `Cột ${idx + 1}`,
      originalValue: cell?.formattedValue
    }));
    
    console.log('Tất cả tiêu đề cột:', allColumnHeaders);
    
    // Xác định các cột quan trọng, nhưng cũng thu thập tất cả các cột khác
    const sttIdx = findColumnIndex(headerRow, ['STT', 'TT', '#', 'NUMBER']);
    const dateIdx = findColumnIndex(headerRow, ['NGÀY', 'NGÀY HỌC', 'THỜI GIAN', 'DATE', 'TIME']);
    const titleIdx = findColumnIndex(headerRow, ['TÊN BÀI', 'NỘI DUNG', 'BÀI', 'LESSON', 'TITLE']);
    const liveIdx = findColumnIndex(headerRow, ['LIVE', 'VIDEO', 'STREAM', 'LINK VIDEO', 'VIDEO BÀI GIẢNG']);
    const docIdx = findColumnIndex(headerRow, ['TÀI LIỆU', 'DOCUMENT', 'DOC', 'MATERIAL', 'SLIDE']);
    const homeworkIdx = findColumnIndex(headerRow, ['BTVN', 'BÀI TẬP', 'HOMEWORK', 'EXERCISE', 'BÀI TẬP VỀ NHÀ']);
    
    // Tạo bản đồ tất cả các cột
    let columnMap = {
      STT: sttIdx,
      Date: dateIdx,
      Title: titleIdx,
      Live: liveIdx,
      TàiLiệu: docIdx,
      BTVN: homeworkIdx
    };
    
    // Thêm tất cả các cột khác vào bản đồ
    for (let i = 0; i < headerRow.length; i++) {
      const cell = headerRow[i];
      if (!cell) continue;
      
      const headerName = cell.formattedValue?.toString().trim() || `Column_${i}`;
      
      // Chỉ thêm nếu chưa có trong các cột chính
      if (![sttIdx, dateIdx, titleIdx, liveIdx, docIdx, homeworkIdx].includes(i)) {
        columnMap[headerName] = i;
        console.log(`Phát hiện cột bổ sung: ${headerName} tại vị trí ${i}`);
      }
    }
    
    console.log('Bản đồ tất cả các cột:', columnMap);
    
    // In ra tất cả các tiêu đề cột để kiểm tra
    if (headerRow.length > 0) {
      console.log('Tất cả các tiêu đề cột:', headerRow.map((cell, idx) => `${idx}: ${cell?.formattedValue || ''}`));
    }
    
    // Xử lý formattedValue để tìm các bài học
    const processedLessons = [];
    let validRowCount = 0;
    
    // Thêm phân tích hàng phụ đề
    let subHeaderRowIndex = -1;
    let hasSubHeader = false;
    let subHeaders = [];
    
    // Nếu đã tìm thấy hàng tiêu đề chính và có hàng tiếp theo
    if (headerRowIndex !== -1 && headerRowIndex + 1 < rowData.length) {
      const nextRow = rowData[headerRowIndex + 1];
      if (nextRow && nextRow.values) {
        // Kiểm tra xem có đủ ô trống để coi là hàng phụ đề không
        const emptyCellsCount = nextRow.values.filter(cell => 
          !cell || !cell.formattedValue || cell.formattedValue.toString().trim() === ''
        ).length;
        
        // Nếu có ít nhất một ô có dữ liệu
        if (emptyCellsCount < nextRow.values.length) {
          hasSubHeader = true;
          subHeaderRowIndex = headerRowIndex + 1;
          subHeaders = nextRow.values.map(cell => cell?.formattedValue || '');
          headerRowIndex = subHeaderRowIndex; // Cập nhật hàng tiêu đề để bỏ qua hàng phụ đề khi xử lý dữ liệu
          console.log('Phát hiện hàng phụ đề:', subHeaders);
        }
      }
    }
    
    for (let i = headerRowIndex + 1; i < rowData.length; i++) {
      const row = rowData[i];
      if (!row || !row.values) continue;
      
      // Kiểm tra xem hàng này có dữ liệu thực sự không
      const hasFormattedValues = row.values.some(cell => cell && typeof cell.formattedValue !== 'undefined');
      const hasLinks = row.values.some(cell => 
        cell && (cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink)
      );
      
      // Thu thập tất cả các giá trị và thuộc tính hữu ích của hàng
      const rowProperties = {
        hasFormattedValues,
        hasLinks,
        formattingInfo: {}
      };
      
      // Thu thập thông tin về định dạng của hàng
      for (let j = 0; j < row.values.length; j++) {
        const cell = row.values[j];
        if (!cell) continue;
        
        if (cell.userEnteredFormat) {
          rowProperties.formattingInfo[j] = {
            bold: cell.userEnteredFormat?.textFormat?.bold,
            italic: cell.userEnteredFormat?.textFormat?.italic,
            backgroundColor: cell.userEnteredFormat?.backgroundColor,
            borders: cell.userEnteredFormat?.borders,
            alignment: cell.userEnteredFormat?.horizontalAlignment
          };
        }
      }
      
      if (!hasFormattedValues && !hasLinks) continue;
      
      validRowCount++;
      
      // Lấy giá trị cơ bản từ các cột đã xác định
      const lessonData = {
        stt: sttIdx >= 0 && row.values[sttIdx] ? (row.values[sttIdx].formattedValue || '') : `${validRowCount}`,
        date: dateIdx >= 0 && row.values[dateIdx] ? (row.values[dateIdx].formattedValue || '') : '',
        title: titleIdx >= 0 && row.values[titleIdx] ? (row.values[titleIdx].formattedValue || '') : '',
        liveLink: '',
        documentLink: '',
        homeworkLink: '',
        hasContent: false,
        section: sectionIndex,
        rowIndex: i,
        // Lưu trữ tất cả dữ liệu bổ sung
        additionalData: {}
      };
      
      // Thu thập tất cả các giá trị khác trong hàng
      for (let j = 0; j < row.values.length; j++) {
        const cell = row.values[j];
        if (!cell) continue;
        
        // Bỏ qua các cột chính đã xử lý
        if (j === sttIdx || j === dateIdx || j === titleIdx || j === liveIdx || j === docIdx || j === homeworkIdx) {
          continue;
        }
        
        // Lưu mọi giá trị và thuộc tính vào dữ liệu bổ sung
        const columnName = (headerRow[j]?.formattedValue || `Column_${j}`).toString().trim();
        
        lessonData.additionalData[columnName] = {
          value: cell.formattedValue || '',
          link: cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink || '',
          formattingInfo: cell.userEnteredFormat,
          effectiveValue: cell.effectiveValue,
          userEnteredValue: cell.userEnteredValue
        };
        
        // Nếu ô này có liên kết, trích xuất và lưu dưới dạng trường riêng biệt
        if (cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink) {
          lessonData.additionalData[columnName].extractedLink = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
        }
      }
      
      // Nếu không có title nhưng có STT, sử dụng STT làm phần của title
      if (!lessonData.title && lessonData.stt) {
        lessonData.title = `Bài ${lessonData.stt}`;
      }
      
      // Nếu vẫn không có title, tìm bất kỳ ô nào có text dài nhất
      if (!lessonData.title) {
        // Tìm ô có nhiều văn bản nhất trong hàng
        let maxTextLength = 0;
        let maxTextColIndex = -1;
        
        for (let j = 0; j < row.values.length; j++) {
          const cell = row.values[j];
          if (cell && cell.formattedValue && typeof cell.formattedValue === 'string') {
            // Ưu tiên các cột có vị trí gần với cột tiêu đề đã biết
            if (j > 0 && j < 4) { // Thường các cột đầu chứa thông tin quan trọng
              if (cell.formattedValue.length > maxTextLength) {
                maxTextLength = cell.formattedValue.length;
                maxTextColIndex = j;
              }
            }
          }
        }
        
        if (maxTextColIndex >= 0) {
          lessonData.title = row.values[maxTextColIndex].formattedValue;
        } else {
          lessonData.title = `Bài học ${validRowCount}`;
        }
      }
      
      // Xử lý các liên kết
      if (liveIdx >= 0 && row.values[liveIdx]) {
        extractLink(row.values[liveIdx], 'live', lessonData, decodedId);
      }
      
      if (docIdx >= 0 && row.values[docIdx]) {
        extractLink(row.values[docIdx], 'doc', lessonData, decodedId);
      }
      
      if (homeworkIdx >= 0 && row.values[homeworkIdx]) {
        extractLink(row.values[homeworkIdx], 'homework', lessonData, decodedId);
      }
      
      // Nếu không tìm thấy liên kết từ các cột tiêu chuẩn, quét tất cả các cột khác
      if (!lessonData.hasContent) {
        for (let j = 0; j < row.values.length; j++) {
          // Bỏ qua các cột đã xử lý hoặc không quan trọng
          if (j === sttIdx || j === dateIdx || j === titleIdx) continue;
          
          const cell = row.values[j];
          if (!cell) continue;
          
          // Nếu ô này có liên kết
          if (cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink) {
            // Xác định loại liên kết dựa trên vị trí cột và nội dung
            if (j === liveIdx || (j > titleIdx && !lessonData.liveLink)) {
              extractLink(cell, 'live', lessonData, decodedId);
            } else if (j === docIdx || (j > liveIdx && !lessonData.documentLink)) {
              extractLink(cell, 'doc', lessonData, decodedId);
            } else if (j === homeworkIdx || (j > docIdx && !lessonData.homeworkLink)) {
              extractLink(cell, 'homework', lessonData, decodedId);
            }
          }
          // Nếu ô chỉ có văn bản (không phải -)
          else if (cell.formattedValue && cell.formattedValue !== '-') {
            const text = cell.formattedValue.toString().toLowerCase();
            
            // Dựa vào nội dung để xác định loại
            if ((text.includes('video') || text.includes('live')) && !lessonData.liveLink) {
              extractLink(cell, 'live', lessonData, decodedId);
            } else if ((text.includes('tài liệu') || text.includes('doc')) && !lessonData.documentLink) {
              extractLink(cell, 'doc', lessonData, decodedId);
            } else if ((text.includes('btvn') || text.includes('bài tập')) && !lessonData.homeworkLink) {
              extractLink(cell, 'homework', lessonData, decodedId);
            }
          }
        }
      }
      
      // Chỉ thêm vào mảng nếu có dữ liệu ý nghĩa
      if ((lessonData.title && lessonData.title.trim() !== '') || lessonData.hasContent || Object.keys(lessonData.additionalData).length > 0) {
        processedLessons.push(lessonData);
      }
    }
    
    console.log(`Đã tìm thấy ${validRowCount} hàng dữ liệu, xử lý được ${processedLessons.length} bài học`);
    console.log('Chi tiết 3 bài học đầu tiên:', processedLessons.slice(0, 3));
    
    // Sau khi xử lý xong, cập nhật state với thông tin phụ đề và chapter
    setSections(prevSections => {
      const newSections = [...prevSections];
      if (newSections[sectionIndex]) {
        newSections[sectionIndex].lessons = processedLessons;
        newSections[sectionIndex].metadata = sheetMetadata;
        newSections[sectionIndex].columnMap = columnMap;
        newSections[sectionIndex].allColumnHeaders = allColumnHeaders;
        newSections[sectionIndex].hasSubHeader = hasSubHeader;
        newSections[sectionIndex].subHeaders = subHeaders;
      }
      return newSections;
    });
    
    if (sectionIndex === activeSection) {
      setLessons(processedLessons);
    }
    
    return processedLessons;
  };
  
  // Hàm tìm vị trí cột dựa trên tiêu đề
  const findColumnIndex = (headerRow, possibleNames) => {
    // Log để debug tìm cột
    console.log('Tìm cột với từ khóa:', possibleNames);
    
    for (let i = 0; i < headerRow.length; i++) {
      const headerCell = headerRow[i];
      if (!headerCell) continue;
      
      const headerText = (headerCell.formattedValue || '').toString().toUpperCase();
      console.log(`Kiểm tra cột ${i}:`, headerText);
      
      // Tìm chính xác
      if (possibleNames.some(name => headerText === name.toUpperCase())) {
        console.log(`Tìm thấy cột ${possibleNames[0]} tại vị trí ${i} (khớp chính xác)`);
        return i;
      }
      
      // Tìm một phần
      if (possibleNames.some(name => headerText.includes(name.toUpperCase()))) {
        console.log(`Tìm thấy cột ${possibleNames[0]} tại vị trí ${i} (khớp một phần)`);
        return i;
      }
    }
    
    console.log(`Không tìm thấy cột ${possibleNames[0]}`);
    return -1; // Không tìm thấy
  };
  
  // Hàm trích xuất liên kết từ một ô
  const extractLink = (cell, type, lessonData, decodedId) => {
    if (!cell) return;
    
    // Log chi tiết về ô đang xử lý
    console.log(`Đang trích xuất liên kết ${type} từ ô:`, {
      formattedValue: cell.formattedValue,
      hasLink: !!cell.userEnteredFormat?.textFormat?.link?.uri,
      hasHyperlink: !!cell.hyperlink
    });
    
    // Trường hợp 1: Đã có URI trong textFormat
    if (cell.userEnteredFormat?.textFormat?.link?.uri) {
      const uri = cell.userEnteredFormat.textFormat.link.uri;
      console.log(`Tìm thấy URI trong textFormat: ${uri}`);
      
      if (type === 'live') lessonData.liveLink = uri;
      else if (type === 'doc') lessonData.documentLink = uri;
      else if (type === 'homework') lessonData.homeworkLink = uri;
      lessonData.hasContent = true;
      return;
    }
    
    // Trường hợp 2: Có hyperlink
    if (cell.hyperlink) {
      let url = cell.hyperlink;
      console.log(`Tìm thấy hyperlink: ${url}`);
      
      // Nếu là ID Drive, chuyển thành URL Drive đầy đủ
      if (!url.startsWith('http')) {
        url = `https://drive.google.com/open?id=${url}`;
      }
      
      if (type === 'live') lessonData.liveLink = url;
      else if (type === 'doc') lessonData.documentLink = url;
      else if (type === 'homework') lessonData.homeworkLink = url;
      lessonData.hasContent = true;
      return;
    }
    
    // Trường hợp 3: Chỉ có formattedValue (không phải dấu -)
    if (cell.formattedValue && cell.formattedValue !== '-') {
      console.log(`Tìm thấy formattedValue: ${cell.formattedValue}`);
      
      let url = '';
      let typeParam = '';
      
      if (type === 'live') {
        typeParam = 'LIVE';
        url = `/api/spreadsheets/${decodedId}/${typeParam}/${encodeURIComponent(lessonData.title || 'undefined')}/redirect`;
        lessonData.liveLink = url;
      } else if (type === 'doc') {
        typeParam = 'TÀI LIỆU';
        url = `/api/spreadsheets/${decodedId}/${typeParam}/${encodeURIComponent(lessonData.title || 'undefined')}/redirect`;
        lessonData.documentLink = url;
      } else if (type === 'homework') {
        typeParam = 'BTVN';
        url = `/api/spreadsheets/${decodedId}/${typeParam}/${encodeURIComponent(lessonData.title || 'undefined')}/redirect`;
        lessonData.homeworkLink = url;
      }
      
      lessonData.hasContent = true;
    }
  };
  
  // Hàm chuyển đổi giữa các phần
  const handleSectionChange = (sectionIndex) => {
    setActiveSection(sectionIndex);
    
    // Nếu đã có dữ liệu của phần này rồi thì hiển thị
    if (sections[sectionIndex] && sections[sectionIndex].lessons.length > 0) {
      setLessons(sections[sectionIndex].lessons);
    } 
    // Nếu chưa có dữ liệu thì tải
    else if (course && course.details && course.details.sheets && course.details.sheets[sectionIndex]) {
      processSheetData(course.details.sheets[sectionIndex], sectionIndex, course.id);
    }
  };

  // Hàm trích xuất môn học từ tên
  const extractSubject = (name) => {
    if (!name) return 'Khóa học';
    
    const subjects = ['VẬT LÝ', 'HÓA', 'TOÁN', 'TIẾNG ANH', 'SINH HỌC', 'SỬ', 'ĐỊA', 'GDCD'];
    
    for (const subject of subjects) {
      if (name.includes(subject)) {
        return subject;
      }
    }
    
    return 'Khóa học';
  };

  // Hàm lấy tên giáo viên từ tên khóa học
  const extractTeacher = (name) => {
    if (!name) return '';
    
    const parts = name.split('-');
    if (parts.length > 1) {
      return parts[1].trim();
    }
    
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-14 w-14 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent shadow-lg"></div>
          <p className="mt-5 text-lg font-medium text-gray-700">Đang tải thông tin khóa học...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-xl">
          <div className="text-red-600 text-5xl mb-5">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">Lỗi khi tải dữ liệu</h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-xl">
          <div className="text-yellow-600 text-5xl mb-5">🔍</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Không tìm thấy khóa học</h1>
          <p className="mb-6 text-gray-600">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  const subject = extractSubject(course.name);
  const teacher = extractTeacher(course.name);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/khoa-hoc" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Quay lại danh sách khóa học
          </Link>
        </div>
        
        <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-8 transition-all hover:shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 p-8 text-white relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white"></div>
              <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-white"></div>
            </div>
            
            <div className="relative z-10">
              <span className="inline-block text-sm font-medium bg-white bg-opacity-30 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm">
                {subject}
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold mt-4 mb-3 text-shadow">
                {course.name}
              </h1>
              
              {teacher && (
                <div className="mt-4 flex items-center">
                  <div className="bg-white bg-opacity-20 rounded-full h-12 w-12 flex items-center justify-center mr-3 shadow-md">
                    <span className="text-white text-xl">👨‍🏫</span>
                  </div>
                  <span className="text-white text-lg font-medium">
                    Giảng viên: {teacher}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6 sm:p-8">
            <div className="flex items-center mb-6">
              <div className="w-1.5 h-8 bg-indigo-600 rounded-r mr-3"></div>
              <h2 className="text-2xl font-bold text-gray-800">Nội dung khóa học</h2>
            </div>
            
            <p className="text-gray-600 mb-8 max-w-3xl">
              Dưới đây là danh sách các bài học trong khóa học này. Nhấn vào liên kết tương ứng để truy cập video bài giảng, tài liệu hoặc bài tập về nhà.
            </p>
            
            {/* Các nút truy cập nhanh */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              <a 
                href={`/api/spreadsheets/${course.id}/LIVE/2K8/redirect`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center p-5 border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 hover:border-red-200 transition-all shadow-sm hover:shadow-md"
              >
                <div className="bg-red-100 group-hover:bg-red-200 rounded-xl p-4 mr-4 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg group-hover:text-red-700 transition-colors">Video bài giảng</h3>
                  <p className="text-sm text-gray-500 group-hover:text-red-600 transition-colors">Xem tất cả video bài giảng</p>
                </div>
              </a>
              
              <a 
                href={`/api/spreadsheets/${course.id}/TÀI LIỆU/2K8/redirect`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center p-5 border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:border-blue-200 transition-all shadow-sm hover:shadow-md"
              >
                <div className="bg-blue-100 group-hover:bg-blue-200 rounded-xl p-4 mr-4 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg group-hover:text-blue-700 transition-colors">Tài liệu học tập</h3>
                  <p className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors">Tải tất cả tài liệu học tập</p>
                </div>
              </a>
              
              <a 
                href={`/api/spreadsheets/${course.id}/BTVN/2K8/redirect`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center p-5 border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 hover:border-green-200 transition-all shadow-sm hover:shadow-md"
              >
                <div className="bg-green-100 group-hover:bg-green-200 rounded-xl p-4 mr-4 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg group-hover:text-green-700 transition-colors">Bài tập về nhà</h3>
                  <p className="text-sm text-gray-500 group-hover:text-green-600 transition-colors">Tải bài tập về nhà và đáp án</p>
                </div>
              </a>
            </div>
            
            {/* Phần chọn section */}
            {sections.length > 1 && (
              <div className="mb-8">
                <div className="border-b border-gray-200 mb-4">
                  <nav className="flex space-x-2 overflow-x-auto pb-1">
                    {sections.map((section, index) => (
                      <button
                        key={index}
                        onClick={() => handleSectionChange(index)}
                        className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                          activeSection === index
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {section.title}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            )}
            
            {/* Bảng khóa học theo định dạng gốc */}
            {sections.length > 0 && activeSection < sections.length && sections[activeSection].lessons.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    {/* Hàng tiêu đề chính */}
                    <tr>
                      {sections[activeSection].columnMap && Object.entries(sections[activeSection].columnMap).map(([key, index], i) => (
                        <th 
                          key={i} 
                          className={`p-3 border text-center font-bold ${
                            key.includes('Chapter') ? 'bg-yellow-100' :
                            key.includes('STT') ? 'bg-yellow-100' :
                            key.includes('Nội dung') ? 'bg-yellow-100' :
                            key.includes('Bài giảng') ? 'bg-green-100' :
                            key.includes('Phụ đạo') ? 'bg-cyan-100' :
                            'bg-gray-50'
                          }`}
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                    
                    {/* Hàng tiêu đề phụ nếu cần */}
                    {sections[activeSection].hasSubHeader && (
                      <tr>
                        {sections[activeSection].columnMap && Object.entries(sections[activeSection].columnMap).map(([key, index], i) => (
                          <th 
                            key={i} 
                            className="p-3 border text-center font-bold bg-gray-50"
                          >
                            {sections[activeSection].subHeaders && sections[activeSection].subHeaders[index] || ''}
                          </th>
                        ))}
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {(() => {
                      // Xác định nếu có cột Chapter
                      const hasChapter = sections[activeSection].lessons.some(lesson => 
                        lesson.additionalData && Object.keys(lesson.additionalData).some(key => 
                          key.toLowerCase().includes('chapter')
                        )
                      );
                      
                      if (hasChapter) {
                        // Nhóm bài học theo chapter
                        const chapterGroups = {};
                        sections[activeSection].lessons.forEach(lesson => {
                          let chapterName = "Chưa phân loại";
                          // Tìm tên chapter trong dữ liệu bổ sung
                          if (lesson.additionalData) {
                            Object.entries(lesson.additionalData).forEach(([key, data]) => {
                              if (key.toLowerCase().includes('chapter') && data.value) {
                                chapterName = data.value;
                              }
                            });
                          }
                          
                          if (!chapterGroups[chapterName]) {
                            chapterGroups[chapterName] = [];
                          }
                          chapterGroups[chapterName].push(lesson);
                        });
                        
                        // Render từng nhóm chapter
                        return Object.entries(chapterGroups).map(([chapterName, lessons], chapterIndex) => {
                          return (
                            <React.Fragment key={`chapter-${chapterIndex}`}>
                              {/* Hàng tiêu đề chapter */}
                              <tr className="bg-blue-50">
                                <td className="p-3 border font-bold" colSpan={Object.keys(sections[activeSection].columnMap).length}>
                                  {chapterName}
                                </td>
                              </tr>
                              
                              {/* Các bài học trong chapter */}
                              {lessons.map((lesson, lessonIndex) => (
                                <tr key={`lesson-${chapterIndex}-${lessonIndex}`} className="hover:bg-gray-50">
                                  {sections[activeSection].columnMap && Object.entries(sections[activeSection].columnMap).map(([key, index], i) => {
                                    // Xác định nội dung ô
                                    let cellContent = null;
                                    
                                    if (key === 'STT' || key === 'Theme') {
                                      cellContent = <span className="font-medium">{lesson.stt}</span>;
                                    } else if (key === 'NGÀY HỌC' || key.includes('Ngày')) {
                                      cellContent = lesson.date;
                                    } else if (key === 'TÊN BÀI' || key.includes('Nội dung')) {
                                      cellContent = <span className="font-medium">{lesson.title}</span>;
                                    } else if (key.includes('LIVE') || key.includes('VIDEO') || key.includes('Bài giảng')) {
                                      if (lesson.liveLink) {
                                        cellContent = (
                                          <a
                                            href={lesson.liveLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block py-2 px-4 text-center text-blue-600 hover:text-blue-800 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                          >
                                            VIDEO
                                          </a>
                                        );
                                      } else {
                                        cellContent = <span className="text-center block">-</span>;
                                      }
                                    } else if (key.includes('TÀI LIỆU') || key.includes('DOCUMENT') || key.includes('Handout')) {
                                      if (lesson.documentLink) {
                                        cellContent = (
                                          <a
                                            href={lesson.documentLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block py-2 px-4 text-center text-green-600 hover:text-green-800 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                          >
                                            FILE PDF
                                          </a>
                                        );
                                      } else {
                                        cellContent = <span className="text-center block">-</span>;
                                      }
                                    } else if (key.includes('BTVN') || key.includes('Bài tập') || key.includes('Homework')) {
                                      if (lesson.homeworkLink) {
                                        cellContent = (
                                          <a
                                            href={lesson.homeworkLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="block py-2 px-4 text-center text-red-600 hover:text-red-800 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                          >
                                            BÀI TẬP
                                          </a>
                                        );
                                      } else {
                                        cellContent = <span className="text-center block">-</span>;
                                      }
                                    } else if (lesson.additionalData && lesson.additionalData[key]) {
                                      // Xử lý các cột khác từ dữ liệu bổ sung
                                      const data = lesson.additionalData[key];
                                      if (data.extractedLink) {
                                        // Nếu có liên kết
                                        let linkText = data.value || 'LINK';
                                        let bgColorClass = 'bg-gray-50';
                                        let textColorClass = 'text-gray-600';
                                        
                                        // Xác định màu dựa trên nội dung
                                        if (linkText.includes('VIDEO') || linkText.includes('LIVE')) {
                                          bgColorClass = 'bg-blue-50';
                                          textColorClass = 'text-blue-600 hover:text-blue-800';
                                          linkText = 'VIDEO';
                                        } else if (linkText.includes('PDF') || linkText.includes('TÀI LIỆU')) {
                                          bgColorClass = 'bg-green-50';
                                          textColorClass = 'text-green-600 hover:text-green-800';
                                          linkText = 'FILE PDF';
                                        } else if (linkText.includes('BTVN') || linkText.includes('BÀI TẬP')) {
                                          bgColorClass = 'bg-red-50';
                                          textColorClass = 'text-red-600 hover:text-red-800';
                                          linkText = 'BÀI TẬP';
                                        }
                                        
                                        cellContent = (
                                          <a
                                            href={data.extractedLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`block py-2 px-4 text-center ${textColorClass} ${bgColorClass} rounded-lg hover:bg-opacity-70 transition-colors`}
                                          >
                                            {linkText}
                                          </a>
                                        );
                                      } else if (data.value) {
                                        // Nếu chỉ có văn bản
                                        cellContent = <span className="block">{data.value}</span>;
                                      } else {
                                        cellContent = <span className="text-center block">-</span>;
                                      }
                                    } else {
                                      cellContent = <span className="text-center block">-</span>;
                                    }
                                    
                                    return (
                                      <td key={`cell-${chapterIndex}-${lessonIndex}-${i}`} className="p-3 border text-center">
                                        {cellContent}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        });
                      } else {
                        // Không có nhóm chapter, hiển thị danh sách thông thường
                        return sections[activeSection].lessons.map((lesson, lessonIndex) => (
                          <tr key={`lesson-${lessonIndex}`} className="hover:bg-gray-50">
                            {sections[activeSection].columnMap && Object.entries(sections[activeSection].columnMap).map(([key, index], i) => {
                              // Xử lý tương tự như trên
                              let cellContent = null;
                              
                              if (key === 'STT' || key === 'Theme') {
                                cellContent = <span className="font-medium">{lesson.stt}</span>;
                              } else if (key === 'NGÀY HỌC' || key.includes('Ngày')) {
                                cellContent = lesson.date;
                              } else if (key === 'TÊN BÀI' || key.includes('Nội dung')) {
                                cellContent = <span className="font-medium">{lesson.title}</span>;
                              } else if (key.includes('LIVE') || key.includes('VIDEO') || key.includes('Bài giảng')) {
                                if (lesson.liveLink) {
                                  cellContent = (
                                    <a
                                      href={lesson.liveLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block py-2 px-4 text-center text-blue-600 hover:text-blue-800 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                                    >
                                      VIDEO
                                    </a>
                                  );
                                } else {
                                  cellContent = <span className="text-center block">-</span>;
                                }
                              } else if (key.includes('TÀI LIỆU') || key.includes('DOCUMENT') || key.includes('Handout')) {
                                if (lesson.documentLink) {
                                  cellContent = (
                                    <a
                                      href={lesson.documentLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block py-2 px-4 text-center text-green-600 hover:text-green-800 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                                    >
                                      FILE PDF
                                    </a>
                                  );
                                } else {
                                  cellContent = <span className="text-center block">-</span>;
                                }
                              } else if (key.includes('BTVN') || key.includes('Bài tập') || key.includes('Homework')) {
                                if (lesson.homeworkLink) {
                                  cellContent = (
                                    <a
                                      href={lesson.homeworkLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block py-2 px-4 text-center text-red-600 hover:text-red-800 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                                    >
                                      BÀI TẬP
                                    </a>
                                  );
                                } else {
                                  cellContent = <span className="text-center block">-</span>;
                                }
                              } else if (lesson.additionalData && lesson.additionalData[key]) {
                                // Xử lý các cột khác từ dữ liệu bổ sung
                                const data = lesson.additionalData[key];
                                if (data.extractedLink) {
                                  // Nếu có liên kết
                                  let linkText = data.value || 'LINK';
                                  let bgColorClass = 'bg-gray-50';
                                  let textColorClass = 'text-gray-600';
                                  
                                  // Xác định màu dựa trên nội dung
                                  if (linkText.includes('VIDEO') || linkText.includes('LIVE')) {
                                    bgColorClass = 'bg-blue-50';
                                    textColorClass = 'text-blue-600 hover:text-blue-800';
                                    linkText = 'VIDEO';
                                  } else if (linkText.includes('PDF') || linkText.includes('TÀI LIỆU')) {
                                    bgColorClass = 'bg-green-50';
                                    textColorClass = 'text-green-600 hover:text-green-800';
                                    linkText = 'FILE PDF';
                                  } else if (linkText.includes('BTVN') || linkText.includes('BÀI TẬP')) {
                                    bgColorClass = 'bg-red-50';
                                    textColorClass = 'text-red-600 hover:text-red-800';
                                    linkText = 'BÀI TẬP';
                                  }
                                  
                                  cellContent = (
                                    <a
                                      href={data.extractedLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`block py-2 px-4 text-center ${textColorClass} ${bgColorClass} rounded-lg hover:bg-opacity-70 transition-colors`}
                                    >
                                      {linkText}
                                    </a>
                                  );
                                } else if (data.value) {
                                  // Nếu chỉ có văn bản
                                  cellContent = <span className="block">{data.value}</span>;
                                } else {
                                  cellContent = <span className="text-center block">-</span>;
                                }
                              } else {
                                cellContent = <span className="text-center block">-</span>;
                              }
                              
                              return (
                                <td key={`cell-${lessonIndex}-${i}`} className="p-3 border text-center">
                                  {cellContent}
                                </td>
                              );
                            })}
                          </tr>
                        ));
                      }
                    })()}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 text-center bg-gray-50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 text-lg">Chưa có bài học nào trong phần này</p>
                <p className="text-gray-400 text-sm mt-2">Vui lòng quay lại sau, bài học sẽ sớm được cập nhật.</p>
              </div>
            )}
            
            <div className="mt-8 rounded-xl overflow-hidden shadow-md bg-gradient-to-r from-amber-50 to-yellow-50 border border-yellow-200">
              <div className="p-5">
                <div className="flex items-start">
                  <div className="bg-yellow-100 rounded-full p-2 text-yellow-600 mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-yellow-800 mb-2 text-lg">Thông tin quan trọng</h3>
                    <p className="text-yellow-700 mb-1">
                      <span className="font-medium">ID Khóa học:</span> {id}
                    </p>
                    <p className="text-yellow-700 text-sm">
                      Vui lòng lưu lại ID này để truy cập khóa học trong tương lai.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center text-gray-500 text-sm mt-10">
          © {new Date().getFullYear()} Kimvan Education System. Tất cả các quyền được bảo lưu.
        </div>
      </div>
    </div>
  );
} 