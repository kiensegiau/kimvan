import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>Trang chủ</h1>
      <p>Hệ thống chuyển hướng Kimvan</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '0 auto' }}>
        <a 
          href="/khoa-hoc" 
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#4f46e5', 
            color: 'white', 
            borderRadius: '5px',
            textDecoration: 'none'
          }}
        >
          Xem khóa học
        </a>
        
        <a 
          href="/courses" 
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#6366f1', 
            color: 'white', 
            borderRadius: '5px',
            textDecoration: 'none'
          }}
        >
          Xem Full Combo Khóa 2K8
        </a>
        
        <a 
          href="/api/cache" 
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#10b981', 
            color: 'white', 
            borderRadius: '5px',
            textDecoration: 'none'
          }}
        >
          Xem cache các liên kết đã lưu
        </a>
        
        <a 
          href="/api/spreadsheets/QD3nU2uI047DjsbKVicmy1MbGbRM-10_HGXU_YzD0yi62TIaHL2W7mlF7AVKM4Ad0PGbhBwJXz0/LIVE/KHOA I - LUYEN THI THPT MON VAT LY NAM 2025/redirect" 
          style={{ 
            padding: '10px 15px', 
            backgroundColor: '#ef4444', 
            color: 'white', 
            borderRadius: '5px',
            textDecoration: 'none'
          }}
        >
          Ví dụ chuyển hướng
        </a>
      </div>
    </div>
  );
}
