"use client";
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { IoTimeOutline, IoCheckmarkCircle } from 'react-icons/io5';

const Registration = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: '',
    grade: '',
    subject: '',
    timeToContact: ''
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Set deadline to end of current day (23:59:59)
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      // Set deadline to end of current day (23:59:59)
      const deadline = new Date(now);
      deadline.setHours(23, 59, 59, 999);
      
      const difference = deadline - now;
      
      if (difference <= 0) {
        // If it's already past midnight, set deadline to next day's 23:59:59
        deadline.setDate(deadline.getDate() + 1);
        deadline.setHours(23, 59, 59, 999);
      }
      
      const days = 0; // Hiển thị cố định là 0 ngày
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / (1000 * 60)) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      
      return { days, hours, minutes, seconds };
    };

    // Initialize time left immediately
    setTimeLeft(calculateTimeLeft());
    
    const intervalId = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear error for this field when user types
    if (formErrors[name]) {
      setFormErrors({
        ...formErrors,
        [name]: ''
      });
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ tên';
    }
    
    if (!formData.phone.trim()) {
      errors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!/^(0|84)[3|5|7|8|9]\d{8}$/.test(formData.phone)) {
      errors.phone = 'Số điện thoại không hợp lệ';
    }
    
    if (formData.email && !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
      errors.email = 'Email không hợp lệ';
    }
    
    if (!formData.grade) {
      errors.grade = 'Vui lòng chọn lớp';
    }
    
    if (!formData.subject) {
      errors.subject = 'Vui lòng chọn khóa học';
    }
    
    return errors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    setFormErrors(errors);
    
    if (Object.keys(errors).length === 0) {
      setIsSubmitting(true);
      
      // Simulate API call
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmitSuccess(true);
        
        // Reset form after 3 seconds
        setTimeout(() => {
          setSubmitSuccess(false);
          setFormData({
            fullName: '',
            phone: '',
            email: '',
            grade: '',
            subject: '',
            timeToContact: ''
          });
        }, 3000);
      }, 1500);
    }
  };

  return (
    <section id="dang-ky" className="py-16 bg-blue-50 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full filter blur-3xl opacity-10 -z-10"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-yellow-400 rounded-full filter blur-3xl opacity-10 -z-10"></div>
      
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-blue-600 mb-4">
            ĐẶT CHỖ SỚM - ƯU ĐÃI LỚN
          </h2>
          
          <div className="max-w-md mx-auto mb-8">
            <div className="flex items-center space-x-2 text-blue-600 mb-3">
              <IoTimeOutline className="text-xl" />
              <p className="font-medium">Ưu đãi kết thúc vào 23:59 hôm nay</p>
            </div>
            
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white rounded-lg p-2 shadow">
                <div className="text-2xl md:text-3xl font-bold text-blue-600">{timeLeft.days < 10 ? `0${timeLeft.days}` : timeLeft.days}</div>
                <div className="text-xs text-gray-600">NGÀY</div>
              </div>
              <div className="bg-white rounded-lg p-2 shadow">
                <div className="text-2xl md:text-3xl font-bold text-blue-600">{timeLeft.hours < 10 ? `0${timeLeft.hours}` : timeLeft.hours}</div>
                <div className="text-xs text-gray-600">GIỜ</div>
              </div>
              <div className="bg-white rounded-lg p-2 shadow">
                <div className="text-2xl md:text-3xl font-bold text-blue-600">{timeLeft.minutes < 10 ? `0${timeLeft.minutes}` : timeLeft.minutes}</div>
                <div className="text-xs text-gray-600">PHÚT</div>
              </div>
              <div className="bg-white rounded-lg p-2 shadow">
                <div className="text-2xl md:text-3xl font-bold text-blue-600">{timeLeft.seconds < 10 ? `0${timeLeft.seconds}` : timeLeft.seconds}</div>
                <div className="text-xs text-gray-600">GIÂY</div>
              </div>
            </div>
            
            <p className="text-center text-sm text-gray-600 mt-4 bg-yellow-50 p-2 rounded border border-yellow-100">
              Ưu đãi kết thúc vào 23:59 hôm nay! Nhanh tay đăng ký!
            </p>
          </div>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col lg:flex-row bg-white rounded-2xl shadow-xl overflow-hidden">
            {/* Left side - Form */}
            <div className="lg:w-3/5 p-6 md:p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Đăng ký nhận tư vấn miễn phí</h3>
              
              {submitSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center py-8"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <IoCheckmarkCircle className="text-3xl text-green-600" />
                  </div>
                  <h4 className="text-xl font-semibold text-green-600 mb-2">Đăng ký thành công!</h4>
                  <p className="text-gray-600">
                    Cảm ơn bạn đã đăng ký. Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên *</label>
                      <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border ${formErrors.fullName ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        placeholder="Nhập họ và tên"
                      />
                      {formErrors.fullName && <p className="text-red-500 text-xs mt-1">{formErrors.fullName}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại *</label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border ${formErrors.phone ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        placeholder="Nhập số điện thoại"
                      />
                      {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border ${formErrors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        placeholder="Nhập email (không bắt buộc)"
                      />
                      {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lớp *</label>
                      <select
                        name="grade"
                        value={formData.grade}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border ${formErrors.grade ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      >
                        <option value="">-- Chọn lớp --</option>
                        <option value="10">Lớp 10</option>
                        <option value="11">Lớp 11</option>
                        <option value="12">Lớp 12</option>
                      </select>
                      {formErrors.grade && <p className="text-red-500 text-xs mt-1">{formErrors.grade}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Khóa học quan tâm *</label>
                      <select
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border ${formErrors.subject ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      >
                        <option value="">-- Chọn khóa học --</option>
                        <option value="ĐGNL">Luyện thi ĐGNL ĐHQG HN</option>
                        <option value="ĐGTD">Luyện thi ĐGNL ĐGTD ĐHBK</option>
                        <option value="HCM">Luyện thi ĐGNL ĐHQG HCM</option>
                        <option value="THPT">Luyện thi THPT QG 2025</option>
                      </select>
                      {formErrors.subject && <p className="text-red-500 text-xs mt-1">{formErrors.subject}</p>}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian liên hệ</label>
                      <select
                        name="timeToContact"
                        value={formData.timeToContact}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Thời gian phù hợp --</option>
                        <option value="8h-12h">8h - 12h</option>
                        <option value="12h-14h">12h - 14h</option>
                        <option value="14h-16h">14h - 16h</option>
                        <option value="16h-18h">16h - 18h</option>
                        <option value="18h-20h">18h - 20h</option>
                      </select>
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition-colors ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Đang xử lý...
                      </span>
                    ) : 'ĐĂNG KÝ NGAY'}
                  </button>
                  
                  <p className="text-xs text-gray-500 mt-4 text-center">
                    Bằng cách nhấn "Đăng ký ngay", bạn đồng ý để chúng tôi liên hệ với bạn qua số điện thoại hoặc email đã cung cấp.
                  </p>
                </form>
              )}
            </div>
            
            {/* Right side - Benefits */}
            <div className="lg:w-2/5 bg-blue-600 p-6 md:p-8 text-white">
              <h3 className="text-xl font-semibold mb-6">Quyền lợi khi đăng ký sớm</h3>
              
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-5 h-5 bg-white rounded-full flex items-center justify-center text-blue-600 mr-3 mt-0.5">1</span>
                  <div>
                    <p className="font-medium">Giảm học phí 25%</p>
                    <p className="text-sm text-blue-100">Áp dụng cho tất cả các khóa học khi đăng ký trong thời gian ưu đãi</p>
                  </div>
                </li>
                
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-5 h-5 bg-white rounded-full flex items-center justify-center text-blue-600 mr-3 mt-0.5">2</span>
                  <div>
                    <p className="font-medium">Tặng thêm 2 tháng học</p>
                    <p className="text-sm text-blue-100">Kéo dài thời gian học để bạn có thể ôn tập hiệu quả hơn</p>
                  </div>
                </li>
                
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-5 h-5 bg-white rounded-full flex items-center justify-center text-blue-600 mr-3 mt-0.5">3</span>
                  <div>
                    <p className="font-medium">Tặng khóa học Phân tích đề thi</p>
                    <p className="text-sm text-blue-100">Giá trị 1.200.000đ, giúp bạn nắm vững cấu trúc đề thi mới 2025</p>
                  </div>
                </li>
                
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-5 h-5 bg-white rounded-full flex items-center justify-center text-blue-600 mr-3 mt-0.5">4</span>
                  <div>
                    <p className="font-medium">Miễn phí 5 buổi tư vấn 1-1</p>
                    <p className="text-sm text-blue-100">Được chuyên gia định hướng chiến lược học tập phù hợp</p>
                  </div>
                </li>
                
                <li className="flex items-start">
                  <span className="flex-shrink-0 w-5 h-5 bg-white rounded-full flex items-center justify-center text-blue-600 mr-3 mt-0.5">5</span>
                  <div>
                    <p className="font-medium">Ưu tiên xếp lớp với giáo viên top</p>
                    <p className="text-sm text-blue-100">Được học với đội ngũ giáo viên giỏi nhất, giàu kinh nghiệm</p>
                  </div>
                </li>
              </ul>
              
              <div className="mt-8 pt-6 border-t border-blue-500">
                <div className="flex items-center space-x-2 text-yellow-300 mb-2">
                  <IoTimeOutline className="text-lg" />
                  <p className="font-medium">Ưu đãi kết thúc trong: {timeLeft.days < 10 ? `0${timeLeft.days}` : timeLeft.days}d {timeLeft.hours < 10 ? `0${timeLeft.hours}` : timeLeft.hours}h {timeLeft.minutes < 10 ? `0${timeLeft.minutes}` : timeLeft.minutes}p {timeLeft.seconds < 10 ? `0${timeLeft.seconds}` : timeLeft.seconds}s</p>
                </div>
                <p className="text-sm text-blue-100">
                  Đừng bỏ lỡ cơ hội cuối cùng để nhận trọn bộ ưu đãi cho khóa học 2026!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Registration; 