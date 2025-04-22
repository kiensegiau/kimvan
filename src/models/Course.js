import { Schema, model, models } from 'mongoose';

const CourseSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Vui lòng nhập tên khóa học'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Vui lòng nhập mô tả khóa học'],
  },
  price: {
    type: Number,
    required: [true, 'Vui lòng nhập giá khóa học'],
    min: [0, 'Giá không thể là số âm'],
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Course = models.Course || model('Course', CourseSchema);

export default Course; 