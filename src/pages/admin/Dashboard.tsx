import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, Zap, Package, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';

const Dashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard_data'],
    queryFn: async () => {
      const [
        { data: personnel },
        { data: breaks },
        { data: movements },
        { data: dayOffs },
        { data: overtimes },
        { data: shipments },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('personnel').select('*'),
        supabase.from('break_records').select('*'),
        supabase.from('personnel_movements').select('*'),
        supabase.from('weekly_day_off').select('*'),
        supabase.from('overtime_records').select('*'),
        supabase.from('cargo_shipments').select('*'),
        supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').maybeSingle()
      ]);
      return { 
        personnel: personnel || [], 
        breaks: breaks || [], 
        movements: movements || [], 
        dayOffs: dayOffs || [], 
        overtimes: overtimes || [],
        shipments: shipments || [],
        weeklySchedule: settingsData?.setting_value?.weeklySchedule || []
      };
    },
    refetchInterval: 30000
  });

  if (isLoading || !data) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Dashboard yükleniyor...</div>;
  }

  const { personnel, breaks, movements, dayOffs, overtimes, shipments, weeklySchedule } = data;
  const activePersonnel = personnel.filter(p => p.is_active);
  const onBreakRecords = breaks.filter(b => b.break_end === null);

  return (
    <div className="space-y-4 animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground mb-6">Kontrol Paneli</h2>

      <TodayShiftCard weeklySchedule={weeklySchedule} breaks={breaks} personnel={activePersonnel} />

      <BreaksCard breaks={onBreakRecords} personnel={activePersonnel} />
      <DailyBreaksCard breaks={breaks} personnel={activePersonnel} />
      <MovementsCard movements={movements} personnel={activePersonnel} />
      <CargoStatusCard shipments={shipments} />
      <OvertimeReceivablesCard overtimes={overtimes} personnel={activePersonnel} />
    </div>
  );
};

const LiveBreakBadge = ({ activeBreak }: { activeBreak: any }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const update = () => {
      const ms = Date.now() - new Date(activeBreak.break_start).getTime();
      setElapsed(Math.floor(ms / 60000));
    };
    update();
    const int = setInterval(update, 60000);
    return () => clearInterval(int);
  }, [activeBreak]);

  const limit = 60;
  const remaining = limit - elapsed;

  if (remaining < 0) {
    return <span className="shrink-0 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 animate-pulse border border-red-200" title="Süre aşıldı!">İhlal Süresi ({Math.abs(remaining)}dk)</span>;
  }

  return <span className="shrink-0 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 animate-pulse border border-blue-200">Molada ({elapsed}dk, Kalan: {remaining}dk)</span>;
};

