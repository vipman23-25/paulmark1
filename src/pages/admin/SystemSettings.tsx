import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings, Plus, Trash2, ImagePlus, X, Activity } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { read, utils, writeFile } from 'xlsx';

export interface SystemSettings {
  breakLimitMinutes: number;
  movementTypes: string[];
  overtimeTypes: string[];
  announcementImages?: string[];
  employeeDashboardFeatures?: {
    showOvertime: boolean;
    showBreakViolations: boolean;
    showLeaveStatus: boolean;
    showSalesTargets: boolean;
    showMovements: boolean;
    showReminders: boolean;
  };
  weeklySchedule?: any[];
}

const defaultSettings: SystemSettings = {
  breakLimitMinutes: 60,
  movementTypes: ['İzin', 'Hastalık İzni', 'Muafiyet', 'Başka Görev'],
  overtimeTypes: ['Fazla Mesai', 'Alacak (Kullanım)'],
  announcementImages: [],
  employeeDashboardFeatures: {
    showOvertime: true,
    showBreakViolations: true,
    showLeaveStatus: true,
    showSalesTargets: true,
    showMovements: true,
    showReminders: true,
  },
  weeklySchedule: []
};

const SystemSettingsView = () => {
  const queryClient = useQueryClient();
  const [newMovementType, setNewMovementType] = useState('');
  const [newOvertimeType, setNewOvertimeType] = useState('');
  const [localLimit, setLocalLimit] = useState<string>('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: settings = defaultSettings, isLoading } = useQuery({
    queryKey: ['system_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .select('setting_value')
        .eq('setting_key', 'general')
        .single();
      
      if (error && error.code !== 'PGRST116') {
        toast.error('Ayarlar yüklenirken hata oluştu');
        throw error;
      }
      
      if (data?.setting_value) {
        setLocalLimit(data.setting_value.breakLimitMinutes?.toString() || '60');
        return data.setting_value as SystemSettings;
      }
      setLocalLimit(defaultSettings.breakLimitMinutes.toString());
      return defaultSettings;
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (newSettings: SystemSettings) => {
      const { data, error } = await supabase
        .from('system_settings' as any)
        .upsert({
          setting_key: 'general',
          setting_value: newSettings as any
        }, { onConflict: 'setting_key' })
        .select();
        
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_settings'] });
    },
    onError: (error: any) => {
      toast.error('Ayar güncellenemedi: ' + error.message);
    }
  });

  const handleUpdateBreakLimit = () => {
    const limit = parseInt(localLimit, 10);
    if (isNaN(limit) || limit < 1) {
      toast.error('Geçerli bir dakika değeri giriniz');
      return;
    }
    const updated = { ...settings, breakLimitMinutes: limit };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Mola süresi güncellendi')
    });
  };

  const handleFeatureToggle = (featureKey: keyof NonNullable<SystemSettings['employeeDashboardFeatures']>) => {
    const currentFeatures = settings.employeeDashboardFeatures || defaultSettings.employeeDashboardFeatures!;
    const updated = { 
      ...settings, 
      employeeDashboardFeatures: {
        ...currentFeatures,
        [featureKey]: !currentFeatures[featureKey]
      }
    };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Görünüm ayarı güncellendi')
    });
  };

  const addMovementType = () => {
    if (!newMovementType.trim() || settings.movementTypes.includes(newMovementType.trim())) return;
    const updated = { ...settings, movementTypes: [...settings.movementTypes, newMovementType.trim()] };
    updateMutation.mutate(updated, {
      onSuccess: () => {
        setNewMovementType('');
        toast.success('Hareket türü eklendi');
      }
    });
  };

  const removeMovementType = (type: string) => {
    const updated = { ...settings, movementTypes: settings.movementTypes.filter(t => t !== type) };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Hareket türü silindi')
    });
  };

  const addOvertimeType = () => {
    if (!newOvertimeType.trim() || settings.overtimeTypes.includes(newOvertimeType.trim())) return;
    const updated = { ...settings, overtimeTypes: [...settings.overtimeTypes, newOvertimeType.trim()] };
    updateMutation.mutate(updated, {
      onSuccess: () => {
        setNewOvertimeType('');
        toast.success('Mesai türü eklendi');
      }
    });
  };

  const removeOvertimeType = (type: string) => {
    const updated = { ...settings, overtimeTypes: settings.overtimeTypes.filter(t => t !== type) };
    updateMutation.mutate(updated, {
      onSuccess: () => toast.success('Mesai türü silindi')
    });
  };

  const downloadExcelTemplate = async () => {
    try {
      toast.info('Şablon hazırlanıyor...', { duration: 2000 });
      const { data: personnel, error } = await supabase
        .from('personnel')
        .select('*')
        .eq('is_active', true);
        
      if (error) throw error;
      
      const getOrder = (p: any) => {
         const d = (p.department || '').toLocaleLowerCase('tr-TR');
         const fullName = `${(p.first_name || '').toLocaleLowerCase('tr-TR')} ${(p.last_name || '').toLocaleLowerCase('tr-TR')}`;
         
         if (fullName.includes('turgay dolu') || d.includes('müdür')) return 0;
         if (d.includes('çocuk')) return 1;
         if (d.includes('kadın') || d.includes('kadin')) return 2;
         if (d.includes('erkek')) return 3;
         if (d.includes('kasa') || d.includes('kasiyer')) return 100; // En alt sıra
         return 99; // Diğer reyonlar
      };
      
      const activeFiltered = (personnel || []).filter(p => {
         const d = (p.department || '').toLocaleLowerCase('tr-TR');
         return !d.includes('ortak satıcı') && !d.includes('tüm reyonlar') && !d.includes('ortak satici');
      });
      
      const sortedPersonnel = activeFiltered.sort((a, b) => {
         const orderA = getOrder(a);
         const orderB = getOrder(b);
         if (orderA !== orderB) return orderA - orderB;
         return (`${a.first_name} ${a.last_name}`).localeCompare(`${b.first_name} ${b.last_name}`);
      });
      
      const templateData = sortedPersonnel.length > 0 
        ? sortedPersonnel.map(p => ({
            'Reyon': p.department || 'Diğer',
            'Ad Soyad': `${p.first_name} ${p.last_name}`,
            'Pazartesi': '', 'Salı': '', 'Çarşamba': '', 'Perşembe': '', 'Cuma': '', 'Cumartesi': '', 'Pazar': ''
          }))
        : [
            { 'Reyon': 'Örnek Reyon', 'Ad Soyad': 'Personel Bulunamadı', 'Pazartesi': 'S', 'Salı': 'A', 'Çarşamba': 'İ', 'Perşembe': 'S', 'Cuma': 'A', 'Cumartesi': 'S', 'Pazar': 'İ' }
          ];

      if (sortedPersonnel.length > 0) {
        templateData.push({ 'Reyon': '--- DEPO ÇALIŞMASI ---', 'Ad Soyad': '----------------', 'Pazartesi': 'Pazartesi', 'Salı': 'Salı', 'Çarşamba': 'Çarşamba', 'Perşembe': 'Perşembe', 'Cuma': 'Cuma', 'Cumartesi': 'Cumartesi', 'Pazar': 'Pazar' });
        sortedPersonnel.forEach(p => {
          templateData.push({
            'Reyon': `Depo (${p.department || 'Diğer'})`,
            'Ad Soyad': `${p.first_name} ${p.last_name}`,
            'Pazartesi': '', 'Salı': '', 'Çarşamba': '', 'Perşembe': '', 'Cuma': '', 'Cumartesi': '', 'Pazar': ''
          });
        });

        templateData.push({ 'Reyon': '--- MUTFAK ÇALIŞMASI ---', 'Ad Soyad': '----------------', 'Pazartesi': 'Pazartesi', 'Salı': 'Salı', 'Çarşamba': 'Çarşamba', 'Perşembe': 'Perşembe', 'Cuma': 'Cuma', 'Cumartesi': 'Cumartesi', 'Pazar': 'Pazar' });
        sortedPersonnel.forEach(p => {
          templateData.push({
            'Reyon': `Mutfak (${p.department || 'Diğer'})`,
            'Ad Soyad': `${p.first_name} ${p.last_name}`,
            'Pazartesi': '', 'Salı': '', 'Çarşamba': '', 'Perşembe': '', 'Cuma': '', 'Cumartesi': '', 'Pazar': ''
          });
        });
      }

      const ws = utils.json_to_sheet(templateData);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Sablon");
      writeFile(wb, "Vardiya_Sablon.xlsx");
      toast.success('Şablon mevcut personel listenize göre oluşturuldu!');
    } catch (err: any) {
      toast.error('Şablon indirilemedi: ' + err.message);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = utils.sheet_to_json(ws);
          
          const updated = { ...settings, weeklySchedule: data };
          updateMutation.mutate(updated, {
             onSuccess: () => toast.success('Excel vardiya çizelgesi sisteme kaydedildi!')
          });
        } catch(err:any) {
           toast.error('Dosya okunamadı: ' + err.message);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      toast.error('Excel yükleme hatası: ' + err.message);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage.from('announcements').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('announcements').getPublicUrl(fileName);
      
      const currentImages = settings.announcementImages || [];
      const updated = { ...settings, announcementImages: [...currentImages, data.publicUrl] };
      
      updateMutation.mutate(updated, {
        onSuccess: () => toast.success('Görsel yüklendi')
      });
    } catch (err: any) {
      toast.error('Görsel yükleme hatası: ' + err.message);
    } finally {
      setUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveImage = async (url: string) => {
    try {
      // Opt: Delete the file from bucket as well if we extract filename, but we can just remove URL for simplicity/safety
      const updated = { ...settings, announcementImages: (settings.announcementImages || []).filter(img => img !== url) };
      updateMutation.mutate(updated, {
        onSuccess: () => toast.success('Görsel kaldırıldı')
      });
    } catch (err: any) {
      toast.error('Görsel kaldırma hatası: ' + err.message);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Ayarlar yükleniyor...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Settings className="w-8 h-8" />
        <h1 className="text-3xl font-bold text-foreground">Sistem Ayarları</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Mola Ayarları</CardTitle>
            <CardDescription>Personelin tek seferde kullanabileceği maksimum mola süresi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="break_limit">Toplam Mola Süresi (Dakika)</Label>
                <Input
                  id="break_limit"
                  type="number"
                  value={localLimit}
                  onChange={(e) => setLocalLimit(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button onClick={handleUpdateBreakLimit} disabled={updateMutation.isPending}>
                Kaydet
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Haftalık Vardiya / Görev Planı (Excel)</CardTitle>
            <CardDescription>
              Excel şablonunu indirip doldurarak sisteme yükleyin. S: Sabah, A: Akşam, İ: İzinli, +M: Mutfak, +D: Depo ("S+M", "A+D").
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button variant="outline" className="w-full" onClick={downloadExcelTemplate}>
                Örnek Şablonu İndir
              </Button>
              <div className="pt-2">
                <Label htmlFor="excel_upload" className="font-semibold block mb-2">Doldurulmuş Excel'i Yükle</Label>
                <Input type="file" id="excel_upload" accept=".xlsx, .xls" onChange={handleExcelUpload} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Personel Hareket Türleri</CardTitle>
            <CardDescription>Sisteme eklenebilecek hareket seçeneklerini yönetin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Yeni tür ekle..."
                value={newMovementType}
                onChange={(e) => setNewMovementType(e.target.value)}
              />
              <Button onClick={addMovementType} disabled={updateMutation.isPending}><Plus className="w-4 h-4" /></Button>
            </div>
            <ul className="space-y-2">
              {settings.movementTypes.map((type, idx) => (
                <li key={idx} className="flex justify-between items-center bg-muted/50 p-2 rounded">
                  <span>{type}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeMovementType(type)} disabled={updateMutation.isPending} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Mesai Türleri</CardTitle>
            <CardDescription>Sisteme eklenebilecek fazla mesai bildirim seçeneklerini yönetin</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Yeni tür ekle..."
                value={newOvertimeType}
                onChange={(e) => setNewOvertimeType(e.target.value)}
              />
              <Button onClick={addOvertimeType} disabled={updateMutation.isPending}><Plus className="w-4 h-4" /></Button>
            </div>
            <ul className="space-y-2">
              {settings.overtimeTypes.map((type, idx) => (
                <li key={idx} className="flex justify-between items-center bg-muted/50 p-2 rounded">
                  <span>{type}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeOvertimeType(type)} disabled={updateMutation.isPending} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> Personel Paneli Düzeni</CardTitle>
          <CardDescription>Personel giriş yaptığında göreceği kontrol paneli özet kutularını buradan açıp kapatabilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'showOvertime', label: 'Toplam Fazla Mesai', desc: 'Personelin fazla mesai hakedişini gösterir' },
              { key: 'showBreakViolations', label: 'Mola İhlal Özeti', desc: 'Günlük mola ihlallerini gösterir' },
              { key: 'showLeaveStatus', label: 'Yıllık İzin Durumu', desc: 'Yıllık izin hakkı ve kalan izni gösterir' },
              { key: 'showSalesTargets', label: 'Aylık Satış Özetleri', desc: 'Kişisel ve reyon satış hedeflerini gösterir' },
              { key: 'showMovements', label: 'Kişisel Hareketler', desc: 'Son personel hareketleri geçmişini gösterir' },
              { key: 'showReminders', label: 'Duyurular', desc: 'Personele yapılan genel veya özel duyuruları gösterir' }
            ].map(f => {
               const features = settings.employeeDashboardFeatures || defaultSettings.employeeDashboardFeatures!;
               const isChecked = features[f.key as keyof typeof features] ?? true;
               return (
                 <div key={f.key} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                   <div>
                     <p className="font-medium text-foreground">{f.label}</p>
                     <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                   </div>
                   <Switch 
                     checked={isChecked} 
                     onCheckedChange={() => handleFeatureToggle(f.key as any)} 
                     disabled={updateMutation.isPending}
                   />
                 </div>
               )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ImagePlus className="w-5 h-5" /> Personel Ekranı Shift / Çalışma Programı Görselleri</CardTitle>
          <CardDescription>Personel ekranının en altında alt alta gösterilecek dilediğiniz kadar görsel yükleyebilirsiniz.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="max-w-md"
                disabled={uploadingImage} 
              />
              {uploadingImage && <span className="text-sm text-muted-foreground animate-pulse">Yükleniyor...</span>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {(settings.announcementImages || []).map((imgUrl, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden border border-border/50 bg-black/5 flex items-center justify-center p-2 h-40">
                   <img src={imgUrl} alt={`Duyuru ${idx+1}`} className="max-h-full max-w-full object-contain" />
                   <Button 
                     variant="destructive" 
                     size="icon" 
                     className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                     onClick={() => handleRemoveImage(imgUrl)}
                   >
                     <X className="w-4 h-4" />
                   </Button>
                </div>
              ))}
              {(!settings.announcementImages || settings.announcementImages.length === 0) && (
                <div className="col-span-1 md:col-span-3 py-8 text-center text-muted-foreground bg-muted/20 border border-dashed rounded-lg">
                  Henüz görsel yüklenmemiş.
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SystemSettingsView;
