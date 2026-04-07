import { useEffect, useState } from 'react';
import { mockDb } from '@/services/mockDatabase';
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
import { Plus, Trash2, Activity, Download } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

const MovementManagement = () => {
  const [movements, setMovements] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [movementTypes, setMovementTypes] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    personnel_id: '', movement_type: '', start_date: '', end_date: '', description: '', total_days: 1
  });
  const [filter, setFilter] = useState<'all' | 'weekly' | 'monthly'>('all');

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
        'Personel': getPersonnelName(m.personnel_id),
        'Hareket Türü': m.movement_type,
        'Başlangıç': format(new Date(m.start_date), 'dd.MM.yyyy', { locale: tr }),
        'Bitiş': format(new Date(m.end_date), 'dd.MM.yyyy', { locale: tr }),
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

  const fetchAll = () => {
    try {
      const allPersonnel = mockDb.getAllPersonnel().filter(p => p.is_active);
      const allMovements = mockDb.getAllMovements();
      const settings = mockDb.getSettings();
      setMovementTypes(settings.movementTypes);
      if (settings.movementTypes.length > 0 && !form.movement_type) {
        setForm(f => ({ ...f, movement_type: settings.movementTypes[0] }));
      }
      setPersonnel(allPersonnel);
      setMovements(allMovements);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.personnel_id || !form.movement_type || !form.start_date || !form.end_date) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }
    
    try {
      if (editingId) {
        mockDb.updateMovement(editingId, {
          personnel_id: form.personnel_id,
          movement_type: form.movement_type,
          start_date: form.start_date,
          end_date: form.end_date,
          total_days: form.total_days,
          description: form.description,
        });
        toast.success('Hareket güncellendi');
      } else {
        mockDb.addMovement({
          personnel_id: form.personnel_id,
          movement_type: form.movement_type,
          start_date: form.start_date,
          end_date: form.end_date,
          total_days: form.total_days,
          description: form.description,
        });
        toast.success('Hareket eklendi');
      }
      resetForm();
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'İşlem başarısız');
    }
  };

  const resetForm = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm({ personnel_id: '', movement_type: movementTypes[0] || '', start_date: '', end_date: '', description: '', total_days: 1 });
  };

  const handleEdit = (m: any) => {
    setForm({
      personnel_id: m.personnel_id,
      movement_type: m.movement_type,
      start_date: m.start_date.split('T')[0],
      end_date: m.end_date.split('T')[0],
      description: m.description || '',
      total_days: m.total_days || 1,
    });
    setEditingId(m.id);
    setIsOpen(true);
  };

  const deleteMovement = (id: string) => {
    try {
      mockDb.deleteMovement(id);
      toast.success('Hareket silindi');
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Silme başarısız');
    }
  };

  const getPersonnelName = (id: string) => {
    const p = personnel.find(p => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Bilinmiyor';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6" /> Personel Hareketleri
        </h2>
        <div className="flex items-center gap-2">
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
                    {personnel.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="movement_type">Hareket Türü</Label>
                <Select value={form.movement_type} onValueChange={(v) => setForm({ ...form, movement_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Tür seçin" /></SelectTrigger>
                  <SelectContent>
                    {movementTypes.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
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
                <Label htmlFor="total_days">Gün Sayısı (Manuel değiştirebilirsiniz)</Label>
                <Input id="total_days" type="number" min="1" max="365" value={form.total_days} onChange={e => setForm({ ...form, total_days: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label htmlFor="description">Açıklama</Label>
                <Textarea id="description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="İsteğe bağlı" />
              </div>
              <Button type="submit" className="w-full">Kaydet</Button>
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
                  {filteredMovements.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{getPersonnelName(m.personnel_id)}</TableCell>
                      <TableCell>{m.movement_type}</TableCell>
                      <TableCell>{format(new Date(m.start_date), 'dd.MM.yyyy', { locale: tr })}</TableCell>
                      <TableCell>{format(new Date(m.end_date), 'dd.MM.yyyy', { locale: tr })}</TableCell>
                      <TableCell>{m.total_days}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.description}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(m)}>
                            <Activity className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteMovement(m.id)}>
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
                    <TableHead>Kullanılan İzin (Gün)</TableHead>
                    <TableHead>Kalan İzin (Gün)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personnel.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                      <TableCell>{p.department}</TableCell>
                      <TableCell>{p.used_leave !== undefined ? p.used_leave : '-'}</TableCell>
                      <TableCell>{p.remaining_leave !== undefined ? p.remaining_leave : '-'}</TableCell>
                    </TableRow>
                  ))}
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
