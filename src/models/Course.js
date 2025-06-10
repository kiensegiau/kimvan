import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên khóa học không được để trống'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  price: {
    type: Number,
    default: 0
  },
  originalPrice: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  kimvanId: {
    type: String,
    trim: true
  },
  originId: {
    type: String,
    trim: true
  },
  originalData: {
    type: mongoose.Schema.Types.Mixed
  },
  spreadsheetId: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Thêm trường để lưu các file Drive đã xử lý
  processedDriveFiles: [
    {
      originalUrl: String,       // URL gốc
      processedUrl: String,      // URL đã xử lý
      processedAt: Date,         // Thời gian xử lý
      fileName: String,          // Tên file
      sheetIndex: Number,        // Index của sheet
      rowIndex: Number,          // Index của row
      originId: String,          // Thêm trường originId cho processedDriveFiles
      isFolder: Boolean,         // Thêm trường isFolder
      folderInfo: mongoose.Schema.Types.Mixed  // Thông tin thêm cho thư mục
    }
  ]
}, {
  timestamps: true
});

// Đảm bảo model không được khởi tạo lại nếu đã tồn tại
const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

export default Course; 