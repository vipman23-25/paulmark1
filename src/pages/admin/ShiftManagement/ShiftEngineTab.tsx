import { useState, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { FileDown, Calendar as CalIcon, Settings2, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

const DAYS_TR = ['P.TESİ', 'SALI', 'ÇARŞ', 'PERŞ', 'CUMA', 'C.TESİ', 'PAZAR'];
const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const formatDateTR = (dateStr: string) => {
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const d = new Date(dateStr);
    return `${d.getDate()} ${months[d.getMonth()]}`;
};

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
          { data: pastSchedules },
          { data: shiftPrefs },
          { data: shiftCodesRaw }
        ] = await Promise.all([
          supabase.from('personnel').select('*').eq('is_active', true),
          supabase.from('personnel_movements').select('*'),
          supabase.from('weekly_day_off').select('*').in('status', ['approved', 'pending']), // Default to accepting if pending, as old records have it
          supabase.from('department_shift_rules').select('*'),
          supabase.from('shift_schedules').select('*').gte('shift_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
          supabase.from('shift_preferences').select('*').eq('status', 'approved'),
          supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'shift_codes').maybeSingle()
        ]);

        const defaultCodes = [
          { code: 'S', label: 'S - Sabah' },
          { code: 'A', label: 'A - Akşam' },
          { code: 'S+M', label: 'S+M - Sabah Mutfak' },
          { code: 'A+M', label: 'A+M - Akşam Mutfak' },
          { code: 'S+D', label: 'S+D - Sabah Depo' },
          { code: 'A+D', label: 'A+D - Akşam Depo' },
          { code: 'İ', label: 'İ - İzin' },
          { code: 'R', label: 'R - Raporlu' },
          { code: 'O', label: 'O - Ortak' },
          { code: '-', label: '-' }
        ];

        return {
          personnel: personnel || [],
          movements: movements || [],
          dayOffs: dayOffs || [],
          deptRules: deptRules || [],
          pastSchedules: pastSchedules || [],
          shiftPrefs: shiftPrefs || [],
          shiftCodes: shiftCodesRaw?.setting_value || defaultCodes
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

    const weekDates = getWeekDates(selectedWeekStart);
    const newGrid: any[] = [];

    const getVirtualDept = (dept: string) => {
        const lowerDept = dept.toLowerCase();
        if (lowerDept.includes('kadın') || lowerDept.includes('çocuk') || lowerDept.includes('bayan')) {
            return 'Kadın & Çocuk Reyon';
        }
        return dept;
    };

    const isAbsence = (code: string) => ['İ', 'R', 'Yİ', 'Üİ', 'ÜS'].includes(code);

    const targetOrder = ['Müdür', 'Kadın & Çocuk Reyon', 'Erkek Reyon', 'Kasiyer'];
    const depts = Array.from(new Set(engineContext.personnel.map((p: any) => getVirtualDept(p.department))));
    depts.sort((a, b) => {
      let ia = targetOrder.indexOf(a);
      let ib = targetOrder.indexOf(b);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });

    let collisionError = "";

    depts.forEach(dept => {
      const deptStaff = engineContext.personnel.filter(p => getVirtualDept(p.department) === dept);
      const rows: any[] = [];
      
      // Step 1: Initialize rows and map absences
      deptStaff.forEach(p => {
        const row: any = { personnel_id: p.id, adSoyad: `${p.first_name} ${p.last_name}`, department: dept, originalDept: p.department, shifts: {}, preferredShift: {} };
        const pMovements = engineContext.movements.filter(m => m.personnel_id === p.id);
        
        weekDates.forEach((dateStr) => {
            const hasMovement = pMovements.find(m => {
                if (!m.start_date) return false;
                const mStart = m.start_date.substring(0, 10);
                const mEnd = m.end_date ? m.end_date.substring(0, 10) : mStart;
                return mStart <= dateStr && mEnd >= dateStr;
            });
            if (hasMovement && hasMovement.movement_type) {
                row.shifts[dateStr] = hasMovement.movement_type; // e.g. R, Yİ
            }
        });
        rows.push(row);
      });

      // Müdür için atama döngüsünden çık (Tamamen boş kalır)
      if (dept.toLowerCase().includes('müdür')) {
          weekDates.forEach((dateStr) => {
             rows.forEach(r => r.shifts[dateStr] = ''); 
          });
          newGrid.push(...rows);
          return; 
      }

      // Step 2: Map explicit Day Offs (Haftalık İzin)
      deptStaff.forEach((p, idx) => {
        const row = rows[idx];
        const pDayOffs = engineContext.dayOffs.filter(d => d.personnel_id === p.id);
        
        weekDates.forEach((dateStr) => {
           const dObj = new Date(dateStr);
           let dayOfWeek = dObj.getDay();
           if (dayOfWeek === 0) dayOfWeek = 7; // Sunday is 7

           if (pDayOffs.some(d => d.day_of_week === dayOfWeek) && !row.shifts[dateStr]) {
               row.shifts[dateStr] = 'İ'; // Haftalık izin
           }
        });
      });

      // Step 3: Auto-assign missing Day Offs
      deptStaff.forEach((p, idx) => {
        const row = rows[idx];
        const hasDayOff = weekDates.some(d => isAbsence(row.shifts[d]));
        if (!hasDayOff) {
            let assigned = false;
            for (let d = 0; d < 5; d++) {
                const dateStr = weekDates[d];
                const countOff = rows.filter(r => isAbsence(r.shifts[dateStr])).length;
                if (countOff === 0) {
                    row.shifts[dateStr] = 'İ';
                    assigned = true;
                    break;
                }
            }
            if (!assigned) row.shifts[weekDates[0]] = 'İ'; 
        }
      });

      // Step 4: Collision Check
      weekDates.forEach(dateStr => {
          const offStaff = rows.filter(r => isAbsence(r.shifts[dateStr]));
          if (offStaff.length >= 2 && deptStaff.length >= 2) {
              const names = offStaff.map(r => r.adSoyad).join(", ");
              collisionError = `Hata: ${dept} reyonunda ${names} aynı gün (${dateStr}) izin/rapor durumundadır. Lütfen hareketleri kontrol edin.`;
          }
      });

      // Step 5: Special Requests (Preferences)
      deptStaff.forEach((p, idx) => {
         const row = rows[idx];
         const pPrefs = engineContext.shiftPrefs.filter(sp => sp.personnel_id === p.id);
         weekDates.forEach((dateStr) => {
             const dObj = new Date(dateStr);
             let dayOfWeek = dObj.getDay();
             if (dayOfWeek === 0) dayOfWeek = 7;

             const pref = pPrefs.find(sp => sp.day_of_week === dayOfWeek);
             if (pref && !row.shifts[dateStr]) {
                 row.preferredShift[dateStr] = pref.requested_shift === 'Sabah' ? 'S' : 'A';
             }
         });
      });

      // Step 6: Distribution Algorithm based on ACTIVE staff
      weekDates.forEach((dateStr, dIdx) => {
          const unassignedRows = rows.filter(r => !r.shifts[dateStr]);
          if (unassignedRows.length === 0) return;

          const activeRows = rows.filter(r => !isAbsence(r.shifts[dateStr]));
          const totalActive = activeRows.length; // Remaining active people today
          
          let targetS = 0;
          let targetA = 0;

          // Distribution Rules based on Active Worker Count (Evening > Morning generally, but 2 people is 1S 1A)
          if (totalActive === 2) { targetS = 1; targetA = 1; }
          else if (totalActive === 3) { targetS = 1; targetA = 2; }
          else if (totalActive === 4) { targetS = 1; targetA = 3; }
          else if (totalActive === 5) { targetS = 2; targetA = 3; }
          else if (totalActive === 6) { targetS = 2; targetA = 4; }
          else if (totalActive >= 7) { targetS = 3; targetA = totalActive - 3; }
          else if (totalActive === 1) { targetS = 0; targetA = 1; }

          let currentS = 0;
          let currentA = 0;

          // Rotation & Balancing Logic
          unassignedRows.sort((rA, rB) => {
              const prevDateStr = dIdx > 0 ? weekDates[dIdx - 1] : null;
              const rAPrev = prevDateStr ? rA.shifts[prevDateStr] : null;
              const rBPrev = prevDateStr ? rB.shifts[prevDateStr] : null;

              let scoreA = 0; // High score = give S, Low score = give A
              let scoreB = 0;

              // 1. Rotation (Avoid same shift consecutively)
              if (rAPrev === 'S') scoreA -= 20; // Needs A
              if (rAPrev === 'A') scoreA += 20; // Needs S

              if (rBPrev === 'S') scoreB -= 20;
              if (rBPrev === 'A') scoreB += 20;

              // 2. Weekly Max 4 Evenings (Adalet Kuralı)
              const rAWeekAksam = weekDates.filter(d => ['A', 'A+M', 'A+D'].includes(rA.shifts[d])).length;
              const rBWeekAksam = weekDates.filter(d => ['A', 'A+M', 'A+D'].includes(rB.shifts[d])).length;

              const rAWeekSabah = weekDates.filter(d => ['S', 'S+M', 'S+D'].includes(rA.shifts[d])).length;
              const rBWeekSabah = weekDates.filter(d => ['S', 'S+M', 'S+D'].includes(rB.shifts[d])).length;

              if (rAWeekAksam >= 4) scoreA += 100; // Force S
              if (rBWeekAksam >= 4) scoreB += 100;

              // 2.5 Weekly MIN 3 Evenings Rule
              const remainingDays = 7 - dIdx;
              if (rAWeekAksam + remainingDays <= 3) scoreA -= 200; // MUST give A
              if (rBWeekAksam + remainingDays <= 3) scoreB -= 200; // MUST give A

              // 2.6 If unbalanced, Evening must be greater than Morning
              if (rAWeekSabah > rAWeekAksam) scoreA -= 150; // Needs A heavily
              if (rBWeekSabah > rBWeekAksam) scoreB -= 150; // Needs A heavily

              // 3. Preferences (Onaylı Tercihler)
              if (rA.preferredShift[dateStr] === 'S') scoreA += 50;
              if (rA.preferredShift[dateStr] === 'A') scoreA -= 50;

              if (rB.preferredShift[dateStr] === 'S') scoreB += 50;
              if (rB.preferredShift[dateStr] === 'A') scoreB -= 50;

              // 4. Monthly Balance
              const pastSabahCountA = engineContext.pastSchedules.filter(s => s.personnel_id === rA.personnel_id && ['S', 'Sabah'].includes(s.shift_type)).length;
              const pastAksamCountA = engineContext.pastSchedules.filter(s => s.personnel_id === rA.personnel_id && ['A', 'Akşam'].includes(s.shift_type)).length;
              if (pastAksamCountA > pastSabahCountA) scoreA += 10; // Needs S

              const pastSabahCountB = engineContext.pastSchedules.filter(s => s.personnel_id === rB.personnel_id && ['S', 'Sabah'].includes(s.shift_type)).length;
              const pastAksamCountB = engineContext.pastSchedules.filter(s => s.personnel_id === rB.personnel_id && ['A', 'Akşam'].includes(s.shift_type)).length;
              if (pastAksamCountB > pastSabahCountB) scoreB += 10;

              return scoreB - scoreA; // Descending order (highest score gets S first)
          });

          // Assignment loop
          unassignedRows.forEach(row => {
             let assignS = false;
             
             if (currentS < targetS && currentA < targetA) {
                 assignS = true; // Top scorer gets S
             } else if (currentS < targetS) {
                 assignS = true; // Forced S because A is full
             } else {
                 assignS = false; // Forced A because S is full
             }

             if (assignS) {
                 row.shifts[dateStr] = 'S';
                 currentS++;
             } else {
                 row.shifts[dateStr] = 'A';
                 currentA++;
             }
          });
      });

      newGrid.push(...rows);
    });

    const finalOrder = ['müdür', 'kasiyer', 'çocuk', 'kadın', 'bayan', 'erkek'];
    newGrid.sort((a, b) => {
        const aDept = a.originalDept.toLocaleLowerCase('tr-TR');
        const bDept = b.originalDept.toLocaleLowerCase('tr-TR');

        let ia = finalOrder.findIndex(dept => aDept.includes(dept));
        let ib = finalOrder.findIndex(dept => bDept.includes(dept));

        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;

        if (ia !== ib) return ia - ib;
        return a.adSoyad.localeCompare(b.adSoyad, 'tr-TR');
    });

    if (collisionError) {
        toast.error(collisionError, { duration: 8000 });
        return; 
    }

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
    const targetOrder = ['Müdür', 'Kadın & Çocuk Reyon', 'Erkek Reyon', 'Kasiyer'];
    const currentDepts = Array.from(new Set(generatedGrid.map(r => r.department)));
    currentDepts.sort((a, b) => {
      let ia = targetOrder.indexOf(a);
      let ib = targetOrder.indexOf(b);
      if (ia === -1) ia = 999;
      if (ib === -1) ib = 999;
      if (ia !== ib) return ia - ib;
      return a.localeCompare(b);
    });
    
    // We can also inject summary rows into the export
    const exportData: any[] = [];
    currentDepts.forEach(dept => {
        const deptRows = generatedGrid.filter(r => r.department === dept);
        deptRows.forEach(row => {
          const obj: any = { 'Grup': row.department, 'Orijinal Departman': row.originalDept, 'Ad Soyad': row.adSoyad };
          weekDates.forEach((dateStr, i) => { obj[`${DAYS[i]} (${dateStr})`] = row.shifts[dateStr]; });
          exportData.push(obj);
        });
        
        // Emtpy row separator for Excel clarity
        exportData.push({});
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

             <div className="border border-black/30 rounded-xl overflow-hidden mt-4 shadow-sm bg-white">
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse text-black">
                       <thead>
                          <tr className="bg-gray-200 text-center border-b-2 border-black/40">
                             <th className="border-r border-black/20 p-1.5 w-10 font-bold"></th>
                             <th className="border-r border-black/20 p-1.5 w-[200px] font-bold text-left pl-3">ADI SOYADI</th>
                             <th className="border-r border-black/20 p-1.5 w-[140px] font-bold text-left pl-3">GÖREVİ</th>
                             {getWeekDates(selectedWeekStart).map((dateStr, i) => (
                                 <th key={dateStr} className="border-r border-black/20 p-1.5 w-[85px]">
                                     <div className="font-bold">{DAYS_TR[i]}</div>
                                     <div className="font-normal italic text-[11px] leading-tight">{formatDateTR(dateStr)}</div>
                                 </th>
                             ))}
                             <th className="p-1.5 w-16 bg-yellow-200 border-l-2 border-black/40 font-bold text-red-600">AKŞAM</th>
                          </tr>
                       </thead>
                       <tbody>
                           {(() => {
                            const finalOrder = ['müdür', 'kasiyer', 'çocuk', 'kadın', 'bayan', 'erkek'];
                            const currentDepts = Array.from(new Set(generatedGrid.map(r => r.originalDept)));
                            currentDepts.sort((a, b) => {
                              let ia = finalOrder.findIndex(dept => a.toLocaleLowerCase('tr-TR').includes(dept));
                              let ib = finalOrder.findIndex(dept => b.toLocaleLowerCase('tr-TR').includes(dept));
                              if (ia === -1) ia = 999;
                              if (ib === -1) ib = 999;
                              if (ia !== ib) return ia - ib;
                              return a.localeCompare(b, 'tr-TR');
                            });

                            let globalRowCounter = 1;
                            const deptTotals: any[] = []; // for daily summary table

                            return (
                                <>
                                {currentDepts.map((dept, deptIdx) => {
                                    const deptRows = generatedGrid.filter(r => r.originalDept === dept);
                                    if (deptRows.length === 0) return null;

                                    const dailyTotals = getWeekDates(selectedWeekStart).map(dateStr => {
                                        let sabahCount = 0;
                                        let aksamCount = 0;
                                        deptRows.forEach(r => {
                                            const val = r.shifts[dateStr] || '';
                                            if (val.startsWith('S')) sabahCount++;
                                            else if (val.startsWith('A')) aksamCount++;
                                        });
                                        return { sabah: sabahCount, aksam: aksamCount };
                                    });
                                    deptTotals.push({ dept, dailyTotals });

                                    return (
                                      <Fragment key={dept}>
                                          {deptRows.map((row, rIdx) => {
                                              const aksamTotal = getWeekDates(selectedWeekStart).filter(d => (row.shifts[d] || '').startsWith('A')).length;
                                              return (
                                                  <tr key={row.personnel_id} className="border-b border-black/20 hover:bg-black/5">
                                                      <td className="text-center font-bold text-xs border-r border-black/20">{globalRowCounter++}</td>
                                                      <td className="font-bold border-r border-black/20 pl-3 uppercase">{row.adSoyad}</td>
                                                      <td className="font-bold italic text-xs border-r border-black/20 pl-3 uppercase">{row.originalDept}</td>
                                                      {getWeekDates(selectedWeekStart).map(dateStr => {
                                                          const val = row.shifts[dateStr] || '';
                                                          return (
                                                              <td key={dateStr} className="p-0 border-r border-black/20">
                                                                  <select 
                                                                    className="w-full h-full min-h-[32px] text-center bg-transparent outline-none font-bold text-sm cursor-pointer hover:bg-black/5 appearance-none"
                                                                    value={val}
                                                                    onChange={e => handleCellChange(row.personnel_id, dateStr, e.target.value)}
                                                                  >
                                                                    {engineContext.shiftCodes.filter((c: any) => c.is_active !== false).map((c: any) => (
                                                                        <option key={c.code} value={c.code}>{c.code}</option>
                                                                    ))}
                                                                  </select>
                                                              </td>
                                                          );
                                                      })}
                                                      <td className="text-center font-bold border-l-2 border-black/40">{aksamTotal > 0 ? aksamTotal : ''}</td>
                                                  </tr>
                                              );
                                          })}
                                          {/* Boş satır ile reyonları ayır (Excel'deki gibi), ancak Çocuk ve Kadın arasına boşluk koyma */}
                                          {(() => {
                                              if (deptIdx >= currentDepts.length - 1) return null;
                                              const currentLower = dept.toLocaleLowerCase('tr-TR');
                                              const nextDept = currentDepts[deptIdx + 1].toLocaleLowerCase('tr-TR');
                                              const isCocukAndKadin = currentLower.includes('çocuk') && (nextDept.includes('kadın') || nextDept.includes('bayan'));
                                              
                                              if (isCocukAndKadin) return null;

                                              return (
                                                  <tr className="h-6 border-b-2 border-black/40 bg-gray-50">
                                                      <td colSpan={11}></td>
                                                  </tr>
                                              );
                                          })()}
                                      </Fragment>
                                    );
                                })}

                                {/* En alt Genel Özet Tablosu */}
                                <tr className="h-8 border-t-4 border-black/60 bg-gray-100">
                                    <td colSpan={11}></td>
                                </tr>
                                <tr className="bg-yellow-200 border-y border-black/40 font-bold text-red-600 text-center">
                                    <td colSpan={3} className="text-right pr-4 border-r border-black/40">AKŞAM TOPLAM</td>
                                    {getWeekDates(selectedWeekStart).map((dateStr, i) => {
                                        const sumA = deptTotals.reduce((acc, curr) => acc + curr.dailyTotals[i].aksam, 0);
                                        return <td key={dateStr} className="border-r border-black/40 text-black">{sumA}</td>;
                                    })}
                                    <td className="bg-gray-100 border-l-2 border-black/40"></td>
                                </tr>
                                <tr className="bg-yellow-100 border-b-2 border-black/40 font-bold text-red-600 text-center">
                                    <td colSpan={3} className="text-right pr-4 border-r border-black/40">SABAH TOPLAM</td>
                                    {getWeekDates(selectedWeekStart).map((dateStr, i) => {
                                        const sumS = deptTotals.reduce((acc, curr) => acc + curr.dailyTotals[i].sabah, 0);
                                        return <td key={dateStr} className="border-r border-black/40 text-black">{sumS}</td>;
                                    })}
                                    <td className="bg-gray-100 border-l-2 border-black/40"></td>
                                </tr>
                                </>
                            );
                          })()}
                       </tbody>
                    </table>
                 </div>
             </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ShiftEngineTab;
