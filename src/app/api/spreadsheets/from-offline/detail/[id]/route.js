import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Tìm file index.json trong thư mục processed
 * @returns {Object|null} Dữ liệu từ file index.json hoặc null nếu không tìm thấy
 */
function findIndexFile() {
  try {
    const processedDir = path.join(process.cwd(), 'processed');
    const indexPath = path.join(processedDir, 'index.json');
    
    if (!fs.existsSync(indexPath)) {
      console.log('Không tìm thấy file index.json. Hãy chạy script process-results.js trước.');
      return null;
    }
    
    const content = fs.readFileSync(indexPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Lỗi khi đọc file index.json:', error.message);
    return null;
  }
}

/**
 * Tìm file dữ liệu đã xử lý mới nhất
 * @returns {Object|null} Dữ liệu đã xử lý hoặc null nếu không tìm thấy
 */
function findLatestProcessedData() {
  try {
    const indexData = findIndexFile();
    if (!indexData || !indexData.lastProcessed) return null;
    
    const dataPath = indexData.lastProcessed;
    if (!fs.existsSync(dataPath)) {
      console.log(`Không tìm thấy file dữ liệu: ${dataPath}`);
      return null;
    }
    
    const content = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Lỗi khi đọc file dữ liệu đã xử lý:', error.message);
    return null;
  }
}

/**
 * Tìm chi tiết sheet theo ID
 * @param {string} id - ID của sheet
 * @returns {Object|null} Chi tiết sheet hoặc null nếu không tìm thấy
 */
function findSheetDetailById(id) {
  const processedData = findLatestProcessedData();
  if (!processedData || !processedData.sheetDetails) return null;
  
  // Tìm chính xác
  for (const key in processedData.sheetDetails) {
    if (id.includes(key) || key.includes(id)) {
      return processedData.sheetDetails[key].data;
    }
  }
  
  return null;
}

export async function GET(request, { params }) {
  try {
    // Đảm bảo await params trước khi sử dụng
    const paramsData = await params;
    const id = paramsData.id;
    
    if (!id) {
      return NextResponse.json({ error: 'ID không được cung cấp' }, { status: 400 });
    }
    
    console.log('==============================================');
    console.log(`🔍 Đang tìm dữ liệu offline cho sheet ID: ${id}`);
    console.log('==============================================');
    
    // Tìm dữ liệu chi tiết sheet
    const sheetDetail = findSheetDetailById(id);
    
    if (!sheetDetail) {
      return NextResponse.json(
        { 
          error: 'Không tìm thấy dữ liệu chi tiết cho sheet này',
          solution: 'Vui lòng chạy các script sau để lấy và xử lý dữ liệu:',
          commands: [
            'node src/scripts/open-browser.js <tên_sheet> "<id_sheet>"',
            'node src/scripts/process-results.js'
          ]
        },
        { status: 404 }
      );
    }
    
    // Trả về kết quả
    return NextResponse.json(sheetDetail);
    
  } catch (error) {
    console.error('Lỗi khi đọc dữ liệu chi tiết offline:', error);
    return NextResponse.json(
      { error: `Lỗi khi đọc dữ liệu chi tiết offline: ${error.message}` },
      { status: 500 }
    );
  }
} 