
export type UserRole = 'ADMIN' | 'CONTROL_MANAGER' | 'PROCTOR' | 'CONTROL' | 'ASSISTANT_CONTROL' | 'COUNSELOR';

export type TenantStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan?: string;
  logo_url?: string;
  created_at?: string;
}

export interface User {
  id: string;
  tenant_id?: string;
  tenant_name?: string;
  tenant_slug?: string;
  national_id: string;
  full_name: string;
  role: UserRole;
  phone: string;
  assigned_committees?: string[]; 
  assigned_grades?: string[];      
}

export interface ExamSchedule {
  id: string;
  tenant_id?: string;
  exam_date: string;
  day_name?: string;
  subject: string;
  period: number;
  start_time: string;
  end_time?: string;
  grades?: string[];
  committees?: string[];
  notes?: string;
  status?: 'DRAFT' | 'READY' | 'PUBLISHED' | string;
  created_at?: string;
  updated_at?: string;
}

export interface ProctorExclusion {
  id: string;
  tenant_id?: string;
  teacher_id: string;
  exam_date: string;
  period: number;
  subject: string;
  reason?: string;
  created_at?: string;
}

export interface Student {
  id: string;
  tenant_id?: string;
  national_id: string;
  name: string;
  grade: string;
  section: string;
  parent_phone: string;
  committee_number: string;
  seating_number?: string;
  location?: string;
}

export interface Supervision {
  id: string;
  tenant_id?: string;
  teacher_id: string;
  committee_number: string;
  date: string;
  period: number;
  subject: string;
}

export interface Absence {
  id: string;
  tenant_id?: string;
  date: string;
  student_id: string;
  student_name: string;
  committee_number: string;
  period: number;
  type: 'ABSENT' | 'LATE';
  proctor_id: string;
  note?: string; 
}

export interface ControlRequest {
  id: string;
  tenant_id?: string;
  from: string;
  committee: string;
  text: string;
  time: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';
  assistant_name?: string;
}

export interface DeliveryLog {
  id: string;
  tenant_id?: string;
  teacher_name: string;
  proctor_name?: string; 
  committee_number: string;
  grade: string; 
  type: 'ISSUE' | 'RECEIVE';
  time: string;
  period: number;
  status?: 'CONFIRMED' | 'PENDING';
}

export interface CommitteeReport {
  id: string;
  tenant_id?: string;
  committee_number: string;
  proctor_id: string;
  proctor_name: string;
  date: string;
  observations: string;
  issues: string;
  resolutions: string;
}

export interface SystemConfig {
  id: string;
  tenant_id?: string;
  exam_start_time: string; 
  exam_date: string;
  active_exam_date?: string;
  academic_year?: string;
  allow_manual_join?: boolean;
  openrouter_api_key?: string;
}

export interface EnvelopeOpening {
  id: string;
  tenant_id?: string;
  date: string;
  time: string;
  subject: string;
  grade: string;
  status: 'INTACT' | 'DAMAGED';
  opened_by: string;
}

export interface ArchiveBox {
  id: string;
  tenant_id?: string;
  box_number: string;
  grade: string;
  subject: string;
  exam_date: string;
  committees: string[];
  created_at?: string;
}
