import mongoose from 'mongoose';

const SheetDataSchema = new mongoose.Schema({
  sheetId: {
    type: String,
    required: true,
    index: true
  },
  rowIndex: {
    type: Number,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  htmlData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  processedData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index for faster lookup by sheetId and rowIndex
SheetDataSchema.index({ sheetId: 1, rowIndex: 1 }, { unique: true });

// Middleware to update lastUpdated on save
SheetDataSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

// Middleware to update lastUpdated on update
SheetDataSchema.pre('findOneAndUpdate', function(next) {
  this.set({ lastUpdated: Date.now() });
  next();
});

const SheetData = mongoose.models.SheetData || mongoose.model('SheetData', SheetDataSchema);

export default SheetData; 