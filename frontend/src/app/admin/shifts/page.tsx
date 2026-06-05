'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { ChevronLeft, ChevronRight, Plus, Send } from 'lucide-react';

export default function AdminShiftsPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const { data } = useQuery({
    queryKey: ['admin', 'shifts', monthStr],
    queryFn: () =>
      api.get(`/shifts?month=${monthStr}`).then((r) => r.data.data),
  });

  const generateMutation = useMutation({
    mutationFn: () => api.post('/shifts/generate', { month: monthStr }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shifts', monthStr] });
      toast({ title: `Đã tạo lịch tháng ${month}/${year}` });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message || 'Không thể tạo lịch', variant: 'destructive' }),
  });

  const publishMutation = useMutation({
    mutationFn: () => api.post('/shifts/publish', { month: monthStr }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'shifts', monthStr] });
      toast({ title: `Đã công bố lịch tháng ${month}/${year}` });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message || 'Không thể công bố', variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/shifts/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'shifts', monthStr] }),
  });

  const shifts: any[] = Array.isArray(data) ? data : data?.shifts ?? [];
  const isPublished = shifts.length > 0 && shifts.every((s) => s.isPublished);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const shiftsByDate: Record<string, any[]> = {};
  shifts.forEach((s) => {
    const key = s.date.split('T')[0];
    if (!shiftsByDate[key]) shiftsByDate[key] = [];
    shiftsByDate[key].push(s);
  });

  const prevMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  const nextMonth = () => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Quản lý lịch trực</h1>
        <div className="flex gap-2">
          {!shifts.length ? (
            <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              {generateMutation.isPending ? 'Đang tạo...' : `Tạo lịch tháng ${month}`}
            </Button>
          ) : !isPublished ? (
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              <Send className="h-4 w-4 mr-1" />
              {publishMutation.isPending ? 'Đang công bố...' : 'Công bố lịch'}
            </Button>
          ) : (
            <Badge variant="default">Đã công bố</Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-base">
              {format(currentDate, 'MMMM yyyy', { locale: vi })}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500 mb-2">
            {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: getDay(monthStart) }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayShifts = shiftsByDate[key] || [];
              const isToday = key === format(new Date(), 'yyyy-MM-dd');
              return (
                <div
                  key={key}
                  className={`min-h-[80px] p-1 border rounded text-xs ${isToday ? 'border-blue-400 bg-blue-50' : 'border-gray-100'}`}
                >
                  <div className={`font-semibold mb-1 ${isToday ? 'text-blue-700' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>
                  {dayShifts.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => toggleMutation.mutate(s.id)}
                      title={s.isActive ? 'Nhấn để vô hiệu hóa' : 'Nhấn để kích hoạt'}
                      className={`block w-full text-left px-1 py-0.5 rounded mb-0.5 truncate transition-colors ${
                        s.isActive
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200 line-through'
                      }`}
                    >
                      {s.shiftName === 'Ca Sáng' ? 'CS' : s.shiftName === 'Ca Chiều' ? 'CC' : 'CT'} P{s.position === 'PLACE_1' ? '1' : '2'}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">Nhấn vào ca để bật/tắt. CS = Ca Sáng, CC = Ca Chiều, CT = Ca Tối, P1/P2 = Vị trí.</p>
        </CardContent>
      </Card>
    </div>
  );
}
