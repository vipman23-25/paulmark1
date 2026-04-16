import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Edit2, Trash2, Plus, Clock, ToggleRight, ToggleLeft, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

const ReminderManagement = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    personnel_id: '',
    department_name: '',
    title: '',
    description: '',
    is_active: true,
  });

  const { data: personnel = [] } = useQuery({
    queryKey: ['active_personnel'],
    queryFn: async () => {
      const { data, error } = await supabase.from('personnel').select('*').eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const { data: reminders = [], isLoading, refetch } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select(`
          *,
          personnel (
            first_name,
            last_name
          )
        `)
        .order('is_active', { ascending: false })
        .order('id', { ascending: false });
      if (error) {
        toast.error('Veri yükleme hatası: ' + error.message);
        throw error;
      }
      return data;
    }
  });

  const addMutation = useMutation({
    mutationFn: async (newRecord: any) => {
      const { data, error } = await supabase.from('reminders').insert([newRecord]).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Duyuru oluşturuldu');
      resetForm();
    },
    onError: (error: any) => toast.error('Oluşturma başarısız: ' + error.message)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string, updates: any }) => {
      const { data, error } = await supabase.from('reminders').update(updates).eq('id', id).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Duyuru güncellendi');
      if (isModalOpen) resetForm();
    },
    onError: (error: any) => toast.error('Güncelleme başarısız: ' + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reminders').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success('Duyuru silindi');
    },
    onError: (error: any) => toast.error('Silme başarısız: ' + error.message)
  });

  const handleSubmit = () => {
    if ((!formData.personnel_id && !formData.department_name) || !formData.title.trim()) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    const payload = {
      personnel_id: formData.personnel_id || null,
      department_name: formData.department_name === 'all' ? 'Tümü' : (formData.department_name || null),
      title: formData.title,
      description: formData.description,
      is_active: formData.is_active,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, updates: payload });
    } else {
      addMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Silmek istediğinizden emin misiniz?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (reminder: any) => {
    setFormData({
      personnel_id: reminder.personnel_id || '',
      department_name: reminder.department_name === 'Tümü' ? 'all' : (reminder.department_name || ''),
      title: reminder.title,
      description: reminder.description || '',
      is_active: reminder.is_active,
    });
    setEditingId(reminder.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      personnel_id: '',
      department_name: '',
      title: '',
      description: '',
      is_active: true,
    });
    setEditingId(null);
    setIsModalOpen(false);
  };

  const toggleActive = (id: string, currentStatus: boolean) => {
    updateMutation.mutate({ id, updates: { is_active: !currentStatus } });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Duyuru Yönetimi</h1>
          <p className="text-muted-foreground mt-1">Personel duyurularını yönetin</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()} title="Yenile">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => { resetForm(); setIsModalOpen(true); }} size="lg">
            <Plus className="h-4 w-4 mr-2" /> Yeni Duyuru
          </Button>
        </div>
      </div>

      {isModalOpen && (
        <Card className="bg-muted/50 border-2">
          <CardHeader>
            <CardTitle>{editingId ? 'Duyuru Düzenle' : 'Yeni Duyuru'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Hedef Kitle (Personel veya Reyon) *</label>
              <select
                value={formData.personnel_id ? `p_${formData.personnel_id}` : formData.department_name ? `d_${formData.department_name}` : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.startsWith('p_')) {
                    setFormData({ ...formData, personnel_id: val.replace('p_', ''), department_name: '' });
                  } else if (val.startsWith('d_')) {
                    setFormData({ ...formData, department_name: val.replace('d_', ''), personnel_id: '' });
                  } else {
                    setFormData({ ...formData, department_name: '', personnel_id: '' });
                  }
                }}
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
              >
                <option value="">Seçiniz...</option>
                <optgroup label="Reyonlar (Departman)">
                  <option value="d_all">Tüm Şirket Çalışanları</option>
                  {Array.from(new Set(personnel.map((p: any) => p.department).filter(Boolean))).map((dep: any) => (
                    <option key={`d_${dep}`} value={`d_${dep}`}>{dep} Reyonu</option>
                  ))}
                </optgroup>
                <optgroup label="Personeller">
                  {personnel.map((p: any) => (
                    <option key={`p_${p.id}`} value={`p_${p.id}`}>{p.first_name} {p.last_name}</option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Başlık *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Duyuru başlığı"
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
              <Button onClick={handleSubmit} disabled={addMutation.isPending || updateMutation.isPending}>Kaydet</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-muted-foreground animate-pulse">Yükleniyor...</p>
        </div>
      ) : reminders.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Henüz duyuru oluşturulmadı</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder: any) => (
            <Card key={reminder.id} className="glass-card">
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
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
                    <p className="text-sm text-muted-foreground mb-2 font-medium bg-muted/50 p-1 rounded inline-block">
                      {reminder.personnel ? `👤 ${reminder.personnel.first_name} ${reminder.personnel.last_name}` : (reminder.department_name === 'Tümü' ? '🏢 Tüm Şirket' : `🛍️ ${reminder.department_name} Reyonu`)}
                    </p>
                    {reminder.description && (
                      <p className="text-sm text-muted-foreground mb-2">{reminder.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(reminder.id, reminder.is_active)}
                      disabled={updateMutation.isPending}
                      title={reminder.is_active ? 'Devre dışı bırak' : 'Etkinleştir'}
                    >
                      {reminder.is_active ? <ToggleRight className="h-6 w-6 text-green-500" /> : <ToggleLeft className="h-6 w-6 text-gray-400" />}
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
                      disabled={deleteMutation.isPending}
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
