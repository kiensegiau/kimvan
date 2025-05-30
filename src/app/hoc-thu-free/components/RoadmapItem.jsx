"use client";
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaChevronRight, FaCheckCircle, FaRegCircle, FaInfoCircle } from 'react-icons/fa';
import { IoTimeOutline, IoPeople, IoSchool, IoDocumentText } from 'react-icons/io5';
import { GoArrowRight } from 'react-icons/go';
import { BiRightArrowAlt } from 'react-icons/bi';

const RoadmapItem = ({ title, description, duration, index, active, setActive, total, icon }) => {
  const [isClient, setIsClient] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsClient(true), 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.3 }
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => {
      if (itemRef.current) {
        observer.unobserve(itemRef.current);
      }
    };
  }, []);

  // Animation variants
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        delay: index * 0.1 + 0.3
      }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: { 
      opacity: 1, 
      height: "auto",
      transition: { duration: 0.3 }
    },
    exit: { 
      opacity: 0, 
      height: 0,
      transition: { duration: 0.2 }
    }
  };

  // Calculate status
  let status = "pending";
  if (index < active) status = "completed";
  if (index === active) status = "current";

  const handleClick = () => {
    setActive(index);
  };

  // Get status icon
  const getStatusIcon = () => {
    if (status === "completed") {
      return <FaCheckCircle className="text-lg" />;
    } else if (status === "current") {
      return <div className="relative">
        <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30"></div>
        <FaInfoCircle className="text-lg relative z-10" />
      </div>;
    } else {
      return <FaRegCircle className="text-lg" />;
    }
  };

  // Get appropriate icon based on title or index
  const getIconByTitle = () => {
    // Nếu đã có icon từ props, sử dụng icon đó
    if (icon) return <span className="text-xl">{icon}</span>;
    
    // Nếu không, dựa vào title hoặc index để chọn icon phù hợp
    if (title.includes("Nhận thức") || index === 0) return <IoSchool className="text-xl" />;
    if (title.includes("Nghiên cứu") || index === 1) return <IoDocumentText className="text-xl" />;
    if (title.includes("Chuẩn bị") || index === 2) return <IoPeople className="text-xl" />;
    if (title.includes("Nộp đơn") || index === 3) return <IoDocumentText className="text-xl" />;
    
    // Default icon
    return <IoSchool className="text-xl" />;
  };

  if (!isClient) return null;

  return (
    <motion.div
      ref={itemRef}
      className={`flex items-start space-x-4 ${isHovered ? 'z-10' : 'z-0'} relative group cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      variants={itemVariants}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.2 }}
    >
      {/* Status indicator and connecting line */}
      <div className="relative flex flex-col items-center">
        {/* Top connecting line */}
        {index > 0 && (
          <div 
            className={`absolute top-0 -translate-y-full left-1/2 transform -translate-x-1/2 w-0.5 h-12 
              ${status === "pending" 
                ? "bg-gray-200 dark:bg-gray-700" 
                : "bg-gradient-to-t from-blue-600 to-indigo-700"
              }`}
          ></div>
        )}
        
        {/* Status Circle */}
        <div 
          className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-all duration-300 ${
            status === "pending"
              ? "border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 group-hover:border-gray-400 dark:group-hover:border-gray-500"
              : status === "current"
                ? "border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30 ring-4 ring-blue-100 dark:ring-blue-900/20"
                : "border-green-600 bg-green-50 dark:border-green-400 dark:bg-green-900/30"
          }`}
        >
          <div 
            className={`transition-all duration-300 ${
              status === "pending" ? "text-gray-500 dark:text-gray-400" : 
              status === "current" ? "text-blue-700 dark:text-blue-300" : 
              "text-green-700 dark:text-green-300"
            }`}
          >
            {getIconByTitle()}
          </div>
        </div>
        
        {/* Bottom connecting line */}
        {index < total - 1 && (
          <motion.div 
            className={`absolute bottom-0 translate-y-full left-1/2 transform -translate-x-1/2 w-0.5 h-12 
              ${index < active
                ? "bg-gradient-to-b from-blue-600 to-indigo-700"
                : "bg-gray-200 dark:bg-gray-700"
              }`}
            initial={{ height: 0 }}
            animate={{ height: "3rem" }}
            transition={{ duration: 0.5, delay: 0.2 }}
          ></motion.div>
        )}
      </div>
      
      {/* Content */}
      <div 
        ref={contentRef}
        className={`flex-1 p-4 rounded-lg transition-all duration-300 
          ${status === "current"
            ? "bg-white dark:bg-slate-800 shadow-lg border border-blue-100 dark:border-blue-900/30"
            : status === "completed"
              ? "bg-gray-50 dark:bg-slate-800/50 group-hover:bg-white dark:group-hover:bg-slate-800 group-hover:shadow-md"
              : "bg-gray-50 dark:bg-slate-800/30 group-hover:bg-white dark:group-hover:bg-slate-800/80 group-hover:shadow-sm"
          }
          ${isHovered ? "shadow-md transform -translate-y-0.5" : ""}
        `}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <div className={`mr-2 ${
              status === "pending" 
                ? "text-gray-500 dark:text-gray-400" 
                : status === "current"
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-green-700 dark:text-green-300"
            }`}>
              {getStatusIcon()}
            </div>
            <h3 
              className={`font-medium transition-colors duration-300 ${
                status === "pending" 
                  ? "text-gray-600 dark:text-gray-300 group-hover:text-gray-800 dark:group-hover:text-gray-200" 
                  : status === "current"
                    ? "text-blue-800 dark:text-blue-200"
                    : "text-gray-900 dark:text-gray-100"
              }`}
            >
              {title}
            </h3>
          </div>
          
          <span 
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              status === "pending" 
                ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300" 
                : status === "current"
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200"
                  : "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200"
            }`}
          >
            {status === "pending" 
              ? <><IoTimeOutline className="mr-1" /> {duration} tuần</> 
              : status === "current" 
                ? "Đang thực hiện" 
                : "Hoàn thành"}
          </span>
        </div>
        
        <AnimatePresence mode="wait">
          {(status === "current" || isHovered) && (
            <motion.div 
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="mt-3"
            >
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                {description.split('\n').map((item, idx) => (
                  <motion.li 
                    key={idx} 
                    className="flex items-start"
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, delay: idx * 0.1 }}
                  >
                    <BiRightArrowAlt className="flex-shrink-0 mt-0.5 mr-1.5 text-blue-600 dark:text-blue-400" />
                    {item}
                  </motion.li>
                ))}
              </ul>
              
              <button 
                className={`mt-4 inline-flex items-center text-xs font-medium px-3 py-1 rounded-full transition-all ${
                  status === "pending" 
                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700" 
                    : status === "current"
                      ? "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:hover:bg-blue-800/60"
                      : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-200 dark:hover:bg-green-800/60"
                }`}
              >
                Chi tiết <GoArrowRight className="ml-1" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default RoadmapItem; 