'use client';

import { useState, useEffect } from 'react';
import { 
  UserCircleIcon, 
  AcademicCapIcon, 
  ClockIcon, 
  CheckBadgeIcon,
  Cog6ToothIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ChartBarIcon,
  BellIcon,
  ChevronRightIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import Image from 'next/image';
import Link from 'next/link';

export default function PersonalPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  
  // Mock user data
  const userData = {
    name: "Nguyễn Minh Anh",
    role: "Học sinh lớp 11A1",
    email: "minhanh@example.com",
    avatar: "/placeholder-avatar.jpg",
    joinDate: "01/09/2022",
    bio: "Học sinh chăm chỉ, yêu thích môn Toán và Lý. Mục tiêu đạt điểm cao trong kỳ thi đại học sắp tới.",
    phone: "0912345678",
    school: "THPT Nguyễn Trãi",
    progress: 68,
    courses: 12,
    certificates: 3,
    totalHours: 156
  };
  
  // Mock enrolled courses
  const enrolledCourses = [
    {
      id: 1,
      name: "Toán nâng cao lớp 11",
      progress: 85,
      lastAccessed: "Hôm nay",
      image: "/course-math.jpg",
      instructor: "Thầy Nguyễn Văn A",
      completedLessons: 17,
      totalLessons: 20
    },
    {
      id: 2,
      name: "Luyện đề Vật lý THPT Quốc gia",
      progress: 45,
      lastAccessed: "Hôm qua",
      image: "/course-physics.jpg",
      instructor: "Cô Trần Thị B",
      completedLessons: 9,
      totalLessons: 20
    },
    {
      id: 3,
      name: "Hóa học cơ bản lớp 11",
      progress: 30,
      lastAccessed: "3 ngày trước",
      image: "/course-chemistry.jpg",
      instructor: "Thầy Phạm Văn C",
      completedLessons: 6,
      totalLessons: 20
    }
  ];
  
  // Mock certificates
  const certificates = [
    {
      id: 1,
      name: "Hoàn thành khóa học Toán Nâng Cao",
      date: "15/05/2023",
      issuer: "Kimvan Learning",
      image: "/cert-math.jpg"
    },
    {
      id: 2,
      name: "Chứng chỉ Tiếng Anh B1",
      date: "10/03/2023",
      issuer: "Trung tâm Ngoại ngữ Việt-Mỹ",
      image: "/cert-english.jpg"
    },
    {
      id: 3,
      name: "Hoàn thành khóa Lập trình Cơ bản",
      date: "20/01/2023",
      issuer: "Kimvan Learning",
      image: "/cert-coding.jpg"
    }
  ];
  
  // Mock recent activities
  const recentActivities = [
    {
      id: 1,
      action: "Hoàn thành bài học",
      subject: "Chương 5: Phương trình bậc 2",
      course: "Toán nâng cao lớp 11",
      time: "Hôm nay, 10:30"
    },
    {
      id: 2,
      action: "Đạt điểm cao",
      subject: "Bài kiểm tra: Chương 4",
      course: "Luyện đề Vật lý THPT Quốc gia",
      time: "Hôm qua, 16:45",
      score: "9.5/10"
    },
    {
      id: 3,
      action: "Đăng ký khóa học mới",
      subject: "Tiếng Anh luyện thi THPT Quốc gia",
      time: "2 ngày trước, 09:15"
    },
    {
      id: 4,
      action: "Nộp bài tập",
      subject: "Bài tập: Phản ứng oxi hóa khử",
      course: "Hóa học cơ bản lớp 11",
      time: "3 ngày trước, 20:10"
    }
  ];
  
  // Personal Info form
  const [formData, setFormData] = useState({
    name: userData.name,
    email: userData.email,
    phone: userData.phone,
    school: userData.school,
    bio: userData.bio
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    // Save changes logic would go here
    setIsEditing(false);
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
  
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    
    // Reset messages
    setPasswordError('');
    setPasswordSuccess('');
    
    // Validate
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Mật khẩu xác nhận không khớp');
      return;
    }
    
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }
    
    // Password complexity check (at least one uppercase, one lowercase, one number)
    const hasUpperCase = /[A-Z]/.test(passwordForm.newPassword);
    const hasLowerCase = /[a-z]/.test(passwordForm.newPassword);
    const hasNumber = /[0-9]/.test(passwordForm.newPassword);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setPasswordError('Mật khẩu phải có ít nhất một chữ hoa, một chữ thường và một số');
      return;
    }
    
    // Call API to change password
    changePassword(passwordForm);
  };
  
  // Function to call API for password change
  const changePassword = async (passwordData) => {
    try {
      // Show loading state
      setPasswordError('');
      setPasswordSuccess('');
      setIsPasswordLoading(true);
      
      // In a real app, this would be an API call
      // await fetch('/api/user/change-password', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify(passwordData),
      // });
      
      // Simulate API call with a timeout
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo purposes, we'll simulate success
      // In a real app, we would check the response status and handle errors
      
      // Show success message
      setPasswordSuccess('Đổi mật khẩu thành công!');
      
      // Reset form
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      // Handle errors from API
      setPasswordError(error.message || 'Có lỗi xảy ra khi đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsPasswordLoading(false);
    }
  };
  
  // Render different tab contents
  const renderTabContent = () => {
    switch(activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow p-4 flex flex-col">
                <span className="text-gray-500 text-sm">Khóa học đang học</span>
                <div className="flex items-center mt-2">
                  <AcademicCapIcon className="h-5 w-5 text-indigo-600 mr-2" />
                  <span className="text-xl font-bold text-gray-900">{userData.courses}</span>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 flex flex-col">
                <span className="text-gray-500 text-sm">Chứng chỉ</span>
                <div className="flex items-center mt-2">
                  <CheckBadgeIcon className="h-5 w-5 text-indigo-600 mr-2" />
                  <span className="text-xl font-bold text-gray-900">{userData.certificates}</span>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 flex flex-col">
                <span className="text-gray-500 text-sm">Tiến độ tổng quát</span>
                <div className="flex items-center mt-2">
                  <ChartBarIcon className="h-5 w-5 text-indigo-600 mr-2" />
                  <span className="text-xl font-bold text-gray-900">{userData.progress}%</span>
                </div>
              </div>
              <div className="bg-white rounded-lg shadow p-4 flex flex-col">
                <span className="text-gray-500 text-sm">Giờ học</span>
                <div className="flex items-center mt-2">
                  <ClockIcon className="h-5 w-5 text-indigo-600 mr-2" />
                  <span className="text-xl font-bold text-gray-900">{userData.totalHours}</span>
                </div>
              </div>
            </div>
            
            {/* Progress section */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Tiến độ học tập</h3>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  {enrolledCourses.map(course => (
                    <div key={course.id} className="flex flex-col">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{course.name}</span>
                        <span className="text-sm text-gray-500">{course.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-indigo-600 h-2.5 rounded-full" 
                          style={{ width: `${course.progress}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-gray-500">
                        <span>Học gần nhất: {course.lastAccessed}</span>
                        <span>{course.completedLessons}/{course.totalLessons} bài học</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Recent activity */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Hoạt động gần đây</h3>
                <button className="text-sm text-indigo-600 hover:text-indigo-800">Xem tất cả</button>
              </div>
              <div className="p-2">
                <ul className="divide-y divide-gray-200">
                  {recentActivities.map(activity => (
                    <li key={activity.id} className="p-3 hover:bg-gray-50 rounded-md">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5">
                          <span className="bg-indigo-100 rounded-full p-1.5 text-indigo-600">
                            {activity.action.includes("Hoàn thành") ? (
                              <CheckBadgeIcon className="h-4 w-4" />
                            ) : activity.action.includes("điểm") ? (
                              <StarIcon className="h-4 w-4" />
                            ) : activity.action.includes("Đăng ký") ? (
                              <AcademicCapIcon className="h-4 w-4" />
                            ) : (
                              <DocumentTextIcon className="h-4 w-4" />
                            )}
                          </span>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="text-sm font-medium text-gray-900">{activity.action}</div>
                          <div className="text-sm text-gray-500">
                            {activity.subject}
                            {activity.course && <span> • {activity.course}</span>}
                            {activity.score && <span className="ml-2 text-green-600 font-medium">{activity.score}</span>}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{activity.time}</div>
                        </div>
                        <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      case 'courses':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Khóa học của tôi</h3>
            </div>
            <div className="p-4">
              {enrolledCourses.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {enrolledCourses.map(course => (
                    <div key={course.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-36 bg-gray-200 relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <AcademicCapIcon className="h-12 w-12 text-gray-400" />
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent text-white p-3">
                          <h4 className="font-medium truncate">{course.name}</h4>
                          <p className="text-xs">{course.instructor}</p>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between mb-1 text-sm">
                          <span>Tiến độ: {course.progress}%</span>
                          <span>{course.completedLessons}/{course.totalLessons}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-indigo-600 h-2 rounded-full" 
                            style={{ width: `${course.progress}%` }}
                          ></div>
                        </div>
                        <div className="mt-4 flex justify-between items-center">
                          <span className="text-xs text-gray-500">Học gần nhất: {course.lastAccessed}</span>
                          <button className="bg-indigo-100 text-indigo-700 text-xs px-3 py-1 rounded-full hover:bg-indigo-200 transition-colors">
                            Tiếp tục
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto h-12 w-12 text-gray-400">
                    <BookOpenIcon className="h-12 w-12" />
                  </div>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Chưa có khóa học</h3>
                  <p className="mt-1 text-sm text-gray-500">Bắt đầu học bằng cách đăng ký một khóa học mới.</p>
                  <div className="mt-6">
                    <Link href="/khoa-hoc" className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                      Khám phá khóa học
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 'certificates':
        return (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Chứng chỉ của tôi</h3>
            </div>
            <div className="p-4">
              {certificates.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {certificates.map(cert => (
                    <div key={cert.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      <div className="h-40 bg-gray-100 flex items-center justify-center relative">
                        <CheckBadgeIcon className="h-16 w-16 text-indigo-200" />
                        <div className="absolute top-3 right-3 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          Đã cấp
                        </div>
                      </div>
                      <div className="p-4">
                        <h4 className="font-medium text-gray-900">{cert.name}</h4>
                        <p className="text-sm text-gray-500 mt-1">Cấp bởi: {cert.issuer}</p>
                        <p className="text-xs text-gray-400 mt-3">Ngày cấp: {cert.date}</p>
                        <div className="mt-4 flex justify-between">
                          <button className="text-indigo-600 text-sm hover:text-indigo-800 flex items-center">
                            Xem chi tiết
                            <ChevronRightIcon className="ml-1 h-4 w-4" />
                          </button>
                          <button className="text-indigo-600 text-sm hover:text-indigo-800 flex items-center">
                            Tải xuống
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CheckBadgeIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">Chưa có chứng chỉ</h3>
                  <p className="mt-1 text-sm text-gray-500">Hoàn thành các khóa học để nhận chứng chỉ.</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Thông tin cá nhân</h3>
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
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Số điện thoại</label>
                      <input
                        type="text"
                        name="phone"
                        id="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                      />
                    </div>
                    <div>
                      <label htmlFor="school" className="block text-sm font-medium text-gray-700">Trường học</label>
                      <input
                        type="text"
                        name="school"
                        id="school"
                        value={formData.school}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                      />
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
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Lưu thay đổi
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                      >
                        <Cog6ToothIcon className="h-4 w-4 mr-1" />
                        Chỉnh sửa
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Thông tin cơ bản</h4>
                        <div className="space-y-3">
                          <div>
                            <span className="text-sm text-gray-500 block">Họ và tên</span>
                            <span className="text-base text-gray-900">{userData.name}</span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block">Email</span>
                            <span className="text-base text-gray-900">{userData.email}</span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block">Số điện thoại</span>
                            <span className="text-base text-gray-900">{userData.phone}</span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block">Trường học</span>
                            <span className="text-base text-gray-900">{userData.school}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Thông tin khác</h4>
                        <div className="space-y-3">
                          <div>
                            <span className="text-sm text-gray-500 block">Vai trò</span>
                            <span className="text-base text-gray-900">{userData.role}</span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block">Ngày tham gia</span>
                            <span className="text-base text-gray-900">{userData.joinDate}</span>
                          </div>
                          <div>
                            <span className="text-sm text-gray-500 block">Giới thiệu</span>
                            <p className="text-base text-gray-900">{userData.bio}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Password Change Section */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Đổi mật khẩu</h3>
                <div className="text-sm text-gray-500">
                  <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                    Bảo mật
                  </span>
                </div>
              </div>
              <div className="p-4">
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                      Mật khẩu hiện tại
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="password"
                        name="currentPassword"
                        id="currentPassword"
                        value={passwordForm.currentPassword}
                        onChange={handlePasswordChange}
                        className="block w-full rounded-md border-gray-300 pr-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        placeholder="Nhập mật khẩu hiện tại"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                      Mật khẩu mới
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="password"
                        name="newPassword"
                        id="newPassword"
                        value={passwordForm.newPassword}
                        onChange={handlePasswordChange}
                        className="block w-full rounded-md border-gray-300 pr-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        placeholder="Nhập mật khẩu mới"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.
                    </p>
                  </div>
                  
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                      Xác nhận mật khẩu mới
                    </label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <input
                        type="password"
                        name="confirmPassword"
                        id="confirmPassword"
                        value={passwordForm.confirmPassword}
                        onChange={handlePasswordChange}
                        className="block w-full rounded-md border-gray-300 pr-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                        placeholder="Nhập lại mật khẩu mới"
                      />
                    </div>
                  </div>
                  
                  <div className="pt-2">
                    {passwordError && (
                      <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded-md">
                        <div className="flex">
                          <svg className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {passwordError}
                        </div>
                      </div>
                    )}
                    
                    {passwordSuccess && (
                      <div className="mb-3 text-sm text-green-600 bg-green-50 p-2 rounded-md">
                        <div className="flex">
                          <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
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
              <div className="bg-gray-50 p-4 border-t border-gray-200 text-sm text-gray-500 rounded-b-lg">
                <div className="flex items-center">
                  <svg className="h-4 w-4 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v-1l-1-1-1-1H3v-1l-1.447-1.894A6 6 0 1118 8zm-6-4a1 1 0 10-2 0v2a1 1 0 102 0V4zm-1 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <span>Mật khẩu của bạn phải khác với mật khẩu trước đó và tuân theo các tiêu chuẩn bảo mật.</span>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <div>Nội dung không tồn tại</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile header */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="md:flex">
            <div className="p-6 md:p-8 bg-gradient-to-r from-indigo-600 to-purple-700 md:w-1/3 text-white">
              <div className="flex flex-col items-center md:items-start">
                <div className="h-24 w-24 rounded-full bg-white bg-opacity-20 flex items-center justify-center mb-4">
                  <UserCircleIcon className="h-20 w-20 text-white" />
                </div>
                <h1 className="text-2xl font-bold">{userData.name}</h1>
                <p className="text-indigo-100 mt-1">{userData.role}</p>
                <div className="mt-4 flex items-center">
                  <div className="w-full bg-white bg-opacity-20 rounded-full h-2.5 mr-2">
                    <div className="bg-white h-2.5 rounded-full" style={{ width: `${userData.progress}%` }}></div>
                  </div>
                  <span className="text-sm text-indigo-100">{userData.progress}%</span>
                </div>
                <p className="text-xs text-indigo-100 mt-1">Tổng tiến độ học tập</p>
              </div>
            </div>
            <div className="p-6 md:p-8 md:w-2/3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{userData.courses}</div>
                  <div className="text-sm text-gray-500">Khóa học</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{userData.certificates}</div>
                  <div className="text-sm text-gray-500">Chứng chỉ</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{userData.totalHours}</div>
                  <div className="text-sm text-gray-500">Giờ học</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    <CalendarIcon className="h-6 w-6 mx-auto text-indigo-600" />
                  </div>
                  <div className="text-sm text-gray-500">Xem lịch học</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Hồ sơ học tập</h2>
                  <p className="text-sm text-gray-500">Quản lý thông tin và tiến độ học tập</p>
                </div>
                <div>
                  <button className="bg-indigo-100 text-indigo-700 text-sm px-4 py-2 rounded-lg hover:bg-indigo-200 flex items-center">
                    <BellIcon className="h-4 w-4 mr-1" />
                    Thông báo <span className="ml-1 px-1.5 py-0.5 bg-indigo-700 text-white text-xs rounded-full">2</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Tab navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 flex items-center border-b-2 ${
                activeTab === 'overview'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ChartBarIcon className={`-ml-0.5 mr-2 h-5 w-5 ${activeTab === 'overview' ? 'text-indigo-600' : 'text-gray-400'}`} />
              <span>Tổng quan</span>
            </button>
            <button
              onClick={() => setActiveTab('courses')}
              className={`py-4 px-1 flex items-center border-b-2 ${
                activeTab === 'courses'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <AcademicCapIcon className={`-ml-0.5 mr-2 h-5 w-5 ${activeTab === 'courses' ? 'text-indigo-600' : 'text-gray-400'}`} />
              <span>Khóa học</span>
            </button>
            <button
              onClick={() => setActiveTab('certificates')}
              className={`py-4 px-1 flex items-center border-b-2 ${
                activeTab === 'certificates'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CheckBadgeIcon className={`-ml-0.5 mr-2 h-5 w-5 ${activeTab === 'certificates' ? 'text-indigo-600' : 'text-gray-400'}`} />
              <span>Chứng chỉ</span>
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-1 flex items-center border-b-2 ${
                activeTab === 'settings'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Cog6ToothIcon className={`-ml-0.5 mr-2 h-5 w-5 ${activeTab === 'settings' ? 'text-indigo-600' : 'text-gray-400'}`} />
              <span>Cài đặt</span>
            </button>
          </nav>
        </div>
        
        {/* Tab content */}
        {renderTabContent()}
      </div>
    </div>
  );
} 