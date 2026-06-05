'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Calendar, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

function formatDate(dateStr: string) {
  return format(new Date(dateStr), 'EEEE, dd/MM/yyyy', { locale: vi });
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  useEffect(() => {
    const confirmed = searchParams.get('confirmed');
    if (confirmed === 'true') {
      toast({ title: 'Xác nhận thành công!', description: 'Ca trực của bạn đã được xác nhận.' });
    } else if (confirmed === 'false') {
      toast({ title: 'Xác nhận thất bại', description: 'Token không hợp lệ hoặc đã hết hạn.', variant: 'destructive' });
    }
  }, [searchParams]);

  const { data: upcoming } = useQuery({
    queryKey: ['registrations', 'upcoming'],
    queryFn: () => api.get('/registrations/my?upcoming=true').then((r) => r.data.data),
  });

  const { data: past } = useQuery({
    queryKey: ['registrations', 'past'],
    queryFn: () => api.get('/registrations/my?upcoming=false').then((r) => r.data.data),
  });

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthShiftCount = upcoming?.filter((r: any) => r.shift.date.startsWith(currentMonth)).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
        <p className="text-gray-500 mt-1">
          Xin chào, <strong>{user?.fullname || user?.ma_tnv}</strong>!
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{monthShiftCount}</p>
              <p className="text-xs text-gray-500">Ca tháng này</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {upcoming?.filter((r: any) => r.isConfirmed).length || 0}
              </p>
              <p className="text-xs text-gray-500">Đã xác nhận</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="h-5 w-5 text-orange-700" />
            </div>
            <div>
              <p className="text-2xl font-bold">{past?.length || 0}</p>
              <p className="text-xs text-gray-500">Ca đã qua</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming shifts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            Ca trực sắp tới
            <Link href="/calendar" className="text-sm font-normal text-blue-600 hover:underline">
              Đăng ký thêm →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!upcoming?.length ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Chưa có ca trực nào. <Link href="/calendar" className="text-blue-600 hover:underline">Đăng ký ngay</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {upcoming.slice(0, 5).map((reg: any) => (
                <div key={reg.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{reg.shift.shiftName}</p>
                    <p className="text-xs text-gray-500">{formatDate(reg.shift.date)}</p>
                    <p className="text-xs text-gray-400">
                      {reg.shift.position === 'PLACE_1' ? 'Địa điểm 1' : 'Địa điểm 2'}
                    </p>
                  </div>
                  <Badge variant={reg.isConfirmed ? 'success' : 'warning'}>
                    {reg.isConfirmed ? 'Đã xác nhận' : 'Chờ xác nhận'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
