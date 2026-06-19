'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import api from '@/lib/api';
import { Search, Edit2, UserCheck, UserX, UserPlus, Upload, X, CheckCircle, AlertCircle, Eye, EyeOff, Trash2 } from 'lucide-react';

interface Volunteer {
  id: number;
  ma_tnv: string;
  fullname: string;
  email: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  min_shifts_per_month: number;
  _count: { registrations: number };
}

interface ImportResult {
  ma_tnv: string;
  fullname: string;
  status: 'created' | 'error';
  generatedPassword?: string;
  reason?: string;
}

interface ImportResponse {
  total: number;
  created: number;
  errors: number;
  results: ImportResult[];
}

export default function VolunteersPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMinShifts, setEditMinShifts] = useState(2);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ fullname: '', ma_tnv: '', date_of_birth: '', date_joined: '', email: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const [importResults, setImportResults] = useState<ImportResponse | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);

  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteAllInput, setDeleteAllInput] = useState('');

  const { data } = useQuery({
    queryKey: ['admin', 'volunteers', search],
    queryFn: () =>
      api.get(`/admin/volunteers?search=${encodeURIComponent(search)}`).then((r) => r.data.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      api.patch(`/admin/volunteers/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'volunteers'] });
      toast({ title: 'Đã cập nhật' });
      setEditingId(null);
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const createMutation = useMutation({
    mutationFn: (body: object) => api.post('/admin/users', body).then((r) => r.data.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'volunteers'] });
      setCreatedPassword(data.generatedPassword);
      setShowPassword(false);
      setCreateForm({ fullname: '', ma_tnv: '', date_of_birth: '', date_joined: '', email: '' });
      toast({ title: 'Tạo tài khoản thành công' });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const importMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post('/admin/users/import', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data.data);
    },
    onSuccess: (data: ImportResponse) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'volunteers'] });
      setImportResults(data);
      setShowImportResults(true);
      toast({ title: `Import xong: ${data.created} thành công, ${data.errors} lỗi` });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi import', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete('/admin/users').then((r) => r.data.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'volunteers'] });
      setShowDeleteAllConfirm(false);
      setDeleteAllInput('');
      toast({ title: `Đã xóa ${data.deleted} tình nguyện viên` });
    },
    onError: (err: any) =>
      toast({ title: 'Lỗi', description: err?.response?.data?.message, variant: 'destructive' }),
  });

  const volunteers: Volunteer[] = data?.volunteers ?? [];

  const handleCreate = () => {
    if (!createForm.fullname || !createForm.ma_tnv || !createForm.date_of_birth || !createForm.date_joined || !createForm.email) {
      toast({ title: 'Vui lòng điền đầy đủ thông tin bắt buộc (bao gồm email)', variant: 'destructive' });
      return;
    }
    createMutation.mutate(createForm);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    importMutation.mutate(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Tình nguyện viên</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importMutation.isPending}
          >
            <Upload className="h-4 w-4 mr-1.5" />
            {importMutation.isPending ? 'Đang import...' : 'Import CSV'}
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          <Button size="sm" onClick={() => { setShowCreateForm(!showCreateForm); setCreatedPassword(null); }}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Tạo tài khoản
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => { setShowDeleteAllConfirm(true); setDeleteAllInput(''); }}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Xóa tất cả
          </Button>
        </div>
      </div>

      {/* CSV template hint */}
      <p className="text-xs text-gray-400">
        CSV mẫu: cột <code>fullname</code>, <code>ma_tnv</code>, <code>date_of_birth</code>, <code>date_joined</code> (YYYY-MM-DD hoặc DD/MM/YYYY), <code>email</code>. Mật khẩu mặc định = mã TNV + ngày sinh (DDMMYYYY).
      </p>

      {/* Create user form */}
      {showCreateForm && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-medium text-blue-900">Tạo tài khoản mới</p>
              <Button size="sm" variant="ghost" onClick={() => { setShowCreateForm(false); setCreatedPassword(null); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {createdPassword ? (
              <div className="space-y-2">
                <p className="text-sm text-green-700 font-medium">Tài khoản đã được tạo thành công!</p>
                <div className="flex items-center gap-2 bg-white rounded-md border p-2">
                  <span className="text-sm text-gray-700 flex-1">
                    Mật khẩu: <span className="font-mono">{showPassword ? createdPassword : '•'.repeat(createdPassword.length)}</span>
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { navigator.clipboard.writeText(createdPassword); toast({ title: 'Đã sao chép mật khẩu' }); }}
                  >
                    Sao chép
                  </Button>
                </div>
                <Button size="sm" onClick={() => setCreatedPassword(null)}>Tạo tài khoản khác</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Họ tên <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Nguyễn Văn A"
                    value={createForm.fullname}
                    onChange={(e) => setCreateForm((f) => ({ ...f, fullname: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mã TNV <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="TNV001"
                    value={createForm.ma_tnv}
                    onChange={(e) => setCreateForm((f) => ({ ...f, ma_tnv: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ngày sinh <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={createForm.date_of_birth}
                    onChange={(e) => setCreateForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ngày tham gia <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={createForm.date_joined}
                    onChange={(e) => setCreateForm((f) => ({ ...f, date_joined: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email <span className="text-red-500">*</span></Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500 mb-2">
                    Mật khẩu sẽ được tạo tự động: <span className="font-mono">{createForm.ma_tnv || 'MãTNV'}{createForm.date_of_birth ? createForm.date_of_birth.split('-').reverse().join('') : 'DDMMYYYY'}</span>
                  </p>
                  <Button onClick={handleCreate} disabled={createMutation.isPending} size="sm">
                    {createMutation.isPending ? 'Đang tạo...' : 'Tạo tài khoản'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import results */}
      {showImportResults && importResults && (
        <Card className="border-gray-200">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">
                Kết quả import: <span className="text-green-600">{importResults.created} thành công</span>
                {importResults.errors > 0 && <span className="text-red-500"> • {importResults.errors} lỗi</span>}
              </p>
              <Button size="sm" variant="ghost" onClick={() => setShowImportResults(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {importResults.results.map((r, i) => (
                <div key={i} className={`flex items-start gap-2 text-xs p-2 rounded ${r.status === 'created' ? 'bg-green-50' : 'bg-red-50'}`}>
                  {r.status === 'created' ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{r.ma_tnv}</span> — {r.fullname}
                    {r.generatedPassword && (
                      <span className="ml-1 text-gray-500">• mật khẩu: <span className="font-mono">{r.generatedPassword}</span></span>
                    )}
                    {r.reason && <span className="text-red-600 ml-1">• {r.reason}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          className="pl-9"
          placeholder="Tìm theo tên, mã TNV..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Delete all confirmation modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4 border-red-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Xóa tất cả tình nguyện viên?</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Hành động này sẽ <strong>xóa vĩnh viễn</strong> toàn bộ {volunteers.length > 0 ? `${volunteers.length} ` : ''}tài khoản tình nguyện viên cùng tất cả dữ liệu liên quan. Không thể hoàn tác.
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">
                  Nhập <span className="font-mono font-semibold">XOA TAT CA</span> để xác nhận
                </Label>
                <Input
                  value={deleteAllInput}
                  onChange={(e) => setDeleteAllInput(e.target.value)}
                  placeholder="XOA TAT CA"
                  className="border-red-200 focus-visible:ring-red-400"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setShowDeleteAllConfirm(false); setDeleteAllInput(''); }}
                  disabled={deleteAllMutation.isPending}
                >
                  Hủy
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleteAllInput !== 'XOA TAT CA' || deleteAllMutation.isPending}
                  onClick={() => deleteAllMutation.mutate()}
                >
                  {deleteAllMutation.isPending ? 'Đang xóa...' : 'Xóa tất cả'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-2">
        {volunteers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">Không tìm thấy</CardContent>
          </Card>
        )}
        {volunteers.map((vol) => (
          <Card key={vol.id}>
            <CardContent className="p-4">
              {editingId === vol.id ? (
                <div className="space-y-3">
                  <p className="font-medium">{vol.fullname} — {vol.ma_tnv}</p>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="minShifts" className="shrink-0 text-sm">Ca tối thiểu/tháng</Label>
                    <Input
                      id="minShifts"
                      type="number"
                      min={0}
                      max={20}
                      value={editMinShifts}
                      onChange={(e) => setEditMinShifts(parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateMutation.mutate({ id: vol.id, body: { min_shifts_per_month: editMinShifts } })}
                      disabled={updateMutation.isPending}
                    >
                      Lưu
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Hủy</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{vol.fullname}</p>
                      <span className="text-xs text-gray-400">{vol.ma_tnv}</span>
                      <Badge variant={vol.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {vol.status === 'ACTIVE' ? 'Hoạt động' : 'Không hoạt động'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {vol.email || 'Chưa có email'} • Tối thiểu {vol.min_shifts_per_month} ca/tháng •{' '}
                      {vol._count.registrations} ca đã đăng ký
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Chỉnh sửa"
                      onClick={() => { setEditingId(vol.id); setEditMinShifts(vol.min_shifts_per_month); }}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title={vol.status === 'ACTIVE' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                      onClick={() =>
                        updateMutation.mutate({
                          id: vol.id,
                          body: { status: vol.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
                        })
                      }
                    >
                      {vol.status === 'ACTIVE' ? (
                        <UserX className="h-4 w-4 text-red-500" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
