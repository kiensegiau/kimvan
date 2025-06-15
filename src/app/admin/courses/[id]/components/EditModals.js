import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ModalTemplate } from './ModalComponents';

// Quick Edit Modal
export function QuickEditModal({
  isOpen,
  onClose,
  quickEditData,
  setQuickEditData,
  handleUpdateCell,
  updatingCell
}) {
  if (!isOpen) return null;

  return (
    <ModalTemplate
      isOpen={isOpen}
      title={`Sửa nhanh: ${quickEditData.header}`}
      onClose={onClose}
    >
      <div className="mt-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="quickEditValue" className="block text-sm font-medium text-gray-700 mb-1">
              Nội dung
            </label>
            <input
              type="text"
              id="quickEditValue"
              value={quickEditData.value}
              onChange={(e) => setQuickEditData(prev => ({ ...prev, value: e.target.value }))}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="quickEditUrl" className="block text-sm font-medium text-gray-700 mb-1">
              Link (nếu có)
            </label>
            <input
              type="text"
              id="quickEditUrl"
              value={quickEditData.url}
              onChange={(e) => setQuickEditData(prev => ({ ...prev, url: e.target.value }))}
              placeholder="https://"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
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
            onClick={handleUpdateCell}
            disabled={updatingCell}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {updatingCell ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                Đang lưu...
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </button>
        </div>
      </div>
    </ModalTemplate>
  );
}

// Edit Row Modal
export function EditRowModal({
  isOpen,
  onClose,
  editRowData,
  handleEditRowChange,
  handleUpdateRow,
  updatingRow
}) {
  if (!isOpen) return null;

  return (
    <ModalTemplate
      isOpen={isOpen}
      title="Sửa thông tin hàng"
      onClose={onClose}
    >
      <div className="mt-4">
        <div className="space-y-6">
          {Object.keys(editRowData).map((header) => {
            // Xác định xem trường này có phải là link hay không
            const isLink = typeof editRowData[header] === 'object' && editRowData[header].hasOwnProperty('url');
            
            return (
              <div key={header} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {header}
                </label>
                
                {isLink ? (
                  <div className="flex flex-col space-y-2">
                    <input
                      type="text"
                      value={editRowData[header].displayText || ''}
                      onChange={(e) => handleEditRowChange(header, e.target.value, 'displayText')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Tiêu đề hiển thị"
                    />
                    <input
                      type="text"
                      value={editRowData[header].url || ''}
                      onChange={(e) => handleEditRowChange(header, e.target.value, 'url')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="https://"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={editRowData[header] || ''}
                    onChange={(e) => handleEditRowChange(header, e.target.value)}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleUpdateRow}
            disabled={updatingRow}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {updatingRow ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                Đang cập nhật...
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </button>
        </div>
      </div>
    </ModalTemplate>
  );
}

// Add/Insert Row Modal
export function AddRowModal({
  isOpen,
  onClose,
  newRowData,
  handleNewRowChange,
  handleAddRow,
  addingRow,
  insertPosition
}) {
  if (!isOpen) return null;
  
  const modalTitle = insertPosition !== null ? 'Chèn hàng mới' : 'Thêm hàng mới';

  return (
    <ModalTemplate
      isOpen={isOpen}
      title={modalTitle}
      onClose={onClose}
    >
      <div className="mt-4">
        <div className="space-y-6">
          {Object.keys(newRowData).map((header) => {
            // Xác định xem trường này có phải là link hay không
            const isLink = typeof newRowData[header] === 'object' && newRowData[header].hasOwnProperty('url');
            
            return (
              <div key={header} className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  {header}
                </label>
                
                {isLink ? (
                  <div className="flex flex-col space-y-2">
                    <input
                      type="text"
                      value={newRowData[header].displayText || ''}
                      onChange={(e) => handleNewRowChange(header, e.target.value, 'displayText')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="Tiêu đề hiển thị"
                    />
                    <input
                      type="text"
                      value={newRowData[header].url || ''}
                      onChange={(e) => handleNewRowChange(header, e.target.value, 'url')}
                      className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                      placeholder="https://"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={newRowData[header].displayText || ''}
                    onChange={(e) => handleNewRowChange(header, e.target.value, 'displayText')}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleAddRow}
            disabled={addingRow}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
          >
            {addingRow ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                Đang thêm...
              </>
            ) : (
              insertPosition !== null ? 'Chèn hàng' : 'Thêm hàng'
            )}
          </button>
        </div>
      </div>
    </ModalTemplate>
  );
}

// Add New Course Modal
export function AddCourseModal({
  isOpen,
  onClose,
  newCourseData,
  handleNewCourseChange,
  handleAddCourse,
  addingCourse
}) {
  if (!isOpen) return null;

  return (
    <ModalTemplate
      isOpen={isOpen}
      title="Thêm khóa học mới"
      onClose={onClose}
    >
      <div className="mt-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="courseName" className="block text-sm font-medium text-gray-700">
              Tên khóa học *
            </label>
            <input
              type="text"
              id="courseName"
              value={newCourseData.name}
              onChange={(e) => handleNewCourseChange('name', e.target.value)}
              required
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="courseDescription" className="block text-sm font-medium text-gray-700">
              Mô tả
            </label>
            <textarea
              id="courseDescription"
              value={newCourseData.description}
              onChange={(e) => handleNewCourseChange('description', e.target.value)}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            ></textarea>
          </div>
          
          <div>
            <label htmlFor="coursePrice" className="block text-sm font-medium text-gray-700">
              Giá (VND)
            </label>
            <input
              type="number"
              id="coursePrice"
              value={newCourseData.price}
              onChange={(e) => handleNewCourseChange('price', Number(e.target.value))}
              min="0"
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="courseStatus" className="block text-sm font-medium text-gray-700">
              Trạng thái
            </label>
            <select
              id="courseStatus"
              value={newCourseData.status}
              onChange={(e) => handleNewCourseChange('status', e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleAddCourse}
            disabled={addingCourse || !newCourseData.name}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-400"
          >
            {addingCourse ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                Đang tạo...
              </>
            ) : (
              'Tạo khóa học'
            )}
          </button>
        </div>
      </div>
    </ModalTemplate>
  );
}

// Original Data JSON Modal
export function OriginalDataModal({
  isOpen,
  onClose,
  originalData,
  loadingOriginalData
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 overflow-hidden z-50" aria-labelledby="json-modal-title" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* Background overlay */}
        <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>
        
        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
          <div className="pointer-events-auto w-screen max-w-4xl">
            <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
              {/* Header */}
              <div className="flex items-start justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900" id="json-modal-title">
                  Dữ liệu JSON gốc
                </h2>
                <div className="ml-3 flex h-7 items-center">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:ring-2 focus:ring-indigo-500"
                  >
                    <span className="sr-only">Đóng</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-4 flex-1 overflow-auto">
                {loadingOriginalData ? (
                  <div className="flex justify-center items-center py-8">
                    <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-500" />
                    <span className="ml-2 text-gray-600">Đang tải dữ liệu gốc...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-xs font-mono bg-gray-50 p-4 rounded-md overflow-x-auto">
                    {JSON.stringify(originalData, null, 2)}
                  </pre>
                )}
              </div>
              
              {/* Footer */}
              <div className="flex justify-end p-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 