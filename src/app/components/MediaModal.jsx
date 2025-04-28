'use client';

import { useState, useRef } from 'react';
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  Button,
  Chip,
  Spinner,
  Checkbox,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip
} from '@nextui-org/react';
import { toast } from 'react-hot-toast';
import { FaDownload, FaYoutube, FaLink, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';

export default function MediaModal({ isOpen, onClose, courseId, mediaItems }) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [downloadResults, setDownloadResults] = useState(null);
  const [uploadResults, setUploadResults] = useState(null);
  
  const handleSelectionChange = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };
  
  const selectAll = () => {
    if (selectedItems.length === mediaItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(mediaItems.map(item => item.id));
    }
  };
  
  const downloadSelected = async () => {
    if (selectedItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất một tài liệu');
      return;
    }
    
    try {
      setIsDownloading(true);
      setDownloadResults(null);
      
      const media = mediaItems.filter(item => selectedItems.includes(item.id));
      
      const response = await fetch('/api/courses/media/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          media
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      setDownloadResults(result);
      toast.success(`Tải xuống ${result.success} tài liệu thành công`);
    } catch (error) {
      console.error('Lỗi khi tải xuống tài liệu:', error);
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };
  
  const uploadToYoutube = async () => {
    if (selectedItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất một tài liệu');
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadResults(null);
      
      const media = mediaItems.filter(item => selectedItems.includes(item.id));
      
      const response = await fetch('/api/courses/media/upload/youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          media
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message);
      }
      
      setUploadResults(result);
      toast.success(`Đã tải lên YouTube ${result.success} tài liệu thành công`);
    } catch (error) {
      console.error('Lỗi khi tải lên YouTube:', error);
      toast.error(`Lỗi: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };
  
  const resetResults = () => {
    setDownloadResults(null);
    setUploadResults(null);
  };
  
  const renderMediaList = () => {
    return (
      <>
        <div className="flex justify-between mb-2">
          <Button 
            size="sm" 
            variant="flat" 
            onPress={selectAll}
          >
            {selectedItems.length === mediaItems.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </Button>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              color="primary" 
              startContent={<FaDownload />}
              isLoading={isDownloading}
              onPress={downloadSelected}
            >
              Tải xuống
            </Button>
            <Button 
              size="sm" 
              color="danger" 
              startContent={<FaYoutube />}
              isLoading={isUploading}
              onPress={uploadToYoutube}
            >
              Tải lên YouTube
            </Button>
          </div>
        </div>
        
        <Table aria-label="Danh sách tài liệu">
          <TableHeader>
            <TableColumn width={60}>#</TableColumn>
            <TableColumn>Tên tài liệu</TableColumn>
            <TableColumn>Loại</TableColumn>
            <TableColumn width={100}>Thao tác</TableColumn>
          </TableHeader>
          <TableBody>
            {mediaItems.map((item, index) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    isSelected={selectedItems.includes(item.id)}
                    onValueChange={() => handleSelectionChange(item.id)}
                  />
                </TableCell>
                <TableCell>{item.title}</TableCell>
                <TableCell>
                  <Chip 
                    color={item.type === 'video' ? 'danger' : 'primary'} 
                    variant="flat" 
                    size="sm"
                  >
                    {item.type === 'video' ? 'Video' : 'PDF'}
                  </Chip>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Tooltip content="Xem liên kết">
                      <Button isIconOnly size="sm" variant="light">
                        <FaLink />
                      </Button>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </>
    );
  };
  
  const renderResultTable = (results, title) => {
    if (!results) return null;
    
    return (
      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <Table aria-label="Kết quả xử lý">
          <TableHeader>
            <TableColumn>Tên tài liệu</TableColumn>
            <TableColumn>Trạng thái</TableColumn>
          </TableHeader>
          <TableBody>
            {results.details.map((item, index) => (
              <TableRow key={index}>
                <TableCell>{item.title}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {item.success ? (
                      <>
                        <FaCheckCircle className="text-success" />
                        <span>Thành công</span>
                        
                        {item.youtubeUrl && (
                          <Tooltip content="Mở liên kết YouTube">
                            <Button 
                              as="a" 
                              href={item.youtubeUrl} 
                              target="_blank" 
                              size="sm" 
                              isIconOnly 
                              variant="light"
                            >
                              <FaYoutube className="text-red-600" />
                            </Button>
                          </Tooltip>
                        )}
                      </>
                    ) : (
                      <>
                        <FaExclamationCircle className="text-danger" />
                        <span>Lỗi: {item.message}</span>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => {
        resetResults();
        onClose();
      }}
      size="3xl"
      scrollBehavior="inside"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Quản lý tài liệu khóa học
            </ModalHeader>
            <ModalBody>
              {!downloadResults && !uploadResults && renderMediaList()}
              
              {renderResultTable(downloadResults, "Kết quả tải xuống")}
              {renderResultTable(uploadResults, "Kết quả tải lên YouTube")}
              
              {(downloadResults || uploadResults) && (
                <Button 
                  color="default" 
                  variant="flat" 
                  onPress={resetResults}
                  className="mt-4"
                >
                  Trở lại danh sách tài liệu
                </Button>
              )}
            </ModalBody>
            <ModalFooter>
              <Button 
                color="danger" 
                variant="light" 
                onPress={() => {
                  resetResults();
                  onClose();
                }}
              >
                Đóng
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
} 