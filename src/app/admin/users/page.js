'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, PencilIcon, TrashIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [hasMongoConnection, setHasMongoConnection] = useState(true);

  // Hàm lấy danh sách người dùng
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi lấy danh sách người dùng');
      }
      
      setUsers(data.data || []);
      setHasMongoConnection(true);
    } catch (err) {
      console.error("Lỗi khi lấy danh sách người dùng:", err);
      
      // Kiểm tra lỗi kết nối MongoDB
      if (err.message.includes('MongoDB') || err.message.includes('connection')) {
        setHasMongoConnection(false);
      }
      
      setError(err.message);
      
      // Sử dụng dữ liệu mẫu nếu không thể kết nối
      setUsers([
        {
          id: 'user1',
          email: 'nguyenvana@example.com',
          displayName: 'Nguyễn Văn A',
          phoneNumber: '+84123456789',
          emailVerified: true,
          role: 'user',
          status: 'active',
          createdAt: '2023-01-15T00:00:00.000Z',
          lastLoginAt: '2023-06-01T00:00:00.000Z',
        },
        {
          id: 'admin1',
          email: 'tranthib@example.com',
          displayName: 'Trần Thị B',
          phoneNumber: '+84987654321',
          emailVerified: true,
          role: 'admin',
          status: 'active',
          createdAt: '2023-01-20T00:00:00.000Z',
          lastLoginAt: '2023-06-10T00:00:00.000Z',
        },
        {
          id: 'user2',
          email: 'levanc@example.com',
          displayName: 'Lê Văn C',
          phoneNumber: '',
          emailVerified: false,
          role: 'user',
          status: 'inactive',
          createdAt: '2023-02-01T00:00:00.000Z',
          lastLoginAt: '2023-05-01T00:00:00.000Z',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Lấy danh sách người dùng khi component được tạo
  useEffect(() => {
    fetchUsers();
  }, []);

  // Lọc người dùng theo từ khóa tìm kiếm
  const filteredUsers = users.filter(user =>
    (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.phoneNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Hàm mở modal chỉnh sửa
  const handleEdit = (user) => {
    setCurrentUser({
      ...user,
      // Chuyển đổi trạng thái từ Firebase/MongoDB sang giao diện
      status: user.disabled ? 'inactive' : user.status || 'active',
    });
    setShowModal(true);
    setApiError(null);
  };

  // Hàm mở modal thêm mới
  const handleAdd = () => {
    setCurrentUser({
      id: null,
      displayName: '',
      email: '',
      password: '',
      phoneNumber: '',
      role: 'user',
      status: 'active',
      additionalInfo: {},
    });
    setShowModal(true);
    setApiError(null);
  };

  // Hàm xử lý xóa người dùng
  const handleDelete = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
      try {
        const response = await fetch(`/api/users?id=${id}`, {
          method: 'DELETE',
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Không thể xóa người dùng');
        }
        
        alert('Xóa người dùng thành công!');
        
        // Cập nhật danh sách sau khi xóa
        setUsers(users.filter(user => user.id !== id));
      } catch (err) {
        console.error('Lỗi khi xóa người dùng:', err);
        alert(`Lỗi khi xóa người dùng: ${err.message}`);
      }
    }
  };

  // Hàm lưu thông tin người dùng
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setApiError(null);
    
    try {
      let response;
      
      if (currentUser.id) {
        // Cập nhật người dùng hiện có
        response = await fetch(`/api/users?id=${currentUser.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            displayName: currentUser.displayName,
            phoneNumber: currentUser.phoneNumber,
            role: currentUser.role,
            status: currentUser.status,
            additionalInfo: currentUser.additionalInfo,
          }),
        });
      } else {
        // Tạo người dùng mới
        response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: currentUser.email,
            password: currentUser.password,
            displayName: currentUser.displayName,
            phoneNumber: currentUser.phoneNumber,
            role: currentUser.role,
            status: currentUser.status,
            additionalInfo: currentUser.additionalInfo,
          }),
        });
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi lưu thông tin người dùng');
      }
      
      // Đóng modal và làm mới danh sách
      setShowModal(false);
      setCurrentUser(null);
      fetchUsers();
      
    } catch (err) {
      console.error('Lỗi khi lưu thông tin người dùng:', err);
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Hàm làm mới danh sách người dùng
  const handleRefresh = () => {
    fetchUsers();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Quản lý người dùng</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowPathIcon className="-ml-1 mr-1 h-5 w-5 text-gray-500" />
            Làm mới
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Thêm người dùng
          </button>
        </div>
      </div>

      {/* Thông báo lỗi */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Đã xảy ra lỗi khi lấy dữ liệu</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Tìm kiếm người dùng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2"></div>
              <p className="text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người dùng</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Điện thoại</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vai trò</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Ngày tạo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                              {user.photoURL ? (
                                <img className="h-10 w-10 rounded-full" src={user.photoURL} alt="" />
                              ) : (
                                <span className="text-lg font-medium">
                                  {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.displayName || 'Chưa cập nhật'}</div>
                              <div className="text-xs text-gray-500 truncate max-w-xs">ID: {user.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{user.email}</div>
                          {user.emailVerified && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Đã xác thực
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                          {user.phoneNumber || 'Chưa cập nhật'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            (user.status === 'active' && !user.disabled) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {(user.status === 'active' && !user.disabled) ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                          {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                        {searchTerm ? 'Không tìm thấy người dùng phù hợp' : 'Chưa có người dùng nào'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSave}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                    {currentUser.id ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
                  </h3>

                  {/* Hiển thị lỗi API nếu có */}
                  {apiError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm text-red-700">{apiError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Thông tin cơ bản */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Họ tên</label>
                      <input
                        type="text"
                        value={currentUser.displayName || ''}
                        onChange={(e) => setCurrentUser({ ...currentUser, displayName: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Email {currentUser.id ? '(không thể thay đổi)' : '*'}
                      </label>
                      <input
                        type="email"
                        value={currentUser.email || ''}
                        onChange={(e) => setCurrentUser({ ...currentUser, email: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        disabled={!!currentUser.id}
                        required={!currentUser.id}
                      />
                    </div>
                    
                    {/* Chỉ hiện mật khẩu khi tạo mới */}
                    {!currentUser.id && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Mật khẩu *</label>
                        <input
                          type="password"
                          value={currentUser.password || ''}
                          onChange={(e) => setCurrentUser({ ...currentUser, password: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          required
                          minLength={6}
                        />
                        <p className="mt-1 text-xs text-gray-500">Mật khẩu phải có ít nhất 6 ký tự</p>
                      </div>
                    )}
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Số điện thoại</label>
                      <input
                        type="text"
                        value={currentUser.phoneNumber || ''}
                        onChange={(e) => setCurrentUser({ ...currentUser, phoneNumber: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        placeholder="+84123456789"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Vai trò</label>
                      <select
                        value={currentUser.role || 'user'}
                        onChange={(e) => setCurrentUser({ ...currentUser, role: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="user">Người dùng</option>
                        <option value="admin">Quản trị viên</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Trạng thái</label>
                      <select
                        value={currentUser.status || 'active'}
                        onChange={(e) => setCurrentUser({ ...currentUser, status: e.target.value })}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      >
                        <option value="active">Đang hoạt động</option>
                        <option value="inactive">Ngừng hoạt động</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 