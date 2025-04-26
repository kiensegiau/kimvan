import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from './components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Kimvan - Hệ thống học tập',
  description: 'Hệ thống học tập trực tuyến Kimvan',
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={inter.className}>
        <div className="flex">
          <Sidebar />
          <main className="flex-1 ml-64 min-h-screen bg-gray-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
