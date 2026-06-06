'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { LogOut, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UserMenu() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const initials = (user?.fullname || user?.ma_tnv || '?')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <Link href="/admin/account" className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
        <div className="relative h-8 w-8 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center shrink-0">
          {user?.avatar ? (
            <Image fill src={user.avatar} alt="Avatar" className="object-cover" />
          ) : (
            <UserCircle className="h-4 w-4 text-blue-600" />
          )}
        </div>
        <div className="hidden sm:block">
          <p className="font-medium text-gray-800 leading-none">{user?.fullname}</p>
          <p className="text-xs text-gray-500">{user?.ma_tnv}</p>
        </div>
      </Link>
      <Button variant="ghost" size="sm" onClick={handleLogout} title="Đăng xuất">
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
