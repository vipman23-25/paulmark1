import { useEffect } from 'react';
import { mockDb } from '@/services/mockDatabase';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Keep track of which reminders we have already shown a toast for in this session
const alertedReminderIds = new Set<string>();

export const useReminders = () => {
  const { user, isAdmin } = useAuth();
  
  useEffect(() => {
    if (!user || !isAdmin) return;

    const checkReminders = () => {
      const reminders = mockDb.getAllReminders();
      reminders.forEach(r => {
        if (!r.is_active) return;
        
        const reminderDate = new Date(r.reminder_date).setHours(0, 0, 0, 0);
        const today = new Date().setHours(0, 0, 0, 0);
        
        // Delete past reminders automatically
        if (reminderDate < today) {
          mockDb.deleteReminder(r.id);
          return;
        }
        
        // Trigger notification for today's reminders (only once per session)
        if (reminderDate === today && !alertedReminderIds.has(r.id)) {
          toast.info(`⏰ Günlük Hatırlatma: ${r.title}`, {
            description: r.description || undefined,
            duration: 10000,
          });
          alertedReminderIds.add(r.id);
        }
      });
    };

    // Check immediately on mount, then every minute
    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    
    return () => clearInterval(interval);
  }, [user, isAdmin]);
};
