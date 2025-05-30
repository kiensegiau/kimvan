"use client";
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { IoTimeOutline, IoClose } from 'react-icons/io5';
import { FaGraduationCap, FaRegLightbulb, FaUserGraduate, FaRegClock, FaLaptop, FaMobileAlt, FaCertificate, FaGlobe, FaPlay, FaLock, FaCheckCircle, FaRegStar, FaStar, FaUnlock, FaKey } from 'react-icons/fa';
import { useRouter } from "next/navigation";

const HeroSection = () => {
  // Các states cho UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showTrialSuccess, setShowTrialSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Thêm state cho các particle để tránh hydration mismatch
  const [particles, setParticles] = useState([]);
  
  const router = useRouter();

  // Khởi tạo particles chỉ ở phía client để tránh hydration mismatch
  useEffect(() => {
    const generateParticles = () => {
      return [...Array(15)].map((_, i) => ({
        id: i,
        width: Math.random() > 0.7 ? 4 : 3,
        height: Math.random() > 0.7 ? 4 : 3,
        color: Math.random() > 0.7 ? 'bg-yellow-400/20' : 'bg-blue-600/20',
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        duration: 3 + Math.random() * 5,
        delay: Math.random() * 2
      }));
    };

    setParticles(generateParticles());
  }, []);

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
      const seconds = Math.floor((difference / (1000) % 60));
      
      return { days, hours, minutes, seconds };
    };

    // Initialize time left immediately
    setTimeLeft(calculateTimeLeft());
    
    const intervalId = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 }
    }
  };

  // Các điểm nổi bật của nền tảng
  const trends = [
    { icon: <FaLaptop />, text: "Học mọi lúc, mọi nơi" },
    { icon: <FaRegLightbulb />, text: "Nội dung chất lượng cao" },
    { icon: <FaUserGraduate />, text: "Giảng viên hàng đầu" },
    { icon: <FaCertificate />, text: "Chứng chỉ được công nhận" },
  ];

  return (
    <section className="relative mt-16 md:mt-20 pt-12 pb-16 md:py-16 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-white -z-10">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
        {/* Thêm background pattern thay vì dùng hình ảnh */}
        <div className="absolute inset-0 opacity-5 bg-gradient-to-tr from-blue-200 to-purple-100"></div>
      </div>
      
      {/* Floating particles - decorative */}
      <div className="absolute inset-0 -z-10">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className={`absolute w-${particle.width} h-${particle.height} rounded-full ${particle.color}`}
            style={{
              top: particle.top,
              left: particle.left
            }}
            animate={{
              y: [0, -15, 0],
              opacity: [0.4, 0.8, 0.4]
            }}
            transition={{
              duration: particle.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: particle.delay
            }}
          />
        ))}
      </div>

      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-center">
          {/* Left column - Text content */}
          <motion.div 
            className="md:w-1/2 md:pr-8 mb-8 md:mb-0"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              className="inline-block px-3 py-1 bg-blue-100 text-blue-600 rounded-full mb-4 font-medium text-sm"
              variants={itemVariants}
            >
              <span className="flex items-center">
                <span className="w-2 h-2 bg-blue-600 rounded-full mr-2 animate-pulse"></span>
                TRỞ THÀNH CHUYÊN GIA
              </span>
            </motion.div>
            
            <motion.h1 
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight"
              variants={itemVariants}
            >
              Nền tảng học trực tuyến <span className="text-blue-600 relative">
                hàng đầu
                <svg className="absolute bottom-1 left-0 w-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 10" width="100%" height="10" preserveAspectRatio="none">
                  <path d="M0,5 C20,0 80,10 100,5" fill="none" stroke="#3B82F6" strokeWidth="2" />
                </svg>
              </span> Việt Nam
            </motion.h1>
            
            <motion.p 
              className="text-lg text-gray-700 mb-8"
              variants={itemVariants}
            >
              Khám phá hơn 1000+ khóa học từ các chuyên gia hàng đầu. Nâng cao kỹ năng, 
              mở rộng kiến thức và phát triển sự nghiệp của bạn với KhoaHoc.live.
            </motion.p>
            
            {/* Xu hướng */}
            <motion.div
              className="flex flex-wrap gap-3 mb-8"
              variants={itemVariants}
            >
              {trends.map((trend, index) => (
                <div 
                  key={index}
                  className="flex items-center bg-white rounded-full px-3 py-1.5 text-sm text-gray-700 shadow-sm border border-gray-100"
                >
                  <span className="text-blue-600 mr-1.5">
                    {trend.icon}
                  </span>
                  {trend.text}
                </div>
              ))}
            </motion.div>
            
            {/* CTA buttons */}
            <motion.div 
              className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-8"
              variants={itemVariants}
            >
              <motion.a 
                href="https://m.me/khoahoc6.0" 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="relative z-10">Đăng ký ngay</span>
                <motion.span 
                  className="absolute inset-0 bg-blue-500 z-0"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                />
              </motion.a>
              <motion.a 
                href="#khoa-hoc" 
                className="bg-white hover:bg-gray-50 text-blue-600 text-center font-semibold px-6 py-3 rounded-full shadow border-2 border-blue-100 hover:border-blue-200 transition-all duration-300"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                Khám phá khóa học
              </motion.a>
            </motion.div>
            
            {/* Countdown timer */}
            <motion.div 
              className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100"
              variants={itemVariants}
            >
              <div className="flex items-center space-x-2 text-blue-600 mb-2">
                <IoTimeOutline className="text-lg animate-pulse" />
                <p className="font-medium">Ưu đãi kết thúc vào 23:59 hôm nay</p>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center">
                <CountdownBox value={timeLeft.days} label="NGÀY" />
                <CountdownBox value={timeLeft.hours} label="GIỜ" />
                <CountdownBox value={timeLeft.minutes} label="PHÚT" />
                <CountdownBox value={timeLeft.seconds} label="GIÂY" />
              </div>
              
              <motion.p 
                className="text-center text-sm text-gray-600 mt-2 bg-yellow-50 py-1 px-2 rounded border border-yellow-100"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <span className="font-medium text-yellow-600">Giảm giá 50%!</span> Áp dụng cho học viên đăng ký trong hôm nay
              </motion.p>
              
              {/* Nút học thử ngay */}
              <motion.button
                onClick={() => setIsModalOpen(true)}
                className="block w-full mt-4 bg-green-600 hover:bg-green-700 text-white text-center font-semibold px-6 py-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 relative overflow-hidden group"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
              >
                <span className="relative z-10 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Học thử ngay
                </span>
                <motion.span 
                  className="absolute inset-0 bg-green-500 z-0"
                  initial={{ x: '-100%' }}
                  whileHover={{ x: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                />
              </motion.button>
            </motion.div>
          </motion.div>
          
          {/* Right column - Image and decorations */}
          <motion.div 
            className="md:w-1/2 relative"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
          >
            <div className="relative z-10 rounded-xl overflow-hidden shadow-2xl">
              <div className="aspect-w-4 aspect-h-3 bg-blue-100 relative">
                {/* Hero image */}
                <div className="w-full h-full">
                  <Image
                    src="/images/student-success.jpg"
                    alt="Học viên thành công cùng KhoaHoc.live"
                    className="object-cover"
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                    unoptimized={true}
                  />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent"></div>
                </div>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400 rounded-full filter blur-3xl opacity-20 -z-10"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-600 rounded-full filter blur-3xl opacity-20 -z-10"></div>
            
            {/* Pulsing circle */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-blue-400/30 -z-10">
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-blue-400/40"
                animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
            
            {/* Stats floating cards */}
            <motion.div 
              className="absolute -left-12 top-1/4 bg-white p-3 rounded-lg shadow-lg"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              whileHover={{ y: -5, boxShadow: '0 15px 30px rgba(0,0,0,0.1)' }}
            >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-full text-white flex items-center justify-center font-semibold">
                  100+
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Giảng viên hàng đầu</p>
                  <p className="text-xs text-gray-600">Chuyên gia trong nhiều lĩnh vực</p>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              className="absolute -right-6 bottom-1/3 bg-white p-3 rounded-lg shadow-lg"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 1 }}
              whileHover={{ y: -5, boxShadow: '0 15px 30px rgba(0,0,0,0.1)' }}
            >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-green-600 rounded-full text-white flex items-center justify-center font-semibold">
                  1K+
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Khóa học chất lượng</p>
                  <p className="text-xs text-gray-600">Đa dạng lĩnh vực</p>
                </div>
              </div>
            </motion.div>
            
            {/* Thống kê nổi bật rơi xuống */}
            <motion.div 
              className="absolute -bottom-5 left-1/4 bg-white px-3 py-2 rounded-lg shadow-lg"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.5, 
                delay: 1.2,
                type: "spring",
                stiffness: 100
              }}
            >
              <p className="text-xs text-gray-500">Học viên đã đăng ký</p>
              <p className="text-lg font-bold text-blue-600">50.000+</p>
            </motion.div>
          </motion.div>
        </div>
      </div>
      
      {/* Modal học thử */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Overlay */}
            <motion.div 
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
            />
            
            {/* Modal Content */}
            <motion.div
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative z-10 shadow-2xl"
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25 }}
            >
              {/* Close button */}
              <button 
                className="absolute top-4 right-4 z-20 bg-white/80 backdrop-blur-sm rounded-full p-2 text-gray-700 hover:text-red-500 transition-colors duration-200"
                onClick={() => setIsModalOpen(false)}
              >
                <IoClose className="w-6 h-6" />
              </button>
              
              {/* Header với background gradient */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-400 rounded-t-2xl p-6 text-white">
                <div className="flex items-center mb-2">
                  <span className="px-2 py-1 bg-yellow-500 text-xs font-bold rounded mr-2">VIP</span>
                  <h3 className="text-xl font-bold">Khóa học luyện thi Đại học 2025</h3>
                </div>
                <p className="opacity-80 text-sm">Nâng cao kiến thức và kỹ năng làm bài thi với đội ngũ giảng viên chất lượng cao</p>
              </div>
              
              {/* Modal Body */}
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center mb-3">
                    <div className="flex text-yellow-400 mr-2">
                      {[...Array(5)].map((_, i) => (
                        <FaStar key={i} className="text-sm" />
                      ))}
                    </div>
                    <span className="text-gray-600 text-sm">5.0 (2,305 đánh giá)</span>
                  </div>
                </div>
                
                {/* Học thử VIP */}
                <div className="mb-6 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl overflow-hidden">
                  <div className="p-5 relative">
                    <div className="absolute top-0 right-0">
                      <div className="bg-yellow-400 text-xs font-bold text-gray-900 px-3 py-1 rounded-bl-xl">
                        MIỄN PHÍ
                      </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center">
                      <div className="mb-4 md:mb-0 md:mr-6 flex-shrink-0">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                          <FaKey className="text-white text-xl" />
                        </div>
                      </div>
                      <div className="text-white text-center md:text-left w-full">
                        <h3 className="text-xl font-bold mb-1">Học thử VIP - Hạn 1 giờ</h3>
                        <p className="text-white text-sm mb-4">
                          Trải nghiệm đầy đủ tính năng VIP trong 1 giờ - không cần đăng ký tài khoản!
                        </p>
                        
                        <div className="rounded-full overflow-hidden">
                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            className="bg-[#ffffff] text-indigo-700 font-semibold py-3 px-6 rounded-full shadow-lg flex items-center justify-center w-full"
                            onClick={() => {
                              // Đơn giản chỉ đóng modal
                              setIsModalOpen(false);
                            }}
                          >
                            <FaUnlock className="mr-2" />
                            Học thử ngay không cần đăng ký
                          </motion.button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 bg-white/10 rounded-lg p-2 text-white text-xs text-center">
                      <span className="flex items-center justify-center">
                        <FaRegClock className="mr-1" />
                        Tài khoản học thử tự động hết hạn sau 1 giờ, không cần hủy!
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Bảng giá */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="border border-gray-200 rounded-xl p-4 relative">
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                      Gói 1 tháng
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 text-center mt-2 mb-2">150.000đ</h3>
                    <p className="text-gray-500 text-sm text-center mb-4">Sử dụng trong 30 ngày</p>
                    <ul className="space-y-2">
                      {[
                        "Toàn bộ bài giảng & tài liệu",
                        "Kho đề thi mẫu & đáp án",
                        "Hỗ trợ kỹ thuật 24/7",
                        "Forum học tập trực tuyến"
                      ].map((feature, idx) => (
                        <li key={idx} className="flex items-center">
                          <FaCheckCircle className="text-blue-500 mr-2 text-sm" />
                          <span className="text-gray-700 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="border-2 border-yellow-500 rounded-xl p-4 relative bg-gradient-to-b from-yellow-50 to-white shadow-md">
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-white px-4 py-1 rounded-full text-sm font-bold">
                      Gói 1 năm - Tiết kiệm 78%
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 text-center mt-2 mb-1">400.000đ</h3>
                    <p className="text-center line-through text-gray-500 text-sm mb-2">1.800.000đ</p>
                    <p className="text-yellow-600 text-sm font-medium text-center mb-3">Chỉ 33.000đ/tháng</p>
                    <ul className="space-y-2">
                      {[
                        "Toàn bộ bài giảng & tài liệu",
                        "Kho đề thi mẫu & đáp án",
                        "Hỗ trợ kỹ thuật 24/7",
                        "Forum học tập trực tuyến"
                      ].map((feature, idx) => (
                        <li key={idx} className="flex items-center">
                          <FaCheckCircle className="text-yellow-600 mr-2 text-sm" />
                          <span className="text-gray-800 text-sm font-medium">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 bg-yellow-100 p-2 rounded-lg text-center">
                      <span className="text-yellow-700 text-xs font-medium">💰 Tiết kiệm 1.4 triệu đồng so với mua từng tháng</span>
                    </div>
                  </div>
                </div>
                
                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row gap-4 mb-5">
                  <a 
                    href="https://m.me/khoahoc6.0"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
                  >
                    <FaGlobe className="mr-2" />
                    Đăng ký ngay qua Messenger
                  </a>
                  <button 
                    className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Đăng ký gói 1 năm - Tiết kiệm 78%
                  </button>
                  <button 
                    className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-full shadow border-2 border-gray-200 hover:border-gray-300 transition-all duration-300"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Chọn gói 1 tháng
                  </button>
                </div>
                
                {/* Countdown timer */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-gray-700 font-medium flex items-center">
                      <FaRegClock className="mr-2 text-yellow-500" />
                      Ưu đãi kết thúc vào 23:59 hôm nay
                    </p>
                    <div className="flex space-x-2">
                      <div className="bg-gray-200 text-gray-800 font-mono rounded px-2 py-1 text-sm">
                        {timeLeft.hours < 10 ? `0${timeLeft.hours}` : timeLeft.hours}
                      </div>
                      <div className="text-gray-500">:</div>
                      <div className="bg-gray-200 text-gray-800 font-mono rounded px-2 py-1 text-sm">
                        {timeLeft.minutes < 10 ? `0${timeLeft.minutes}` : timeLeft.minutes}
                      </div>
                      <div className="text-gray-500">:</div>
                      <div className="bg-gray-200 text-gray-800 font-mono rounded px-2 py-1 text-sm">
                        {timeLeft.seconds < 10 ? `0${timeLeft.seconds}` : timeLeft.seconds}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

// Component hộp đếm ngược
const CountdownBox = ({ value, label }) => (
  <motion.div 
    className="bg-blue-50 rounded-lg p-2 relative overflow-hidden"
    whileHover={{ 
      scale: 1.05, 
      backgroundColor: "#EFF6FF" // Equivalent to bg-blue-50 but slightly brighter on hover
    }}
  >
    <motion.div
      className="absolute inset-0 bg-blue-100 origin-bottom"
      initial={{ scaleY: 0 }}
      animate={{ scaleY: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      style={{ zIndex: 0 }}
    />
    <div className="relative z-10">
      <div className="text-2xl md:text-3xl font-bold text-blue-600">{value < 10 ? `0${value}` : value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  </motion.div>
);

export default HeroSection; 