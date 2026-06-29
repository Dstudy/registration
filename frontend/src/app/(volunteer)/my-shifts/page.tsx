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
import { ArrowLeftRight, Bell, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

const ATTENDANCE_LABEL: Record<string, { label: string; variant: any }> = {
  PRESENT: { label: 'Có mặt', variant: 'success' },
  LATE: { label: 'Đi muộn', variant: 'warning' },
  ABSENT: { label: 'Vắng', variant: 'danger' },
  FORGOT: { label: 'Quên', variant: 'warning' },
  UNCONFIRMED: { label: 'Chưa xác nhận', variant: 'secondary' },
};

// Format start/end time without timezone shift, matching the calendar's display.
function formatShiftTimeRange(reg: any) {
  const start = reg.shift?.startTime ? new Date(reg.shift.startTime) : null;
  const end = reg.shift?.endTime ? new Date(reg.shift.endTime) : null;
  if (!start || !end) return reg.shift?.shiftName ?? '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())} - ${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`;
}

function ShiftCard({
  reg,
  showAttendance,
  onRequest,
}: {
  reg: any;
  showAttendance?: boolean;
  onRequest?: () => void;
}) {
  const isPlace1 = reg.shift?.position === 'PLACE_1';
  const accent = isPlace1 ? 'bg-brand-blue' : 'bg-brand-red';
  const accentText = isPlace1 ? 'text-brand-blue' : 'text-brand-red';

  return (
    <div className={cn("rounded-bl-[50px] rounded-br-[50px] overflow-hidden border-2 shadow-sm", isPlace1 ? "border-brand-blue" : "border-brand-red")}>
      <div className={cn('relative flex items-center justify-center py-4 text-white', accent)}>
        <span className="text-base md:text-lg font-bold tracking-wide flex items-center gap-2">
          THƯ VIỆN DƯƠNG LIỄU {isPlace1 ? 'CƠ SỞ 1' : 'CƠ SỞ 2'}
        </span>
        <button
          type="button"
          className="flex items-center gap-1 text-xs md:text-sm font-medium hover:opacity-80 transition-opacity absolute right-5"
        >
          <Bell className="h-4 w-4" />
          Nhắc tôi!
        </button>
      </div>
      <div className="bg-white flex flex-wrap items-center justify-between">
        <div className={cn("flex flex-1 flex-wrap items-center justify-center gap-x-10 gap-y-3 border-r-2 py-6 px-4", isPlace1 ? "border-brand-blue" : "border-brand-red")}>
          <span className={cn('text-3xl md:text-4xl font-normal', accentText)}>
            {reg.shift?.date && format(new Date(reg.shift.date), 'dd/MM/yyyy')}
          </span>
          <span className="text-3xl md:text-4xl font-light text-gray-800">
            {formatShiftTimeRange(reg)}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center gap-2">
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
    </div>
  );
}

function RequestDialog({ shiftId, shiftName, onClose }: { shiftId: number; shiftName: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'SWAP' | 'SUBSTITUTE'>('SUBSTITUTE');

  // SWAP wizard state (shiftIdFrom is already known — start at partner search)
  const [swapStep, setSwapStep] = useState<1 | 2>(1);
  const [partner, setPartner] = useState<any | null>(null);
  const [partnerShift, setPartnerShift] = useState<any | null>(null);
  const [partnerSearch, setPartnerSearch] = useState('');

  const [receiverCode, setReceiverCode] = useState('');
  const [note, setNote] = useState('');

  const { data: candidates = [] } = useQuery({
    queryKey: ['swap-candidates', partnerSearch],
    queryFn: () => api.get(`/requests/swap/candidates?search=${encodeURIComponent(partnerSearch)}`).then((r) => r.data.data),
    enabled: type === 'SWAP' && swapStep === 1,
  });

  const { data: partnerShifts = [] } = useQuery({
    queryKey: ['swap-candidate-shifts', partner?.id],
    queryFn: () => api.get(`/requests/swap/candidates/${partner.id}/shifts`).then((r) => r.data.data),
    enabled: type === 'SWAP' && swapStep === 2 && !!partner,
  });

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
    if (type === 'SWAP') {
      if (!partner || !partnerShift) return;
      createMutation.mutate({
        type,
        shiftIdFrom: shiftId,
        shiftIdTo: partnerShift.id,
        receiverId: partner.id,
        note: note || undefined,
      });
    } else {
      createMutation.mutate({
        type,
        shiftIdFrom: shiftId,
        note: note || undefined,
        receiverCode,
      });
    }
  };

  const formatShift = (shift: any) =>
    `${shift.shiftName} — ${format(new Date(shift.date), 'EEEE dd/MM/yyyy', { locale: vi })} (${shift.position === 'PLACE_1' ? 'Vị trí 1' : 'Vị trí 2'})`;

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
                  onClick={() => { setType('SWAP'); setSwapStep(1); }}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${type === 'SWAP' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                >
                  Đổi ca
                </button>
              </div>
            </div>

            {type === 'SWAP' && (
              <div className="space-y-3">
                {swapStep === 1 && (
                  <div className="space-y-2">
                    <Label>Bước 1: Tìm người muốn đổi ca *</Label>
                    <Input
                      placeholder="Nhập tên hoặc mã TNV..."
                      value={partnerSearch}
                      onChange={(e) => setPartnerSearch(e.target.value)}
                    />
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {candidates.length === 0 && (
                        <p className="text-sm text-gray-500">Không tìm thấy tình nguyện viên phù hợp</p>
                      )}
                      {candidates.map((c: any) => (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => { setPartner(c); setPartnerShift(null); setSwapStep(2); }}
                          className="w-full text-left p-3 rounded-md border border-gray-200 hover:bg-gray-50 text-sm transition-colors"
                        >
                          <span className="font-medium">{c.fullname}</span>
                          <span className="text-gray-500"> ({c.ma_tnv})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {swapStep === 2 && (
                  <div className="space-y-2">
                    <Label>Bước 2: Chọn ca của {partner.fullname} muốn đổi *</Label>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {partnerShifts.length === 0 && (
                        <p className="text-sm text-gray-500">Người này không có ca trực sắp tới nào</p>
                      )}
                      {partnerShifts.map((reg: any) => (
                        <button
                          type="button"
                          key={reg.id}
                          onClick={() => setPartnerShift(reg.shift)}
                          className={`w-full text-left p-3 rounded-md border text-sm transition-colors ${partnerShift?.id === reg.shift.id ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          {formatShift(reg.shift)}
                        </button>
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSwapStep(1)}>
                      ← Quay lại
                    </Button>
                  </div>
                )}
              </div>
            )}

            {type === 'SUBSTITUTE' && (
              <div className="space-y-2">
                <Label htmlFor="receiverCode">Mã TNV thay thế *</Label>
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
              <Button
                type="submit"
                disabled={createMutation.isPending || (type === 'SWAP' && (!partner || !partnerShift))}
                className="flex-1"
              >
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
      <h1 className="text-2xl font-bold text-brand-blue">Ca trông của tôi</h1>

      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('upcoming')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'upcoming' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Sắp tới ({upcoming.length})
        </button>
        <button
          onClick={() => setTab('past')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${tab === 'past' ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          Đã qua ({past.length})
        </button>
      </div>

      {!data.length ? (
        <p className="text-center text-gray-500 py-8">Không có ca trực nào</p>
      ) : (
        <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto px-2 md:px-8">
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
