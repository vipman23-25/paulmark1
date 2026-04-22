import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';

const DAYS = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

const ShiftSettingsTab = () => {
  const queryClient = useQueryClient();
  const [genderForm, setGenderForm] = useState({ gender: '', day_of_week: '', warning_message: '' });

  const { data: genderRules, isLoading: loadingGender } = useQuery({
    queryKey: ['shift_gender_rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shift_gender_rules').select('*').order('day_of_week');
      if (error) throw error;
      return data;
    }
  });

  const { data: deptRules, isLoading: loadingDept } = useQuery({
    queryKey: ['department_shift_rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('department_shift_rules').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: personnelDepts } = useQuery({
    queryKey: ['distinct_departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('department');
      if (error) throw error;
      const unq = Array.from(new Set(data.map(d => d.department))).filter(Boolean);
      return unq;
    }
  });

  const addGenderRule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('shift_gender_rules').insert({
        gender: genderForm.gender,
        day_of_week: parseInt(genderForm.day_of_week),
        warning_message: genderForm.warning_message
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_gender_rules'] });
      setGenderForm({ gender: '', day_of_week: '', warning_message: '' });
      toast.success('Kural eklendi');
    }
  });

  const deleteGenderRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shift_gender_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift_gender_rules'] });
      toast.success('Kural silindi');
    }
  });

  const upsertDeptRule = useMutation({
    mutationFn: async ({ dept, mCount, eCount }: { dept: string, mCount: string, eCount: string }) => {
      // Basic upsert fallback logic if constraints fail
      const { data: existing } = await supabase.from('department_shift_rules').select('*').eq('department_name', dept).single();
      let error;
      if (existing) {
         const res = await supabase.from('department_shift_rules').update({ override_morning_count: mCount ? parseInt(mCount) : null, override_evening_count: eCount ? parseInt(eCount) : null }).eq('id', existing.id);
         error = res.error;
      } else {
         const res = await supabase.from('department_shift_rules').insert({ department_name: dept, override_morning_count: mCount ? parseInt(mCount) : null, override_evening_count: eCount ? parseInt(eCount) : null });
         error = res.error;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['department_shift_rules'] });
      toast.success('Reyon kuralı güncellendi');
    }
  });

  const handleAddGenderRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!genderForm.gender || !genderForm.day_of_week) return toast.error('Cinsiyet ve gün seçiniz');
    addGenderRule.mutate();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Cinsiyete Göre İzin Günü Kısıtlaması</CardTitle>
          <CardDescription>Belirli bir günde Erkek/Kadın personellerin izin kullanmasını engelleyebilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleAddGenderRule} className="grid grid-cols-1 sm:grid-cols-2 gap-4 border p-4 rounded-lg bg-muted/10">
            <div className="space-y-2">
              <Label>Cinsiyet</Label>
              <Select value={genderForm.gender} onValueChange={(v) => setGenderForm({...genderForm, gender: v})}>
                <SelectTrigger><SelectValue placeholder="Seçiniz"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Erkek">Erkek</SelectItem>
                  <SelectItem value="Kadın">Kadın</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Yasaklı Gün</Label>
              <Select value={genderForm.day_of_week} onValueChange={(v) => setGenderForm({...genderForm, day_of_week: v})}>
                <SelectTrigger><SelectValue placeholder="Gün Seçiniz"/></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => d ? <SelectItem key={i} value={i.toString()}>{d}</SelectItem> : null)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Uyarı Mesajı (Personele görünecek)</Label>
              <Input placeholder="Örn: Hafta sonları yalnızca kadın personeller..." value={genderForm.warning_message} onChange={e => setGenderForm({...genderForm, warning_message: e.target.value})} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={addGenderRule.isPending}>Kuralı Ekle</Button>
            </div>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cinsiyet</TableHead>
                <TableHead>Gün</TableHead>
                <TableHead>Uyarı Mesajı</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {genderRules?.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.gender}</TableCell>
                  <TableCell>{DAYS[r.day_of_week]}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.warning_message}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteGenderRule.mutate(r.id)}><Trash2 className="w-4 h-4 text-red-500"/></Button>
                  </TableCell>
                </TableRow>
              ))}
              {!genderRules?.length && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Kayıtlı kural yok.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reyon Vardiya Oranları (Sabah/Akşam)</CardTitle>
          <CardDescription>Motorun otomatik oluşturacağı Sabah/Akşam kişi sayısını manuel kısıtlayabilirsiniz. (Boş bırakılırsa sistem mevcut kişi sayısına göre orantılar)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reyon</TableHead>
                <TableHead>Sabahçı Sy.</TableHead>
                <TableHead>Akşamcı Sy.</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personnelDepts?.map((dept: any) => {
                const rule = deptRules?.find((r: any) => r.department_name === dept) || {};
                return (
                  <RuleRow key={dept} dept={dept} rule={rule} onSave={(m, e) => upsertDeptRule.mutate({ dept, mCount: m, eCount: e })} />
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const RuleRow = ({ dept, rule, onSave }: any) => {
  const [mCount, setMCount] = useState(rule.override_morning_count || '');
  const [eCount, setECount] = useState(rule.override_evening_count || '');

  return (
    <TableRow>
      <TableCell className="font-semibold">{dept}</TableCell>
      <TableCell><Input type="number" min="0" placeholder="Oto" className="w-20" value={mCount} onChange={e => setMCount(e.target.value)} /></TableCell>
      <TableCell><Input type="number" min="0" placeholder="Oto" className="w-20" value={eCount} onChange={e => setECount(e.target.value)} /></TableCell>
      <TableCell className="text-right">
        <Button variant="outline" size="sm" onClick={() => onSave(mCount, eCount)}>Kaydet</Button>
      </TableCell>
    </TableRow>
  );
};

export default ShiftSettingsTab;
