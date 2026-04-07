// Mock Database Service using localStorage
// Replaces Supabase with local storage

export interface Personnel {
  id: string;
  personnel_number?: string;
  first_name: string;
  last_name: string;
  username: string;
  tc_no: string;
  department: string;
  start_date: string;
  end_date: string | null;
  password_hash: string;
  user_id: string;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  total_overdue_break?: number;
  used_leave?: number;
  remaining_leave?: number;
}

export interface AnnualLeave {
  id: string;
  personnel_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  status: 'pending' | 'approved' | 'rejected';
  description?: string;
  created_at: string;
}

export interface BreakRecord {
  id: string;
  personnel_id: string;
  break_start: string;
  break_end: string | null;
  created_at: string;
}

export interface WeeklyDayOff {
  id: string;
  personnel_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday...
  description?: string;
  status?: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface DayOff {
  id: string;
  personnel_id: string;
  day_date: string;
  description: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  personnel_id: string;
  title: string;
  description: string;
  reminder_date: string;
  reminder_time?: string;
  is_active: boolean;
  created_at: string;
}

export interface PersonnelMovement {
  id: string;
  personnel_id: string;
  movement_type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  description: string;
  created_at: string;
}

export interface OvertimeRecord {
  id: string;
  personnel_id: string;
  record_date: string;
  hours: number;
  record_type: string;
  description: string;
  created_at: string;
}

export interface SystemSettings {
  breakLimitMinutes: number;
  movementTypes: string[];
  overtimeTypes: string[];
}

export interface Notification {
  id: string;
  personnel_id: string;
  type: 'annual_leave_request' | 'break_overdue' | 'reminder';
  message: string;
  is_read: boolean;
  created_at: string;
}

class MockDatabase {
  private personnel: Personnel[] = [];
  private breakRecords: BreakRecord[] = [];
  private weeklyDayOffs: WeeklyDayOff[] = [];
  private dayOffs: DayOff[] = [];
  private reminders: Reminder[] = [];
  private movements: PersonnelMovement[] = [];
  private overtimes: OvertimeRecord[] = [];
  private annualLeaves: AnnualLeave[] = [];
  private notifications: Notification[] = [];
  private settings: SystemSettings = {
    breakLimitMinutes: 60,
    movementTypes: ['İzin', 'Hastalık İzni', 'Muafiyet', 'Başka Görev'],
    overtimeTypes: ['Fazla Mesai', 'Alacak (Kullanım)']
  };

  constructor() {
    this.initializeData();
  }

