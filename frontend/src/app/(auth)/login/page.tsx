'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import { ArchRow } from '@/components/brand/arches';

const loginSchema = z.object({
  ma_tnv: z.string().min(1, 'Vui lòng nhập mã TNV'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.ma_tnv, data.password);
      const { user: currentUser } = useAuthStore.getState();
      if (currentUser?.role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Đăng nhập thất bại';
      toast({ title: 'Lỗi đăng nhập', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-brand-bg p-4">
      {/* Decorative arches */}
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
              Hệ thống quản lý
              <br />
              lịch trông Thư viện Dương Liễu
            </h1>
            <p className="text-sm text-gray-500 mt-2">Vui lòng đăng nhập bằng mã TNV</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-5 text-left">
            <div className="space-y-1">
              <label htmlFor="ma_tnv" className="text-sm text-gray-600">
                Mã TNV
              </label>
              <input
                id="ma_tnv"
                placeholder="Ví dụ: B22DCPT001"
                autoComplete="username"
                className="w-full border-0 border-b border-gray-300 focus:border-brand-blue focus:ring-0 px-0 py-1.5 text-sm outline-none transition-colors"
                {...register('ma_tnv')}
              />
              {errors.ma_tnv && (
                <p className="text-xs text-destructive">{errors.ma_tnv.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm text-gray-600">
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
                className="w-full border-0 border-b border-gray-300 focus:border-brand-blue focus:ring-0 px-0 py-1.5 text-sm outline-none transition-colors"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
              <div className="text-right">
                <Link href="/forgot-password" className="text-xs text-brand-blue hover:underline">
                  Quên mật khẩu?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-brand-blue py-3 text-sm font-bold tracking-wide text-white hover:bg-brand-blue-dark transition-colors disabled:opacity-60 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ĐANG ĐĂNG NHẬP...
                </>
              ) : (
                'ĐĂNG NHẬP'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
