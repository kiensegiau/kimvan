import { ArrowLeftIcon, PencilIcon, TrashIcon, CloudArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { AdjustmentsHorizontalIcon, DocumentArrowUpIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

export default function CourseHeader({ 
  course, 
  syncing,
  processingAllDrive,
  skipWatermarkRemoval, 
  setSkipWatermarkRemoval,
  handleSync,
  setShowProcessModal,
  setShowUploadModal,
  handleProcessAllDrive,
  refreshCourseData,
  handleDelete,
  setShowAddCourseModal
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
      <button
        onClick={() => router.push('/admin/courses')}
        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
      >
        <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
        Quay lại danh sách
      </button>
      
      <div className="flex flex-wrap gap-2">
        {course?.kimvanId && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {syncing ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                Đang đồng bộ...
              </>
            ) : (
              <>
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Đồng bộ
              </>
            )}
          </button>
        )}
        
        <button
          onClick={() => setShowProcessModal(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
        >
          <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
          Xử lý dữ liệu
        </button>
        
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
        >
          <DocumentArrowUpIcon className="h-4 w-4 mr-2" />
          Tải lên PDF
        </button>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <input
              id="skipWatermarkRemoval"
              type="checkbox"
              checked={skipWatermarkRemoval}
              onChange={(e) => setSkipWatermarkRemoval(e.target.checked)}
              className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
            />
            <label htmlFor="skipWatermarkRemoval" className="ml-2 block text-sm text-gray-700">
              Bỏ qua xử lý watermark
            </label>
          </div>
          
          <button
            onClick={handleProcessAllDrive}
            disabled={processingAllDrive}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
          >
            {processingAllDrive ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                Đang xử lý...
              </>
            ) : (
              <>
                <DocumentMagnifyingGlassIcon className="h-4 w-4 mr-2" />
                Xử lý tất cả PDF Drive
              </>
            )}
          </button>
        </div>
        
        <button
          onClick={() => router.push(`/admin/courses/edit/${course?._id}`)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <PencilIcon className="h-4 w-4 mr-2" />
          Chỉnh sửa
        </button>
        
        <button
          onClick={refreshCourseData}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-500 hover:bg-blue-600"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Làm mới dữ liệu
        </button>
        
        <button
          onClick={handleDelete}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
        >
          <TrashIcon className="h-4 w-4 mr-2" />
          Xóa
        </button>
        
        <button
          onClick={() => setShowAddCourseModal(true)}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-500 hover:bg-green-600"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Thêm khóa học mới
        </button>
      </div>
    </div>
  );
} 