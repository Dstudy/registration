'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSocket } from '@/providers/socket-provider';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown } from 'lucide-react';
import api from '@/lib/api';

interface KpiEntry {
  id: number;
  ma_tnv: string;
  fullname: string;
  shiftCount: number;
  minShifts: number;
}

export function KpiSidebar() {
  const socket = useSocket();
  const [highlighted, setHighlighted] = useState<number | null>(null);

  const { data, refetch } = useQuery<KpiEntry[]>({
    queryKey: ['kpi', 'list'],
    queryFn: () => api.get('/admin/kpi').then((r) => (Array.isArray(r.data.data) ? r.data.data : r.data.data.volunteers) as KpiEntry[]),
    refetchInterval: 60_000,
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
    return () => { socket.off('kpi.updated', handler); };
  }, [socket, refetch]);

  const atRisk = data?.filter((v) => v.shiftCount < v.minShifts) ?? [];

  return (
    <aside className="hidden xl:flex flex-col w-72 bg-white border-l min-h-screen">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-sm text-gray-700">KPI tháng này</span>
        </div>
        {atRisk.length > 0 && (
          <p className="text-xs text-orange-600 mt-1">
            {atRisk.length} TNV chưa đạt tối thiểu
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!data?.length ? (
          <p className="text-xs text-gray-400 p-4 text-center">Không có dữ liệu</p>
        ) : (
          <ul className="divide-y">
            {data.map((v) => {
              const isBelowMin = v.shiftCount < v.minShifts;
              const isNew = highlighted === v.id;
              return (
                <li
                  key={v.id}
                  className={`px-4 py-3 transition-colors ${isNew ? 'bg-yellow-50' : ''}`}
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
        )}
      </div>
    </aside>
  );
}