const TodayShiftCard = ({ weeklySchedule, breaks, personnel }: any) => {
  if (!weeklySchedule || weeklySchedule.length === 0) return null;

  const daysTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const todayName = daysTr[new Date().getDay()];

  // structure: { "Erkek Reyonu": { "Sabah": [], "Akşam": [], "İzinli": [] } }
    const shifts: Record<string, any> = {}; 

    weeklySchedule.forEach((row: any) => {
        const adSoyad = row['Ad Soyad']?.toString().trim();
        if (!adSoyad || adSoyad === '----------------' || adSoyad === 'Personel Bulunamadı') return;
        const reyon = row['Reyon']?.toString().trim() || 'Diğer';
        const rawVal = (row[todayName] || '').toString().trim();

        const isDepoRow = reyon.startsWith('Depo (') || reyon === '--- DEPO ÇALIŞMASI ---';
        const isMutfakRow = reyon.startsWith('Mutfak (') || reyon === '--- MUTFAK ÇALIŞMASI ---';

        if (!shifts[adSoyad]) {
            shifts[adSoyad] = { 
                reyon: reyon, 
                shiftVal: '', 
                hasDepo: false, 
                hasMutfak: false,
                category: 'Belirsiz'
            };
        }

        if (!isDepoRow && !isMutfakRow) {
            shifts[adSoyad].reyon = reyon;
            if (rawVal) {
                shifts[adSoyad].shiftVal = rawVal;
                const upVal = rawVal.toUpperCase();
                if (upVal.startsWith('S')) shifts[adSoyad].category = 'Sabah';
                else if (upVal.startsWith('A')) shifts[adSoyad].category = 'Akşam';
                else if (upVal.startsWith('İ') || upVal.startsWith('I')) shifts[adSoyad].category = 'İzinli';
                else shifts[adSoyad].category = 'Diğer';
                
                if (rawVal.includes('+')) {
                    if (rawVal.toLowerCase().includes('depo')) shifts[adSoyad].hasDepo = true;
                    if (rawVal.toLowerCase().includes('mutfak')) shifts[adSoyad].hasMutfak = true;
                }
            }
        } else if (isDepoRow) {
            if (rawVal && rawVal !== '-') shifts[adSoyad].hasDepo = true;
        } else if (isMutfakRow) {
            if (rawVal && rawVal !== '-') shifts[adSoyad].hasMutfak = true;
        }
    });

    const grouped: Record<string, Record<string, string[]>> = {};

    Object.entries(shifts).forEach(([adSoyad, data]) => {
        if (!data.shiftVal && !data.hasDepo && !data.hasMutfak) return;
        let cat = data.category;
        if (!data.shiftVal && (data.hasDepo || data.hasMutfak)) cat = 'Ek Görev (Sınıflandırılmamış Shift)';
        if (cat === 'Belirsiz') return;

        let extra = '';
        if (data.hasMutfak && !data.shiftVal.toLowerCase().includes('mutfak')) extra += ' + Mutfak Temizliği';
        if (data.hasDepo && !data.shiftVal.toLowerCase().includes('depo')) extra += ' + Depo Çalışması';
        
        if (data.shiftVal.includes('+')) {
          const splitPos = data.shiftVal.indexOf('+');
          const customExtra = data.shiftVal.substring(splitPos);
          if (!customExtra.toLowerCase().includes('mutfak') && !customExtra.toLowerCase().includes('depo')) {
             extra += ' ' + customExtra;
          }
        }

        const finalReyon = data.reyon.replace('Depo (', '').replace('Mutfak (', '').replace(')', '');
        if (!grouped[finalReyon]) grouped[finalReyon] = { 'Sabah': [], 'Akşam': [], 'İzinli': [] };
        if (!grouped[finalReyon][cat]) grouped[finalReyon][cat] = [];
        
        grouped[finalReyon][cat].push(`${adSoyad}${extra}`);
    });

  const getBreakBadge = (pString: string) => {
    if (!personnel || !breaks) return null;
    const nameOnly = pString.split('+')[0].trim();
    const person = personnel.find((per: any) => `${per.first_name} ${per.last_name}`.trim().toLowerCase() === nameOnly.toLowerCase());
    if (!person) return null;

    const todayStr = new Date().toISOString().split('T')[0];
    const todayBreaks = breaks.filter((b: any) => (b.break_start || '').startsWith(todayStr) && b.personnel_id === person.id);
    if (todayBreaks.length === 0) return null;

    const active = todayBreaks.find((b: any) => !b.break_end);
    if (active) return <LiveBreakBadge activeBreak={active} />;

    const violation = todayBreaks.find((b: any) => {
      if (!b.break_end) return false;
      const start = new Date(b.break_start).getTime();
      const end = new Date(b.break_end).getTime();
      return Math.round((end - start) / (1000 * 60)) > 60;
    });

    if (violation) {
      const start = new Date(violation.break_start).getTime();
      const end = new Date(violation.break_end).getTime();
      const dur = Math.round((end - start) / (1000 * 60));
      return <span className="shrink-0 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">İhlal ({dur}dk)</span>;
    }

    const totalFinishedDuration = todayBreaks.reduce((acc: number, b: any) => {
       if (!b.break_end) return acc;
       const start = new Date(b.break_start).getTime();
       const end = new Date(b.break_end).getTime();
       return acc + Math.round((end - start) / (1000 * 60));
    }, 0);

    return <span className="shrink-0 ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">Mola Bitti ({totalFinishedDuration}dk)</span>;
  };

  return (
    <Card className="glass-card border-primary/20 bg-card">
      <CardHeader className="bg-primary/5 pb-3">
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Bugünün Vardiya ve Görev Özeti ({todayName})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-6">
        {Object.entries(grouped).map(([reyon, cats]) => (
          <div key={reyon} className="border rounded-lg p-4 bg-background/50">
            <h3 className="text-lg font-bold text-foreground mb-3 border-b pb-1">🛍️ {reyon}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Sabah */}
              {cats['Sabah'] && cats['Sabah'].length > 0 && (
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded border border-blue-100 dark:border-blue-900/30">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">☀️ Sabah Vardiyası</h4>
                  <ul className="text-sm space-y-1.5">
                    {cats['Sabah'].map((p, i) => (
                      <li key={i} className="text-foreground flex items-center justify-between border-b border-border/30 pb-1 last:border-0 last:pb-0">
                        <span className="truncate pr-1 leading-tight">{p.replace(/\+/g, ' + ')}</span>
                        {getBreakBadge(p)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Akşam */}
              {cats['Akşam'] && cats['Akşam'].length > 0 && (
                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded border border-indigo-100 dark:border-indigo-900/30">
                  <h4 className="font-semibold text-indigo-700 dark:text-indigo-400 mb-2">🌙 Akşam Vardiyası</h4>
                  <ul className="text-sm space-y-1.5">
                    {cats['Akşam'].map((p, i) => (
                      <li key={i} className="text-foreground flex items-center justify-between border-b border-border/30 pb-1 last:border-0 last:pb-0">
                        <span className="truncate pr-1 leading-tight">{p.replace(/\+/g, ' + ')}</span>
                        {getBreakBadge(p)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* İzinli */}
              {cats['İzinli'] && cats['İzinli'].length > 0 && (
                <div className="bg-orange-50/50 dark:bg-orange-900/10 p-3 rounded border border-orange-100 dark:border-orange-900/30">
                  <h4 className="font-semibold text-orange-700 dark:text-orange-400 mb-2">⛔ İzinli</h4>
                  <ul className="text-sm space-y-1.5">
                    {cats['İzinli'].map((p, i) => (
                      <li key={i} className="text-foreground flex items-center justify-between border-b border-border/30 pb-1 last:border-0 last:pb-0">
                        <span className="truncate pr-1 leading-tight">{p.replace(/\+/g, ' + ')}</span>
                        {getBreakBadge(p)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Sadece Ek Görev (Shift Yok) */}
              {cats['Ek Görev (Sınıflandırılmamış Shift)'] && cats['Ek Görev (Sınıflandırılmamış Shift)'].length > 0 && (
                <div className="bg-muted p-3 rounded border border-border">
                  <h4 className="font-semibold text-muted-foreground mb-2">📌 Ek Görevli</h4>
                  <ul className="text-sm space-y-1.5">
                    {cats['Ek Görev (Sınıflandırılmamış Shift)'].map((p, i) => (
                      <li key={i} className="text-foreground flex items-center justify-between border-b border-border/30 pb-1 last:border-0 last:pb-0">
                        <span className="truncate pr-1 leading-tight">{p.replace(/\+/g, ' + ')}</span>
                        {getBreakBadge(p)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <p className="text-muted-foreground text-center py-4">Bugüne ait kayıtlı vardiya/görev planı bulunmuyor.</p>
        )}
      </CardContent>
    </Card>
  );
};

const CargoStatusCard = ({ shipments }: any) => {
  const activeShipments = shipments
    .filter((s: any) => s.total_boxes > s.counted_boxes)
    .sort((a: any, b: any) => new Date(a.arrival_date).getTime() - new Date(b.arrival_date).getTime());

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Aktif Tır / Koli Sevkiyat Durumu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {activeShipments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bekleyen aktif kargo/koli sevkiyatı yok</p>
          ) : (
            activeShipments.map((s: any) => {
              const remaining = Math.max(0, s.total_boxes - s.counted_boxes);
              const progress = s.total_boxes > 0 ? (s.counted_boxes / s.total_boxes) * 100 : 0;
              return (
                <div key={s.id} className="p-3 rounded-lg border bg-muted/20">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium text-sm">{format(new Date(s.arrival_date), 'dd.MM.yyyy')} Sevkiyatı</p>
                    <span className="text-xs font-semibold px-2 py-1 bg-primary/10 text-primary rounded">Kalan: {remaining}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Toplam: {s.total_boxes}</span>
                    <span>Sayılan: {s.counted_boxes}</span>
                  </div>
                  <div className="w-full bg-secondary/20 h-2 rounded-full overflow-hidden">
                    <div className="bg-primary h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                  </div>
                  {s.notes && <p className="text-xs text-muted-foreground mt-2 italic">{s.notes}</p>}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const OvertimeReceivablesCard = ({ overtimes, personnel }: any) => {
  const getPersonnelName = (id: string, withDept=false) => {
    const p = personnel.find((p: any) => p.id === id);
    if (!p) return 'Bilinmiyor';
    return withDept ? `${p.first_name} ${p.last_name} (${p.department})` : `${p.first_name} ${p.last_name}`;
  };

  const balances: Record<string, number> = {};
  overtimes.forEach((o: any) => {
    const isEarning = !(o.record_type || '').toLowerCase().includes('kullanım') && !(o.record_type || '').toLowerCase().includes('alacak');
    // wait, earned includes normal overtimes. Used is 'kullanım'. Let's look closely at EmployeePanel usage:
    // earned: not ('alacak' or 'kullanım') => actually in employee panel: earned = !(alacak or kullanım). Then 'alacak' and 'kullanım' are used credit.
    // wait, let's just make sure "isEarning": if It's "Kullanılan", it's negative.
    const isUsed = (o.record_type || '').toLowerCase().includes('kullanım') || (o.record_type || '').toLowerCase().includes('alacak');
    const h = Number(o.hours || 0);
    if (!balances[o.personnel_id]) balances[o.personnel_id] = 0;
    balances[o.personnel_id] += isUsed ? -h : h;
  });

  const receivables = Object.entries(balances)
    .filter(([_, bal]) => bal > 0)
    .sort((a, b) => b[1] - a[1]) // highest first
    .slice(0, 10);

  const formatDuration = (totalH: number) => {
    const d = Math.floor(totalH / 8);
    const remH = totalH - (d * 8);
    const h = Math.floor(remH);
    const m = Math.round((remH - h) * 60);
    let parts = [];
    if (d > 0) parts.push(`${d} G`);
    if (h > 0) parts.push(`${h} S`);
    if (m > 0) parts.push(`${m} Dk`);
    return parts.length > 0 ? parts.join(' ') : '0';
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Fazla Mesai Alacak Listesi (İlk 10)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {receivables.length === 0 ? (
            <p className="text-muted-foreground text-sm">Alacaklı personel bulunmuyor</p>
          ) : (
            receivables.map(([pId, bal]) => (
              <div key={pId} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border">
                <div>
                  <p className="font-medium text-sm">{getPersonnelName(pId, true)}</p>
                </div>
                <div className="text-xs font-semibold px-2 py-1 rounded bg-success/20 text-success">
                  {formatDuration(bal)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const BreaksCard = ({ breaks, personnel }: any) => {
  const getPersonnelName = (id: string) => {
    const p = personnel.find((p: any) => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Bilinmiyor';
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Molada Olanlar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {breaks.length === 0 ? (
            <p className="text-muted-foreground text-sm">Şu anda molada olan yok</p>
          ) : (
            breaks.slice(0, 10).map((b: any) => {
              const startTime = new Date(b.break_start);
              const duration = Math.round((new Date().getTime() - startTime.getTime()) / (1000 * 60));
              return (
                <div key={b.id} className="flex items-center justify-between p-2 rounded-lg bg-info/10 border border-info/20">
                  <div>
                    <p className="font-medium text-sm">{getPersonnelName(b.personnel_id)}</p>
                    <p className="text-xs text-muted-foreground">{format(startTime, 'HH:mm', { locale: tr })}</p>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-1 rounded ${duration > 60 ? 'bg-warning/20 text-warning' : 'bg-info/20 text-info'}`}>
                    {duration} dk
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const MovementsCard = ({ movements, personnel }: any) => {
  const getPersonnelName = (id: string) => {
    const p = personnel.find((p: any) => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Bilinmiyor';
  };

  const activeMovements = movements.filter((m: any) => {
    const now = new Date().getTime();
    return new Date(m.start_date).getTime() <= now && new Date(m.end_date).getTime() >= now - 86400000;
  });

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Aktif Hareketler (İzin, Hastalık vb.)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
          {activeMovements.length === 0 ? (
            <p className="text-muted-foreground col-span-full">Şu anda aktif hareket yok</p>
          ) : (
            activeMovements.slice(0, 8).map((m: any) => {
              const startDate = new Date(m.start_date);
              const endDate = new Date(m.end_date);
              return (
                <div key={m.id} className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="font-medium text-sm">{getPersonnelName(m.personnel_id)}</p>
                  <p className="text-xs font-semibold text-warning mt-1">{m.movement_type}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(startDate, 'dd.MM', { locale: tr })} - {format(endDate, 'dd.MM.yyyy', { locale: tr })}
                  </p>
                  <p className="text-xs text-muted-foreground">{m.total_days} gün</p>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const DailyBreaksCard = ({ breaks, personnel }: any) => {
  const getPersonnelName = (id: string, dept=false) => {
    const p = personnel.find((p: any) => p.id === id);
    if (!p) return 'Bilinmiyor';
    return dept ? `${p.first_name} ${p.last_name} (${p.department})` : `${p.first_name} ${p.last_name}`;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todayBreaks = breaks.filter((b: any) => (b.break_start || '').startsWith(todayStr) && b.break_end !== null)
    .sort((a: any, b: any) => new Date(b.break_start).getTime() - new Date(a.break_start).getTime());

  const formatTime = (iso: string) => format(new Date(iso), 'HH:mm', { locale: tr });
  
  const limit = 60; // 60 minutes limit
  
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Bugün Tamamlanan ve İhlal Molaları
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {todayBreaks.length === 0 ? (
            <p className="text-muted-foreground text-sm">Bugün tamamlanan mola kaydı yok</p>
          ) : (
            todayBreaks.map((b: any) => {
              const start = new Date(b.break_start);
              const end = new Date(b.break_end);
              const dur = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
              const isViolation = dur > limit;
              
              return (
                <div key={b.id} className={`flex items-center justify-between p-2 rounded-lg border ${isViolation ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/30 border-border/50'}`}>
                  <div>
                    <p className={`font-medium text-sm ${isViolation ? 'text-destructive font-semibold' : ''}`}>{getPersonnelName(b.personnel_id)}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(b.break_start)} - {formatTime(b.break_end)}</p>
                  </div>
                  <div className={`text-xs font-semibold px-2 py-1 rounded ${isViolation ? 'bg-destructive/20 text-destructive' : 'bg-secondary/10 text-secondary'}`}>
                    {dur} dk {isViolation && ' (İhlal)'}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Dashboard;
