'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { VolunteerTopNav, VolunteerHamburger } from '@/components/layout/volunteer-nav';
import { NotificationBell } from '@/components/layout/notification-bell';
import { Logo } from '@/components/brand/logo';
import clsx from 'clsx';
import styles from './layout.module.css';

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, hasHydrated, logout, viewAsVolunteer, setViewAsVolunteer } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === '/dashboard';

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      router.push('/login');
    } else if (user?.role === 'ADMIN' && !viewAsVolunteer) {
      router.push('/admin/dashboard');
    }
  }, [hasHydrated, isAuthenticated, user, viewAsVolunteer, router]);

  if (!hasHydrated) return null;
  if (!isAuthenticated || !user) return null;

  return (
    <div className={clsx(styles.background, "min-h-screen bg-brand-bg flex flex-col")}>
      {user.role === 'ADMIN' && viewAsVolunteer && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-semibold px-6 py-2.5 flex items-center justify-between gap-4 shadow-md z-40 transition-all">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span>Bạn đang xem giao diện với tư cách Tình nguyện viên (Chế độ xem trước)</span>
          </div>
          <button
            onClick={() => {
              setViewAsVolunteer(false);
              router.push('/admin/dashboard');
            }}
            className="bg-white text-amber-600 px-3 py-1 rounded-full font-bold shadow hover:bg-amber-50 active:scale-95 transition-all"
          >
            Quay lại trang Quản trị
          </button>
        </div>
      )}
      <header
        className="px-3 sm:px-8 lg:px-16 pt-3 sm:pt-8 lg:pt-14 pb-3 sm:pb-5 flex items-center gap-2 sm:gap-4 md:gap-6 wide:grid wide:grid-cols-[auto_1fr_auto]"
      >
        <Link href="/dashboard" className="shrink-0">
          <Logo />
        </Link>

        {/* Nav in header center — only at wide+ (1400px) */}
        {!isDashboard && (
          <nav className="hidden wide:flex items-center justify-center gap-1 lg:gap-2 overflow-x-auto">
            {/* rendered inline via layout so it has access to navList */}
            <VolunteerTopNav inHeader />
          </nav>
        )}

        <div className="flex items-center gap-2 sm:gap-3 ml-auto wide:ml-0 shrink-0">
          <NotificationBell />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/account" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="relative h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-blue-600 select-none">
                  {(user.fullname || user.ma_tnv).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-gray-700 font-medium hidden lg:block">
                {user.fullname || user.ma_tnv}
              </span>
            </Link>
            <button
              onClick={() => logout().then(() => router.push('/login'))}
              className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 transition-colors px-1.5 sm:px-2 py-1 rounded hover:bg-gray-100 hidden sm:block"
            >
              Đăng xuất
            </button>
          </div>
          {/* Mobile-only hamburger — right corner of header */}
          {!isDashboard && <VolunteerHamburger />}
        </div>
      </header>

      {/* Below-header nav — sm to wide (640px–1399px) */}
      {!isDashboard && <VolunteerTopNav />}

      {/* Page content */}
      <main className={clsx("flex-1", {
        'p-2 sm:p-4 md:p-6': !isDashboard,
      })}>{children}</main>
    </div>
  );
}
