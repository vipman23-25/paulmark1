import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { MapPin, CalendarDays, Umbrella, Coffee, ImagePlus, UserCheck, Timer, Calendar, Info, Clock, Activity, Target, LogOut, Bell, Package, Plus, Minus } from "lucide-react";
import { format } from 'date-fns';

const DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const calculateWorkDuration = (startDate: string | null | undefined) => {
  if (!startDate) return { months: 0, days: 0 };
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return { months: 0, days: 0 };
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return { months: Math.floor(diffDays / 30), days: diffDays % 30 };
};

const calculateEntitlement = (startDate: string | null | undefined) => {
  if (!startDate) return 0;
  const start = new Date(startDate);
  if (isNaN(start.getTime())) return 0;
  const diffYears = Math.floor(Math.abs(new Date().getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  let total = 0;
  for (let i = 1; i <= diffYears; i++) {
    if (i <= 5) total += 14;
    else if (i <= 15) total += 20;
    else total += 26;
  }
  return total;
};

const EmployeePanel = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dayOffDescription, setDayOffDescription] = useState('');

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  const { data: personnel, isLoading: loadingPersonnel } = useQuery({
    queryKey: ['personnel', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('id', user?.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  const { data: generalSettings } = useQuery({
    queryKey: ['general_settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').single();
      return data?.setting_value || {};
    }
  });
  const breakLimit = Number(generalSettings?.breakLimitMinutes || 60);
  const announcementImages = generalSettings?.announcementImages || [];
  const baseFeatures = generalSettings?.employeeDashboardFeatures || {
    showOvertime: true,
    showBreakViolations: true,
    showLeaveStatus: true,
    showSalesTargets: true,
    showMovements: true,
    showReminders: true,
  };

  const pVis = (personnel as any)?.module_visibility || {};
  
  const features = {
    showBreak: pVis.showBreak ?? true,
    showOvertime: pVis.showOvertime ?? baseFeatures.showOvertime,
    showBreakViolations: pVis.showBreak ?? baseFeatures.showBreakViolations,
    showLeaveStatus: pVis.showLeave ?? baseFeatures.showLeaveStatus,
    showSalesTargets: pVis.showSales ?? baseFeatures.showSalesTargets,
    showMovements: pVis.showMovements ?? baseFeatures.showMovements,
    showReminders: pVis.showAnnouncements ?? baseFeatures.showReminders,
    showCargoStatus: pVis.showCargo ?? true,
  };

  const { data: dashboardData, isLoading: loadingData } = useQuery({
    queryKey: ['employee_dashboard', personnel?.id],
    queryFn: async (): Promise<any> => {
      if (!personnel?.id) return null;
      const currentMonth = new Date().toISOString().substring(0, 7);
      const [
        { data: weeklyDayOffs },
        { data: breaks },
        { data: overtimes },
        { data: movements },
        { data: reminders },
        { data: allDepartmentSalesTargets },
        { data: shipments }
      ] = await Promise.all([
        supabase.from('weekly_day_off').select('*').eq('personnel_id', personnel.id),
        supabase.from('break_records').select('*').eq('personnel_id', personnel.id),
        supabase.from('overtime_records').select('*').eq('personnel_id', personnel.id),
        supabase.from('personnel_movements').select('*').eq('personnel_id', personnel.id).order('start_date', { ascending: false }),
        (supabase.from('reminders').select('*').eq('is_active', true).order('reminder_date', { ascending: true }) as any),
        (supabase.from('sales_targets' as any).select('*, personnel!inner(department)').eq('personnel.department', personnel.department || 'Bilinmiyor').eq('target_month', currentMonth) as any),
        supabase.from('cargo_shipments' as any).select('*').order('arrival_date', { ascending: true })
      ]);
      
      const safeReminders = (reminders || []).filter((r: any) => 
        r.personnel_id === personnel.id || 
        r.department_name === personnel.department || 
        r.department_name === 'Tümü'
      );
      
      const salesTarget = (allDepartmentSalesTargets || []).find((s: any) => s.personnel_id === personnel.id) || null;
      const deptTargetQuota = (allDepartmentSalesTargets || []).reduce((acc: number, curr: any) => acc + (Number(curr.target_quota) || 0), 0);
      const deptRealizedSales = (allDepartmentSalesTargets || []).reduce((acc: number, curr: any) => acc + (Number(curr.realized_sales) || 0), 0);

      return { 
        weeklyDayOffs: weeklyDayOffs || [], 
        breaks: breaks || [], 
        overtimes: overtimes || [], 
        movements: movements || [],
        reminders: safeReminders || [],
        salesTarget,
        deptTargetQuota,
        deptRealizedSales,
        shipments: shipments || []
      };
    },
    enabled: !!personnel?.id,
    refetchInterval: 30000
  });

  const updateCargoMutation = useMutation({
    mutationFn: async ({ id, newCount, totalBoxes, notes }: { id: string, newCount: number, totalBoxes: number, notes?: string }) => {
      const isComplete = newCount >= totalBoxes;
      
      const payload: any = { 
        counted_boxes: newCount, 
        status: isComplete ? 'Tamamlandı' : 'Sayılıyor',
        completion_date: isComplete ? new Date().toISOString() : null
      };

      if (notes !== undefined) {
        payload.notes = notes;
      }

      const { error } = await supabase
        .from('cargo_shipments' as any)
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      toast.success('Koli sayımı güncellendi');
    },
    onError: (error: any) => {
      toast.error('Koli güncellenemedi: ' + error.message);
    }
  });

  const updateCargoComplete = useMutation({
    mutationFn: async ({ id, isComplete }: { id: string, isComplete: boolean }) => {
      const { error } = await supabase
        .from('cargo_shipments' as any)
        .update({ status: isComplete ? 'Tamamlandı' : 'Sayılıyor' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      toast.success('Sevkiyat durumu güncellendi');
    }
  });

  const toggleDayMutation = useMutation({
    mutationFn: async ({ day, isSelected, allIds, description }: { day: number, isSelected: boolean, allIds: string[], description?: string }) => {
      if (allIds.length > 0) {
        const { error: delErr } = await supabase.from('weekly_day_off').delete().in('id', allIds);
        if (delErr) throw delErr;
      }
      if (!isSelected) {
        const { error: insErr } = await supabase.from('weekly_day_off').insert({ personnel_id: personnel.id, day_of_week: day, description });
        if (insErr) throw insErr;
        return { deleted: false };
      }
      return { deleted: true };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard', personnel?.id] });
      toast.success(res.deleted ? 'İzin günü talebi kaldırıldı' : 'Haftalık izin günü olarak ayarlandı');
    },
    onError: (error: any) => {
      console.error("Day Off Error:", error);
      toast.error('İzin günü ayarlanamadı: ' + (error.message || 'Bilinmeyen hata'));
    }
  });

  const startBreakMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('break_records').insert({ personnel_id: personnel!.id, break_start: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard', personnel?.id] });
      toast.success('Mola başladı!');
    }
  });

  const endBreakMutation = useMutation({
    mutationFn: async (breakId: string) => {
      const { error } = await supabase.from('break_records').update({ break_end: new Date().toISOString() }).eq('id', breakId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard', personnel?.id] });
      toast.success('Mola bitti!');
    }
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      toast.error('Çıkış yapılamadı');
    }
  };

  useEffect(() => {
    if (dashboardData?.weeklyDayOffs && dashboardData.weeklyDayOffs.length > 0) {
      setDayOffDescription(dashboardData.weeklyDayOffs[0].description || '');
    }
  }, [dashboardData?.weeklyDayOffs]);

  if (loadingPersonnel || loadingData) {
    return <div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>;
  }

  if (!personnel) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="glass-card max-w-md w-full text-center">
          <CardContent className="p-8">
            <p className="text-muted-foreground mb-4">Hesabınıza bağlı personel kaydı bulunamadı. Lütfen admin ile iletişime geçin.</p>
            <Button variant="outline" onClick={handleSignOut}><LogOut className="w-4 h-4 mr-2" /> Çıkış Yap</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { weeklyDayOffs, breaks, overtimes, movements, reminders } = dashboardData || { weeklyDayOffs: [], breaks: [], overtimes: [], movements: [], reminders: [] };

  // Break Logic
  const todayStr = new Date().toISOString().split('T')[0];
  const safeBreaks = breaks || [];
  const todayBreaks = safeBreaks.filter((b: any) => (b.break_start || '').startsWith(todayStr));
  const activeBreak = todayBreaks.find((b: any) => !b.break_end);
  const recentBreaks = safeBreaks.filter((b: any) => b.break_end).sort((a: any, b: any) => new Date(b.break_end).getTime() - new Date(a.break_end).getTime()).slice(0, 5);

  // Overtime Logic
  const safeOvertimes = overtimes || [];
  const earnedOvertime = safeOvertimes.filter((r: any) => !(r.record_type || '').toLowerCase().includes('alacak') && !(r.record_type || '').toLowerCase().includes('kullanım')).reduce((s: number, r: any) => s + Number(r.hours), 0);
  const usedCredit = safeOvertimes.filter((r: any) => (r.record_type || '').toLowerCase().includes('alacak') || (r.record_type || '').toLowerCase().includes('kullanım')).reduce((s: number, r: any) => s + Number(r.hours), 0);

  const formatDuration = (totalH: number) => {
    const abs = Math.abs(totalH);
    const d = Math.floor(abs / 8);
    const remH = abs - (d * 8);
    const h = Math.floor(remH);
    const m = Math.round((remH - h) * 60);
    
    let parts = [];
    if (d > 0) parts.push(`${d} Gün`);
    if (h > 0) parts.push(`${h} Saat`);
    if (m > 0) parts.push(`${m} Dk`);
    const formatted = parts.length > 0 ? parts.join(' ') : '0 Saat';
    return totalH < 0 ? `- ${formatted}` : formatted;
  };

  // Leave Logic
  const safeMovements = movements || [];
  const usedLeaves = safeMovements.filter((m: any) => {
    const t = (m.type || m.movement_type || '').toLocaleLowerCase('tr-TR');
    return t.includes('yıllık') && t.includes('izin');
  }).reduce((s: number, m: any) => s + Number(m.total_days), 0);
  const entitlement = typeof (personnel as any).annual_leave_entitlement === 'number' ? (personnel as any).annual_leave_entitlement : calculateEntitlement(personnel.start_date);
  const remainingLeave = entitlement - usedLeaves;

  const safeWeeklyDayOffs = weeklyDayOffs || [];
  const selectedDays = safeWeeklyDayOffs.map((d: any) => d.day_of_week);

  const toggleDay = (day: number) => {
    const isSelected = safeWeeklyDayOffs.some((d: any) => d.day_of_week === day);
    const allIds = safeWeeklyDayOffs.map((r: any) => r.id);
    toggleDayMutation.mutate({ day, isSelected, allIds, description: dayOffDescription });
  };

  const { months, days } = calculateWorkDuration(personnel.start_date);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{personnel.first_name} {personnel.last_name}</h1>
            <p className="text-muted-foreground">{personnel.department}</p>
            <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-1">
              ⏱️ {months} ay {days} gün ({(months * 30 + days)} gün) çalışıyor
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut}><LogOut className="w-4 h-4 mr-2" /> Çıkış</Button>
        </div>

        {/* Break Section */}
        {features.showBreak && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Coffee className="h-5 w-5" /> Mola</CardTitle>
            <CardDescription>Mola durumunuzu takip edin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeBreak ? (
              <>
                <div className="p-4 bg-warning/10 rounded-lg text-center"><p className="text-lg font-semibold text-foreground">Moladasınız</p></div>
                <Button onClick={() => endBreakMutation.mutate(activeBreak.id)} disabled={endBreakMutation.isPending} className="w-full" variant="default"><Coffee className="w-4 h-4 mr-2" /> Moladan Geldim</Button>
              </>
            ) : (
              <Button onClick={() => startBreakMutation.mutate()} disabled={startBreakMutation.isPending} className="w-full" variant="outline"><Coffee className="w-4 h-4 mr-2" /> Molaya Çıktım</Button>
            )}

            <DailyBreakTracker todayBreaks={todayBreaks} activeBreak={activeBreak} limitMinutes={breakLimit} />

            {recentBreaks.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Son Molalar</p>
                {recentBreaks.map((b: any) => {
                  const start = b.break_start ? new Date(b.break_start) : new Date();
                  const end = b.break_end ? new Date(b.break_end) : new Date();
                  const dur = Math.round((end.getTime() - start.getTime()) / (1000 * 60)) || 0;
                  return (
                    <div key={b.id} className="flex justify-between text-sm p-2 bg-muted/50 rounded">
                      <span>{b.break_start ? format(start, 'dd.MM HH:mm') : '-'}</span>
                      <span className={dur > breakLimit ? 'text-destructive font-medium' : ''}>{dur} dk</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Dashboards */}
        {(features.showOvertime || features.showBreakViolations || features.showLeaveStatus || features.showSalesTargets || features.showMovements || features.showReminders) && (
        <Card className="glass-card md:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Kontrol Paneli Özetleri</CardTitle></CardHeader>
          <CardContent>
            {(features.showOvertime || features.showBreakViolations || features.showLeaveStatus) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.showOvertime && (
              <div className="p-4 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400"><Clock className="h-4 w-4" /><h3 className="font-semibold text-sm">Toplam Fazla Mesai</h3></div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Kazanılan: <span className="font-bold text-foreground">{formatDuration(earnedOvertime)}</span></p>
                  <p className="text-xs text-muted-foreground">Kullanılan Alacak: <span className="font-bold text-foreground">{formatDuration(usedCredit)}</span></p>
                  <div className="h-px bg-border my-2"></div>
                  <p className="text-sm font-semibold">Bakiye: <span className={earnedOvertime - usedCredit < 0 ? 'text-destructive' : 'text-green-600'}>{formatDuration(earnedOvertime - usedCredit)}</span></p>
                </div>
              </div>
              )}

              {features.showBreakViolations && (
              <div className="p-4 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                <div className="flex items-center gap-2 mb-2 text-red-600 dark:text-red-400"><Coffee className="h-4 w-4" /><h3 className="font-semibold text-sm">Mola İhlal Özeti</h3></div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">İhlale Düşen Mola Sayısı: <span className="font-bold text-foreground">- Kez</span></p>
                  <p className="text-xs text-muted-foreground">Toplam Gecikme: <span className="font-bold text-foreground">{(personnel as any).total_overdue_break || 0} Dk</span></p>
                </div>
              </div>
              )}

              {features.showLeaveStatus && (
              <div className="p-4 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30">
                <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400"><Umbrella className="h-4 w-4" /><h3 className="font-semibold text-sm">Yıllık İzin Durumu</h3></div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs"><span>Kullanılan: {usedLeaves}</span><span>Hak: {entitlement}</span></div>
                  <Progress value={entitlement > 0 ? (usedLeaves / entitlement) * 100 : 0} className="h-2" />
                  <p className="text-sm font-semibold mt-1">Kalan İzin: <span className={remainingLeave < 0 ? 'text-destructive' : 'text-green-600'}>{remainingLeave} Gün</span></p>
                </div>
              </div>
              )}
            </div>
            )}

            {features.showSalesTargets && (
            <div className={`mt-4 p-4 rounded-lg bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 ${(features.showOvertime || features.showBreakViolations || features.showLeaveStatus) ? '' : 'mt-0'}`}>
              <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400">
                <Target className="h-5 w-5" />
                <h3 className="font-semibold text-base">Aylık Satış Özetiniz</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {dashboardData?.salesTarget ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">Kişisel Hedef</p>
                    <div className="flex justify-between text-sm">
                      <span>Satış: {Number(dashboardData.salesTarget.realized_sales || 0).toLocaleString('tr-TR')} ₺</span>
                      <span>Hedef: {Number(dashboardData.salesTarget.target_quota || 0).toLocaleString('tr-TR')} ₺</span>
                    </div>
                    {(() => {
                      const quota = dashboardData.salesTarget.target_quota;
                      const realized = dashboardData.salesTarget.realized_sales;
                      const ratio = quota > 0 ? (realized / quota) * 100 : 0;
                      const isComplete = ratio >= 100;
                      return (
                        <>
                          <Progress value={Math.min(100, ratio)} className={`h-2 ${isComplete ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950' : 'bg-emerald-100 dark:bg-emerald-950'}`} />
                          <p className={`text-sm font-semibold mt-1 ${isComplete ? 'text-red-500 dark:text-red-400 animate-pulse' : 'text-emerald-600'}`}>
                            {isComplete ? `Hedef %${Math.round(ratio)} Geçildi!` : `Kalan: ${(quota - realized).toLocaleString('tr-TR')} ₺`}
                          </p>
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-4 text-muted-foreground text-sm text-center border-dashed border-2 rounded min-h-[100px]">
                    Kişisel kota tanımlanmadı
                  </div>
                )}
                
                {dashboardData?.deptTargetQuota > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground">[{personnel.department || 'Bilinmeyen'}] Reyonu Toplamı</p>
                    <div className="flex justify-between text-sm">
                      <span>Satış: {Number(dashboardData.deptRealizedSales || 0).toLocaleString('tr-TR')} ₺</span>
                      <span>Hedef: {Number(dashboardData.deptTargetQuota || 0).toLocaleString('tr-TR')} ₺</span>
                    </div>
                    {(() => {
                      const quota = dashboardData.deptTargetQuota;
                      const realized = dashboardData.deptRealizedSales;
                      const ratio = quota > 0 ? (realized / quota) * 100 : 0;
                      const isComplete = ratio >= 100;
                      return (
                        <>
                          <Progress value={Math.min(100, ratio)} className={`h-2 ${isComplete ? '[&>div]:bg-red-500 bg-red-100 dark:bg-red-950' : 'bg-emerald-100 dark:bg-emerald-950'}`} />
                          <p className={`text-sm font-semibold mt-1 ${isComplete ? 'text-red-500 dark:text-red-400 animate-pulse' : 'text-emerald-600'}`}>
                            {isComplete ? `Reyon Hedefi %${Math.round(ratio)} Geçildi!` : `Kalan: ${(quota - realized).toLocaleString('tr-TR')} ₺`}
                          </p>
                        </>
                      )
                    })()}
                  </div>
                ) : (
                  <div className="flex items-center justify-center p-4 text-muted-foreground text-sm text-center border-dashed border-2 rounded min-h-[100px]">
                    Reyon kotası tanımlanmadı
                  </div>
                )}
              </div>
            </div>
            )}

            {(features.showMovements || features.showReminders) && (
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 pt-4 ${(features.showOvertime || features.showBreakViolations || features.showLeaveStatus || features.showSalesTargets) ? 'border-t' : 'mt-0 pt-0'}`}>
              {features.showMovements && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3 text-primary"><MapPin className="h-4 w-4" /><h3 className="font-semibold text-sm">Son Kişisel Hareketleriniz</h3></div>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {movements.length > 0 ? movements.slice(0, 5).map((m: any) => {
                    const isValidStart = m.start_date && !isNaN(new Date(m.start_date).getTime());
                    const isValidEnd = m.end_date && !isNaN(new Date(m.end_date).getTime());
                    return (
                    <div key={m.id} className="flex justify-between items-center bg-background border p-2 rounded-md text-xs">
                       <div>
                         <span className="font-medium text-foreground block">{m.type || m.movement_type || 'Belirtilmemiş'}</span>
                         <span className="text-muted-foreground">
                           {isValidStart ? format(new Date(m.start_date), 'dd.MM.yyyy') : '-'} 
                           {' - '}
                           {isValidEnd ? format(new Date(m.end_date), 'dd.MM.yyyy') : '-'}
                         </span>
                       </div>
                       <Badge variant="outline">{m.total_days} Gün</Badge>
                    </div>
                  )}) : (
                    <div className="p-3 bg-muted/20 text-center rounded text-xs text-muted-foreground">Kayıtlı kişisel hareket bulunamadı.</div>
                  )}
                </div>
              </div>
              )}

              {features.showReminders && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-3 text-indigo-500"><Bell className="h-4 w-4" /><h3 className="font-semibold text-sm">Duyurular</h3></div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {reminders.length > 0 ? reminders.map((rem: any) => (
                    <div key={rem.id} className="flex flex-col bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-3 rounded-md">
                       <span className="font-semibold text-sm text-foreground mb-1">{rem.title}</span>
                       {rem.description && <span className="text-xs text-muted-foreground whitespace-pre-wrap">{rem.description}</span>}
                       <span className="text-[10px] text-indigo-400 mt-2 text-right font-medium">
                          {rem.reminder_datetime && !isNaN(new Date(rem.reminder_datetime).getTime()) ? `Son Geçerlilik: ${format(new Date(rem.reminder_datetime), 'dd.MM.yyyy')}` : ''}
                       </span>
                    </div>
                  )) : (
                    <div className="p-3 bg-muted/20 text-center rounded text-xs text-muted-foreground">Şu an için aktif bir duyuru bulunmuyor.</div>
                  )}
                </div>
              </div>
              )}
            </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Day Off Selection */}
        {features.showLeaveStatus && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Haftalık İzin Günü</CardTitle>
            <CardDescription>
              {selectedDays.length > 0 
                ? <span className="font-semibold text-primary">Seçili İzin Gününüz: {DAYS[selectedDays[0]]}</span>
                : 'İzin kullanmak istediğiniz günü seçin'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Input 
                  placeholder="İzin talebinizle ilgili kısa bir not ekleyebilirsiniz (İsteğe bağlı)..." 
                  value={dayOffDescription} 
                  onChange={(e) => setDayOffDescription(e.target.value)}
                  className="max-w-md bg-muted/50"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {DAYS.slice(1, 6).map((day, idx) => {
                  const i = idx + 1;
                  const isSelected = selectedDays.includes(i);
                  const isDisabled = toggleDayMutation.isPending;
                  
                  return (
                    <Button 
                      key={i} 
                      variant={isSelected ? 'default' : 'outline'} 
                      onClick={() => toggleDay(i)} 
                      disabled={isDisabled} 
                      className={`w-full ${isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'}`}
                    >
                      {day}
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Cargo Shipments Tracking Section */}
        {features.showCargoStatus && dashboardData?.shipments && dashboardData.shipments.filter((s:any) => s.total_boxes > s.counted_boxes || s.status === 'Sayılıyor').length > 0 && (
          <Card className="glass-card mt-6">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-xl font-bold flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> Koli / Sevkiyat Takibi</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 px-3 sm:px-6">
              <div className="flex flex-col gap-4">
                {dashboardData.shipments
                  .filter((s:any) => s.total_boxes > s.counted_boxes || s.status === 'Sayılıyor')
                  .sort((a: any, b: any) => new Date(a.arrival_date).getTime() - new Date(b.arrival_date).getTime())
                  .map((shipment: any) => {
                    const remaining = Math.max(0, shipment.total_boxes - shipment.counted_boxes);
                    const progress = shipment.total_boxes > 0 ? (shipment.counted_boxes / shipment.total_boxes) * 100 : 0;
                    const isComplete = shipment.counted_boxes >= shipment.total_boxes;

                    return (
                      <div key={shipment.id} className={`p-5 rounded-xl border-2 transition-all ${isComplete ? 'bg-success/5 border-success/30' : 'bg-card border-border hover:border-primary/30'} flex flex-col md:flex-row gap-6 shadow-sm items-center`}>
                        
                        {/* Title & Notes section (Left) */}
                        <div className="flex-1 w-full">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{format(new Date(shipment.arrival_date), 'dd.MM.yyyy')} Sevkiyatı</h3>
                            <Badge variant={isComplete ? "default" : "outline"} className={isComplete ? "bg-success" : ""}>
                              {isComplete ? 'Tamamlandı' : 'Bekliyor'}
                            </Badge>
                          </div>
                          <div className="mt-2 space-y-1">
                            <Label className="text-[11px] font-semibold uppercase text-muted-foreground ml-1">Açıklama / Not Ekleyin</Label>
                            <Input 
                              defaultValue={shipment.notes || ''}
                              placeholder="Eksik, hasarlı koli tespiti veya ek notlar..."
                              className="h-10 text-sm bg-muted/30"
                              onBlur={(e) => {
                                if (e.target.value !== (shipment.notes || '')) {
                                  updateCargoMutation.mutate({ 
                                    id: shipment.id, 
                                    newCount: shipment.counted_boxes, 
                                    totalBoxes: shipment.total_boxes, 
                                    notes: e.target.value 
                                  });
                                }
                              }}
                            />
                          </div>
                        </div>
                        
                        {/* Numbers and Progress (Middle) */}
                        <div className="flex-1 w-full flex flex-col justify-center">
                          <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-3 text-center">
                            <div className="bg-muted rounded-lg p-1.5 sm:p-2 flex flex-col justify-center overflow-hidden">
                              <p className="text-[10px] w-full text-muted-foreground mb-1 uppercase font-bold truncate tracking-tighter">Top.</p>
                              <p className="text-lg sm:text-xl font-bold">{shipment.total_boxes}</p>
                            </div>
                            <div className="bg-primary/10 rounded-lg p-1.5 sm:p-2 border border-primary/20 flex flex-col justify-center overflow-hidden">
                              <p className="text-[10px] w-full text-primary mb-1 uppercase font-bold truncate tracking-tighter">Say.</p>
                              <p className="text-lg sm:text-xl font-bold text-primary">{shipment.counted_boxes}</p>
                            </div>
                            <div className="bg-destructive/10 rounded-lg p-1.5 sm:p-2 border border-destructive/20 shadow-sm flex flex-col justify-center overflow-hidden">
                              <p className="text-[10px] w-full text-destructive mb-1 uppercase font-bold truncate tracking-tighter">Son</p>
                              <p className="text-xl sm:text-2xl font-bold text-destructive animate-pulse">{remaining}</p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span>İlerleme Oranı</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2 w-full bg-secondary" indicatorColor={isComplete ? "bg-success" : "bg-primary"} />
                          </div>
                        </div>

                        {/* Actions (Right) */}
                        <div className="w-full md:max-w-[220px] flex items-center justify-between gap-3">
                          <Button 
                            variant="destructive" 
                            size="icon"
                            className="h-14 w-14 shrink-0 rounded-xl"
                            onClick={() => {
                              if (shipment.counted_boxes > 0) {
                                updateCargoMutation.mutate({ id: shipment.id, newCount: shipment.counted_boxes - 1, totalBoxes: shipment.total_boxes });
                              }
                            }}
                            disabled={shipment.counted_boxes === 0 || updateCargoMutation.isPending}
                          >
                            <Minus className="h-6 w-6" />
                          </Button>
                          <div className="flex-1 text-center text-[10px] uppercase font-bold text-muted-foreground">
                            Sayımı<br/>Güncelle
                          </div>
                          <Button 
                            variant="default" 
                            size="icon"
                            className="h-14 w-14 shrink-0 rounded-xl"
                            onClick={() => {
                              updateCargoMutation.mutate({ id: shipment.id, newCount: shipment.counted_boxes + 1, totalBoxes: shipment.total_boxes });
                            }}
                            disabled={updateCargoMutation.isPending}
                          >
                            <Plus className="h-6 w-6" />
                          </Button>
                        </div>

                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Announcement Images Section */}
        {Array.isArray(announcementImages) && announcementImages.length > 0 && (
          <div className="space-y-4 mt-8 pt-4 border-t">
            <h2 className="text-xl font-bold flex items-center gap-2 text-foreground mb-4"><ImagePlus className="w-5 h-5"/> Haftalık Shift Programı / Depo ve Mutfak Çalışması</h2>
            <div className="flex flex-col gap-6">
              {announcementImages.map((url: string, i: number) => (
                <div key={i} className="w-full rounded-xl overflow-hidden shadow-md border bg-muted/20">
                  <img src={url} alt={`Duyuru ${i+1}`} className="w-full h-auto object-contain" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-8 text-center pb-6 text-sm font-medium text-muted-foreground">Tasarlayan Turgay DOLU</footer>
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
        if (!b.break_end && activeBreak && activeBreak.id === b.id) return;
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
        <div><p className="text-sm text-muted-foreground font-medium">Günlük Kullanım</p><p className="text-xl font-mono font-semibold">{formatTime(totalConsumedSeconds)}</p></div>
        <div><p className="text-sm text-muted-foreground font-medium">Kalan Süre</p><p className={`text-xl font-mono font-bold ${isExceeded ? 'text-destructive animate-pulse' : 'text-green-600 dark:text-green-500'}`}>{formatTime(remainingSeconds)}</p></div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 pt-2 border-t">Günlük Kullanılabilir Mola Hakkı: <b>{limitMinutes} dakika</b></p>
    </div>
  );
};

export default EmployeePanel;
