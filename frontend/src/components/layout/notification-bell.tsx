'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: number;
  title: string;
  content: string;
  isRead: boolean;
  type: 'INFO' | 'WARNING' | 'REQUEST' | 'URGENT';
  createdAt: string;
}

const typeColors = {
  INFO: 'bg-blue-50 border-blue-200',
  WARNING: 'bg-yellow-50 border-yellow-200',
  REQUEST: 'bg-orange-50 border-orange-200',
  URGENT: 'bg-red-50 border-red-200',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=10').then((r) => r.data.data),
    enabled: isAuthenticated,
    staleTime: Infinity,
  });

  const unreadCount = data?.unreadCount || 0;

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = getSocket();

    const handler = () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('notification.created', handler);
    return () => { socket.off('notification.created', handler); };
  }, [isAuthenticated, queryClient]);

  const markRead = async (id: number) => {
    await api.patch(`/notifications/${id}/read`);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Thông báo"
      >
        <Bell className="h-5 w-5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-80 bg-white rounded-lg shadow-xl border z-50 max-h-96 overflow-y-auto">
            <div className="p-3 border-b font-semibold text-sm flex items-center justify-between">
              <span>Thông báo</span>
              {unreadCount > 0 && (
                <button
                  onClick={() => api.patch('/notifications/read-all').then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Đọc tất cả
                </button>
              )}
            </div>
            {!data?.notifications?.length ? (
              <p className="p-4 text-sm text-gray-500 text-center">Không có thông báo</p>
            ) : (
              data.notifications.map((n: Notification) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markRead(n.id)}
                  className={`p-3 border-b text-sm cursor-pointer hover:bg-gray-50 ${!n.isRead ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="font-medium">{n.title}</div>
                  <div className="text-gray-600 text-xs mt-0.5 line-clamp-2">{n.content}</div>
                  <div className="text-gray-400 text-xs mt-1">
                    {new Date(n.createdAt).toLocaleString('vi-VN')}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
