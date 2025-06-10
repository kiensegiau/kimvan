// Script tự động trích xuất HTML từ Google Sheets cho Chrome
// Đặt file này trong thư mục public của dự án hoặc bất kỳ đâu có thể tải xuống

// Chạy tự động khi tải trang
(function() {
  console.log('===== Script tự động trích xuất HTML Google Sheets =====');
  console.log('Đang chuẩn bị trích xuất HTML...');
  
  // Đợi trang tải xong hoàn toàn (5 giây)
  setTimeout(function() {
    // Tìm grid container bằng các selector khác nhau phù hợp với Chrome cũ
    var gridContainer = document.querySelector('[id$="-grid-container"]') || 
                        document.querySelector('[class*="grid-container"]') ||
                        document.querySelector('[role="grid"]');
    
    if (!gridContainer) {
      console.error('Không tìm thấy grid container trong trang. Thử các phương pháp khác...');
      
      // Thử tìm các phần tử chứa grid cell
      var gridCells = document.querySelectorAll('.grid-cell, [class*="cell"], [role="gridcell"]');
      if (gridCells && gridCells.length > 0) {
        // Tìm phần tử cha chung
        var parent = gridCells[0].parentElement;
        while (parent && !parent.id.includes('grid-container') && !parent.className.includes('grid-container')) {
          parent = parent.parentElement;
          if (!parent || parent === document.body) break;
        }
        
        if (parent && parent !== document.body) {
          gridContainer = parent;
          console.log('Đã tìm thấy container cha của các ô:', gridContainer);
        } else {
          // Tạo một container mới để chứa HTML
          gridContainer = document.createElement('div');
          gridContainer.id = 'extracted-grid-container';
          
          // Thêm tất cả các ô vào container
          gridCells.forEach(function(cell) {
            var cellClone = cell.cloneNode(true);
            // Lưu vị trí của ô
            cellClone.setAttribute('data-top', window.getComputedStyle(cell).top);
            cellClone.setAttribute('data-left', window.getComputedStyle(cell).left);
            gridContainer.appendChild(cellClone);
          });
          
          console.log('Đã tạo container mới với', gridCells.length, 'ô');
        }
      } else {
        alert('Không thể tìm thấy dữ liệu bảng trong trang!');
        return;
      }
    }
    
    // Lấy HTML
    var html = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n<title>Google Sheet HTML</title>\n';
    html += '<style>\n';
    html += '.grid-cell { position: absolute; }\n';
    html += '</style>\n';
    html += '</head>\n<body>\n';
    html += gridContainer.outerHTML;
    html += '\n</body>\n</html>';
    
    // Tạo file và tải về (hoạt động trong Chrome cũ)
    try {
      var blob = new Blob([html], { type: 'text/html' });
      
      // Phương pháp 1: Sử dụng URL.createObjectURL (Chrome mới hơn)
      if (window.URL && URL.createObjectURL) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'google-sheet-' + new Date().getTime() + '.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('Đã tải HTML thành công (phương pháp 1)');
      } 
      // Phương pháp 2: Sử dụng data URL (Chrome cũ hơn)
      else {
        var reader = new FileReader();
        reader.onload = function(e) {
          var a = document.createElement('a');
          a.href = e.target.result;
          a.download = 'google-sheet-' + new Date().getTime() + '.html';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          console.log('Đã tải HTML thành công (phương pháp 2)');
        };
        reader.readAsDataURL(blob);
      }
      
      alert('Đã trích xuất và tải HTML của Google Sheet thành công!');
    } catch (e) {
      console.error('Lỗi khi tạo file:', e);
      
      // Phương pháp 3: Mở cửa sổ mới với HTML (phương pháp dự phòng)
      var newWindow = window.open('', '_blank');
      newWindow.document.write(html);
      newWindow.document.close();
      alert('Đã mở HTML trong cửa sổ mới. Vui lòng sử dụng Ctrl+S để lưu lại.');
      console.log('Đã mở HTML trong cửa sổ mới (phương pháp 3)');
    }
  }, 5000); // Đợi 5 giây cho trang tải hoàn toàn
  
  // Hiển thị thông báo
  var messageDiv = document.createElement('div');
  messageDiv.style.position = 'fixed';
  messageDiv.style.top = '10px';
  messageDiv.style.left = '10px';
  messageDiv.style.padding = '10px';
  messageDiv.style.background = 'rgba(0, 0, 0, 0.7)';
  messageDiv.style.color = 'white';
  messageDiv.style.borderRadius = '5px';
  messageDiv.style.zIndex = '9999';
  messageDiv.innerText = 'Đang trích xuất HTML... Vui lòng đợi 5 giây.';
  document.body.appendChild(messageDiv);
  
  setTimeout(function() {
    document.body.removeChild(messageDiv);
  }, 5000);
})(); 