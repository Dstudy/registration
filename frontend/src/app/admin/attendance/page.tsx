'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Có mặt' },
  { value: 'LATE', label: 'Đi trễ' },
  { value: 'ABSENT', label: 'Vắng mặt' },
  { value: 'FORGOT', label: 'Quên điểm danh' },
  { value: 'UNCONFIRMED', label: 'Chưa xác nhận' },
];

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'danger' | 'warning' | 'info'> = {
  PRESENT: 'default',
  LATE: 'warning',
  ABSENT: 'danger',
  FORGOT: 'secondary',
  UNCONFIRMED: 'secondary',
};

export default function AdminAttendancePage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');

  const { data } = useQuery({
    queryKey: ['admin', 'attendance', selectedDate],
    queryFn: () =>
      api.get(`/admin/attendance?date=${selectedDate}`).then((r) => r.data.data),
    enabled: !!selectedDate,
  });

  const overrideMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: string; note: string }) =>
      api.patch(`/attendance/${id}/override`, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'attendance', selectedDate] });
      toast({ title: 'Đã cập nhật điểm danh' });
      setEditingId(null);
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const records: any[] = data?.records ?? [];

  const startEdit = (rec: any) => {
    setEditingId(rec.id);
    setEditStatus(rec.status);
    setEditNote(rec.note || '');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Quản lý điểm danh</h1>

      <div className="flex items-center gap-4">
        <div className="space-y-1">
          <Label htmlFor="date">Ngày</Label>
          <Input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            Không có dữ liệu điểm danh cho ngày này
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {records.map((rec) => (
            <Card key={rec.id}>
              <CardContent className="p-4">
                {editingId === rec.id ? (
                  <div className="space-y-3">
                    <p className="font-medium text-sm">
                      {rec.user?.fullname} ({rec.user?.ma_tnv}) —{' '}
                      {rec.shift?.shiftName} {rec.shift?.position === 'PLACE_1' ? 'P1' : 'P2'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setEditStatus(opt.value)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                            editStatus === opt.value
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-gray-200 text-gray-600 hover:border-blue-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <Textarea
                      placeholder="Ghi chú..."
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      rows={2}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => overrideMutation.mutate({ id: rec.id, status: editStatus, note: editNote })}
                        disabled={overrideMutation.isPending}
                      >
                        Lưu
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        Hủy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">
                        {rec.user?.fullname}{' '}
                        <span className="text-gray-400 font-normal">({rec.user?.ma_tnv})</span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {rec.shift?.shiftName} — {rec.shift?.position === 'PLACE_1' ? 'Vị trí 1' : 'Vị trí 2'}
                      </p>
                      {rec.note && <p className="text-xs text-gray-400 italic mt-0.5">"{rec.note}"</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={STATUS_VARIANT[rec.status] ?? 'secondary'}>
                        {STATUS_OPTIONS.find((o) => o.value === rec.status)?.label ?? rec.status}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => startEdit(rec)}>
                        Sửa
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
