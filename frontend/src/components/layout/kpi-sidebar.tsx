'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSocket } from '@/providers/socket-provider';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AlertTriangle, TrendingDown, Calendar, Users, Search, X } from 'lucide-react';
import api from '@/lib/api';
import { getDefaultKpiMonth } from '@/lib/utils';

interface KpiEntry {
  id: number;
  ma_tnv: string;
  fullname: string;
  shiftCount: number;
  minShifts: number;
}

interface Volunteer {
  id: number;
  ma_tnv: string;
  fullname: string;
  status: string;
}

export function KpiSidebar() {
  const socket = useSocket();
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(getDefaultKpiMonth());
  const [activeTab, setActiveTab] = useState<'kpi' | 'registered'>('kpi');
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: kpiData, refetch } = useQuery<KpiEntry[]>({
    queryKey: ['kpi', 'list', selectedMonth],
    queryFn: () =>
      api.get('/admin/kpi', { params: { month: selectedMonth } }).then((r) =>
        Array.isArray(r.data.data) ? r.data.data : (r.data.data.volunteers as KpiEntry[])
      ),
    refetchInterval: 60_000,
  });

  const { data: volunteersData } = useQuery<{ volunteers: Volunteer[] }>({
    queryKey: ['admin', 'volunteers', 'all'],
    queryFn: () => api.get('/admin/volunteers').then((r) => r.data.data),
    enabled: activeTab === 'registered',
  });

  const { data: monthlyShifts = [] } = useQuery<any[]>({
    queryKey: ['admin', 'assignments', selectedMonth],
    queryFn: () => api.get(`/shifts?month=${selectedMonth}`).then((r) => r.data.data),
    enabled: activeTab === 'registered',
  });

  useEffect(() => {
    if (!socket) return;
    const handler = (payload: { volunteers: KpiEntry[]; updatedId?: number }) => {
      refetch();
      if (payload.updatedId) {
        setHighlighted(payload.updatedId);
        setTimeout(() => setHighlighted(null), 2000);
      }
    };
    socket.on('kpi.updated', handler);
    return () => {
      socket.off('kpi.updated', handler);
    };
  }, [socket, refetch]);

  // Dispatch custom window event when volunteer selected/unselected so assignments page highlights shifts
  const handleSelectVolunteer = (volId: number) => {
    const nextId = selectedVolunteerId === volId ? null : volId;
    setSelectedVolunteerId(nextId);
    window.dispatchEvent(
      new CustomEvent('selectVolunteerForHighlight', { detail: { volunteerId: nextId } })
    );
  };

  const atRisk = kpiData?.filter((v) => v.shiftCount < v.minShifts) ?? [];
  const volunteersList: Volunteer[] = volunteersData?.volunteers ?? [];

  // Calculate registered shifts count per volunteer
  const volunteerShiftCountMap = new Map<number, number>();
  monthlyShifts.forEach((s) => {
    s.registrations?.forEach((reg: any) => {
      const uId = reg.userId ?? reg.user?.id;
      if (uId) {
        volunteerShiftCountMap.set(uId, (volunteerShiftCountMap.get(uId) || 0) + 1);
      }
    });
  });

  // Filter volunteers who have registered shifts in current month
  const registeredVolunteers = volunteersList.filter((v) => {
    const count = volunteerShiftCountMap.get(v.id) || 0;
    if (count === 0) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return v.fullname.toLowerCase().includes(q) || v.ma_tnv.toLowerCase().includes(q);
  });

  return (
    <aside className="hidden xl:flex flex-col w-72 bg-white border-l min-h-screen">
      {/* Header Tabs */}
      <div className="flex border-b bg-gray-50/80">
        <button
          className={`flex-1 py-3 px-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'kpi'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('kpi')}
        >
          <TrendingDown className="h-3.5 w-3.5 text-orange-500" />
          KPI TNV
        </button>
        <button
          className={`flex-1 py-3 px-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors border-b-2 ${
            activeTab === 'registered'
              ? 'border-blue-600 text-blue-600 bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('registered')}
        >
          <Users className="h-3.5 w-3.5 text-blue-500" />
          TNV đã đăng ký ({registeredVolunteers.length})
        </button>
      </div>

      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between gap-2 bg-gray-50 p-2 rounded-md border border-gray-200">
          <label htmlFor="kpi-month-picker" className="text-xs text-gray-500 font-medium shrink-0 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            Tháng:
          </label>
          <input
            id="kpi-month-picker"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="text-xs bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium text-gray-700 cursor-pointer"
          />
        </div>

        {activeTab === 'kpi' && atRisk.length > 0 && (
          <p className="text-xs text-orange-600 font-medium flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {atRisk.length} TNV chưa đạt tối thiểu
          </p>
        )}

        {activeTab === 'registered' && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Tìm tên hoặc mã TNV..."
              className="pl-8 text-xs h-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'kpi' && (
          !kpiData?.length ? (
            <p className="text-xs text-gray-400 p-4 text-center">Không có dữ liệu</p>
          ) : (
            <ul className="divide-y">
              {kpiData.map((v) => {
                const isBelowMin = v.shiftCount < v.minShifts;
                const isNew = highlighted === v.id;
                const isSelected = selectedVolunteerId === v.id;
                return (
                  <li
                    key={v.id}
                    onClick={() => handleSelectVolunteer(v.id)}
                    className={`px-4 py-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-100/80 border-l-4 border-amber-500 font-semibold'
                        : isNew
                        ? 'bg-yellow-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{v.fullname}</p>
                        <p className="text-xs text-gray-400">{v.ma_tnv}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isBelowMin && (
                          <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
                        )}
                        <Badge variant={isBelowMin ? 'warning' : 'default'}>
                          {v.shiftCount}/{v.minShifts}
                        </Badge>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {activeTab === 'registered' && (
          !registeredVolunteers.length ? (
            <p className="text-xs text-gray-400 p-4 text-center">
              {searchQuery ? 'Không tìm thấy TNV phù hợp' : 'Chưa có TNV nào đăng ký trong tháng này'}
            </p>
          ) : (
            <ul className="divide-y">
              {registeredVolunteers.map((v) => {
                const count = volunteerShiftCountMap.get(v.id) || 0;
                const isSelected = selectedVolunteerId === v.id;
                return (
                  <li
                    key={v.id}
                    onClick={() => handleSelectVolunteer(v.id)}
                    className={`px-4 py-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-100/90 border-l-4 border-amber-500 font-semibold'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{v.fullname}</p>
                        <p className="text-xs text-gray-400">{v.ma_tnv}</p>
                      </div>
                      <Badge variant={isSelected ? 'default' : 'secondary'} className="shrink-0 text-xs">
                        {count} ca
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </div>
    </aside>
  );
}
