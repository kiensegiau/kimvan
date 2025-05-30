"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { FaStar, FaQuoteLeft, FaQuoteRight } from 'react-icons/fa';

const Reviews = () => {
  const [activeIndex, setActiveIndex] = useState(0);

  const reviews = [
    {
      id: 1,
      name: "Minh Anh",
      age: 17,
      avatar: "/images/avatar-1.jpg",
      rating: 5,
      course: "Luyện thi ĐGNL ĐHQG",
      content: "slay quá ạ!!! 💅 học xong khóa này điểm tăng vèo vèo luôn í 📈 thầy giảng dễ hiểu mà còn có nhiều meme hay nữa, không buồn ngủ như học ở trường 🥱 em đã đỗ được trường mình thích, cảm ơn team rất nhìu nhé ✨",
      highlight: "slay quá ạ!!! 💅"
    },
    {
      id: 2,
      name: "Tuấn Đạt",
      age: 18,
      avatar: "/images/avatar-2.jpg",
      rating: 5,
      course: "Luyện thi THPT QG 2025",
      content: "học ở đây xịn xò thật sự đó mọi người ơiiiii 😭 đến kỳ thi em chill phết, không toxic như mấy chỗ khác. thầy cô nhiệt tình, còn có group riêng để hỏi bài khi kẹt nữa. 10/10 would recommend nhaaaaa",
      highlight: "xịn xò thật sự đó mọi người ơiiiii 😭"
    },
    {
      id: 3,
      name: "Khánh Linh",
      age: 16,
      avatar: "/images/avatar-3.jpg",
      rating: 4,
      course: "Luyện thi học sinh giỏi",
      content: "ngl các thầy cô ở đây teach khá ổn áp 🔥 bọn em có group chat riêng để hỏi bài và trò chuyện, vibe khá là chill! bài tập thì nhiều nhưng mà giúp mình hiểu sâu nên không complain gì hết nha 💯",
      highlight: "vibe khá là chill!"
    },
    {
      id: 4,
      name: "Hoàng Long",
      age: 18,
      avatar: "/images/avatar-4.jpg",
      rating: 5,
      course: "Luyện thi ĐGNL ĐHQG",
      content: "eMoTioNaL dAmAGe khi thấy đề thi thử khó quá 💀 nhưng sau khi học xong thì ib tạch ez nhé ae 😎 thầy giảng hay, có mẹo làm bài siêu tốc, bài giảng ko cringe như mấy chỗ khác luôn. thanks team nhiều lắm ạ ✌️",
      highlight: "ib tạch ez nhé ae 😎"
    },
    {
      id: 5,
      name: "Thùy Trang",
      age: 17,
      avatar: "/images/avatar-5.jpg",
      rating: 5,
      course: "Luyện thi THPT QG 2025",
      content: "lúc đầu em cũng hơi lo nma học xong thì fr fr không phải lo nữa 🤩 bài giảng dễ hiểu, thầy cô không judge khi hỏi mấy câu basic, bạn bè cũng hype nhau lên nên motivate học cao lắm ạ ✨ btw mình đã đỗ nguyện vọng 1 rùi nè hihi",
      highlight: "fr fr không phải lo nữa 🤩"
    },
    {
      id: 6,
      name: "Bảo Nghi",
      age: 16,
      avatar: "/images/avatar-6.jpg",
      rating: 5,
      course: "Luyện thi ĐGNL HCM",
      content: "ib chốt 1 lớp toán thấy hơi đắt nhưng mà worth every penny 💸 tài liệu xịn sò, có cả kho đề cập nhật liên tục, giảng viên top 1 không cap 🧢 giải đề siêu dễ hiểu luôn ạ, team support 24/7 nữa chứ ❤️",
      highlight: "worth every penny 💸"
    },
    {
      id: 7,
      name: "Quang Minh",
      age: 17,
      avatar: "/images/avatar-7.jpg",
      rating: 5,
      course: "Luyện thi THPT QG 2025",
      content: "đúng kiểu expectation vs reality chuẩn không cần chỉnh 😂 tưởng học online chán mà học ở đây nghe như đang coi podcast zui lắm á, thầy giảng như đang kể chuyện không à 🤣 nhờ ôn ở đây mà em tăng 3 điểm văn, siêu mãn nhãn luôn",
      highlight: "chuẩn không cần chỉnh 😂"
    },
    {
      id: 8,
      name: "Hà My",
      age: 17,
      avatar: "/images/avatar-8.jpg",
      rating: 4,
      course: "Luyện thi ĐGTD ĐHBK",
      content: "mọi người dùng code HAMY15 để được giảm 15% học phí nha 👀 đùa thôi hihi 🤭 nhưng mà thật sự học ở đây xịn lắm á! bài giảng cập nhật theo đề mới nhất, cô chữa bài siêu tỉ mỉ, e từ 6.5 lên 8.5 trong có 2 tháng á mng ơi ✌️",
      highlight: "xịn lắm á!"
    },
    {
      id: 9,
      name: "Phương Nam",
      age: 18,
      avatar: "/images/avatar-9.jpg",
      rating: 5,
      course: "Luyện thi THPT QG 2025",
      content: "POV: bạn đang ngồi ôn thpt mà không hiểu gì cả 🤔 sau đó bạn học ở khoahoc.live và bạn be like: 🧠📚🔥 mình tăng từ 6 lên 9 điểm lý chỉ sau 3 tháng luôn đó! team support siêu nhiệt tình, giải đáp cả lúc 2h sáng luôn 😱",
      highlight: "POV: be like: 🧠📚🔥"
    },
    {
      id: 10,
      name: "Gia Huy",
      age: 18,
      avatar: "/images/avatar-10.jpg",
      rating: 5,
      course: "Luyện thi ĐGNL ĐHQG",
      content: "trust the process 💯 học ở đây đúng là một vibe khác, toàn giảng viên gen z nên nói chuyện hợp cực, hiểu tâm lý, không áp lực như học thêm truyền thống. bài giảng dạng visual learner thích lắm, nhìn là nhớ luôn 👁️👄👁️",
      highlight: "trust the process 💯"
    },
    {
      id: 11,
      name: "Thu Hà",
      age: 16,
      avatar: "/images/avatar-11.jpg",
      rating: 5,
      course: "Luyện thi HSG Toán",
      content: "hôm bữa đi thi HSG toán cấp thành, thấy đề ra là biết ăn chắc rồi 😎 giáo viên ở đây ngoài dạy kiến thức còn dạy cả chiến thuật làm bài nữa, đỉnh thật sự! tài liệu hay ho ko đụng hàng, team quá xịn xò 🌟 ở đây chính là investment chứ ko phải expense!",
      highlight: "đỉnh thật sự!"
    },
    {
      id: 12,
      name: "Minh Khôi",
      age: 17,
      avatar: "/images/avatar-12.jpg",
      rating: 4,
      course: "Luyện thi THPT QG 2025",
      content: "được bố mẹ đăng ký cho và ban đầu cũng định skip 🥲 nhưng mà sau buổi đầu là ghiền luôn, giảng viên humor quá trời 🤣 vừa học vừa cười mà điểm lại tăng đều, hôm trước thi thử được 8.5 anh văn luôn, cảm ơn team rất nhìuuuu",
      highlight: "giảng viên humor quá trời 🤣"
    },
    {
      id: 13,
      name: "Thảo Vy",
      age: 16,
      avatar: "/images/avatar-13.jpg",
      rating: 5,
      course: "Luyện thi ĐGNL HCM",
      content: "bestie ơi công nhận học ở đây đỉnh thật đó 😍 giảng viên cưng xỉu, tài liệu xịn mà giá hợp lý, mình học được 2 khóa rồi mà vẫn muốn học tiếp 🥹 học xong là hiểu liền à, không phải như ở trường nghe cô giảng 2 tiếng vẫn confused",
      highlight: "bestie ơi công nhận học ở đây đỉnh thật đó 😍"
    },
    {
      id: 14,
      name: "Đăng Khoa",
      age: 18,
      avatar: "/images/avatar-14.jpg",
      rating: 5,
      course: "Luyện thi ĐGTD ĐHBK",
      content: "cảm giác như vừa unbox một món quà siêu xịn vậy đó 🎁 giảng viên thì quá pro, tài liệu quá đỉnh, support 24/7 nữa! bài tập khó mà giải dễ hiểu, toàn dạng xu hướng mới nhất. 4 tháng học ở đây là đủ để ăn đề ĐGTD luôn! slay the day 🔥",
      highlight: "slay the day 🔥"
    },
    {
      id: 15,
      name: "Thanh Trúc",
      age: 17,
      avatar: "/images/avatar-15.jpg",
      rating: 5,
      course: "Luyện thi THPT QG 2025",
      content: "giáo viên ở đây top tier thật sự 🙌 tưởng học online là ngủ gục nhưng mà bài giảng ở đây toàn drama, meme, ví dụ real life nên học phát hiểu liền! pov: bạn học xong và đi thi như đi chơi 😎 thanks team đã giúp em từ trầm cảm vì học thành học mà vui như đi chơi ạ",
      highlight: "giáo viên ở đây top tier thật sự 🙌"
    },
    {
      id: 16,
      name: "Hiếu Minh",
      age: 16,
      avatar: "/images/avatar-16.jpg",
      rating: 4,
      course: "Luyện thi ĐGNL ĐHQG",
      content: "periodt! 💅 từ beginner tới winner chỉ cần học ở đây thôi! team support nhanh như flash ⚡ lại còn nhiệt tình nữa, giải thích tới khi hiểu mới thôi. update tài liệu quá trời, toàn bài mới nhất, đề trend nhất. btw mình đã đạt 920/1000 điểm đánh giá năng lực rùi nhaaa ✌️",
      highlight: "periodt! 💅"
    },
    {
      id: 17,
      name: "Bảo Ngọc",
      age: 17,
      avatar: "/images/avatar-17.jpg",
      rating: 5,
      course: "Luyện thi THPT QG 2025",
      content: "nah fr fr học ở đây xịn xò thật sự luôn ý 😳 giảng viên gen z nên hiểu tâm lý lứa tuổi, giảng bài cực kỳ dễ hiểu với các meme trend mới nhất 🤣 bài giảng hay tới mức tui còn save về để coi lại hoài. đỗ đại học chuẩn cmn chỉnh luôn ạ ✨",
      highlight: "nah fr fr học ở đây xịn xò thật sự luôn ý 😳"
    },
    {
      id: 18,
      name: "Quốc Anh",
      age: 18,
      avatar: "/images/avatar-18.jpg",
      rating: 5,
      course: "Luyện thi ĐGNL ĐHQG",
      content: "main character energy khi vào phòng thi và biết hết tất cả đáp án 💯 học ở đây real game changer nha mn, không phải đống lý thuyết khô khan mà là applied knowledge luôn. team respond nhanh như chớp, giáo viên thì expertise không cần phải bàn nữa, the best of the best 🏆",
      highlight: "main character energy 💯"
    },
    {
      id: 19,
      name: "Diệu Linh",
      age: 17,
      avatar: "/images/avatar-19.jpg",
      rating: 5,
      course: "Luyện thi THPT QG 2025",
      content: "glow up cực mạnh từ khi học ở đây luôn 🌟 em từ một đứa xếp hạng bottom lớp giờ thuộc top 10 rồi nè 📈 khóa học Anh văn ở đây đỉnh quá chừng, cô giáo dạy phát âm chuẩn như native speaker, học 1 thời gian là có thể viết essay như Harry Potter í 🪄",
      highlight: "glow up cực mạnh từ khi học ở đây luôn 🌟"
    },
    {
      id: 20,
      name: "Đức Huy",
      age: 18,
      avatar: "/images/avatar-20.jpg",
      rating: 5,
      course: "Luyện thi ĐGTD ĐHBK",
      content: "no cap 🧢 học ở đây quá đỉnh! đội ngũ giảng viên toàn top tier, giải đề cực kỳ chi tiết và chia sẻ nhiều tips hay ho. slide bài giảng đẹp xuất sắc, color scheme tươi sáng nên học không bị ngủ gật. ôn 3 tháng ở đây là đủ làm bài thi tốt nghiệp ez pz lemon squeezy rồi 🍋",
      highlight: "no cap 🧢 học ở đây quá đỉnh!"
    },
    {
      id: 21,
      name: "Minh Tú",
      age: 17,
      avatar: "/images/avatar-21.jpg",
      rating: 5,
      course: "Luyện thi THPT QG 2025",
      content: "vibes ở đây immaculate thật sự luôn 💖 học mà cảm giác như đang đi chơi í, giảng viên humor level max, bài giảng thì engaging cực kỳ. lần đầu tiên thấy học mà không muốn skip buổi nào 😱 giờ em nói gì thì nói chứ điểm tăng vù vù, cảm ơn team rất nhiều ạ!",
      highlight: "vibes ở đây immaculate thật sự luôn 💖"
    },
    {
      id: 22,
      name: "Gia Bảo",
      age: 16,
      avatar: "/images/avatar-22.jpg",
      rating: 4,
      course: "Luyện thi ĐGNL HCM",
      content: "literally đóng tiền xong là thấy điểm tăng luôn 🤑 đùa thôi chứ bài giảng dễ hiểu kinh khủng, giáo viên kiên nhẫn giải thích đến khi hiểu, có cả group học tập để hỏi bài bất cứ lúc nào. Nói chung là chef's kiss 👨‍🍳💋 100/10 recommend cho tất cả các bạn muốn đỗ đại học",
      highlight: "literally đóng tiền xong là thấy điểm tăng luôn 🤑"
    },
    {
      id: 23,
      name: "Thu Thảo",
      age: 18,
      avatar: "/images/avatar-23.jpg",
      rating: 5,
      course: "Luyện thi THPT QG 2025",
      content: "big slay energy khi đi thi và biết hết tất cả đáp án 💅 à mà chưa biết thì cứ áp dụng phương pháp đã học là ra liền. thầy cô ở đây không chỉ dạy kiến thức mà còn dạy cả mindset nữa, tức là biết cách học thông minh, approach vấn đề đúng cách. best investment ever frfr ✨",
      highlight: "big slay energy 💅"
    },
    {
      id: 24,
      name: "Quang Hùng",
      age: 17,
      avatar: "/images/avatar-24.jpg",
      rating: 5,
      course: "Luyện thi ĐGTD ĐHBK",
      content: "bro trust me đăng ký học ở đây đi, không phí tiền đâu 💯 giảng viên toàn top của top, học phí vừa phải mà chất lượng cao ngất. mỗi bài giảng là một masterpiece, dạy từ cơ bản đến nâng cao, có cả mẹo làm bài siêu tốc nữa. mình học xong là flex vào ĐHBK dễ ẹc luôn 😎",
      highlight: "bro trust me 💯"
    },
    {
      id: 25,
      name: "Thảo Nguyên",
      age: 16,
      avatar: "/images/avatar-25.jpg",
      rating: 5,
      course: "Luyện thi ĐGNL ĐHQG",
      content: "bling bling như kim cương vậy đó các bạn ơi ✨ qua các khóa học ở đây, kiến thức em sáng bừng lên, điểm số cứ thế vù vù tăng. đội ngũ giảng viên gen z quá là dễ thương và gần gũi, lại còn rất am hiểu tâm lý học sinh. sau khóa học, em tự tin chinh phục ĐGNL ĐHQG 2025 luôn 🚀",
      highlight: "bling bling như kim cương vậy đó ✨"
    }
  ];

  const nextReview = () => {
    setActiveIndex((prevIndex) => (prevIndex === reviews.length - 1 ? 0 : prevIndex + 1));
  };

  const prevReview = () => {
    setActiveIndex((prevIndex) => (prevIndex === 0 ? reviews.length - 1 : prevIndex - 1));
  };

  const goToReview = (index) => {
    setActiveIndex(index);
  };

  return (
    <section className="py-16 relative bg-gradient-to-b from-indigo-50 to-white overflow-hidden">
      {/* Background với pattern */}
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#4338ca_1px,transparent_1px)] [background-size:24px_24px]"></div>
      
      {/* Ảnh nền teen Việt Nam */}
      <div className="absolute left-0 bottom-0 w-72 h-96 opacity-30 hidden lg:block">
        <div className="relative w-full h-full">
          <Image 
            src="/images/student-success.jpg" 
            alt="Vietnamese students studying" 
            fill 
            style={{objectFit: 'cover'}}
            className="rounded-tr-3xl"
          />
        </div>
      </div>
      
      <div className="absolute right-0 top-20 w-64 h-80 opacity-30 hidden lg:block">
        <div className="relative w-full h-full">
          <Image 
            src="/images/student-success.jpg" 
            alt="Vietnamese students celebrating" 
            fill 
            style={{objectFit: 'cover'}}
            className="rounded-bl-3xl"
          />
        </div>
      </div>
      
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8 }}
          className="mb-12 text-center max-w-3xl mx-auto"
        >
          <motion.div 
            className="inline-flex items-center justify-center p-1 px-4 mb-4 rounded-full bg-gradient-to-r from-indigo-50 to-blue-100 text-indigo-700 border border-indigo-200"
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <FaStar className="text-yellow-500 mr-2 text-sm" />
            <span className="font-medium text-sm">học viên nói gì về chúng mình</span>
          </motion.div>
          
          <h2 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-blue-600 mb-4">
            REVIEW TỪ GEN Z
          </h2>
          
          <p className="text-slate-600 max-w-2xl mx-auto">
            Không tin lời PR đâu, nghe chính học viên chia sẻ trải nghiệm thật khi học tại KhoaHoc.live nhé!
          </p>
        </motion.div>

        {/* Reviews Carousel */}
        <div className="max-w-5xl mx-auto">
          <div className="relative">
            {/* Review cards */}
            <div className="overflow-hidden">
              <motion.div 
                className="flex items-center"
                initial={{ opacity: 0 }}
                animate={{ x: `-${activeIndex * 100}%`, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                {reviews.map((review, index) => (
                  <div 
                    key={review.id} 
                    className="w-full flex-shrink-0 px-4"
                  >
                    <motion.div 
                      className="bg-white rounded-xl shadow-xl p-6 md:p-8 border border-indigo-100 relative"
                      initial={{ opacity: 0, y: 50 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                    >
                      <div className="absolute top-8 right-8 text-indigo-100 opacity-30">
                        <FaQuoteRight size={60} />
                      </div>
                      
                      <div className="flex flex-col md:flex-row md:items-center mb-6">
                        <div className="flex-shrink-0 mb-4 md:mb-0 md:mr-4">
                          <div className="w-16 h-16 md:w-20 md:h-20 relative rounded-full overflow-hidden bg-indigo-100 border-2 border-indigo-200">
                            {/* Placeholder avatar element when no real images are available */}
                            <div className="absolute inset-0 flex items-center justify-center text-indigo-500 font-bold text-xl">
                              {review.name.charAt(0)}
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{review.name}, {review.age}</h3>
                          <p className="text-indigo-600 font-medium text-sm">{review.course}</p>
                          <div className="flex mt-1">
                            {[...Array(5)].map((_, i) => (
                              <FaStar 
                                key={i} 
                                className={i < review.rating ? "text-yellow-400" : "text-gray-300"} 
                                size={16} 
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <FaQuoteLeft className="absolute -left-2 -top-2 text-indigo-200" size={16} />
                        <p className="text-gray-600 italic pl-4 leading-relaxed">{review.content}</p>
                      </div>
                      
                      <div className="mt-6 bg-indigo-50 p-4 rounded-lg">
                        <p className="text-indigo-700 font-bold text-sm md:text-base">{review.highlight}</p>
                      </div>
                    </motion.div>
                  </div>
                ))}
              </motion.div>
            </div>
            
            {/* Controls */}
            <div className="flex justify-between items-center mt-6">
              <motion.button
                onClick={prevReview}
                className="w-10 h-10 rounded-full bg-white border border-indigo-200 text-indigo-600 flex items-center justify-center shadow hover:bg-indigo-50 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>
              
              <div className="flex space-x-2">
                {reviews.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToReview(index)}
                    className={`w-2.5 h-2.5 rounded-full transition-colors ${index === activeIndex ? 'bg-indigo-600' : 'bg-indigo-200'}`}
                  />
                ))}
              </div>
              
              <motion.button
                onClick={nextReview}
                className="w-10 h-10 rounded-full bg-white border border-indigo-200 text-indigo-600 flex items-center justify-center shadow hover:bg-indigo-50 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            </div>
          </div>
          
          {/* CTA */}
          <motion.div
            className="mt-16 text-center bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-8 shadow-xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h3 className="text-white text-2xl font-bold mb-4">tham gia ngay để đồng hành cùng gen z khác!</h3>
            
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              không còn là "i'm gonna fail" mà là "i just slayed this test" 💅✨ đăng ký học ngay để có trải nghiệm học tập chill mà hiệu quả!
            </p>
            
            <motion.a
              href="#dang-ky"
              className="inline-block bg-white text-indigo-600 font-bold px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-all"
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.95 }}
            >
              đăng ký ngay nào! 🚀
            </motion.a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Reviews; 