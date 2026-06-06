'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Camera, KeyRound, UserCircle } from 'lucide-react';

interface Profile {
  id: number;
  ma_tnv: string;
  fullname: string;
  email: string;
  avatar?: string;
  date_of_birth?: string;
  role: string;
  status: string;
}

export function AccountPage() {
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile', 'me'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
  });

  const changePwMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.patch('/users/me/password', data),
    onSuccess: () => {
      toast({ title: 'Đổi mật khẩu thành công' });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwErrors({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra';
      toast({ title: 'Lỗi', description: msg, variant: 'destructive' });
    },
  });

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn file ảnh', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Lỗi', description: 'Ảnh phải nhỏ hơn 2MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (user) setUser({ ...user, avatar: data.avatar });
      toast({ title: 'Cập nhật ảnh đại diện thành công' });
    } catch {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật ảnh', variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!pwForm.currentPassword) errors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
    if (!pwForm.newPassword || pwForm.newPassword.length < 6)
      errors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự';
    if (pwForm.newPassword !== pwForm.confirmPassword)
      errors.confirmPassword = 'Mật khẩu xác nhận không khớp';

    if (Object.keys(errors).length) {
      setPwErrors(errors);
      return;
    }

    setPwErrors({});
    changePwMutation.mutate({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    });
  };

  const displayName = profile?.fullname || user?.ma_tnv || '';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const avatarSrc = user?.avatar || profile?.avatar;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tài khoản của tôi</h1>
        <p className="text-gray-500 mt-1">Quản lý ảnh đại diện và bảo mật tài khoản</p>
      </div>

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            Ảnh đại diện
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-6">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              className="relative h-24 w-24 rounded-full overflow-hidden bg-blue-100 flex items-center justify-center group cursor-pointer border-2 border-transparent hover:border-blue-400 transition-all disabled:cursor-not-allowed"
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-blue-600 select-none">{initials || '?'}</span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                <Camera className="h-6 w-6 text-white" />
              </div>
            </button>
            {uploading && (
              <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{displayName}</p>
            <p className="text-sm text-gray-500">{profile?.ma_tnv || user?.ma_tnv}</p>
            {profile?.email && <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>}
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={uploading}
              className="mt-2 text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              {uploading ? 'Đang tải lên...' : 'Thay đổi ảnh'}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">Hỗ trợ JPG, PNG, WEBP. Tối đa 2MB.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Đổi mật khẩu
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-sm">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
              <Input
                id="currentPassword"
                type="password"
                value={pwForm.currentPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, currentPassword: e.target.value }))}
                placeholder="Nhập mật khẩu hiện tại"
                autoComplete="current-password"
              />
              {pwErrors.currentPassword && (
                <p className="text-xs text-red-500">{pwErrors.currentPassword}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                value={pwForm.newPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, newPassword: e.target.value }))}
                placeholder="Ít nhất 6 ký tự"
                autoComplete="new-password"
              />
              {pwErrors.newPassword && (
                <p className="text-xs text-red-500">{pwErrors.newPassword}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={pwForm.confirmPassword}
                onChange={(e) => setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
              />
              {pwErrors.confirmPassword && (
                <p className="text-xs text-red-500">{pwErrors.confirmPassword}</p>
              )}
            </div>
            <Button type="submit" disabled={changePwMutation.isPending}>
              {changePwMutation.isPending ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
