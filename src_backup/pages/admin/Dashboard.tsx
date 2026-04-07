import { useEffect, useState } from 'react';
import { mockDb } from '@/services/mockDatabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Clock, AlertTriangle, Calendar, MapPin, Zap, Bell, Umbrella } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';

const Dashboard = () => {
  const [stats, setStats] = useState({ 
    total: 0, 
    active: 0, 
    onBreak: 0, 
    movements: 0,
    dayOffs: 0,
    overtimes: 0,
    reminders: 0
  });
  const [activePersonnel, setActivePersonnel] = useState<any[]>([]);
  const [breakRecords, setBreakRecords] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);

  const calculateWorkDuration = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    return { months, days };
  };

  useEffect(() => {
    const fetchData = () => {
      try {
        const personnel = mockDb.getAllPersonnel();
        const allBreaks = mockDb.getAllBreaks() || [];
        const allMovements = mockDb.getAllMovements() || [];
        const allDayOffs = mockDb.getAllWeeklyDayOffs() || [];
        const allOvertimes = mockDb.getAllOvertimes() || [];

        const activePersonnelList = personnel.filter(p => p.is_active);
        const onBreakCount = allBreaks.filter(b => b.break_end === null).length;

        setStats({
          total: personnel.length,
          active: activePersonnelList.length,
          onBreak: onBreakCount,
          movements: allMovements.length,
          dayOffs: allDayOffs.length,
          overtimes: allOvertimes.length,
          reminders: 0
        });

        setActivePersonnel(activePersonnelList);
        setBreakRecords(allBreaks.filter(b => b.break_end === null));
        setMovements(allMovements);
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      }
    };
    
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const cards = [
    { title: 'Toplam Personel', value: stats.total, icon: Users, color: 'text-primary', bg: 'bg-primary/5' },
    { title: 'Aktif Personel', value: stats.active, icon: Users, color: 'text-success', bg: 'bg-success/5' },
    { title: 'Molada', value: stats.onBreak, icon: Clock, color: 'text-info', bg: 'bg-info/5' },
    { title: 'Hareketler', value: stats.movements, icon: MapPin, color: 'text-warning', bg: 'bg-warning/5' },
    { title: 'İzin Günleri', value: stats.dayOffs, icon: Calendar, color: 'text-secondary', bg: 'bg-secondary/5' },
    { title: 'Fazla Mesai', value: stats.overtimes, icon: Zap, color: 'text-destructive', bg: 'bg-destructive/5' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {cards.map((card) => (
          <Card key={card.title} className={`glass-card ${card.bg}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivePersonnelCard personnel={activePersonnel} />
        <BreaksCard breaks={breakRecords} personnel={activePersonnel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <MovementsCard movements={movements} personnel={activePersonnel} />
        <AnnualLeaveCard personnel={activePersonnel} />
      </div>
    </div>
  );
};

const ActivePersonnelCard = ({ personnel }: any) => {
  const calculateWorkDuration = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    return { months, days };
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Aktif Personel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {personnel.length === 0 ? (
            <p className="text-muted-foreground">Henüz personel eklenmemiş</p>
          ) : (
            personnel.slice(0, 10).map((p: any) => {
              const { months, days } = calculateWorkDuration(p.start_date);
              return (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-white text-sm font-semibold">
                      {p.first_name.charAt(0)}{p.last_name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{p.first_name} {p.last_name}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>{p.department}</span>
                        <span>•</span>
                        <span>{months}ay {days}g</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs px-2 py-1 rounded-full bg-success/20 text-success whitespace-nowrap">Aktif</div>
                </div>
              );
            })
          )}
          {personnel.length > 10 && (
            <p className="text-xs text-muted-foreground text-center py-2">+{personnel.length - 10} daha</p>
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

  const movementTypes: { [key: string]: string } = {
    'izi': 'İzin',
    'hastalık': 'Hastalık İzni',
    'muafiyet': 'Muafiyet'
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Hareketler (İzin, Hastalık vb.)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
          {movements.length === 0 ? (
            <p className="text-muted-foreground col-span-full">Şu anda aktif hareket yok</p>
          ) : (
            movements.slice(0, 8).map((m: any) => {
              const startDate = new Date(m.start_date);
              const endDate = new Date(m.end_date);
              return (
                <div key={m.id} className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="font-medium text-sm">{getPersonnelName(m.personnel_id)}</p>
                  <p className="text-xs font-semibold text-warning mt-1">{movementTypes[m.movement_type] || m.movement_type}</p>
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

const AnnualLeaveCard = ({ personnel }: any) => {
  const calculateEntitlement = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365.25));
    let total = 0;
    for (let i = 1; i <= diffYears; i++) {
      if (i <= 5) total += 14;
      else if (i <= 15) total += 20;
      else total += 26;
    }
    return total;
  };
  
  const leaves = mockDb.getAllAnnualLeaves().filter((l: any) => l.status === 'approved');
  let entitlement = 0;
  personnel.forEach((p: any) => entitlement += calculateEntitlement(p.start_date));
  const used = leaves.reduce((s: number, l: any) => s + l.total_days, 0);
  const remaining = Math.max(0, entitlement - used);

  const data = [
    { name: 'Kullanılan', value: used, color: '#f97316' }, 
    { name: 'Kalan', value: remaining, color: '#22c55e' }, 
  ];

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Umbrella className="h-5 w-5" />
          Şirket Geneli Yıllık İzin Oranı
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entitlement === 0 ? (
          <p className="text-muted-foreground text-sm">Düzenli çalışan izin hakkedişi bulunamadı</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-4">
              <div className="flex items-center gap-2 text-sm"><div className="w-3 h-3 rounded-full bg-orange-500"></div> Kullanılan ({used} Gün)</div>
              <div className="flex items-center gap-2 text-sm"><div className="w-3 h-3 rounded-full bg-green-500"></div> Kalan ({remaining} Gün)</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Dashboard;
