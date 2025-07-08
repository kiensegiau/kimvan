const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const axios = require('axios');
const puppeteer = require('puppeteer-core');
const os = require('os');

// Hằng số
const MAX_CONCURRENT_BROWSERS = 3;
const activeBrowsers = new Map();

// Hàm lấy đường dẫn Chrome mặc định dựa trên hệ điều hành
function getChromePath() {
  try {
    switch (os.platform()) {
      case 'win32':
        // Kiểm tra các đường dẫn phổ biến
        const windowsPaths = [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Users\\Administrator\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Users\\PC\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
        ];
        
        for (const path of windowsPaths) {
          if (fs.existsSync(path)) {
            console.log(`✅ Tìm thấy Chrome tại: ${path}`);
            return path;
          }
        }
        
        console.log(`⚠️ Không tìm thấy Chrome trong các đường dẫn phổ biến, sử dụng đường dẫn mặc định`);
        return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
        
      case 'darwin': // macOS
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
      default: // Linux và các hệ điều hành khác
        return '/usr/bin/google-chrome';
    }
  } catch (error) {
    console.error(`Lỗi xác định đường dẫn Chrome: ${error.message}`);
    return 'chrome';
  }
}

// Tạo thư mục hồ sơ người dùng Chrome
function createChromeUserProfile() {
  try {
    // Sử dụng thư mục cố định thay vì tạo mới mỗi lần
    const profilePath = path.join(os.homedir(), 'drive-pdf-watermark-profile');
    try {
      fs.mkdirSync(profilePath, { recursive: true });
    } catch (mkdirError) {
      console.error(`Lỗi tạo thư mục hồ sơ Chrome: ${mkdirError.message}`);
    }
    
    console.log(`🔑 Sử dụng hồ sơ Chrome tại: ${profilePath}`);
    return profilePath;
  } catch (error) {
    console.error(`Lỗi tạo hồ sơ người dùng Chrome: ${error.message}`);
    const tempProfilePath = path.join(os.tmpdir(), `chrome-profile-${Date.now()}`);
    fs.mkdirSync(tempProfilePath, { recursive: true });
    return tempProfilePath;
  }
}

// Hàm kiểm tra và lấy browser đang hoạt động hoặc tạo mới
async function getOrCreateBrowser(profilePath, debugMode = false) {
  try {
    const profileId = profilePath.replace(/[^a-zA-Z0-9]/g, '_');
    
    if (activeBrowsers.has(profileId)) {
      const browserInfo = activeBrowsers.get(profileId);
      
      try {
        const pages = await browserInfo.browser.pages();
        console.log(`✅ Tái sử dụng phiên Chrome đang hoạt động với ${pages.length} tab`);
        browserInfo.refCount += 1;
        return { browser: browserInfo.browser, isNew: false, profileId };
      } catch (checkError) {
        console.log(`⚠️ Phiên Chrome cũ không còn hoạt động, tạo mới: ${checkError.message}`);
        activeBrowsers.delete(profileId);
      }
    }
    
    if (activeBrowsers.size >= MAX_CONCURRENT_BROWSERS) {
      console.log(`⚠️ Đã đạt giới hạn ${MAX_CONCURRENT_BROWSERS} phiên Chrome đang chạy, đợi...`);
      
      let leastUsedBrowser = null;
      let minRefCount = Infinity;
      
      for (const [id, info] of activeBrowsers.entries()) {
        if (info.refCount < minRefCount) {
          minRefCount = info.refCount;
          leastUsedBrowser = id;
        }
      }
      
      if (leastUsedBrowser) {
        try {
          const browserToClose = activeBrowsers.get(leastUsedBrowser);
          console.log(`🔄 Đóng phiên Chrome ít sử dụng nhất để giải phóng tài nguyên`);
          await browserToClose.browser.close();
          activeBrowsers.delete(leastUsedBrowser);
        } catch (closeError) {
          console.warn(`⚠️ Lỗi khi đóng phiên Chrome ít sử dụng: ${closeError.message}`);
          activeBrowsers.delete(leastUsedBrowser);
        }
      }
    }
    
    const chromePath = getChromePath();
    console.log(`🌐 Khởi động Chrome mới: ${chromePath}`);
    
    const browser = await puppeteer.launch({
      headless: debugMode ? false : 'new',
      channel: os.platform() === 'win32' ? 'chrome' : undefined,
      executablePath: chromePath,
      args: [
        "--start-maximized",
        `--user-data-dir=${profilePath}`,
        "--enable-extensions",
        "--remote-debugging-port=0",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-site-isolation-trials",
        "--disable-features=BlockInsecurePrivateNetworkRequests",
        "--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-popup-blocking",
        "--disable-notifications",
        "--disable-infobars",
        "--disable-translate",
        "--allow-running-insecure-content",
        "--password-store=basic",
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--allow-file-access-from-files",
        "--allow-insecure-localhost",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "--disable-blink-features=AutomationControlled"
      ],
      defaultViewport: null,
      ignoreDefaultArgs: ["--enable-automation"],
      timeout: 180000,
      slowMo: debugMode ? 100 : 50
    });
    
    activeBrowsers.set(profileId, {
      browser,
      refCount: 1,
      createdAt: Date.now()
    });
    
    return { browser, isNew: true, profileId };
  } catch (error) {
    console.error(`❌ Lỗi khi tạo/lấy phiên Chrome: ${error.message}`);
    throw error;
  }
}

