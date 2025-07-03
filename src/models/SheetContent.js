import mongoose from 'mongoose';

const SheetContentSchema = new mongoose.Schema({
  sheetId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    default: ''
  },
  totalRows: {
    type: Number,
    default: 0
  },
  header: [String],
  rows: [{
    rowIndex: Number,
    data: [mongoose.Schema.Types.Mixed],
    processedData: mongoose.Schema.Types.Mixed
  }],
  htmlData: [[mongoose.Schema.Types.Mixed]],
  processedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

SheetContentSchema.index({ 'rows.processedData.urls.url': 1 });

const SheetContent = mongoose.models.SheetContent || mongoose.model('SheetContent', SheetContentSchema);

export default SheetContent; 