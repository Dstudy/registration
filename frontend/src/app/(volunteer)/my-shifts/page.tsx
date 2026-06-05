'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { ArrowLeftRight, CheckCircle, Clock, MapPin } from 'lucide-react';

const ATTENDANCE_LABEL: Record<string, { label: string; variant: any }> = {
  PRESENT: { label: 'Có mặt', variant: 'success' },
  LATE: { label: 'Đi muộn', variant: 'warning' },
  ABSENT: { label: 'Vắng', variant: 'danger' },
  FORGOT: { label: 'Quên', variant: 'warning' },
  UNCONFIRMED: { label: 'Chưa xác nhận', variant: 'secondary' },
};

function ShiftCard({
  reg,
  showAttendance,
  onRequest,
}: {
  reg: any;
  showAttendance?: boolean;
  onRequest?: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{reg.shift?.shiftName}</p>
              {reg.isConfirmed ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Clock className="h-4 w-4 text-yellow-500" />
              )}
            </div>
            <p className="text-sm text-gray-600">
              {reg.shift?.date && format(new Date(reg.shift.date), 'EEEE, dd/MM/yyyy', { locale: vi })}
            </p>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <MapPin className="h-3 w-3" />
              {reg.shift?.position === 'PLACE_1' ? 'Địa điểm 1' : 'Địa điểm 2'}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge variant={reg.isConfirmed ? 'success' : 'warning'}>
              {reg.isConfirmed ? 'Đã xác nhận' : 'Chờ xác nhận'}
            </Badge>
            {showAttendance && reg.attendance && (
              <Badge variant={ATTENDANCE_LABEL[reg.attendance.status]?.variant}>
                {ATTENDANCE_LABEL[reg.attendance.status]?.label}
              </Badge>
            )}
            {onRequest && (
              <Button size="sm" variant="outline" onClick={onRequest}>
                <ArrowLeftRight className="h-3 w-3 mr-1" />
                Yêu cầu
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RequestDialog({ shiftId, shiftName, onClose }: { shiftId: number; shiftName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'SWAP' | 'SUBSTITUTE'>('SUBSTITUTE');
  const [receiverCode, setReceiverCode] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [note, setNote] = useState('');

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/requests', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast({ title: 'Đã tạo yêu cầu thành công' });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể tạo yêu cầu';
      toast({ title: 'Lỗi', description: msg, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = { type, shiftIdFrom: shiftId, note: note || undefined };
    if (type === 'SWAP') {
      body.shiftIdTo = shiftId;
      body.receiverCode = receiverCode;
    } else {
      body.isPublic = isPublic;
      if (!isPublic) body.receiverCode = receiverCode;
    }
    createMutation.mutate(body);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tạo yêu cầu — {shiftName}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Loại yêu cầu</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('SUBSTITUTE')}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${type === 'SUBSTITUTE' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                >
                  Thay thế
                </button>
                <button
                  type="button"
                  onClick={() => setType('SWAP')}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${type === 'SWAP' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                >
                  Đổi ca
                </button>
              </div>
            </div>

            {type === 'SUBSTITUTE' && (
              <div className="flex items-center gap-2">
                <input
                  id="isPublic"
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isPublic">Đăng lên Chợ ca (công khai)</Label>
              </div>
            )}

            {(type === 'SWAP' || (type === 'SUBSTITUTE' && !isPublic)) && (
              <div className="space-y-2">
                <Label htmlFor="receiverCode">
                  {type === 'SWAP' ? 'Mã TNV cần đổi *' : 'Mã TNV thay thế *'}
                </Label>
                <Input
                  id="receiverCode"
                  placeholder="Ví dụ: B22DCPT002"
                  value={receiverCode}
                  onChange={(e) => setReceiverCode(e.target.value)}
                  required
                />
              </div>
            )}

<div className="space-y-2">
              <Label htmlFor="note">Ghi chú</Label>
              <Textarea
                id="note"
                placeholder="Lý do, ghi chú thêm..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createMutation.isPending} className="flex-1">
                {createMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function MyShiftsPage() {
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [requestingReg, setRequestingReg] = useState<any | null>(null);

  const { data: upcoming = [] } = useQuery({
    queryKey: ['registrations', 'upcoming'],
    queryFn: () => api.get('/registrations/my?upcoming=true').then((r) => r.data.data),
  });

  const { data: past = [] } = useQuery({
    queryKey: ['registrations', 'past'],
    queryFn: () => api.get('/registrations/my?upcoming=false').then((r) => r.data.data),
  });

  const data = tab === 'upcoming' ? upcoming : past;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Ca của tôi</h1>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('upcoming')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'upcoming' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Sắp tới ({upcoming.length})
        </button>
        <button
          onClick={() => setTab('past')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
            tab === 'past' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Đã qua ({past.length})
        </button>
      </div>

      {!data.length ? (
        <p className="text-center text-gray-500 py-8">Không có ca trực nào</p>
      ) : (
        <div className="space-y-3">
          {data.map((reg: any) => (
            <ShiftCard
              key={reg.id}
              reg={reg}
              showAttendance={tab === 'past'}
              onRequest={tab === 'upcoming' ? () => setRequestingReg(reg) : undefined}
            />
          ))}
        </div>
      )}

      {requestingReg && (
        <RequestDialog
          shiftId={requestingReg.shift?.id}
          shiftName={requestingReg.shift?.shiftName ?? ''}
          onClose={() => setRequestingReg(null)}
        />
      )}
    </div>
  );
}
