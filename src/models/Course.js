import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên khóa học không được để trống'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
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
  requiresEnrollment: {
    type: Boolean,
    default: true
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
  sheets: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sheet'
    }
  ],
  // Thêm field sheetsData để lưu dữ liệu đồng bộ từ sheet
  sheetsData: [
    {
      _id: mongoose.Schema.Types.ObjectId,
      title: String,
      name: String,
      values: [[mongoose.Schema.Types.Mixed]],
      rows: [mongoose.Schema.Types.Mixed],
      header: [String],
      hyperlinks: [mongoose.Schema.Types.Mixed],
      htmlData: [mongoose.Schema.Types.Mixed],
      merges: [mongoose.Schema.Types.Mixed]
    }
  ],
  lastSyncedAt: {
    type: Date
  },
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

// Middleware để tự động cập nhật updatedAt trước khi lưu
courseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware để tự động cập nhật updatedAt trước khi cập nhật
courseSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Đảm bảo model không được khởi tạo lại nếu đã tồn tại
const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

export default Course; 