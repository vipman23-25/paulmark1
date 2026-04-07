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
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Timer } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const OvertimeManagement = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [overtimeTypes, setOvertimeTypes] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    personnel_id: '', record_date: '', hours: '', record_type: '', description: '',
  });

  const fetchAll = () => {
    try {
      const allRecords = mockDb.getAllOvertimes();
      const allPersonnel = mockDb.getAllPersonnel().filter(p => p.is_active);
      const settings = mockDb.getSettings();
      setOvertimeTypes(settings.overtimeTypes);
      if (settings.overtimeTypes.length > 0 && !form.record_type) {
        setForm(f => ({ ...f, record_type: settings.overtimeTypes[0] }));
      }
      setRecords(allRecords.sort((a, b) => new Date(b.record_date).getTime() - new Date(a.record_date).getTime()));
      setPersonnel(allPersonnel);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.personnel_id || !form.record_date || !form.hours) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      if (editingId) {
        mockDb.updateOvertime(editingId, {
          personnel_id: form.personnel_id,
          record_date: form.record_date,
          hours: parseFloat(form.hours),
          record_type: form.record_type as 'overtime' | 'credit',
          description: form.description,
        });
        toast.success('Kayıt güncellendi');
      } else {
        mockDb.addOvertime({
          personnel_id: form.personnel_id,
          record_date: form.record_date,
          hours: parseFloat(form.hours),
          record_type: form.record_type as 'overtime' | 'credit',
          description: form.description,
        });
        toast.success('Kayıt eklendi');
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
    setForm({ personnel_id: '', record_date: '', hours: '', record_type: overtimeTypes[0] || '', description: '' });
  };

  const handleEdit = (r: any) => {
    setForm({
      personnel_id: r.personnel_id,
      record_date: r.record_date.split('T')[0],
      hours: r.hours.toString(),
      record_type: r.record_type,
      description: r.description || '',
    });
    setEditingId(r.id);
    setIsOpen(true);
  };

  const deleteRecord = (id: string) => {
    try {
      mockDb.deleteOvertime(id);
      toast.success('Kayıt silindi');
      fetchAll();
    } catch (error: any) {
      toast.error(error.message || 'Silme başarısız');
    }
  };

  const getPersonnelName = (id: string) => {
    const p = personnel.find(p => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Bilinmiyor';
  };

  // Summary by personnel
  const summary = personnel.map(p => {
    const pRecords = records.filter(r => r.personnel_id === p.id);
    const overtime = pRecords.filter(r => !r.record_type.toLowerCase().includes('alacak') && !r.record_type.toLowerCase().includes('kullanım')).reduce((s, r) => s + (typeof r.hours === 'string' ? parseFloat(r.hours) : r.hours), 0);
    const credit = pRecords.filter(r => r.record_type.toLowerCase().includes('alacak') || r.record_type.toLowerCase().includes('kullanım')).reduce((s, r) => s + (typeof r.hours === 'string' ? parseFloat(r.hours) : r.hours), 0);
    return { ...p, overtime, credit, balance: overtime - credit };
  }).filter(p => p.overtime > 0 || p.credit > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Timer className="h-6 w-6" /> Fazla Mesai / Alacak Takibi
        </h2>
        <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Kayıt Ekle</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? "Kaydı Düzenle" : "Yeni Kayıt"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="personnel_id">Personel</Label>
                <Select value={form.personnel_id} onValueChange={(v) => setForm({...form, personnel_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Personel seçin" /></SelectTrigger>
                  <SelectContent>
                    {personnel.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="record_type">Tür</Label>
                <Select value={form.record_type} onValueChange={(v) => setForm({...form, record_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {overtimeTypes.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="record_date">Tarih</Label>
                  <Input id="record_date" type="date" value={form.record_date} onChange={e => setForm({...form, record_date: e.target.value})} />
                </div>
                <div>
                  <Label htmlFor="hours">Saat</Label>
                  <Input id="hours" type="number" step="0.5" value={form.hours} onChange={e => setForm({...form, hours: e.target.value})} />
                </div>
              </div>
              <div>
                <Label htmlFor="description">Açıklama</Label>
                <Textarea id="description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <Button type="submit" className="w-full">Ekle</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {summary.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {summary.map(s => (
            <Card key={s.id} className="glass-card bg-secondary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{s.first_name} {s.last_name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Fazla Mesai:</span><span className="font-medium">{s.overtime.toFixed(1)} saat</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Kullanılan:</span><span className="font-medium">{s.credit.toFixed(1)} saat</span></div>
                <div className="flex justify-between border-t pt-1"><span className="text-muted-foreground">Bakiye:</span>
                  <span className={`font-bold ${s.balance > 0 ? 'text-success' : s.balance < 0 ? 'text-destructive' : ''}`}>{s.balance.toFixed(1)} saat</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personel</TableHead>
                <TableHead>Tür</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Saat</TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{getPersonnelName(r.personnel_id)}</TableCell>
                  <TableCell>
                    <Badge variant={!r.record_type.toLowerCase().includes('alacak') && !r.record_type.toLowerCase().includes('kullanım') ? 'default' : 'secondary'}>
                      {r.record_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(r.record_date), 'dd.MM.yyyy', { locale: tr })}</TableCell>
                  <TableCell className="font-semibold">{r.hours.toFixed(1)} saat</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.description || '-'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(r)}>
                        <Timer className="h-4 w-4 text-blue-500 hover:text-blue-700" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteRecord(r.id)}>
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
    </div>
  );
};

export default OvertimeManagement;
