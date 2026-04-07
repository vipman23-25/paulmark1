import { useEffect, useState } from 'react';
import { mockDb } from '@/services/mockDatabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Clock, AlertTriangle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
const BreakTracking = () => {
  const [breaks, setBreaks] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [breakLimit, setBreakLimit] = useState(60);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'weekly' | 'monthly'>('all');

  const fetchBreaks = () => {
    try {
      const allBreaks = mockDb.getAllBreaks() || [];
      const activePersonnel = mockDb.getAllPersonnel().filter((p) => p.is_active);
      const settings = mockDb.getSettings();
      setBreakLimit(settings.breakLimitMinutes);
      setBreaks(allBreaks.sort((a, b) => new Date(b.break_start).getTime() - new Date(a.break_start).getTime()));
      setPersonnel(activePersonnel);
    } catch (error) {
      toast.error('Mola verileri yüklenemedi');
    }
  };

  useEffect(() => {
    fetchBreaks();
    const interval = setInterval(fetchBreaks, 60000); // 1 dk
    return () => clearInterval(interval);
  }, []);

  const getPersonnelInfo = (personnelId: string) => {
    return personnel.find(p => p.id === personnelId);
  };

  const getDuration = (start: string, end: string | null) => {
    const s = new Date(start);
    const e = end ? new Date(end) : new Date();
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60));
    return diff;
  };

  const filteredBreaks = breaks.filter(b => {
    if (filter === 'all') return true;
    const date = new Date(b.break_start);
    const now = new Date();
    if (filter === 'weekly') return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (filter === 'monthly') return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return true;
  });

  const toggleSelection = (id: string) => {
    setSelectedIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`${selectedIds.length} adet kaydı silmek istediğinize emin misiniz?`)) {
      try {
        selectedIds.forEach(id => mockDb.deleteBreak(id));
        toast.success(`${selectedIds.length} kayıt silindi`);
        setSelectedIds([]);
        fetchBreaks();
      } catch (error) {
        toast.error('Silme başarısız');
      }
    }
  };

  const handleDeleteBreak = (id: string) => {
    if (confirm('Bu molayı silmek istediğinizden emin misiniz?')) {
      try {
        mockDb.deleteBreak(id);
        toast.success('Mola kaydı silindi');
        fetchBreaks();
      } catch (error) {
        toast.error('Silme başarısız');
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-6 w-6" /> Mola Takibi
        </h2>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Toplu Sil ({selectedIds.length})
            </Button>
          )}
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
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={filteredBreaks.length > 0 && selectedIds.length === filteredBreaks.length}
                    onCheckedChange={(c) => setSelectedIds(c ? filteredBreaks.map(b => b.id) : [])}
                  />
                </TableHead>
                <TableHead>Personel</TableHead>
                <TableHead>Reyon</TableHead>
                <TableHead>Mola Başlangıcı</TableHead>
                <TableHead>Mola Bitişi</TableHead>
                <TableHead>Süre (dk)</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBreaks.map((b) => {
                const personelInfo = getPersonnelInfo(b.personnel_id);
                const duration = getDuration(b.break_start, b.break_end);
                const isLate = duration > breakLimit;
                const isOngoing = !b.break_end;
                return (
                  <TableRow key={b.id} className={isLate ? 'bg-destructive/10' : ''}>
                    <TableCell>
                      <Checkbox checked={selectedIds.includes(b.id)} onCheckedChange={() => toggleSelection(b.id)} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {personelInfo?.first_name} {personelInfo?.last_name}
                    </TableCell>
                    <TableCell>{personelInfo?.department}</TableCell>
                    <TableCell>
                      {format(new Date(b.break_start), 'dd.MM.yyyy HH:mm', { locale: tr })}
                    </TableCell>
                    <TableCell>
                      {b.break_end
                        ? format(new Date(b.break_end), 'dd.MM.yyyy HH:mm', { locale: tr })
                        : '-'}
                    </TableCell>
                    <TableCell className={isLate ? 'text-destructive font-bold' : ''}>
                      {duration} dk
                      {isLate && <span className="ml-1">(+{duration - breakLimit} dk gecikme)</span>}
                    </TableCell>
                    <TableCell>
                      {isOngoing ? (
                        <Badge variant="secondary" className="bg-warning/20 text-warning">
                          <AlertTriangle className="w-3 h-3 mr-1" /> Molada
                        </Badge>
                      ) : isLate ? (
                        <Badge variant="destructive">Gecikmeli</Badge>
                      ) : (
                        <Badge variant="default">Tamamlandı</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteBreak(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default BreakTracking;
