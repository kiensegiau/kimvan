import { ArrowPathIcon } from '@heroicons/react/24/outline';

export default function LinkedSheets({ 
  id, 
  linkedSheets, 
  loadingSheets, 
  fetchLinkedSheets, 
  sheetData, 
  loadingSheetData, 
  fetchSheetData,
  setSheetData
}) {
  return (
    <div className="mt-6 bg-white rounded-lg border border-gray-200 overflow-hidden w-full">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="text-lg font-medium text-gray-900">Sheets liên kết</h3>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/admin/sheets?course=${id}`}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Thêm sheet mới
          </a>
          
          <button
            onClick={fetchLinkedSheets}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-1 ${loadingSheets ? 'animate-spin' : ''}`} />
            Làm mới
          </button>
        </div>
      </div>
      
      <div className="px-4 sm:px-6 py-4">
        {loadingSheets ? (
          <div className="flex justify-center items-center py-8">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600">Đang tải dữ liệu sheets...</span>
          </div>
        ) : linkedSheets.length === 0 ? (
          <div className="bg-gray-50 p-6 rounded-lg text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-600 mb-4">Chưa có sheet nào được liên kết với khóa học này.</p>
            <a
              href={`/admin/sheets?course=${id}`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Thêm sheet mới
            </a>
          </div>
        ) : (
          <div>
            {linkedSheets.map((sheet) => (
              <div key={sheet._id} className="mb-8 bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900">{sheet.name}</h3>
                  </div>
                  <div className="mt-2 sm:mt-0 flex flex-wrap gap-2">
                    <a 
                      href={`/admin/sheets/${sheet._id}`}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Chi tiết
                    </a>
                    <a 
                      href={sheet.sheetUrl || `https://docs.google.com/spreadsheets/d/${sheet.sheetId}`} 
                      target="_blank"
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-600 bg-green-50 hover:bg-green-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Mở Google Sheet
                    </a>
                    <button 
                      onClick={() => fetchSheetData(sheet._id)}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100"
                    >
                      <ArrowPathIcon className={`h-4 w-4 mr-1 ${loadingSheetData[sheet._id] ? 'animate-spin' : ''}`} />
                      Làm mới dữ liệu
                    </button>
                  </div>
                </div>
                
                {sheet.description && (
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
                    <p className="text-sm text-gray-600">{sheet.description}</p>
                  </div>
                )}
                
                {/* Chọn sheet khi có nhiều sheet */}
                {sheetData[sheet._id]?.data?.sheets && sheetData[sheet._id].data.sheets.length > 1 && (
                  <div className="border-b border-gray-200 px-4 sm:px-6 py-4 bg-gray-50">
                    <h3 className="text-base font-medium text-gray-800 mb-3">Chọn sheet:</h3>
                    <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
                      {sheetData[sheet._id].data.sheets.map((subSheet, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            // Lưu chỉ mục sheet đang chọn vào state
                            setSheetData(prev => ({
                              ...prev,
                              [sheet._id]: {
                                ...prev[sheet._id],
                                activeSubSheet: index
                              }
                            }));
                          }}
                          className={`
                            px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                            ${(sheetData[sheet._id].activeSubSheet === index || (!sheetData[sheet._id].activeSubSheet && index === 0)) 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }
                          `}
                        >
                          <div className="flex items-center">
                            <span>{subSheet?.properties?.title || `Sheet ${index + 1}`}</span>
                            {subSheet?.data?.[0]?.rowData && (
                              <span className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                                (sheetData[sheet._id].activeSubSheet === index || (!sheetData[sheet._id].activeSubSheet && index === 0))
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {(subSheet.data[0].rowData.length - 1) || 0}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="px-6 py-4">
                  {loadingSheetData[sheet._id] ? (
                    <div className="flex justify-center items-center py-8">
                      <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
                      <span className="ml-2 text-gray-600">Đang tải dữ liệu sheet...</span>
                    </div>
                  ) : !sheetData[sheet._id] ? (
                    <div className="text-center py-8">
                      <p className="text-gray-600 mb-4">Chưa có dữ liệu sheet. Nhấn "Làm mới dữ liệu" để tải.</p>
                      <button 
                        onClick={() => fetchSheetData(sheet._id)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                      >
                        <ArrowPathIcon className="h-5 w-5 mr-2" />
                        Tải dữ liệu sheet
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      {sheetData[sheet._id].data && sheetData[sheet._id].data.values && (
                        <SheetTable sheetData={sheetData[sheet._id]} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SheetTable({ sheetData }) {
  return (
    <table className="min-w-full border-collapse border border-gray-300 shadow-lg rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-gradient-to-r from-blue-600 to-indigo-600">
          {sheetData.data.values[0] && sheetData.data.values[0].map((header, idx) => {
            // Bỏ qua cột STT (thường là cột đầu tiên)
            if (idx === 0 && (header === 'STT' || header === '#' || header === 'No.' || 
                           header === 'No' || header === 'Số TT' || header === 'Số thứ tự')) {
              return null;
            }
            
            return (
              <th 
                key={idx} 
                scope="col" 
                className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider border border-indigo-500"
              >
                <div className="flex items-center">
                  {header}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody className="bg-white">
        {sheetData.data.values.slice(1).map((row, rowIdx) => (
          <tr 
            key={rowIdx} 
            className="hover:bg-blue-50 transition-colors duration-150 bg-white"
          >
            {row.map((cell, cellIdx) => {
              // Kiểm tra xem ô này có nằm trong vùng gộp không
              // Kiểm tra trực tiếp từ thông tin merges
              const isMerged = sheetData.data.merges?.some(merge => {
                return (
                  rowIdx + 1 >= merge.startRowIndex && 
                  rowIdx + 1 < merge.endRowIndex && 
                  cellIdx >= merge.startColumnIndex && 
                  cellIdx < merge.endColumnIndex &&
                  // Kiểm tra xem đây có phải là ô chính không
                  !(rowIdx + 1 === merge.startRowIndex && cellIdx === merge.startColumnIndex)
                );
              });
              
              if (isMerged) {
                // Nếu ô này đã được gộp và không phải là ô chính, bỏ qua
                return null;
              }
              
              // Bỏ qua cột STT (thường là cột đầu tiên)
              if (cellIdx === 0 && sheetData.data.values[0] && 
                 (sheetData.data.values[0][0] === 'STT' || 
                  sheetData.data.values[0][0] === '#' || 
                  sheetData.data.values[0][0] === 'No.' || 
                  sheetData.data.values[0][0] === 'No' || 
                  sheetData.data.values[0][0] === 'Số TT' ||
                  sheetData.data.values[0][0] === 'Số thứ tự')) {
                return null;
              }
              
              // Kiểm tra xem cell có phải là hyperlink không
              const cellData = sheetData.data.htmlData && 
                              sheetData.data.htmlData[rowIdx + 1] && 
                              sheetData.data.htmlData[rowIdx + 1].values && 
                              sheetData.data.htmlData[rowIdx + 1].values[cellIdx];
              
              const isLink = cellData && cellData.hyperlink;
              
              // Kiểm tra loại link
              const isYoutube = isLink && (cellData.hyperlink.includes('youtube.com') || cellData.hyperlink.includes('youtu.be'));
              const isPdf = isLink && (cellData.hyperlink.includes('.pdf') || (cellData.hyperlink.includes('drive.google.com') && cellData.hyperlink.includes('pdf')));
              const isDrive = isLink && cellData.hyperlink.includes('drive.google.com');
              
              // Tìm thông tin về merge nếu đây là ô chính của vùng gộp
              const mergeInfo = sheetData.data.merges?.find(merge => 
                rowIdx + 1 === merge.startRowIndex && cellIdx === merge.startColumnIndex
              );
              
              // Xác định rowSpan và colSpan từ thông tin merge
              const rowSpan = mergeInfo ? mergeInfo.endRowIndex - mergeInfo.startRowIndex : 1;
              const colSpan = mergeInfo ? mergeInfo.endColumnIndex - mergeInfo.startColumnIndex : 1;
              
              return (
                <td 
                  key={cellIdx} 
                  className={`px-6 py-4 ${isLink ? 'whitespace-normal' : 'whitespace-nowrap'} text-sm ${isLink ? 'text-gray-800' : 'text-gray-600'} text-left border border-gray-200 ${(rowSpan > 1 || colSpan > 1) ? 'bg-white' : ''}`}
                  {...(rowSpan > 1 ? { rowSpan } : {})}
                  {...(colSpan > 1 ? { colSpan } : {})}
                >
                  {isLink ? (
                    <div className="flex items-center space-x-2">
                      <a 
                        href={cellData.hyperlink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center font-medium"
                      >
                        <span className="line-clamp-2 text-left">{cell}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  ) : (
                    <span className="line-clamp-2 text-left">{cell}</span>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
} 