import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, MapPin, Zap, Package } from 'lucide-react';
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
      ] = await Promise.all([
        supabase.from('personnel').select('*'),
        supabase.from('break_records').select('*'),
        supabase.from('personnel_movements').select('*'),
        supabase.from('weekly_day_off').select('*'),
        supabase.from('overtime_records').select('*'),
        supabase.from('cargo_shipments').select('*')
      ]);
      return { 
        personnel: personnel || [], 
        breaks: breaks || [], 
        movements: movements || [], 
        dayOffs: dayOffs || [], 
        overtimes: overtimes || [],
        shipments: shipments || []
      };
    },
    refetchInterval: 30000
  });

  if (isLoading || !data) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Dashboard yükleniyor...</div>;
  }

  const { personnel, breaks, movements, dayOffs, overtimes, shipments } = data;
  const activePersonnel = personnel.filter(p => p.is_active);
  const onBreakRecords = breaks.filter(b => b.break_end === null);

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground">Kontrol Paneli</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OvertimeReceivablesCard overtimes={overtimes} personnel={activePersonnel} />
        <BreaksCard breaks={onBreakRecords} personnel={activePersonnel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <MovementsCard movements={movements} personnel={activePersonnel} />
        <DailyBreaksCard breaks={breaks} personnel={activePersonnel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <CargoStatusCard shipments={shipments} />
      </div>
    </div>
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
