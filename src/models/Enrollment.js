import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema({
  userId: {
    type: String, // Firebase userId
    required: [true, 'ID người dùng không được để trống'],
    index: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'ID khóa học không được để trống'],
    index: true
  },
  enrolledAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  completedLessons: {
    type: Number,
    default: 0
  },
  totalTimeSpent: {
    type: Number, // Thời gian học tính bằng phút
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'expired', 'suspended'],
    default: 'active'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Tạo index kết hợp để đảm bảo mỗi người dùng chỉ đăng ký một khóa học một lần
enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true });

// Đảm bảo model không được khởi tạo lại nếu đã tồn tại
const Enrollment = mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);

export default Enrollment; 