'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addMonths, subMonths, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShiftCalendar } from '@/components/volunteer/shift-calendar';
import api from '@/lib/api';

interface RegistrationStatus {
  isOpen: boolean;
  targetMonth: string;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = format(currentDate, 'yyyy-MM');

  const { data: status } = useQuery<RegistrationStatus>({
    queryKey: ['registration-status'],
    queryFn: () => api.get('/registrations/status').then((r) => r.data.data),
    refetchInterval: 60_000,
  });

  const isRegistrationOpen = status?.isOpen ?? false;
  const targetMonth = status?.targetMonth;

  // Lock calendar to the registration target month when registration is open
  useEffect(() => {
    if (isRegistrationOpen && targetMonth) {
      setCurrentDate(parseISO(`${targetMonth}-01`));
    }
  }, [isRegistrationOpen, targetMonth]);

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch trực</h1>
          <div className="flex items-center gap-2 mt-1">
            {isRegistrationOpen ? (
              <Badge variant="success">Đăng ký đang mở</Badge>
            ) : (
              <Badge variant="secondary">Ngoài thời gian đăng ký</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            disabled={isRegistrationOpen}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold min-w-32 text-center">
            {format(currentDate, 'MMMM yyyy', { locale: vi })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            disabled={isRegistrationOpen}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="hidden md:flex items-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-300" />
          <span>Thiếu người (&lt;2)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          <span>Bình thường (2–4)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-200" />
          <span>Đã đầy (5)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-300" />
          <span>Đã đăng ký</span>
        </div>
      </div>

      {/* Calendar */}
      <ShiftCalendar month={month} isRegistrationOpen={isRegistrationOpen} />
    </div>
  );
}
