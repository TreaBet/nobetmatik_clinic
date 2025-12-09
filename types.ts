
export type Role = number; // 1, 2, 3, 4 etc.
export type Group = 'A' | 'B' | 'C' | 'D' | 'Genel';
export type AppMode = 'doctor' | 'nurse';

export interface Staff {
  id: string;
  name: string;
  role: number; // Numeric seniority level
  group: Group;
  unit?: string; // Nurse specific: Unit/Department
  specialty?: string; // Nurse specific: Specialty/Certificate
  room?: string; // Nurse specific: Room number for conflict avoidance
  quotaService: number; // Target for normal services
  quotaEmergency: number; // Target for emergency services
  weekendLimit: number; // Max weekend shifts
  offDays: number[]; // Days of month they cannot work
  requestedDays: number[]; // Days they specifically want to work
  isActive: boolean; // Determines if included in schedule generation
}

export interface RoleConfig {
  role: number;
  quotaService: number;
  quotaEmergency: number;
  weekendLimit: number;
}

export interface Service {
  id: string;
  name: string;
  minDailyCount: number; // Min staff needed
  maxDailyCount: number; // Max staff allowed
  allowedRoles: number[]; // Array of role numbers allowed (e.g. [1, 2])
  priorityRoles?: number[]; // Preferred roles for this service
  preferredGroup?: Group | 'Farketmez';
  allowedUnits?: string[]; // Nurse specific: Only these units can work here
  isEmergency: boolean; // True if this counts towards Emergency Quota
}

export interface ShiftAssignment {
  serviceId: string;
  staffId: string;
  staffName: string;
  role: number;
  group: Group;
  unit?: string;
  isEmergency: boolean;
}

export interface DaySchedule {
  day: number;
  assignments: ShiftAssignment[];
  isWeekend: boolean;
  isHoliday: boolean;
}

export interface Stats {
    staffId: string;
    totalShifts: number;
    serviceShifts: number;
    emergencyShifts: number;
    weekendShifts: number;
    saturdayShifts: number;
    sundayShifts: number;
}

export interface ScheduleResult {
  schedule: DaySchedule[];
  unfilledSlots: number;
  logs: string[]; // Error logs
  stats: Stats[];
  fitness?: number; // Internal score for GA
}

export interface SchedulerConfig {
  year: number;
  month: number; // 0-11
  maxRetries: number;
  randomizeOrder: boolean; // Process days in random order
  preventEveryOtherDay: boolean; // Avoid Day-2 / Day+2 patterns
  holidays: number[]; // Days of month considered public holidays
  useFatigueModel?: boolean; // Enable dynamic stress/fatigue calculations
  useGeneticAlgorithm?: boolean; // Enable evolutionary solver
  
  // Nurse Specific Configs
  unitConstraints?: UnitConstraint[];
  dailyTotalTarget?: number;
}

export interface UnitConstraint {
    unit: string;
    allowedDays: number[]; // 0=Sun, 1=Mon...
}

export interface Preset {
    id: string;
    name: string;
    staff: Staff[];
    services: Service[];
    unitConstraints: UnitConstraint[];
    dailyTotalTarget: number;
    customUnits?: string[];
    customSpecialties?: string[];
}
