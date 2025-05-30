"use client";
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { FaPhone, FaFacebook, FaChevronDown, FaAngleDown } from 'react-icons/fa';

const Header = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState(null);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Đóng menu mobile khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      const mobileMenu = document.getElementById('mobile-menu');
      const mobileButton = document.getElementById('mobile-menu-button');
      
      if (mobileMenuOpen && mobileMenu && !mobileMenu.contains(event.target) && !mobileButton.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Đóng menu khi cuộn trang trên mobile
  useEffect(() => {
    const handleScrollClose = () => {
      if (mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    
    window.addEventListener('scroll', handleScrollClose);
    return () => window.removeEventListener('scroll', handleScrollClose);
  }, [mobileMenuOpen]);

  const headerVariants = {
    visible: { 
      y: 0,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20
      }
    },
    hidden: { 
      y: -100,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 20
      }
    }
  };

  return (
    <motion.header 
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 backdrop-blur-sm ${
        scrolled ? 'bg-white/95 shadow-md py-2' : 'bg-transparent py-4'
      }`}
      variants={headerVariants}
      initial="visible"
      animate="visible"
    >
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 relative z-20">
            <motion.div 
              className="flex items-center"
              whileHover={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <span className="text-2xl font-bold text-blue-600">KhoaHoc</span>
              <span className="text-sm bg-blue-600 text-white px-2 py-0.5 rounded ml-1">.live</span>
            </motion.div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <NavLink 
              href="#khoa-hoc" 
              onHover={() => setHoveredItem('khoa-hoc')}
              onLeave={() => setHoveredItem(null)}
              isHovered={hoveredItem === 'khoa-hoc'}
            >
              Khóa học
            </NavLink>
            <NavLink 
              href="#giang-vien" 
              onHover={() => setHoveredItem('giang-vien')}
              onLeave={() => setHoveredItem(null)}
              isHovered={hoveredItem === 'giang-vien'}
            >
              Giảng viên
            </NavLink>
            <NavLink 
              href="#linh-vuc" 
              onHover={() => setHoveredItem('linh-vuc')}
              onLeave={() => setHoveredItem(null)}
              isHovered={hoveredItem === 'linh-vuc'}
            >
              Lĩnh vực
            </NavLink>
            <NavLink 
              href="#dang-ky" 
              onHover={() => setHoveredItem('dang-ky')}
              onLeave={() => setHoveredItem(null)}
              isHovered={hoveredItem === 'dang-ky'}
            >
              Đăng ký
              <FaAngleDown className="ml-1 text-xs" />
            </NavLink>
          </nav>

          {/* Contact button */}
          <div className="hidden md:flex items-center space-x-4">
            <a 
              href="tel:0967180038" 
              className="flex items-center space-x-1 text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
            >
              <FaPhone className="text-xs animate-pulse" />
              
            </a>
            <motion.a
              href="#dang-ky"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full transition-colors shadow-md font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Tìm hiểu thêm
            </motion.a>
          </div>

          {/* Mobile menu button */}
          <button 
            id="mobile-menu-button"
            className="md:hidden text-blue-600 relative z-20"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
          >
            <motion.div
              animate={mobileMenuOpen ? "open" : "closed"}
              className="w-6 h-6 flex flex-col justify-center items-center"
            >
              <motion.span
                variants={{
                  closed: { rotate: 0, y: 0 },
                  open: { rotate: 45, y: 2 },
                }}
                className="w-6 h-0.5 bg-blue-600 block mb-1 origin-center transition-transform"
              ></motion.span>
              <motion.span
                variants={{
                  closed: { opacity: 1 },
                  open: { opacity: 0 },
                }}
                className="w-6 h-0.5 bg-blue-600 block mb-1"
              ></motion.span>
              <motion.span
                variants={{
                  closed: { rotate: 0, y: 0 },
                  open: { rotate: -45, y: -2 },
                }}
                className="w-6 h-0.5 bg-blue-600 block origin-center transition-transform"
              ></motion.span>
            </motion.div>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            id="mobile-menu"
            className="md:hidden bg-white shadow-lg mt-2 px-4 py-2 absolute top-full left-0 right-0 border-t border-gray-100"
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <nav className="flex flex-col space-y-4 py-2">
              <MobileNavLink href="#khoa-hoc" onClick={() => setMobileMenuOpen(false)}>Khóa học</MobileNavLink>
              <MobileNavLink href="#giang-vien" onClick={() => setMobileMenuOpen(false)}>Giảng viên</MobileNavLink>
              <MobileNavLink href="#linh-vuc" onClick={() => setMobileMenuOpen(false)}>Lĩnh vực</MobileNavLink>
              <MobileNavLink href="#dang-ky" onClick={() => setMobileMenuOpen(false)}>Đăng ký</MobileNavLink>
              
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <a 
                  href="tel:0967180038" 
                  className="flex items-center space-x-1 text-sm text-blue-600 font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FaPhone className="text-xs" />
                
                </a>
                <motion.a
                  href="#dang-ky" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm transition-colors shadow-md"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Tìm hiểu thêm
                </motion.a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Overlay phía sau mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            className="fixed inset-0 bg-black/20 z-10 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.header>
  );
};

// NavLink for desktop menu with hover animation
const NavLink = ({ href, children, onHover, onLeave, isHovered }) => (
  <Link 
    href={href}
    className="text-gray-800 hover:text-blue-600 font-medium transition-colors relative flex items-center"
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
  >
    <div className="flex items-center">{children}</div>
    <motion.div 
      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-blue-600 rounded-full"
      initial={{ scaleX: 0 }}
      animate={{ scaleX: isHovered ? 1 : 0 }}
      transition={{ duration: 0.2 }}
    />
  </Link>
);

// NavLink for mobile menu
const MobileNavLink = ({ href, onClick, children }) => (
  <Link 
    href={href}
    className="text-gray-800 hover:text-blue-600 font-medium py-2 transition-colors flex justify-between items-center"
    onClick={onClick}
  >
    <span>{children}</span>
    <motion.div 
      whileHover={{ x: 3 }}
      whileTap={{ x: 0 }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </motion.div>
  </Link>
);

export default Header; 