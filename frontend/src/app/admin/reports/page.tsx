'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { FileDown, FileSpreadsheet } from 'lucide-react';

export default function ReportsPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get(`/admin/reports/shifts/export?month=${month}`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `bao-cao-ca-truc-${month}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Lỗi', description: 'Không thể xuất file Excel', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Báo cáo</h1>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-6 w-6 text-blue-700 shrink-0" />
            <div>
              <p className="font-medium text-sm">Báo cáo ca trực của tình nguyện viên</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Xuất file Excel gồm: họ tên, mã TNV, địa điểm, ngày trực, giờ trực — theo tháng đã chọn.
              </p>
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Chọn tháng</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-44"
              />
            </div>
            <Button size="sm" onClick={handleExport} disabled={exporting || !month}>
              <FileDown className="h-4 w-4 mr-1.5" />
              {exporting ? 'Đang xuất...' : 'Xuất Excel'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
