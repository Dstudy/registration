import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { KpiSidebar } from '@/components/layout/kpi-sidebar';
import { NotificationBell } from '@/components/layout/notification-bell';
import { UserMenu } from '@/components/layout/user-menu';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b flex items-center justify-end px-6 gap-4 shrink-0">
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
      <KpiSidebar />
    </div>
  );
}
