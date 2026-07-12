'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { LogOut, UserCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UserMenu() {
  const { user, logout, setViewAsVolunteer } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const handleSwitchToVolunteer = () => {
    setViewAsVolunteer(true);
    router.push('/dashboard');
  };

  return (
    <div className="flex items-center gap-3">
      {user?.role === 'ADMIN' && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSwitchToVolunteer}
          className="flex items-center gap-1.5 border-blue-200 text-blue-700 bg-white hover:bg-blue-50"
          title="Chuyển sang giao diện Tình nguyện viên"
        >
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline text-xs font-semibold">Xem bản TNV</span>
        </Button>
      )}
      <Link href="/admin/account" className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity">
        <div className="relative h-8 w-8 rounded-full bg-blue-100 overflow-hidden flex items-center justify-center shrink-0">
          <UserCircle className="h-4 w-4 text-blue-600" />
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
