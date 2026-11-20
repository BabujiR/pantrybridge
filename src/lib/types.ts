export type Role = 'admin' | 'staff' | 'volunteer';
export type VisitType = 'distribution' | 'pantry' | 'program';

export interface Member { name: string; relationship: string; ageCategory: string }

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dob: string | null;
  ageCategory: string;
  gender: string;
  phone: string;
  email: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  householdId: string;
  registrationDate: string;
  lastServiceDate: string | null;
  consent: boolean;
  consentDate: string | null;
  eligibility: string[];
  heardFrom: string;
  language: string;
  source: string;
}

export interface Household {
  id: string;
  headClientId: string;
  members: Member[];
  zip: string;
  createdDate: string;
}

export interface DistEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  expected: number;
}

export interface Visit {
  id: string;
  type: VisitType;
  clientId: string;
  householdId: string;
  date: string;
  time: string;
  eventId?: string;
  householdSize: number;
  categories: string[];
  lbs?: number;
  program?: string;
  firstTime: boolean;
  by: string;
}

export type PantryStatus = 'Scheduled' | 'Completed' | 'Canceled' | 'Missed';
export interface PantryAppt {
  id: string;
  clientId: string;
  date: string;
  time: string;
  status: PantryStatus;
  notes: string;
  categories: string[];
  lbs?: number;
}

export type ProgramStatus = 'Scheduled' | 'Completed' | 'Canceled' | 'No-show';
export interface ProgramAppt {
  id: string;
  clientId: string;
  program: string;
  date: string;
  time: string;
  status: ProgramStatus;
  notes: string;
  followUp: string | null;
}

export interface Referral {
  id: string;
  clientId: string;
  to: string;
  kind: 'Partner agency' | 'Internal program';
  status: 'Sent' | 'Accepted' | 'Completed';
  date: string;
  note: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  mfa: boolean;
  lastLogin: string | null;
}

export interface Program { id: string; name: string; color: string; active: boolean }
export interface FoodCategory { id: string; name: string; active: boolean }

export interface LogEntry {
  id: string;
  ts: string;
  user: string;
  role: Role;
  action: string;
  record: string;
  before?: string;
  after?: string;
}

export interface FieldSetting { key: string; label: string; step: 1 | 2 | 3; show: boolean; required: boolean; locked?: boolean }

export interface Settings {
  sessionTimeout: number;
  adminMfa: boolean;
  lastBackup: string;
  fields: FieldSetting[];
}

export interface DB {
  version: number;
  seededAt: string;
  clients: Client[];
  households: Household[];
  events: DistEvent[];
  visits: Visit[];
  pantry: PantryAppt[];
  appts: ProgramAppt[];
  referrals: Referral[];
  users: User[];
  programs: Program[];
  categories: FoodCategory[];
  log: LogEntry[];
  settings: Settings;
  counters: { client: number; household: number; misc: number };
}
