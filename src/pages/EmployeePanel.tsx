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
import { MapPin, CalendarDays, Umbrella, Coffee, ImagePlus, UserCheck, Timer, Calendar, Info, Clock, Activity, Target, LogOut, Bell, Package, Plus, Minus, Truck, Trash2 } from "lucide-react";
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
  const [requestedShift, setRequestedShift] = useState('farketmez');
  const [isLogisticsOpen, setIsLogisticsOpen] = useState(false);
  const [logisticsForm, setLogisticsForm] = useState({
    company_name: '',
    shipment_date: new Date().toISOString().split('T')[0],
    content_description: '',
    tracking_number: ''
  });

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
    showWeeklyDayOff: true,
    showSalesTargets: true,
    showMovements: true,
    showReminders: true,
    showCargoStatus: true,
    showShiftTracking: true,
    showShiftVisuals: true,
  };

  const pVis = (personnel as any)?.module_visibility || {};
  
  const features = {
    showBreak: pVis.showBreak ?? true,
    showOvertime: pVis.showOvertime ?? baseFeatures.showOvertime,
    showBreakViolations: pVis.showBreak ?? baseFeatures.showBreakViolations,
    showLeaveStatus: pVis.showLeave ?? baseFeatures.showLeaveStatus,
    showWeeklyDayOff: baseFeatures.showWeeklyDayOff ?? baseFeatures.showLeaveStatus ?? true,
    showSalesTargets: pVis.showSales ?? baseFeatures.showSalesTargets,
    showMovements: pVis.showMovements ?? baseFeatures.showMovements,
    showReminders: pVis.showAnnouncements ?? baseFeatures.showReminders,
    showCargoStatus: pVis.showCargo ?? baseFeatures.showCargoStatus ?? true,
    showLogistics: pVis.showLogistics ?? true,
    showShiftTracking: pVis.showShiftTracking ?? baseFeatures.showShiftTracking ?? true,
    showShiftVisuals: baseFeatures.showShiftVisuals ?? true,
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
        { data: shipments },
        { data: logistics },
        { data: cargoCompanies }
      ] = await Promise.all([
        supabase.from('weekly_day_off').select('*').eq('personnel_id', personnel.id),
        supabase.from('break_records').select('*').eq('personnel_id', personnel.id),
        supabase.from('overtime_records').select('*').eq('personnel_id', personnel.id),
        supabase.from('personnel_movements').select('*').eq('personnel_id', personnel.id).order('start_date', { ascending: false }),
        (supabase.from('reminders').select('*').eq('is_active', true).order('reminder_date', { ascending: true }) as any),
        (supabase.from('sales_targets' as any).select('*, personnel!inner(department)').eq('personnel.department', personnel.department || 'Bilinmiyor').eq('target_month', currentMonth) as any),
        supabase.from('cargo_shipments' as any).select('*').order('arrival_date', { ascending: true }),
        supabase.from('logistics_records' as any).select('*').order('shipment_date', { ascending: false }),
        supabase.from('cargo_companies' as any).select('*').order('created_at', { ascending: true })
      ]);
      
      const [
        { data: responses },
        { data: settingsData }
      ] = await Promise.all([
        supabase.from('reminder_responses' as any).select('*')
          .eq('personnel_id', personnel.id)
          .eq('response_date', new Date().toISOString().split('T')[0]),
        supabase.from('system_settings' as any).select('setting_value').eq('setting_key', 'general').single()
      ]);
      const taskStatuses = settingsData?.setting_value?.taskStatuses || ['Yapıldı', 'Yapılmadı', 'Beklemede', 'Okudum & Anladım'];
      const weeklySchedule = settingsData?.setting_value?.weeklySchedule || [];
      
      const { data: deptCoworkers } = await supabase.from('personnel' as any).select('*').eq('department', personnel.department || 'Bilinmiyor');
      const coworkerIds = (deptCoworkers || []).map((c: any) => c.id);
      
      const [
         { data: colleagueBreaks },
         { data: colleagueMovements },
         { data: colleagueDayOffs },
         { data: genderRules }
      ] = await Promise.all([
         coworkerIds.length > 0 ? supabase.from('break_records' as any).select('*').in('personnel_id', coworkerIds) : { data: [] },
         coworkerIds.length > 0 ? supabase.from('personnel_movements' as any).select('*').in('personnel_id', coworkerIds).order('start_date', { ascending: false }) : { data: [] },
         coworkerIds.length > 0 ? supabase.from('weekly_day_off' as any).select('*').in('personnel_id', coworkerIds) : { data: [] },
         supabase.from('shift_gender_rules' as any).select('*')
      ]);
      
      const salesTarget = (allDepartmentSalesTargets || []).find((s: any) => s.personnel_id === personnel.id) || null;
      const deptTargetQuota = (allDepartmentSalesTargets || []).reduce((acc: number, curr: any) => acc + (Number(curr.target_quota) || 0), 0);
      const deptRealizedSales = (allDepartmentSalesTargets || []).reduce((acc: number, curr: any) => acc + (Number(curr.realized_sales) || 0), 0);

      const today = new Date();
      const todayDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday...
      const todayDateOfMonth = today.getDate(); // 1-31

      const visibleReminders = (reminders || []).filter((rem: any) => {
        let isTarget = false;
        if (rem.personnel_id) {
           isTarget = rem.personnel_id === personnel.id;
        } else if (rem.department_name) {
           if (rem.department_name === 'Tümü') isTarget = true;
           else if (rem.department_name === 'Müdür Hariç Tümü') {
              const isManager = (personnel.department || '').toLowerCase().includes('müdür');
              isTarget = !isManager;
           } else {
              isTarget = personnel.department === rem.department_name;
           }
        } else {
           isTarget = true;
        }
        
        if (!isTarget) return false;

        if (!rem.recurrence || rem.recurrence === 'none' || rem.recurrence === 'daily') return true;
        
        const parts = rem.recurrence.split(',');
        const type = parts[0];
        const vals = parts.slice(1).map(Number);
        
        if (type === 'weekly') {
          return vals.includes(todayDayOfWeek);
        }
        if (type === 'monthly') {
          return vals.includes(todayDateOfMonth);
        }
        return true;
      });

      return { 
        weeklyDayOffs: weeklyDayOffs || [], 
        breaks: breaks || [], 
        overtimes: overtimes || [], 
        movements: movements || [],
        reminders: visibleReminders,
        salesTarget,
        deptTargetQuota,
        deptRealizedSales,
        shipments: shipments || [],
        logistics: logistics || [],
        cargoCompanies: cargoCompanies || [],
        responses: responses || [],
        taskStatuses,
        weeklySchedule,
        deptCoworkers: deptCoworkers || [],
        colleagueBreaks: colleagueBreaks || [],
        colleagueMovements: colleagueMovements || [],
        colleagueDayOffs: colleagueDayOffs || [],
        genderRules: genderRules || []
      };
    },
    enabled: !!personnel?.id,
    refetchInterval: 30000
  });

  const submitSurveyResponseMutation = useMutation({
    mutationFn: async ({ reminder_id, status }: { reminder_id: string, status: string }) => {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase.from('reminder_responses' as any).upsert([{
        reminder_id,
        personnel_id: personnel?.id,
        response_date: today,
        status,
        notes: ''
      }], { onConflict: 'reminder_id, personnel_id, response_date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      toast.success('Yanıtınız kaydedildi');
    },
    onError: (err: any) => toast.error('Yanıt kaydedilemedi: ' + err.message)
  });

  const addLogisticsMutation = useMutation({
    mutationFn: async (data: typeof logisticsForm) => {
      const { error } = await supabase.from('logistics_records' as any).insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      toast.success('Yeni kargo kaydı eklendi');
      setIsLogisticsOpen(false);
      setLogisticsForm({
        company_name: '',
        shipment_date: new Date().toISOString().split('T')[0],
        content_description: '',
        tracking_number: ''
      });
    },
    onError: (err: any) => toast.error('Kargo ekleme hatası: ' + err.message)
  });

  const handleAddLogistics = () => {
    if (!logisticsForm.company_name) { toast.error("Firma adı zorunludur."); return; }
    if (!logisticsForm.content_description) { toast.error("Açıklama zorunludur."); return; }
    if (!logisticsForm.tracking_number) { toast.error("Takip no zorunludur."); return; }
    addLogisticsMutation.mutate(logisticsForm);
  };

  const deleteLogisticsMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('logistics_records' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee_dashboard'] });
      toast.success('Kargo kaydı silindi');
    },
    onError: (err: any) => toast.error('Silme hatası: ' + err.message)
  });

  const updateCargoMutation = useMutation({
    mutationFn: async ({ id, newCount, totalBoxes, notes, addedCount }: { id: string, newCount: number, totalBoxes: number, notes?: string, addedCount?: number }) => {
      const isComplete = newCount >= totalBoxes;
      
      const payload: any = { 
        counted_boxes: newCount, 
        status: isComplete ? 'Tamamlandı' : 'Sayılıyor',
        completion_date: isComplete ? new Date().toISOString() : null
      };

      if (notes !== undefined) {
        payload.personnel_notes = notes;
      }

      const { error } = await supabase
        .from('cargo_shipments' as any)
        .update(payload)
        .eq('id', id);
      if (error) throw error;

      if (addedCount && addedCount !== 0 && personnel) {
        await supabase.from('cargo_shipment_logs' as any).insert([{
          shipment_id: id,
          personnel_name: `${personnel.first_name} ${personnel.last_name}`,
          added_count: addedCount
        }]);
      }
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
    mutationFn: async ({ day, isSelected, allIds, description, reqShift }: { day: number, isSelected: boolean, allIds: string[], description?: string, reqShift?: string }) => {
      if (allIds.length > 0) {
        const { error: delErr } = await supabase.from('weekly_day_off').delete().in('id', allIds);
        if (delErr) throw delErr;
      }
      if (!isSelected) {
        const payload: any = { personnel_id: personnel.id, day_of_week: day, description, requested_shift: reqShift, status: 'pending' };
        const { error: insErr } = await supabase.from('weekly_day_off').insert(payload);
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
      setRequestedShift(dashboardData.weeklyDayOffs[0].requested_shift || 'farketmez');
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

  const breakViolationsCount = safeBreaks.filter((b: any) => {
    if (!b.break_end) return false;
    const start = new Date(b.break_start);
    const end = new Date(b.break_end);
    const dur = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    return dur > breakLimit;
  }).length;

  // Overtime Logic
  const safeOvertimes = overtimes || [];
  const earnedOvertime = safeOvertimes.filter((r: any) => !(r.record_type || '').toLowerCase().includes('alacak') && !(r.record_type || '').toLowerCase().includes('kullanım')).reduce((s: number, r: any) => s + Number(r.hours), 0);
  const usedCredit = safeOvertimes.filter((r: any) => (r.record_type || '').toLowerCase().includes('alacak') || (r.record_type || '').toLowerCase().includes('kullanım')).reduce((s: number, r: any) => s + Number(r.hours), 0);

  const totalOverdueMinutes = safeBreaks.reduce((sum: number, b: any) => {
    if (!b.break_end) return sum;
    const start = new Date(b.break_start);
    const end = new Date(b.break_end);
    const dur = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    if (dur > breakLimit) {
      return sum + (dur - breakLimit);
    }
    return sum;
  }, 0);

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
    
    if (!isSelected) {
      const colleagueSameDay = dashboardData?.colleagueDayOffs?.filter((d: any) => d.day_of_week === day) || [];
      if (colleagueSameDay.length > 0) {
        if (!window.confirm("Uyarı: Reyonunuzdaki " + colleagueSameDay.length + " arkadaşınız bu günü izin günü olarak seçmiş. Yine de seçmek ister misiniz?")) {
          return;
        }
      }

      const genderBlock = dashboardData?.genderRules?.find((r: any) => r.day_of_week === day && r.gender === (personnel as any).gender);
      if (genderBlock) {
         toast.error(genderBlock.warning_message || "Bu gün için sistem tarafından cinsiyetinize özel bir izin kısıtlaması getirilmiştir.");
         return;
      }
    }

    toggleDayMutation.mutate({ day, isSelected, allIds, description: dayOffDescription, reqShift: requestedShift });
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

        {/* Colleague Shift Panel */}
        {features.showShiftTracking && (
          <ColleagueShiftPanel dashboardData={dashboardData} personnel={personnel} />
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
                  <p className="text-xs text-muted-foreground">İhlale Düşen Mola Sayısı: <span className="font-bold text-foreground">{breakViolationsCount} Kez</span></p>
                  <p className="text-xs text-muted-foreground">Toplam Gecikme: <span className="font-bold text-foreground">{totalOverdueMinutes} Dk</span></p>
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
                <div className="flex items-center gap-2 mb-3 text-indigo-500"><Bell className="h-4 w-4" /><h3 className="font-semibold text-sm">Duyurular ve Görevler</h3></div>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                  {dashboardData?.reminders && dashboardData.reminders.length > 0 ? dashboardData.reminders.map((rem: any) => {
                    const response = dashboardData.responses?.find((r:any) => r.reminder_id === rem.id);
                    return (
                    <div key={rem.id} className={`flex flex-col border p-4 rounded-xl shadow-sm ${rem.is_survey ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30' : 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30'}`}>
                       <div className="flex justify-between items-start gap-2 mb-2">
                         <span className="font-semibold text-base text-foreground">{rem.title}</span>
                         {rem.is_survey && <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-100 border-none shrink-0">Anket / Görev</Badge>}
                       </div>
                       
                       {rem.description && <span className="text-sm text-foreground/80 whitespace-pre-wrap mb-3">{rem.description}</span>}
                       
                       {rem.is_survey && (
                         <div className="mt-2 pt-3 border-t border-black/5 dark:border-white/5">
                           {response ? (
                             <div className="flex items-center justify-between bg-black/5 dark:bg-white/5 p-2 rounded-lg">
                               <span className="text-sm font-medium text-muted-foreground">Bugünkü Durumunuz:</span>
                               <Badge className="bg-success text-white border-0">{response.status}</Badge>
                             </div>
                           ) : (
                             <div className="space-y-2">
                               <span className="text-xs font-semibold text-muted-foreground block mb-1">Durum Bildirin:</span>
                               <div className="flex flex-wrap gap-2">
                                 {dashboardData.taskStatuses.map((status: string) => (
                                   <Button 
                                     key={status} 
                                     size="sm" 
                                     variant="secondary" 
                                     className="hover:bg-primary hover:text-primary-foreground min-w-[80px]"
                                     onClick={() => submitSurveyResponseMutation.mutate({ reminder_id: rem.id, status })}
                                     disabled={submitSurveyResponseMutation.isPending}
                                   >
                                     {status}
                                   </Button>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>
                       )}
                       
                       {!rem.is_survey && rem.reminder_datetime && !isNaN(new Date(rem.reminder_datetime).getTime()) && (
                         <span className="text-[10px] text-indigo-400 mt-2 text-right font-medium">
                            Son Geçerlilik: {format(new Date(rem.reminder_datetime), 'dd.MM.yyyy')}
                         </span>
                       )}
                    </div>
                  )}) : (
                    <div className="p-4 bg-muted/20 text-center rounded-lg text-sm text-muted-foreground border border-dashed">Şu an için aktif bir duyuru/görev bulunmuyor.</div>
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
        {features.showWeeklyDayOff && (
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
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground ml-1">Vardiya Tercihiniz (İsteğe bağlı)</Label>
                  <select 
                    value={requestedShift}
                    onChange={(e) => setRequestedShift(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm transition-colors focus:bg-background"
                  >
                    <option value="farketmez">Farketmez (Sistem Belirlesin)</option>
                    <option value="sabah">Sabah Vardiyasında Olmak İstiyorum</option>
                    <option value="aksam">Akşam Vardiyasında Olmak İstiyorum</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase text-muted-foreground ml-1">Notunuz (İsteğe bağlı)</Label>
                  <Input 
                    placeholder="Örn: Cuma sabahçı olmak istiyorum çünkü..." 
                    value={dayOffDescription} 
                    onChange={(e) => setDayOffDescription(e.target.value)}
                    className="bg-muted/50 focus:bg-background transition-colors"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
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
                  .sort((a: any, b: any) => {
                    const aComp = a.counted_boxes >= a.total_boxes;
                    const bComp = b.counted_boxes >= b.total_boxes;
                    if (aComp === bComp) return new Date(b.arrival_date).getTime() - new Date(a.arrival_date).getTime();
                    return aComp ? 1 : -1;
                  })
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
                            {shipment.notes && (
                              <div className="text-xs bg-primary/10 text-primary p-2 rounded mb-2">
                                <span className="font-semibold">Yönetici Notu:</span> {shipment.notes}
                              </div>
                            )}
                            <Label className="text-[11px] font-semibold uppercase text-muted-foreground ml-1">Personel Açıklaması / Not Ekleyin</Label>
                            <Input 
                              defaultValue={shipment.personnel_notes || ''}
                              placeholder="Eksik, hasarlı koli tespiti veya ek notlar..."
                              className="h-10 text-sm bg-muted/30"
                              onBlur={(e) => {
                                if (e.target.value !== (shipment.personnel_notes || '')) {
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
                              <p className="text-[10px] w-full text-destructive mb-1 uppercase font-bold truncate tracking-tighter">Kalan</p>
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
                                updateCargoMutation.mutate({ id: shipment.id, newCount: shipment.counted_boxes - 1, totalBoxes: shipment.total_boxes, addedCount: -1 });
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
                              updateCargoMutation.mutate({ id: shipment.id, newCount: shipment.counted_boxes + 1, totalBoxes: shipment.total_boxes, addedCount: 1 });
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

        {/* Logistics Tracking Section */}
        {features.showLogistics && (
          <Card className="glass-card mt-6">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2"><Truck className="h-5 w-5 text-primary" /> Kargo Takip (Kayıtlar)</CardTitle>
              <Dialog open={isLogisticsOpen} onOpenChange={setIsLogisticsOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-primary/90 hover:bg-primary"><Plus className="w-4 h-4 mr-1"/> Yeni Kargo</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader><DialogTitle>Yeni Kargo Ekle</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Gönderi Tarihi</Label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input type="date" className="pl-9" value={logisticsForm.shipment_date} onChange={e => setLogisticsForm({...logisticsForm, shipment_date: e.target.value})} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Kargo Firması</Label>
                      <select 
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                        value={logisticsForm.company_name}
                        onChange={(e) => setLogisticsForm({ ...logisticsForm, company_name: e.target.value })}
                      >
                        <option value="">Seçiniz...</option>
                        {dashboardData?.cargoCompanies?.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>İçerik / Açıklama</Label>
                      <Input value={logisticsForm.content_description} onChange={e => setLogisticsForm({...logisticsForm, content_description: e.target.value})} placeholder="Örn: İade kolisi..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Takip Numarası</Label>
                      <Input value={logisticsForm.tracking_number} onChange={e => setLogisticsForm({...logisticsForm, tracking_number: e.target.value})} placeholder="Takip No..." />
                    </div>
                    <Button className="w-full mt-4" onClick={handleAddLogistics} disabled={addLogisticsMutation.isPending}>
                      {addLogisticsMutation.isPending ? 'Ekleniyor...' : 'Kargo Ekle'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="pt-4 px-3 sm:px-6">
              {(!dashboardData?.logistics || dashboardData.logistics.length === 0) ? (
                 <p className="text-muted-foreground text-center py-4 text-sm">Henüz kargo kaydı bulunmuyor.</p>
              ) : (
                <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-2">
                  {dashboardData.logistics.map((log: any) => (
                    <div key={log.id} className="p-4 rounded-xl border bg-card/50 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="bg-primary/5">{log.company_name}</Badge>
                          <span className="text-sm font-medium">{format(new Date(log.shipment_date), 'dd.MM.yyyy')}</span>
                        </div>
                        <p className="font-semibold">{log.content_description}</p>
                      </div>
                      <div className="flex items-center gap-4 mt-2 sm:mt-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Takip Numarası</p>
                          <p className="font-mono bg-muted px-3 py-1.5 rounded-lg text-sm select-all">{log.tracking_number}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (window.confirm("Bu kargo kaydını silmek istediğinize emin misiniz?")) {
                            deleteLogisticsMutation.mutate(log.id);
                          }
                        }} disabled={deleteLogisticsMutation.isPending}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Announcement Images Section */}
        {features.showShiftVisuals && Array.isArray(announcementImages) && announcementImages.length > 0 && (
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

const ColleagueShiftPanel = ({ dashboardData, personnel }: { dashboardData: any, personnel: any }) => {
  if (!dashboardData?.weeklySchedule || dashboardData.weeklySchedule.length === 0) return null;

  const daysTr = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  const getShiftStatus = (person: any, dateOffset: 0 | 1 = 0) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + dateOffset);
    const targetStr = targetDate.toISOString().split('T')[0];
    const dayName = daysTr[targetDate.getDay()];
    const fullName = `${person.first_name} ${person.last_name}`.trim();

    const activeMovement = dashboardData.colleagueMovements?.find((m: any) => {
      if (m.personnel_id !== person.id) return false;
      return m.start_date <= targetStr && m.end_date >= targetStr;
    });

    if (activeMovement) {
      return {
        title: activeMovement.movement_type || 'Raporlu/İzinli',
        statusLabel: 'İzinli',
        statusColor: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400'
      };
    }

    const row = dashboardData.weeklySchedule.find((r: any) => r['Ad Soyad']?.toString().trim() === fullName);
    let shiftRaw = row ? (row[dayName] || '').toString().trim() : '';

    if (!shiftRaw || shiftRaw === '-') {
      return {
        title: 'İzinli (Off) / Belirsiz',
        statusLabel: 'İzinli',
        statusColor: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800'
      };
    }

    let shiftType = '';
    const upVal = shiftRaw.toUpperCase();
    if (upVal.startsWith('S')) shiftType = 'Sabah';
    else if (upVal.startsWith('A')) shiftType = 'Akşam';
    else if (upVal.startsWith('İ') || upVal.startsWith('I') || upVal.includes('İZİN') || upVal.includes('IZIN')) shiftType = 'İzinli';

    if (shiftType === 'İzinli') {
      return {
        title: 'Haftalık İzin',
        statusLabel: 'İzinli',
        statusColor: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400'
      };
    }

    let title = shiftType === 'Sabah' ? 'Sabah Vardiyası' : shiftType === 'Akşam' ? 'Akşam Vardiyası' : shiftRaw;
    const hasMutfak = shiftRaw.toLowerCase().includes('mutfak');
    const hasDepo = shiftRaw.toLowerCase().includes('depo');

    if (hasMutfak && !title.toLowerCase().includes('mutfak')) title += ' + Mutfak';
    if (hasDepo && !title.toLowerCase().includes('depo')) title += ' + Depo';

    if (shiftRaw.includes('+')) {
      const custom = shiftRaw.substring(shiftRaw.indexOf('+'));
      if (!custom.toLowerCase().includes('mutfak') && !custom.toLowerCase().includes('depo')) {
         title += ' ' + custom;
      }
    }

    let statusLabel = 'Mağazada';
    let statusColor = 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400';

    if (shiftType !== 'Sabah' && shiftType !== 'Akşam') {
      statusLabel = 'Mesai Dışı / Off';
      statusColor = 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
    }

    if (dateOffset === 0) {
      const activeBreak = dashboardData.colleagueBreaks?.find((b: any) => b.personnel_id === person.id && !b.break_end);
      if (activeBreak) {
        statusLabel = 'Molada';
        statusColor = 'bg-blue-100 text-blue-700 border-blue-200 animate-pulse dark:bg-blue-900/30 dark:text-blue-400';
      } else {
        const now = new Date();
        const hhmm = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        if (shiftType === 'Sabah') {
          if (hhmm >= '18:00') {
            statusLabel = 'Mesaisi Bitti';
            statusColor = 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
          }
        } else if (shiftType === 'Akşam') {
          if (hhmm < '13:20') {
            statusLabel = 'Gelecek';
            statusColor = 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
          } else if (hhmm >= '22:00') {
            statusLabel = 'Mesaisi Bitti';
            statusColor = 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-800 dark:text-gray-400';
          }
        }
      }
    } else {
      statusLabel = 'Yarınki Plan';
      statusColor = 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400';
    }

    return { title, statusLabel, statusColor };
  };

  const myStatusToday = getShiftStatus(personnel, 0);
  const myStatusTomorrow = getShiftStatus(personnel, 1);
  const colleagues = (dashboardData.deptCoworkers || []).filter((c: any) => c.id !== personnel.id && c.is_active);

  return (
    <Card className="glass-card mb-6 border-primary/20 bg-card">
      <CardHeader className="bg-primary/5 pb-3">
        <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Reyonum ve Vardiya Durumum ({personnel.department})</CardTitle>
      </CardHeader>
      <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Kendi 2 Günlük Planım */}
        <div className="space-y-4">
          <h3 className="font-bold text-foreground border-b pb-2 flex items-center justify-between">
            <span>👤 Benim Planım</span>
          </h3>
          <div className="flex flex-col gap-3">
            <div className={`p-3 rounded-lg border ${myStatusToday.statusColor}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold uppercase opacity-70 flex items-center gap-1"><Clock className="w-3 h-3" /> BUGÜN</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-background/50 shadow-sm">{myStatusToday.statusLabel}</span>
              </div>
              <p className="font-medium text-sm">{myStatusToday.title}</p>
            </div>
            
            <div className={`p-3 rounded-lg border ${myStatusTomorrow.statusColor} opacity-90`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold uppercase opacity-70 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> YARIN</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-background/50 shadow-sm">{myStatusTomorrow.statusLabel}</span>
              </div>
              <p className="font-medium text-sm">{myStatusTomorrow.title}</p>
            </div>
          </div>
        </div>

        {/* Çalışma Arkadaşlarım (Bugün) */}
        <div className="space-y-4">
          <h3 className="font-bold text-foreground border-b pb-2 flex items-center justify-between">
            <span>👥 Çalışma Arkadaşlarım (Bugün)</span>
          </h3>
          <div className="flex flex-col gap-2 max-h-[190px] overflow-y-auto pr-2 custom-scrollbar">
            {colleagues.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Bu reyonda kayıtlı başka aktif personel yok.</p>
            ) : (
              colleagues.map((c: any) => {
                const status = getShiftStatus(c, 0);
                return (
                  <div key={c.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-2.5 rounded-lg border bg-background/50 transition-colors border-l-4 ${status.statusColor.split(' ')[0].replace('bg-', 'border-')}`}>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{status.title}</p>
                    </div>
                    <div className={`mt-2 sm:mt-0 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full border shadow-sm ${status.statusColor}`}>
                      {status.statusLabel}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeePanel;
