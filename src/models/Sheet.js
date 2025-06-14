import mongoose from 'mongoose';

// Định nghĩa schema cho Sheet
const SheetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Tên sheet là bắt buộc'],
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  // Sheet ID chính
  sheetId: {
    type: String,
    required: [true, 'ID sheet là bắt buộc'],
    unique: true,
    trim: true
  },
  // URL chính của sheet
  sheetUrl: {
    type: String,
    trim: true
  },
  // Danh sách các sheet liên quan
  relatedSheets: [{
    name: {
      type: String,
      trim: true
    },
    sheetId: {
      type: String,
      trim: true
    },
    sheetUrl: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware để tự động cập nhật updatedAt trước khi lưu
SheetSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Middleware để tự động cập nhật updatedAt trước khi cập nhật
SheetSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: Date.now() });
  next();
});

// Tạo model từ schema
const Sheet = mongoose.models.Sheet || mongoose.model('Sheet', SheetSchema);

export default Sheet; 