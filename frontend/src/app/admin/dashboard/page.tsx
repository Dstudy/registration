'use client';

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/providers/socket-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Users, Calendar, CheckSquare, AlertTriangle, ToggleLeft, ToggleRight, Mail, Bell, BellOff } from 'lucide-react';

interface Stats {
  totalVolunteers: number;
  activeVolunteers: number;
  shiftsThisMonth: number;
  totalRegistrationsThisMonth: number;
  pendingRequests: number;
  todayAttendance: { present: number; absent: number; unconfirmed: number };
}

export default function AdminDashboardPage() {
  const queryClient = useQueryClient();
  const socket = useSocket();

  const { data } = useQuery<Stats>({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data.data as Stats),
  });

  const { data: regStatus, isLoading: regLoading } = useQuery<{ open: boolean }>({
    queryKey: ['admin', 'registration-status'],
    queryFn: () => api.get('/admin/registration-status').then((r) => r.data.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (open: boolean) =>
      api.patch('/admin/registration-status', { open }).then((r) => r.data.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'registration-status'] }),
  });

  const { data: reminderStatus, isLoading: reminderLoading } = useQuery<{ enabled: boolean }>({
    queryKey: ['admin', 'reminder-status'],
    queryFn: () => api.get('/admin/reminder-status').then((r) => r.data.data),
  });

  const toggleReminderMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch('/admin/reminder-status', { enabled }).then((r) => r.data.data),
    onSuccess: (data: { enabled: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reminder-status'] });
      toast({
        title: data.enabled ? 'Đã bật nhắc nhở ca trực' : 'Đã tắt nhắc nhở ca trực',
        description: data.enabled
          ? 'Hệ thống sẽ tự động gửi email nhắc nhở 2 giờ trước ca trực.'
          : 'Hệ thống sẽ không gửi email nhắc nhở tự động.',
      });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const currentMonth = new Date().toISOString().slice(0, 7);

  const sendEmailsMutation = useMutation({
    mutationFn: () =>
      api.post('/admin/send-confirmation-emails', { month: currentMonth }).then((r) => r.data.data),
    onSuccess: (data: { sent: number; skipped: number; alreadySent: number; errors: number }) => {
      const parts: string[] = [];
      if (data.alreadySent > 0) parts.push(`${data.alreadySent} TNV đã nhận email trước đó`);
      if (data.skipped > 0) parts.push(`${data.skipped} TNV chưa có email`);
      if (data.errors > 0) parts.push(`${data.errors} lỗi`);
      toast({
        title: data.sent > 0 ? `Đã gửi email cho ${data.sent} tình nguyện viên` : 'Không có email mới cần gửi',
        description: parts.length > 0 ? `Bỏ qua: ${parts.join(', ')}` : undefined,
      });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi gửi email', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  useEffect(() => {
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
    socket.on('registration.created', refresh);
    socket.on('registration.canceled', refresh);
    socket.on('attendance.updated', refresh);
    return () => {
      socket.off('registration.created', refresh);
      socket.off('registration.canceled', refresh);
      socket.off('attendance.updated', refresh);
    };
  }, [socket, queryClient]);

  const stats = data;

  const isOpen = regStatus?.open ?? false;
  const isReminderEnabled = reminderStatus?.enabled ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
        <div className="flex items-center gap-2">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Đăng ký ca trực</span>
              <Button
                size="sm"
                variant={isOpen ? 'default' : 'outline'}
                className={isOpen ? 'bg-green-600 hover:bg-green-700 text-white' : 'text-gray-500'}
                disabled={regLoading || toggleMutation.isPending}
                onClick={() => toggleMutation.mutate(!isOpen)}
              >
                {isOpen ? (
                  <><ToggleRight className="h-4 w-4 mr-1" /> Đang mở</>
                ) : (
                  <><ToggleLeft className="h-4 w-4 mr-1" /> Đang đóng</>
                )}
              </Button>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Nhắc nhở ca trực</span>
              <Button
                size="sm"
                variant={isReminderEnabled ? 'default' : 'outline'}
                className={isReminderEnabled ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'text-gray-500'}
                disabled={reminderLoading || toggleReminderMutation.isPending}
                onClick={() => toggleReminderMutation.mutate(!isReminderEnabled)}
                title="Tự động gửi email nhắc nhở 2 giờ trước ca trực"
              >
                {isReminderEnabled ? (
                  <><Bell className="h-4 w-4 mr-1" /> Đang bật</>
                ) : (
                  <><BellOff className="h-4 w-4 mr-1" /> Đang tắt</>
                )}
              </Button>
            </CardContent>
          </Card>
          <Button
            size="sm"
            variant="outline"
            disabled={isOpen || sendEmailsMutation.isPending}
            onClick={() => sendEmailsMutation.mutate()}
            title={isOpen ? 'Đóng đăng ký trước khi gửi email' : 'Gửi email xác nhận ca trực tháng này'}
          >
            <Mail className="h-4 w-4 mr-1.5" />
            {sendEmailsMutation.isPending ? 'Đang gửi...' : 'Gửi email xác nhận'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5 text-blue-600" />}
          label="Tình nguyện viên"
          value={stats?.activeVolunteers ?? '—'}
          sub={`${stats?.totalVolunteers ?? 0} tổng`}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<Calendar className="h-5 w-5 text-green-600" />}
          label="Ca tháng này"
          value={stats?.shiftsThisMonth ?? '—'}
          sub={`${stats?.totalRegistrationsThisMonth ?? 0} đăng ký`}
          bg="bg-green-50"
        />
        <StatCard
          icon={<CheckSquare className="h-5 w-5 text-purple-600" />}
          label="Điểm danh hôm nay"
          value={stats?.todayAttendance.present ?? '—'}
          sub={`${stats?.todayAttendance.absent ?? 0} vắng • ${stats?.todayAttendance.unconfirmed ?? 0} chưa xác nhận`}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
          label="Yêu cầu chờ duyệt"
          value={stats?.pendingRequests ?? '—'}
          sub="cần xử lý"
          bg="bg-orange-50"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub: string;
  bg: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
          <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
