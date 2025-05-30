import { Inter } from "next/font/google";
import "../globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Học thử miễn phí - Khoá học 6.0",
  description: "Trải nghiệm học thử miễn phí các khóa học chất lượng cao tại Khoá học 6.0",
};

export default function HocThuFreeLayout({ children }) {
  return (
    <div className={`${inter.className} bg-white min-h-screen`}>
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
} 