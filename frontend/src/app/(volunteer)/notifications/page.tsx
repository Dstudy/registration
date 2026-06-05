'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import api from '@/lib/api';
import { Bell, CheckCheck } from 'lucide-react';

const TYPE_CONFIG = {
  INFO: { label: 'Thông tin', variant: 'info' as const, bg: 'border-l-blue-400' },
  WARNING: { label: 'Cảnh báo', variant: 'warning' as const, bg: 'border-l-yellow-400' },
  REQUEST: { label: 'Yêu cầu', variant: 'secondary' as const, bg: 'border-l-orange-400' },
  URGENT: { label: 'Khẩn cấp', variant: 'danger' as const, bg: 'border-l-red-400' },
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['notifications', 'all'],
    queryFn: ({ pageParam = 1 }) =>
      api.get(`/notifications?page=${pageParam}&limit=20`).then((r) => r.data.data),
    getNextPageParam: (lastPage) => {
      if (lastPage.page * lastPage.limit < lastPage.total) return lastPage.page + 1;
      return undefined;
    },
    initialPageParam: 1,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.pages.flatMap((p) => p.notifications) ?? [];
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thông báo</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500">{unreadCount} chưa đọc</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <CheckCheck className="h-4 w-4 mr-1" />
            Đọc tất cả
          </Button>
        )}
      </div>

      {!notifications.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Không có thông báo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => {
            const config = TYPE_CONFIG[n.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.INFO;
            return (
              <div
                key={n.id}
                onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
                className={`bg-white border border-l-4 ${config.bg} rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors ${!n.isRead ? 'shadow-sm' : 'opacity-70'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                      )}
                      <p className="font-medium text-sm">{n.title}</p>
                    </div>
                    <p className="text-sm text-gray-600">{n.content}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(n.createdAt), 'HH:mm dd/MM/yyyy', { locale: vi })}
                    </p>
                  </div>
                  <Badge variant={config.variant}>{config.label}</Badge>
                </div>
              </div>
            );
          })}
          {hasNextPage && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Đang tải...' : 'Xem thêm'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
