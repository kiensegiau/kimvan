'use client';

import { useState, useEffect } from 'react';
import { ArrowPathIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import XLSX from 'xlsx';

export default function TestSpreadsheet() {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [activeSheet, setActiveSheet] = useState(0);

  // Hàm lấy tiêu đề của sheet
  const getSheetTitle = (index, sheets) => {
    if (!sheets || !sheets[index]) return `Khóa ${index + 1}`;
    const sheet = sheets[index];
    return sheet?.properties?.title || `Khóa ${index + 1}`;
  };

  // Hàm xử lý khi submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!spreadsheetId) {
      setError('Vui lòng nhập ID của spreadsheet');
      return;
    }
    
    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      const response = await fetch(`/api/spreadsheets/${spreadsheetId}`);
      
      if (!response.ok) {
        throw new Error(`Lỗi ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Dữ liệu API:', result);
      setData(result);
      
      // Nếu có sheets, đặt sheet đầu tiên là active
      if (result.sheets && result.sheets.length > 0) {
        setActiveSheet(0);
      }
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu:', err);
      setError(`Không thể lấy dữ liệu: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Hàm xuất dữ liệu sang Excel sử dụng SheetJS
  const exportToExcel = () => {
    if (!data || !data.sheets || !data.sheets[activeSheet]) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    try {
      // Lấy dữ liệu từ sheet hiện tại
      const sheet = data.sheets[activeSheet];
      const sheetData = sheet?.data?.[0]?.rowData;
      
      if (!sheetData || sheetData.length === 0) {
        alert('Không có dữ liệu để xuất');
        return;
      }
      
      // Tạo mảng dữ liệu cho Excel
      const excelData = [];
      
      // Thêm tiêu đề
      const headers = [];
      const headerRow = sheetData[0];
      if (headerRow && headerRow.values) {
        headerRow.values.forEach(cell => {
          headers.push(cell.formattedValue || '');
        });
        excelData.push(headers);
      }
      
      // Thêm dữ liệu
      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (row && row.values) {
          const rowData = [];
          row.values.forEach(cell => {
            // Lấy giá trị từ cell
            let value = cell.formattedValue || '';
            
            // Nếu có link, thêm link vào giá trị
            const url = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
            if (url) {
              value = value || 'Xem liên kết';
              // Thêm URL vào giá trị để dễ tham khảo
              value += ` (${url})`;
            }
            
            rowData.push(value);
          });
          excelData.push(rowData);
        }
      }
      
      // Tạo workbook và worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(excelData);
      
      // Đặt tên cho worksheet
      XLSX.utils.book_append_sheet(wb, ws, getSheetTitle(activeSheet, data.sheets) || 'Sheet1');
      
      // Tạo tên file mặc định
      const filename = `spreadsheet-${spreadsheetId.substring(0, 10)}.xlsx`;
      
      // Xuất file Excel
      XLSX.writeFile(wb, filename);
      
    } catch (error) {
      console.error('Lỗi khi xuất file Excel:', error);
      alert('Có lỗi xảy ra khi xuất file Excel: ' + error.message);
    }
  };

  // Hàm xuất dữ liệu sang Excel bằng phương pháp HTML
  const exportToExcelHTML = () => {
    if (!data || !data.sheets || !data.sheets[activeSheet]) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    try {
      const tableSelect = document.getElementById('spreadsheet-table');
      
      if (!tableSelect) {
        alert('Không tìm thấy bảng dữ liệu');
        return;
      }
      
      // Tạo một bản sao của bảng để xử lý
      const tableClone = tableSelect.cloneNode(true);
      
      // Xử lý các thẻ a và các thẻ HTML không cần thiết
      const links = tableClone.querySelectorAll('a');
      links.forEach(link => {
        // Thêm URL vào nội dung
        const url = link.getAttribute('href');
        const text = link.textContent || '';
        const newText = url ? `${text} (${url})` : text;
        const textNode = document.createTextNode(newText);
        link.parentNode.replaceChild(textNode, link);
      });
      
      // Xóa các biểu tượng SVG và các thẻ không cần thiết khác
      const svgs = tableClone.querySelectorAll('svg');
      svgs.forEach(svg => {
        svg.parentNode.removeChild(svg);
      });
      
      // Tạo tên file mặc định
      const filename = `spreadsheet-${spreadsheetId.substring(0, 10)}.xls`;
      
      // Tạo template HTML cho Excel
      const excelTemplate = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <meta name="ProgId" content="Excel.Sheet">
          <meta name="Generator" content="Microsoft Excel 11">
          <style>
            table, td, th {
              border: 1px solid black;
              border-collapse: collapse;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
          </style>
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>${getSheetTitle(activeSheet, data.sheets) || 'Sheet1'}</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
        </head>
        <body>
          ${tableClone.outerHTML}
        </body>
        </html>
      `;
      
      // Tạo link download
      const dataType = 'application/vnd.ms-excel';
      const downloadLink = document.createElement('a');
      document.body.appendChild(downloadLink);
      
      if (navigator.msSaveOrOpenBlob) {
        // Cho IE và Edge
        const blob = new Blob(['\ufeff', excelTemplate], {
          type: dataType
        });
        navigator.msSaveOrOpenBlob(blob, filename);
      } else {
        // Cho các trình duyệt khác
        downloadLink.href = 'data:' + dataType + ';charset=utf-8,' + encodeURIComponent(excelTemplate);
        downloadLink.download = filename;
        downloadLink.click();
      }
      
      document.body.removeChild(downloadLink);
    } catch (error) {
      console.error('Lỗi khi xuất file Excel:', error);
      alert('Có lỗi xảy ra khi xuất file Excel: ' + error.message);
    }
  };

  // Hàm render giá trị của cell
  const renderCellValue = (cell) => {
    if (!cell) return '';
    
    // Lấy giá trị hiển thị
    const displayValue = cell.formattedValue || '';
    
    // Kiểm tra xem có link không
    const url = cell.userEnteredFormat?.textFormat?.link?.uri || cell.hyperlink;
    
    if (url) {
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          {displayValue || 'Xem liên kết'}
        </a>
      );
    }
    
    return displayValue;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Test API Spreadsheet</h1>
        
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
            <div className="flex-grow">
              <label htmlFor="spreadsheetId" className="block text-sm font-medium text-gray-700 mb-1">
                Spreadsheet ID
              </label>
              <input
                type="text"
                id="spreadsheetId"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="Nhập ID của spreadsheet"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="self-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center">
                    <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                    Đang tải...
                  </span>
                ) : (
                  'Lấy dữ liệu'
                )}
              </button>
            </div>
          </form>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-8 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        {data && data.sheets && data.sheets.length > 0 && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
            {/* Tabs cho các sheets */}
            {data.sheets.length > 1 && (
              <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                <h3 className="text-base font-medium text-gray-800 mb-3">Chọn sheet:</h3>
                <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                  {data.sheets.map((sheet, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveSheet(index)}
                      className={`
                        px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                        ${activeSheet === index 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      <div className="flex items-center">
                        <span>{getSheetTitle(index, data.sheets)}</span>
                        {sheet?.data?.[0]?.rowData && (
                          <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                            activeSheet === index ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {(sheet.data[0].rowData.length - 1) || 0}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Header của sheet hiện tại */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
              <div className="font-medium text-gray-800 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {getSheetTitle(activeSheet, data.sheets)}
              </div>
              <div className="flex items-center gap-2">
                {data.sheets[activeSheet]?.data?.[0]?.rowData && data.sheets[activeSheet].data[0].rowData.length > 0 ? (
                  <>
                    <div className="text-sm text-gray-600">
                      Tổng số: <span className="font-medium text-blue-600">
                        {(data.sheets[activeSheet].data[0].rowData.length - 1) || 0} dòng
                      </span>
                    </div>
                    <button
                      onClick={exportToExcel}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                      title="Xuất Excel bằng thư viện SheetJS (chất lượng cao)"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Xuất Excel
                    </button>
                    <button
                      onClick={exportToExcelHTML}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      title="Xuất Excel bằng phương pháp HTML (dự phòng)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Xuất HTML
                    </button>
                  </>
                ) : (
                  <div className="text-sm text-gray-600">
                    Không có dữ liệu
                  </div>
                )}
              </div>
            </div>
            
            {/* Bảng dữ liệu */}
            <div className="overflow-x-auto">
              {data.sheets[activeSheet]?.data?.[0]?.rowData && data.sheets[activeSheet].data[0].rowData.length > 0 ? (
                <table id="spreadsheet-table" className="min-w-full bg-white">
                  <thead>
                    <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
                      {data.sheets[activeSheet].data[0].rowData[0]?.values?.map((header, idx) => (
                        <th key={idx} className="py-3 px-4 text-left text-xs font-medium text-white uppercase tracking-wider border-b border-blue-500">
                          {renderCellValue(header)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.sheets[activeSheet].data[0].rowData.slice(1).map((row, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        {row.values?.map((cell, cellIdx) => (
                          <td key={cellIdx} className="py-2 px-4 border-b border-gray-200">
                            {renderCellValue(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  Không có dữ liệu để hiển thị
                </div>
              )}
            </div>
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