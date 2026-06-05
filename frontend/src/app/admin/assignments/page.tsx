'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { ChevronLeft, ChevronRight, Users, Search, X, Plus, CheckCircle, Clock, Loader2, Trash2, FileDown } from 'lucide-react';

interface Shift {
  id: number;
  date: string;
  shiftName: string;
  position: 'PLACE_1' | 'PLACE_2';
  maxSlots: number;
  isActive: boolean;
  registrationCount: number;
}

interface Registration {
  id: number;
  isConfirmed: boolean;
  user: { id: number; ma_tnv: string; fullname: string };
}

interface ShiftDetail extends Shift {
  registrations: Registration[];
}

interface Volunteer {
  id: number;
  ma_tnv: string;
  fullname: string;
  status: string;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function shiftLabel(s: Shift) {
  const name = s.shiftName === 'Ca Sáng' ? 'CS' : s.shiftName === 'Ca Chiều' ? 'CC' : 'CT';
  return `${name} ${s.position === 'PLACE_1' ? 'P1' : 'P2'}`;
}

export default function AssignmentsPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addingCode, setAddingCode] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [exportingPos, setExportingPos] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ['admin', 'assignments', monthStr],
    queryFn: () => api.get(`/shifts?month=${monthStr}`).then((r) => r.data.data),
  });

  const { data: shiftDetail, isLoading: loadingDetail } = useQuery<ShiftDetail>({
    queryKey: ['admin', 'shift-detail', selectedShiftId],
    queryFn: () => api.get(`/shifts/${selectedShiftId}`).then((r) => r.data.data),
    enabled: !!selectedShiftId,
  });

  const { data: searchData, isLoading: searching } = useQuery({
    queryKey: ['admin', 'volunteers', 'search', searchQuery],
    queryFn: () =>
      api
        .get(`/admin/volunteers?search=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.data.data),
    enabled: searchQuery.length >= 2,
  });

  const volunteers: Volunteer[] = searchData?.volunteers ?? [];

  const assignMutation = useMutation({
    mutationFn: ({ shiftId, code }: { shiftId: number; code: string }) =>
      api.post('/admin/assignments', { shiftId, codes: [code] }).then((r) => r.data.data),
    onSuccess: (data: any) => {
      if (data.added > 0) {
        toast({ title: 'Đã thêm TNV vào ca trực' });
      } else {
        const reason = data.results?.[0]?.message ?? 'Không thể thêm TNV';
        toast({ title: 'Lỗi', description: reason, variant: 'destructive' });
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'shift-detail', selectedShiftId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'assignments', monthStr] });
      setAddingCode(null);
    },
    onError: (err: any) => {
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' });
      setAddingCode(null);
    },
  });

  const confirmMonthMutation = useMutation({
    mutationFn: (m: string) =>
      api.patch('/admin/registrations/confirm-month', { month: m }).then((r) => r.data),
    onSuccess: (data: any) => {
      const count = data.data?.confirmed ?? 0;
      toast({
        title: count > 0 ? `Đã xác nhận ${count} đăng ký trong tháng` : 'Tất cả đăng ký đã được xác nhận',
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'shift-detail', selectedShiftId] });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (registrationId: number) =>
      api.delete(`/admin/registrations/${registrationId}`).then((r) => r.data),
    onSuccess: () => {
      toast({ title: 'Đã hủy đăng ký' });
      queryClient.invalidateQueries({ queryKey: ['admin', 'shift-detail', selectedShiftId] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'assignments', monthStr] });
      setRemovingId(null);
    },
    onError: (err: any) => {
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' });
      setRemovingId(null);
    },
  });

  const handleExport = async (position: 'PLACE_1' | 'PLACE_2') => {
    setExportingPos(position);
    try {
      const res = await api.get(`/shifts/export?month=${monthStr}&position=${position}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `lich-${position === 'PLACE_1' ? 'cs1' : 'cs2'}-${monthStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Lỗi', description: 'Không thể xuất file Excel', variant: 'destructive' });
    } finally {
      setExportingPos(null);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentDate) });
  const firstDow = getDay(monthStart);

  const shiftsByDate: Record<string, Shift[]> = {};
  shifts.forEach((s) => {
    const key = s.date.split('T')[0];
    if (!shiftsByDate[key]) shiftsByDate[key] = [];
    shiftsByDate[key].push(s);
  });

  const registeredIds = new Set(shiftDetail?.registrations?.map((r) => r.user.id) ?? []);

  const handleAdd = (volunteer: Volunteer) => {
    if (!selectedShiftId || registeredIds.has(volunteer.id)) return;
    setAddingCode(volunteer.ma_tnv);
    assignMutation.mutate({ shiftId: selectedShiftId, code: volunteer.ma_tnv });
  };

  const closePanel = () => {
    setSelectedShiftId(null);
    setSearchQuery('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900">Phân công TNV</h1>
        <Button
          variant="outline"
          size="sm"
          disabled={confirmMonthMutation.isPending || shifts.length === 0}
          onClick={() => confirmMonthMutation.mutate(monthStr)}
        >
          {confirmMonthMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Xác nhận tất cả tháng {month}/{year}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!!exportingPos || shifts.length === 0}
          onClick={() => handleExport('PLACE_1')}
        >
          {exportingPos === 'PLACE_1' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileDown className="h-4 w-4 mr-2" />
          )}
          Xuất Excel Cơ sở 1
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!!exportingPos || shifts.length === 0}
          onClick={() => handleExport('PLACE_2')}
        >
          {exportingPos === 'PLACE_2' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <FileDown className="h-4 w-4 mr-2" />
          )}
          Xuất Excel Cơ sở 2
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Calendar */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base capitalize">
                  {format(currentDate, 'MMMM yyyy', { locale: vi })}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-500 py-1">
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-gray-200 border border-gray-200 rounded overflow-hidden">
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`e${i}`} className="bg-gray-50 min-h-[88px]" />
                ))}
                {days.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayShifts = shiftsByDate[key] ?? [];
                  const isToday = key === format(new Date(), 'yyyy-MM-dd');
                  return (
                    <div
                      key={key}
                      className={`bg-white min-h-[88px] p-1 ${isToday ? 'bg-blue-50/60' : ''}`}
                    >
                      <span
                        className={`text-xs font-semibold block mb-1 ${
                          isToday ? 'text-blue-600' : 'text-gray-600'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                      {dayShifts.map((shift) => {
                        const isFull = shift.registrationCount >= shift.maxSlots;
                        const isSelected = selectedShiftId === shift.id;
                        return (
                          <button
                            key={shift.id}
                            onClick={() => setSelectedShiftId(isSelected ? null : shift.id)}
                            className={`w-full text-left px-1 py-0.5 rounded text-[10px] leading-tight mb-0.5 border transition-all ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                                : isFull
                                ? 'bg-gray-100 text-gray-400 border-gray-200'
                                : shift.registrationCount < 2
                                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                                : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            }`}
                          >
                            <div className="font-medium truncate">{shiftLabel(shift)}</div>
                            <div className="flex items-center gap-0.5 mt-0.5">
                              <Users className="h-2.5 w-2.5 shrink-0" />
                              <span>
                                {shift.registrationCount}/{shift.maxSlots}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-2">
                CS=Ca Sáng · CC=Ca Chiều · CT=Ca Tối · P1/P2=Vị trí · Nhấn vào ca để phân công
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detail panel */}
        {selectedShiftId && (
          <div className="lg:w-80 xl:w-96 w-full shrink-0">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {shiftDetail
                        ? `${shiftDetail.shiftName} — ${
                            shiftDetail.position === 'PLACE_1' ? 'Vị trí 1' : 'Vị trí 2'
                          }`
                        : 'Đang tải...'}
                    </CardTitle>
                    {shiftDetail && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {format(new Date(shiftDetail.date), 'EEEE, dd/MM/yyyy', { locale: vi })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={closePanel}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {shiftDetail && (
                  <Badge
                    variant={
                      shiftDetail.registrations.length >= shiftDetail.maxSlots
                        ? 'secondary'
                        : 'default'
                    }
                    className="w-fit mt-1"
                  >
                    {shiftDetail.registrations.length}/{shiftDetail.maxSlots} chỗ
                  </Badge>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Current registrations */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    TNV đã phân công
                  </p>
                  {loadingDetail ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-52 overflow-y-auto">
                      {(!shiftDetail?.registrations || shiftDetail.registrations.length === 0) && (
                        <p className="text-sm text-gray-400 text-center py-3">Chưa có TNV nào</p>
                      )}
                      {shiftDetail?.registrations?.map((reg) => {
                        const isRemoving = removeMutation.isPending && removingId === reg.id;
                        return (
                          <div
                            key={reg.id}
                            className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg"
                          >
                            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">
                              {reg.user.fullname.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{reg.user.fullname}</p>
                              <p className="text-xs text-gray-400">{reg.user.ma_tnv}</p>
                            </div>
                            {reg.isConfirmed ? (
                              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" title="Đã xác nhận" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-400 shrink-0" title="Chờ xác nhận" />
                            )}
                            <button
                              className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40"
                              disabled={isRemoving}
                              title="Hủy đăng ký"
                              onClick={() => {
                                setRemovingId(reg.id);
                                removeMutation.mutate(reg.id);
                              }}
                            >
                              {isRemoving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t" />

                {/* Add volunteer */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Thêm TNV
                  </p>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                    <Input
                      placeholder="Tìm theo tên hoặc mã TNV..."
                      className="pl-8 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                        onClick={() => setSearchQuery('')}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {searchQuery.length === 1 && (
                    <p className="text-xs text-gray-400 mt-1">Nhập ít nhất 2 ký tự...</p>
                  )}

                  {searchQuery.length >= 2 && (
                    <div className="mt-2 border rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                      {searching && (
                        <div className="flex justify-center py-3">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        </div>
                      )}
                      {!searching && volunteers.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-3">Không tìm thấy</p>
                      )}
                      {!searching &&
                        volunteers.map((v) => {
                          const already = registeredIds.has(v.id);
                          const isAdding = addingCode === v.ma_tnv && assignMutation.isPending;
                          return (
                            <div
                              key={v.id}
                              className={`flex items-center gap-2 px-3 py-2 border-b last:border-b-0 ${
                                already ? 'bg-green-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">{v.fullname}</p>
                                <p className="text-xs text-gray-400">{v.ma_tnv}</p>
                              </div>
                              {already ? (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  Đã có
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 shrink-0"
                                  disabled={isAdding || assignMutation.isPending}
                                  onClick={() => handleAdd(v)}
                                >
                                  {isAdding ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Plus className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
