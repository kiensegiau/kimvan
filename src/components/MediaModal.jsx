'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Download, Upload, Check, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function MediaModal({ isOpen, onClose, courseId, mediaItems }) {
  const [selectedTab, setSelectedTab] = useState('download');
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState(null);

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedMedia(mediaItems.map(item => item.id));
    } else {
      setSelectedMedia([]);
    }
  };

  const handleSelectMedia = (id) => {
    if (selectedMedia.includes(id)) {
      setSelectedMedia(selectedMedia.filter(item => item !== id));
    } else {
      setSelectedMedia([...selectedMedia, id]);
    }
  };

  const handleDownload = async () => {
    if (selectedMedia.length === 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất một tài liệu để tải xuống",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const response = await fetch('/api/courses/media/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          media: mediaItems.filter(item => selectedMedia.includes(item.id))
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Có lỗi xảy ra khi tải xuống');
      }

      setResults(data);
      toast({
        title: "Thành công",
        description: data.message
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Lỗi",
        description: error.message || 'Có lỗi xảy ra khi tải xuống',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (selectedMedia.length === 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng chọn ít nhất một tài liệu để tải lên",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setResults(null);

    try {
      const response = await fetch('/api/courses/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          media: mediaItems.filter(item => selectedMedia.includes(item.id))
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Có lỗi xảy ra khi tải lên');
      }

      setResults(data);
      toast({
        title: "Thành công",
        description: data.message
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Lỗi",
        description: error.message || 'Có lỗi xảy ra khi tải lên',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleClose = () => {
    setSelectedMedia([]);
    setResults(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quản lý tài liệu khóa học</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="download" value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="mb-4 grid grid-cols-2">
            <TabsTrigger value="download">Tải xuống</TabsTrigger>
            <TabsTrigger value="upload">Tải lên YouTube</TabsTrigger>
          </TabsList>

          <div className="mb-4 flex items-center">
            <Checkbox
              id="selectAll"
              checked={selectedMedia.length === mediaItems.length}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="selectAll" className="ml-2 cursor-pointer">
              Chọn tất cả ({mediaItems.length} tài liệu)
            </label>
            <div className="ml-auto">
              {selectedTab === 'download' ? (
                <Button
                  onClick={handleDownload}
                  disabled={isProcessing || selectedMedia.length === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang tải xuống...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Tải xuống ({selectedMedia.length})
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleUpload}
                  disabled={isProcessing || selectedMedia.length === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Đang tải lên...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Tải lên ({selectedMedia.length})
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="border rounded-md p-4 mb-4">
            <h3 className="font-medium mb-2">Danh sách tài liệu</h3>
            <div className="space-y-2">
              {mediaItems.map(item => (
                <div key={item.id} className="flex items-center p-2 hover:bg-gray-50 rounded">
                  <Checkbox
                    id={`media-${item.id}`}
                    checked={selectedMedia.includes(item.id)}
                    onCheckedChange={() => handleSelectMedia(item.id)}
                  />
                  <label htmlFor={`media-${item.id}`} className="ml-2 flex-1 cursor-pointer">
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-gray-500">
                      {item.type === 'video' ? 'Video' : 'PDF'}
                      {item.duration && ` • ${item.duration}`}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {results && (
            <div className="border rounded-md p-4">
              <h3 className="font-medium mb-2">Kết quả</h3>
              <div className="flex justify-between mb-2 text-sm">
                <div>Tổng: {results.totalItems}</div>
                <div className="text-green-600">Thành công: {results.successCount}</div>
                <div className="text-red-600">Thất bại: {results.failureCount}</div>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {results.details.map((result, index) => (
                  <div 
                    key={index} 
                    className={`p-2 rounded flex items-center ${
                      result.success ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    {result.success ? (
                      <Check className="h-4 w-4 text-green-600 mr-2" />
                    ) : (
                      <X className="h-4 w-4 text-red-600 mr-2" />
                    )}
                    <div>
                      <div className="font-medium">{result.title}</div>
                      <div className="text-sm">
                        {result.message}
                        {result.downloadUrl && (
                          <a 
                            href={result.downloadUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 hover:underline"
                          >
                            Mở link
                          </a>
                        )}
                        {result.youtubeUrl && (
                          <a 
                            href={result.youtubeUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 hover:underline"
                          >
                            Xem trên YouTube
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 