'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import api from '@/lib/api';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/brand/logo';
import styles from './index.module.css';
import { clsx } from 'clsx';

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Vui lòng nhập email').email('Định dạng email không hợp lệ'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await api.post('/auth/forgot-password', data);
      setSubmitted(true);
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Đã có lỗi xảy ra';
      toast({ title: 'Lỗi', description: message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={clsx(styles.background, "relative min-h-screen overflow-hidden flex items-center justify-center bg-brand-blue p-4")}>
      <div className="relative w-full max-w-3xl rounded-tr-[5rem] bg-white shadow-xl px-8 py-10">
        <div className="flex flex-col items-center text-center gap-6">
          <Logo />

          <div className='mt-5'>
            <h1 className="text-4xl font-semibold text-brand-blue leading-snug">
              Lại quên mật khẩu à?
            </h1>
            <p className="text-xs text-gray-500">
              Nhập email đã đăng ký để nhận liên kết đặt lại mật khẩu
            </p>
          </div>

          {submitted ? (
            <div className="w-full space-y-10 text-left mt-5">
              <p className="text-sm text-gray-600">
                Nếu email tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được
                gửi đến hộp thư của bạn. Vui lòng kiểm tra cả thư mục spam.
              </p>
              <Link
                href="/login"
                className="block w-80 mx-auto text-center rounded-full bg-brand-blue py-3 text-sm font-bold tracking-wide text-white hover:bg-brand-blue-dark transition-colors"
              >
                QUAY LẠI ĐĂNG NHẬP
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-5 text-left">
              <div className="space-y-1">
                <label htmlFor="email" className="text-sm text-gray-600">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                    placeholder="example@gmail.com"
                  autoComplete="email"
                  className="w-full border-0 border-b border-gray-300 focus:border-brand-blue focus:ring-0 px-0 py-1.5 text-sm outline-none transition-colors"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                  className="w-80 mx-auto rounded-full bg-brand-blue py-3 text-sm font-bold tracking-wide text-white hover:bg-brand-blue-dark transition-colors disabled:opacity-60 flex items-center justify-center"
              >
                  {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ĐANG GỬI...
                  </>
                ) : (
                      'GỬI LẠI THÔNG TIN ĐĂNG NHẬP'
                )}
              </button>

              <Link
                href="/login"
                className="block w-full text-center text-sm text-brand-blue hover:underline"
              >
                Quay lại đăng nhập
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
