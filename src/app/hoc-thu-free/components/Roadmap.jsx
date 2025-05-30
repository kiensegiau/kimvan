"use client";
import React, { useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Image from 'next/image';
import RoadmapItem from './RoadmapItem';
import { FaRoad, FaCalendarAlt, FaAward, FaTrophy, FaChevronDown, FaChevronUp, FaCheckCircle } from 'react-icons/fa';

const Roadmap = () => {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.2], [0.7, 1]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [0.95, 1]);

  const toggleExpand = (index) => {
    if (expandedIndex === index) {
      setExpandedIndex(null);
    } else {
      setExpandedIndex(index);
    }
  };

  const roadmapData = [
    {
      title: "Giai đoạn 1: Lớp 10 - Xây nền tảng",
      desc: "Tăng tốc ngay từ đầu với kiến thức nền và lộ trình chinh phục đề thi THPTQG 2026",
      period: "2023 - 2024",
      features: [
        "Học chắc chương trình lớp 10 theo quy định mới nhất của Bộ GD&ĐT",
        "Lấp đầy lỗ hổng kiến thức từ THCS còn thiếu",
        "Phát triển phương pháp học chủ động, tư duy phản biện",
        "Định hướng sơ bộ về năng lực, nhóm ngành phù hợp",
        "Xây dựng thói quen học tập hiệu quả, kỹ năng tự học"
      ],
      advanced: [
        "Tham gia các kỳ thi đánh giá năng lực (định hướng)",
        "Bắt đầu xây dựng hồ sơ năng lực cá nhân",
        "Tham gia các hoạt động ngoại khóa, phát triển kỹ năng mềm",
        "Làm quen với đề thi thử THPTQG để hiểu rõ định hướng"
      ],
      level: 1,
      image: "/images/roadmap-stage1.png"
    },
    {
      title: "Giai đoạn 2: Lớp 11 - Phát triển toàn diện",
      desc: "Mở rộng kiến thức và phát triển toàn diện các kỹ năng cần thiết",
      period: "2024 - 2025",
      features: [
        "Nắm vững chương trình lớp 11 theo quy định cập nhật mới nhất 2025",
        "Tập trung vào các môn định hướng ngành nghề tương lai",
        "Rèn luyện kỹ năng làm bài thi, quản lý thời gian",
        "Xác định rõ ràng hơn về năng lực bản thân và định hướng nghề nghiệp",
        "Tham gia các kỳ thi thử để đánh giá năng lực cá nhân"
      ],
      advanced: [
        "Tham gia các chương trình học thuật nâng cao",
        "Phát triển dự án cá nhân liên quan đến định hướng ngành nghề",
        "Tham gia các hoạt động tình nguyện và phát triển cộng đồng",
        "Nghiên cứu kỹ về các trường đại học, ngành học mục tiêu"
      ],
      level: 2,
      image: "/images/roadmap-stage2.png"
    },
    {
      title: "Giai đoạn 3: Lớp 12 - Chinh phục đỉnh cao",
      desc: "Bứt phá trong năm học cuối cấp và sẵn sàng cho kỳ thi THPTQG",
      period: "2025 - 2026",
      features: [
        "Hoàn thiện chương trình lớp 12 theo CTGDPT 2018 và cập nhật theo quy định mới nhất 2025",
        "Ôn luyện chuyên sâu, tổng hợp kiến thức 3 năm THPT",
        "Luyện đề thi thử THPTQG theo hướng dẫn ôn thi mới 2025 của Bộ GD&ĐT",
        "Chiến lược ôn thi hiệu quả với phương pháp luyện đề chuyên sâu",
        "Xây dựng kế hoạch ôn tập cá nhân hóa theo từng giai đoạn"
      ],
      advanced: [
        "Chiến lược điền nguyện vọng thông minh theo Thông tư 06/2025/TT-BGDĐT",
        "Hoàn thiện hồ sơ xét tuyển đặc biệt (nếu có)",
        "Tư vấn chọn trường, chọn ngành phù hợp với năng lực",
        "Chuẩn bị cho các phương thức xét tuyển đa dạng"
      ],
      level: 3,
      image: "/images/roadmap-stage3.png"
    }
  ];

  // Hiệu ứng xuất hiện cho các thành phần
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
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { 
        type: "spring", 
        stiffness: 60, 
        damping: 20 
      }
    }
  };

  return (
    <section id="khoa-hoc" className="py-16 relative">
      {/* Background với pattern và gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-50 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#4338ca_1px,transparent_1px)] [background-size:24px_24px]"></div>
      </div>
      
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ 
            duration: 0.8,
            type: "spring"
          }}
          className="mb-12 text-center max-w-3xl mx-auto"
        >
          <motion.div 
            className="inline-flex items-center justify-center p-1 px-4 mb-4 rounded-full bg-gradient-to-r from-indigo-50 to-blue-100 text-indigo-700 border border-indigo-200"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <FaRoad className="text-indigo-600 mr-2 text-sm" />
            <span className="font-medium text-sm">Phát triển bản thân</span>
          </motion.div>
          
          <h2 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-blue-600 mb-4">
            LỘ TRÌNH HỌC TẬP HIỆU QUẢ
          </h2>
          
          <p className="text-slate-600 max-w-2xl mx-auto">
            KhoaHoc.live cung cấp lộ trình học tập được thiết kế khoa học, 
            giúp bạn phát triển bản thân một cách toàn diện và đạt được mục tiêu trong sự nghiệp.
          </p>
        </motion.div>

        {/* Road map visual */}
        <div className="relative">
          {/* Đường kẻ nối các giai đoạn */}
          <div className="absolute left-1/2 top-10 bottom-0 w-1 bg-gradient-to-b from-blue-400 to-indigo-600 hidden md:block" style={{ transform: 'translateX(-50%)' }}></div>
          
          <motion.div
            style={{ opacity, scale }}
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="space-y-12 relative"
          >
            {roadmapData.map((item, index) => (
              <motion.div 
                key={index}
                variants={itemVariants}
                className="relative z-10"
              >
                <div className={`flex flex-col md:flex-row items-center ${index % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                  {/* Content container */}
                  <div className="w-full md:w-5/12"></div>
                  
                  <div className="w-full md:w-5/12 bg-white bg-opacity-90 backdrop-blur-sm rounded-2xl shadow-xl border border-indigo-100 overflow-hidden transition-all duration-300 hover:shadow-2xl transform hover:-translate-y-1">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 text-white relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 w-16 h-16 bg-white opacity-10 rounded-full"></div>
                      <div className="absolute -left-4 -bottom-4 w-20 h-20 bg-white opacity-10 rounded-full"></div>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <FaCalendarAlt className="mr-2" />
                          <span className="font-medium">{item.period}</span>
                        </div>
                        <div className="flex items-center px-2 py-1 bg-white bg-opacity-20 rounded-full text-xs">
                          <FaTrophy className="mr-1" />
                          <span>Giai đoạn {item.level}/3</span>
                        </div>
                      </div>
                      
                      <h3 className="text-xl font-bold mt-2">{item.title}</h3>
                      <p className="text-blue-100 mt-1">{item.desc}</p>
                    </div>
                    
                    {/* Body */}
                    <div className="p-4">
                      <div className="flex flex-wrap items-center mb-3">
                        <div className="flex items-center mr-3 mb-2">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
                          <span className="text-sm text-gray-600">Mục tiêu cơ bản</span>
                        </div>
                        <div className="flex items-center mb-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mr-1"></div>
                          <span className="text-sm text-gray-600">Phát triển nâng cao</span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 mb-4">
                        {item.features.map((feature, featureIndex) => (
                          <div key={featureIndex} className="flex items-start">
                            <FaCheckCircle className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                            <p className="text-gray-700 text-sm">{feature}</p>
                          </div>
                        ))}
                      </div>
                      
                      {/* Nút mở rộng */}
                      <div 
                        className="flex items-center justify-center py-2 cursor-pointer text-indigo-600 hover:text-indigo-800 transition-colors"
                        onClick={() => toggleExpand(index)}
                      >
                        <span className="text-sm font-medium mr-1">
                          {expandedIndex === index ? 'Thu gọn' : 'Xem chi tiết nâng cao'}
                        </span>
                        {expandedIndex === index ? <FaChevronUp /> : <FaChevronDown />}
                      </div>
                      
                      {/* Phần mở rộng */}
                      {expandedIndex === index && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3 }}
                          className="pt-2 border-t border-gray-100"
                        >
                          <div className="space-y-1">
                            {item.advanced.map((adv, advIndex) => (
                              <div key={advIndex} className="flex items-start">
                                <FaCheckCircle className="text-blue-500 mt-1 mr-2 flex-shrink-0" />
                                <p className="text-gray-700 text-sm">{adv}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </div>
                    
                    {/* Footer */}
                    <div className="px-4 py-3 bg-indigo-50 flex justify-between items-center">
                      <div className="text-sm text-indigo-700 font-medium">
                        Lớp {item.level + 9}
                      </div>
                      <div className="text-sm text-indigo-600">
                        {expandedIndex === index ? (
                          <span className="flex items-center">
                            <FaAward className="mr-1" /> 
                            Mục tiêu toàn diện
                          </span>
                        ) : (
                          `${item.features.length + item.advanced.length} mục tiêu`
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="bg-gradient-to-r from-indigo-600 to-blue-500 rounded-xl p-6 max-w-3xl mx-auto shadow-xl relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white opacity-10 rounded-full"></div>
            <div className="absolute left-1/2 -bottom-8 w-32 h-32 bg-white opacity-10 rounded-full"></div>
            
            <h4 className="text-xl font-bold text-white mb-3 relative">
              Hãy bắt đầu hành trình của bạn ngay hôm nay!
            </h4>
            
            <p className="text-blue-100 mb-6 relative">
              Đừng để thời gian trôi qua một cách lãng phí. Lộ trình 3 năm với TopUni 
              sẽ giúp bạn chuẩn bị đầy đủ những kiến thức và kỹ năng cần thiết để chinh phục 
              kỳ thi THPTQG 2026 và bước vào cánh cửa đại học mơ ước.
            </p>
            
            <motion.div 
              className="inline-block"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <a 
                href="#dang-ky" 
                className="inline-block text-indigo-700 bg-white hover:bg-blue-50 font-semibold px-6 py-3 rounded-full shadow-lg transition-all duration-300"
              >
                Đăng ký tư vấn lộ trình cá nhân hóa
              </a>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Roadmap; 