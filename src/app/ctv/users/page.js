'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlusIcon, PencilIcon, TrashIcon, ExclamationCircleIcon, ArrowPathIcon, ShieldCheckIcon, UserIcon, KeyIcon, EnvelopeIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import { auth } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';
import useUserData from '@/hooks/useUserData';

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
  const [hasMongoConnection, setHasMongoConnection] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [showCoursesModal, setShowCoursesModal] = useState(false);
  const [userCourses, setUserCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [availableCourses, setAvailableCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [addingCourse, setAddingCourse] = useState(false);
  const [courseError, setCourseError] = useState(null);
  const [trialHours, setTrialHours] = useState(1); // Số giờ dùng thử mặc định (1 giờ)
  const [checkingExpired, setCheckingExpired] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [currentCtvEmail, setCurrentCtvEmail] = useState('');

  // Sử dụng hook useUserData
  const { userData, loading: userDataLoading } = useUserData();
  
  // Kiểm tra xác thực 
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setAuthChecking(true);
        
        // Kiểm tra cookie
        const cookieStr = document.cookie;
        const cookies = cookieStr.split(';').map(c => c.trim());
        const hasCtvAccess = cookies.some(cookie => cookie.startsWith('ctv_access=true'));
        
        if (hasCtvAccess) {
          console.log("✅ Đã tìm thấy cookie ctv_access, CTV đã được middleware xác thực");
          setIsAuthorized(true);
          
          // Sử dụng userData từ hook thay vì gọi API
          if (!userDataLoading && userData) {
            console.log("Dữ liệu user từ hook useUserData:", userData);
            if (userData && userData.email) {
              setCurrentCtvEmail(userData.email);
              console.log("Email CTV đã được lưu:", userData.email);
            }
          }
        } else {
          console.log("⚠️ Không tìm thấy cookie ctv_access, kiểm tra thông qua userData");
          
          // Sử dụng userData từ hook thay vì gọi API
          if (userDataLoading) {
            console.log("Đang tải dữ liệu người dùng...");
            return;
          }
          
          if (!userData) {
            console.error("Không có dữ liệu người dùng");
            router.push('/');
            return;
          }
          
          console.log("Dữ liệu user từ hook useUserData:", userData);
          console.log("Role nhận được:", userData.role);
          
          if (userData.role !== 'ctv') {
            console.error(`Role không hợp lệ: '${userData.role}' (cần role 'ctv')`);
            router.push('/');
            return;
          }
          
          console.log("Xác thực thành công với role:", userData.role);
          setCurrentCtvEmail(userData.email);
          console.log("Email CTV đã được lưu:", userData.email);
          setIsAuthorized(true);
        }
      } catch (err) {
        console.error("Lỗi kiểm tra xác thực:", err);
        router.push('/');
      } finally {
        setAuthChecking(false);
      }
    };
    
    // Chỉ chạy khi userData đã sẵn sàng hoặc đã có lỗi
    if (!userDataLoading || userData) {
      checkAuth();
    }
  }, [router, userData, userDataLoading]);

  // Hàm lấy danh sách người dùng
  const fetchUsers = async () => {
    if (!isAuthorized || !currentCtvEmail) return; // Không fetch nếu chưa được xác thực hoặc chưa có email
    
    setLoading(true);
    setError(null);
    
    try {
      // Lấy danh sách tất cả người dùng không lọc theo CTV
      console.log(`Đang fetching tất cả users`);
      const response = await fetch(`/api/users?timestamp=${new Date().getTime()}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi lấy danh sách người dùng');
      }
      
      console.log("Danh sách người dùng từ API:", data.data);
      console.log("Email CTV hiện tại:", currentCtvEmail);
      
      // Không lọc người dùng theo createdBy - hiển thị tất cả người dùng
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

  // Lấy danh sách người dùng khi component được tạo và đã xác thực
  useEffect(() => {
    if (isAuthorized && !authChecking) {
      fetchUsers();
    }
  }, [isAuthorized, authChecking]);

  // Kiểm tra tài khoản hết hạn khi component được tạo và sau mỗi lần fetch users
  useEffect(() => {
    if (isAuthorized && !authChecking && users.length > 0 && !loading) {
      checkExpiredTrialAccounts();
    }
  }, [users, loading, isAuthorized, authChecking]);

  // Thiết lập kiểm tra tài khoản hết hạn mỗi phút
  useEffect(() => {
    // Chỉ thiết lập interval nếu đã xác thực
    if (!isAuthorized || authChecking) return;
    
    // Kiểm tra ngay khi component được tạo
    if (users.length > 0) {
      checkExpiredTrialAccounts();
    }
    
    console.log('Thiết lập kiểm tra tài khoản hết hạn mỗi phút');
    
    // Thiết lập kiểm tra định kỳ mỗi phút
    const intervalId = setInterval(() => {
      console.log('Đang chạy kiểm tra định kỳ tài khoản hết hạn...');
      if (users.length > 0) {
        checkExpiredTrialAccounts();
      }
    }, 60 * 1000); // 60 giây = 1 phút
    
    // Xóa interval khi component bị hủy
    return () => {
      console.log('Hủy interval kiểm tra tài khoản hết hạn');
      clearInterval(intervalId);
    };
  }, [users, isAuthorized, authChecking]); // Chạy lại khi danh sách users hoặc trạng thái xác thực thay đổi

  // Lọc người dùng theo từ khóa tìm kiếm và vai trò
  const filteredUsers = users.filter(user => {
    // Lọc theo từ khóa tìm kiếm
    const matchesSearch = 
      (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phoneNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    // Lọc theo vai trò
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  })
  // Sắp xếp người dùng mới nhất lên trên đầu
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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
      accountType: 'regular', // Loại tài khoản mặc định
      trialEndsAt: null, // Ngày hết hạn dùng thử
    });
    setTrialHours(1); // Đặt lại thời gian dùng thử mặc định
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
      let requestBody = {
        displayName: currentUser.displayName,
        createdBy: currentCtvEmail, // Lưu email của CTV hiện tại vào trường createdBy
        role: currentUser.role,
        status: currentUser.status,
        additionalInfo: currentUser.additionalInfo,
        accountType: currentUser.accountType,
        canViewAllCourses: currentUser.accountType === 'trial' ? true : currentUser.canViewAllCourses, // Đảm bảo tài khoản dùng thử luôn có quyền xem tất cả khóa học
      };
      
      // Nếu có số điện thoại và không phải là email, thêm vào request
      if (currentUser.phoneNumber && !currentUser.phoneNumber.includes('@')) {
        requestBody.phoneNumber = currentUser.phoneNumber;
      }
      
      // Nếu là tài khoản dùng thử, thêm thời gian hết hạn
      if (currentUser.accountType === 'trial') {
        // Tạo thời gian hết hạn dựa trên số giờ đã chọn
        const trialEndDate = new Date();
        trialEndDate.setHours(trialEndDate.getHours() + trialHours);
        requestBody.trialEndsAt = trialEndDate;
      } else {
        requestBody.trialEndsAt = null;
      }
      
      if (currentUser.id) {
        // Cập nhật người dùng hiện có
        response = await fetch(`/api/users?id=${currentUser.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      } else {
        // Tạo người dùng mới - chỉ cần email và mật khẩu
        requestBody = {
          email: currentUser.email,
          password: currentUser.password,
          accountType: currentUser.accountType,
          createdBy: currentCtvEmail, // Lưu email của CTV vào trường createdBy
          canViewAllCourses: currentUser.accountType === 'trial' ? true : false, // Tài khoản dùng thử luôn có quyền xem tất cả khóa học
        };
        
        // Nếu có số điện thoại và không phải là email, thêm vào request
        if (currentUser.phoneNumber && !currentUser.phoneNumber.includes('@')) {
          requestBody.phoneNumber = currentUser.phoneNumber;
        }
        
        // Nếu là tài khoản dùng thử, thêm thời gian hết hạn
        if (currentUser.accountType === 'trial') {
          // Tạo thời gian hết hạn dựa trên số giờ đã chọn
          const trialEndDate = new Date();
          trialEndDate.setHours(trialEndDate.getHours() + trialHours);
          requestBody.trialEndsAt = trialEndDate;
        }
        
        response = await fetch('/api/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });
      }
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi lưu thông tin người dùng');
      }
      
      // Debug thông tin người dùng vừa tạo/cập nhật
      console.log("Thông tin người dùng đã lưu:", data);
      if (data.user) {
        console.log("ID người dùng:", data.user.id);
        console.log("Email người dùng:", data.user.email);
        console.log("createdBy:", data.user.createdBy);
      }
      
      // Lấy thông tin người dùng mới
      const newUser = data.user || {};
      
      // Đóng modal
      setShowModal(false);
      setCurrentUser(null);
      
      // Hiển thị thông báo thành công
      toast.success(currentUser.id 
        ? 'Cập nhật người dùng thành công' 
        : 'Tạo người dùng mới thành công');
      
      // Nếu là tạo mới người dùng, thêm trực tiếp vào state để hiển thị ngay
      if (!currentUser.id && newUser && newUser.id) {
        console.log("Thêm người dùng mới vào danh sách:", newUser);
        // Đảm bảo người dùng mới có trường createdBy
        const userWithCreatedBy = {
          ...newUser,
          createdBy: newUser.createdBy || currentCtvEmail 
        };
        
        // Thêm vào đầu danh sách
        setUsers(prevUsers => [userWithCreatedBy, ...prevUsers]);
      }
      
      // Làm mới danh sách sau đó để cập nhật dữ liệu từ server
      setTimeout(() => {
        console.log("Đang làm mới danh sách người dùng sau khi lưu...");
        fetchUsers();
      }, 1000);
      
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

  // Hàm mở modal quản lý khóa học
  const handleManageCourses = async (user) => {
    setCurrentUser(user);
    setShowCoursesModal(true);
    setLoadingCourses(true);
    setCourseError(null);
    
    try {
      // Kiểm tra xem người dùng có firebaseId không
      if (!user.firebaseId) {
        // Hiển thị thông báo và tự động khởi tạo firebaseId dựa trên id
        toast('Đang khởi tạo thông tin người dùng...', {
          icon: '🔄',
          style: {
            borderRadius: '10px',
            background: '#3b82f6',
            color: '#fff',
          },
        });
        
        // Cập nhật thông tin người dùng với firebaseId mới
        const updateResponse = await fetch(`/api/users?id=${user.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            firebaseId: user.id, // Sử dụng ID hiện tại làm firebaseId
          }),
        });
        
        if (!updateResponse.ok) {
          throw new Error('Không thể cập nhật thông tin người dùng');
        }
        
        // Cập nhật thông tin người dùng hiện tại
        setCurrentUser({
          ...user,
          firebaseId: user.id
        });
        
        // Sử dụng ID đã cập nhật
        user.firebaseId = user.id;
        toast.success('Đã khởi tạo thông tin người dùng thành công');
      }
      
      // Thiết lập cookie ctv_access và ctv_email tạm thời
      document.cookie = "ctv_access=true; path=/; max-age=300"; // Tăng thời gian lên 5 phút
      document.cookie = `ctv_email=${encodeURIComponent(currentCtvEmail)}; path=/; max-age=300`;
      
      // Lấy danh sách khóa học đã đăng ký của người dùng
      const enrollmentsResponse = await fetch(`/api/admin/enrollments?userId=${user.firebaseId}&ctvEmail=${encodeURIComponent(currentCtvEmail)}`);
      
      if (!enrollmentsResponse.ok) {
        const errorData = await enrollmentsResponse.json();
        throw new Error(errorData.message || 'Không thể lấy danh sách khóa học đã đăng ký');
      }
      
      const enrollmentsData = await enrollmentsResponse.json();
      setUserCourses(enrollmentsData.data || []);
      
      // Lấy danh sách tất cả khóa học
      const coursesResponse = await fetch('/api/admin/courses');
      
      if (!coursesResponse.ok) {
        const errorData = await coursesResponse.json();
        throw new Error(errorData.error || 'Không thể lấy danh sách khóa học');
      }
      
      const coursesData = await coursesResponse.json();
      setAvailableCourses(coursesData.courses || []);
    } catch (err) {
      console.error('Lỗi khi lấy thông tin khóa học:', err);
      setCourseError(err.message);
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setLoadingCourses(false);
    }
  };
  
  // Hàm thêm khóa học cho người dùng
  const handleAddCourse = async () => {
    if (!selectedCourseId) {
      setCourseError('Vui lòng chọn khóa học');
      return;
    }
    
    if (!currentUser || !currentUser.firebaseId) {
      setCourseError('Không có thông tin người dùng hợp lệ');
      toast.error('Không có thông tin người dùng hợp lệ');
      return;
    }
    
    setAddingCourse(true);
    setCourseError(null);
    
    try {
      // Thiết lập cookie ctv_access và ctv_email tạm thời
      document.cookie = "ctv_access=true; path=/; max-age=300"; // Tăng thời gian lên 5 phút
      document.cookie = `ctv_email=${encodeURIComponent(currentCtvEmail)}; path=/; max-age=300`;
      
      // Gọi API để thêm khóa học cho người dùng
      const response = await fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.firebaseId,
          courseId: selectedCourseId,
          ctvEmail: currentCtvEmail
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Không thể thêm khóa học cho người dùng');
      }
      
      // Cập nhật danh sách khóa học
      setUserCourses(prev => [...prev, data.data]);
      setSelectedCourseId('');
      toast.success('Đã thêm khóa học cho người dùng');
    } catch (err) {
      console.error('Lỗi khi thêm khóa học:', err);
      setCourseError(err.message);
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setAddingCourse(false);
    }
  };
  
  // Hàm xóa khóa học của người dùng
  const handleRemoveCourse = async (enrollmentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khóa học này khỏi người dùng?')) {
      return;
    }
    
    try {
      // Thiết lập cookie ctv_access và ctv_email tạm thời
      document.cookie = "ctv_access=true; path=/; max-age=300"; // Tăng thời gian lên 5 phút
      document.cookie = `ctv_email=${encodeURIComponent(currentCtvEmail)}; path=/; max-age=300`;
      
      // Gọi API để xóa khóa học
      const response = await fetch(`/api/admin/enrollments?id=${enrollmentId}&ctvEmail=${encodeURIComponent(currentCtvEmail)}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Không thể xóa khóa học');
      }
      
      // Cập nhật danh sách khóa học
      setUserCourses(prev => prev.filter(course => course.id !== enrollmentId));
      toast.success('Đã xóa khóa học khỏi người dùng');
    } catch (err) {
      console.error('Lỗi khi xóa khóa học:', err);
      setCourseError(err.message);
      toast.error(`Lỗi: ${err.message}`);
    }
  };

  const handleToggleViewAllCourses = async (userId, currentValue) => {
    try {
      // Tìm người dùng trong danh sách
      const user = users.find(u => u.id === userId);
      
      // Nếu là tài khoản dùng thử, không cho phép tắt quyền xem khóa học
      if (user && user.accountType === 'trial' && currentValue === true) {
        toast.info('Tài khoản dùng thử luôn có quyền xem tất cả khóa học');
        return; // Không thực hiện thay đổi
      }
      
      // Gọi API để cập nhật quyền xem tất cả khóa học
      const response = await fetch(`/api/users?id=${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          canViewAllCourses: !currentValue
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Lỗi khi cập nhật quyền xem khóa học');
      }
      
      // Cập nhật danh sách người dùng
      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, canViewAllCourses: !currentValue } 
          : user
      ));
      
      toast.success(`Đã ${!currentValue ? 'bật' : 'tắt'} quyền xem tất cả khóa học`);
      
    } catch (err) {
      console.error('Lỗi khi cập nhật quyền xem khóa học:', err);
      toast.error(`Lỗi: ${err.message}`);
    }
  };

  // Kiểm tra và xóa tài khoản dùng thử đã hết hạn
  const checkExpiredTrialAccounts = async (showToast = true) => {
    try {
      console.log('Đang kiểm tra tài khoản dùng thử hết hạn...');
      setCheckingExpired(true);
      
      const expiredUsers = users.filter(user => {
        // Kiểm tra chi tiết điều kiện để debug
        const isTrial = user.accountType === 'trial';
        const hasTrialEndsAt = !!user.trialEndsAt;
        const isExpired = user.trialEndsAt && new Date(user.trialEndsAt) < new Date();
        
        console.log(`User ${user.email}: isTrial=${isTrial}, hasTrialEndsAt=${hasTrialEndsAt}, isExpired=${isExpired}, trialEndsAt=${user.trialEndsAt}`);
        
        return isTrial && hasTrialEndsAt && isExpired;
      });
      
      console.log(`Phát hiện ${expiredUsers.length} tài khoản hết hạn`);
      
      if (expiredUsers.length > 0) {
        // Hiển thị thông báo về số tài khoản hết hạn
        if (showToast) {
          toast(`Đã phát hiện ${expiredUsers.length} tài khoản dùng thử đã hết hạn`, {
            icon: 'ℹ️',
            style: {
              borderRadius: '10px',
              background: '#3b82f6',
              color: '#fff',
            },
            duration: 5000, // Hiển thị lâu hơn để người dùng có thời gian đọc
          });
        }
        
        // Hiển thị thông báo đang xóa
        const deleteToastId = showToast ? toast.loading(`Đang xóa ${expiredUsers.length} tài khoản hết hạn...`) : null;
        
        let deletedCount = 0;
        let errorCount = 0;
        
        // Xóa từng tài khoản hết hạn
        for (const user of expiredUsers) {
          try {
            console.log(`Đang xóa tài khoản hết hạn: ${user.email} (ID: ${user.id})`);
            
            const response = await fetch(`/api/users?id=${user.id}`, {
              method: 'DELETE',
            });
            
            const responseData = await response.json();
            
            if (response.ok) {
              console.log(`Đã xóa tài khoản dùng thử hết hạn: ${user.email}`, responseData);
              deletedCount++;
            } else {
              console.error(`Lỗi khi xóa tài khoản dùng thử hết hạn ${user.email}:`, responseData);
              errorCount++;
            }
          } catch (err) {
            console.error(`Lỗi khi xóa tài khoản dùng thử hết hạn ${user.email}:`, err);
            errorCount++;
          }
        }
        
        // Cập nhật thông báo kết quả
        if (showToast) {
          toast.dismiss(deleteToastId);
          if (deletedCount > 0) {
            toast.success(`Đã xóa ${deletedCount} tài khoản hết hạn thành công${errorCount > 0 ? `, ${errorCount} lỗi` : ''}`);
          } else if (errorCount > 0) {
            toast.error(`Không thể xóa ${errorCount} tài khoản hết hạn`);
          }
        }
        
        // Làm mới danh sách sau khi xóa
        fetchUsers();
      } else if (showToast) {
        toast.success('Không có tài khoản dùng thử nào hết hạn');
      }
    } catch (err) {
      console.error('Lỗi khi kiểm tra tài khoản dùng thử hết hạn:', err);
      if (showToast) {
        toast.error(`Lỗi khi kiểm tra: ${err.message}`);
      }
    } finally {
      setCheckingExpired(false);
    }
  };

  // Hàm kiểm tra tài khoản hết hạn thủ công
  const handleCheckExpiredAccounts = () => {
    checkExpiredTrialAccounts(true);
  };
  
  // Thông báo cho người dùng biết đã thay đổi quyền xem
  useEffect(() => {
    if (isAuthorized && !authChecking) {
      toast.success('Bạn đã được cấp quyền xem tất cả người dùng trong hệ thống', {
        duration: 5000,
        icon: '🔓',
      });
    }
  }, [isAuthorized, authChecking]);

  // Định dạng thời gian còn lại của tài khoản dùng thử
  const formatRemainingTime = (trialEndsAt) => {
    if (!trialEndsAt) return null;
    
    const endDate = new Date(trialEndsAt);
    const now = new Date();
    
    if (endDate <= now) {
      return 'Đã hết hạn';
    }
    
    const diffTime = Math.abs(endDate - now);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      return `Còn ${diffDays} ngày`;
    } else {
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      if (diffHours > 0) {
        return `Còn ${diffHours} giờ`;
      } else {
        const diffMinutes = Math.ceil(diffTime / (1000 * 60));
        return `Còn ${diffMinutes} phút`;
      }
    }
  };

  // Hiển thị trạng thái đang kiểm tra xác thực
  if (authChecking) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-600">Đang xác thực...</p>
      </div>
    );
  }

  // Nếu không có quyền truy cập, component sẽ chuyển hướng trong useEffect
  // và không hiển thị gì ở đây

  return (
    <div className="container mx-auto px-4 py-8">
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
      
      {/* Style toàn cục cho thiết bị di động */}
      <style jsx global>{`
        @media (max-width: 768px) {
          input, select, textarea {
            font-size: 16px !important; /* Ngăn iOS tự động zoom khi focus input */
            color: #000 !important; /* Đảm bảo màu chữ đen */
          }
          
          input::placeholder {
            color: #9CA3AF !important; /* Màu placeholder rõ ràng hơn */
          }
          
          .text-gray-500 {
            color: #6B7280 !important; /* Tăng độ tương phản cho text màu xám */
          }
        }
      `}</style>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Quản lý tất cả người dùng</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowPathIcon className="-ml-1 mr-1 h-5 w-5 text-gray-500" />
            Làm mới
          </button>
          <button
            onClick={handleCheckExpiredAccounts}
            disabled={checkingExpired}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {checkingExpired ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang kiểm tra...
              </>
            ) : (
              <>
                <ClockIcon className="-ml-1 mr-1 h-5 w-5 text-gray-500" />
                Kiểm tra tài khoản hết hạn
              </>
            )}
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
                autoComplete="off"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
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
                <option value="trial">Dùng thử</option>
              </select>
            </div>
          </div>
          
          {/* Hiển thị số lượng người dùng */}
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600">
              Hiển thị {filteredUsers.length} trong tổng số {users.length} người dùng trong hệ thống
            </p>
          </div>

          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600 mb-2"></div>
              <p className="text-gray-500">Đang tải dữ liệu...</p>
            </div>
          ) : (
            <>
              {/* Hiển thị dạng bảng trên màn hình lớn */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden">Người dùng</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden">Điện thoại</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quyền xem khóa học</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((user) => (
                        <tr key={user.id} className={`hover:bg-gray-50 ${
                          (user.createdBy === currentCtvEmail || user.phoneNumber === currentCtvEmail) ? 'bg-red-50' : 
                          user.createdBy ? 'bg-blue-50' : 'bg-purple-50'
                        }`}>
                          <td className="px-6 py-4 whitespace-nowrap hidden">
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
                              
                              {/* Hiển thị thông tin người phụ trách */}
                              <div className="mt-1 flex items-center text-xs text-indigo-600">
                                <UserIcon className="h-3 w-3 mr-1" />
                                <span>Người phụ trách: {user.createdBy || 'Admin'}</span>
                                {(user.createdBy === currentCtvEmail || user.phoneNumber === currentCtvEmail) && (
                                  <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                    Của bạn
                                  </span>
                                )}
                                {user.createdBy && user.createdBy !== currentCtvEmail && (
                                  <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                    CTV
                                  </span>
                                )}
                                {!user.createdBy && (
                                  <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                                    Admin
                                  </span>
                                )}
                              </div>
                              
                              {/* Hiển thị thời gian dùng thử còn lại nếu là tài khoản dùng thử */}
                              {user.accountType === 'trial' && user.trialEndsAt && (
                                <div className="mt-1 flex items-center text-xs">
                                  <ClockIcon className="h-3 w-3 mr-1 text-orange-500" />
                                  <span className={`${
                                    new Date(user.trialEndsAt) < new Date() 
                                      ? 'text-red-500' 
                                      : 'text-orange-500'
                                  }`}>
                                    {formatRemainingTime(user.trialEndsAt)}
                                  </span>
                                </div>
                              )}
                              
                              {/* Hiển thị số điện thoại nếu có */}
                              {user.phoneNumber && !user.phoneNumber.includes('@') && (
                                <div className="mt-1 flex items-center text-xs text-gray-600">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span>SĐT: {user.phoneNumber}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap hidden">
                            <div className="text-sm text-gray-900">{user.phoneNumber || '—'}</div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {user.accountType === 'trial' ? (
                                <>
                                  <button
                                    disabled={true}
                                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    role="switch"
                                    aria-checked={true}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-5"
                                    ></span>
                                  </button>
                                  <span className="ml-2 text-xs flex items-center">
                                    <span className="text-green-600">Luôn bật</span>
                                    <span className="ml-1 text-gray-400">(Tài khoản dùng thử)</span>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleToggleViewAllCourses(user.id, user.canViewAllCourses)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                      user.canViewAllCourses ? 'bg-indigo-600' : 'bg-gray-200'
                                    }`}
                                    role="switch"
                                    aria-checked={user.canViewAllCourses}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        user.canViewAllCourses ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    ></span>
                                  </button>
                                  <span className="ml-2 text-xs">
                                    {user.canViewAllCourses ? 'Có' : 'Không'}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap hidden">
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
                          <td className="px-6 py-4 whitespace-nowrap hidden">
                            <div className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                user.disabled || user.status === 'inactive'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {user.disabled || user.status === 'inactive' ? 'Vô hiệu hóa' : 'Đang hoạt động'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEdit(user)}
                                className="text-indigo-600 hover:text-indigo-900"
                                title="Chỉnh sửa"
                              >
                                <PencilIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleResetPassword(user)}
                                className="text-yellow-600 hover:text-yellow-900"
                                title="Đặt lại mật khẩu"
                              >
                                <KeyIcon className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleManageCourses(user)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Quản lý khóa học"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Xóa"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(user.createdAt).toLocaleTimeString('vi-VN')}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                          {searchTerm || roleFilter !== 'all' ? 
                            'Không tìm thấy người dùng phù hợp với bộ lọc.' : 
                            'Bạn chưa tạo người dùng nào trong hệ thống.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Hiển thị dạng card trên thiết bị di động */}
              <div className="md:hidden">
                {filteredUsers.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {filteredUsers.map((user) => (
                      <div key={user.id} className={`bg-white rounded-lg border border-gray-200 shadow-sm p-4 ${
                        (user.createdBy === currentCtvEmail || user.phoneNumber === currentCtvEmail) 
                          ? 'bg-red-50 border-red-200' 
                          : user.createdBy ? 'bg-blue-50 border-blue-200' : 'bg-purple-50 border-purple-200'
                      }`}>
                        <div className="mb-2">
                          <div className="text-sm font-medium text-gray-900">{user.email}</div>
                          <div className="text-xs text-gray-500">
                            {user.emailVerified ? 
                              <span className="text-green-600">Đã xác thực</span> : 
                              <span className="flex items-center text-yellow-600">
                                Chưa xác thực
                                <button
                                  onClick={() => handleVerifyEmail(user.id)}
                                  className="ml-1 text-blue-600 hover:text-blue-800"
                                >
                                  <EnvelopeIcon className="h-4 w-4" />
                                </button>
                              </span>}
                            
                            {/* Hiển thị thông tin người phụ trách trên mobile */}
                            <div className="mt-1 flex items-center text-xs text-indigo-600">
                              <UserIcon className="h-3 w-3 mr-1" />
                              <span>Người phụ trách: {user.createdBy || 'Admin'}</span>
                              {(user.createdBy === currentCtvEmail || user.phoneNumber === currentCtvEmail) && (
                                <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                  Của bạn
                                </span>
                              )}
                              {user.createdBy && user.createdBy !== currentCtvEmail && (
                                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                  CTV
                                </span>
                              )}
                              {!user.createdBy && (
                                <span className="ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                                  Admin
                                </span>
                              )}
                            </div>
                            
                            {/* Hiển thị thời gian dùng thử còn lại nếu là tài khoản dùng thử */}
                            {user.accountType === 'trial' && user.trialEndsAt && (
                              <div className="mt-1 flex items-center text-xs">
                                <ClockIcon className="h-3 w-3 mr-1 text-orange-500" />
                                <span className={`${
                                  new Date(user.trialEndsAt) < new Date() 
                                    ? 'text-red-500' 
                                    : 'text-orange-500'
                                }`}>
                                  {formatRemainingTime(user.trialEndsAt)}
                                </span>
                              </div>
                            )}
                            
                            {/* Hiển thị số điện thoại nếu có */}
                            {user.phoneNumber && !user.phoneNumber.includes('@') && (
                              <div className="mt-1 flex items-center text-xs text-gray-600">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span>SĐT: {user.phoneNumber}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Quyền xem khóa học */}
                        <div className="mb-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-700">Quyền xem tất cả khóa học:</div>
                            <div>
                              {user.accountType === 'trial' ? (
                                <>
                                  <button
                                    disabled={true}
                                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent bg-indigo-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                                    role="switch"
                                    aria-checked={true}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-5"
                                    ></span>
                                  </button>
                                  <span className="ml-2 text-xs flex items-center">
                                    <span className="text-green-600">Luôn bật</span>
                                    <span className="ml-1 text-gray-400">(Tài khoản dùng thử)</span>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleToggleViewAllCourses(user.id, user.canViewAllCourses)}
                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                                      user.canViewAllCourses ? 'bg-indigo-600' : 'bg-gray-200'
                                    }`}
                                    role="switch"
                                    aria-checked={user.canViewAllCourses}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        user.canViewAllCourses ? 'translate-x-5' : 'translate-x-0'
                                      }`}
                                    ></span>
                                  </button>
                                  <span className="ml-2 text-xs">
                                    {user.canViewAllCourses ? 'Có' : 'Không'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(user)}
                              className="p-1.5 bg-indigo-100 text-indigo-600 rounded-md hover:bg-indigo-200"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleResetPassword(user)}
                              className="p-1.5 bg-yellow-100 text-yellow-600 rounded-md hover:bg-yellow-200"
                            >
                              <KeyIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleManageCourses(user)}
                              className="p-1.5 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="p-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">
                      {searchTerm || roleFilter !== 'all' ? 
                        'Không tìm thấy người dùng phù hợp với bộ lọc.' : 
                        'Bạn chưa tạo người dùng nào trong hệ thống.'}
                    </p>
                  </div>
                )}
              </div>
            </>
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
                    <label htmlFor="user_email_field" className="block text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="user_email_field"
                      name="user_email_field"
                      value={currentUser.email || ''}
                      onChange={(e) => setCurrentUser({...currentUser, email: e.target.value})}
                      required
                      autoComplete="new-password"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                    />
                  </div>
                )}
                
                {/* Mật khẩu - chỉ hiển thị khi thêm mới */}
                {!currentUser.id && (
                  <div>
                    <label htmlFor="user_pwd_field" className="block text-sm font-medium text-gray-700">
                      Mật khẩu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="password"
                      id="user_pwd_field"
                      name="user_pwd_field"
                      value={currentUser.password || ''}
                      onChange={(e) => setCurrentUser({...currentUser, password: e.target.value})}
                      required
                      autoComplete="new-password"
                      minLength={6}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">Mật khẩu phải có ít nhất 6 ký tự</p>
                  </div>
                )}
                
                {/* Số điện thoại - chỉ hiển thị khi thêm mới */}
                {!currentUser.id && (
                  <div>
                    <label htmlFor="user_phone_field" className="block text-sm font-medium text-gray-700">
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      id="user_phone_field"
                      name="user_phone_field"
                      value={currentUser.phoneNumber || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Kiểm tra xem có phải là email không
                        if (value.includes('@')) {
                          setApiError('Vui lòng nhập số điện thoại, không nhập email vào trường này');
                        } else {
                          setApiError(null);
                          setCurrentUser({...currentUser, phoneNumber: value});
                        }
                      }}
                      autoComplete="tel"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                    />
                    <p className="mt-1 text-xs text-gray-500">Nhập số điện thoại của người dùng (không bắt buộc)</p>
                  </div>
                )}
                
                {/* Loại tài khoản */}
                <div>
                  <label htmlFor="accountType" className="block text-sm font-medium text-gray-700">
                    Loại tài khoản
                  </label>
                  <select
                    id="accountType"
                    value={currentUser.accountType || 'regular'}
                    onChange={(e) => {
                      const newType = e.target.value;
                      
                      // Nếu chuyển sang tài khoản dùng thử, tự động thiết lập thời gian hết hạn và quyền xem tất cả khóa học
                      if (newType === 'trial') {
                        const trialEndDate = new Date();
                        trialEndDate.setHours(trialEndDate.getHours() + trialHours); // Sử dụng trialHours
                        setCurrentUser(prev => ({
                          ...prev, 
                          accountType: newType,
                          trialEndsAt: trialEndDate,
                          canViewAllCourses: true // Tự động bật quyền xem tất cả khóa học
                        }));
                      } else {
                        setCurrentUser({...currentUser, accountType: newType});
                      }
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    <option value="regular">Thường</option>
                    <option value="trial">Dùng thử</option>
                  </select>
                </div>
                
                {/* Thời gian dùng thử - chỉ hiển thị khi chọn loại tài khoản dùng thử */}
                {currentUser.accountType === 'trial' && (
                  <div>
                    <label htmlFor="trialHours" className="block text-sm font-medium text-gray-700">
                      Thời gian dùng thử
                    </label>
                    <select
                      id="trialHours"
                      value={trialHours}
                      onChange={(e) => {
                        const hours = parseInt(e.target.value);
                        setTrialHours(hours);
                        
                        // Cập nhật thời gian hết hạn
                        const trialEndDate = new Date();
                        trialEndDate.setHours(trialEndDate.getHours() + hours);
                        setCurrentUser({...currentUser, trialEndsAt: trialEndDate});
                      }}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    >
                      <option value="1">1 giờ</option>
                      <option value="2">2 giờ</option>
                      <option value="6">6 giờ</option>
                      <option value="24">1 ngày</option>
                    </select>
                  </div>
                )}
                
                {/* Hiển thị thời gian hết hạn nếu là tài khoản dùng thử */}
                {currentUser.accountType === 'trial' && currentUser.trialEndsAt && (
                  <div className="mt-2">
                    <p className="text-xs text-orange-500">
                      Tài khoản sẽ hết hạn vào: {new Date(currentUser.trialEndsAt).toLocaleDateString('vi-VN')} {new Date(currentUser.trialEndsAt).toLocaleTimeString('vi-VN')}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      <span className="font-medium">Quyền xem tất cả khóa học:</span> Đã bật tự động
                    </p>
                  </div>
                )}
                
                {/* Quyền xem tất cả khóa học - ẩn đi nếu là tài khoản dùng thử */}
                {currentUser.id && currentUser.accountType !== 'trial' && (
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="canViewAllCourses"
                        name="canViewAllCourses"
                        type="checkbox"
                        checked={currentUser.canViewAllCourses || false}
                        onChange={(e) => setCurrentUser({...currentUser, canViewAllCourses: e.target.checked})}
                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="canViewAllCourses" className="font-medium text-gray-700">
                        Quyền xem tất cả khóa học
                      </label>
                      <p className="text-gray-500">
                        Cho phép người dùng này xem nội dung của tất cả khóa học mà không cần đăng ký
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Hiển thị công tắc quyền xem đã được bật cho tài khoản dùng thử */}
                {currentUser.id && currentUser.accountType === 'trial' && (
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="canViewAllCourses"
                        name="canViewAllCourses"
                        type="checkbox"
                        checked={true}
                        disabled={true}
                        className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label htmlFor="canViewAllCourses" className="font-medium text-gray-700">
                        Quyền xem tất cả khóa học
                      </label>
                      <p className="text-green-600 text-xs">
                        Tài khoản dùng thử luôn được bật quyền xem tất cả khóa học
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Chỉ hiển thị các trường khác khi đang chỉnh sửa người dùng */}
                {currentUser.id && (
                  <>
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
                        autoComplete="off"
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
                      />
                    </div>
                    
                    {/* Hiển thị thông tin CTV đã tạo tài khoản */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        CTV tạo tài khoản
                      </label>
                      <div className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-sm text-gray-700">
                        {currentCtvEmail || 'Chưa có thông tin'}
                      </div>
                    </div>
                    
                    {/* Số điện thoại người dùng */}
                    <div>
                      <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                        Số điện thoại
                      </label>
                      <input
                        type="text"
                        id="phoneNumber"
                        value={currentUser.phoneNumber || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCurrentUser({...currentUser, phoneNumber: value});
                        }}
                        autoComplete="tel"
                        className={`mt-1 block w-full rounded-md ${
                          currentUser.phoneNumber && currentUser.phoneNumber.includes('@') 
                            ? 'border-red-300 focus:border-red-500 focus:ring-red-500' 
                            : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                        } shadow-sm sm:text-sm text-gray-900`}
                        placeholder="Nhập số điện thoại"
                      />
                      <p className={`mt-1 text-xs ${currentUser.phoneNumber && currentUser.phoneNumber.includes('@') ? 'text-red-500' : 'text-gray-500'}`}>
                        {currentUser.phoneNumber && currentUser.phoneNumber.includes('@') 
                          ? 'Vui lòng nhập số điện thoại thực, không nhập email'
                          : 'Nhập số điện thoại (chỉ nhập số, không nhập email)'
                        }
                      </p>
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
                        <option value="trial">Dùng thử</option>
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
                  </>
                )}
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
                  <label htmlFor="new_pwd_field" className="block text-sm font-medium text-gray-700">
                    Mật khẩu mới <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    id="new_pwd_field"
                    name="new_pwd_field"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    minLength={6}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-900"
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

      {/* Modal quản lý khóa học */}
      {showCoursesModal && currentUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">
                Quản lý khóa học - {currentUser.displayName || currentUser.email}
              </h3>
              <button
                onClick={() => setShowCoursesModal(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="px-6 py-4 max-h-[calc(90vh-120px)] overflow-y-auto">
              {loadingCourses ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : courseError ? (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  <p>{courseError}</p>
                </div>
              ) : (
                <>
                  {/* Thêm khóa học mới */}
                  <div className="mb-6 bg-gray-50 p-4 rounded-lg">
                    <h4 className="text-base font-medium text-gray-900 mb-3">Thêm khóa học mới</h4>
                    <div className="flex items-center space-x-2">
                      <select
                        value={selectedCourseId}
                        onChange={(e) => setSelectedCourseId(e.target.value)}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="">-- Chọn khóa học --</option>
                        {Array.isArray(availableCourses) ? availableCourses.map((course) => (
                          <option key={course._id} value={course._id}>
                            {course.name}
                          </option>
                        )) : null}
                      </select>
                      <button
                        onClick={handleAddCourse}
                        disabled={addingCourse || !selectedCourseId}
                        className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                          addingCourse || !selectedCourseId
                            ? 'bg-gray-400'
                            : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {addingCourse ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Đang thêm...
                          </>
                        ) : (
                          'Thêm khóa học'
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Danh sách khóa học đã đăng ký */}
                  <h4 className="text-base font-medium text-gray-900 mb-3">Khóa học đã đăng ký ({userCourses.length})</h4>
                  {userCourses.length === 0 ? (
                    <div className="text-center py-6 bg-gray-50 rounded-lg">
                      <p className="text-gray-500">Người dùng này chưa đăng ký khóa học nào</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Tên khóa học
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Tiến độ
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Trạng thái
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ngày đăng ký
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Thao tác
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {userCourses.map((course) => (
                            <tr key={course.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {course.courseName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                      className="bg-indigo-600 h-2.5 rounded-full" 
                                      style={{ width: `${course.progress || 0}%` }}
                                    ></div>
                                  </div>
                                  <span className="ml-2">{course.progress || 0}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  course.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  course.status === 'active' ? 'bg-blue-100 text-blue-800' :
                                  course.status === 'expired' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {course.status === 'completed' ? 'Hoàn thành' :
                                   course.status === 'active' ? 'Đang học' :
                                   course.status === 'expired' ? 'Hết hạn' :
                                   course.status || 'Không xác định'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {new Date(course.enrolledAt).toLocaleDateString('vi-VN')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <button
                                  onClick={() => handleRemoveCourse(course.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowCoursesModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 