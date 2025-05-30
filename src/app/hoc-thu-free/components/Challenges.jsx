"use client";
import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { FaLaptopCode, FaChartLine, FaLanguage, FaPalette, FaBriefcase, FaHeartbeat, FaCamera, FaServer } from 'react-icons/fa';

const fieldData = [
  {
    icon: <FaLaptopCode className="text-blue-600 text-3xl" />,
    title: "Công nghệ thông tin",
    description: "Từ lập trình cơ bản đến các công nghệ tiên tiến như AI, blockchain và phát triển ứng dụng. Trở thành chuyên gia công nghệ với hơn 200+ khóa học được cập nhật liên tục."
  },
  {
    icon: <FaChartLine className="text-green-600 text-3xl" />,
    title: "Kinh doanh & Marketing",
    description: "Phát triển kỹ năng quản lý, marketing số và kinh doanh trực tuyến. Học từ các chuyên gia đã thành công và ứng dụng ngay vào công việc thực tế của bạn."
  },
  {
    icon: <FaLanguage className="text-purple-600 text-3xl" />,
    title: "Ngoại ngữ",
    description: "Tiếng Anh, Nhật, Hàn, Trung và nhiều ngôn ngữ khác với phương pháp học hiệu quả, tập trung vào giao tiếp thực tế và khả năng ứng dụng trong công việc."
  },
  {
    icon: <FaPalette className="text-orange-500 text-3xl" />,
    title: "Thiết kế & Sáng tạo",
    description: "Khám phá các khóa học về thiết kế đồ họa, UI/UX, chỉnh sửa ảnh và video, animation và nhiều lĩnh vực sáng tạo khác từ các chuyên gia hàng đầu."
  },
  {
    icon: <FaBriefcase className="text-red-500 text-3xl" />,
    title: "Kỹ năng nghề nghiệp",
    description: "Nâng cao kỹ năng mềm, quản lý thời gian, giao tiếp hiệu quả và tư duy phản biện. Những kỹ năng thiết yếu để thăng tiến trong sự nghiệp của bạn."
  },
  {
    icon: <FaHeartbeat className="text-pink-500 text-3xl" />,
    title: "Sức khỏe & Đời sống",
    description: "Yoga, thiền, dinh dưỡng và các kỹ thuật quản lý stress. Cân bằng cuộc sống và duy trì sức khỏe tốt với các khóa học từ các chuyên gia hàng đầu."
  },
  {
    icon: <FaCamera className="text-yellow-500 text-3xl" />,
    title: "Nhiếp ảnh & Video",
    description: "Từ kỹ thuật chụp ảnh cơ bản đến hậu kỳ chuyên nghiệp. Khám phá cách tạo ra nội dung hình ảnh và video chất lượng cao cho mạng xã hội và tiếp thị."
  },
  {
    icon: <FaServer className="text-indigo-600 text-3xl" />,
    title: "Dữ liệu & Phân tích",
    description: "Khóa học về phân tích dữ liệu, học máy, trí tuệ nhân tạo và các công cụ BI. Phát triển kỹ năng dữ liệu để đưa ra quyết định dựa trên thông tin chính xác."
  }
];

const Fields = () => {
  const { scrollYProgress } = useScroll();
  const scale = useTransform(scrollYProgress, [0, 0.5], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0.6, 1]);
  
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, type: "spring", stiffness: 70 }
    }
  };

  // Nổi bật - thẻ spotlight effect
  const Spotlight = ({ children, className = "" }) => {
    return (
      <div className={`relative overflow-hidden rounded-xl ${className}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-200/20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-blue-100/30 pointer-events-none" />
        {children}
      </div>
    );
  };

  return (
    <section id="linh-vuc" className="py-16 relative">
      {/* Background với pattern và gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-slate-200/50 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.15] [background-image:radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]"></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative">
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
            className="inline-flex items-center justify-center p-1 px-4 mb-4 rounded-full bg-gradient-to-r from-blue-50 to-blue-100 text-blue-600 border border-blue-200"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <FaLaptopCode className="text-blue-500 mr-2 text-sm" />
            <span className="font-medium text-sm">Đa dạng lĩnh vực</span>
          </motion.div>
          
          <h2 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 mb-4">
            KHÁM PHÁ LĨNH VỰC BẠN YÊU THÍCH
          </h2>
          
          <h3 className="text-xl md:text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 max-w-3xl mx-auto mb-6">
            Hơn 1000+ khóa học chất lượng cao từ 8 lĩnh vực khác nhau
          </h3>
          
          <p className="text-slate-600 max-w-2xl mx-auto">
            KhoaHoc.live cung cấp đa dạng các khóa học từ các chuyên gia hàng đầu trong nhiều lĩnh vực khác nhau. 
            Dù bạn muốn nâng cao kỹ năng chuyên môn hay khám phá lĩnh vực mới, chúng tôi đều có các khóa học phù hợp.
          </p>
        </motion.div>

        <motion.div 
          style={{ scale, opacity }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {fieldData.map((field, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group bg-white backdrop-blur-sm bg-opacity-80 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 border border-blue-50 relative overflow-hidden"
              whileHover={{ 
                y: -5,
                transition: { duration: 0.2 }
              }}
            >
              <Spotlight className="absolute inset-0" />
              
              {/* Decorative elements */}
              <div className="absolute -right-3 -top-3 w-20 h-20 bg-gradient-to-br from-blue-50 to-transparent rounded-full opacity-80"></div>
              <div className="absolute -left-4 -bottom-4 w-28 h-28 bg-gradient-to-tr from-blue-50 to-transparent rounded-full opacity-50"></div>
              
              {/* Content */}
              <div className="relative">
                <div className="mb-4 transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  {field.icon}
                </div>
                
                <h3 className="font-bold text-lg mb-3 text-slate-800 group-hover:text-blue-700 transition-colors duration-300">
                  {field.title}
                </h3>
                
                <p className="text-slate-600 text-sm leading-relaxed">
                  {field.description}
                </p>
                
                {/* Hover indicator */}
                <div className="mt-4 h-1 w-12 bg-blue-500 rounded-full transform origin-left scale-0 group-hover:scale-100 transition-transform duration-300"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 border border-blue-300 max-w-3xl mx-auto shadow-lg relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-white opacity-10 rounded-full"></div>
            <div className="absolute left-1/2 -bottom-8 w-32 h-32 bg-white opacity-10 rounded-full"></div>
            
            <h4 className="text-xl font-bold text-white mb-3 relative">
              Không tìm thấy lĩnh vực bạn quan tâm?
            </h4>
            
            <p className="text-blue-100 mb-4 relative">
              Chúng tôi liên tục mở rộng danh mục khóa học với các chủ đề mới và hấp dẫn.
              Liên hệ với chúng tôi nếu bạn muốn đề xuất lĩnh vực bạn quan tâm!
            </p>
            
            <motion.div 
              className="mt-4"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <a 
                href="#dang-ky" 
                className="inline-block text-blue-700 bg-white hover:bg-blue-50 font-semibold px-6 py-3 rounded-full shadow-lg transition-all duration-300"
              >
                Đề xuất lĩnh vực mới
              </a>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Fields; 