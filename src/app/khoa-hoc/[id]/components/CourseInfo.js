export default function CourseInfo({ course }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6">
      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <h2 className="text-xl font-semibold flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Thông tin khóa học
        </h2>
      </div>
      
      {/* Content */}
      <div className="p-6">
        {/* Description */}
        {course?.description && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Mô tả</h3>
            <div className="prose prose-sm max-w-none text-gray-600" 
                 dangerouslySetInnerHTML={{ __html: course.description }} />
          </div>
        )}
        
        {/* Meta Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div>
            {course?.instructor && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-1">Giảng viên</h4>
                <p className="text-gray-900">{course.instructor}</p>
              </div>
            )}
            
            {course?.duration && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-1">Thời lượng</h4>
                <p className="text-gray-900">{course.duration}</p>
              </div>
            )}
            
            {course?.level && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-1">Trình độ</h4>
                <p className="text-gray-900">{course.level}</p>
              </div>
            )}
          </div>
          
          {/* Right Column */}
          <div>
            {course?.updatedAt && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-1">Cập nhật lần cuối</h4>
                <p className="text-gray-900">
                  {new Date(course.updatedAt).toLocaleDateString('vi-VN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}
            
            {course?.tags && course.tags.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-500 mb-1">Thẻ</h4>
                <div className="flex flex-wrap gap-2">
                  {course.tags.map((tag, index) => (
                    <span key={index} className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 