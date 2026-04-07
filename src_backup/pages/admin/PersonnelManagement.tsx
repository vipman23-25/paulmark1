import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Personnel {
  id: string;
  first_name: string;
  last_name: string;
  tc_no: string;
  department: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  avatar_url: string | null;
  user_id?: string | null;
  password_hash: string;
}

const calculateWorkDuration = (startDate: string) => {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;
  return { months, days };
};

const PersonnelManagement = () => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', tc_no: '', department: '', start_date: '', end_date: '', password_hash: ''
  });

  // Fetch Personnel from Supabase
  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ['personnel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personnel')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        toast.error('Personel verileri çekilirken hata oluştu');
        throw error;
      }
      return data as Personnel[];
    }
  });

  // Mutations
  const addMutation = useMutation({
    mutationFn: async (newPersonnel: any) => {
      const { data, error } = await supabase.from('personnel').insert([newPersonnel]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('Personel başarıyla veritabanına eklendi');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error('Ekleme başarısız: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('personnel').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('Personel başarıyla güncellendi');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error('Güncelleme başarısız: ' + error.message);
    }
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { data, error } = await supabase.from('personnel').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success(variables.updates.is_active ? 'Personel tekrar aktif edildi' : 'Personel pasife alındı');
    },
    onError: (error: any) => {
      toast.error('Durum değişikliği başarısız: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('personnel').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel'] });
      toast.success('Personel kalıcı olarak silindi');
    },
    onError: (error: any) => {
      toast.error('Silme başarısız: ' + error.message);
    }
  });

  const handleCloseDialog = () => {
    setIsOpen(false);
    setForm({ first_name: '', last_name: '', tc_no: '', department: '', start_date: '', end_date: '', password_hash: '' });
    setEditingId(null);
  };

  const startEdit = (p: Personnel) => {
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      tc_no: p.tc_no,
      department: p.department,
      start_date: p.start_date,
      end_date: p.end_date || '',
      password_hash: p.password_hash || '',
    });
    setEditingId(p.id);
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.first_name.trim() || !form.last_name.trim() || !form.tc_no.trim() || !form.department.trim() || !form.start_date.trim() || !form.password_hash.trim()) {
      toast.error('Lütfen tüm zorunlu alanları doldurun (şifre dahil)');
      return;
    }

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      tc_no: form.tc_no,
      department: form.department,
      start_date: form.start_date,
      end_date: form.end_date || null,
      password_hash: form.password_hash,
      is_active: editingId ? undefined : true, // Only set active status on insert
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const toggleActive = (p: Personnel) => {
    const isActive = !p.is_active;
    const updates: any = { is_active: isActive };
    if (!isActive) updates.end_date = new Date().toISOString().split('T')[0];
    else updates.end_date = null;
    
    toggleActiveMutation.mutate({ id: p.id, updates });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48 animate-pulse text-muted-foreground">
        Personel kayıtları yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground">Personel Yönetimi</h2>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) handleCloseDialog(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Yeni Personel</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? 'Personel Güncelle' : 'Yeni Personel Ekle'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Ad</Label>
                  <Input id="first_name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="last_name">Soyadı</Label>
                  <Input id="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tc_no">TC No</Label>
                  <Input id="tc_no" value={form.tc_no} onChange={(e) => setForm({ ...form, tc_no: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="password_hash">Otomasyon Şifresi</Label>
                  <Input id="password_hash" type="text" className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800" value={form.password_hash} onChange={(e) => setForm({ ...form, password_hash: e.target.value })} placeholder="Sisteme giriş şifresi" />
                </div>
              </div>
              <div>
                <Label htmlFor="department">Departman</Label>
                <Input id="department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Başlangıç Tarihi</Label>
                  <Input id="start_date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="end_date">Bitiş Tarihi</Label>
                  <Input id="end_date" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} placeholder="İsteğe bağlı" />
                </div>
              </div>
              <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending} className="w-full">
                {addMutation.isPending || updateMutation.isPending ? 'İşleniyor...' : (editingId ? 'Güncelle' : 'Ekle')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Aktif Personel ({personnel.filter(p => p.is_active).length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>TC No</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>Başlangıç</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {personnel.filter(p => p.is_active).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                    <TableCell>{p.tc_no}</TableCell>
                    <TableCell>{p.department}</TableCell>
                    <TableCell>
                      <div>{format(new Date(p.start_date), 'dd.MM.yyyy')}</div>
                      {p.start_date && (() => {
                        const { months, days } = calculateWorkDuration(p.start_date);
                        return (
                          <div className="text-xs text-muted-foreground font-medium mt-1">
                            {months} ay {days} gün
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="bg-green-500/10">Aktif</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(p)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toggleActive(p)} disabled={toggleActiveMutation.isPending}>
                          <UserX className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {personnel.filter(p => p.is_active).length === 0 && (
                  <TableRow>
                     <TableCell colSpan={6} className="text-center text-muted-foreground py-4">Kayıtlı aktif personel bulunmuyor</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {personnel.some(p => !p.is_active) && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Pasif Personel ({personnel.filter(p => !p.is_active).length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ad Soyad</TableHead>
                    <TableHead>TC No</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Bitiş Tarihi</TableHead>
                    <TableHead>İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnel.filter(p => !p.is_active).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                      <TableCell>{p.tc_no}</TableCell>
                      <TableCell>{p.department}</TableCell>
                      <TableCell>{p.end_date ? format(new Date(p.end_date), 'dd.MM.yyyy') : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => toggleActive(p)} disabled={toggleActiveMutation.isPending}>
                            <UserCheck className="w-4 h-4 text-green-500" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PersonnelManagement;
