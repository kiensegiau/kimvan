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
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(0);

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
        
        // Xử lý các phần (sections) trong khóa học
        if (detailData.sheets && detailData.sheets.length > 0) {
          const sectionsData = detailData.sheets.map((sheet, index) => {
            return {
              id: index,
              title: sheet.properties?.title || `Phần ${index + 1}`,
              lessons: [] // Sẽ được điền sau
            };
          });
          
          setSections(sectionsData);
          
          // Xử lý dữ liệu bài học từ sheet đầu tiên
          processSheetData(detailData.sheets[0], 0, decodedId);
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
  
  // Hàm xử lý dữ liệu từ một sheet cụ thể
  const processSheetData = (sheet, sectionIndex, decodedId) => {
    if (!sheet || !sheet.data || !sheet.data[0] || !sheet.data[0].rowData) {
      return [];
    }
    
    const rowData = sheet.data[0].rowData;
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
          hasContent: false,
          section: sectionIndex
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
    
    // Cập nhật state
    setSections(prevSections => {
      const newSections = [...prevSections];
      if (newSections[sectionIndex]) {
        newSections[sectionIndex].lessons = processedLessons;
      }
      return newSections;
    });
    
    if (sectionIndex === activeSection) {
      setLessons(processedLessons);
    }
    
    console.log(`Đã xử lý ${processedLessons.length} bài học từ phần ${sectionIndex + 1}`);
    
    return processedLessons;
  };
  
  // Hàm chuyển đổi giữa các phần
  const handleSectionChange = (sectionIndex) => {
    setActiveSection(sectionIndex);
    
    // Nếu đã có dữ liệu của phần này rồi thì hiển thị
    if (sections[sectionIndex] && sections[sectionIndex].lessons.length > 0) {
      setLessons(sections[sectionIndex].lessons);
    } 
    // Nếu chưa có dữ liệu thì tải
    else if (course && course.details && course.details.sheets && course.details.sheets[sectionIndex]) {
      processSheetData(course.details.sheets[sectionIndex], sectionIndex, course.id);
    }
  };

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
          <div className="inline-block h-14 w-14 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent shadow-lg"></div>
          <p className="mt-5 text-lg font-medium text-gray-700">Đang tải thông tin khóa học...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-xl">
          <div className="text-red-600 text-5xl mb-5">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-4">Lỗi khi tải dữ liệu</h1>
          <p className="mb-6 text-gray-600">{error}</p>
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gray-50">
        <div className="text-center max-w-md p-8 bg-white rounded-xl shadow-xl">
          <div className="text-yellow-600 text-5xl mb-5">🔍</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Không tìm thấy khóa học</h1>
          <p className="mb-6 text-gray-600">Khóa học bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
          <Link href="/khoa-hoc" className="inline-block px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
            ← Quay lại danh sách khóa học
          </Link>
        </div>
      </div>
    );
  }

  const subject = extractSubject(course.name);
  const teacher = extractTeacher(course.name);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/khoa-hoc" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Quay lại danh sách khóa học
          </Link>
        </div>
        
        <div className="bg-white rounded-xl shadow-xl overflow-hidden mb-8 transition-all hover:shadow-2xl">
          <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 p-8 text-white relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute top-0 left-0 w-full h-full opacity-10">
              <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white"></div>
              <div className="absolute -left-20 -bottom-20 w-80 h-80 rounded-full bg-white"></div>
            </div>
            
            <div className="relative z-10">
              <span className="inline-block text-sm font-medium bg-white bg-opacity-30 px-4 py-1.5 rounded-full backdrop-blur-sm shadow-sm">
                {subject}
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold mt-4 mb-3 text-shadow">
                {course.name}
              </h1>
              
              {teacher && (
                <div className="mt-4 flex items-center">
                  <div className="bg-white bg-opacity-20 rounded-full h-12 w-12 flex items-center justify-center mr-3 shadow-md">
                    <span className="text-white text-xl">👨‍🏫</span>
                  </div>
                  <span className="text-white text-lg font-medium">
                    Giảng viên: {teacher}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6 sm:p-8">
            <div className="flex items-center mb-6">
              <div className="w-1.5 h-8 bg-indigo-600 rounded-r mr-3"></div>
              <h2 className="text-2xl font-bold text-gray-800">Nội dung khóa học</h2>
            </div>
            
            <p className="text-gray-600 mb-8 max-w-3xl">
              Dưới đây là danh sách các bài học trong khóa học này. Nhấn vào liên kết tương ứng để truy cập video bài giảng, tài liệu hoặc bài tập về nhà.
            </p>
            
            {/* Các nút truy cập nhanh */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              <a 
                href={`/api/spreadsheets/${course.id}/LIVE/2K8/redirect`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center p-5 border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 hover:border-red-200 transition-all shadow-sm hover:shadow-md"
              >
                <div className="bg-red-100 group-hover:bg-red-200 rounded-xl p-4 mr-4 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg group-hover:text-red-700 transition-colors">Video bài giảng</h3>
                  <p className="text-sm text-gray-500 group-hover:text-red-600 transition-colors">Xem tất cả video bài giảng</p>
                </div>
              </a>
              
              <a 
                href={`/api/spreadsheets/${course.id}/TÀI LIỆU/2K8/redirect`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center p-5 border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-blue-100 hover:border-blue-200 transition-all shadow-sm hover:shadow-md"
              >
                <div className="bg-blue-100 group-hover:bg-blue-200 rounded-xl p-4 mr-4 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg group-hover:text-blue-700 transition-colors">Tài liệu học tập</h3>
                  <p className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors">Tải tất cả tài liệu học tập</p>
                </div>
              </a>
              
              <a 
                href={`/api/spreadsheets/${course.id}/BTVN/2K8/redirect`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="group flex items-center p-5 border border-gray-200 rounded-xl hover:bg-gradient-to-r hover:from-green-50 hover:to-green-100 hover:border-green-200 transition-all shadow-sm hover:shadow-md"
              >
                <div className="bg-green-100 group-hover:bg-green-200 rounded-xl p-4 mr-4 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg group-hover:text-green-700 transition-colors">Bài tập về nhà</h3>
                  <p className="text-sm text-gray-500 group-hover:text-green-600 transition-colors">Tải bài tập về nhà và đáp án</p>
                </div>
              </a>
            </div>
            
            {/* Phần chọn section */}
            {sections.length > 1 && (
              <div className="mb-8">
                <div className="border-b border-gray-200 mb-4">
                  <nav className="flex space-x-2 overflow-x-auto pb-1">
                    {sections.map((section, index) => (
                      <button
                        key={index}
                        onClick={() => handleSectionChange(index)}
                        className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors whitespace-nowrap ${
                          activeSection === index
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {section.title}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            )}
            
            {/* Danh sách chi tiết bài học */}
            <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm mb-8">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 border-b border-gray-200">
                <div className="grid grid-cols-12 gap-2 font-medium text-gray-700">
                  <div className="col-span-1 text-center">STT</div>
                  <div className="col-span-2">Ngày học</div>
                  <div className="col-span-5">Tên bài</div>
                  <div className="col-span-4">Liên kết</div>
                </div>
              </div>
              
              {sections.length > 0 && activeSection < sections.length && sections[activeSection].lessons.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {sections[activeSection].lessons.map((lesson, index) => (
                    <div key={index} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-1 text-center font-medium text-indigo-700 bg-indigo-50 rounded-full w-8 h-8 flex items-center justify-center mx-auto">
                          {lesson.stt}
                        </div>
                        <div className="col-span-2 text-sm text-gray-600">
                          {lesson.date && (
                            <span className="inline-block px-2 py-1 bg-orange-50 text-orange-800 rounded-md border border-orange-100">
                              {lesson.date}
                            </span>
                          )}
                        </div>
                        <div className="col-span-5 font-medium text-gray-800">{lesson.title}</div>
                        <div className="col-span-4 flex items-center flex-wrap gap-2">
                          {lesson.liveLink && (
                            <a 
                              href={lesson.liveLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1.5 bg-red-50 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors border border-red-200 shadow-sm"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
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
                              className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
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
                              className="inline-flex items-center px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 transition-colors border border-green-200 shadow-sm"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
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
                <div className="py-16 text-center bg-gray-50">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 text-lg">Chưa có bài học nào trong phần này</p>
                  <p className="text-gray-400 text-sm mt-2">Vui lòng quay lại sau, bài học sẽ sớm được cập nhật.</p>
                </div>
              )}
            </div>
            
            <div className="mt-8 rounded-xl overflow-hidden shadow-md bg-gradient-to-r from-amber-50 to-yellow-50 border border-yellow-200">
              <div className="p-5">
                <div className="flex items-start">
                  <div className="bg-yellow-100 rounded-full p-2 text-yellow-600 mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-yellow-800 mb-2 text-lg">Thông tin quan trọng</h3>
                    <p className="text-yellow-700 mb-1">
                      <span className="font-medium">ID Khóa học:</span> {id}
                    </p>
                    <p className="text-yellow-700 text-sm">
                      Vui lòng lưu lại ID này để truy cập khóa học trong tương lai.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center text-gray-500 text-sm mt-10">
          © {new Date().getFullYear()} Kimvan Education System. Tất cả các quyền được bảo lưu.
        </div>
      </div>
    </div>
  );
} 