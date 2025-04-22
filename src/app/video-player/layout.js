export const metadata = {
  title: 'Trình phát video tùy chỉnh',
  description: 'Trình phát video với giao diện đẹp mắt và tùy chỉnh',
  robots: {
    index: false,
    follow: false
  }
};

export default function VideoPlayerLayout({ children }) {
  return (
    <>
      {children}
    </>
  );
} 