import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { mockDb } from '@/services/mockDatabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Coffee, Calendar, LogOut, Trash2, Activity, Clock, Umbrella } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const EmployeePanel = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [personnel, setPersonnel] = useState<any>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayOffs, setDayOffs] = useState<any[]>([]);
  const [activeBreak, setActiveBreak] = useState<any>(null);
  const [recentBreaks, setRecentBreaks] = useState<any[]>([]);
  const [todayBreaks, setTodayBreaks] = useState<any[]>([]);
  const [breakLimit, setBreakLimit] = useState(60);
  const [loading, setLoading] = useState(true);
  const [weeklyDayOffDescription, setWeeklyDayOffDescription] = useState<string>('');
  const [weeklyDayOffObj, setWeeklyDayOffObj] = useState<any>(null);
  const [monthlyStats, setMonthlyStats] = useState({ overtime: 0, credit: 0 });
  const [leaveStats, setLeaveStats] = useState({ entitlement: 0, used: 0, remaining: 0 });

  // Calculate work duration
  const calculateWorkDuration = (startDate: string) => {
    const start = new Date(startDate);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    return { months, days };
  };

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

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchData = () => {
      try {
        const p = mockDb.getPersonnelById(user.id);
        setPersonnel(p);
        
        if (!p) {
          toast.error('Personel bilgileri bulunamadı');
          setLoading(false);
          return;
        }

        const days = mockDb.getWeeklyDayOffs(p.id);
        setSelectedDays(days.map(d => d.day_of_week));
        if (days.length > 0) {
          if (days[0].description) setWeeklyDayOffDescription(days[0].description);
          setWeeklyDayOffObj(days[0]);
        }

        const settings = mockDb.getSettings();
        setBreakLimit(settings.breakLimitMinutes);

        const allUserBreaks = mockDb.getBreaksByPersonnelId(p.id);
        const todayStr = new Date().toISOString().split('T')[0];
        const tb = allUserBreaks.filter(b => b.break_start.startsWith(todayStr));
        setTodayBreaks(tb);
        const ab = tb.find(b => !b.break_end);
        setActiveBreak(ab || null);
        
        const rb = allUserBreaks
          .filter(b => b.break_end)
          .sort((a, b) => new Date(b.break_end!).getTime() - new Date(a.break_end!).getTime())
          .slice(0, 5);
        setRecentBreaks(rb);

        // Fetch Overtimes
        const thisMonth = new Date().toISOString().slice(0, 7);
        const allOvertimes = mockDb.getOvertimes(p.id).filter(o => o.record_date.startsWith(thisMonth));
        const overtime = allOvertimes.filter(r => !r.record_type.toLowerCase().includes('alacak') && !r.record_type.toLowerCase().includes('kullanım')).reduce((s, r) => s + Number(r.hours), 0);
        const credit = allOvertimes.filter(r => r.record_type.toLowerCase().includes('alacak') || r.record_type.toLowerCase().includes('kullanım')).reduce((s, r) => s + Number(r.hours), 0);
        setMonthlyStats({ overtime, credit });

        // Fetch Annual Leaves
        const leaves = mockDb.getAnnualLeaves(p.id).filter(l => l.status === 'approved');
        const used = leaves.reduce((s, l) => s + l.total_days, 0);
        const entitlement = calculateEntitlement(p.start_date);
        setLeaveStats({ entitlement, used, remaining: entitlement - used });

        setLoading(false);
      } catch (error) {
        toast.error('Veri yükleme hatası');
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  const toggleDay = (day: number) => {
    if (!personnel) return;
    
    if (selectedDays.includes(day)) {
      if (weeklyDayOffObj) mockDb.removeWeeklyDayOff(weeklyDayOffObj.id);
      setSelectedDays(selectedDays.filter(d => d !== day));
      setWeeklyDayOffObj(null);
      toast.success('İzin günü talebi kaldırıldı');
    } else {
      mockDb.addWeeklyDayOff(personnel.id, day, weeklyDayOffDescription);
      setSelectedDays([day]);
      toast.success('Haftalık izin günü olarak ayarlandı');
      const updated = mockDb.getWeeklyDayOffs(personnel.id);
      if (updated.length > 0) setWeeklyDayOffObj(updated[0]);
    }
  };

  const startBreak = () => {
    if (!personnel) return;
    try {
      const breakRecord = mockDb.addBreakRecord({ personnel_id: personnel.id, break_start: new Date().toISOString(), break_end: null });
      setActiveBreak(breakRecord);
      toast.success('Mola başladı!');
    } catch (error) {
      toast.error('Mola başlatılamadı');
    }
  };

  const endBreak = () => {
    if (!activeBreak) return;
    try {
      mockDb.endBreak(activeBreak.id);
      
      const allUserBreaks = mockDb.getBreaksByPersonnelId(personnel.id);
      const todayStr = new Date().toISOString().split('T')[0];
      setTodayBreaks(allUserBreaks.filter(b => b.break_start.startsWith(todayStr)));
      
      const rb = allUserBreaks
        .filter(b => b.break_end)
        .sort((a, b) => new Date(b.break_start).getTime() - new Date(a.break_start).getTime())
        .slice(0, 5);
      setRecentBreaks(rb);
      setActiveBreak(null);
      toast.success('Mola bitti!');
    } catch (error) {
      toast.error('Mola kapatılamadı');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      toast.error('Çıkış yapılamadı');
    }
  };

  if (loading || !personnel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="glass-card max-w-md w-full text-center">
          <CardContent className="p-8">
            <p className="text-muted-foreground mb-4">
              {!personnel ? 'Hesabınıza bağlı personel kaydı bulunamadı.' : 'Yükleniyor...'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {!personnel && 'Lütfen admin ile iletişime geçin.'}
            </p>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" /> Çıkış Yap
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{personnel.first_name} {personnel.last_name}</h1>
            <p className="text-muted-foreground">{personnel.department}</p>
            {personnel.start_date && (() => {
              const { months, days } = calculateWorkDuration(personnel.start_date);
              return (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
                  ⏱️ {months} ay {days} gün ({(months * 30 + days)} gün) çalışıyor
                </p>
              );
            })()}
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" /> Çıkış
          </Button>
        </div>

        {/* Break Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Coffee className="h-5 w-5" /> Mola</CardTitle>
            <CardDescription>Mola durumunuzu takip edin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeBreak ? (
              <>
                <div className="p-4 bg-warning/10 rounded-lg text-center">
                  <p className="text-lg font-semibold text-foreground">Moladasınız</p>
                </div>
                <Button onClick={endBreak} className="w-full" variant="default">
                  <Coffee className="w-4 h-4 mr-2" /> Moladan Geldim
                </Button>
              </>
            ) : (
              <Button onClick={startBreak} className="w-full" variant="outline">
                <Coffee className="w-4 h-4 mr-2" /> Molaya Çıktım
              </Button>
            )}

            <DailyBreakTracker todayBreaks={todayBreaks} activeBreak={activeBreak} limitMinutes={breakLimit} />

            {recentBreaks.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Son Molalar</p>
                {recentBreaks.map(b => {
                  const dur = Math.round((new Date(b.break_end!).getTime() - new Date(b.break_start).getTime()) / (1000 * 60));
                  return (
                    <div key={b.id} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                      <span>{format(new Date(b.break_start), 'dd.MM HH:mm')}</span>
                      <span className={dur > 60 ? 'text-destructive font-medium' : ''}>{dur} dk</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Kontrol Paneli Özetleri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400">
                  <Clock className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Aylık Fazla Mesai</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Kazanılan: <span className="font-bold text-foreground">{monthlyStats.overtime} Saat</span></p>
                  <p className="text-xs text-muted-foreground">Kullanılan Alacak: <span className="font-bold text-foreground">{monthlyStats.credit} Saat</span></p>
                  <div className="h-px bg-border my-2"></div>
                  <p className="text-sm font-semibold">Bakiye: <span className={monthlyStats.overtime - monthlyStats.credit < 0 ? 'text-destructive' : 'text-green-600'}>{monthlyStats.overtime - monthlyStats.credit} Saat</span></p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400">
                  <Coffee className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Mola İhlal Özeti</h3>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">İhlale Düşen Mola Sayısı: <span className="font-bold text-foreground">- Kez</span></p>
                  <p className="text-xs text-muted-foreground">Toplam Geç Gelme Süresi: <span className="font-bold text-foreground">{personnel.total_overdue_break || 0} Dk</span></p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400">
                  <Umbrella className="h-4 w-4" />
                  <h3 className="font-semibold text-sm">Yıllık İzin Durumu</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span>Kullanılan: {leaveStats.used}</span>
                    <span>Hak: {leaveStats.entitlement}</span>
                  </div>
                  <Progress value={leaveStats.entitlement > 0 ? (leaveStats.used / leaveStats.entitlement) * 100 : 0} className="h-2" />
                  <p className="text-sm font-semibold mt-1">Kalan İzin: <span className={leaveStats.remaining < 0 ? 'text-destructive' : 'text-green-600'}>{leaveStats.remaining} Gün</span></p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day Off Selection */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Haftalık İzin Günü</CardTitle>
            <CardDescription>İzin kullanmak istediğiniz günü seçin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Açıklama Giriniz</label>
              <Input 
                placeholder="Örn: Hafta sonu izni" 
                value={weeklyDayOffDescription}
                onChange={(e) => setWeeklyDayOffDescription(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DAYS.map((day, i) => (
                <Button
                  key={i}
                  variant={selectedDays.includes(i) ? 'default' : 'outline'}
                  onClick={() => toggleDay(i)}
                  className={`w-full ${selectedDays.includes(i) ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'}`}
                >
                  {day}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Not: Dilerseniz var olan izninize tıklayarak doğrudan iptal edebilir veya açıklamayı değiştirebilirsiniz.
            </p>
          </CardContent>
        </Card>
      </div>

      <footer className="mt-8 text-center pb-6 text-sm font-medium text-muted-foreground">
        Tasarlayan Turgay DOLU
      </footer>
    </div>
  );
};

const DailyBreakTracker = ({ todayBreaks, activeBreak, limitMinutes }: { todayBreaks: any[], activeBreak: any, limitMinutes: number }) => {
  const [totalConsumedSeconds, setTotalConsumedSeconds] = useState(0);

  useEffect(() => {
    const update = () => {
      let consumed = 0;
      todayBreaks.forEach(b => {
        const start = new Date(b.break_start).getTime();
        const end = b.break_end ? new Date(b.break_end).getTime() : Date.now();
        if (!b.break_end && activeBreak && activeBreak.id === b.id) return; // handled by activeBreak block later
        consumed += Math.floor((end - start) / 1000);
      });
      if (activeBreak) {
         consumed += Math.floor((Date.now() - new Date(activeBreak.break_start).getTime()) / 1000);
      }
      setTotalConsumedSeconds(consumed);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [todayBreaks, activeBreak]);

  const limitSeconds = limitMinutes * 60;
  const remainingSeconds = limitSeconds - totalConsumedSeconds;
  
  useEffect(() => {
      if (activeBreak && remainingSeconds === 300) { 
          toast.warning('Molanızın bitmesine son 5 dakika kalmıştır!', { duration: 10000 });
      }
  }, [remainingSeconds, activeBreak]);

  const isExceeded = remainingSeconds < 0;
  
  const formatTime = (totalSeconds: number) => {
    const abs = Math.abs(totalSeconds);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60);
    const s = abs % 60;
    return `${totalSeconds < 0 ? '-' : ''}${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`mt-4 p-4 rounded-lg text-center border transition-colors ${isExceeded ? 'bg-destructive/10 border-destructive shadow-sm' : 'bg-secondary/20 border-transparent'}`}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-medium">Günlük Kullanım</p>
          <p className="text-xl font-mono font-semibold">{formatTime(totalConsumedSeconds)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground font-medium">Kalan Süre</p>
          <p className={`text-xl font-mono font-bold ${isExceeded ? 'text-destructive animate-pulse' : 'text-green-600 dark:text-green-500'}`}>
            {formatTime(remainingSeconds)}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">Günlük Toplam Mola Hakkı: <b>{limitMinutes} dakika</b></p>
    </div>
  );
};

export default EmployeePanel;
