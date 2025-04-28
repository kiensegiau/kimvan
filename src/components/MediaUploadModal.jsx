import { useState } from 'react';
import { Button, Label, Modal, Radio, Spinner, Tooltip } from 'flowbite-react';
import { FaCloudUploadAlt, FaYoutube, FaGoogleDrive, FaInfoCircle, FaCheck, FaTimes } from 'react-icons/fa';
import { HiOutlineExclamationCircle } from 'react-icons/hi';

export default function MediaUploadModal({ 
  show, 
  onClose,
  courseId,
  mediaItems,
  onSuccess
}) {
  const [uploadType, setUploadType] = useState('drive');
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setResults(null);

    try {
      const endpoint = uploadType === 'youtube' 
        ? '/api/courses/media/upload/youtube'
        : '/api/courses/media/upload/drive';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId,
          mediaItems
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }

      setResults(data);
      
      // Call the onSuccess callback with the results
      if (onSuccess) {
        onSuccess(data, uploadType);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setUploading(false);
    }
  };

  const resetModal = () => {
    setResults(null);
    setError(null);
    setUploading(false);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <Modal show={show} onClose={handleClose} size="md">
      <Modal.Header>
        Upload Media Files
      </Modal.Header>
      <Modal.Body>
        {error && (
          <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
            <HiOutlineExclamationCircle className="inline mr-2" size={20} />
            {error}
          </div>
        )}

        {results ? (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <FaCheck className="mx-auto text-green-500 mb-2" size={30} />
              <h3 className="text-lg font-medium">Upload Complete</h3>
              <p className="text-gray-500">
                {uploadType === 'youtube' ? (
                  `Successfully uploaded ${results.successCount} videos to YouTube`
                ) : (
                  `Successfully uploaded ${results.successCount} files to Google Drive`
                )}
                {results.failedCount > 0 && ` (${results.failedCount} failed)`}
              </p>
            </div>

            {results.details && results.details.length > 0 && (
              <div className="mt-4 max-h-60 overflow-y-auto">
                <h4 className="font-medium mb-2">Upload Details:</h4>
                <ul className="space-y-2">
                  {results.details.map((item, index) => (
                    <li key={index} className={`p-2 rounded-md ${item.success ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                      <div className="flex items-start">
                        {item.success ? (
                          <FaCheck className="text-green-500 mr-2 mt-1 flex-shrink-0" />
                        ) : (
                          <FaTimes className="text-red-500 mr-2 mt-1 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.title}</p>
                          {item.success && item.youtubeUrl && (
                            <a 
                              href={item.youtubeUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs"
                            >
                              View on YouTube
                            </a>
                          )}
                          {item.success && item.driveUrl && (
                            <a 
                              href={item.driveUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs"
                            >
                              View on Google Drive
                            </a>
                          )}
                          {!item.success && item.message && (
                            <p className="text-red-600 text-xs">{item.message}</p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="mb-2 block">
                <Label value="Choose upload destination" />
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Radio
                    id="drive"
                    name="uploadType"
                    value="drive"
                    checked={uploadType === 'drive'}
                    onChange={() => setUploadType('drive')}
                  />
                  <Label htmlFor="drive" className="flex items-center">
                    <FaGoogleDrive className="mr-2 text-blue-600" />
                    Google Drive
                    <Tooltip content="Upload all media files to your Google Drive">
                      <FaInfoCircle className="ml-2 text-gray-400" />
                    </Tooltip>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Radio
                    id="youtube"
                    name="uploadType"
                    value="youtube"
                    checked={uploadType === 'youtube'}
                    onChange={() => setUploadType('youtube')}
                  />
                  <Label htmlFor="youtube" className="flex items-center">
                    <FaYoutube className="mr-2 text-red-600" />
                    YouTube
                    <Tooltip content="Upload video files to your YouTube channel (videos only)">
                      <FaInfoCircle className="ml-2 text-gray-400" />
                    </Tooltip>
                  </Label>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded-lg">
              <p className="font-medium mb-1">Notes:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  {uploadType === 'youtube' 
                    ? 'Only video files will be uploaded to YouTube' 
                    : 'All selected files will be uploaded to Google Drive'}
                </li>
                <li>You must have authorized access to {uploadType === 'youtube' ? 'YouTube' : 'Google Drive'}</li>
                <li>Uploads may take some time depending on file size and network speed</li>
              </ul>
            </div>

            <div className="border border-gray-200 rounded-lg p-3">
              <h4 className="font-medium mb-2">Files to upload ({mediaItems.length}):</h4>
              <ul className="max-h-40 overflow-y-auto space-y-1">
                {mediaItems.map((item) => (
                  <li key={item.id} className="text-sm truncate">
                    {item.title || item.fileName || 'Untitled file'}
                  </li>
                ))}
              </ul>
            </div>
          </form>
        )}
      </Modal.Body>
      <Modal.Footer>
        {results ? (
          <Button onClick={handleClose}>Close</Button>
        ) : (
          <>
            <Button color="gray" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              disabled={uploading}
              onClick={handleSubmit}
              className="flex items-center"
            >
              {uploading ? (
                <>
                  <Spinner className="mr-2" size="sm" />
                  Uploading...
                </>
              ) : (
                <>
                  <FaCloudUploadAlt className="mr-2" />
                  Upload to {uploadType === 'youtube' ? 'YouTube' : 'Google Drive'}
                </>
              )}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
} 