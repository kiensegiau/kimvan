import { ArrowPathIcon, CheckIcon } from '@heroicons/react/24/outline';

export default function CourseFilters({
  selectedCategory,
  setSelectedCategory,
  selectedLevel,
  setSelectedLevel,
  sortBy,
  setSortBy,
  resetFilters
}) {
  const categories = [
    { id: 'all', name: 'Tất cả' },
    { id: 'math', name: 'Toán học' },
    { id: 'physics', name: 'Vật lý' },
    { id: 'chemistry', name: 'Hóa học' },
    { id: 'english', name: 'Tiếng Anh' },
    { id: 'literature', name: 'Văn học' },
    { id: 'history', name: 'Lịch sử' },
    { id: 'geography', name: 'Địa lý' },
    { id: 'biology', name: 'Sinh học' },
    { id: 'programming', name: 'Lập trình' },
  ];

  const levels = [
    { id: 'all', name: 'Tất cả' },
    { id: 'beginner', name: 'Cơ bản', color: 'bg-green-100 text-green-800' },
    { id: 'intermediate', name: 'Trung cấp', color: 'bg-blue-100 text-blue-800' },
    { id: 'advanced', name: 'Nâng cao', color: 'bg-purple-100 text-purple-800' },
  ];

  const sortOptions = [
    { id: 'newest', name: 'Mới nhất' },
    { id: 'oldest', name: 'Cũ nhất' },
    { id: 'price-low', name: 'Giá thấp đến cao' },
    { id: 'price-high', name: 'Giá cao đến thấp' },
    { id: 'name-asc', name: 'Tên A-Z' },
    { id: 'name-desc', name: 'Tên Z-A' },
  ];

  return (
    <div className="bg-white shadow-sm rounded-xl p-5 sticky top-4">
      <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-100">
        <h3 className="text-lg font-bold text-gray-900">Bộ lọc</h3>
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 mr-1.5" />
          Đặt lại
        </button>
      </div>

      <div className="space-y-6">
        {/* Category filter */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <span className="w-1.5 h-4 bg-blue-600 rounded-sm mr-2"></span>
            Danh mục
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
            {categories.map((category) => (
              <div 
                key={category.id} 
                className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedCategory === category.id 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => setSelectedCategory(category.id)}
              >
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  selectedCategory === category.id 
                    ? 'border-blue-600 bg-blue-600' 
                    : 'border-gray-300'
                }`}>
                  {selectedCategory === category.id && (
                    <CheckIcon className="h-3 w-3 text-white" />
                  )}
                </div>
                <label
                  htmlFor={`category-${category.id}`}
                  className={`ml-2 text-sm cursor-pointer ${
                    selectedCategory === category.id ? 'font-medium' : ''
                  }`}
                >
                  {category.name}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Level filter */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <span className="w-1.5 h-4 bg-green-500 rounded-sm mr-2"></span>
            Trình độ
          </h4>
          <div className="flex flex-wrap gap-2">
            {levels.map((level) => (
              <button
                key={level.id}
                onClick={() => setSelectedLevel(level.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  selectedLevel === level.id
                    ? level.id === 'all'
                      ? 'bg-gray-200 text-gray-800'
                      : level.color || 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {level.name}
              </button>
            ))}
          </div>
        </div>

        {/* Sort options */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <span className="w-1.5 h-4 bg-purple-500 rounded-sm mr-2"></span>
            Sắp xếp theo
          </h4>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="block w-full rounded-lg border-0 py-2.5 pl-4 pr-10 text-gray-900 ring-1 ring-inset ring-gray-200 focus:ring-2 focus:ring-blue-600 sm:text-sm bg-white"
          >
            {sortOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Apply filters button on mobile */}
        <div className="pt-4 md:hidden">
          <button
            type="button"
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Áp dụng bộ lọc
          </button>
        </div>
      </div>
    </div>
  );
} 