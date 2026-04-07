import { useEffect, useState } from 'react';
import { mockDb } from '@/services/mockDatabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const DayOffView = () => {
  const [data, setData] = useState<any[]>([]);
  const [singleDayOffs, setSingleDayOffs] = useState<any[]>([]);
  const [selectedWeeklyIds, setSelectedWeeklyIds] = useState<string[]>([]);
  const [selectedSingleIds, setSelectedSingleIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<'all' | 'weekly' | 'monthly'>('all');

  const fetchData = () => {
    try {
      const personnel = mockDb.getAllPersonnel().filter(p => p.is_active);
      const dayOffs = mockDb.getAllWeeklyDayOffs();

      const merged = personnel.map(p => {
        const personelDayOffs = dayOffs.filter(d => d.personnel_id === p.id);
        return {
          ...p,
          weeklyDayOffs: personelDayOffs,
        };
      });
      setData(merged);

      const allDayOffs = mockDb.getAllDayOffs();
      setSingleDayOffs(allDayOffs);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteDayOff = (id: string) => {
    if (confirm('Silmek istediğinizden emin misiniz?')) {
      try {
        mockDb.removeDayOff(id);
        toast.success('Günlük izin silindi');
        fetchData();
      } catch (error) {
        toast.error('Silme başarısız');
      }
    }
  };

  const handleDeleteWeeklyDayOff = (id: string) => {
    if (confirm('Haftalık izni silmek istediğinizden emin misiniz?')) {
      try {
        mockDb.removeWeeklyDayOff(id);
        toast.success('Haftalık izin silindi');
        fetchData();
      } catch (error) {
        toast.error('Silme başarısız');
      }
    }
  };

  const handleBulkDeleteSingle = () => {
    if (selectedSingleIds.length === 0) return;
    if (confirm(`${selectedSingleIds.length} adet kaydı silmek istediğinize emin misiniz?`)) {
      try {
        selectedSingleIds.forEach(id => mockDb.removeDayOff(id));
        toast.success(`${selectedSingleIds.length} günlük izin silindi`);
        setSelectedSingleIds([]);
        fetchData();
      } catch (error) {
        toast.error('Silme başarısız');
      }
    }
  };

  const handleBulkDeleteWeekly = () => {
    if (selectedWeeklyIds.length === 0) return;
    if (confirm(`${selectedWeeklyIds.length} adet kaydı silmek istediğinize emin misiniz?`)) {
      try {
        selectedWeeklyIds.forEach(id => mockDb.removeWeeklyDayOff(id));
        toast.success(`${selectedWeeklyIds.length} haftalık izin silindi`);
        setSelectedWeeklyIds([]);
        fetchData();
      } catch (error) {
        toast.error('Silme başarısız');
      }
    }
  };
  
  const filteredSingleDayOffs = singleDayOffs.filter(d => {
    if (filter === 'all') return true;
    const date = new Date(d.day_date);
    const now = new Date();
    if (filter === 'weekly') return date >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (filter === 'monthly') return date >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return true;
  });

  const getPersonnelName = (id: string) => {
    const personnel = mockDb.getAllPersonnel();
    const person = personnel.find(p => p.id === id);
    return person ? `${person.first_name} ${person.last_name}` : 'Bilinmeyen';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="h-6 w-6" /> İzin Günleri
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
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Haftalık İzin Günleri</CardTitle>
          {selectedWeeklyIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDeleteWeekly}>
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
                  <TableHead>Reyon</TableHead>
                  <TableHead>İzin Günü</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead>İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map(p => (
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
                          <Badge key={d.id} variant="secondary">{DAYS[d.day_of_week]}</Badge>
                        )) : <span className="text-muted-foreground">Seçilmemiş</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.weeklyDayOffs.length > 0 && p.weeklyDayOffs[0].description ? p.weeklyDayOffs[0].description : '-'}
                    </TableCell>
                    <TableCell>
                      {p.weeklyDayOffs.length > 0 && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteWeeklyDayOff(p.weeklyDayOffs[0].id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {singleDayOffs.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Günlük İzinler</CardTitle>
            {selectedSingleIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBulkDeleteSingle}>
                <Trash2 className="w-4 h-4 mr-2" /> Toplu Sil ({selectedSingleIds.length})
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
                         checked={filteredSingleDayOffs.length > 0 && selectedSingleIds.length === filteredSingleDayOffs.length}
                         onCheckedChange={(c) => setSelectedSingleIds(c ? filteredSingleDayOffs.map(d => d.id) : [])}
                       />
                    </TableHead>
                    <TableHead>Personel</TableHead>
                    <TableHead>Tarih</TableHead>
                    <TableHead>Açıklama</TableHead>
                    <TableHead>İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSingleDayOffs.map(dayOff => (
                    <TableRow key={dayOff.id}>
                      <TableCell>
                        <Checkbox 
                          checked={selectedSingleIds.includes(dayOff.id)}
                          onCheckedChange={() => setSelectedSingleIds(prev => prev.includes(dayOff.id) ? prev.filter(i => i !== dayOff.id) : [...prev, dayOff.id])}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{getPersonnelName(dayOff.personnel_id)}</TableCell>
                      <TableCell>{format(new Date(dayOff.day_date), 'dd MMMM yyyy', { locale: tr })}</TableCell>
                      <TableCell>{dayOff.description || '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteDayOff(dayOff.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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

export default DayOffView;
