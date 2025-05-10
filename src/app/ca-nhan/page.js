'use client';

import { useState, useEffect } from 'react';
import { 
  UserCircleIcon,
  Cog6ToothIcon,
  ExclamationCircleIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';

export default function PersonalPage() {
  const [isEditing, setIsEditing] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  
  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('Đang gọi API lấy thông tin người dùng...');
        
        const response = await fetch('/api/users/me');
        console.log('Phản hồi từ API:', response.status, response.statusText);
        
        const result = await response.json();
        console.log('Dữ liệu phản hồi:', result);

        if (!result.success) {
          throw new Error(result.error || 'Không thể lấy thông tin người dùng');
        }

        console.log('Nhận được dữ liệu người dùng:', result.data);
        
        // Xử lý dữ liệu người dùng
        const data = result.data;
        
        // Thiết lập dữ liệu người dùng
        setUserData({
          ...data,
          name: data.displayName || '',
          email: data.email || '',
          phone: data.phoneNumber || '',
          role: data.role || 'user',
          createdAt: data.createdAt || '',
          additionalInfo: data.additionalInfo || {}
        });
        
        // Cập nhật form dữ liệu
        setFormData({
          name: data.displayName || '',
          email: data.email || '',
          phone: data.phoneNumber || '',
          bio: data.additionalInfo?.bio || ''
        });
      } catch (error) {
        console.error('Lỗi khi lấy thông tin người dùng:', error);
        setError(error.message || 'Có lỗi xảy ra khi tải dữ liệu');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Personal Info form
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    bio: ''
  });
  
  // Kiểm tra định dạng E.164 cho số điện thoại
  const isValidPhoneNumber = (phone) => {
    if (!phone || phone.trim() === '') return true; // Cho phép trống
    return phone.startsWith('+') && phone.length >= 8;
  };
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Xóa thông báo lỗi/thành công khi người dùng gõ
    setFormError('');
    setFormSuccess('');
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setIsFormSubmitting(true);
    
    // Kiểm tra định dạng số điện thoại
    if (formData.phone && !isValidPhoneNumber(formData.phone)) {
      setFormError('Số điện thoại phải theo định dạng quốc tế (+84xxxxxxxxx)');
      setIsFormSubmitting(false);
      return;
    }
    
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: formData.name,
          phoneNumber: formData.phone || null,
          additionalInfo: {
            bio: formData.bio,
            ...(userData?.additionalInfo || {})
          }
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi cập nhật thông tin');
      }
      
      // Cập nhật dữ liệu người dùng ở local
      setUserData(prev => ({
        ...prev,
        displayName: formData.name,
        name: formData.name,
        phoneNumber: formData.phone,
        phone: formData.phone,
        additionalInfo: {
          ...(prev?.additionalInfo || {}),
          bio: formData.bio
        },
        bio: formData.bio
      }));

      setFormSuccess('Cập nhật thông tin thành công!');
      setTimeout(() => {
        setIsEditing(false);
        setFormSuccess('');
      }, 1500);
    } catch (error) {
      console.error('Lỗi khi cập nhật thông tin:', error);
      setFormError(error.message || 'Có lỗi xảy ra khi cập nhật thông tin');
    } finally {
      setIsFormSubmitting(false);
    }
  };
  
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear messages when typing
    setPasswordError('');
    setPasswordSuccess('');
  };
  
  const validatePassword = (password) => {
    // Kiểm tra độ phức tạp của mật khẩu
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    const errors = [];
    
    if (password.length < 8) {
      errors.push('Mật khẩu phải có ít nhất 8 ký tự');
    }
    
    if (!hasUpperCase) {
      errors.push('Mật khẩu phải có ít nhất một chữ hoa');
    }
    
    if (!hasLowerCase) {
      errors.push('Mật khẩu phải có ít nhất một chữ thường');
    }
    
    if (!hasNumber) {
      errors.push('Mật khẩu phải có ít nhất một chữ số');
    }
    
    return errors;
  };
  
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    // Reset messages
    setPasswordError('');
    setPasswordSuccess('');
    
    // Validate required fields
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    
    // Validate password match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp');
      return;
    }
    
    // Validate password complexity
    const passwordErrors = validatePassword(passwordForm.newPassword);
    if (passwordErrors.length > 0) {
      setPasswordError(passwordErrors.join('. '));
      return;
    }
    
    try {
      setIsPasswordLoading(true);
      
      console.log('Đang gửi yêu cầu đổi mật khẩu...');
      const response = await fetch('/api/users/me/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi đổi mật khẩu');
      }

      console.log('Đổi mật khẩu thành công!');
      setPasswordSuccess('Đổi mật khẩu thành công!');
      
      // Reset form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Lỗi khi đổi mật khẩu:', error);
      setPasswordError(error.message || 'Có lỗi xảy ra khi đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2"></div>
          <p className="text-gray-500">Đang tải thông tin...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Đã có lỗi xảy ra</h3>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <UserCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Không tìm thấy thông tin</h3>
          <p className="text-gray-500">Vui lòng đăng nhập để xem thông tin cá nhân</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="p-6 flex items-center">
            <div className="h-20 w-20 rounded-full bg-indigo-100 flex items-center justify-center mr-6">
              <UserCircleIcon className="h-14 w-14 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{userData.name || 'Người dùng'}</h1>
              <p className="text-sm text-gray-500">{userData.email || ''}</p>
            </div>
          </div>
        </div>
        
        {/* Thông tin cá nhân */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Thông tin cá nhân</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center text-sm text-indigo-600 hover:text-indigo-800"
              >
                <Cog6ToothIcon className="h-4 w-4 mr-1" />
                Chỉnh sửa
              </button>
            )}
          </div>
          
          <div className="p-4">
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">Họ và tên</label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled
                    className="mt-1 block w-full rounded-md bg-gray-100 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                  <p className="mt-1 text-xs text-gray-500">Email không thể thay đổi</p>
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Số điện thoại</label>
                  <input
                    type="text"
                    name="phone"
                    id="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="+84..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                  <p className="mt-1 text-xs text-gray-500">Định dạng quốc tế: +84xxxxxxxxx</p>
                </div>
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">Giới thiệu</label>
                  <textarea
                    name="bio"
                    id="bio"
                    rows={3}
                    value={formData.bio}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  />
                </div>
                
                {/* Hiển thị thông báo lỗi/thành công */}
                {formError && (
                  <div className="text-sm text-red-600 bg-red-50 p-2 rounded-md">
                    <div className="flex">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                      {formError}
                    </div>
                  </div>
                )}
                
                {formSuccess && (
                  <div className="text-sm text-green-600 bg-green-50 p-2 rounded-md">
                    <div className="flex">
                      <CheckBadgeIcon className="h-5 w-5 text-green-500 mr-2" />
                      {formSuccess}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFormError('');
                      setFormSuccess('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    disabled={isFormSubmitting}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 flex items-center"
                    disabled={isFormSubmitting}
                  >
                    {isFormSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang xử lý...
                      </>
                    ) : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Họ và tên</h3>
                    <p className="mt-1">{userData.name || 'Chưa cập nhật'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Email</h3>
                    <p className="mt-1">{userData.email || 'Chưa cập nhật'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Số điện thoại</h3>
                    <p className="mt-1">{userData.phone || 'Chưa cập nhật'}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Vai trò</h3>
                    <p className="mt-1">{userData.role === 'admin' ? 'Quản trị viên' : userData.role === 'teacher' ? 'Giảng viên' : 'Học viên'}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Giới thiệu</h3>
                  <p className="mt-1">{userData.additionalInfo?.bio || 'Chưa cập nhật'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Đổi mật khẩu */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Đổi mật khẩu</h2>
          </div>
          <div className="p-4">
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  name="currentPassword"
                  id="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  placeholder="Nhập mật khẩu hiện tại"
                />
              </div>
              
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  name="newPassword"
                  id="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  placeholder="Nhập mật khẩu mới"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.
                </p>
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  id="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
              
              <div className="pt-2">
                {passwordError && (
                  <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded-md">
                    <div className="flex">
                      <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                      {passwordError}
                    </div>
                  </div>
                )}
                
                {passwordSuccess && (
                  <div className="mb-3 text-sm text-green-600 bg-green-50 p-2 rounded-md">
                    <div className="flex">
                      <CheckBadgeIcon className="h-5 w-5 text-green-500 mr-2" />
                      {passwordSuccess}
                    </div>
                  </div>
                )}
                
                <button
                  type="submit"
                  className="w-full md:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  disabled={isPasswordLoading}
                >
                  {isPasswordLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Đang xử lý...
                    </>
                  ) : (
                    'Cập nhật mật khẩu'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 