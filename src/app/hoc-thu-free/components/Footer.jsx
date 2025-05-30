"use client";
import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { FaFacebook, FaTwitter, FaYoutube, FaInstagram, FaLinkedin } from 'react-icons/fa';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-900 text-white pt-12 pb-6">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Logo và giới thiệu */}
          <div>
            <div className="flex items-center mb-4">
              <span className="text-2xl font-bold text-white">KhoaHoc</span>
              <span className="text-sm bg-blue-600 text-white px-2 py-0.5 rounded ml-1">.live</span>
            </div>
            <p className="text-gray-400 mb-4">
              Nền tảng học trực tuyến hàng đầu Việt Nam với hơn 1000+ khóa học 
              chất lượng từ các chuyên gia trong nhiều lĩnh vực.
            </p>
            <div className="flex space-x-3">
              <SocialIcon icon={<FaFacebook />} href="https://www.facebook.com/khoahoc6.0" />
              <SocialIcon icon={<FaTwitter />} href="https://twitter.com" />
              <SocialIcon icon={<FaYoutube />} href="https://youtube.com" />
              <SocialIcon icon={<FaInstagram />} href="https://instagram.com" />
              <SocialIcon icon={<FaLinkedin />} href="https://linkedin.com" />
            </div>
          </div>
          
          {/* Danh mục */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Khóa học</h3>
            <ul className="space-y-2">
              <FooterLink href="#khoa-hoc">Khóa học nổi bật</FooterLink>
              <FooterLink href="#linh-vuc">Lĩnh vực học tập</FooterLink>
              <FooterLink href="#roadmap">Lộ trình học tập</FooterLink>
              <FooterLink href="#giang-vien">Giảng viên</FooterLink>
              <FooterLink href="#dang-ky">Đăng ký khóa học</FooterLink>
            </ul>
          </div>
          
          {/* Hỗ trợ */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Hỗ trợ</h3>
            <ul className="space-y-2">
              <FooterLink href="#">Trung tâm hỗ trợ</FooterLink>
              <FooterLink href="#">FAQ</FooterLink>
              <FooterLink href="#">Liên hệ</FooterLink>
              <FooterLink href="#">Chính sách bảo mật</FooterLink>
              <FooterLink href="#">Điều khoản sử dụng</FooterLink>
            </ul>
          </div>
          
          {/* Liên hệ */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Liên hệ</h3>
            <ul className="space-y-2 text-gray-400">
              <li>
                <a 
                  href="https://www.facebook.com/khoahoc6.0" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center hover:text-blue-400 transition-colors"
                >
                  <FaFacebook className="mr-2" />
                  Facebook: khoahoc6.0
                </a>
              </li>
              <li className="pt-2">Email: support@khoahoc.live</li>
            </ul>
          </div>
        </div>
        
        <div className="text-center pt-6 border-t border-gray-800">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-gray-500 text-sm">
              &copy; {currentYear} KhoaHoc.live - Nền tảng học trực tuyến.
            </p>
          </motion.div>
        </div>
      </div>
    </footer>
  );
};

// Component link footer
const FooterLink = ({ href, children }) => (
  <li>
    <Link 
      href={href} 
      className="text-gray-400 hover:text-blue-400 transition-colors"
    >
      {children}
    </Link>
  </li>
);

// Component icon mạng xã hội
const SocialIcon = ({ icon, href }) => (
  <motion.a 
    href={href} 
    target="_blank" 
    rel="noopener noreferrer"
    className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-blue-600 hover:text-white transition-all"
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
  >
    {icon}
  </motion.a>
);

export default Footer; 