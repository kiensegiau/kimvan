import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

// Simple Modal Template
export function ModalTemplate({ isOpen, title, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 overflow-y-auto z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                {title}
              </h3>
              <button
                onClick={onClose}
                className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// JSON Input Modal
export function JsonInputModal({ 
  isOpen, 
  onClose, 
  jsonInput, 
  setJsonInput, 
  jsonInputError, 
  handleJsonSubmit, 
  syncing 
}) {
  return (
    <ModalTemplate 
      isOpen={isOpen} 
      title="Nhập JSON (tùy chọn)" 
      onClose={onClose}
    >
      <form onSubmit={handleJsonSubmit}>
        <div className="mt-2">
          <p className="text-sm text-gray-500 mb-2">
            Nếu bạn có dữ liệu JSON từ bảng tính, hãy dán vào dưới đây để sử dụng làm dữ liệu đồng bộ. Để trống nếu bạn muốn hệ thống tự động tải dữ liệu mới nhất.
          </p>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={10}
            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
            placeholder="Dán JSON vào đây (tùy chọn)"
          ></textarea>
          {jsonInputError && (
            <p className="mt-2 text-sm text-red-600">
              {jsonInputError}
            </p>
          )}
        </div>
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-3"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={syncing}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {syncing ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                Đang xử lý...
              </>
            ) : (
              'Tiếp tục'
            )}
          </button>
        </div>
      </form>
    </ModalTemplate>
  );
}

// Preview Modal
export function PreviewModal({ 
  isOpen, 
  onClose, 
  previewData,
  activeTab,
  setActiveTab,
  applyingSync,
  applySync,
  cancelSync
}) {
  return (
    <ModalTemplate 
      isOpen={isOpen} 
      title="Xem trước dữ liệu đồng bộ" 
      onClose={onClose}
    >
      <div className="mt-4">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('sheet')}
              className={`${
                activeTab === 'sheet'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
            >
              Dữ liệu Sheet
            </button>
            <button
              onClick={() => setActiveTab('meta')}
              className={`${
                activeTab === 'meta'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
            >
              Thông tin khóa học
            </button>
          </nav>
        </div>

        <div className="mt-4 max-h-96 overflow-y-auto">
          {activeTab === 'sheet' ? (
            previewData?.data?.sheets ? (
              <div>
                <h4 className="font-medium text-sm text-gray-700 mb-2">Số lượng sheet: {previewData.data.sheets.length}</h4>
                {previewData.data.sheets.map((sheet, idx) => (
                  <div key={idx} className="mb-4">
                    <h5 className="text-sm font-semibold mb-1">{sheet.properties?.title || `Sheet ${idx + 1}`}</h5>
                    <div className="text-xs text-gray-500">
                      Số hàng: {sheet.data?.[0]?.rowData?.length || 0}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">Không có dữ liệu sheet</p>
            )
          ) : (
            <div>
              {previewData && previewData.meta ? (
                <div>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Tên khóa học</dt>
                      <dd className="mt-1 text-sm text-gray-900">{previewData.meta.name || 'Chưa có tên'}</dd>
                    </div>
                    
                    <div className="sm:col-span-2">
                      <dt className="text-sm font-medium text-gray-500">Mô tả</dt>
                      <dd className="mt-1 text-sm text-gray-900">{previewData.meta.description || 'Chưa có mô tả'}</dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Giá (VND)</dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {previewData.meta.price ? previewData.meta.price.toLocaleString('vi-VN') : 'Chưa có giá'}
                      </dd>
                    </div>
                    
                    <div>
                      <dt className="text-sm font-medium text-gray-500">ID Kimvan</dt>
                      <dd className="mt-1 text-sm text-gray-900 break-words">{previewData.meta.kimvanId || 'Chưa có'}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Không có thông tin khóa học</p>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 sm:mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={cancelSync}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={applySync}
            disabled={applyingSync}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {applyingSync ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                Đang áp dụng...
              </>
            ) : (
              'Áp dụng đồng bộ'
            )}
          </button>
        </div>
      </div>
    </ModalTemplate>
  );
}

// Process Modal
export function ProcessModal({ 
  isOpen, 
  onClose, 
  processMethod, 
  setProcessMethod, 
  handleProcessData, 
  processingData 
}) {
  return (
    <ModalTemplate 
      isOpen={isOpen} 
      title="Xử lý dữ liệu khóa học" 
      onClose={onClose}
    >
      <div className="mt-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn phương thức xử lý:</label>
            <select
              value={processMethod}
              onChange={(e) => setProcessMethod(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="normalize_data">Chuẩn hóa dữ liệu</option>
              <option value="reset_data">Khôi phục dữ liệu gốc</option>
              <option value="analyze_links">Phân tích các liên kết</option>
              <option value="fix_structure">Sửa cấu trúc dữ liệu</option>
            </select>
          </div>
        </div>

        <div className="mt-5 sm:mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleProcessData}
            disabled={processingData}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-purple-400"
          >
            {processingData ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                Đang xử lý...
              </>
            ) : (
              'Xử lý'
            )}
          </button>
        </div>
      </div>
    </ModalTemplate>
  );
}

// Upload PDF Modal
export function UploadModal({ 
  isOpen, 
  onClose, 
  handleFileChange, 
  handleUploadPdf, 
  pdfFile, 
  uploadingPdf 
}) {
  return (
    <ModalTemplate 
      isOpen={isOpen} 
      title="Tải lên file PDF" 
      onClose={onClose}
    >
      <form onSubmit={handleUploadPdf} className="mt-4">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chọn file PDF để tải lên:</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-md file:border-0
                file:text-sm file:font-medium
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
              "
            />
          </div>
          {pdfFile && (
            <div className="text-sm text-gray-600">
              File đã chọn: {pdfFile.name} ({Math.round(pdfFile.size / 1024)} KB)
            </div>
          )}
        </div>

        <div className="mt-5 sm:mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!pdfFile || uploadingPdf}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400"
          >
            {uploadingPdf ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin mr-2" />
                Đang tải lên...
              </>
            ) : (
              'Tải lên'
            )}
          </button>
        </div>
      </form>
    </ModalTemplate>
  );
} 