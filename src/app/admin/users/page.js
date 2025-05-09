'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, PencilIcon, TrashIcon, ExclamationCircleIcon, ArrowPathIcon, ShieldCheckIcon, UserIcon, KeyIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import { auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hasMongoConnection, setHasMongoConnection] = useState(true);
  const [newPassword, setNewPassword] = useState('');

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
      
      // Thông báo thành công nếu là làm mới
      if (!loading) {
        toast.success('Đã cập nhật danh sách người dùng');
      }
    } catch (err) {
      console.error("Lỗi khi lấy danh sách người dùng:", err);
      
      // Kiểm tra lỗi kết nối MongoDB
      if (err.message.includes('MongoDB') || err.message.includes('connection')) {
        setHasMongoConnection(false);
      }
      
      setError(err.message);
      setUsers([]);
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Lấy danh sách người dùng khi component được tạo
  useEffect(() => {
    fetchUsers();
  }, []);

  // Lọc người dùng theo từ khóa tìm kiếm, vai trò và trạng thái
  const filteredUsers = users.filter(user => {
    // Lọc theo từ khóa tìm kiếm
    const matchesSearch = 
      (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phoneNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // Lọc theo vai trò
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    // Lọc theo trạng thái
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && !user.disabled) ||
      (statusFilter === 'inactive' && user.disabled);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

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
        
        toast.success('Xóa người dùng thành công!');
        
        // Cập nhật danh sách sau khi xóa
        setUsers(users.filter(user => user.id !== id));
      } catch (err) {
        console.error('Lỗi khi xóa người dùng:', err);
        toast.error(`Lỗi khi xóa người dùng: ${err.message}`);
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
      
      // Hiển thị thông báo thành công
      toast.success(currentUser.id 
        ? 'Cập nhật người dùng thành công' 
        : 'Tạo người dùng mới thành công');
      
    } catch (err) {
      console.error('Lỗi khi lưu thông tin người dùng:', err);
      setApiError(err.message);
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Hàm làm mới danh sách người dùng
  const handleRefresh = () => {
    fetchUsers();
  };

  // Hàm mở modal đặt lại mật khẩu
  const handleResetPassword = (user) => {
    setCurrentUser(user);
    setShowPasswordModal(true);
    setNewPassword('');
    setApiError(null);
  };

  // Hàm đặt lại mật khẩu
  const handleSavePassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    setApiError(null);
    
    try {
      // Gọi API đặt lại mật khẩu
      const response = await fetch(`/api/users?id=${currentUser.id}&action=reset-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: newPassword,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi đặt lại mật khẩu');
      }
      
      // Đóng modal và thông báo thành công
      setShowPasswordModal(false);
      setCurrentUser(null);
      setNewPassword('');
      toast.success('Đặt lại mật khẩu thành công');
      
    } catch (err) {
      console.error('Lỗi khi đặt lại mật khẩu:', err);
      setApiError(err.message);
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Hàm xác thực email
  const handleVerifyEmail = async (userId) => {
    try {
      // Gọi API xác thực email
      const response = await fetch(`/api/users?id=${userId}&action=verify-email`, {
        method: 'PUT',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi xác thực email');
      }
      
      // Làm mới danh sách và thông báo thành công
      toast.success('Đánh dấu email đã xác thực thành công');
      fetchUsers();
      
    } catch (err) {
      console.error('Lỗi khi xác thực email:', err);
      toast.error(`Lỗi: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toaster cho thông báo */}
      <div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#ffffff',
              color: '#333333',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </div>
      
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
          {/* Bộ lọc và tìm kiếm */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Tìm kiếm người dùng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">Tất cả vai trò</option>
                <option value="admin">Quản trị viên</option>
                <option value="user">Người dùng</option>
                <option value="editor">Biên tập viên</option>
              </select>
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Đã vô hiệu hóa</option>
              </select>
            </div>
          </div>
          
          {/* Hiển thị số lượng người dùng */}
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">
              Hiển thị {filteredUsers.length} trong tổng số {users.length} người dùng
            </p>
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
                            <div className="flex-shrink-0 h-10 w-10">
                              {user.photoURL ? (
                                <img className="h-10 w-10 rounded-full" src={user.photoURL} alt={user.displayName || 'User'} />
                              ) : (
                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                  <UserIcon className="h-6 w-6 text-gray-500" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {user.displayName || 'Chưa có tên'}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {user.id.substring(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{user.email}</div>
                          <div className="text-xs text-gray-500">
                            {user.emailVerified ? 
                              <span className="text-green-600">Đã xác thực</span> : 
                              <span className="flex items-center text-yellow-600">
                                Chưa xác thực
                                <button
                                  onClick={() => handleVerifyEmail(user.id)}
                                  className="ml-1 text-blue-600 hover:text-blue-800"
                                  title="Đánh dấu đã xác thực"
                                >
                                  <EnvelopeIcon className="h-4 w-4" />
                                </button>
                              </span>}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          <div className="text-sm text-gray-900">{user.phoneNumber || '—'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.role === 'admin' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                              <ShieldCheckIcon className="h-4 w-4 mr-1" />
                              Quản trị viên
                            </span>
                          ) : user.role === 'editor' ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              Biên tập viên
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                              Người dùng
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.disabled ? (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                              Đã vô hiệu hóa
                            </span>
                          ) : (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                              Đang hoạt động
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                          <div className="text-sm text-gray-900">
                            {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(user.createdAt).toLocaleTimeString('vi-VN')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleResetPassword(user)}
                            className="text-blue-600 hover:text-blue-900 mr-3"
                            title="Đặt lại mật khẩu"
                          >
                            <KeyIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                            title="Chỉnh sửa"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Xóa"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                        {searchTerm || roleFilter !== 'all' || statusFilter !== 'all' ? 
                          'Không tìm thấy người dùng phù hợp với bộ lọc.' : 
                          'Chưa có người dùng nào trong hệ thống.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal thêm/chỉnh sửa người dùng */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {currentUser.id ? 'Chỉnh sửa thông tin người dùng' : 'Thêm người dùng mới'}
              </h3>
            </div>
            
            <form onSubmit={handleSave}>
              <div className="px-6 py-4 space-y-4">
                {/* Hiển thị lỗi API */}
                {apiError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
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
                
                {/* Email - chỉ hiển thị khi thêm mới */}
                {!currentUser.id && (
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      value={currentUser.email || ''}
                      onChange={(e) => setCurrentUser({...currentUser, email: e.target.value})}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                )}
                
                {/* Mật khẩu - chỉ hiển thị khi thêm mới */}
                {!currentUser.id && (
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Mật khẩu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      id="password"
                      value={currentUser.password || ''}
                      onChange={(e) => setCurrentUser({...currentUser, password: e.target.value})}
                      required
                      minLength={6}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">Mật khẩu phải có ít nhất 6 ký tự</p>
                  </div>
                )}
                
                {/* Tên hiển thị */}
                <div>
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-700">
                    Tên hiển thị
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    value={currentUser.displayName || ''}
                    onChange={(e) => setCurrentUser({...currentUser, displayName: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                </div>
                
                {/* Số điện thoại */}
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    id="phoneNumber"
                    value={currentUser.phoneNumber || ''}
                    onChange={(e) => setCurrentUser({...currentUser, phoneNumber: e.target.value})}
                    placeholder="+84..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Định dạng quốc tế: +84xxxxxxxxx</p>
                </div>
                
                {/* Vai trò */}
                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                    Vai trò
                  </label>
                  <select
                    id="role"
                    value={currentUser.role || 'user'}
                    onChange={(e) => setCurrentUser({...currentUser, role: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="user">Người dùng</option>
                    <option value="editor">Biên tập viên</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>
                
                {/* Trạng thái */}
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                    Trạng thái
                  </label>
                  <select
                    id="status"
                    value={currentUser.status || 'active'}
                    onChange={(e) => setCurrentUser({...currentUser, status: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Vô hiệu hóa</option>
                  </select>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setCurrentUser(null);
                    setApiError(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {saving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Đang lưu...
                    </span>
                  ) : (
                    'Lưu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal đặt lại mật khẩu */}
      {showPasswordModal && currentUser && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Đặt lại mật khẩu cho {currentUser.email}
              </h3>
            </div>
            
            <form onSubmit={handleSavePassword}>
              <div className="px-6 py-4 space-y-4">
                {/* Hiển thị lỗi API */}
                {apiError && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
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
                
                {/* Mật khẩu mới */}
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                    Mật khẩu mới <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Mật khẩu phải có ít nhất 6 ký tự</p>
                </div>
              </div>
              
              <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentUser(null);
                    setApiError(null);
                    setNewPassword('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || newPassword.length < 6}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {saving ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Đang lưu...
                    </span>
                  ) : (
                    'Đặt lại mật khẩu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 