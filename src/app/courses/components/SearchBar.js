import { useState } from 'react';
import { MagnifyingGlassIcon, FunnelIcon } from '@heroicons/react/24/outline';

export default function SearchBar({ searchTerm, onSearch, toggleFilters, showFilters }) {
  const [inputValue, setInputValue] = useState(searchTerm);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(inputValue);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      onSearch(inputValue);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <MagnifyingGlassIcon className="h-5 w-5 text-blue-500" aria-hidden="true" />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className="block w-full rounded-lg border-0 py-3 pl-12 pr-4 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm"
            placeholder="Tìm kiếm khóa học theo tên, mô tả hoặc giảng viên..."
          />
          <button
            type="submit"
            className="absolute inset-y-0 right-0 flex items-center px-4 rounded-r-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <span className="hidden sm:inline">Tìm kiếm</span>
            <MagnifyingGlassIcon className="h-5 w-5 sm:ml-2 sm:h-4 sm:w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={toggleFilters}
          className={`inline-flex items-center justify-center px-4 py-3 sm:py-0 border border-gray-200 rounded-lg text-sm font-medium ${
            showFilters 
              ? 'bg-blue-50 text-blue-700 border-blue-200' 
              : 'bg-white text-gray-700 hover:bg-gray-50'
          } transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
        >
          <FunnelIcon className="h-5 w-5 mr-2" />
          <span>{showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}</span>
        </button>
      </form>
      
      {/* Quick filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="text-sm text-gray-500 self-center mr-1">Lọc nhanh:</span>
        <button 
          className="px-3 py-1.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
          onClick={() => onSearch("Toán")}
        >
          Toán học
        </button>
        <button 
          className="px-3 py-1.5 text-xs font-medium rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
          onClick={() => onSearch("Tiếng Anh")}
        >
          Tiếng Anh
        </button>
        <button 
          className="px-3 py-1.5 text-xs font-medium rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
          onClick={() => onSearch("Lập trình")}
        >
          Lập trình
        </button>
        <button 
          className="px-3 py-1.5 text-xs font-medium rounded-full bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
          onClick={() => onSearch("Nâng cao")}
        >
          Nâng cao
        </button>
        <button 
          className="px-3 py-1.5 text-xs font-medium rounded-full bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
          onClick={() => onSearch("HOT")}
        >
          Khóa học HOT
        </button>
      </div>
    </div>
  );
} 