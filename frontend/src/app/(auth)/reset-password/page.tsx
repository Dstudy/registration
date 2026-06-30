'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ArchRow } from '@/components/brand/arches';

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast({
        title: 'Liên kết không hợp lệ',
        description: 'Thiếu token đặt lại mật khẩu',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: data.newPassword });
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Đặt lại mật khẩu thất bại';
      toast({ title: 'Lỗi', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="w-full space-y-5 text-left">
        <p className="text-sm text-destructive text-center">
          Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.
        </p>
        <Link
          href="/forgot-password"
          className="block w-full text-center rounded-full bg-brand-blue py-3 text-sm font-bold tracking-wide text-white hover:bg-brand-blue-dark transition-colors"
        >
          YÊU CẦU LIÊN KẾT MỚI
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <p className="text-sm text-gray-600 text-center">
        Đặt lại mật khẩu thành công. Đang chuyển đến trang đăng nhập...
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-5 text-left">
      <div className="space-y-1">
        <label htmlFor="newPassword" className="text-sm text-gray-600">
          Mật khẩu mới
        </label>
        <input
          id="newPassword"
          type="password"
          placeholder="Nhập mật khẩu mới"
          autoComplete="new-password"
          className="w-full border-0 border-b border-gray-300 focus:border-brand-blue focus:ring-0 px-0 py-1.5 text-sm outline-none transition-colors"
          {...register('newPassword')}
        />
        {errors.newPassword && (
          <p className="text-xs text-destructive">{errors.newPassword.message}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="text-sm text-gray-600">
          Xác nhận mật khẩu
        </label>
        <input
          id="confirmPassword"
          type="password"
          placeholder="Nhập lại mật khẩu mới"
          autoComplete="new-password"
          className="w-full border-0 border-b border-gray-300 focus:border-brand-blue focus:ring-0 px-0 py-1.5 text-sm outline-none transition-colors"
          {...register('confirmPassword')}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-full bg-brand-blue py-3 text-sm font-bold tracking-wide text-white hover:bg-brand-blue-dark transition-colors disabled:opacity-60 flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ĐANG XỬ LÝ...
          </>
        ) : (
          'ĐẶT LẠI MẬT KHẨU'
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-brand-bg p-4">
      <ArchRow
        color="#C7D2FE"
        count={4}
        radius={110}
        className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 w-[640px] opacity-70"
      />
      <ArchRow
        color="#FBE2C8"
        count={3}
        radius={140}
        className="pointer-events-none absolute -bottom-10 -left-24 w-[520px] opacity-70"
      />
      <ArchRow
        color="#C7D2FE"
        count={3}
        radius={140}
        className="pointer-events-none absolute -bottom-10 -right-24 w-[520px] opacity-70"
      />

      <div className="relative w-full max-w-md rounded-[2rem] rounded-tr-[5rem] bg-white border border-brand-blue/30 shadow-xl px-8 py-10">
        <div className="flex flex-col items-center text-center gap-6">
          <Logo />

          <div>
            <h1 className="text-xl font-extrabold text-brand-blue leading-snug">
              Đặt lại mật khẩu
            </h1>
            <p className="text-sm text-gray-500 mt-2">Nhập mật khẩu mới cho tài khoản của bạn</p>
          </div>

          <Suspense
            fallback={
              <div className="flex justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-brand-blue" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
