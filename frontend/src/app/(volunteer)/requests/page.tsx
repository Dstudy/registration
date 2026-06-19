'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
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
import {
  ArrowLeftRight,
  Plus,
  Check,
  X,
  Clock,
  Search,
  User,
  History,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; variant: 'info' | 'warning' | 'danger' | 'secondary' | 'default' }> = {
  PENDING: { label: 'Chờ duyệt', variant: 'warning' },
  ACCEPTED_BY_RECEIVER: { label: 'Đối phương chấp nhận', variant: 'info' },
  APPROVED_BY_BNS: { label: 'BNS đã duyệt', variant: 'default' },
  REJECTED: { label: 'Từ chối', variant: 'danger' },
  CANCELED: { label: 'Đã hủy', variant: 'secondary' },
};

const TYPE_LABEL: Record<string, string> = {
  SWAP: 'Đổi ca',
  SUBSTITUTE: 'Thay thế',
};

type Tab = 'sent' | 'received';
type ActiveView = 'swap' | 'substitute' | 'history';

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<ActiveView>('history');
  const [tab, setTab] = useState<Tab>('sent');

  const { user } = useAuthStore();

  const { data: myData } = useQuery({
    queryKey: ['requests', 'my'],
    queryFn: () => api.get('/requests/my').then((r) => r.data.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/requests/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] });
      toast({ title: 'Đã hủy yêu cầu' });
    },
    onError: () => toast({ title: 'Lỗi', description: 'Không thể hủy yêu cầu', variant: 'destructive' }),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/requests/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] });
      toast({ title: 'Đã chấp nhận yêu cầu' });
    },
    onError: () => toast({ title: 'Lỗi', description: 'Không thể chấp nhận yêu cầu', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/requests/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] });
      toast({ title: 'Đã từ chối yêu cầu' });
    },
    onError: () => toast({ title: 'Lỗi', description: 'Không thể từ chối yêu cầu', variant: 'destructive' }),
  });

  const allMyRequests: any[] = Array.isArray(myData) ? myData : myData?.requests ?? [];
  const sentRequests = allMyRequests.filter((r) => r.senderId === user?.id);
  const receivedRequests = allMyRequests.filter((r) => r.receiverId === user?.id);
  const requests = tab === 'sent' ? sentRequests : receivedRequests;

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t ? 'border-brand-blue text-brand-blue' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-blue">Yêu cầu ca trực</h1>
          <p className="text-xs text-gray-500 mt-1">Đổi ca trực hoặc tìm người trông hộ dễ dàng</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200 w-full sm:w-auto overflow-x-auto shrink-0 shadow-inner">
          <button
            onClick={() => setActiveView('swap')}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeView === 'swap'
                ? 'bg-white text-brand-blue shadow-sm border border-gray-100 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/50 font-medium'
            }`}
          >
            <ArrowLeftRight className="h-4 w-4" />
            Đổi ca (Swap)
          </button>
          <button
            onClick={() => setActiveView('substitute')}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeView === 'substitute'
                ? 'bg-white text-brand-blue shadow-sm border border-gray-100 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/50 font-medium'
            }`}
          >
            <Plus className="h-4 w-4" />
            Thay thế (Substitute)
          </button>
          <button
            onClick={() => setActiveView('history')}
            className={`flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
              activeView === 'history'
                ? 'bg-white text-brand-blue shadow-sm border border-gray-100 font-bold'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/50 font-medium'
            }`}
          >
            <History className="h-4 w-4" />
            Lịch sử (History)
          </button>
        </div>
      </div>

      {activeView === 'swap' && (
        <SwapRequestForm
          onSuccess={() => setActiveView('history')}
          onCancel={() => setActiveView('history')}
        />
      )}

      {activeView === 'substitute' && (
        <SubstituteRequestForm
          onSuccess={() => setActiveView('history')}
          onCancel={() => setActiveView('history')}
        />
      )}

      {activeView === 'history' && (
        <div className="space-y-4">
          <div className="border-b flex gap-0">
            <button className={tabClass('sent')} onClick={() => setTab('sent')}>
              Đã gửi
            </button>
            <button className={tabClass('received')} onClick={() => setTab('received')}>
              Đã nhận
            </button>
          </div>

          {!requests?.length ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ArrowLeftRight className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Không có yêu cầu nào trong danh sách này</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((req: any) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  tab={tab}
                  onCancel={() => cancelMutation.mutate(req.id)}
                  onAccept={() => acceptMutation.mutate(req.id)}
                  onReject={() => rejectMutation.mutate(req.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  req,
  tab,
  onCancel,
  onAccept,
  onReject,
}: {
  req: any;
  tab: Tab;
  onCancel: () => void;
  onAccept: () => void;
  onReject: () => void;
}) {
  const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded border border-blue-100">
                {TYPE_LABEL[req.type]}
              </span>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>

            {req.shiftFrom && (
              <div className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">Ca của bạn: </span>
                {req.shiftFrom.shiftName} — {format(new Date(req.shiftFrom.date), 'EEEE dd/MM/yyyy', { locale: vi })}
                {' '}({req.shiftFrom.position === 'PLACE_1' ? 'Vị trí 1' : 'Vị trí 2'})
              </div>
            )}
            {req.shiftTo && (
              <div className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">Ca đổi: </span>
                {req.shiftTo.shiftName} — {format(new Date(req.shiftTo.date), 'EEEE dd/MM/yyyy', { locale: vi })}
                {' '}({req.shiftTo.position === 'PLACE_1' ? 'Vị trí 1' : 'Vị trí 2'})
              </div>
            )}
            {req.sender && tab !== 'sent' && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span>Từ: <strong>{req.sender.fullname}</strong> ({req.sender.ma_tnv})</span>
              </p>
            )}
            {req.receiver && tab === 'sent' && (
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-gray-400" />
                <span>Gửi tới: <strong>{req.receiver.fullname}</strong> ({req.receiver.ma_tnv})</span>
              </p>
            )}
            {req.note && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100 italic">
                &quot;{req.note}&quot;
              </div>
            )}
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(req.createdAt), 'HH:mm dd/MM/yyyy', { locale: vi })}
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {tab === 'sent' && req.status === 'PENDING' && (
              <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={onCancel}>
                <X className="h-3.5 w-3.5 mr-1" /> Hủy
              </Button>
            )}
            {tab === 'received' && req.status === 'PENDING' && (
              <>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={onAccept}>
                  <Check className="h-3.5 w-3.5 mr-1" /> Chấp nhận
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={onReject}>
                  <X className="h-3.5 w-3.5 mr-1" /> Từ chối
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SwapRequestForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const [swapStep, setSwapStep] = useState<1 | 2 | 3>(1);
  const [ownShift, setOwnShift] = useState<any | null>(null);
  const [partner, setPartner] = useState<any | null>(null);
  const [partnerShift, setPartnerShift] = useState<any | null>(null);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [note, setNote] = useState('');

  const { data: ownShifts = [] } = useQuery({
    queryKey: ['registrations', 'upcoming'],
    queryFn: () => api.get('/registrations/my?upcoming=true').then((r) => r.data.data),
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['swap-candidates', partnerSearch],
    queryFn: () => api.get(`/requests/swap/candidates?search=${encodeURIComponent(partnerSearch)}`).then((r) => r.data.data),
    enabled: swapStep === 2,
  });

  const { data: partnerShifts = [] } = useQuery({
    queryKey: ['swap-candidate-shifts', partner?.id],
    queryFn: () => api.get(`/requests/swap/candidates/${partner.id}/shifts`).then((r) => r.data.data),
    enabled: swapStep === 3 && !!partner,
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/requests', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] });
      toast({ title: 'Đã tạo yêu cầu đổi ca thành công' });
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể tạo yêu cầu';
      toast({ title: 'Lỗi', description: msg, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownShift || !partner || !partnerShift) return;
    createMutation.mutate({
      type: 'SWAP',
      shiftIdFrom: ownShift.shift.id,
      shiftIdTo: partnerShift.id,
      receiverId: partner.id,
      note: note || undefined,
    });
  };

  const formatShift = (shift: any) =>
    `${shift.shiftName} — ${format(new Date(shift.date), 'EEEE dd/MM/yyyy', { locale: vi })} (${shift.position === 'PLACE_1' ? 'Vị trí 1' : 'Vị trí 2'})`;

  const steps = [
    { number: 1, label: 'Ca của bạn' },
    { number: 2, label: 'Người nhận' },
    { number: 3, label: 'Ca nhận' },
  ];

  return (
    <Card className="max-w-xl mx-auto shadow-md border-t-4 border-t-brand-blue">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-brand-blue flex items-center gap-2 justify-center">
          <ArrowLeftRight className="h-5 w-5 text-brand-blue" />
          Yêu cầu đổi ca trực (Swap)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step Indicator */}
        <div className="flex justify-between items-center mb-6 max-w-sm mx-auto">
          {steps.map((s, idx) => (
            <div key={s.number} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    swapStep >= s.number
                      ? 'bg-brand-blue text-white ring-4 ring-blue-100'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s.number}
                </div>
                <span
                  className={`text-xs font-bold hidden sm:inline ${
                    swapStep >= s.number ? 'text-brand-blue' : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 md:mx-4 transition-all ${
                    swapStep > s.number ? 'bg-brand-blue' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {swapStep === 1 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">Bước 1: Chọn ca của bạn muốn đổi *</Label>
              {!ownShifts.length ? (
                <p className="text-sm text-gray-500 py-6 text-center border border-dashed rounded-lg">
                  Bạn không có ca trực sắp tới nào để đổi.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {ownShifts.map((reg: any) => (
                    <button
                      type="button"
                      key={reg.id}
                      onClick={() => {
                        setOwnShift(reg);
                        setSwapStep(2);
                      }}
                      className={`w-full text-left p-3 rounded-md border text-sm transition-all flex justify-between items-center ${
                        ownShift?.id === reg.id
                          ? 'bg-blue-50/50 border-blue-500 text-blue-700 font-semibold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span>{formatShift(reg.shift)}</span>
                      <span className="text-xs text-blue-600 font-semibold hover:underline">Chọn →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {swapStep === 2 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold text-gray-700">Bước 2: Tìm người muốn đổi ca *</Label>
                <button
                  type="button"
                  onClick={() => setSwapStep(1)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Thay đổi ca của bạn
                </button>
              </div>
              <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100 text-xs text-gray-700 mb-2 flex justify-between items-center">
                <div>
                  <span className="font-bold text-blue-800">Ca của bạn:</span> {formatShift(ownShift.shift)}
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nhập tên hoặc mã TNV..."
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {candidates.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">Không tìm thấy tình nguyện viên phù hợp</p>
                ) : (
                  candidates.map((c: any) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setPartner(c);
                        setPartnerShift(null);
                        setSwapStep(3);
                      }}
                      className="w-full text-left p-3 rounded-md border border-gray-200 hover:bg-gray-50 text-sm transition-all flex justify-between items-center text-gray-750"
                    >
                      <div>
                        <span className="font-semibold text-gray-900">{c.fullname}</span>
                        <span className="text-gray-500 text-xs ml-1">({c.ma_tnv})</span>
                      </div>
                      <span className="text-xs text-blue-600 font-semibold hover:underline">Chọn →</span>
                    </button>
                  ))
                )}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setSwapStep(1)}>
                ← Quay lại bước 1
              </Button>
            </div>
          )}

          {swapStep === 3 && partner && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold text-gray-700">Bước 3: Chọn ca của {partner.fullname} muốn đổi *</Label>
                <button
                  type="button"
                  onClick={() => setSwapStep(2)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Thay đổi người nhận
                </button>
              </div>
              <div className="space-y-1 bg-blue-50/40 p-3 rounded-lg border border-blue-100 text-xs text-gray-750">
                <div><span className="font-bold text-blue-800">Ca của bạn:</span> {formatShift(ownShift.shift)}</div>
                <div><span className="font-bold text-blue-800">Người đổi:</span> {partner.fullname} ({partner.ma_tnv})</div>
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {partnerShifts.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center border rounded-md">
                    Người này không có ca trực sắp tới nào để đổi.
                  </p>
                ) : (
                  partnerShifts.map((reg: any) => (
                    <button
                      type="button"
                      key={reg.id}
                      onClick={() => setPartnerShift(reg.shift)}
                      className={`w-full text-left p-3 rounded-md border text-sm transition-all flex justify-between items-center ${
                        partnerShift?.id === reg.shift.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-755'
                      }`}
                    >
                      <span>{formatShift(reg.shift)}</span>
                      {partnerShift?.id === reg.shift.id ? (
                        <span className="text-xs text-blue-600 font-semibold">✓ Đã chọn</span>
                      ) : (
                        <span className="text-xs text-blue-600 font-semibold hover:underline">Chọn →</span>
                      )}
                    </button>
                  ))
                )}
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="swap-note" className="text-gray-700 font-semibold">Ghi chú (tùy chọn)</Label>
                <Textarea
                  id="swap-note"
                  placeholder="Lý do đổi ca, lời nhắn thêm..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2.5}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSwapStep(2)}>
                  ← Quay lại bước 2
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            {swapStep === 3 && (
              <Button
                type="submit"
                disabled={createMutation.isPending || !ownShift || !partner || !partnerShift}
                className="flex-1 bg-brand-blue hover:bg-brand-blue/90 font-bold"
              >
                {createMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu đổi ca'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel} className={swapStep === 3 ? 'flex-none' : 'flex-1'}>
              Hủy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SubstituteRequestForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const queryClient = useQueryClient();
  const [substituteStep, setSubstituteStep] = useState<1 | 2>(1);
  const [ownShift, setOwnShift] = useState<any | null>(null);
  const [partner, setPartner] = useState<any | null>(null);
  const [partnerSearch, setPartnerSearch] = useState('');
  const [note, setNote] = useState('');

  const { data: ownShifts = [] } = useQuery({
    queryKey: ['registrations', 'upcoming'],
    queryFn: () => api.get('/registrations/my?upcoming=true').then((r) => r.data.data),
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['swap-candidates', partnerSearch],
    queryFn: () => api.get(`/requests/swap/candidates?search=${encodeURIComponent(partnerSearch)}`).then((r) => r.data.data),
    enabled: substituteStep === 1,
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/requests', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] });
      toast({ title: 'Đã tạo yêu cầu thay thế thành công' });
      onSuccess();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể tạo yêu cầu';
      toast({ title: 'Lỗi', description: msg, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownShift || !partner) return;
    createMutation.mutate({
      type: 'SUBSTITUTE',
      shiftIdFrom: ownShift.shift.id,
      receiverId: partner.id,
      note: note || undefined,
    });
  };

  const formatShift = (shift: any) =>
    `${shift.shiftName} — ${format(new Date(shift.date), 'EEEE dd/MM/yyyy', { locale: vi })} (${shift.position === 'PLACE_1' ? 'Vị trí 1' : 'Vị trí 2'})`;

  const steps = [
    { number: 1, label: 'Người trông hộ' },
    { number: 2, label: 'Ca của bạn' },
  ];

  return (
    <Card className="max-w-xl mx-auto shadow-md border-t-4 border-t-brand-blue">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-brand-blue flex items-center gap-2 justify-center">
          <Plus className="h-5 w-5 text-brand-blue" />
          Yêu cầu trông hộ / Thay thế (Substitute)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step Indicator */}
        <div className="flex justify-between items-center mb-6 max-w-xs mx-auto">
          {steps.map((s, idx) => (
            <div key={s.number} className="flex items-center flex-1 last:flex-none">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    substituteStep >= s.number
                      ? 'bg-brand-blue text-white ring-4 ring-blue-100'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {s.number}
                </div>
                <span
                  className={`text-xs font-bold hidden sm:inline ${
                    substituteStep >= s.number ? 'text-brand-blue' : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 md:mx-4 transition-all ${
                    substituteStep > s.number ? 'bg-brand-blue' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {substituteStep === 1 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-gray-700">Bước 1: Tìm người thay thế (trông hộ) *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Nhập tên hoặc mã TNV..."
                  value={partnerSearch}
                  onChange={(e) => setPartnerSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {candidates.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">Không tìm thấy tình nguyện viên phù hợp</p>
                ) : (
                  candidates.map((c: any) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => {
                        setPartner(c);
                        setOwnShift(null);
                        setSubstituteStep(2);
                      }}
                      className="w-full text-left p-3 rounded-md border border-gray-200 hover:bg-gray-50 text-sm transition-all flex justify-between items-center text-gray-750"
                    >
                      <div>
                        <span className="font-semibold text-gray-900">{c.fullname}</span>
                        <span className="text-gray-500 text-xs ml-1">({c.ma_tnv})</span>
                      </div>
                      <span className="text-xs text-blue-600 font-semibold hover:underline">Chọn →</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {substituteStep === 2 && partner && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-semibold text-gray-700">Bước 2: Chọn ca của bạn muốn người đó trông hộ *</Label>
                <button
                  type="button"
                  onClick={() => setSubstituteStep(1)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Thay đổi người trông hộ
                </button>
              </div>
              <div className="bg-blue-50/40 p-3 rounded-lg border border-blue-100 text-xs text-gray-755 mb-2 flex justify-between items-center">
                <div>
                  <span className="font-bold text-blue-800">Người trông hộ:</span> {partner.fullname} ({partner.ma_tnv})
                </div>
              </div>
              {!ownShifts.length ? (
                <p className="text-sm text-gray-500 py-6 text-center border border-dashed rounded-lg">
                  Bạn không có ca trực sắp tới nào.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {ownShifts.map((reg: any) => (
                    <button
                      type="button"
                      key={reg.id}
                      onClick={() => setOwnShift(reg)}
                      className={`w-full text-left p-3 rounded-md border text-sm transition-all flex justify-between items-center ${
                        ownShift?.id === reg.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700 font-semibold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span>{formatShift(reg.shift)}</span>
                      {ownShift?.id === reg.id ? (
                        <span className="text-xs text-blue-600 font-semibold">✓ Đã chọn</span>
                      ) : (
                        <span className="text-xs text-blue-600 font-semibold hover:underline">Chọn →</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2 pt-2">
                <Label htmlFor="sub-note" className="text-gray-750 font-semibold">Ghi chú (tùy chọn)</Label>
                <Textarea
                  id="sub-note"
                  placeholder="Lý do nhờ trông hộ, lời nhắn thêm..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2.5}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSubstituteStep(1)}>
                  ← Quay lại bước 1
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            {substituteStep === 2 && (
              <Button
                type="submit"
                disabled={createMutation.isPending || !ownShift || !partner}
                className="flex-1 bg-brand-blue hover:bg-brand-blue/90 font-bold"
              >
                {createMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu thay thế'}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel} className={substituteStep === 2 ? 'flex-none' : 'flex-1'}>
              Hủy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

