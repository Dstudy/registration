'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { CheckCircle, Clock, User } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

export default function CheckInPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: todayShifts = [] } = useQuery({
    queryKey: ['registrations', 'today'],
    queryFn: () =>
      api.get(`/registrations/my?upcoming=true`).then((r) =>
        r.data.data.filter((reg: any) => reg.shift.date.startsWith(today)),
      ),
  });

  const checkInMutation = useMutation({
    mutationFn: ({ shiftId, targetUserId }: { shiftId: number; targetUserId?: number }) =>
      api.post('/attendance/checkin', { shiftId, targetUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registrations', 'today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Điểm danh thành công!' });
    },
    onError: (err: any) => {
      toast({
        title: 'Điểm danh thất bại',
        description: err?.response?.data?.message || err.message,
        variant: 'destructive',
      });
    },
  });

  if (!todayShifts.length) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Điểm danh</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Hôm nay bạn không có ca trực</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Điểm danh hôm nay</h1>
      <p className="text-sm text-gray-500">{format(new Date(), 'EEEE, dd/MM/yyyy', { locale: vi })}</p>

      {todayShifts.map((reg: any) => (
        <ShiftCheckIn
          key={reg.id}
          reg={reg}
          currentUserId={user?.id}
          onCheckIn={(shiftId, targetUserId) =>
            checkInMutation.mutate({ shiftId, targetUserId })
          }
          isLoading={checkInMutation.isPending}
        />
      ))}
    </div>
  );
}

function ShiftCheckIn({
  reg,
  currentUserId,
  onCheckIn,
  isLoading,
}: {
  reg: any;
  currentUserId?: number;
  onCheckIn: (shiftId: number, targetUserId?: number) => void;
  isLoading: boolean;
}) {
  const { data: shiftData } = useQuery({
    queryKey: ['shift-detail', reg.shiftId],
    queryFn: () => api.get(`/shifts/${reg.shiftId}`).then((r) => r.data.data),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', reg.shiftId],
    queryFn: () => api.get(`/attendance/shift/${reg.shiftId}`).then((r) => r.data.data),
  });

  const isCheckedIn = (userId: number) =>
    attendance.some((a: any) => a.userId === userId && a.status === 'PRESENT');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {reg.shift.shiftName} — {reg.shift.position === 'PLACE_1' ? 'Địa điểm 1' : 'Địa điểm 2'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Self check-in */}
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-sm">Bản thân</span>
          </div>
          {isCheckedIn(currentUserId!) ? (
            <Badge variant="success">
              <CheckCircle className="h-3 w-3 mr-1" />
              Có mặt
            </Badge>
          ) : (
            <Button
              size="sm"
              onClick={() => onCheckIn(reg.shiftId)}
              disabled={isLoading}
              className="h-9 px-4"
            >
              Điểm danh
            </Button>
          )}
        </div>

        {/* Teammates */}
        {shiftData?.registrations
          ?.filter((r: any) => r.userId !== currentUserId)
          .map((r: any) => (
            <div key={r.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="font-medium text-sm">{r.user.fullname}</p>
                  <p className="text-xs text-gray-500">{r.user.ma_tnv}</p>
                </div>
              </div>
              {isCheckedIn(r.userId) ? (
                <Badge variant="success">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Có mặt
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onCheckIn(reg.shiftId, r.userId)}
                  disabled={isLoading}
                  className="h-9"
                >
                  Điểm danh hộ
                </Button>
              )}
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
