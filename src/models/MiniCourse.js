import mongoose from 'mongoose';

const miniCourseSchema = new mongoose.Schema({
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
  spreadsheetId: String,
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }, // Tham chiếu đến khóa học gốc
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
      originalUrl: String,
      processedUrl: String,
      processedAt: Date,
      fileName: String,
      sheetIndex: Number,
      rowIndex: Number
    }
  ]
}, {
  timestamps: true
});

// Đảm bảo model không được khởi tạo lại nếu đã tồn tại
const MiniCourse = mongoose.models.MiniCourse || mongoose.model('MiniCourse', miniCourseSchema);

export default MiniCourse; 