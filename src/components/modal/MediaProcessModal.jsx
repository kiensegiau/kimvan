import { useState, useEffect } from 'react';
import { Modal, Button, List, Checkbox, message, Spin, Progress, Tabs, Radio } from 'antd';
import { CloudUploadOutlined, CloudDownloadOutlined, YoutubeOutlined, GoogleOutlined } from '@ant-design/icons';
import axios from 'axios';

const { TabPane } = Tabs;

export default function MediaProcessModal({ 
  visible, 
  onClose, 
  courseId, 
  mediaItems = [],
  onComplete
}) {
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(1);
  const [processedResults, setProcessedResults] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState('drive');
  const [mediaFiltering, setMediaFiltering] = useState('all');

  // Reset state when modal is opened
  useEffect(() => {
    if (visible) {
      setSelectedMedia([]);
      setLoading(false);
      setProgress(0);
      setStep(1);
      setProcessedResults(null);
    }
  }, [visible]);

  // Filter media items based on selection
  const filteredMedia = mediaItems.filter(item => {
    if (mediaFiltering === 'all') return true;
    return item.type === mediaFiltering;
  });

  const handleSelectMedia = (mediaId) => {
    if (selectedMedia.includes(mediaId)) {
      setSelectedMedia(selectedMedia.filter(id => id !== mediaId));
    } else {
      setSelectedMedia([...selectedMedia, mediaId]);
    }
  };

  const handleSelectAll = () => {
    if (selectedMedia.length === filteredMedia.length) {
      setSelectedMedia([]);
    } else {
      setSelectedMedia(filteredMedia.map(item => item.id));
    }
  };

  const handleDownload = async () => {
    if (selectedMedia.length === 0) {
      message.warn('Vui lòng chọn ít nhất một tệp media');
      return;
    }

    setLoading(true);
    setProgress(10);

    try {
      const response = await axios.post('/api/courses/media/download', {
        courseId,
        mediaIds: selectedMedia
      });

      setProgress(100);
      setProcessedResults(response.data);
      setStep(2);
      message.success(`Đã tải xuống ${response.data.successCount} tệp thành công`);
    } catch (error) {
      message.error('Lỗi khi tải xuống: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!processedResults || processedResults.successCount === 0) {
      message.warn('Không có tệp nào để tải lên');
      return;
    }

    setLoading(true);
    setProgress(10);

    try {
      // Build list of media to upload
      const mediaToUpload = processedResults.details
        .filter(item => item.success)
        .map(item => ({
          id: item.id,
          filePath: item.filePath,
          fileName: item.localFileName,
        }));

      const endpoint = selectedDestination === 'youtube' 
        ? '/api/courses/media/upload/youtube' 
        : '/api/courses/media/upload/drive';

      const response = await axios.post(endpoint, {
        courseId,
        mediaItems: mediaToUpload
      });

      setProgress(100);
      message.success(`Đã tải lên ${response.data.successCount} tệp thành công`);
      
      if (onComplete) {
        onComplete(response.data);
      }
      
      onClose();
    } catch (error) {
      message.error('Lỗi khi tải lên: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const renderMediaList = () => (
    <div className="media-selection">
      <div className="filter-controls" style={{ marginBottom: 16 }}>
        <Radio.Group 
          value={mediaFiltering} 
          onChange={e => setMediaFiltering(e.target.value)}
          style={{ marginBottom: 8 }}
        >
          <Radio.Button value="all">Tất cả</Radio.Button>
          <Radio.Button value="video">Video</Radio.Button>
          <Radio.Button value="document">PDF</Radio.Button>
        </Radio.Group>
        
        <Button 
          type="text" 
          onClick={handleSelectAll}
        >
          {selectedMedia.length === filteredMedia.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
        </Button>
      </div>
      
      <List
        dataSource={filteredMedia}
        renderItem={item => (
          <List.Item>
            <Checkbox
              checked={selectedMedia.includes(item.id)}
              onChange={() => handleSelectMedia(item.id)}
            />
            <div className="media-item-info" style={{ marginLeft: 8, flex: 1 }}>
              <div>{item.title}</div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                {item.type === 'video' ? 'Video' : 'PDF'} • {item.duration ? `${item.duration} phút` : 'N/A'}
              </div>
            </div>
          </List.Item>
        )}
        style={{ maxHeight: '400px', overflowY: 'auto' }}
      />
    </div>
  );

  const renderResults = () => (
    <div className="results-container">
      <div className="summary" style={{ marginBottom: 16 }}>
        <div>Tổng số: {processedResults.successCount + processedResults.failedCount}</div>
        <div>Thành công: {processedResults.successCount}</div>
        <div>Thất bại: {processedResults.failedCount}</div>
      </div>
      
      <div className="destination-selection" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Chọn nơi tải lên:</div>
        <Radio.Group 
          value={selectedDestination}
          onChange={e => setSelectedDestination(e.target.value)}
        >
          <Radio value="drive">
            <GoogleOutlined /> Google Drive
          </Radio>
          <Radio value="youtube">
            <YoutubeOutlined /> YouTube
          </Radio>
        </Radio.Group>
      </div>
      
      <List
        dataSource={processedResults.details}
        renderItem={item => (
          <List.Item>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              color: item.success ? 'green' : 'red' 
            }}>
              {item.success ? '✓' : '✗'}
            </div>
            <div style={{ marginLeft: 16, flex: 1 }}>
              <div>{item.title}</div>
              {!item.success && (
                <div style={{ fontSize: '12px', color: 'red' }}>
                  {item.message}
                </div>
              )}
            </div>
          </List.Item>
        )}
        style={{ maxHeight: '300px', overflowY: 'auto' }}
      />
    </div>
  );

  return (
    <Modal
      title="Xử lý tài liệu khóa học"
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="back" onClick={onClose} disabled={loading}>
          Hủy
        </Button>,
        step === 1 ? (
          <Button
            key="download"
            type="primary"
            icon={<CloudDownloadOutlined />}
            loading={loading}
            onClick={handleDownload}
            disabled={selectedMedia.length === 0}
          >
            Tải xuống
          </Button>
        ) : (
          <Button
            key="upload"
            type="primary"
            icon={<CloudUploadOutlined />}
            loading={loading}
            onClick={handleUpload}
            disabled={processedResults?.successCount === 0}
          >
            Tải lên {selectedDestination === 'youtube' ? 'YouTube' : 'Google Drive'}
          </Button>
        ),
      ]}
    >
      {loading && (
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <Spin />
          <Progress percent={progress} status="active" />
          <div>{progress < 100 ? 'Đang xử lý...' : 'Hoàn thành!'}</div>
        </div>
      )}

      {!loading && (
        <>
          {step === 1 && renderMediaList()}
          {step === 2 && renderResults()}
        </>
      )}
    </Modal>
  );
} 