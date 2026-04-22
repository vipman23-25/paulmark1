import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FileDown, Calendar as CalIcon, Settings2, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const ShiftEngineTab = () => {
  const queryClient = useQueryClient();
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [generatedGrid, setGeneratedGrid] = useState<any[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);

  // Fetch all necessary data for the engine
  const { data: engineContext, isLoading } = useQuery({
    queryKey: ['shift_engine_context'],
    queryFn: async () => {
      const [
        { data: personnel },
        { data: movements },
        { data: dayOffs },
        { data: deptRules },
        { data: pastSchedules }
      ] = await Promise.all([
        supabase.from('personnel').select('*').eq('is_active', true),
        supabase.from('personnel_movements').select('*'),
        supabase.from('weekly_day_off').select('*').eq('status', 'approved'),
        supabase.from('department_shift_rules').select('*'),
        supabase.from('shift_schedules').select('*').gte('shift_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      ]);

      return {
        personnel: personnel || [],
        movements: movements || [],
        dayOffs: dayOffs || [],
        deptRules: deptRules || [],
        pastSchedules: pastSchedules || []
      };
    }
  });

  const getWeekDates = (startStr: string) => {
    const dates = [];
    const startObj = new Date(startStr);
    for (let i = 0; i < 7; i++) {
        const d = new Date(startObj);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const handleGenerate = () => {
    if (!selectedWeekStart) return toast.error('Lütfen haftanın başlama tarihi (Pazartesi) seçiniz.');
    if (!engineContext) return;

    // VERY BASIC GENERATOR ALGORITHM implementation based on Phase 4 spec
    const weekDates = getWeekDates(selectedWeekStart);
    const newGrid: any[] = [];

    const depts = Array.from(new Set(engineContext.personnel.map(p => p.department)));

    depts.forEach(dept => {
      const deptStaff = engineContext.personnel.filter(p => p.department === dept);
      
      deptStaff.forEach(p => {
        const row: any = { personnel_id: p.id, adSoyad: `${p.first_name} ${p.last_name}`, department: dept, shifts: {} };
        const pDayOffs = engineContext.dayOffs.filter(d => d.personnel_id === p.id);
        const pMovements = engineContext.movements.filter(m => m.personnel_id === p.id);
        const pPast = engineContext.pastSchedules.filter(s => s.personnel_id === p.id);
        const pastSabahCount = pPast.filter(s => ['S', 'Sabah'].includes(s.shift_type)).length;

        // Auto selection
        weekDates.forEach((dateStr, idx) => {
            const dayOfWeek = idx + 1; // 1: Mon, ... 7: Sun
            
            // 1. Check fixed movements first
            const hasMovement = pMovements.some(m => m.start_date <= dateStr && m.end_date >= dateStr);
            if (hasMovement) {
                row.shifts[dateStr] = 'R'; // Raporlu/Izinli
                return;
            }

            // 2. Check weekly day off
            const isDayOff = pDayOffs.some(d => d.day_of_week === dayOfWeek);
            if (isDayOff) {
                row.shifts[dateStr] = 'İ'; // İzin Günü
                return;
            }

            // 3. Assign Sabah/Aksam (dumb logic for now, just balancing based on past 30 days)
            // Real version would check dept constraints per day.
            if (pastSabahCount < 10) {
              row.shifts[dateStr] = 'S';
            } else {
              row.shifts[dateStr] = 'A';
            }
        });

        newGrid.push(row);
      });
    });

    setGeneratedGrid(newGrid);
    setIsGenerated(true);
    toast.success('Haftalık Vardiya Listesi Taslağı Oluşturuldu! Düzenleyip kaydedebilirsiniz.');
  };

  const handleCellChange = (pId: string, dateStr: string, val: string) => {
      setGeneratedGrid(prev => prev.map(row => {
          if (row.personnel_id === pId) {
              return { ...row, shifts: { ...row.shifts, [dateStr]: val } };
          }
          return row;
      }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
        const weekDates = getWeekDates(selectedWeekStart);
        // Wipe existing for this week to allow recreation
        const { error: delErr } = await supabase.from('shift_schedules').delete().in('shift_date', weekDates);
        
        const inserts: any[] = [];
        generatedGrid.forEach(row => {
            weekDates.forEach(dateStr => {
                const shift_type = row.shifts[dateStr] || 'A';
                inserts.push({
                    personnel_id: row.personnel_id,
                    shift_date: dateStr,
                    shift_type: shift_type,
                    week_start_date: selectedWeekStart,
                    is_manual_override: true
                });
            });
        });

        // Add chunking if needed for large teams, using single insert for now
        const { error: insErr } = await supabase.from('shift_schedules').insert(inserts);
        if (insErr) throw insErr;
    },
    onSuccess: () => {
        toast.success("Vardiya Listesi Başarıyla Veritabanına Kaydedildi!");
        queryClient.invalidateQueries({ queryKey: ['shift_schedules'] });
    },
    onError: (e: any) => {
        toast.error("Vardiya kaydedilirken hata oluştu: " + e.message);
    }
  });

  const generateExcel = () => {
    if (!isGenerated) return;
    const weekDates = getWeekDates(selectedWeekStart);
    const exportData = generatedGrid.map(row => {
      const obj: any = {
        'Departman': row.department,
        'Ad Soyad': row.adSoyad
      };
      weekDates.forEach((dateStr, i) => {
        obj[`${DAYS[i]} (${dateStr})`] = row.shifts[dateStr];
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Haftalık Vardiya");
    XLSX.writeFile(wb, `Vardiya_${selectedWeekStart}.xlsx`);
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="bg-muted/30 border-b pb-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-xl">Vardiya Motoru</CardTitle>
            <CardDescription>Otomatik dengeleme motorunu başlatarak taslak listeyi görün. Müdahale edip kaydedin.</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="border rounded-lg bg-background flex items-center px-2 shadow-sm">
               <CalIcon className="w-4 h-4 text-muted-foreground mr-2"/>
               <input 
                 type="date" 
                 className="outline-none py-2 text-sm bg-transparent" 
                 value={selectedWeekStart} 
                 onChange={e => setSelectedWeekStart(e.target.value)}
                 title="Haftanın Pazartesi Günü"
               />
            </div>
            <Button onClick={handleGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white"><Settings2 className="w-4 h-4 mr-2"/> Otomatik Hazırla</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {isLoading && <div className="text-center p-8 animate-pulse text-muted-foreground">Motor verileri yükleniyor...</div>}
        
        {!isLoading && !isGenerated && (
            <div className="flex flex-col items-center justify-center p-12 lg:p-24 border-2 border-dashed rounded-xl bg-muted/10">
                <RefreshCw className="w-12 h-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold text-foreground">Vardiya Listesi Bekliyor</h3>
                <p className="text-sm text-center text-muted-foreground max-w-sm mt-1">Yukarıdan başlama tarihi (Pazartesi) seçip "Otomatik Hazırla" butonuna tıklayarak taslak oluşturabilirsiniz.</p>
            </div>
        )}

        {isGenerated && generatedGrid.length > 0 && (
          <div className="space-y-4 animate-fade-in">
             <div className="flex justify-between items-center bg-primary/5 p-3 rounded-lg border border-primary/20">
                <p className="text-sm font-medium">✨ Taslak tablo oluşturuldu. Hücrelere tıklayarak "S", "A", "İ", "R" değerlerini manuel değiştirebilirsiniz.</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={generateExcel}><FileDown className="w-4 h-4 mr-1"/> Excel'e Aktar</Button>
                    <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Kaydediliyor...' : 'Onayla ve Kaydet'}</Button>
                </div>
             </div>

             <div className="border rounded-xl overflow-hidden mt-4 shadow-sm">
                 <div className="overflow-x-auto">
                    <Table className="bg-card">
                       <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                             <TableHead className="w-[180px] border-r">Personel</TableHead>
                             <TableHead className="w-[120px] border-r">Reyon</TableHead>
                             {getWeekDates(selectedWeekStart).map((dateStr, i) => (
                                 <TableHead key={dateStr} className="text-center font-bold">
                                     {DAYS[i]} <br/><span className="text-[10px] font-normal text-muted-foreground">{dateStr.split('-')[2]}.{dateStr.split('-')[1]}</span>
                                 </TableHead>
                             ))}
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {generatedGrid.map((row, rIdx) => (
                              <TableRow key={row.personnel_id} className={rIdx % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                                  <TableCell className="font-semibold border-r">{row.adSoyad}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground border-r">{row.department}</TableCell>
                                  {getWeekDates(selectedWeekStart).map(dateStr => {
                                      const val = row.shifts[dateStr] || '';
                                      return (
                                          <TableCell key={dateStr} className="p-1">
                                              <select 
                                                className={`w-full h-full text-center p-2 rounded outline-none font-bold text-xs ring-1 ring-inset ${val === 'S' ? 'bg-yellow-50 text-yellow-700 ring-yellow-200' : val === 'A' ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : val === 'İ' ? 'bg-green-50 text-green-700 ring-green-200' : val === 'R' ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-transparent ring-border'}`}
                                                value={val}
                                                onChange={e => handleCellChange(row.personnel_id, dateStr, e.target.value)}
                                              >
                                                <option value="S">S - Sabah</option>
                                                <option value="A">A - Akşam</option>
                                                <option value="İ">İ - İzin</option>
                                                <option value="R">R - Raporlu</option>
                                                <option value="O">O - Ortak</option>
                                                <option value="-">-</option>
                                              </select>
                                          </TableCell>
                                      );
                                  })}
                              </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                 </div>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShiftEngineTab;
