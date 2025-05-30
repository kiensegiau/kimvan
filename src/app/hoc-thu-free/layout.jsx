"use client";

import React, { useEffect, useState } from "react";
import { Outfit } from "next/font/google";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import Head from "next/head";

// Tối ưu font loading
const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  weight: ["400", "500", "600", "700", "800"],
});

export default function KhoaHocLiveLayout({ children }) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // State để kiểm soát việc hiển thị hiệu ứng loading
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Giả lập thời gian tải trang
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <Head>
        <title>KhoaHoc.live - Nền tảng học trực tuyến hàng đầu</title>
        <meta name="description" content="Nền tảng học trực tuyến với đa dạng khóa học chất lượng cao từ các giảng viên hàng đầu, giúp bạn nâng cao kỹ năng và phát triển sự nghiệp." />
        <meta name="keywords" content="khóa học online, học trực tuyến, e-learning, khoahoc.live, phát triển kỹ năng" />
        <meta property="og:title" content="KhoaHoc.live - Nền tảng học trực tuyến hàng đầu" />
        <meta property="og:description" content="Nền tảng học trực tuyến với đa dạng khóa học chất lượng cao từ các giảng viên hàng đầu." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://khoahoc.live/" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={`${outfit.className} min-h-screen bg-white text-gray-900 relative overflow-hidden`}>
        {/* Loading overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="fixed inset-0 z-50 bg-white flex items-center justify-center"
            >
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center"
              >
                <div className="text-3xl font-bold flex items-center text-blue-600 mb-4">
                  <span>KhoaHoc</span>
                  <span className="text-sm bg-blue-600 text-white px-2 py-0.5 rounded ml-2">.live</span>
                </div>
                <div className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-blue-600 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress Bar hiệu ứng cuộn trang */}
        <motion.div
          className="fixed top-0 left-0 right-0 h-1 bg-blue-600 origin-left z-50"
          style={{ scaleX }}
        />
        
        {/* Button back to top */}
        <BackToTop />
        
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="relative z-10"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}

// Component nút back to top
const BackToTop = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisible = () => {
      const scrolled = document.documentElement.scrollTop;
      if (scrolled > 500) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisible);
    return () => window.removeEventListener('scroll', toggleVisible);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          onClick={scrollToTop}
          className="fixed bottom-24 right-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 z-40"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
};

