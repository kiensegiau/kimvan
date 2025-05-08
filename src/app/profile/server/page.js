import { withAuth, getCurrentUser } from '@/utils/withAuth';

// Server Component với xác thực
export default async function ProfileServerPage() {
  // Lấy thông tin người dùng từ token
  const user = await getCurrentUser();
  
  // Nếu không có user, withAuth sẽ tự động chuyển hướng
  // nên nếu code chạy đến đây, user đã tồn tại

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Hồ sơ người dùng (Server Component)</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex flex-col md:flex-row">
          <div className="w-full md:w-1/3 mb-6 md:mb-0">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'Avatar người dùng'} 
                className="rounded-full w-32 h-32 mx-auto border-4 border-gray-200"
              />
            ) : (
              <div className="rounded-full w-32 h-32 mx-auto bg-blue-500 flex items-center justify-center">
                <span className="text-3xl text-white font-bold">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            )}
          </div>
          
          <div className="w-full md:w-2/3">
            <h2 className="text-xl font-bold">
              {user?.displayName || 'Người dùng'}
            </h2>
            
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p>{user?.email}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Trạng thái email</p>
                <p>
                  {user?.emailVerified 
                    ? <span className="text-green-600">Đã xác thực</span>
                    : <span className="text-red-600">Chưa xác thực</span>
                  }
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Vai trò</p>
                <p className="capitalize">{user?.role || 'Người dùng'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">ID người dùng</p>
                <p className="text-sm text-gray-700">{user?.uid}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-blue-50 p-4 rounded-lg">
        <p className="text-blue-800 font-medium">Đây là Server Component!</p>
        <p className="text-sm text-blue-600 mt-1">
          Trang này được render hoàn toàn ở server, không sử dụng JavaScript ở client.
          Xác thực được thực hiện thông qua API server-side.
        </p>
      </div>
    </div>
  );
}

// Bảo vệ trang này với withAuth
export const generateMetadata = withAuth(async ({ user }) => {
  return {
    title: `Hồ sơ của ${user?.displayName || user?.email || 'Người dùng'}`,
    description: 'Trang hồ sơ người dùng'
  };
}, { requireAuth: true }); 