import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { getNextApiKey, removeApiKey } from '../../../../../utils/watermark-api-keys';

/**
 * Xóa watermark dạng text ở header và footer của PDF bằng cách cắt PDF và thêm logo
 * @param {string} inputPath - Đường dẫn đến file PDF cần xử lý
 * @param {string} outputPath - Đường dẫn lưu file PDF sau khi xử lý
 */
export async function removeHeaderFooterWatermark(inputPath, outputPath) {
  try {
    // Sử dụng thư viện pdf-lib để đọc và xử lý PDF
    const { PDFDocument, rgb } = require('pdf-lib');
    
    // Đọc file PDF
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Đọc file logo
    const logoPath = path.join(process.cwd(), 'nen.png');
    const logoBytes = fs.readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoSize = logoImage.size();
    
    // Lấy số trang của PDF
    const pageCount = pdfDoc.getPageCount();
    console.log(`Số trang PDF: ${pageCount}`);
    
    // Xử lý từng trang PDF
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      
      // Tính toán kích thước mới sau khi cắt header và footer
      const headerCut = height * 0.015; // Cắt 1% từ phía trên
      const footerCut = height * 0.015; // Cắt 1% từ phía dưới
      const newHeight = height - headerCut - footerCut;
      
      // Thiết lập CropBox mới để cắt header và footer
      page.setCropBox(0, footerCut, width, newHeight);
      
      // Thêm logo vào giữa trang với kích thước rất lớn
      const logoWidth = width * 0.8; // Logo chiếm 80% chiều rộng trang
      const logoHeight = (logoWidth / logoSize.width) * logoSize.height;
      const logoX = (width - logoWidth) / 2; // Căn giữa theo chiều ngang
      const logoY = (height - logoHeight) / 2; // Căn giữa theo chiều dọc
      
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
        opacity: 0.15 // Độ mờ đục 15%
      });
    }
    
    // Lưu file PDF sau khi xử lý
    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);
    
    console.log(`Đã cắt header và footer của PDF và thêm logo: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('Lỗi khi cắt header và footer và thêm logo:', error);
    throw new Error(`Không thể cắt header và footer và thêm logo: ${error.message}`);
  }
}

/**
 * Chỉ thêm logo vào PDF mà không cắt header và footer
 * Sử dụng cho file PDF đã được tải bằng Chrome (đã bị cắt sẵn)
 * @param {string} inputPath - Đường dẫn đến file PDF cần xử lý
 * @param {string} outputPath - Đường dẫn lưu file PDF sau khi xử lý
 */
export async function addLogoToPDF(inputPath, outputPath) {
  try {
    // Sử dụng thư viện pdf-lib để đọc và xử lý PDF
    const { PDFDocument, rgb } = require('pdf-lib');
    
    // Đọc file PDF
    const pdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Đọc file logo
    const logoPath = path.join(process.cwd(), 'nen.png');
    const logoBytes = fs.readFileSync(logoPath);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    const logoSize = logoImage.size();
    
    // Lấy số trang của PDF
    const pageCount = pdfDoc.getPageCount();
    console.log(`Số trang PDF (chỉ thêm logo): ${pageCount}`);
    
    // Xử lý từng trang PDF - chỉ thêm logo, không cắt
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      
      // Thêm logo vào giữa trang với kích thước rất lớn
      const logoWidth = width * 0.8; // Logo chiếm 80% chiều rộng trang
      const logoHeight = (logoWidth / logoSize.width) * logoSize.height;
      const logoX = (width - logoWidth) / 2; // Căn giữa theo chiều ngang
      const logoY = (height - logoHeight) / 2; // Căn giữa theo chiều dọc
      
      page.drawImage(logoImage, {
        x: logoX,
        y: logoY,
        width: logoWidth,
        height: logoHeight,
        opacity: 0.15 // Độ mờ đục 15%
      });
    }
    
    // Lưu file PDF sau khi xử lý
    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);
    
    console.log(`Đã thêm logo vào PDF (không cắt): ${outputPath}`);
    return true;
  } catch (error) {
    console.error('Lỗi khi thêm logo vào PDF:', error);
    throw new Error(`Không thể thêm logo vào PDF: ${error.message}`);
  }
}

// Cấu hình API xóa watermark
const API_ENDPOINT = {
  CREATE_TASK: 'https://techhk.aoscdn.com/api/tasks/document/conversion',
  CHECK_STATUS: 'https://techhk.aoscdn.com/api/tasks/document/conversion/',
  CHECK_CREDITS: 'https://techhk.aoscdn.com/api/customers/coins'
};

// Thời gian tối đa chờ xử lý từ API (3600 giây = 60 phút)
const MAX_POLLING_TIME = 3600000;
// Khoảng thời gian giữa các lần kiểm tra trạng thái (15 giây)
const POLLING_INTERVAL = 15000;

/**
 * Tạo nhiệm vụ xóa watermark
 * @param {string} filePath - Đường dẫn đến file PDF cần xử lý 
 * @param {string} apiKey - API key để truy cập dịch vụ
 * @returns {Promise<string>} - ID của nhiệm vụ đã tạo
 */
export async function createWatermarkRemovalTask(filePath, apiKey) {
  try {
    const fileSize = fs.statSync(filePath).size;
    console.log(`Kích thước file (bytes): ${fileSize}`);
    
    // Tính toán timeout dựa trên kích thước file
    const timeoutMs = Math.max(300000, fileSize / 1024 * 10); // 300s cơ bản + 10ms/KB
    console.log(`Timeout cho API upload: ${Math.round(timeoutMs/1000)} giây`);
    
    // Tạo form data để upload file
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('format', 'doc-repair');
    
    // Gửi yêu cầu tới API
    const response = await axios({
      method: 'POST',
      url: 'https://techhk.aoscdn.com/api/tasks/document/conversion',
      headers: {
        'X-API-KEY': apiKey,
        ...form.getHeaders()
      },
      data: form,
      timeout: timeoutMs,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    if (response.data?.status === 200 && response.data?.data?.task_id) {
      return response.data.data.task_id;
    } else {
      throw new Error(`Lỗi khi tạo nhiệm vụ: ${response.data?.message || 'Không xác định'}`);
    }
  } catch (error) {
    // Kiểm tra lỗi 401 (hết credit)
    if (error.response?.status === 401 || 
        (error.response?.data?.message && (
          error.response.data.message.includes('quota') || 
          error.response.data.message.includes('credit') ||
          error.response.data.message.includes('coins')))) {
      console.log(`API key ${apiKey.substring(0, 5)}... đã hết credit hoặc không hợp lệ (lỗi 401)`);
      throw new Error('API_KEY_NO_CREDIT');
    }
    
    console.log(`Lỗi API khi tạo nhiệm vụ: ${error.message}`);
    throw new Error(`Lỗi API: ${error.message}`);
  }
}

/**
 * Kiểm tra trạng thái của nhiệm vụ
 * @param {string} taskId - ID của nhiệm vụ 
 * @param {string} apiKey - API key
 */
export async function checkTaskStatus(taskId, apiKey) {
  try {
    const response = await axios.get(`${API_ENDPOINT.CHECK_STATUS}${taskId}`, {
      headers: {
        'X-API-KEY': apiKey
      },
      timeout: 600000 // 600 giây timeout (10 phút)
    });
    
    if (response.data?.status === 200) {
      return response.data.data;
    } else {
      throw new Error(`Lỗi khi kiểm tra trạng thái: ${response.data?.message || 'Không xác định'}`);
    }
  } catch (error) {
    // Kiểm tra lỗi 401 (hết credit)
    if (error.response?.status === 401 || 
        (error.response?.data?.message && (
          error.response.data.message.includes('quota') || 
          error.response.data.message.includes('credit') ||
          error.response.data.message.includes('coins')))) {
      console.log(`API key ${apiKey.substring(0, 5)}... đã hết credit hoặc không hợp lệ (lỗi 401)`);
      throw new Error('API_KEY_NO_CREDIT');
    }
    
    console.log(`Lỗi API khi kiểm tra trạng thái: ${error.message}`);
    throw new Error(`Lỗi API: ${error.message}`);
  }
} 