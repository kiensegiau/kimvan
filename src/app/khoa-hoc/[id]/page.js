'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function CourseDetailPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    const fetchCourseData = async () => {
      try {
        setLoading(true);
        const decodedId = decodeURIComponent(id);
        console.log('Đang tìm kiếm khóa học với ID đã giải mã:', decodedId);
        
        // Sử dụng API của chúng ta làm trung gian kết nối đến kimvan.id.vn
        const apiUrl = `/api/spreadsheets/${decodedId}`;
        console.log('Đang kết nối qua API của chúng ta:', apiUrl);
        
        const detailResponse = await fetch(apiUrl);
        
        if (!detailResponse.ok) {
          throw new Error(`Lỗi khi lấy chi tiết khóa học: ${detailResponse.status}`);
        }
        
        const detailData = await detailResponse.json();
        
        // Tạo thông tin cơ bản cho khóa học từ ID
        let courseName = "Khóa học Full Combo 2K8";
        
        // Nếu có dữ liệu sheets và có thông tin về tên
        if (detailData.sheets && detailData.sheets[0] && detailData.sheets[0].properties) {
          courseName = detailData.sheets[0].properties.title || courseName;
        }
        
        // Tạo đối tượng khóa học
        setCourse({
          id: decodedId,
          name: courseName,
          details: detailData
        });
        
        // Xử lý dữ liệu bài học từ spreadsheet
        if (detailData.sheets && detailData.sheets[0] && detailData.sheets[0].data && detailData.sheets[0].data[0] && detailData.sheets[0].data[0].rowData) {
          const rowData = detailData.sheets[0].data[0].rowData;
          
          // Bỏ qua dòng tiêu đề (dòng đầu tiên)
          const processedLessons = [];
          
          for (let i = 1; i < rowData.length; i++) {
            const row = rowData[i];
            if (row.values) {
              // Lấy giá trị cơ bản
              const lessonData = {
                stt: row.values[0]?.formattedValue || '',
                date: row.values[1]?.formattedValue || '',
                title: row.values[2]?.formattedValue || '',
                liveLink: '',
                documentLink: '',
                homeworkLink: '',
                hasContent: false
              };
              
              // Trích xuất liên kết YouTube (LIVE) nếu có
              if (row.values[3]) {
                if (row.values[3].userEnteredFormat?.textFormat?.link?.uri) {
                  lessonData.liveLink = row.values[3].userEnteredFormat.textFormat.link.uri;
                  lessonData.hasContent = true;
                } else if (row.values[3].formattedValue && row.values[3].formattedValue !== '-') {
                  lessonData.liveLink = `/api/spreadsheets/${decodedId}/LIVE/${encodeURIComponent(lessonData.title)}/redirect`;
                  lessonData.hasContent = true;
                }
              }
              
              // Trích xuất liên kết Google Drive (TÀI LIỆU) nếu có
              if (row.values[4]) {
                if (row.values[4].userEnteredFormat?.textFormat?.link?.uri) {
                  lessonData.documentLink = row.values[4].userEnteredFormat.textFormat.link.uri;
                  lessonData.hasContent = true;
                } else if (row.values[4].hyperlink) {
                  // Nếu là ID Drive, chuyển thành URL Drive
                  if (!row.values[4].hyperlink.startsWith('http')) {
                    lessonData.documentLink = `https://drive.google.com/open?id=${row.values[4].hyperlink}`;
                  } else {
                    lessonData.documentLink = row.values[4].hyperlink;
                  }
                  lessonData.hasContent = true;
                } else if (row.values[4].formattedValue && row.values[4].formattedValue !== '-') {
                  lessonData.documentLink = `/api/spreadsheets/${decodedId}/TÀI LIỆU/${encodeURIComponent(lessonData.title)}/redirect`;
                  lessonData.hasContent = true;
                }
              }
              
              // Trích xuất liên kết BTVN nếu có
              if (row.values[5]) {
                if (row.values[5].userEnteredFormat?.textFormat?.link?.uri) {
                  lessonData.homeworkLink = row.values[5].userEnteredFormat.textFormat.link.uri;
                  lessonData.hasContent = true;
                } else if (row.values[5].hyperlink) {
                  if (!row.values[5].hyperlink.startsWith('http')) {
                    lessonData.homeworkLink = `https://drive.google.com/open?id=${row.values[5].hyperlink}`;
                  } else {
                    lessonData.homeworkLink = row.values[5].hyperlink;
                  }
                  lessonData.hasContent = true;
                } else if (row.values[5].formattedValue && row.values[5].formattedValue !== '-') {
                  lessonData.homeworkLink = `/api/spreadsheets/${decodedId}/BTVN/${encodeURIComponent(lessonData.title)}/redirect`;
                  lessonData.hasContent = true;
                }
              }
              
              // Chỉ thêm vào mảng nếu có dữ liệu ý nghĩa
              if (lessonData.title || lessonData.hasContent) {
                processedLessons.push(lessonData);
              }
            }
          }
          
          setLessons(processedLessons);
          console.log('Đã xử lý', processedLessons.length, 'bài học');
        }
        
        console.log('Đã tải dữ liệu khóa học thành công:', decodedId);
        
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu khóa học:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchCourseData();
    }
  }, [id]);

  // Hàm trích xuất môn học từ tên
  const extractSubject = (name) => {
    if (!name) return 'Khóa học';
    
    const subjects = ['VẬT LÝ', 'HÓA', 'TOÁN', 'TIẾNG ANH', 'SINH HỌC', 'SỬ', 'ĐỊA', 'GDCD'];
    
    for (const subject of subjects) {
      if (name.includes(subject)) {
        return subject;
      }
    }
    
    return 'Khóa học';
  };

  // Hàm lấy tên giáo viên từ tên khóa học
  const extractTeacher = (name) => {
    if (!name) return '';
    
    const parts = name.split('-');
    if (parts.length > 1) {
      return parts[1].trim();
    }
    
    return '';
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-lg font-medium text-gray-700">Đang tải thông tin khóa học...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">Lỗi khi tải dữ liệu</h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <div className="text-yellow-600 text-5xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Không tìm thấy khóa học</h1>
          <p className="mb-6 text-gray-600">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  const subject = extractSubject(course.name);
  const teacher = extractTeacher(course.name);

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/khoa-hoc" className="text-blue-600 hover:text-blue-800 font-medium flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Quay lại danh sách khóa học
          </Link>
        </div>
        
        <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium bg-white bg-opacity-30 px-3 py-1 rounded-full backdrop-blur-sm">
                  {subject}
                </span>
                <h1 className="text-3xl font-bold mt-4">{course.name}</h1>
                
                {teacher && (
                  <div className="mt-4 flex items-center">
                    <div className="bg-white bg-opacity-20 rounded-full h-10 w-10 flex items-center justify-center mr-3">
                      <span className="text-white font-medium">👨‍🏫</span>
                    </div>
                    <span className="text-white text-lg">{teacher}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Danh sách bài học</h2>
            <p className="text-gray-600 mb-6">
              Dưới đây là danh sách các bài học trong khóa học này. Nhấn vào từng bài để xem chi tiết.
            </p>
            
            {/* Các nút truy cập nhanh */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <a 
                href={`/api/spreadsheets/${course.id}/LIVE/2K8/redirect`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition"
              >
                <div className="bg-red-100 rounded-lg p-3 mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Video bài giảng</h3>
                  <p className="text-sm text-gray-500">Xem tất cả video bài giảng</p>
                </div>
              </a>
              
              <a 
                href={`/api/spreadsheets/${course.id}/TÀI LIỆU/2K8/redirect`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition"
              >
                <div className="bg-blue-100 rounded-lg p-3 mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Tài liệu học tập</h3>
                  <p className="text-sm text-gray-500">Tải tất cả tài liệu học tập</p>
                </div>
              </a>
              
              <a 
                href={`/api/spreadsheets/${course.id}/BTVN/2K8/redirect`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition"
              >
                <div className="bg-green-100 rounded-lg p-3 mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Bài tập về nhà</h3>
                  <p className="text-sm text-gray-500">Tải bài tập về nhà và đáp án</p>
                </div>
              </a>
            </div>
            
            {/* Danh sách chi tiết bài học */}
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <div className="bg-gray-50 p-3 border-b border-gray-200">
                <div className="grid grid-cols-12 gap-2 font-medium text-gray-700">
                  <div className="col-span-1 text-center">STT</div>
                  <div className="col-span-2">Ngày học</div>
                  <div className="col-span-5">Tên bài</div>
                  <div className="col-span-4">Liên kết</div>
                </div>
              </div>
              
              {lessons.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {lessons.map((lesson, index) => (
                    <div key={index} className="p-3 hover:bg-gray-50">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-1 text-center text-gray-600">{lesson.stt}</div>
                        <div className="col-span-2 text-sm text-gray-600">{lesson.date}</div>
                        <div className="col-span-5 font-medium">{lesson.title}</div>
                        <div className="col-span-4 flex items-center space-x-2">
                          {lesson.liveLink && (
                            <a 
                              href={lesson.liveLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2.5 py-1.5 bg-red-100 text-red-800 text-xs font-medium rounded hover:bg-red-200"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                                <path d="M14 6a2 2 0 012 2v7a2 2 0 01-2 2H9a2 2 0 01-2-2V8a2 2 0 012-2h5z" />
                              </svg>
                              Video
                            </a>
                          )}
                          
                          {lesson.documentLink && (
                            <a 
                              href={lesson.documentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2.5 py-1.5 bg-blue-100 text-blue-800 text-xs font-medium rounded hover:bg-blue-200"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                              </svg>
                              Tài liệu
                            </a>
                          )}
                          
                          {lesson.homeworkLink && (
                            <a 
                              href={lesson.homeworkLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2.5 py-1.5 bg-green-100 text-green-800 text-xs font-medium rounded hover:bg-green-200"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 2a2 2 0 00-2 2v8a2 2 0 002 2h6a2 2 0 002-2V6.414A2 2 0 0016.414 5L14 2.586A2 2 0 0012.586 2H9z" />
                                <path d="M3 8a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                              </svg>
                              BTVN
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="mt-2 text-gray-500">Chưa có bài học nào trong khóa học này</p>
                </div>
              )}
            </div>
            
            <div className="mt-8">
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
                <div className="flex items-start">
                  <div className="text-yellow-500 mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-yellow-700 mb-1">Thông tin quan trọng</h3>
                    <p className="text-yellow-600 text-sm">
                      ID Khóa học: {id}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 