'use client';

import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getDaysInMonth, startOfMonth, getDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Users } from 'lucide-react';

interface ShiftInstance {
  id: number;
  date: string;
  shiftName: string;
  position: 'PLACE_1' | 'PLACE_2';
  startTime: string;
  endTime: string;
  maxSlots: number;
  isActive: boolean;
  isPublished: boolean;
  registrationCount: number;
  isUserRegistered: boolean;
  userRegistrationId: number | null;
}

const positionLabel = { PLACE_1: 'ĐĐ 1', PLACE_2: 'ĐĐ 2' };

function SlotColor({ count, max }: { count: number; max: number }) {
  if (count >= max) return 'bg-gray-200 text-gray-500';
  if (count < 2) return 'bg-red-50 border border-red-300 text-red-700';
  return 'bg-green-50 border border-green-300 text-green-700';
}

interface ShiftCardProps {
  shift: ShiftInstance;
  isRegistrationOpen: boolean;
  onRegister: (shiftId: number) => void;
  onCancel: (shiftId: number) => void;
  isLoading: boolean;
}

function ShiftCard({ shift, isRegistrationOpen, onRegister, onCancel, isLoading }: ShiftCardProps) {
  const isFull = shift.registrationCount >= shift.maxSlots;
  const canRegister = isRegistrationOpen && shift.isActive && !isFull && !shift.isUserRegistered;
  const canCancel = isRegistrationOpen && shift.isUserRegistered;

  return (
    <div
      className={cn(
        'p-2 rounded text-xs mb-1 border',
        shift.isUserRegistered
          ? 'bg-blue-50 border-blue-300'
          : isFull
          ? 'bg-gray-100 border-gray-200 opacity-70'
          : 'bg-white border-gray-200',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium truncate">{shift.shiftName}</span>
        <span className="text-gray-400">{positionLabel[shift.position]}</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <Users className="h-3 w-3 text-gray-400" />
        <span className={cn('font-medium', isFull ? 'text-gray-500' : shift.registrationCount < 2 ? 'text-red-600' : 'text-green-600')}>
          {shift.registrationCount}/{shift.maxSlots}
        </span>
      </div>
      {canRegister && (
        <Button
          size="sm"
          variant="default"
          className="w-full mt-1 h-6 text-xs"
          onClick={() => onRegister(shift.id)}
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Đăng ký'}
        </Button>
      )}
      {canCancel && (
        <Button
          size="sm"
          variant="outline"
          className="w-full mt-1 h-6 text-xs text-red-600 border-red-300 hover:bg-red-50"
          onClick={() => onCancel(shift.id)}
          disabled={isLoading}
        >
          Hủy
        </Button>
      )}
      {!shift.isActive && (
        <span className="text-xs text-gray-400 block mt-1">Đã tắt</span>
      )}
    </div>
  );
}

interface ShiftCalendarProps {
  month: string;
  isRegistrationOpen: boolean;
}

export function ShiftCalendar({ month, isRegistrationOpen }: ShiftCalendarProps) {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();

  const { data: shifts = [], isLoading } = useQuery<ShiftInstance[]>({
    queryKey: ['shifts', month],
    queryFn: () => api.get(`/shifts?month=${month}`).then((r) => r.data.data),
  });

  // Real-time slot count updates
  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();
    const handler = () => queryClient.invalidateQueries({ queryKey: ['shifts', month] });
    socket.on('registration.created', handler);
    socket.on('registration.canceled', handler);
    return () => {
      socket.off('registration.created', handler);
      socket.off('registration.canceled', handler);
    };
  }, [isAuthenticated, month, queryClient]);

  const registerMutation = useMutation({
    mutationFn: (shiftId: number) => api.post('/registrations', { shiftId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', month] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      toast({ title: 'Đăng ký thành công', description: 'Kiểm tra email để xác nhận ca trực.' });
    },
    onError: (err: any) => {
      toast({ title: 'Đăng ký thất bại', description: err?.response?.data?.message || err.message, variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      const reg = shifts.find((s) => s.id === shiftId);
      if (!reg?.userRegistrationId) return;
      await api.delete(`/registrations/${reg.userRegistrationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts', month] });
      queryClient.invalidateQueries({ queryKey: ['registrations'] });
      toast({ title: 'Đã hủy đăng ký' });
    },
    onError: (err: any) => {
      toast({ title: 'Hủy thất bại', description: err?.response?.data?.message || err.message, variant: 'destructive' });
    },
  });

  // Build calendar grid
  const [year, m] = month.split('-').map(Number);
  const daysInMonth = getDaysInMonth(new Date(year, m - 1));
  const firstDow = getDay(startOfMonth(new Date(year, m - 1))); // 0=Sun
  const firstDowMon = (firstDow + 6) % 7; // Mon=0

  const shiftsByDay = useMemo(() => {
    const map: Record<number, ShiftInstance[]> = {};
    for (const shift of shifts) {
      const day = new Date(shift.date).getUTCDate();
      if (!map[day]) map[day] = [];
      map[day].push(shift);
    }
    return map;
  }, [shifts]);

  const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      {/* Desktop: Grid calendar */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 border-l border-t">
          {weekDays.map((d) => (
            <div key={d} className="border-r border-b p-2 text-center text-xs font-semibold text-gray-500 bg-gray-50">
              {d}
            </div>
          ))}
          {Array.from({ length: firstDowMon }).map((_, i) => (
            <div key={`empty-${i}`} className="border-r border-b min-h-24 bg-gray-50/50" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayShifts = shiftsByDay[day] || [];
            const isToday = new Date().getUTCDate() === day && new Date().getUTCMonth() + 1 === m && new Date().getUTCFullYear() === year;
            return (
              <div key={day} className={cn('border-r border-b min-h-24 p-1', isToday && 'bg-blue-50/30')}>
                <span className={cn('text-xs font-medium block mb-1', isToday && 'text-blue-600 font-bold')}>
                  {day}
                </span>
                {dayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    isRegistrationOpen={isRegistrationOpen}
                    onRegister={(id) => registerMutation.mutate(id)}
                    onCancel={(id) => cancelMutation.mutate(id)}
                    isLoading={registerMutation.isPending || cancelMutation.isPending}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: List view */}
      <div className="md:hidden space-y-3">
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayShifts = shiftsByDay[day] || [];
          if (!dayShifts.length) return null;
          const date = new Date(Date.UTC(year, m - 1, day));
          return (
            <div key={day} className="bg-white rounded-lg border overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b">
                <p className="text-sm font-medium">{format(date, 'EEEE, dd/MM', { locale: vi })}</p>
              </div>
              <div className="p-3 space-y-2">
                {dayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    isRegistrationOpen={isRegistrationOpen}
                    onRegister={(id) => registerMutation.mutate(id)}
                    onCancel={(id) => cancelMutation.mutate(id)}
                    isLoading={registerMutation.isPending || cancelMutation.isPending}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
