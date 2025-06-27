import { downloadFromGoogleDrive, checkFileInfo, listFilesInFolder } from './download-service';
import { processFile, processFolder } from './file-processor';
import { uploadToGoogleDrive, findOrCreateFolder } from './upload-service';
import { 
  processPDFWatermark, 
  downloadProcessedFile, 
  pollTaskStatus 
} from './watermark-service';
import { 
  removeHeaderFooterWatermark, 
  addLogoToPDF, 
  createWatermarkRemovalTask, 
  checkTaskStatus 
} from './pdf-service';

export {
  // Download services
  downloadFromGoogleDrive,
  checkFileInfo,
  listFilesInFolder,
  
  // File processing
  processFile,
  processFolder,
  
  // Upload services
  uploadToGoogleDrive,
  findOrCreateFolder,
  
  // Watermark services
  processPDFWatermark,
  downloadProcessedFile,
  pollTaskStatus,
  
  // PDF services
  removeHeaderFooterWatermark,
  addLogoToPDF,
  createWatermarkRemovalTask,
  checkTaskStatus
}; 