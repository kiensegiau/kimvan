const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const os = require('os');
const axios = require('axios');
const http = require('http');
const https = require('https');
const { uploadToGoogleDrive } = require('./upload-service.js');
const { v4: uuidv4 } = require('uuid');

// Hàm làm sạch tên file để đảm bảo an toàn cho hệ thống file
function sanitizeFileName(fileName) {
  if (!fileName) return 'unknown_file';
  
  // Loại bỏ các ký tự không hợp lệ trong tên file
  let sanitized = fileName
    .replace(/[\\/:*?"<>|]/g, '_') // Thay thế các ký tự không hợp lệ bằng dấu gạch dưới
    .replace(/\s+/g, ' ')          // Thay thế nhiều khoảng trắng bằng một khoảng trắng
    .trim();                       // Loại bỏ khoảng trắng ở đầu và cuối
  
  // Giới hạn độ dài tên file
  if (sanitized.length > 200) {
    const extension = sanitized.lastIndexOf('.');
    if (extension !== -1 && extension > 190) {
      // Nếu có phần mở rộng và tên file quá dài
      const ext = sanitized.substring(extension);
      sanitized = sanitized.substring(0, 190) + ext;
    } else {
      // Nếu không có phần mở rộng hoặc phần mở rộng ngắn
      sanitized = sanitized.substring(0, 200);
    }
  }
  
  // Đảm bảo tên file không trống
  if (!sanitized) {
    sanitized = 'unnamed_file';
  }
  
  return sanitized;
}

class VideoProcessor {
  constructor(tempDir = 'temp') {
    this.TEMP_DIR = typeof tempDir === 'string' ? tempDir : 'temp';
    this.browser = null;
    this.profilePath = path.join(os.homedir(), 'drive-pdf-watermark-profile');
    this.ensureTempDir();
    this.ensureProfileDir();
    
    // Cấu hình cho download
    this.MAX_RETRIES = 3;
    this.RETRY_DELAY = 2000;
    this.CHUNK_SIZE = 25 * 1024 * 1024; // 25MB mỗi chunk
    this.CONCURRENT_CHUNKS = 20;
    this.MAX_CHUNK_RETRIES = 5;
    
    // Lưu trữ dữ liệu video hiện tại
    this.currentFormatData = null;
    this.currentVideoId = null;
  }

  ensureTempDir() {
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  ensureProfileDir() {
    try {
      if (!fs.existsSync(this.profilePath)) {
        fs.mkdirSync(this.profilePath, { recursive: true });
      }
      console.log(`🔑 Sử dụng hồ sơ Chrome tại: ${this.profilePath}`);
    } catch (error) {
      console.error(`❌ Lỗi tạo thư mục hồ sơ Chrome: ${error.message}`);
    }
  }

  /**
   * Xử lý MIME type cho video
   * @param {string} mimeType - MIME type gốc
   * @returns {string} MIME type chuẩn hóa
   */
  standardizeVideoMimeType(mimeType) {
    if (!mimeType) return 'video/mp4';
    
    const lowerMime = mimeType.toLowerCase();
    
    if (lowerMime.includes('mp4')) return 'video/mp4';
    if (lowerMime.includes('webm')) return 'video/webm';
    if (lowerMime.includes('avi')) return 'video/x-msvideo';
    if (lowerMime.includes('mov') || lowerMime.includes('quicktime')) return 'video/quicktime';
    if (lowerMime.includes('wmv')) return 'video/x-ms-wmv';
    if (lowerMime.includes('flv')) return 'video/x-flv';
    if (lowerMime.includes('mkv') || lowerMime.includes('matroska')) return 'video/x-matroska';
    
    // Default fallback
    return 'video/mp4';
  }
  
  /**
   * Kiểm tra xem có phải là file video không
   * @param {string} mimeType - MIME type cần kiểm tra
   * @returns {boolean} true nếu là video, false nếu không phải
   */
  isVideoMimeType(mimeType) {
    if (!mimeType) return false;
    
    const lowerMime = mimeType.toLowerCase();
    
    return lowerMime.startsWith('video/') || 
           lowerMime.includes('mp4') || 
           lowerMime.includes('webm') || 
           lowerMime.includes('avi') || 
           lowerMime.includes('mov') || 
           lowerMime.includes('quicktime') || 
           lowerMime.includes('wmv') || 
           lowerMime.includes('flv') || 
           lowerMime.includes('mkv') || 
           lowerMime.includes('matroska');
  }

  /**
   * Xử lý file PDF thành video
   * @param {string} fileId - ID của file Google Drive
   * @param {string} fileName - Tên file đầu ra
   * @param {string} targetFolderId - ID folder đích để upload
   * @returns {Promise<object>} - Kết quả xử lý
   */
  async handlePDFToVideo(fileId, fileName, targetFolderId) {
    console.log(`🎬 VideoProcessor: Bắt đầu xử lý file ID ${fileId} với tên ${fileName}`);
    
    if (!fileId) {
      return { success: false, error: 'Thiếu file ID' };
    }
    
    let downloadedFilePath = null;
    let processedFilePath = null;
    
    try {
      // 1. Xác định loại file từ Drive API
      console.log(`🔍 Kiểm tra thông tin file từ Drive API...`);
      let fileInfo;
      try {
        fileInfo = await this.getFileInfo(fileId);
        console.log(`✅ Đã lấy thông tin file: ${JSON.stringify(fileInfo)}`);
        
        // Kiểm tra xem có phải file video không
        if (!this.isVideoMimeType(fileInfo.mimeType)) {
          console.warn(`⚠️ File không phải video (${fileInfo.mimeType}), nhưng vẫn xử lý như video`);
        }
      } catch (fileInfoError) {
        console.error(`❌ Không thể lấy thông tin file: ${fileInfoError.message}`);
        // Tiếp tục mà không có thông tin file
      }
      
      // 2. Tạo đường dẫn tạm cho file tải xuống
      const fileExtension = fileInfo?.fileExtension || 'mp4';
      const tempFileName = `${uuidv4()}.${fileExtension}`;
      downloadedFilePath = path.join(this.tempDir, tempFileName);
      
      console.log(`📥 Tải xuống file từ Google Drive...`);
      
      // 3. Tải xuống file
      try {
        await this.downloadFile(fileId, downloadedFilePath);
        console.log(`✅ Đã tải xuống file thành công: ${downloadedFilePath}`);
      } catch (downloadError) {
        console.error(`❌ Lỗi khi tải xuống file: ${downloadError.message}`);
        return { 
          success: false, 
          error: `Lỗi khi tải xuống file: ${downloadError.message}`,
          fileInfo
        };
      }
      
      // 4. Sử dụng đường dẫn tải xuống làm đường dẫn đã xử lý (không cần xử lý video)
      processedFilePath = downloadedFilePath;
      console.log(`📤 File video đã sẵn sàng để upload: ${processedFilePath}`);
      
      // 5. Upload lại file đã xử lý lên Drive
      console.log(`📤 Upload file video lên Google Drive...`);
      let uploadResult;
      try {
        const uploadName = fileName || tempFileName;
        const mimeType = fileInfo?.mimeType || this.standardizeVideoMimeType(null);
        
        uploadResult = await this.uploadFile(processedFilePath, uploadName, mimeType, targetFolderId);
        console.log(`✅ Đã upload file thành công: ${JSON.stringify(uploadResult)}`);
      } catch (uploadError) {
        console.error(`❌ Lỗi khi upload file: ${uploadError.message}`);
        return { 
          success: true,  // Đánh dấu là thành công một phần vì đã tải xuống được
          filePath: processedFilePath,
          error: `Lỗi khi upload file: ${uploadError.message}`,
          fileInfo
        };
      }
      
      return {
        success: true,
        originalFileId: fileId,
        filePath: processedFilePath,
        uploadResult,
        fileInfo
      };
      
    } catch (error) {
      console.error(`❌ Lỗi khi xử lý video: ${error.message}`);
      
      // Trả về kết quả lỗi chi tiết
      return {
        success: false,
        error: `Lỗi xử lý video: ${error.message}`,
        filePath: downloadedFilePath || null,
        originalFileId: fileId
      };
    }
  }

  async uploadProcessedVideo(filePath, fileName, targetFolderId) {
    console.log(`📤 Đang upload video lên Google Drive: ${fileName}`);
    
    try {
      // Kiểm tra file tồn tại
      if (!fs.existsSync(filePath)) {
        throw new Error(`File không tồn tại: ${filePath}`);
      }
      
      // Kiểm tra kích thước file
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
      console.log(`Kích thước file: ${fileSizeInBytes} bytes (${fileSizeInMB.toFixed(2)} MB)`);
      
      // Phương pháp 1: Sử dụng uploadToGoogleDrive từ upload-service.js
      try {
        console.log(`🔄 Upload video sử dụng uploadToGoogleDrive từ upload-service.js`);
        
        // Gọi hàm uploadToGoogleDrive
        const uploadResult = await uploadToGoogleDrive(
          filePath,
          fileName,
          'video/mp4',
          targetFolderId
        );
        
        console.log(`✅ Upload thành công: ${uploadResult.fileName} (ID: ${uploadResult.fileId})`);
        return {
          success: true,
          fileId: uploadResult.fileId,
          fileName: uploadResult.fileName,
          webViewLink: uploadResult.webViewLink,
          webContentLink: uploadResult.webContentLink
        };
      } catch (uploadError) {
        console.error(`❌ Lỗi upload qua upload-service: ${uploadError.message}`);
        
        // Phương pháp 2: Sao chép file vào thư mục public
        try {
          console.log(`🔄 Thử phương pháp 2: Sao chép file vào thư mục public`);
          
          // Tạo thư mục videos trong public nếu chưa có
          const publicDir = path.join(process.cwd(), 'public');
          const videosDir = path.join(publicDir, 'videos');
          
          if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir, { recursive: true });
          }
          
          if (!fs.existsSync(videosDir)) {
            fs.mkdirSync(videosDir, { recursive: true });
          }
          
          // Tạo tên file đích
          const targetFileName = `video_${Date.now()}_${path.basename(fileName)}`;
          const targetFilePath = path.join(videosDir, targetFileName);
          
          // Sao chép file
          fs.copyFileSync(filePath, targetFilePath);
          
          console.log(`✅ Đã sao chép video thành công vào: ${targetFilePath}`);
          
          // Tạo URL tương đối
          const relativeUrl = `/videos/${targetFileName}`;
          
          return {
            success: true,
            fileId: `local_${Date.now()}`,
            fileName: targetFileName,
            webViewLink: relativeUrl,
            webContentLink: relativeUrl,
            isLocal: true
          };
        } catch (method2Error) {
          console.error(`❌ Lỗi phương pháp 2: ${method2Error.message}`);
          throw method2Error;
        }
      }
    } catch (error) {
      console.error(`❌ Lỗi upload video: ${error.message}`);
      
      // Trả về kết quả không có upload để ít nhất người dùng có thể tải video về
      console.log(`⚠️ Không thể upload video, trả về đường dẫn local: ${filePath}`);
      return {
        success: false,
        error: error.message,
        localFilePath: filePath
      };
    }
  }
  
  async getVideoUrlAndHeaders(browser, fileId) {
    let currentPage = null;
    let retries = 3;
    let savedFormatData = null;

    while (retries > 0) {
      try {
        currentPage = await browser.newPage();

        // Lấy cookies từ page
        const cookies = await currentPage.cookies();
        const cookieString = cookies
          .map((cookie) => `${cookie.name}=${cookie.value}`)
          .join("; ");

        // Tạo headers chuẩn
        const standardHeaders = {
          Accept: "*/*",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en-US,en;q=0.9",
          Cookie: cookieString,
          Origin: "https://drive.google.com",
          Referer: "https://drive.google.com/",
          "Sec-Fetch-Dest": "video",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-site",
          "User-Agent": await browser.userAgent(),
        };

        // Tạo promise để đợi kết quả
        const resultPromise = new Promise((resolve, reject) => {
          currentPage.on("response", async (response) => {
            try {
              const url = response.url();
              const headers = response.headers();
              const contentType = headers["content-type"] || "";

              if (contentType.includes("application/json")) {
                let responseData = await response.text();

                // Loại bỏ các ký tự không mong muốn ở đầu
                if (responseData.startsWith(")]}'")) {
                  responseData = responseData.slice(4);
                }

                try {
                  const jsonData = JSON.parse(responseData);

                  if (jsonData?.mediaStreamingData?.formatStreamingData) {
                    const formatData =
                      jsonData.mediaStreamingData.formatStreamingData;

                    // Lưu formatData vào biến tạm
                    savedFormatData = formatData;

                    const progressiveTranscodes =
                      formatData.progressiveTranscodes || [];

                    // Tìm URL chất lượng cao nhất
                    const fhd = progressiveTranscodes.find(
                      (t) => t.itag === 37
                    );
                    const hd = progressiveTranscodes.find((t) => t.itag === 22);
                    const sd = progressiveTranscodes.find((t) => t.itag === 18);

                    const bestTranscode = fhd || hd || sd;
                    if (bestTranscode) {
                      const result = {
                        url: bestTranscode.url,
                        quality: fhd ? "1080p" : hd ? "720p" : "360p",
                        metadata: bestTranscode,
                        headers: standardHeaders,
                      };

                      resolve(result);
                      return;
                    }
                  }
                } catch (jsonError) {
                  // Thêm xử lý đăng nhập khi parse JSON lỗi
                  const loginCheck = await currentPage.$('input[type="email"]');
                  if (loginCheck) {
                    console.log(`🔒 Đang đợi đăng nhập...`);
                    await currentPage.waitForFunction(
                      () => !document.querySelector('input[type="email"]'),
                      { timeout: 300000 } // 5 phút
                    );
                    console.log(`✅ Đã đăng nhập xong`);
                    // Đợi thêm 1 phút sau khi đăng nhập
                    console.log(
                      `⏳ Đợi thêm 1 phút để đảm bảo đăng nhập hoàn tất...`
                    );
                    await new Promise((resolve) => setTimeout(resolve, 100000));

                    // Reload trang sau khi đăng nhập
                    await currentPage.reload({
                      waitUntil: ["networkidle0", "domcontentloaded"],
                    });
                    return; // Tiếp tục vòng lặp để lấy URL
                  }
                  throw jsonError;
                }
              }
            } catch (error) {
              reject(error);
            }
          });
        });

        // Thiết lập request interception
        await currentPage.setRequestInterception(true);
        currentPage.on("request", (request) => {
          const url = request.url();
          if (url.includes("clients6.google.com")) {
            const headers = request.headers();
            headers["Origin"] = "https://drive.google.com";
            headers["Referer"] = "https://drive.google.com/";
            request.continue({ headers });
          } else {
            request.continue();
          }
        });

        await currentPage.goto(
          `https://drive.google.com/file/d/${fileId}/view`,
          {
            waitUntil: ["networkidle0", "domcontentloaded"],
            timeout: 60000,
          }
        );

        // Đợi kết quả với timeout
        const result = await Promise.race([
          resultPromise,
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Timeout waiting for video URL")),
              30000
            )
          ),
        ]);

        if (!result || !result.url) {
          throw new Error("Không tìm thấy URL video hợp lệ");
        }

        // Lưu formatData vào this.currentFormatData chỉ khi thành công
        if (savedFormatData) {
          this.currentFormatData = savedFormatData;
          console.log(`✅ Đã lưu formatData thành công`);
        }

        await currentPage.close();
        return result;
      } catch (error) {
        console.error(
          `❌ Lỗi (còn ${retries} lần thử):`,
          error.message
        );
        retries--;

        if (currentPage) {
          try {
            await currentPage.close();
          } catch (e) {
            console.warn(`⚠️ Không thể đóng page:`, e.message);
          }
        }

        if (retries > 0) {
          console.log(`⏳ Đợi 1s trước khi thử lại...`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    throw new Error("Không tìm được URL video sau nhiều lần thử");
  }
  
  async downloadVideoWithChunks(videoUrl, outputPath, headers) {
    let downloadedSize = 0;
    const startTime = Date.now();
    let failedChunksCount = 0;
    let progressInterval = null;

    try {
      // Đảm bảo thư mục tồn tại
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      
      // Tạo file
      let fh = await fs.promises.open(outputPath, "w");
      await fh.close();
      fh = await fs.promises.open(outputPath, "r+");

      const downloadHeaders = {
        ...headers,
        "User-Agent": headers["User-Agent"] || "Mozilla/5.0",
        Accept: "*/*",
        "Accept-Encoding": "identity",
        Connection: "keep-alive",
        "Sec-Fetch-Dest": "video",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        Origin: "https://drive.google.com",
        Referer: "https://drive.google.com/",
      };

      // Kiểm tra URL có tồn tại không
      const testResponse = await axios({
        method: "get",
        url: videoUrl,
        headers: {
          ...downloadHeaders,
          Range: "bytes=0-1024",
        },
        timeout: 10000,
        validateStatus: (status) => status === 200 || status === 206,
      });

      // Lấy kích thước file
      const headResponse = await axios.head(videoUrl, {
        headers: downloadHeaders,
        timeout: 30000,
        validateStatus: (status) => status === 200 || status === 206,
      });

      const totalSize = parseInt(headResponse.headers["content-length"], 10);
      if (!totalSize) throw new Error("Invalid content length");

      // Chia chunks
      const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB mỗi chunk
      const chunks = [];
      for (let start = 0; start < totalSize; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
        chunks.push({ start, end });
      }

      console.log(`⚙️ Chia thành ${chunks.length} chunks, mỗi chunk ${CHUNK_SIZE / 1024 / 1024}MB`);

      // Progress tracking
      let lastProgress = -1;
      let noProgressCount = 0;

      progressInterval = setInterval(() => {
        const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
        const currentTime = ((Date.now() - startTime) / 1000).toFixed(2);
        const downloadedMB = (downloadedSize / 1024 / 1024).toFixed(2);
        const totalMB = (totalSize / 1024 / 1024).toFixed(2);
        const speed = (downloadedSize / 1024 / 1024 / currentTime).toFixed(2);

        console.log(`⏬ ${progress}% (${downloadedMB}/${totalMB}MB) | ${speed}MB/s | ${currentTime}s`);
      }, 2000);

      // Download chunks song song
      for (let i = 0; i < chunks.length; i += 25) {
        const batch = chunks.slice(i, Math.min(i + 25, chunks.length));
        const downloadPromises = batch.map(async (chunk) => {
          let retries = 3;
          while (retries > 0) {
            try {
              const chunkHeaders = {
                ...downloadHeaders,
                Range: `bytes=${chunk.start}-${chunk.end}`,
              };

              const response = await axios({
                method: "get",
                url: videoUrl,
                headers: chunkHeaders,
                responseType: "arraybuffer",
                timeout: 30000,
                maxContentLength: CHUNK_SIZE * 2,
                maxBodyLength: CHUNK_SIZE * 2,
                validateStatus: (status) => status === 200 || status === 206,
              });

              if (!response.data) throw new Error("Empty response");

              const buffer = Buffer.from(response.data);
              await fh.write(buffer, 0, buffer.length, chunk.start);
              downloadedSize += buffer.length;
              break;
            } catch (error) {
              retries--;
              failedChunksCount++;

              if (retries === 0) {
                console.log("⚠️ Hết số lần thử lại cho chunk này");
                break;
              }

              // Đợi thời gian tăng dần theo số lần retry
              const waitTime = 5000 * (3 - retries);
              console.log(`⏳ Đợi ${waitTime / 1000}s trước khi thử lại...`);
              await new Promise((r) => setTimeout(r, waitTime));
            }
          }
        });

        await Promise.all(downloadPromises);
      }

      // Dọn dẹp
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      await fh.close();
      return true;
    } catch (error) {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      console.error(`❌ Lỗi tải xuống: ${error.message}`);
      throw error;
    }
  }

  findBestAdaptiveVideo() {
    try {
      if (!this.currentFormatData?.adaptiveTranscodes) {
        console.log("⚠️ Không tìm thấy danh sách video adaptive");
        return null;
      }

      const videos = this.currentFormatData.adaptiveTranscodes.filter(
        (t) => t.itag !== 140 && !t.mimeType?.includes("audio")
      );

      if (videos.length === 0) {
        console.log("❌ Không tìm thấy video nào trong adaptiveTranscodes");
        return null;
      }

      const videoQualities = [
        313, // 4K
        271, // 1440p
        137, // 1080p
        136, // 720p
        135, // 480p
        134, // 360p
        133, // 240p
      ];

      for (const quality of videoQualities) {
        const video = videos.find((t) => t.itag === quality);
        if (video) {
          return video;
        }
      }

      const bestVideo = videos.sort(
        (a, b) => (b.height || 0) - (a.height || 0)
      )[0];

      return bestVideo;
    } catch (error) {
      console.error("❌ Lỗi tìm video chất lượng cao:", error.message);
      return null;
    }
  }

  findBestAdaptiveAudio() {
    try {
      if (!this.currentFormatData?.adaptiveTranscodes) {
        console.log("⚠️ Không tìm thấy danh sách audio adaptive");
        return null;
      }

      const audio = this.currentFormatData.adaptiveTranscodes.find(
        (t) => t.itag === 140
      );

      if (audio) {
        return audio;
      }

      console.log("❌ Không tìm thấy audio 140");
      return null;
    } catch (error) {
      console.error("❌ Lỗi tìm audio:", error.message);
      return null;
    }
  }

  getChromePath() {
    try {
      switch (os.platform()) {
        case 'win32':
          const windowsPaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Users\\PC\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
            // Thêm Edge như fallback
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
            // Đường dẫn người dùng khác
            `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
            `C:\\Users\\${os.userInfo().username}\\AppData\\Local\\Microsoft\\Edge\\Application\\msedge.exe`
          ];
          
          for (const chromePath of windowsPaths) {
            if (fs.existsSync(chromePath)) {
              console.log(`✅ Tìm thấy trình duyệt tại: ${chromePath}`);
              return chromePath;
            }
          }
          
          // Thử tìm Chrome thông qua PATH
          console.log(`⚠️ Không tìm thấy Chrome/Edge trong các đường dẫn phổ biến, thử PATH...`);
          return 'chrome'; // Fallback to PATH
          
        case 'darwin':
          const macPaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
          ];
          
          for (const path of macPaths) {
            if (fs.existsSync(path)) {
              return path;
            }
          }
          return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
          
        default:
          const linuxPaths = [
            '/usr/bin/google-chrome',
            '/usr/bin/microsoft-edge',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser'
          ];
          
          for (const path of linuxPaths) {
            if (fs.existsSync(path)) {
              return path;
            }
          }
          return '/usr/bin/google-chrome';
      }
    } catch (error) {
      console.error(`❌ Lỗi xác định đường dẫn trình duyệt: ${error.message}`);
      return 'chrome';
    }
  }

  async downloadVideo(fileId, outputPath) {
    try {
      this.currentVideoId = fileId;
      
      // Khởi tạo browser nếu chưa có
      if (!this.browser) {
        const chromePath = this.getChromePath();
        console.log(`🌐 Khởi động Chrome: ${chromePath}`);
        
        try {
          this.browser = await puppeteer.launch({
            headless: false,
            executablePath: chromePath,
            args: [
              '--start-maximized',
              '--disable-infobars',
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-accelerated-2d-canvas',
              '--disable-gpu',
              '--window-size=1920,1080',
              '--hide-scrollbars',
              '--disable-notifications',
              `--user-data-dir=${this.profilePath}`,
              '--enable-extensions',
              '--remote-debugging-port=0',
              '--disable-web-security',
              '--disable-features=IsolateOrigins,site-per-process',
              '--disable-site-isolation-trials',
              '--disable-features=BlockInsecurePrivateNetworkRequests',
              '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure'
            ],
            defaultViewport: null,
            ignoreDefaultArgs: ['--enable-automation']
          });
        } catch (browserError) {
          console.error(`❌ Lỗi khởi động Chrome: ${browserError.message}`);
          
          // Thử lại với Chrome mặc định từ PATH
          console.log(`🔄 Thử lại với Chrome mặc định từ PATH...`);
          try {
            this.browser = await puppeteer.launch({
              headless: false,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--user-data-dir=${this.profilePath}`
              ],
              defaultViewport: null
            });
          } catch (retryError) {
            console.error(`❌ Vẫn không thể khởi động Chrome: ${retryError.message}`);
            
            // Fallback to direct API download
            console.log(`⚠️ Không thể khởi động Chrome, thử sử dụng API tải trực tiếp...`);
            return await this.downloadVideoDirectly(fileId, outputPath);
          }
        }
      }

      // Lấy URL và headers từ phương thức mới
      const result = await this.getVideoUrlAndHeaders(this.browser, fileId);
      
      // Kiểm tra kết quả
      if (!result || !result.url) {
        throw new Error('Không lấy được URL video');
      }
      
      console.log(`🔗 Đã lấy được URL video: ${result.url.substring(0, 100)}...`);
      
      // Tải video bằng phương thức chunks
      await this.downloadVideoWithChunks(result.url, outputPath, result.headers || {});
      
      console.log(`✅ Đã tải và ghi video thành công: ${outputPath}`);
      return true;
    } catch (error) {
      console.error(`❌ Lỗi tải video: ${error.message}`);
      
      // Thử sử dụng API tải trực tiếp nếu Chrome gặp lỗi
      try {
        console.log(`🔄 Chrome gặp lỗi, thử sử dụng API tải trực tiếp...`);
        return await this.downloadVideoDirectly(fileId, outputPath);
      } catch (directError) {
        console.error(`❌ Lỗi tải trực tiếp: ${directError.message}`);
        throw error; // Giữ lại lỗi gốc
      }
    }
  }
  
  // Thêm phương thức tải xuống trực tiếp qua API
  async downloadVideoDirectly(fileId, outputPath) {
    console.log(`📥 Tải xuống video trực tiếp qua API: ${fileId}`);
    
    try {
      // Import và sử dụng hàm trực tiếp download từ Google Drive
      const { downloadFileFromGoogleDrive } = require('@/utils/drive-utils');
      
      // Tải video
      const downloadResult = await downloadFileFromGoogleDrive(fileId, outputPath);
      
      if (downloadResult && downloadResult.success) {
        console.log(`✅ Tải video trực tiếp thành công: ${outputPath}`);
        return true;
      } else {
        throw new Error(downloadResult?.error || 'Lỗi không xác định khi tải video trực tiếp');
      }
    } catch (error) {
      console.error(`❌ Lỗi tải video trực tiếp: ${error.message}`);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = VideoProcessor; 