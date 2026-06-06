'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { VolunteerSidebar, MobileBottomNav } from '@/components/layout/volunteer-sidebar';
import { NotificationBell } from '@/components/layout/notification-bell';

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (user?.role === 'ADMIN') {
      router.push('/admin/dashboard');
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <VolunteerSidebar />
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
          <h2 className="text-sm font-medium text-gray-600 md:hidden">
            Quản lý Lịch Trực TNV
          </h2>
          <div className="flex items-center gap-3 ml-auto">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <Link href="/account" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="h-8 w-8 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center shrink-0">
                  {user.avatar ? (
                    <img src={user.avatar} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-blue-600 select-none">
                      {(user.fullname || user.ma_tnv).split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-sm text-gray-700 font-medium hidden md:block">
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
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav />
    </div>
  );
}
