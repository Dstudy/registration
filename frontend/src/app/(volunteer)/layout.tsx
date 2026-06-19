'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { VolunteerTopNav } from '@/components/layout/volunteer-nav';
import { NotificationBell } from '@/components/layout/notification-bell';
import { Logo } from '@/components/brand/logo';

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, hasHydrated, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === '/dashboard';

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      router.push('/login');
    } else if (user?.role === 'ADMIN') {
      router.push('/admin/dashboard');
    }
  }, [hasHydrated, isAuthenticated, user, router]);

  if (!hasHydrated) return null;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <header
        className={`bg-brand-bg px-4 md:px-6 pt-8 pb-5 flex items-center gap-3 md:gap-6 sticky top-0 z-30 ${
          isDashboard ? 'hidden' : ''
        }`}
      >
        <Link href="/dashboard" className="shrink-0">
          <Logo className="hidden sm:flex" />
          <Logo className="sm:hidden [&>span]:hidden" />
        </Link>

        <VolunteerTopNav />

        <div className="flex items-center gap-3 ml-auto shrink-0">
          <NotificationBell />
          <div className="flex items-center gap-2">
            <Link href="/account" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="relative h-8 w-8 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center shrink-0">
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
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded hover:bg-gray-100"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
