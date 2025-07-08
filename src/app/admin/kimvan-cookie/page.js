'use client';

import { useState, useEffect } from 'react';
import { Button, TextArea, Input, Form, Message, Header, Segment, Divider } from 'semantic-ui-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import fs from 'fs';
import path from 'path';

export default function KimvanCookiePage() {
  const [cookie, setCookie] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const router = useRouter();

  useEffect(() => {
    // Tải cookie hiện tại khi component mount
    loadCurrentCookie();
  }, []);

  const loadCurrentCookie = async () => {
    try {
      const response = await axios.get('/api/youtube/kimvan-cookie');
      if (response.data && response.data.cookie) {
        setCookie(response.data.cookie);
        setMessage('Đã tải cookie thành công');
        setIsError(false);
      } else {
        setMessage('Chưa có cookie được lưu');
        setIsError(true);
      }
    } catch (error) {
      console.error('Lỗi khi tải cookie:', error);
      setMessage('Lỗi khi tải cookie: ' + (error.response?.data?.message || error.message));
      setIsError(true);
    }
  };

  const handleSubmit = async () => {
    try {
      setIsSaving(true);
      setMessage('');

      // Kiểm tra cookie có hợp lệ không
      if (!cookie || cookie.trim() === '') {
        setMessage('Cookie không được để trống');
        setIsError(true);
        setIsSaving(false);
        return;
      }

      // Gửi cookie lên server
      const response = await axios.post('/api/youtube/kimvan-cookie', { cookie });
      
      if (response.data && response.data.success) {
        setMessage('Đã lưu cookie thành công!');
        setIsError(false);
      } else {
        setMessage('Lỗi khi lưu cookie: ' + (response.data?.message || 'Không xác định'));
        setIsError(true);
      }
    } catch (error) {
      console.error('Lỗi khi lưu cookie:', error);
      setMessage('Lỗi khi lưu cookie: ' + (error.response?.data?.message || error.message));
      setIsError(true);
    } finally {
      setIsSaving(false);
    }
  };

  const testCookie = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);

      // Kiểm tra ID file test
      const testFileId = '1dbNk9JKIpsytZ3VmRrePM5d-BXCzdJEk'; // Đây là file test
      
      // Gọi API test cookie
      const response = await axios.post('/api/youtube/kimvan-cookie/test', { 
        cookie, 
        fileId: testFileId 
      });
      
      if (response.data && response.data.success) {
        setTestResult({
          success: true,
          message: 'Cookie hoạt động tốt! Đã tải được file test.',
          fileSize: response.data.fileSizeMB,
          time: response.data.time
        });
      } else {
        setTestResult({
          success: false,
          message: 'Cookie không hoạt động: ' + (response.data?.message || 'Không xác định')
        });
      }
    } catch (error) {
      console.error('Lỗi khi test cookie:', error);
      setTestResult({
        success: false,
        message: 'Lỗi khi test cookie: ' + (error.response?.data?.message || error.message)
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <Header as="h1">Quản lý Cookie Kimvan</Header>
      <Segment>
        <Header as="h3">Hướng dẫn lấy cookie</Header>
        <ol>
          <li>Mở Google Chrome và đăng nhập vào tài khoản Google có quyền truy cập Google Drive</li>
          <li>Mở một file Google Drive bất kỳ</li>
          <li>Nhấn F12 để mở Developer Tools</li>
          <li>Chuyển đến tab Application {`>`} Cookies {`>`} https://drive.google.com</li>
          <li>Nhấp chuột phải vào bảng cookie và chọn "Copy all"</li>
          <li>Dán vào ô bên dưới, hoặc tìm cookie với tên "__Secure-1PSID" và "__Secure-3PSID"</li>
        </ol>
      </Segment>

      <Form>
        <Form.Field>
          <label>Cookie Google Drive</label>
          <TextArea
            placeholder="Dán cookie vào đây..."
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            style={{ minHeight: 200, fontFamily: 'monospace' }}
          />
        </Form.Field>

        {message && (
          <Message
            positive={!isError}
            negative={isError}
            content={message}
          />
        )}

        <Button
          primary
          onClick={handleSubmit}
          loading={isSaving}
          disabled={isSaving}
        >
          Lưu Cookie
        </Button>

        <Button
          secondary
          onClick={testCookie}
          loading={isTesting}
          disabled={isTesting || !cookie}
          style={{ marginLeft: '10px' }}
        >
          Test Cookie
        </Button>

        <Button
          onClick={loadCurrentCookie}
          style={{ marginLeft: '10px' }}
        >
          Tải lại
        </Button>
      </Form>

      {testResult && (
        <Segment
          color={testResult.success ? 'green' : 'red'}
          style={{ marginTop: '20px' }}
        >
          <Header as="h4">Kết quả test</Header>
          <p>{testResult.message}</p>
          {testResult.success && (
            <div>
              <p>Kích thước file: {testResult.fileSize} MB</p>
              <p>Thời gian: {testResult.time} ms</p>
            </div>
          )}
        </Segment>
      )}

      <Divider />
      <Button onClick={() => router.back()}>Quay lại</Button>
    </div>
  );
} 