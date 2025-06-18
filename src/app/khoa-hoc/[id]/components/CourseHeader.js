import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

export default function CourseHeader({ course }) {
  const router = useRouter();
  
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
      <div className="flex items-center">
        <button
          onClick={() => router.push('/khoa-hoc')}
          className="mr-4 p-1 rounded-full hover:bg-gray-200 transition-colors"
          aria-label="Quay lại"
        >
          <ArrowLeftIcon className="h-6 w-6 text-gray-600" />
        </button>
        
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {course?.title || 'Đang tải...'}
          </h1>
          {course?.subtitle && (
            <p className="text-gray-500 mt-1">{course.subtitle}</p>
          )}
        </div>
      </div>
      
      <div className="mt-4 sm:mt-0 flex items-center">
        {course?.category && (
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
            {course.category}
          </span>
        )}
      </div>
    </div>
  );
} 