import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h1>Trang chủ</h1>
      <p>Hệ thống chuyển hướng Kimvan</p>
      <p>
        <a href="/api/spreadsheets/QD3nU2uI047DjsbKVicmy1MbGbRM-10_HGXU_YzD0yi62TIaHL2W7mlF7AVKM4Ad0PGbhBwJXz0/LIVE/KHOA I - LUYEN THI THPT MON VAT LY NAM 2025/redirect">
          Ví dụ chuyển hướng
        </a>
      </p>
    </div>
  );
}
