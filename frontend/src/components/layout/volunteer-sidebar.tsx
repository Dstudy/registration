'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Calendar,
  Clock,
  CheckSquare,
  ArrowLeftRight,
  Bell,
  UserCircle,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
  { href: '/calendar', icon: Calendar, label: 'Lịch trực' },
  { href: '/my-shifts', icon: Clock, label: 'Ca của tôi' },
  { href: '/check-in', icon: CheckSquare, label: 'Điểm danh' },
  { href: '/requests', icon: ArrowLeftRight, label: 'Yêu cầu' },
  { href: '/notifications', icon: Bell, label: 'Thông báo' },
  { href: '/account', icon: UserCircle, label: 'Tài khoản' },
];

export function VolunteerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r min-h-screen">
      <div className="p-6 border-b">
        <h1 className="font-bold text-blue-700 text-lg leading-tight">
          Quản lý Lịch Trực TNV
        </h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

// Mobile bottom navigation
export function MobileBottomNav() {
  const pathname = usePathname();
  const mobileItems = navItems.slice(0, 5);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
      <div className="flex justify-around">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center py-2 px-3 text-xs',
                isActive ? 'text-blue-700' : 'text-gray-500',
              )}
            >
              <Icon className="h-6 w-6 mb-1" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