  private initializeData() {
    // Load from localStorage or create mock data
    const stored = localStorage.getItem('mockDb');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.personnel = data.personnel || [];
        this.breakRecords = data.breakRecords || [];
        this.weeklyDayOffs = data.weeklyDayOffs || [];
        this.dayOffs = data.dayOffs || [];
        this.reminders = data.reminders || [];
        this.movements = data.movements || [];
        this.overtimes = data.overtimes || [];
        this.annualLeaves = data.annualLeaves || [];
        this.notifications = data.notifications || [];
        this.settings = data.settings || this.settings;
      } catch (e) {
        this.createMockData();
      }
    } else {
      this.createMockData();
    }
  }

  private createMockData() {
    // Create sample personnel
    this.personnel = [
      {
        id: 'p1',
        personnel_number: 'P-001',
        first_name: 'Ahmet',
        last_name: 'Yılmaz',
        username: 'ahmet',
        tc_no: '12345678901',
        department: 'Ahşap Kesim',
        start_date: '2023-01-15',
        end_date: null,
        password_hash: '123456',
        user_id: 'u1',
        is_active: true,
        avatar_url: null,
        created_at: new Date().toISOString(),
        total_overdue_break: 0
      },
      {
        id: 'p2',
        personnel_number: 'P-002',
        first_name: 'Ayşe',
        last_name: 'Demir',
        username: 'ayse',
        tc_no: '98765432109',
        department: 'Bantlama',
        start_date: '2023-03-20',
        end_date: null,
        password_hash: '123456',
        user_id: 'u2',
        is_active: true,
        avatar_url: null,
        created_at: new Date().toISOString(),
        total_overdue_break: 0
      }
    ];

    this.annualLeaves = [
      {
        id: 'al1',
        personnel_id: 'p1',
        start_date: '2024-06-01',
        end_date: '2024-06-05',
        total_days: 5,
        status: 'approved',
        description: 'Yaz tatili',
        created_at: new Date().toISOString(),
      }
    ];

    this.breakRecords = [];
    this.weeklyDayOffs = [
      {
        id: 'w1',
        personnel_id: 'p1',
        day_of_week: 5, // Saturday
        description: 'Hafta sonu izni',
        status: 'approved', // Default existing to approved
        created_at: new Date().toISOString(),
      },
    ];
    this.dayOffs = [];
    this.reminders = [];
    this.movements = [];
    this.overtimes = [];
    this.notifications = [];

    this.save();
  }

  private save() {
    const data = {
      personnel: this.personnel,
      breakRecords: this.breakRecords,
      weeklyDayOffs: this.weeklyDayOffs,
      dayOffs: this.dayOffs,
      reminders: this.reminders,
      movements: this.movements,
      overtimes: this.overtimes,
      annualLeaves: this.annualLeaves,
      notifications: this.notifications,
      settings: this.settings,
    };
    localStorage.setItem('mockDb', JSON.stringify(data));
  }

  // Personnel methods
  getPersonnelByUserId(userId: string): Personnel | undefined {
    return this.personnel.find(p => p.user_id === userId);
  }

  getPersonnelById(personnelId: string): Personnel | undefined {
    return this.personnel.find(p => p.id === personnelId);
  }

  getAllPersonnel(): Personnel[] {
    return this.personnel;
  }

  addPersonnel(personnel: Omit<Personnel, 'id' | 'created_at'>): Personnel {
    const newPersonnel: Personnel = {
      ...personnel,
      id: `p${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.personnel.push(newPersonnel);
    this.save();
    return newPersonnel;
  }

  updatePersonnel(id: string, updates: Partial<Personnel>): void {
    const index = this.personnel.findIndex(p => p.id === id);
    if (index !== -1) {
      this.personnel[index] = { ...this.personnel[index], ...updates };
      this.save();
    }
  }

  deletePersonnel(id: string): void {
    this.personnel = this.personnel.filter(p => p.id !== id);
    this.save();
  }

  changePassword(userId: string, currentPass: string, newPass: string): boolean {
    const adminIndex = this.personnel.findIndex(p => p.user_id === userId && p.password_hash === currentPass);
    if (adminIndex !== -1) {
      this.personnel[adminIndex].password_hash = newPass;
      this.save();
      return true;
    }
    return false;
  }

  // Break Records methods
  getBreaksByPersonnelId(personnelId: string): BreakRecord[] {
    return this.breakRecords.filter(b => b.personnel_id === personnelId);
  }

  getAllBreaks(): BreakRecord[] {
    return this.breakRecords;
  }

  getActiveBreak(personnelId: string): BreakRecord | undefined {
    return this.breakRecords.find(b => b.personnel_id === personnelId && !b.break_end);
  }

  addBreakRecord(record: Omit<BreakRecord, 'id' | 'created_at'>): BreakRecord {
    const newRecord: BreakRecord = {
      ...record,
      id: `b${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.breakRecords.push(newRecord);
    this.save();
    return newRecord;
  }

  endBreak(id: string): void {
    const b = this.breakRecords.find(b => b.id === id);
    if (b) {
      b.break_end = new Date().toISOString();
      
      // Calculate Overdue Break
      const limit = this.getSettings().breakLimitMinutes;
      const today = b.break_start.split('T')[0];
      const todayBreaks = this.breakRecords.filter(br => br.personnel_id === b.personnel_id && br.break_start.startsWith(today));
      
      let totalMins = 0;
      todayBreaks.forEach(br => {
        if (br.break_end) {
          totalMins += Math.max(0, Math.floor((new Date(br.break_end).getTime() - new Date(br.break_start).getTime()) / 60000));
        }
      });
      
      const thisBreakDuration = Math.max(0, Math.floor((new Date(b.break_end).getTime() - new Date(b.break_start).getTime()) / 60000));
      const minsBefore = totalMins - thisBreakDuration;
      let overdueAdded = 0;
      
      if (minsBefore >= limit) {
        overdueAdded = thisBreakDuration;
      } else if (totalMins > limit) {
        overdueAdded = totalMins - limit;
      }

      if (overdueAdded > 0) {
        const p = this.personnel.find(p => p.id === b.personnel_id);
        if (p) {
          p.total_overdue_break = (p.total_overdue_break || 0) + overdueAdded;
        }
      }

      this.save();
    }
  }

  deleteBreak(id: string): void {
    this.breakRecords = this.breakRecords.filter(b => b.id !== id);
    this.save();
  }

  // Weekly Day Off methods
  getWeeklyDayOffs(personnelId: string): WeeklyDayOff[] {
    return this.weeklyDayOffs.filter(w => w.personnel_id === personnelId);
  }

  getAllWeeklyDayOffs(): WeeklyDayOff[] {
    return this.weeklyDayOffs;
  }

  addWeeklyDayOff(personnelId: string, dayOfWeek: number, description?: string): void {
    // Override existing if present
    const existingIndex = this.weeklyDayOffs.findIndex(w => w.personnel_id === personnelId);
    if (existingIndex !== -1) {
      this.weeklyDayOffs[existingIndex] = {
        ...this.weeklyDayOffs[existingIndex],
        day_of_week: dayOfWeek,
        description: description,
        status: 'approved'
      };
    } else {
      this.weeklyDayOffs.push({
        id: crypto.randomUUID(),
        personnel_id: personnelId,
        day_of_week: dayOfWeek,
        description: description,
        status: 'approved',
        created_at: new Date().toISOString()
      });
    }
    this.save();
  }

  updateWeeklyDayOffStatus(id: string, status: 'pending' | 'approved' | 'rejected'): void {
    const record = this.weeklyDayOffs.find(w => w.id === id);
    if (record) {
      record.status = status;
      this.save();
    }
  }

  removeWeeklyDayOff(id: string): void {
    this.weeklyDayOffs = this.weeklyDayOffs.filter(w => w.id !== id);
    this.save();
  }

  // --- Single Day Off Methods ---
  getAllDayOffs(): DayOff[] {
    return this.dayOffs;
  }

  removeDayOff(id: string): void {
    this.dayOffs = this.dayOffs.filter(d => d.id !== id);
    this.save();
  }

  // --- Annual Leave Methods ---
  getAllAnnualLeaves(): AnnualLeave[] {
    return this.annualLeaves;
  }

  getAnnualLeaves(personnelId: string): AnnualLeave[] {
    return this.annualLeaves.filter(a => a.personnel_id === personnelId);
  }

  addAnnualLeave(record: Omit<AnnualLeave, 'id' | 'created_at'>): AnnualLeave {
    const newRecord: AnnualLeave = {
      ...record,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };
    this.annualLeaves.push(newRecord);
    this.save();
    
    // Auto sync to movements if approved directly
    if (newRecord.status === 'approved') {
      this.addMovement({
        personnel_id: newRecord.personnel_id,
        movement_type: 'Yıllık İzin - Onaylandı',
        start_date: newRecord.start_date,
        end_date: newRecord.end_date,
        total_days: newRecord.total_days,
        description: newRecord.description || 'Yıllık İzin Kullanımı'
      });
    }

    return newRecord;
  }

  updateAnnualLeaveStatus(id: string, status: 'pending' | 'approved' | 'rejected'): void {
    const record = this.annualLeaves.find(a => a.id === id);
    if (!record) return;
    
    // Only add movement if it's changing to approved
    if (status === 'approved' && record.status !== 'approved') {
      this.addMovement({
        personnel_id: record.personnel_id,
        movement_type: 'Yıllık İzin - Onaylandı',
        start_date: record.start_date,
        end_date: record.end_date,
        total_days: record.total_days,
        description: record.description || 'Yıllık İzin Kullanımı'
      });
    }
    
    record.status = status;
    this.save();
  }

  removeAnnualLeave(id: string): void {
    this.annualLeaves = this.annualLeaves.filter(a => a.id !== id);
    this.save();
  }

  // Personnel Movement methods
  getMovements(personnelId: string): PersonnelMovement[] {
    return this.movements.filter(m => m.personnel_id === personnelId);
  }

  getAllMovements(): PersonnelMovement[] {
    return this.movements;
  }

  addMovement(movement: Omit<PersonnelMovement, 'id' | 'created_at'>): PersonnelMovement {
    const newMovement: PersonnelMovement = {
      ...movement,
      id: `m${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.movements.push(newMovement);
    this.save();
    return newMovement;
  }

  updateMovement(id: string, updates: Partial<PersonnelMovement>): void {
    const index = this.movements.findIndex(m => m.id === id);
    if (index !== -1) {
      this.movements[index] = { ...this.movements[index], ...updates };
      this.save();
    }
  }

  deleteMovement(id: string): void {
    this.movements = this.movements.filter(m => m.id !== id);
    this.save();
  }

  // Overtime methods
  getOvertimes(personnelId: string): OvertimeRecord[] {
    return this.overtimes.filter(o => o.personnel_id === personnelId);
  }

  getAllOvertimes(): OvertimeRecord[] {
    return this.overtimes;
  }

  addOvertime(overtime: Omit<OvertimeRecord, 'id' | 'created_at'>): OvertimeRecord {
    const newOvertime: OvertimeRecord = {
      ...overtime,
      id: `o${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.overtimes.push(newOvertime);
    this.save();
    return newOvertime;
  }

  deleteOvertime(id: string): void {
    this.overtimes = this.overtimes.filter(o => o.id !== id);
    this.save();
  }

  updateOvertime(id: string, updates: Partial<OvertimeRecord>): void {
    const index = this.overtimes.findIndex(o => o.id === id);
    if (index !== -1) {
      this.overtimes[index] = { ...this.overtimes[index], ...updates };
      this.save();
    }
  }

  // Day Off (Single day) methods
  getDayOffs(personnelId: string): DayOff[] {
    return this.dayOffs.filter(d => d.personnel_id === personnelId);
  }

  getAllDayOffs(): DayOff[] {
    return this.dayOffs;
  }

  addDayOff(record: Omit<DayOff, 'id' | 'created_at'>): DayOff {
    const newRecord: DayOff = {
      ...record,
      id: `d${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.dayOffs.push(newRecord);
    this.save();
    return newRecord;
  }

  removeDayOff(id: string): void {
    this.dayOffs = this.dayOffs.filter(d => d.id !== id);
    this.save();
  }

  updateDayOff(id: string, updates: Partial<DayOff>): void {
    const index = this.dayOffs.findIndex(d => d.id === id);
    if (index !== -1) {
      this.dayOffs[index] = { ...this.dayOffs[index], ...updates };
      this.save();
    }
  }

  // Reminder methods
  getReminders(personnelId: string): Reminder[] {
    return this.reminders.filter(r => r.personnel_id === personnelId);
  }

  getAllReminders(): Reminder[] {
    return this.reminders;
  }

  addReminder(record: Omit<Reminder, 'id' | 'created_at'>): Reminder {
    const newRecord: Reminder = {
      ...record,
      id: `r${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    this.reminders.push(newRecord);
    this.save();
    return newRecord;
  }

  deleteReminder(id: string): void {
    this.reminders = this.reminders.filter(r => r.id !== id);
    this.save();
  }

  updateReminder(id: string, updates: Partial<Reminder>): void {
    const index = this.reminders.findIndex(r => r.id === id);
    if (index !== -1) {
      this.reminders[index] = { ...this.reminders[index], ...updates };
      this.save();
    }
  }

  // System Settings methods
  getSettings(): SystemSettings {
    return this.settings;
  }

  updateSettings(updates: Partial<SystemSettings>): void {
    this.settings = { ...this.settings, ...updates };
    this.save();
  }

  // Clear all data
  clearAll(): void {
    this.personnel = [];
    this.breakRecords = [];
    this.weeklyDayOffs = [];
    this.dayOffs = [];
    this.reminders = [];
    this.movements = [];
    this.overtimes = [];
    this.save();
  }
}

export const mockDb = new MockDatabase();
