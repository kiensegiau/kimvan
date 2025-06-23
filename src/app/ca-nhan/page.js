'use client';

import { useState, useEffect } from 'react';
import { 
  UserCircleIcon,
  Cog6ToothIcon,
  ExclamationCircleIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';
import useUserData from '@/hooks/useUserData';

export default function PersonalPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordStrength, setPasswordStrength] = useState(0);
  
  // Sử dụng hook useUserData để lấy thông tin người dùng
  const { 
    userData: userDataFromHook, 
    loading: userDataLoading, 
    error: userDataError,
    refreshUserData
  } = useUserData();
  
  // Cập nhật userData từ hook
  useEffect(() => {
    if (!userDataLoading && userDataFromHook) {
      // Thiết lập dữ liệu người dùng với kiểm tra null/undefined
      setUserData({
        ...userDataFromHook,
        name: userDataFromHook?.displayName || '',
        email: userDataFromHook?.email || '',
        phone: userDataFromHook?.phoneNumber || '',
        role: userDataFromHook?.role || 'user',
        createdAt: userDataFromHook?.createdAt || '',
        additionalInfo: userDataFromHook?.additionalInfo || {}
      });
      
      // Cập nhật form dữ liệu
      setFormData({
        name: userDataFromHook?.displayName || '',
        email: userDataFromHook?.email || '',
        phone: userDataFromHook?.phoneNumber || '',
        bio: userDataFromHook?.additionalInfo?.bio || ''
      });
    }
    
    // Sử dụng error từ hook nếu có
    if (userDataError) {
      setError(userDataError);
    }
  }, [userDataFromHook, userDataLoading, userDataError]);

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
    
    try {
      const response = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: formData.name,
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
      
      // Cập nhật dữ liệu người dùng ở local với cấu trúc đã được sửa
      setUserData(prev => ({
        ...prev,
        displayName: formData.name,
        name: formData.name,
        additionalInfo: {
          ...(prev?.additionalInfo || {}),
          bio: formData.bio
        }
      }));

      // Làm mới dữ liệu trong hook useUserData
      refreshUserData();

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
  
  const validatePassword = (password) => {
    // Chỉ kiểm tra độ dài tối thiểu
    const errors = [];
    
    if (password.length < 6) {
      errors.push('Mật khẩu phải có ít nhất 6 ký tự');
    }
    
    return errors;
  };
  
  // Đánh giá độ mạnh của mật khẩu
  const calculatePasswordStrength = (password) => {
    if (!password) return 0;
    
    let score = 0;
    
    // Độ dài
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (password.length >= 10) score += 1;
    
    // Độ phức tạp
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // Chuẩn hóa điểm từ 0-100
    return Math.min(Math.floor((score / 7) * 100), 100);
  };
  
  const getPasswordStrengthLabel = (strength) => {
    if (strength === 0) return '';
    if (strength < 30) return 'Yếu';
    if (strength < 60) return 'Trung bình';
    if (strength < 80) return 'Khá';
    return 'Mạnh';
  };
  
  const getPasswordStrengthColor = (strength) => {
    if (strength === 0) return 'bg-gray-200';
    if (strength < 30) return 'bg-red-500';
    if (strength < 60) return 'bg-yellow-500';
    if (strength < 80) return 'bg-blue-500';
    return 'bg-green-500';
  };
  
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Tính toán độ mạnh của mật khẩu nếu đang thay đổi mật khẩu mới
    if (name === 'newPassword') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
    
    // Clear messages when typing
    setPasswordError('');
    setPasswordSuccess('');
  };
  
  const togglePasswordVisibility = (field) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };
  
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    setPasswordError('');
    setPasswordSuccess('');
    
    // Kiểm tra xác thực mật khẩu mới
    const passwordErrors = validatePassword(passwordForm.newPassword);
    if (passwordErrors.length > 0) {
      setPasswordError(passwordErrors.join('. '));
      return;
    }
    
    try {
      setIsPasswordLoading(true);
      
      const response = await fetch('/api/users/me/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newPassword: passwordForm.newPassword
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Có lỗi xảy ra khi đổi mật khẩu');
      }

      // Làm mới dữ liệu người dùng trong hook useUserData
      refreshUserData();
      
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
        {/* Header với thông tin cơ bản và ảnh đại diện */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-32 md:h-48"></div>
          <div className="px-6 py-4 md:px-8 md:py-6 flex flex-col md:flex-row items-center md:items-end -mt-16 md:-mt-20 relative">
            <div className="h-24 w-24 md:h-32 md:w-32 rounded-full bg-white p-1 shadow-lg mb-4 md:mb-0 md:mr-6">
              <div className="h-full w-full rounded-full bg-indigo-100 flex items-center justify-center">
                <UserCircleIcon className="h-20 w-20 md:h-24 md:w-24 text-indigo-600" />
              </div>
            </div>
            <div className="text-center md:text-left flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{userData.name || 'Người dùng'}</h1>
              <p className="text-sm text-gray-500 mt-1">{userData.email || ''}</p>
              <div className="mt-2 flex flex-wrap justify-center md:justify-start gap-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {userData.roleDisplayName || (userData.role === 'admin' ? 'Quản trị viên' : userData.role === 'teacher' ? 'Giảng viên' : 'Học viên')}
                </span>
                {userData.phone && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Đã xác thực
                  </span>
                )}
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="absolute top-4 right-4 md:static md:mt-0 flex items-center text-sm text-indigo-600 hover:text-indigo-800 bg-white rounded-full p-2 md:px-4 md:py-2 shadow-sm hover:shadow transition-all"
              >
                <Cog6ToothIcon className="h-4 w-4 mr-1" />
                <span className="hidden md:inline">Chỉnh sửa</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Nội dung chính */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cột thông tin cá nhân */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-lg mb-6">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Thông tin cá nhân
                </h2>
              </div>
              
              <div className="p-6">
                {isEditing ? (
                  <form onSubmit={handleSubmit} className="space-y-5">
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
                        disabled={true}
                        className="mt-1 block w-full rounded-md bg-gray-100 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                      />
                      <p className="mt-1 text-xs text-gray-500">Không thể thay đổi số điện thoại</p>
                    </div>
                    <div>
                      <label htmlFor="bio" className="block text-sm font-medium text-gray-700">Giới thiệu</label>
                      <textarea
                        name="bio"
                        id="bio"
                        rows={4}
                        value={formData.bio}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        placeholder="Viết đôi điều về bản thân..."
                      />
                    </div>
                    
                    {/* Hiển thị thông báo lỗi/thành công */}
                    {formError && (
                      <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                        <div className="flex">
                          <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                          <span>{formError}</span>
                        </div>
                      </div>
                    )}
                    
                    {formSuccess && (
                      <div className="text-sm text-green-600 bg-green-50 p-3 rounded-md">
                        <div className="flex">
                          <CheckBadgeIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                          <span>{formSuccess}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setFormError('');
                          setFormSuccess('');
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        disabled={isFormSubmitting}
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center"
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
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500">Họ và tên</h3>
                        <p className="mt-1 font-medium">{userData.name || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500">Email</h3>
                        <p className="mt-1 font-medium">{userData.email || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500">Số điện thoại</h3>
                        <p className="mt-1 font-medium">{userData.phone || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-gray-500">Vai trò</h3>
                        <p className="mt-1 font-medium">{userData.roleDisplayName || (userData.role === 'admin' ? 'Quản trị viên' : userData.role === 'teacher' ? 'Giảng viên' : 'Học viên')}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-gray-500">Giới thiệu</h3>
                      <p className="mt-1">{userData.additionalInfo?.bio || 'Chưa cập nhật thông tin giới thiệu.'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Cột đổi mật khẩu */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-lg shadow-lg">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Đổi mật khẩu
                </h2>
              </div>
              <div className="p-6">
                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                      Mật khẩu hiện tại (không bắt buộc)
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type={showPassword.current ? "text" : "password"}
                        name="currentPassword"
                        id="currentPassword"
                        value={passwordForm.currentPassword}
                        onChange={handlePasswordChange}
                        className="block w-full pr-10 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                        placeholder="Nhập mật khẩu hiện tại nếu muốn"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-3 flex items-center"
                        onClick={() => togglePasswordVisibility('current')}
                      >
                        {showPassword.current ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                      Mật khẩu mới
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type={showPassword.new ? "text" : "password"}
                        name="newPassword"
                        id="newPassword"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                        className="block w-full pr-10 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                        placeholder="Nhập mật khẩu mới"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-3 flex items-center"
                        onClick={() => togglePasswordVisibility('new')}
                      >
                        {showPassword.new ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {/* Thanh đánh giá độ mạnh mật khẩu */}
                    {passwordForm.newPassword && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Độ mạnh mật khẩu:</span>
                          <span className="text-xs font-medium">{getPasswordStrengthLabel(passwordStrength)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength)}`} 
                            style={{ width: `${passwordStrength}%` }}
                          ></div>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          Mật khẩu phải có ít nhất 6 ký tự
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type={showPassword.confirm ? "text" : "password"}
                        name="confirmPassword"
                        id="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                        className="block w-full pr-10 border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
                        placeholder="Nhập lại mật khẩu mới"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 px-3 flex items-center"
                        onClick={() => togglePasswordVisibility('confirm')}
                      >
                        {showPassword.confirm ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    {passwordError && (
                      <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-md">
                        <div className="flex">
                          <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                          <span>{passwordError}</span>
                        </div>
                      </div>
                    )}
                    
                    {passwordSuccess && (
                      <div className="mb-4 text-sm text-green-600 bg-green-50 p-3 rounded-md">
                        <div className="flex">
                          <CheckBadgeIcon className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                          <span>{passwordSuccess}</span>
                        </div>
                      </div>
                    )}
                    
                    <button
                      type="submit"
                      className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
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
      </div>
    </div>
  );
} 