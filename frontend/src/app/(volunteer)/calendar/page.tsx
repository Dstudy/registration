'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addMonths, subMonths, parseISO, getDate } from 'date-fns';
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
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(
    getDate(today) >= 20 ? addMonths(today, 1) : today
  );
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
    <div className="flex flex-col h-full gap-4">
      {/* Month navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-brand-blue">Đăng ký trông thư viện</h1>
          <div className="flex items-center gap-2 mt-1">
            {isRegistrationOpen ? (
              <Badge variant="success">Đăng ký đang mở</Badge>
            ) : (
              <Badge variant="secondary">Ngoài thời gian đăng ký</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-start gap-2 bg-gray-50 sm:bg-transparent p-2 sm:p-0 rounded-lg border sm:border-0 border-gray-200">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            disabled={isRegistrationOpen}
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm sm:text-base min-w-28 sm:min-w-32 text-center capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: vi })}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            disabled={isRegistrationOpen}
            className="h-8 w-8 sm:h-10 sm:w-10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-0">
        <ShiftCalendar month={month} isRegistrationOpen={isRegistrationOpen} />
      </div>
    </div>
  );
}