// Hàm giải phóng browser
async function releaseBrowser(profileId, forceClose = false) {
  if (!activeBrowsers.has(profileId)) return;
  
  const browserInfo = activeBrowsers.get(profileId);
  browserInfo.refCount -= 1;
  
  if (browserInfo.refCount <= 0 || forceClose) {
    try {
      console.log(`🔄 Đóng phiên Chrome không còn sử dụng (profileId: ${profileId})`);
      await browserInfo.browser.close();
    } catch (closeError) {
      console.warn(`⚠️ Lỗi khi đóng phiên Chrome: ${closeError.message}`);
    } finally {
      activeBrowsers.delete(profileId);
    }
  }
}

class ProcessLogger {
  constructor() {
    this.logs = [];
  }

  logProcess(data) {
    this.logs.push({
      ...data,
      timestamp: new Date().toISOString()
    });
    console.log(`📝 Log:`, data);
  }
}

class VideoProcessor {
  constructor(oAuth2Client, tempDir = 'temp', downloadOnly = false) {
    this.drive = google.drive({ version: 'v3', auth: oAuth2Client });
    this.TEMP_DIR = tempDir;
    this.ensureTempDir();
    this.accessToken = null;
    this.oAuth2Client = oAuth2Client;
    this.queue = [];
    this.processing = false;
    this.maxConcurrent = 2;
    this.processLogger = new ProcessLogger();
    this.downloadOnly = downloadOnly;
    this.debugMode = false;
    this.browser = null; // Thêm biến để lưu browser dùng chung
  }

  // Thêm method để set browser từ bên ngoài
  setBrowser(browser) {
    this.browser = browser;
  }

