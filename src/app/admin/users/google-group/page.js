'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, UserPlusIcon, UserMinusIcon, ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

export default function GoogleGroupManagementPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);
  const [groupEmail, setGroupEmail] = useState('kha-hc-60@googlegroups.com');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [successMessage, setSuccessMessage] = useState('');

  // Lấy danh sách thành viên trong nhóm
  const fetchMembers = async () => {
    if (!groupEmail) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/google-group?groupEmail=${encodeURIComponent(groupEmail)}`);
      const data = await response.json();
      
      if (response.ok) {
        setMembers(data.data || []);
        if (data.data.length === 0) {
          setSuccessMessage('Không có thành viên nào trong nhóm hoặc không thể truy cập nhóm này');
        } else {
          setSuccessMessage(`Đã tải ${data.data.length} thành viên của nhóm ${groupEmail}`);
        }
      } else {
        throw new Error(data.error || 'Không thể lấy danh sách thành viên');
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách thành viên:', err);
      setError(err.message || 'Đã xảy ra lỗi khi lấy danh sách thành viên');
    } finally {
      setLoading(false);
    }
  };

  // Thêm thành viên mới vào nhóm
  const addMember = async (e) => {
    e.preventDefault();
    
    if (!groupEmail || !newMemberEmail) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');
      
      const response = await fetch('/api/google-group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newMemberEmail,
          groupEmail: groupEmail,
          role: role
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(`Đã thêm ${newMemberEmail} vào nhóm ${groupEmail} thành công`);
        setNewMemberEmail('');
        // Cập nhật lại danh sách thành viên
        fetchMembers();
      } else {
        throw new Error(data.error || 'Không thể thêm thành viên vào nhóm');
      }
    } catch (err) {
      console.error('Lỗi khi thêm thành viên:', err);
      setError(err.message || 'Đã xảy ra lỗi khi thêm thành viên');
    } finally {
      setLoading(false);
    }
  };

  // Xóa thành viên khỏi nhóm
  const removeMember = async (email) => {
    if (!groupEmail || !email) return;
    
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage('');
      
      const response = await fetch(`/api/google-group?email=${encodeURIComponent(email)}&groupEmail=${encodeURIComponent(groupEmail)}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessMessage(`Đã xóa ${email} khỏi nhóm ${groupEmail} thành công`);
        // Cập nhật lại danh sách thành viên
        fetchMembers();
      } else {
        throw new Error(data.error || 'Không thể xóa thành viên khỏi nhóm');
      }
    } catch (err) {
      console.error('Lỗi khi xóa thành viên:', err);
      setError(err.message || 'Đã xảy ra lỗi khi xóa thành viên');
    } finally {
      setLoading(false);
    }
  };

  // Tự động tải danh sách thành viên khi component được tải
  useEffect(() => {
    if (groupEmail) {
      fetchMembers();
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={() => router.push('/admin/users')}
            className="mr-4 p-2 rounded-md hover:bg-gray-100"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">Quản lý Google Group</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Đã xảy ra lỗi
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 p-4 rounded-md mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">
                {successMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="mb-6 border-b pb-5">
            <h2 className="text-lg font-medium text-gray-900 mb-1">Nhập thông tin Google Group</h2>
            <p className="text-sm text-gray-500">
              Nhập địa chỉ email của Google Group để quản lý thành viên.
            </p>
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
            <div className="flex-grow">
              <label htmlFor="groupEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Email của Google Group
              </label>
              <input
                type="email"
                id="groupEmail"
                value={groupEmail}
                onChange={(e) => setGroupEmail(e.target.value)}
                placeholder="example@googlegroups.com"
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <div>
              <button
                onClick={fetchMembers}
                disabled={!groupEmail || loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-300"
              >
                {loading ? (
                  <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5" />
                ) : (
                  <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5" />
                )}
                Lấy danh sách thành viên
              </button>
            </div>
          </div>

          <div className="mb-6 border-t border-b py-5">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Thêm thành viên mới</h3>
            
            <form onSubmit={addMember} className="flex flex-col md:flex-row gap-4">
              <div className="flex-grow">
                <label htmlFor="newMemberEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email thành viên mới
                </label>
                <input
                  type="email"
                  id="newMemberEmail"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Vai trò
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                >
                  <option value="MEMBER">Thành viên</option>
                  <option value="MANAGER">Quản lý</option>
                  <option value="OWNER">Chủ sở hữu</option>
                </select>
              </div>
              
              <div className="self-end">
                <button
                  type="submit"
                  disabled={!groupEmail || !newMemberEmail || loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300"
                >
                  <UserPlusIcon className="-ml-1 mr-2 h-5 w-5" />
                  Thêm thành viên
                </button>
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Danh sách thành viên</h3>
            
            {members.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vai trò
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {members.map((member) => (
                      <tr key={member.email}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {member.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.role === 'OWNER' && <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">Chủ sở hữu</span>}
                          {member.role === 'MANAGER' && <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Quản lý</span>}
                          {member.role === 'MEMBER' && <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Thành viên</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.status === 'ACTIVE' ? (
                            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Hoạt động</span>
                          ) : (
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">{member.status}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => removeMember(member.email)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-900 inline-flex items-center"
                          >
                            <UserMinusIcon className="h-4 w-4 mr-1" />
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 text-center rounded-md">
                <p className="text-gray-500">
                  {loading ? 'Đang tải danh sách thành viên...' : 'Chưa có thành viên nào hoặc chưa nhập email nhóm'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
        <h3 className="font-medium text-blue-800 mb-2">Hướng dẫn sử dụng</h3>
        <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
          <li>Nhập địa chỉ email của Google Group (ví dụ: example@googlegroups.com)</li>
          <li>Nhấn "Lấy danh sách thành viên" để xem các thành viên hiện có</li>
          <li>Để thêm thành viên mới, nhập email và chọn vai trò, sau đó nhấn "Thêm thành viên"</li>
          <li>Để xóa thành viên, nhấn nút "Xóa" bên cạnh thành viên đó</li>
          <li>Tài khoản Google được sử dụng phải có quyền quản lý Google Group</li>
        </ul>
      </div>
    </div>
  );
} 