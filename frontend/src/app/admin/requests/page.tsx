'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Check, X, AlertTriangle } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = { SWAP: 'Đổi ca', SUBSTITUTE: 'Thay thế' };
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ TNV',
  ACCEPTED_BY_RECEIVER: 'TNV chấp nhận',
  APPROVED_BY_BNS: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELED: 'Đã hủy',
};

export default function AdminRequestsPage() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['admin', 'requests'],
    queryFn: () => api.get('/requests/admin/all').then((r) => r.data.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/requests/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['kpi'] });
      toast({ title: 'Đã duyệt yêu cầu' });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/requests/${id}/admin-reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'requests'] });
      toast({ title: 'Đã từ chối yêu cầu' });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const requests: any[] = Array.isArray(data) ? data : data?.requests ?? [];
  const pending = requests.filter((r) => r.status === 'ACCEPTED_BY_RECEIVER');
  const other = requests.filter((r) => r.status !== 'ACCEPTED_BY_RECEIVER');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Duyệt yêu cầu</h1>

      {pending.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Không có yêu cầu chờ duyệt
          </CardContent>
        </Card>
      )}

      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
            Chờ duyệt ({pending.length})
          </h2>
          {pending.map((req) => (
            <RequestRow
              key={req.id}
              req={req}
              showActions
              onApprove={() => approveMutation.mutate(req.id)}
              onReject={() => rejectMutation.mutate(req.id)}
            />
          ))}
        </div>
      )}

      {other.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Lịch sử</h2>
          {other.map((req) => (
            <RequestRow key={req.id} req={req} showActions={false} />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({
  req,
  showActions,
  onApprove,
  onReject,
}: {
  req: any;
  showActions: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                {TYPE_LABEL[req.type]}
              </span>
              <span className="text-xs text-gray-500">{STATUS_LABEL[req.status]}</span>
            </div>
            {req.shiftFrom && (
              <p className="text-sm text-gray-700">
                <span className="font-medium">{req.sender?.fullname}</span> ({req.sender?.ma_tnv}) —{' '}
                {req.shiftFrom.shiftName}{' '}
                {format(new Date(req.shiftFrom.date), 'dd/MM/yyyy', { locale: vi })}
              </p>
            )}
            {req.shiftTo && req.receiver && (
              <p className="text-sm text-gray-700">
                ↔ <span className="font-medium">{req.receiver?.fullname}</span> ({req.receiver?.ma_tnv}) —{' '}
                {req.shiftTo.shiftName}{' '}
                {format(new Date(req.shiftTo.date), 'dd/MM/yyyy', { locale: vi })}
              </p>
            )}
            {req.kpiWarnings?.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 rounded px-2 py-1 mt-1">
                <AlertTriangle className="h-3 w-3" />
                <span>{req.kpiWarnings.join(', ')} có thể không đạt KPI tháng này sau khi duyệt</span>
              </div>
            )}
            <p className="text-xs text-gray-400">
              {format(new Date(req.createdAt), 'HH:mm dd/MM/yyyy', { locale: vi })}
            </p>
          </div>
          {showActions && (
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={onApprove}>
                <Check className="h-3 w-3 mr-1" /> Duyệt
              </Button>
              <Button size="sm" variant="outline" onClick={onReject}>
                <X className="h-3 w-3 mr-1" /> Từ chối
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