  ensureTempDir() {
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
    }
  }

  sanitizePath(filePath) {
    return filePath.replace(/[<>:"/\\|?*]/g, '_');
  }

  async refreshAccessToken() {
    try {
      const tokenInfo = await this.oAuth2Client.getAccessToken();
      this.accessToken = tokenInfo.token;
      return this.accessToken;
    } catch (error) {
      console.error('Lỗi refresh token:', error.message);
      throw error;
    }
  }

  async getStreamUrl(fileId) {
    try {
      let streamUrl = null;
      let page = null;

      try {
        if (!this.browser) {
          throw new Error('Browser chưa được khởi tạo');
        }

        page = await this.browser.newPage();
        await page.setDefaultNavigationTimeout(120000);

        // Mở trang video trên Google Drive
        console.log(`🌐 Mở trang video: ${fileId}`);
        await page.goto(`https://drive.google.com/file/d/${fileId}/view`, {
          waitUntil: 'networkidle2',
          timeout: 300000
        });

        // Đợi và lấy URL stream từ network requests
        await page.setRequestInterception(true);
        
        const streamPromise = new Promise((resolve) => {
          page.on('request', (request) => {
            const url = request.url();
            if (url.includes('videoplayback') || url.includes('alt=media')) {
              resolve(url);
            }
            request.continue();
          });
        });

        // Click vào video để trigger request
        await page.click('.ndfHFb-c4YZDc');
        
        // Đợi lấy được URL stream hoặc timeout sau 30s
        streamUrl = await Promise.race([
          streamPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout getting stream URL')), 30000))
        ]);

        console.log(`✅ Đã lấy được URL stream`);
      } catch (error) {
        console.error(`❌ Lỗi khi lấy URL stream từ Chrome: ${error.message}`);
        throw error;
      } finally {
        if (page) {
          await page.close().catch(() => {});
        }
      }

      if (!streamUrl) {
        throw new Error('Không lấy được URL stream');
      }

      return streamUrl;
    } catch (error) {
      console.error(`❌ Lỗi lấy URL stream: ${error.message}`);
      throw error;
    }
  }

  async createFolderPath(folderPath, parentFolderId) {
    let currentFolderId = parentFolderId;

    if (folderPath === '.') {
      return currentFolderId;
    }

    const folders = folderPath.split(path.sep);
    
    for (const folderName of folders) {
      if (!folderName) continue;

      try {
        // Tìm folder hiện có
        const query = `name='${folderName}' and '${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
        const folderResult = await this.drive.files.list({
          q: query,
          fields: 'files(id, name)',
          supportsAllDrives: true
        });

        if (folderResult.data.files.length > 0) {
          currentFolderId = folderResult.data.files[0].id;
          console.log(`📂 Sử dụng folder: "${folderName}" (${currentFolderId})`);
        } else {
          // Tạo folder mới
          const newFolder = await this.drive.files.create({
            requestBody: {
              name: folderName,
              mimeType: 'application/vnd.google-apps.folder',
              parents: [currentFolderId]
            },
            fields: 'id, name',
            supportsAllDrives: true
          });
          currentFolderId = newFolder.data.id;
          console.log(`📁 Tạo folder mới: "${folderName}" (${currentFolderId})`);
        }
      } catch (error) {
        console.error(`❌ Lỗi tạo/tìm folder ${folderName}:`, error.message);
        throw error;
      }
    }

    return currentFolderId;
  }

  async downloadVideoWithChunks(streamUrl, tempPath, fileId, fileName, maxRetries = 5) {
    let attempt = 0;
    const baseDelay = 10000; // 10 seconds

    while (attempt < maxRetries) {
      try {
        console.log(`📥 Đang tải video (lần thử ${attempt + 1}/${maxRetries})...`);
        
        if (!streamUrl) {
          streamUrl = await this.getStreamUrl(fileId);
        }

        const response = await axios({
          method: 'get',
          url: streamUrl,
          responseType: 'stream',
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        });

        const totalLength = parseInt(response.headers['content-length'], 10);
        let downloadedLength = 0;
        const startTime = Date.now();

        await new Promise((resolve, reject) => {
          const writer = fs.createWriteStream(tempPath);
          
          response.data.on('data', (chunk) => {
            downloadedLength += chunk.length;
            const progress = (downloadedLength / totalLength) * 100;
            const elapsedTime = (Date.now() - startTime) / 1000;
            const downloadSpeed = (downloadedLength / (1024 * 1024)) / elapsedTime; // MB/s

            if (downloadedLength % 10000000 === 0) { // Log mỗi 10MB
              console.log(
                `📊 Đã tải: ${Math.round(downloadedLength / 1000000)}MB / ` +
                `${Math.round(totalLength / 1000000)}MB (${Math.round(progress)}%) - ` +
                `${downloadSpeed.toFixed(2)} MB/s`
              );
            }
          });

          response.data.pipe(writer);

          writer.on('finish', () => {
            writer.close();
            console.log(`✅ Đã tải xong video: ${fileName}`);
            resolve();
          });

          writer.on('error', (err) => {
            fs.unlink(tempPath, () => {});
            reject(err);
          });

          response.data.on('error', (err) => {
            writer.destroy();
            fs.unlink(tempPath, () => {});
            reject(err);
          });
        });

        return true;
      } catch (error) {
        attempt++;
        
        if (error.response?.status === 403 || error.message.includes('quota')) {
          console.log(`⚠️ Lỗi quota/permission. Đợi ${baseDelay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
          
          // Refresh token và URL stream nếu cần
          await this.refreshAccessToken();
          streamUrl = await this.getStreamUrl(fileId);
          continue;
        }

        if (attempt === maxRetries) {
          throw new Error(`Không thể tải video sau ${maxRetries} lần thử: ${error.message}`);
        }

        console.log(`⚠️ Lỗi tải video. Thử lại sau ${baseDelay/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, baseDelay * attempt));
        
        // Refresh token và URL stream cho lần thử tiếp theo
        await this.refreshAccessToken();
        streamUrl = await this.getStreamUrl(fileId);
      }
    }
  }

  async processVideo(fileId, fileName, targetFolderId, depth = 0) {
    const indent = "  ".repeat(depth);
    const startTime = Date.now();
    const tempFiles = [];

    try {
      this.processLogger.logProcess({
        type: "video_process",
        status: "start",
        fileName,
        fileId,
        targetFolderId
      });

      console.log(`${indent}=== Bắt đầu xử lý video: ${fileName} ===`);
      const safeFileName = this.sanitizePath(fileName);
      
      // Xử lý cấu trúc thư mục nếu không ở chế độ downloadOnly
      let currentFolderId = targetFolderId;
      if (!this.downloadOnly) {
        const folderPath = path.dirname(fileName);
        if (folderPath !== '.') {
          currentFolderId = await this.createFolderPath(folderPath, targetFolderId);
        }
      }

      // Tạo đường dẫn tạm thời
      const tempPath = path.join(
        this.TEMP_DIR,
        `video_${Date.now()}_${safeFileName}`
      );
      tempFiles.push(tempPath);

      // Lấy stream URL và tải video
      const streamUrl = await this.getStreamUrl(fileId);
      await this.downloadVideoWithChunks(streamUrl, tempPath, fileId, fileName);

      // Nếu chỉ download, trả về đường dẫn file
      if (this.downloadOnly) {
        console.log(`${indent}✅ Đã tải xong video: ${fileName}`);
        return {
          success: true,
          filePath: tempPath,
          duration: Date.now() - startTime
        };
      }

      // Upload video lên Drive
      console.log(`${indent}📤 Đang upload video lên Drive...`);
      const uploadedFile = await this.uploadToDrive(tempPath, safeFileName, currentFolderId);
      
      this.processLogger.logProcess({
        type: "video_process",
        status: "uploaded",
        fileName,
        fileId: uploadedFile.id,
        duration: Date.now() - startTime
      });

      // Đảm bảo video được xử lý
      await this.ensureVideoProcessing(uploadedFile.id);

      console.log(`${indent}✅ Hoàn thành xử lý video: ${fileName}`);
      return {
        success: true,
        fileId: uploadedFile.id,
        duration: Date.now() - startTime
      };

    } catch (error) {
      this.processLogger.logProcess({
        type: "video_process",
        status: "error",
        fileName,
        fileId,
        error: error.message,
        duration: Date.now() - startTime
      });

      console.error(`${indent}❌ Lỗi xử lý video ${fileName}:`, error.message);
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    } finally {
      // Dọn dẹp files tạm nếu không ở chế độ downloadOnly
      if (!this.downloadOnly) {
        for (const tempFile of tempFiles) {
          try {
            if (fs.existsSync(tempFile)) {
              await fs.promises.unlink(tempFile);
              console.log(`${indent}🧹 Đã xóa file tạm: ${tempFile}`);
            }
          } catch (error) {
            console.warn(`${indent}⚠️ Không thể xóa file tạm: ${tempFile}`);
          }
        }
      }
    }
  }

  async uploadToDrive(filePath, fileName, folderId) {
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: 'video/mp4',
      body: fs.createReadStream(filePath)
    };

    const uploadedFile = await this.drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id,name,mimeType',
      supportsAllDrives: true
    });

    return uploadedFile.data;
  }

  async ensureVideoProcessing(fileId, maxAttempts = 10) {
    console.log(`⏳ Đang đợi xử lý video ${fileId}...`);
    const delayMs = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const file = await this.drive.files.get({
          fileId: fileId,
          fields: 'id,name,videoMediaMetadata',
          supportsAllDrives: true
        });

        if (file.data.videoMediaMetadata) {
          console.log(`✅ Video đã được xử lý xong`);
          return true;
        }

        console.log(`⏳ Đang xử lý... (${i + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } catch (error) {
        console.error(`⚠️ Lỗi kiểm tra xử lý:`, error.message);
        if (i === maxAttempts - 1) {
          throw error;
        }
      }
    }

    console.warn(`⚠️ Hết thời gian chờ xử lý video`);
    return false;
  }

  // Queue processing methods
  async addToQueue(videoInfo) {
    this.queue.push(videoInfo);
    if (!this.processing) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.maxConcurrent);
        const promises = batch.map(videoInfo => 
          this.processVideo(
            videoInfo.fileId,
            videoInfo.fileName,
            videoInfo.targetFolderId,
            videoInfo.depth || 0
          )
        );

        const results = await Promise.all(promises);
        console.log(`✅ Đã xử lý xong batch ${results.length} videos`);
      }
    } catch (error) {
      console.error('❌ Lỗi xử lý queue:', error);
    } finally {
      this.processing = false;
    }
  }
}

// Dọn dẹp browser không sử dụng
setInterval(() => {
  const now = Date.now();
  const MAX_IDLE_TIME = 10 * 60 * 1000; // 10 phút
  
  for (const [profileId, browserInfo] of activeBrowsers.entries()) {
    if (browserInfo.refCount <= 0 && (now - browserInfo.createdAt > MAX_IDLE_TIME)) {
      releaseBrowser(profileId, true).catch(err => {
        console.warn(`⚠️ Lỗi khi dọn dẹp browser: ${err.message}`);
      });
    }
  }
}, 5 * 60 * 1000);

module.exports = VideoProcessor; 