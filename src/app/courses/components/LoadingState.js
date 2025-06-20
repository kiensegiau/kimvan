export default function LoadingState() {
  // Create an array of 6 items for skeleton loading
  const skeletonItems = Array(6).fill(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {skeletonItems.map((_, index) => (
        <div 
          key={index} 
          className="bg-white rounded-xl shadow-sm overflow-hidden flex flex-col h-full animate-pulse"
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          {/* Skeleton image with gradient overlay */}
          <div className="h-48 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer"></div>
          
          {/* Skeleton content */}
          <div className="p-6 flex-grow flex flex-col">
            {/* Skeleton title */}
            <div className="h-7 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer rounded-lg w-3/4 mb-4"></div>
            
            {/* Skeleton description */}
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer rounded-lg w-full mb-2"></div>
            <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer rounded-lg w-5/6 mb-5"></div>
            
            {/* Divider */}
            <div className="w-12 h-1 bg-gray-200 rounded mb-5"></div>
            
            {/* Skeleton meta */}
            <div className="flex space-x-4 mb-5">
              <div className="h-6 w-16 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer rounded-full"></div>
              <div className="h-6 w-24 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer rounded-full"></div>
              <div className="h-6 w-20 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer rounded-full"></div>
            </div>
            
            {/* Skeleton instructor */}
            <div className="h-5 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer rounded-lg w-1/2 mb-5"></div>
            
            {/* Skeleton price and CTA */}
            <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
              <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer rounded-lg w-20"></div>
              <div className="h-9 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:400%_100%] animate-shimmer rounded-lg w-24"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 