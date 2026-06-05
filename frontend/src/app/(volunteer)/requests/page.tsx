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
  ShoppingBag,
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

type Tab = 'sent' | 'received' | 'marketplace';

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('sent');
  const [showCreate, setShowCreate] = useState(false);

  const { user } = useAuthStore();

  const { data: myData } = useQuery({
    queryKey: ['requests', 'my'],
    queryFn: () => api.get('/requests/my').then((r) => r.data.data),
  });

  const { data: marketplaceData } = useQuery({
    queryKey: ['requests', 'marketplace'],
    queryFn: () => api.get('/requests/marketplace').then((r) => r.data.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/requests/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] }); queryClient.invalidateQueries({ queryKey: ['requests', 'marketplace'] });
      toast({ title: 'Đã hủy yêu cầu' });
    },
    onError: () => toast({ title: 'Lỗi', description: 'Không thể hủy yêu cầu', variant: 'destructive' }),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/requests/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] }); queryClient.invalidateQueries({ queryKey: ['requests', 'marketplace'] });
      toast({ title: 'Đã chấp nhận yêu cầu' });
    },
    onError: () => toast({ title: 'Lỗi', description: 'Không thể chấp nhận yêu cầu', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/requests/${id}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] }); queryClient.invalidateQueries({ queryKey: ['requests', 'marketplace'] });
      toast({ title: 'Đã từ chối yêu cầu' });
    },
    onError: () => toast({ title: 'Lỗi', description: 'Không thể từ chối yêu cầu', variant: 'destructive' }),
  });

  const takeSubMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/requests/${id}/take`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] }); queryClient.invalidateQueries({ queryKey: ['requests', 'marketplace'] });
      toast({ title: 'Đã nhận ca thay thế' });
    },
    onError: () => toast({ title: 'Lỗi', description: 'Không thể nhận ca', variant: 'destructive' }),
  });

  const allMyRequests: any[] = Array.isArray(myData) ? myData : myData?.requests ?? [];
  const sentRequests = allMyRequests.filter((r) => r.senderId === user?.id);
  const receivedRequests = allMyRequests.filter((r) => r.receiverId === user?.id);
  const marketplaceRequests: any[] = Array.isArray(marketplaceData) ? marketplaceData : marketplaceData?.requests ?? [];
  const requests = tab === 'sent' ? sentRequests : tab === 'received' ? receivedRequests : marketplaceRequests;

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Yêu cầu ca trực</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Tạo yêu cầu
        </Button>
      </div>

      <div className="border-b flex gap-0">
        <button className={tabClass('sent')} onClick={() => setTab('sent')}>
          Đã gửi
        </button>
        <button className={tabClass('received')} onClick={() => setTab('received')}>
          Đã nhận
        </button>
        <button className={tabClass('marketplace')} onClick={() => setTab('marketplace')}>
          <ShoppingBag className="inline h-4 w-4 mr-1" />
          Chợ ca
        </button>
      </div>

      {!requests?.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ArrowLeftRight className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {tab === 'marketplace' ? 'Không có yêu cầu thay thế công khai' : 'Không có yêu cầu nào'}
            </p>
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
              onTake={() => takeSubMutation.mutate(req.id)}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateRequestDialog onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function RequestCard({
  req,
  tab,
  onCancel,
  onAccept,
  onReject,
  onTake,
}: {
  req: any;
  tab: Tab;
  onCancel: () => void;
  onAccept: () => void;
  onReject: () => void;
  onTake: () => void;
}) {
  const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                {TYPE_LABEL[req.type]}
              </span>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>

            {req.shiftFrom && (
              <div className="text-sm text-gray-700">
                <span className="font-medium">Ca của bạn: </span>
                {req.shiftFrom.shiftName} — {format(new Date(req.shiftFrom.date), 'EEEE dd/MM/yyyy', { locale: vi })}
                {' '}({req.shiftFrom.position === 'PLACE_1' ? 'Vị trí 1' : 'Vị trí 2'})
              </div>
            )}
            {req.shiftTo && (
              <div className="text-sm text-gray-700">
                <span className="font-medium">Ca đổi: </span>
                {req.shiftTo.shiftName} — {format(new Date(req.shiftTo.date), 'EEEE dd/MM/yyyy', { locale: vi })}
                {' '}({req.shiftTo.position === 'PLACE_1' ? 'Vị trí 1' : 'Vị trí 2'})
              </div>
            )}
            {req.sender && tab !== 'sent' && (
              <p className="text-xs text-gray-500">Từ: {req.sender.fullname} ({req.sender.ma_tnv})</p>
            )}
            {req.receiver && tab === 'sent' && (
              <p className="text-xs text-gray-500">Gửi tới: {req.receiver.fullname} ({req.receiver.ma_tnv})</p>
            )}
            {req.note && <p className="text-xs text-gray-500 italic">&quot;{req.note}&quot;</p>}
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(req.createdAt), 'HH:mm dd/MM/yyyy', { locale: vi })}
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {tab === 'sent' && req.status === 'PENDING' && (
              <Button size="sm" variant="outline" onClick={onCancel}>
                <X className="h-3 w-3 mr-1" /> Hủy
              </Button>
            )}
            {tab === 'received' && req.status === 'PENDING' && (
              <>
                <Button size="sm" onClick={onAccept}>
                  <Check className="h-3 w-3 mr-1" /> Chấp nhận
                </Button>
                <Button size="sm" variant="outline" onClick={onReject}>
                  <X className="h-3 w-3 mr-1" /> Từ chối
                </Button>
              </>
            )}
            {tab === 'marketplace' && req.status === 'PENDING' && (
              <Button size="sm" onClick={onTake}>
                Nhận ca
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateRequestDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<'SWAP' | 'SUBSTITUTE'>('SWAP');
  const [shiftIdFrom, setShiftIdFrom] = useState('');
  const [shiftIdTo, setShiftIdTo] = useState('');
  const [receiverCode, setReceiverCode] = useState('');
  const [note, setNote] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/requests', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'my'] }); queryClient.invalidateQueries({ queryKey: ['requests', 'marketplace'] });
      toast({ title: 'Đã tạo yêu cầu' });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Không thể tạo yêu cầu';
      toast({ title: 'Lỗi', description: msg, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = {
      type,
      shiftIdFrom: parseInt(shiftIdFrom),
      note: note || undefined,
    };
    if (type === 'SWAP') {
      body.shiftIdTo = parseInt(shiftIdTo);
      if (receiverCode) body.receiverCode = receiverCode;
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
          <CardTitle>Tạo yêu cầu ca trực</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Loại yêu cầu</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('SWAP')}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${type === 'SWAP' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                >
                  Đổi ca
                </button>
                <button
                  type="button"
                  onClick={() => setType('SUBSTITUTE')}
                  className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${type === 'SUBSTITUTE' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                >
                  Thay thế
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shiftIdFrom">ID ca của bạn *</Label>
              <Input
                id="shiftIdFrom"
                type="number"
                placeholder="ID ca trực của bạn"
                value={shiftIdFrom}
                onChange={(e) => setShiftIdFrom(e.target.value)}
                required
              />
            </div>

            {type === 'SWAP' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="shiftIdTo">ID ca muốn đổi *</Label>
                  <Input
                    id="shiftIdTo"
                    type="number"
                    placeholder="ID ca trực muốn đổi"
                    value={shiftIdTo}
                    onChange={(e) => setShiftIdTo(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="receiverCodeSwap">Mã TNV người nhận</Label>
                  <Input
                    id="receiverCodeSwap"
                    placeholder="Ví dụ: B22DCPT002"
                    value={receiverCode}
                    onChange={(e) => setReceiverCode(e.target.value)}
                  />
                </div>
              </>
            )}

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

            {type === 'SUBSTITUTE' && !isPublic && (
              <div className="space-y-2">
                <Label htmlFor="receiverCode">Mã TNV thay thế</Label>
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
