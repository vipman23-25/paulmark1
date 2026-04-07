import { useEffect, useState } from 'react';
import { mockDb } from '@/services/mockDatabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Edit2, Trash2, Plus, Clock, ToggleRight, ToggleLeft } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const ReminderManagement = () => {
  const [reminders, setReminders] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    personnel_id: '',
    title: '',
    description: '',
    reminder_date: format(new Date(), 'yyyy-MM-dd'),
    reminder_time: '09:00',
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    try {
      setReminders(mockDb.getAllReminders());
      setPersonnel(mockDb.getAllPersonnel());
      setLoading(false);
    } catch (error) {
      toast.error('Veri yükleme hatası');
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!formData.personnel_id || !formData.title.trim() || !formData.reminder_date) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      if (editingId) {
        mockDb.updateReminder(editingId, {
          personnel_id: formData.personnel_id,
          title: formData.title,
          description: formData.description,
          reminder_date: formData.reminder_date,
          reminder_time: formData.reminder_time,
          is_active: formData.is_active,
        });
        toast.success('Hatırlatıcı güncellendi');
      } else {
        mockDb.addReminder({
          personnel_id: formData.personnel_id,
          title: formData.title,
          description: formData.description,
          reminder_date: formData.reminder_date,
          reminder_time: formData.reminder_time,
          is_active: formData.is_active,
        });
        toast.success('Hatırlatıcı oluşturuldu');
      }
      loadData();
      resetForm();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Silmek istediğinizden emin misiniz?')) {
      try {
        mockDb.deleteReminder(id);
        toast.success('Hatırlatıcı silindi');
        loadData();
      } catch (error) {
        toast.error('Silme başarısız');
      }
    }
  };

  const handleEdit = (reminder: any) => {
    setFormData({
      personnel_id: reminder.personnel_id,
      title: reminder.title,
      description: reminder.description,
      reminder_date: reminder.reminder_date,
      reminder_time: reminder.reminder_time || '09:00',
      is_active: reminder.is_active,
    });
    setEditingId(reminder.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      personnel_id: '',
      title: '',
      description: '',
      reminder_date: format(new Date(), 'yyyy-MM-dd'),
      reminder_time: '09:00',
      is_active: true,
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const toggleActive = (id: string, currentStatus: boolean) => {
    try {
      mockDb.updateReminder(id, { is_active: !currentStatus });
      toast.success(currentStatus ? 'Hatırlatıcı devre dışı bırakıldı' : 'Hatırlatıcı etkinleştirildi');
      loadData();
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const getPersonnelName = (id: string) => {
    const p = personnel.find(p => p.id === id);
    return p ? `${p.first_name} ${p.last_name}` : 'Bilinmeyen';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Hatırlatıcı Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Personel hatırlatıcılarını yönetin</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} size="lg">
          <Plus className="h-4 w-4 mr-2" /> Yeni Hatırlatıcı
        </Button>
      </div>

      {isModalOpen && (
        <Card className="bg-muted/50 border-2">
          <CardHeader>
            <CardTitle>{editingId ? 'Hatırlatıcı Düzenle' : 'Yeni Hatırlatıcı'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Personel *</label>
              <select
                value={formData.personnel_id}
                onChange={(e) => setFormData({ ...formData, personnel_id: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="">Seçiniz...</option>
                {personnel.filter(p => p.is_active).map(p => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Başlık *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Hatırlatıcı başlığı"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Açıklama</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detaylı açıklama"
                rows={3}
              />
            </div>

      <div>
              <label className="text-sm font-medium text-foreground">Tarih *</label>
              <Input
                type="date"
                value={formData.reminder_date}
                onChange={(e) => setFormData({ ...formData, reminder_date: e.target.value })}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Saat</label>
              <Input
                type="time"
                value={formData.reminder_time || ''}
                onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                id="is_active"
                className="w-4 h-4"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-foreground">Etkin</label>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetForm}>İptal</Button>
              <Button onClick={handleSubmit}>Kaydet</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">Yükleniyor...</p>
        </div>
      ) : reminders.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Henüz hatırlatıcı oluşturulmadı</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reminders.map(reminder => (
            <Card key={reminder.id} className="glass-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{reminder.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        reminder.is_active 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100'
                      }`}>
                        {reminder.is_active ? 'Etkin' : 'Devre Dışı'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{getPersonnelName(reminder.personnel_id)}</p>
                    {reminder.description && (
                      <p className="text-sm text-muted-foreground mb-2">{reminder.description}</p>
                    )}
                    <div className="flex gap-3 text-sm font-medium text-muted-foreground">
                      <span>📅 {format(new Date(reminder.reminder_date), 'dd MMMM yyyy', { locale: tr })}</span>
                      {reminder.reminder_time && <span>🕐 {reminder.reminder_time}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(reminder.id, reminder.is_active)}
                      title={reminder.is_active ? 'Devre dışı bırak' : 'Etkinleştir'}
                    >
                      {reminder.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(reminder)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(reminder.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReminderManagement;
