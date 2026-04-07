import { useEffect, useState } from 'react';
import { mockDb, SystemSettings } from '@/services/mockDatabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Settings, Plus, Trash2 } from 'lucide-react';

const SystemSettingsView = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [newMovementType, setNewMovementType] = useState('');
  const [newOvertimeType, setNewOvertimeType] = useState('');

  useEffect(() => {
    setSettings(mockDb.getSettings());
  }, []);

  const handleUpdateBreakLimit = (val: string) => {
    if (!settings) return;
    const limit = parseInt(val, 10);
    if (isNaN(limit) || limit < 1) {
      toast.error('Geçerli bir dakika değeri giriniz');
      return;
    }
    const updated = { ...settings, breakLimitMinutes: limit };
    mockDb.updateSettings(updated);
    setSettings(updated);
    toast.success('Mola süresi güncellendi');
  };

  const addMovementType = () => {
    if (!settings || !newMovementType.trim()) return;
    const updated = { ...settings, movementTypes: [...settings.movementTypes, newMovementType.trim()] };
    mockDb.updateSettings(updated);
    setSettings(updated);
    setNewMovementType('');
    toast.success('Hareket türü eklendi');
  };

  const removeMovementType = (type: string) => {
    if (!settings) return;
    const updated = { ...settings, movementTypes: settings.movementTypes.filter(t => t !== type) };
    mockDb.updateSettings(updated);
    setSettings(updated);
    toast.success('Hareket türü silindi');
  };

  const addOvertimeType = () => {
    if (!settings || !newOvertimeType.trim()) return;
    const updated = { ...settings, overtimeTypes: [...settings.overtimeTypes, newOvertimeType.trim()] };
    mockDb.updateSettings(updated);
    setSettings(updated);
    setNewOvertimeType('');
    toast.success('Mesai türü eklendi');
  };

  const removeOvertimeType = (type: string) => {
    if (!settings) return;
    const updated = { ...settings, overtimeTypes: settings.overtimeTypes.filter(t => t !== type) };
    mockDb.updateSettings(updated);
    setSettings(updated);
    toast.success('Mesai türü silindi');
  };

  if (!settings) return <p>Yükleniyor...</p>;

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
                  defaultValue={settings.breakLimitMinutes}
                  onChange={(e) => setSettings({ ...settings, breakLimitMinutes: Number(e.target.value) })}
                  className="mt-1"
                />
              </div>
              <Button onClick={() => handleUpdateBreakLimit(settings.breakLimitMinutes.toString())}>
                Kaydet
              </Button>
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
              <Button onClick={addMovementType}><Plus className="w-4 h-4" /></Button>
            </div>
            <ul className="space-y-2">
              {settings.movementTypes.map((type, idx) => (
                <li key={idx} className="flex justify-between items-center bg-muted/50 p-2 rounded">
                  <span>{type}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeMovementType(type)} className="text-red-500 hover:text-red-700">
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
              <Button onClick={addOvertimeType}><Plus className="w-4 h-4" /></Button>
            </div>
            <ul className="space-y-2">
              {settings.overtimeTypes.map((type, idx) => (
                <li key={idx} className="flex justify-between items-center bg-muted/50 p-2 rounded">
                  <span>{type}</span>
                  <Button variant="ghost" size="sm" onClick={() => removeOvertimeType(type)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemSettingsView;
