'use client';

import { useState } from 'react';

export default function TestDriveDownload() {
  const [driveLink, setDriveLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!driveLink) {
      setError('Please enter a Google Drive link');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      setProcessingStatus('Starting download...');
      
      // Call our API with the token and drive link
      const response = await fetch('/api/courses/media/remove-watermark', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: 'api@test-watermark', // Using the required token
          driveLink
        }),
      });
      
      // Handle different response types
      const contentType = response.headers.get('content-type');
      
      if (!response.ok) {
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to download file');
        } else {
          const errorText = await response.text();
          throw new Error(`Server error: ${response.status} - ${errorText.slice(0, 100)}...`);
        }
      }
      
      setProcessingStatus('Download complete! Opening file...');
      
      // Create a blob from the file response and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = getFileName(driveLink, contentType);
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setProcessingStatus('File downloaded successfully!');
    } catch (err) {
      console.error('Error downloading file:', err);
      setError(err.message || 'An error occurred while downloading the file');
      setProcessingStatus('');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to generate a meaningful filename
  const getFileName = (url, contentType) => {
    // Try to extract filename from the URL
    const urlParts = url.split('/');
    const fileId = urlParts[urlParts.indexOf('d') + 1] || 'file';
    
    // Assign extension based on content type
    let extension = '.bin';
    if (contentType) {
      if (contentType.includes('pdf')) extension = '.pdf';
      else if (contentType.includes('image/jpeg')) extension = '.jpg';
      else if (contentType.includes('image/png')) extension = '.png';
      else if (contentType.includes('video/mp4')) extension = '.mp4';
      else if (contentType.includes('audio/mpeg')) extension = '.mp3';
      else if (contentType.includes('text/plain')) extension = '.txt';
      else if (contentType.includes('application/msword')) extension = '.doc';
      else if (contentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) extension = '.docx';
    }
    
    return `google-drive-${fileId.substring(0, 8)}${extension}`;
  };

  const exampleLinks = [
    'https://drive.google.com/file/d/1BxvECFKQkTvPlHmrCYgVB6BJvMpBBE-W/view?usp=sharing',
    'https://drive.google.com/file/d/1nhasgausga782112gasga5/view'
  ];

  const setExampleLink = (link) => {
    setDriveLink(link);
    setError('');
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Google Drive File Downloader</h1>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-yellow-700">
          This tool downloads files directly from Google Drive links.
          The file is transferred through our server to bypass Google Drive restrictions.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="driveLink" className="block text-sm font-medium mb-1">
            Google Drive Link
          </label>
          <input
            type="text"
            id="driveLink"
            placeholder="https://drive.google.com/file/d/..."
            value={driveLink}
            onChange={(e) => setDriveLink(e.target.value)}
            className="w-full px-4 py-2 border rounded-md"
            disabled={isLoading}
          />
          <p className="mt-1 text-sm text-gray-500">
            Paste a Google Drive link to any file you want to download
          </p>
          
          <div className="mt-2">
            <p className="text-sm text-gray-500 mb-1">Example links:</p>
            <div className="space-y-1">
              {exampleLinks.map((link, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setExampleLink(link)}
                  disabled={isLoading}
                  className="text-sm text-blue-600 hover:underline mr-4"
                >
                  Example {index + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className={`px-4 py-2 rounded-md text-white ${
            isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Downloading...' : 'Download File'}
        </button>
      </form>
      
      {processingStatus && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-600">{processingStatus}</p>
          {isLoading && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-600 h-2.5 rounded-full animate-pulse w-full"></div>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 font-medium">Error:</p>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-500">
        <p className="font-medium">Troubleshooting tips:</p>
        <ul className="list-disc pl-5 mt-2">
          <li>Ensure the Google Drive link is valid and accessible</li>
          <li>The file must be publicly accessible or have "anyone with the link" viewing permission</li>
          <li>Large files might take longer to download</li>
          <li>If you receive server errors, check your internet connection or try a different file</li>
        </ul>
      </div>
    </div>
  );
} 