import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Activity, Download, RefreshCw } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const MovementManagement = () => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    personnel_id: '', movement_type: '', start_date: '', end_date: '', description: '', total_days: 1
  });
  const [filter, setFilter] = useState<'all' | 'weekly' | 'monthly'>('all');

  const { data: personnel = [], isLoading: pLoading } = useQuery({
    queryKey: ['active_personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: movementTypes = [] } = useQuery({
    queryKey: ['system_settings_movement_types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').single();
      if (!error && data?.setting_value?.movementTypes) {
        return data.setting_value.movementTypes;
      }
      return [{ code: 'İ', label: 'İzin' }, { code: 'R', label: 'Hastalık İzni' }, { code: 'M', label: 'Muafiyet' }, { code: 'B', label: 'Başka Görev' }];
    }
  });

  const { data: movements = [], isLoading: mLoading, refetch } = useQuery({
    queryKey: ['personnel_movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('personnel_movements')
        .select(`
          *,
          personnel (
            first_name,
            last_name,
            department
          )
        `)
        .order('start_date', { ascending: false });
        
      if (error) {
        toast.error('Hareket verileri yüklenemedi: ' + error.message);
        throw error;
      }
      return data;
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const { data, error } = await supabase.from('personnel_movements').insert([newRecord]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel_movements'] });
      toast.success('Hareket eklendi');
      resetForm();
    },
    onError: (error: any) => toast.error('Ekleme başarısız: ' + error.message)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { data, error } = await supabase.from('personnel_movements').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel_movements'] });
      toast.success('Hareket güncellendi');
      resetForm();
    },
    onError: (error: any) => toast.error('Güncelleme başarısız: ' + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('personnel_movements').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personnel_movements'] });
      toast.success('Hareket silindi');
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const entitleMutation = useMutation({
    mutationFn: async ({ id, ent }: { id: string, ent: number }) => {
      const { error } = await supabase.from('personnel' as any).update({ annual_leave_entitlement: ent }).eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active_personnel'] });
      toast.success('İzin hakedişi güncellendi');
    },
    onError: (e: any) => toast.error('Hata: ' + e.message)
  });

  const handleDateChange = (field: 'start_date' | 'end_date', value: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (next.start_date && next.end_date) {
        const d = Math.max(1, differenceInDays(new Date(next.end_date), new Date(next.start_date)) + 1);
        next.total_days = d;
      }
      return next;
    });
  };

  const filteredMovements = movements.filter(m => {
    if (filter === 'all') return true;
    const date = new Date(m.start_date);
    const now = new Date();
    if (filter === 'weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return date >= weekAgo;
    }
    if (filter === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      return date >= monthAgo;
    }
    return true;
  });

  const exportToExcel = () => {
    if (filteredMovements.length === 0) {
      toast.error('Dışa aktarılacak veri yok');
      return;
    }
    import('xlsx').then(XLSX => {
      const data = filteredMovements.map(m => ({
        'Personel': m.personnel ? `${m.personnel.first_name} ${m.personnel.last_name}` : 'Bilinmeyen',
        'Hareket Türü': (() => { const typeObj = movementTypes.find((mt: any) => mt.code === m.movement_type); return typeObj ? `[${typeObj.code}] ${typeObj.label}` : m.movement_type; })(),
        'Başlangıç': m.start_date ? format(new Date(m.start_date), 'dd.MM.yyyy', { locale: tr }) : '-',
        'Bitiş': m.end_date ? format(new Date(m.end_date), 'dd.MM.yyyy', { locale: tr }) : '-',
        'Süre (Gün)': m.total_days,
        'Açıklama': m.description || ''
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hareketler");
      XLSX.writeFile(wb, `Hareket_Raporu_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success('Excel dosyası indirildi');
    }).catch(() => toast.error('Excel kütüphanesi yüklenemedi'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const actualMovementType = form.movement_type || (movementTypes.length > 0 ? movementTypes[0].code : '');
    
    if (!form.personnel_id || !actualMovementType || !form.start_date) {
      toast.error('Lütfen personel, hareket türü ve başlangıç tarihini doldurun');
      return;
    }
    
    const payload = {
      personnel_id: form.personnel_id,
      movement_type: actualMovementType,
      start_date: form.start_date,
      end_date: form.end_date || null,
      total_days: form.total_days,
      description: form.description
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const resetForm = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm({ personnel_id: '', movement_type: movementTypes.length > 0 ? movementTypes[0].code : '', start_date: '', end_date: '', description: '', total_days: 1 });
  };

  const handleEdit = (m: any) => {
    setForm({
      personnel_id: m.personnel_id,
      movement_type: m.movement_type,
      start_date: m.start_date ? m.start_date.split('T')[0] : '',
      end_date: m.end_date ? m.end_date.split('T')[0] : '',
      description: m.description || '',
      total_days: m.total_days || 1,
    });
    setEditingId(m.id);
    setIsOpen(true);
  };

  const deleteMovement = (id: string) => {
    if (confirm('Bu hareketi silmek istediğinize emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6" /> Personel Hareketleri
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filtrele" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="weekly">Bu Hafta</SelectItem>
              <SelectItem value="monthly">Bu Ay</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToExcel}>
            <Download className="w-4 h-4 mr-2" /> Excel'e Aktar
          </Button>
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Yeni Hareket</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Hareketi Düzenle" : "Yeni Hareket Ekle"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="personnel_id">Personel</Label>
                <Select value={form.personnel_id} onValueChange={(v) => setForm({ ...form, personnel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                  <SelectContent>
                    {personnel.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="movement_type">Hareket Türü</Label>
                <Select value={form.movement_type || (movementTypes.length > 0 ? movementTypes[0].code : '')} onValueChange={(v) => setForm({ ...form, movement_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Tür seçin" /></SelectTrigger>
                  <SelectContent>
                    {movementTypes.map((t: any) => (
                      <SelectItem key={t.code} value={t.code}>[{t.code}] {t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Başlangıç</Label>
                  <Input id="start_date" type="date" value={form.start_date} onChange={e => handleDateChange('start_date', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="end_date">Bitiş</Label>
                  <Input id="end_date" type="date" value={form.end_date} onChange={e => handleDateChange('end_date', e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="total_days">Gün Sayısı</Label>
                <Input id="total_days" type="number" min="1" max="365" value={form.total_days} onChange={e => setForm({ ...form, total_days: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label htmlFor="description">Açıklama</Label>
                <Textarea id="description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="İsteğe bağlı" />
              </div>
              <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending} className="w-full">
                {addMutation.isPending || updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs defaultValue="movements" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="movements">Hareket Listesi</TabsTrigger>
          <TabsTrigger value="reports">İzin Raporları</TabsTrigger>
        </TabsList>

        <TabsContent value="movements">
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personel</TableHead>
                    <TableHead>Tür</TableHead>
                    <TableHead>Başlangıç</TableHead>
                    <TableHead>Bitiş</TableHead>
                    <TableHead>Gün</TableHead>
                    <TableHead>Açıklama</TableHead>
                    <TableHead>İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground animate-pulse">Hareketler yükleniyor...</TableCell></TableRow>
                  ) : filteredMovements.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Kayıt bulunamadı</TableCell></TableRow>
                  ) : filteredMovements.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.personnel ? `${m.personnel.first_name} ${m.personnel.last_name}` : 'Bilinmeyen'}</TableCell>
                      <TableCell>
                        {(() => {
                           const typeObj = movementTypes.find((mt: any) => mt.code === m.movement_type);
                           return typeObj ? `[${typeObj.code}] ${typeObj.label}` : m.movement_type;
                        })()}
                      </TableCell>
                      <TableCell>{m.start_date ? format(new Date(m.start_date), 'dd.MM.yyyy', { locale: tr }) : '-'}</TableCell>
                      <TableCell>{m.end_date ? format(new Date(m.end_date), 'dd.MM.yyyy', { locale: tr }) : '-'}</TableCell>
                      <TableCell>{m.total_days}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.description}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(m)} disabled={deleteMutation.isPending}>
                            <Activity className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMovement(m.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card className="glass-card">
            <CardHeader><CardTitle>Personel Yıllık İzin Raporları</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Personel</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Hak Edilen (Gün)</TableHead>
                    <TableHead>Kullanılan İzin</TableHead>
                    <TableHead className="text-right">Kalan İzin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Yükleniyor...</TableCell></TableRow>
                  ) : personnel.map((p: any) => {
                    const pMovements = movements.filter((m: any) => {
                      if (m.personnel_id !== p.id) return false;
                      const typeObj = movementTypes.find((mt: any) => mt.code === m.movement_type);
                      const t = (typeObj ? typeObj.label : m.movement_type || '').toLocaleLowerCase('tr-TR');
                      return t.includes('yıllık') && t.includes('izin');
                    });
                    const usedLeave = pMovements.reduce((sum: number, m: any) => sum + Number(m.total_days || 1), 0);
                    const baseEnt = typeof p.annual_leave_entitlement === 'number' ? p.annual_leave_entitlement : 14; 
                    const remainingLeave = baseEnt - usedLeave;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                        <TableCell>{p.department}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                             <Input 
                               type="number" 
                               defaultValue={baseEnt} 
                               onBlur={(e) => {
                                 const val = parseInt(e.target.value);
                                 if (!isNaN(val) && val !== baseEnt) {
                                    entitleMutation.mutate({ id: p.id, ent: val });
                                 }
                               }}
                               className="w-20 h-8"
                             />
                          </div>
                        </TableCell>
                        <TableCell>{usedLeave}</TableCell>
                        <TableCell className={`text-right font-bold ${remainingLeave < 0 ? 'text-red-500' : 'text-emerald-500'}`}>{remainingLeave}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MovementManagement;
