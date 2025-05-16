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
 * Tìm danh sách sheet theo tên
 * @param {string} name - Tên sheet cần tìm
 * @returns {Array|null} Danh sách sheet hoặc null nếu không tìm thấy
 */
function findSheetListByName(name) {
  const processedData = findLatestProcessedData();
  if (!processedData || !processedData.sheetLists) return null;
  
  // Tìm chính xác
  if (processedData.sheetLists[name]) {
    return processedData.sheetLists[name].data;
  }
  
  // Tìm khớp một phần
  const keys = Object.keys(processedData.sheetLists);
  for (const key of keys) {
    if (key.includes(name) || name.includes(key)) {
      return processedData.sheetLists[key].data;
    }
  }
  
  return null;
}

export async function GET(request, { params }) {
  try {
    // Đảm bảo await params trước khi sử dụng
    const paramsData = await params;
    const name = paramsData.name;
    
    if (!name) {
      return NextResponse.json({ error: 'Tên không được cung cấp' }, { status: 400 });
    }
    
    console.log('==============================================');
    console.log(`🔍 Đang tìm dữ liệu offline cho sheet: ${name}`);
    console.log('==============================================');
    
    // Tìm dữ liệu danh sách sheet
    const sheetList = findSheetListByName(name);
    
    if (!sheetList) {
      return NextResponse.json(
        { 
          error: 'Không tìm thấy dữ liệu cho sheet này',
          solution: 'Vui lòng chạy các script sau để lấy và xử lý dữ liệu:',
          commands: [
            'node src/scripts/open-browser.js <tên_sheet>',
            'node src/scripts/process-results.js'
          ]
        },
        { status: 404 }
      );
    }
    
    // Trả về kết quả
    return NextResponse.json(sheetList);
    
  } catch (error) {
    console.error('Lỗi khi đọc dữ liệu offline:', error);
    return NextResponse.json(
      { error: `Lỗi khi đọc dữ liệu offline: ${error.message}` },
      { status: 500 }
    );
  }
} 