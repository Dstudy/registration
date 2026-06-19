'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { KeyRound } from 'lucide-react';

interface Profile {
  id: number;
  ma_tnv: string;
  fullname: string;
  email: string;
  date_of_birth?: string;
  role: string;
  status: string;
}

export function AccountPage() {
  const { user } = useAuthStore();
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

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-blue">Tài khoản của tôi</h1>
        <p className="text-gray-500 mt-1">{profile?.fullname || user?.ma_tnv}</p>
        <p className="text-sm text-gray-500">{profile?.ma_tnv || user?.ma_tnv}</p>
        {profile?.email && <p className="text-sm text-gray-500">{profile.email}</p>}
      </div>

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
