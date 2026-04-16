import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar, Trash2, RefreshCw, Plus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const DayOffView = () => {
  const queryClient = useQueryClient();
  const [selectedWeeklyIds, setSelectedWeeklyIds] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState({ personnel_id: '', day_of_week: '', description: '' });

  const { data: personnel = [], isLoading: pLoading } = useQuery({
    queryKey: ['active_personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: weeklyDayOffs = [], isLoading: wLoading, refetch } = useQuery({
    queryKey: ['weekly_day_offs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('weekly_day_off').select('*');
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000
  });

  const upsertMutation = useMutation({
    mutationFn: async ({ personnel_id, day_of_week, description }: { personnel_id: string, day_of_week: number, description?: string }) => {
      await supabase.from('weekly_day_off').delete().eq('personnel_id', personnel_id);
      const { data, error } = await supabase.from('weekly_day_off').insert({ personnel_id, day_of_week, description }).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_day_offs'] });
      toast.success('Haftalık izin atandı/güncellendi!');
      setIsOpen(false);
      setForm({ personnel_id: '', day_of_week: '', description: '' });
    },
    onError: (error: any) => toast.error('İşlem başarısız: ' + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('weekly_day_off').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly_day_offs'] });
      toast.success('Haftalık izin silindi');
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('weekly_day_off').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['weekly_day_offs'] });
      toast.success(`${data.length} haftalık izin silindi`);
      setSelectedWeeklyIds([]);
    },
    onError: (error: any) => toast.error('Toplu silme başarısız: ' + error.message)
  });

  const handleDeleteWeeklyDayOff = (id: string) => {
    if (confirm('Haftalık izni silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleBulkDeleteWeekly = () => {
    if (selectedWeeklyIds.length === 0) return;
    if (confirm(`${selectedWeeklyIds.length} adet kaydı silmek istediğinize emin misiniz?`)) {
      bulkDeleteMutation.mutate(selectedWeeklyIds);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.personnel_id || !form.day_of_week) {
      toast.error('Lütfen personel ve gün seçiniz');
      return;
    }
    upsertMutation.mutate({ personnel_id: form.personnel_id, day_of_week: Number(form.day_of_week), description: form.description });
  };

  const handleEdit = (p: any, dayOff: any) => {
    setForm({ personnel_id: p.id, day_of_week: dayOff ? dayOff.day_of_week.toString() : '', description: dayOff?.description || '' });
    setIsOpen(true);
  };

  const isLoading = pLoading || wLoading;

  // Merge personnel with their day offs for display
  const data = personnel.map(p => ({
    ...p,
    weeklyDayOffs: weeklyDayOffs.filter(d => d.personnel_id === p.id)
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6" /> İzin Günleri Yönetimi
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if(!o) setForm({personnel_id:'', day_of_week:'', description:''}); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2"/> Yeni İzin Ata / Değiştir</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>İzin Günü Düzenle</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div>
                  <Label>Personel</Label>
                  <Select value={form.personnel_id} onValueChange={(v) => setForm({...form, personnel_id: v})}>
                    <SelectTrigger><SelectValue placeholder="Personel Seçin" /></SelectTrigger>
                    <SelectContent>
                      {personnel.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.department})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>İzin Günü</Label>
                  <Select value={form.day_of_week} onValueChange={(v) => setForm({...form, day_of_week: v})}>
                    <SelectTrigger><SelectValue placeholder="Gün Seçin (Pzt-Cuma)" /></SelectTrigger>
                    <SelectContent>
                      {DAYS.slice(1, 6).map((d, i) => (
                        <SelectItem key={i+1} value={(i+1).toString()}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Açıklama (İsteğe bağlı)</Label>
                  <Input 
                    value={form.description} 
                    onChange={(e) => setForm({...form, description: e.target.value})} 
                    placeholder="İzin hakkında not..."
                  />
                </div>
                <Button type="submit" className="w-full" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Haftalık İzin Günleri</CardTitle>
          {selectedWeeklyIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDeleteWeekly} disabled={bulkDeleteMutation.isPending}>
              <Trash2 className="w-4 h-4 mr-2" /> Toplu Sil ({selectedWeeklyIds.length})
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                     <Checkbox 
                       checked={data.filter(p => p.weeklyDayOffs.length > 0).length > 0 && selectedWeeklyIds.length === data.filter(p => p.weeklyDayOffs.length > 0).length}
                       onCheckedChange={(c) => setSelectedWeeklyIds(c ? data.filter(p => p.weeklyDayOffs.length > 0).map(p => p.weeklyDayOffs[0].id) : [])}
                     />
                  </TableHead>
                  <TableHead>Personel</TableHead>
                  <TableHead>Departman</TableHead>
                  <TableHead>İzin Günü</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground animate-pulse">Veriler yükleniyor...</TableCell></TableRow>
                ) : data.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aktif personel bulunamadı</TableCell></TableRow>
                ) : data.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.weeklyDayOffs.length > 0 ? (
                        <Checkbox 
                          checked={selectedWeeklyIds.includes(p.weeklyDayOffs[0].id)}
                          onCheckedChange={() => setSelectedWeeklyIds(prev => prev.includes(p.weeklyDayOffs[0].id) ? prev.filter(i => i !== p.weeklyDayOffs[0].id) : [...prev, p.weeklyDayOffs[0].id])}
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                    <TableCell>{p.department}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {p.weeklyDayOffs.length > 0 ? p.weeklyDayOffs.map((d: any) => (
                          <Badge key={d.id} variant="secondary">{DAYS[d.day_of_week] || 'Bilinmiyor'}</Badge>
                        )) : <span className="text-muted-foreground">Seçilmemiş</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                       {p.weeklyDayOffs.length > 0 && p.weeklyDayOffs[0].description ? (
                          <span className="text-sm text-muted-foreground">{p.weeklyDayOffs[0].description}</span>
                       ) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(p, p.weeklyDayOffs[0])}
                        >
                          <Pencil className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                        </Button>
                        {p.weeklyDayOffs.length > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteWeeklyDayOff(p.weeklyDayOffs[0].id)}
                            disabled={deleteMutation.isPending}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DayOffView;
