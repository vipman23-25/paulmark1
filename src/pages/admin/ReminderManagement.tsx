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
    is_survey: false,
    recurrence: 'none',
    recurrence_days: ['1']
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
          ),
          responses:reminder_responses (
            *,
            personnel (first_name, last_name)
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

    let finalRecurrence = formData.recurrence;
    if (formData.recurrence === 'weekly' || formData.recurrence === 'monthly') {
      finalRecurrence = `${formData.recurrence},${formData.recurrence_days.join(',')}`;
    }

    const payload = {
      personnel_id: formData.personnel_id || null,
      department_name: formData.department_name === 'all' ? 'Tümü' : (formData.department_name || null),
      title: formData.title,
      description: formData.description,
      is_active: formData.is_active,
      is_survey: formData.is_survey,
      recurrence: finalRecurrence
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
    let recType = 'none';
    let recDays = ['1'];

    if (reminder.recurrence) {
      const parts = reminder.recurrence.split(',');
      recType = parts[0];
      if (parts.length > 1) {
        recDays = parts.slice(1);
      }
    }

    setFormData({
      personnel_id: reminder.personnel_id || '',
      department_name: reminder.department_name === 'Tümü' ? 'all' : (reminder.department_name || ''),
      title: reminder.title,
      description: reminder.description || '',
      is_active: reminder.is_active,
      is_survey: reminder.is_survey || false,
      recurrence: recType,
      recurrence_days: recDays
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
      is_survey: false,
      recurrence: 'none',
      recurrence_days: ['1']
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

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-foreground">Döngüsel Tekrar (Takvim)</label>
                <select
                  value={formData.recurrence}
                  onChange={(e) => setFormData({ ...formData, recurrence: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground mt-1"
                >
                  <option value="none">Bir Kez (Tekrar Yok)</option>
                  <option value="daily">Her Gün</option>
                  <option value="weekly">Her Hafta</option>
                  <option value="monthly">Her Ay</option>
                </select>
              </div>

              {formData.recurrence === 'weekly' && (
                <div className="flex-1 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-foreground mb-2 block">Hangi Gün(ler)?</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: '1', label: 'Pzt' },
                      { val: '2', label: 'Sal' },
                      { val: '3', label: 'Çar' },
                      { val: '4', label: 'Per' },
                      { val: '5', label: 'Cum' },
                      { val: '6', label: 'Cmt' },
                      { val: '0', label: 'Paz' }
                    ].map(day => (
                      <label key={day.val} className="flex items-center gap-1 bg-muted/50 px-2 py-1 rounded cursor-pointer hover:bg-muted select-none">
                        <input 
                          type="checkbox" 
                          checked={formData.recurrence_days.includes(day.val)}
                          onChange={(e) => {
                            let newDays = [...formData.recurrence_days];
                            if (e.target.checked) newDays.push(day.val);
                            else newDays = newDays.filter(d => d !== day.val);
                            if (newDays.length === 0) newDays = [day.val]; // prevent empty
                            setFormData({...formData, recurrence_days: newDays});
                          }}
                        />
                        <span className="text-sm">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.recurrence === 'monthly' && (
                <div className="flex-1 animate-in fade-in slide-in-from-top-2">
                  <label className="text-sm font-medium text-foreground mb-2 block">Ayın Kaçıncı Günleri?</label>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({length: 31}, (_, i) => String(i + 1)).map(d => (
                      <label key={d} className={`flex items-center justify-center py-1 rounded cursor-pointer text-xs border select-none ${formData.recurrence_days.includes(d) ? 'bg-primary text-primary-foreground border-primary font-bold' : 'bg-background hover:bg-muted'}`}>
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={formData.recurrence_days.includes(d)}
                          onChange={(e) => {
                            let newDays = [...formData.recurrence_days];
                            if (e.target.checked) newDays.push(d);
                            else newDays = newDays.filter(x => x !== d);
                            if (newDays.length === 0) newDays = [d]; // prevent empty
                            setFormData({...formData, recurrence_days: newDays});
                          }}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_survey}
                  onChange={(e) => setFormData({ ...formData, is_survey: e.target.checked })}
                  id="is_survey"
                  className="w-4 h-4"
                />
                <label htmlFor="is_survey" className="text-sm font-medium text-foreground">Anket / Görev Modu (Personel Geri Bildirimi İste)</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  id="is_active"
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-foreground">Etkinleştir</label>
              </div>
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
                      {reminder.is_survey && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                          Geri Bildirimli (Anket/Görev)
                        </span>
                      )}
                      {reminder.recurrence && reminder.recurrence !== 'none' && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                          {(() => {
                            if (reminder.recurrence === 'daily') return 'Tekrar: Her Gün';
                            if (reminder.recurrence.startsWith('weekly')) {
                              const dayMap: any = { '1': 'Pzt', '2': 'Sal', '3': 'Çar', '4': 'Per', '5': 'Cum', '6': 'Cmt', '0': 'Paz'};
                              const days = reminder.recurrence.split(',').slice(1);
                              const names = days.map((d: string) => dayMap[d]).join(', ');
                              return `Tekrar: Her Hafta (${names})`;
                            }
                            if (reminder.recurrence.startsWith('monthly')) {
                               const days = reminder.recurrence.split(',').slice(1).join(', ');
                               return `Tekrar: Ayın Günleri (${days})`;
                            }
                            return 'Tekrar: ' + reminder.recurrence;
                          })()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 font-medium bg-muted/50 p-1 rounded inline-block">
                      {reminder.personnel ? `👤 ${reminder.personnel.first_name} ${reminder.personnel.last_name}` : (reminder.department_name === 'Tümü' ? '🏢 Tüm Şirket' : `🛍️ ${reminder.department_name} Reyonu`)}
                    </p>
                    {reminder.description && (
                      <p className="text-sm text-muted-foreground mb-2">{reminder.description}</p>
                    )}
                    
                    {reminder.is_survey && (() => {
                      const respondedIds = (reminder.responses || []).map((r:any) => r.personnel_id);
                      
                      let targetAudience = personnel;
                      if (reminder.personnel_id) {
                        targetAudience = personnel.filter((p:any) => p.id === reminder.personnel_id);
                      } else if (reminder.department_name && reminder.department_name !== 'Tümü') {
                        targetAudience = personnel.filter((p:any) => p.department === reminder.department_name);
                      }

                      const missingPersonnel = targetAudience.filter((p:any) => !respondedIds.includes(p.id));

                      return (
                        <div className="mt-4 flex flex-col md:flex-row gap-4">
                          {/* Responded */}
                          <div className="flex-1 p-3 bg-muted/30 rounded-lg border">
                            <h4 className="text-xs font-semibold text-foreground mb-2 text-primary uppercase tracking-wide">
                              Yanıt Verenler ({reminder.responses?.length || 0})
                            </h4>
                            {reminder.responses && reminder.responses.length > 0 ? (
                              <div className="overflow-auto max-h-[200px]">
                                <table className="w-full text-sm text-left">
                                  <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0">
                                    <tr>
                                      <th className="px-2 py-1.5">Personel</th>
                                      <th className="px-2 py-1.5">Durum (Tepki)</th>
                                      <th className="px-2 py-1.5">Tarih</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {reminder.responses.sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((resp: any) => (
                                      <tr key={resp.id} className="border-b border-muted last:border-0 hover:bg-muted/10">
                                        <td className="px-2 py-2 font-medium">{resp.personnel?.first_name} {resp.personnel?.last_name}</td>
                                        <td className="px-2 py-2">
                                          <span className="inline-block px-2 py-0.5 bg-background border rounded-md text-[10px] font-semibold text-primary">{resp.status}</span>
                                        </td>
                                        <td className="px-2 py-2 text-muted-foreground text-xs">{format(new Date(resp.created_at), 'dd.MM.yyyy HH:mm')}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Henüz yanıt veren yok.</p>
                            )}
                          </div>

                          {/* Missing */}
                          <div className="flex-1 p-3 bg-red-50/50 dark:bg-red-950/20 rounded-lg border border-red-100 dark:border-red-900/30">
                            <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 mb-2 uppercase tracking-wide">
                              Bekleyenler / Dönüş Yapmayanlar ({missingPersonnel.length})
                            </h4>
                            {missingPersonnel.length > 0 ? (
                              <div className="overflow-auto max-h-[200px] flex gap-2 flex-wrap content-start">
                                {missingPersonnel.map((p: any) => (
                                  <span key={p.id} className="inline-flex items-center px-2 py-1 bg-background border rounded text-xs text-muted-foreground">
                                    👤 {p.first_name} {p.last_name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">Eksik yanıt bulunmuyor, herkes dönüş yapmış.</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
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
