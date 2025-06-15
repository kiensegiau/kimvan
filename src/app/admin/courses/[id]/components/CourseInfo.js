export default function CourseInfo({ course }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-medium text-gray-900">Thông tin khóa học</h3>
      </div>
      <div className="p-4 sm:p-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Tên khóa học</dt>
            <dd className="mt-1 text-lg font-medium text-gray-900 break-words">{course.name || 'Chưa có tên'}</dd>
          </div>
          
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">Mô tả</dt>
            <dd className="mt-1 text-sm text-gray-900">{course.description || 'Chưa có mô tả'}</dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Giá (VND)</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {course.price ? course.price.toLocaleString('vi-VN') : 'Chưa có giá'}
            </dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Giá gốc (VND)</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {course.originalPrice 
                ? (typeof course.originalPrice === 'string' 
                    ? parseInt(course.originalPrice).toLocaleString('vi-VN') 
                    : course.originalPrice.toLocaleString('vi-VN'))
                : 'Chưa có giá gốc'}
            </dd>
          </div>
          
          <div>
            <dt className="text-sm font-medium text-gray-500">Trạng thái</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {course.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
              </span>
            </dd>
          </div>
          
          {course.kimvanId && (
            <div>
              <dt className="text-sm font-medium text-gray-500">ID Kimvan</dt>
              <dd className="mt-1 text-sm text-gray-900 break-words">{course.kimvanId}</dd>
            </div>
          )}
          
          {course.updatedAt && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Cập nhật lần cuối</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(course.updatedAt).toLocaleString('vi-VN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
} 