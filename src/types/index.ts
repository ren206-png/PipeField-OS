// ============================================================
// PipeField OS — Core Type Definitions
// All business domain types live here.
// ============================================================

// ------------------------------------------------------------
// ROLES
// ------------------------------------------------------------
export type UserRole =
  | 'platform_admin'
  | 'organization_owner'
  | 'administrator'
  | 'project_manager'
  | 'foreman'
  | 'qa_inspector'
  | 'shop_fabricator'
  | 'pipefitter'
  | 'client_viewer'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  platform_admin:     'Platform Admin',
  organization_owner: 'Organization Owner',
  administrator:      'Administrator',
  project_manager:    'Project Manager',
  foreman:            'Foreman',
  qa_inspector:       'QA/QC Inspector',
  shop_fabricator:    'Shop Fabricator',
  pipefitter:         'Pipefitter',
  client_viewer:      'Client Viewer',
}

/** Roles that can manage users within their organization */
export const ORG_ADMIN_ROLES: UserRole[] = [
  'platform_admin', 'organization_owner', 'administrator',
]

// ------------------------------------------------------------
// PERMISSIONS
// Each permission is a string like "welds:create"
// ------------------------------------------------------------
export type Permission =
  | 'organization:manage'
  | 'users:manage'
  | 'projects:create'
  | 'projects:read'
  | 'projects:update'
  | 'projects:delete'
  | 'welds:create'
  | 'welds:read'
  | 'welds:update'
  | 'welds:delete'
  | 'welds:approve'
  | 'spools:create'
  | 'spools:read'
  | 'spools:update'
  | 'spools:delete'
  | 'reports:generate'
  | 'reports:read'
  | 'calculator:use'
  | 'audit:read'
  | 'settings:manage'
  | 'knowledge:query'
  | 'knowledge:upload'
  | 'knowledge:manage'

// ------------------------------------------------------------
// ORGANIZATION
// An organization is one company — e.g. "ABC Mechanical"
// ------------------------------------------------------------
export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  subscription_tier: SubscriptionTier
  subscription_status: SubscriptionStatus
  seat_limit: number | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_current_period_end: string | null
  trial_ends_at: string | null
  plan_price_id: string | null
  grace_period_ends_at: string | null
  created_at: string
  updated_at: string
}

export type SubscriptionTier = 'free_trial' | 'field_pro' | 'starter' | 'professional' | 'enterprise'
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'paused'

// ------------------------------------------------------------
// USER PROFILE
// The user's identity and role within an organization
// ------------------------------------------------------------
export interface UserProfile {
  id:              string
  auth_user_id:    string
  organization_id: string
  email:           string
  full_name:       string
  role:            UserRole
  avatar_url:      string | null
  phone:           string | null
  welder_stamp:    string | null  // e.g. "RK-42"
  is_active:       boolean
  status:          'active' | 'invited' | 'suspended' | 'deactivated'
  last_login_at:   string | null
  created_at:      string
  updated_at:      string
}

// ------------------------------------------------------------
// ORGANIZATION MEMBER
// Tracks explicit membership (supports future multi-org)
// ------------------------------------------------------------
export interface OrgMember {
  id:              string
  organization_id: string
  user_id:         string
  role:            UserRole
  invited_by:      string | null
  status:          'active' | 'invited' | 'suspended' | 'deactivated'
  created_at:      string
  updated_at:      string
}

// ------------------------------------------------------------
// PENDING INVITE
// One row per email invitation sent by an org admin
// ------------------------------------------------------------
export interface PendingInvite {
  id:              string
  email:           string
  organization_id: string
  role:            UserRole
  invited_by:      string
  token:           string
  status:          'pending' | 'accepted' | 'expired' | 'cancelled'
  created_at:      string
  expires_at:      string
}

// ------------------------------------------------------------
// PROJECT
// ------------------------------------------------------------
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'complete' | 'archived'

export interface Project {
  id: string
  organization_id: string
  name: string
  project_number: string
  client_name: string | null
  location: string | null
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ------------------------------------------------------------
// SPOOL
// A spool is a pre-fabricated pipe assembly
// ------------------------------------------------------------
export type SpoolStatus =
  | 'designed'
  | 'material_released'
  | 'cut'
  | 'fit_up'
  | 'welded'
  | 'nde'
  | 'painted'
  | 'released'

export const SPOOL_STATUS_LABELS: Record<SpoolStatus, string> = {
  designed:          'Designed',
  material_released: 'Material Released',
  cut:               'Cut',
  fit_up:            'Fit-Up',
  welded:            'Welded',
  nde:               'NDE',
  painted:           'Painted',
  released:          'Released',
}

export const SPOOL_STATUS_COLORS: Record<SpoolStatus, string> = {
  designed:          'bg-surface-700 text-surface-300',
  material_released: 'bg-info/20 text-blue-300',
  cut:               'bg-orange-900/40 text-orange-300',
  fit_up:            'bg-brand-900 text-brand-300',
  welded:            'bg-yellow-900/40 text-yellow-300',
  nde:               'bg-purple-900/40 text-purple-300',
  painted:           'bg-pink-900/40 text-pink-300',
  released:          'bg-success/30 text-green-200',
}

export interface Spool {
  id:               string
  organization_id:  string
  project_id:       string
  spool_number:     string
  revision:         string | null
  status:           SpoolStatus
  pipe_size:        string | null
  pipe_schedule:    string | null
  material:         string | null
  service:          string | null
  design_pressure:  number | null
  design_temp:      number | null
  total_welds:      number
  total_length_in:  number | null
  isometric_ref:    string | null
  area:             string | null
  priority:         number
  notes:            string | null
  required_date:    string | null
  released_date:    string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

/** Spool with Supabase joined relations — returned by useSpool() */
export interface SpoolWithRelations extends Spool {
  projects:    { name: string } | null
  spool_items: SpoolItem[]
  line_number?: string | null
}

export interface SpoolItem {
  id:              string
  spool_id:        string
  organization_id: string
  item_number:     number
  item_type:       'pipe' | 'elbow' | 'tee' | 'flange' | 'reducer' | 'cap' | 'other'
  description:     string
  quantity:        number
  length_in:       number | null
  heat_number:     string | null
  is_cut:          boolean
  is_fitted:       boolean
  notes:           string | null
  created_at:      string
}

// ------------------------------------------------------------
// WELD
// Each individual weld joint in a project
// ------------------------------------------------------------
export type WeldStatus =
  | 'draft'
  | 'fit_up_approved'
  | 'welded'
  | 'visual_pass'
  | 'xray_pending'
  | 'failed'
  | 'repaired'
  | 'accepted'

export const WELD_STATUS_LABELS: Record<WeldStatus, string> = {
  draft:            'Draft',
  fit_up_approved:  'Fit-Up Approved',
  welded:           'Welded',
  visual_pass:      'Visual Pass',
  xray_pending:     'X-Ray Pending',
  failed:           'Failed',
  repaired:         'Repaired',
  accepted:         'Accepted',
}

export const WELD_STATUS_COLORS: Record<WeldStatus, string> = {
  draft:            'bg-surface-700 text-surface-300',
  fit_up_approved:  'bg-info/20 text-blue-300',
  welded:           'bg-brand-900 text-brand-300',
  visual_pass:      'bg-success/20 text-green-300',
  xray_pending:     'bg-warning/20 text-yellow-300',
  failed:           'bg-danger/20 text-red-300',
  repaired:         'bg-purple-900/40 text-purple-300',
  accepted:         'bg-success/30 text-green-200',
}

export interface Weld {
  id: string
  organization_id: string
  project_id: string
  spool_id: string | null
  weld_id_number: string        // Human-readable ID e.g. "W-001"
  welder_stamp: string | null   // e.g. "RK-42"
  welder_name: string | null
  status: WeldStatus
  weld_date: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  // ── Columns added via ALTER TABLE (fix-welds-schema.sql, fix-all-columns.sql) ──
  spool_number:   string | null
  line_number:    string | null
  pipe_size:      string | null
  wall_thickness: string | null
  weld_process:   string | null
  material:       string | null
  joint_type:     string | null
  // ── Added via migrations/20260702_wps.sql ──
  wps_id:         string | null
}

// ------------------------------------------------------------
// AUDIT LOG
// Every change to every record is stored here
// ------------------------------------------------------------
export interface AuditLog {
  id: string
  organization_id: string
  table_name: string
  record_id: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  previous_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  performed_by: string
  performed_at: string
}

// ------------------------------------------------------------
// NOTIFICATIONS (architecture — full implementation later)
// ------------------------------------------------------------
export type NotificationType =
  | 'weld_status_change'
  | 'failed_inspection'
  | 'spool_movement'
  | 'project_alert'

export interface Notification {
  id: string
  organization_id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  is_read: boolean
  resource_type: string | null
  resource_id: string | null
  created_at: string
}

// ------------------------------------------------------------
// WELDER
// Certified welders tracked by stamp number
// ------------------------------------------------------------
export interface Welder {
  id:               string
  organization_id:  string
  full_name:        string
  stamp:            string
  email:            string | null
  phone:            string | null
  process:          string[] | null
  position:         string[] | null
  certification_no: string | null
  cert_expiry:      string | null
  is_active:        boolean
  notes:            string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

export const WELD_PROCESSES = ['SMAW', 'GTAW', 'GMAW', 'FCAW', 'SAW', 'GTAW-P', 'OFW'] as const
export const WELD_POSITIONS = ['1G', '2G', '3G', '4G', '5G', '6G', '1F', '2F', '3F', '4F'] as const

// ------------------------------------------------------------
// NDE INSPECTION
// Non-destructive examination results per weld
// ------------------------------------------------------------
export type NdeType   = 'RT' | 'UT' | 'PT' | 'MT' | 'VT' | 'PMI' | 'HT'
export type NdeResult = 'pending' | 'pass' | 'fail' | 'repair' | 'retest'

export const NDE_TYPE_LABELS: Record<NdeType, string> = {
  RT:  'Radiographic (RT)',
  UT:  'Ultrasonic (UT)',
  PT:  'Liquid Penetrant (PT)',
  MT:  'Magnetic Particle (MT)',
  VT:  'Visual (VT)',
  PMI: 'Positive Material ID (PMI)',
  HT:  'Hardness Test (HT)',
}

export const NDE_RESULT_COLORS: Record<NdeResult, string> = {
  pending: 'bg-surface-700 text-surface-300',
  pass:    'bg-success/20 text-green-300',
  fail:    'bg-danger/20 text-red-300',
  repair:  'bg-orange-900/40 text-orange-300',
  retest:  'bg-yellow-900/40 text-yellow-300',
}

export interface NdeInspection {
  id:               string
  organization_id:  string
  weld_id:          string
  project_id:       string
  inspection_type:  NdeType
  result:           NdeResult
  inspector_name:   string | null
  inspection_date:  string | null
  report_number:    string | null
  film_location:    string | null
  acceptance_code:  string | null
  defect_type:      string | null
  defect_location:  string | null
  repair_weld_id:   string | null
  notes:            string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
}

// ------------------------------------------------------------
// UTILITY TYPES
// ------------------------------------------------------------
export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApiError {
  message: string
  code: string
  details?: unknown
}

// ── Punch List ────────────────────────────────────────────────
export type PunchStatus     = 'open' | 'in_progress' | 'ready_for_inspection' | 'closed' | 'voided'
export type PunchCategory   = 'A' | 'B' | 'C'
export type PunchDiscipline = 'piping' | 'mechanical' | 'electrical' | 'instrumentation' | 'civil' | 'structural' | 'insulation' | 'painting' | 'other'

export const PUNCH_STATUS_LABELS: Record<PunchStatus, string> = {
  open:                 'Open',
  in_progress:          'In Progress',
  ready_for_inspection: 'Ready for Inspection',
  closed:               'Closed',
  voided:               'Voided',
}

export const PUNCH_STATUS_COLORS: Record<PunchStatus, string> = {
  open:                 'bg-red-500/20 text-red-300',
  in_progress:          'bg-blue-500/20 text-blue-300',
  ready_for_inspection: 'bg-yellow-500/20 text-yellow-300',
  closed:               'bg-green-500/20 text-green-300',
  voided:               'bg-surface-700 text-surface-500 line-through',
}

export const PUNCH_CATEGORY_COLORS: Record<PunchCategory, string> = {
  A: 'bg-red-500/20 text-red-300 border border-red-500/40',
  B: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40',
  C: 'bg-surface-700 text-surface-400 border border-surface-600',
}

export const PUNCH_CATEGORY_LABELS: Record<PunchCategory, string> = {
  A: 'Cat A — Safety / Must Fix',
  B: 'Cat B — Functional',
  C: 'Cat C — Cosmetic',
}

export const PUNCH_DISCIPLINE_LABELS: Record<PunchDiscipline, string> = {
  piping:          'Piping',
  mechanical:      'Mechanical',
  electrical:      'Electrical',
  instrumentation: 'Instrumentation',
  civil:           'Civil',
  structural:      'Structural',
  insulation:      'Insulation',
  painting:        'Painting',
  other:           'Other',
}

export interface PunchItem {
  id:               string
  organization_id:  string
  project_id:       string
  item_number:      string
  discipline:       PunchDiscipline
  category:         PunchCategory
  description:      string
  location:         string | null
  drawing_ref:      string | null
  raised_by:        string | null
  assigned_to:      string | null
  due_date:         string | null
  status:           PunchStatus
  resolution_notes: string | null
  closed_by:        string | null
  closed_at:        string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
  project?:         { name: string; project_number: string }
}

// ── RFI ───────────────────────────────────────────────────────
export type RfiStatus   = 'draft' | 'submitted' | 'under_review' | 'answered' | 'closed' | 'void'
export type RfiPriority = 'low' | 'normal' | 'high' | 'urgent'

export const RFI_STATUS_LABELS: Record<RfiStatus, string> = {
  draft:        'Draft',
  submitted:    'Submitted',
  under_review: 'Under Review',
  answered:     'Answered',
  closed:       'Closed',
  void:         'Void',
}

export const RFI_STATUS_COLORS: Record<RfiStatus, string> = {
  draft:        'bg-surface-700 text-surface-400',
  submitted:    'bg-blue-500/20 text-blue-300',
  under_review: 'bg-yellow-500/20 text-yellow-300',
  answered:     'bg-green-500/20 text-green-300',
  closed:       'bg-surface-600 text-surface-400',
  void:         'bg-surface-700 text-surface-500 line-through',
}

export const RFI_PRIORITY_COLORS: Record<RfiPriority, string> = {
  low:    'bg-surface-700 text-surface-400',
  normal: 'bg-blue-500/15 text-blue-400',
  high:   'bg-orange-500/20 text-orange-300',
  urgent: 'bg-red-500/20 text-red-300',
}

export interface Rfi {
  id:               string
  organization_id:  string
  project_id:       string
  rfi_number:       string
  title:            string
  discipline:       string
  priority:         RfiPriority
  question:         string
  background:       string | null
  drawing_refs:     string | null
  spec_refs:        string | null
  submitted_to:     string | null
  submitted_date:   string | null
  required_by_date: string | null
  answer:           string | null
  answered_by:      string | null
  answered_date:    string | null
  impact:           string | null
  status:           RfiStatus
  created_by:       string | null
  created_at:       string
  updated_at:       string
  project?:         { name: string; project_number: string }
}

// ── Daily Field Reports ───────────────────────────────────────
export type DfrStatus   = 'draft' | 'submitted' | 'approved'
export type DfrWeather  = 'clear' | 'cloudy' | 'rain' | 'snow' | 'wind' | 'extreme_heat' | 'fog'

export const DFR_STATUS_LABELS: Record<DfrStatus, string> = {
  draft:     'Draft',
  submitted: 'Submitted',
  approved:  'Approved',
}

export const DFR_STATUS_COLORS: Record<DfrStatus, string> = {
  draft:     'bg-surface-700 text-surface-300',
  submitted: 'bg-blue-500/20 text-blue-300',
  approved:  'bg-green-500/20 text-green-300',
}

export const DFR_WEATHER_LABELS: Record<DfrWeather, string> = {
  clear:        '☀️ Clear',
  cloudy:       '☁️ Cloudy',
  rain:         '🌧️ Rain',
  snow:         '❄️ Snow',
  wind:         '💨 Windy',
  extreme_heat: '🌡️ Extreme Heat',
  fog:          '🌫️ Fog',
}

export interface DailyFieldReport {
  id:              string
  organization_id: string
  project_id:      string
  report_date:     string
  report_number:   string
  supervisor_name: string | null
  crew_size:       number
  weather:         DfrWeather | null
  temperature:     string | null
  work_areas:      string | null
  work_completed:  string
  equipment_used:  string | null
  materials_used:  string | null
  issues_delays:   string | null
  safety_incidents:string | null
  visitors:        string | null
  welds_completed: number
  spools_completed:number
  status:          DfrStatus
  created_by:      string | null
  approved_by:     string | null
  approved_at:     string | null
  created_at:      string
  updated_at:      string
  // joined
  project?:        { name: string; project_number: string }
}

// ── Pressure Tests ────────────────────────────────────────────
export type PressureTestResult = 'pending' | 'pass' | 'fail' | 'conditional_pass'
export type PressureTestStatus = 'draft' | 'submitted' | 'approved' | 'void'
export type PressureTestType   = 'hydrostatic' | 'pneumatic' | 'leak' | 'service'

export const PT_RESULT_LABELS: Record<PressureTestResult, string> = {
  pending:          'Pending',
  pass:             'Pass',
  fail:             'Fail',
  conditional_pass: 'Conditional Pass',
}

export const PT_RESULT_COLORS: Record<PressureTestResult, string> = {
  pending:          'bg-surface-700 text-surface-400',
  pass:             'bg-green-500/20 text-green-300',
  fail:             'bg-red-500/20 text-red-300',
  conditional_pass: 'bg-yellow-500/20 text-yellow-300',
}

export const PT_STATUS_LABELS: Record<PressureTestStatus, string> = {
  draft:     'Draft',
  submitted: 'Submitted',
  approved:  'Approved',
  void:      'Void',
}

export const PT_STATUS_COLORS: Record<PressureTestStatus, string> = {
  draft:     'bg-surface-700 text-surface-400',
  submitted: 'bg-blue-500/20 text-blue-300',
  approved:  'bg-green-500/20 text-green-300',
  void:      'bg-surface-700 text-surface-500',
}

export const PT_TYPE_LABELS: Record<PressureTestType, string> = {
  hydrostatic: 'Hydrostatic',
  pneumatic:   'Pneumatic',
  leak:        'Leak Test',
  service:     'Service Test',
}

export interface PressureTest {
  id:                 string
  organization_id:    string
  project_id:         string
  test_number:        string
  system_name:        string
  line_numbers:       string | null
  test_type:          PressureTestType
  test_medium:        string
  design_pressure:    number | null
  test_pressure:      number
  pressure_unit:      string
  hold_duration_min:  number
  test_date:          string
  test_start_time:    string | null
  test_end_time:      string | null
  initial_pressure:   number | null
  final_pressure:     number | null
  ambient_temp:       string | null
  result:             PressureTestResult
  failure_reason:     string | null
  inspector_name:     string
  witness_name:       string | null
  witness_company:    string | null
  reinspection_date:  string | null
  notes:              string | null
  status:             PressureTestStatus
  created_by:         string | null
  approved_by:        string | null
  approved_at:        string | null
  created_at:         string
  updated_at:         string
  project?:           { name: string; project_number: string }
}

// ── NCR ───────────────────────────────────────────────────────
export type NcrStatus     = 'open' | 'under_review' | 'disposition_pending' | 'in_rework' | 'verification_pending' | 'closed' | 'void'
export type NcrSeverity   = 'minor' | 'major' | 'critical'
export type NcrDisposition = 'use_as_is' | 'repair' | 'rework' | 'reject' | 'return_to_vendor'

export const NCR_STATUS_LABELS: Record<NcrStatus, string> = {
  open:                 'Open',
  under_review:         'Under Review',
  disposition_pending:  'Disposition Pending',
  in_rework:            'In Rework',
  verification_pending: 'Verification Pending',
  closed:               'Closed',
  void:                 'Void',
}

export const NCR_STATUS_COLORS: Record<NcrStatus, string> = {
  open:                 'bg-red-500/20 text-red-300',
  under_review:         'bg-blue-500/20 text-blue-300',
  disposition_pending:  'bg-orange-500/20 text-orange-300',
  in_rework:            'bg-yellow-500/20 text-yellow-300',
  verification_pending: 'bg-purple-500/20 text-purple-300',
  closed:               'bg-green-500/20 text-green-300',
  void:                 'bg-surface-700 text-surface-500',
}

export const NCR_SEVERITY_COLORS: Record<NcrSeverity, string> = {
  minor:    'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  major:    'bg-orange-500/15 text-orange-300 border border-orange-500/30',
  critical: 'bg-red-500/20 text-red-300 border border-red-500/40',
}

export const NCR_DISPOSITION_LABELS: Record<NcrDisposition, string> = {
  use_as_is:        'Use As-Is (Engineering Concession)',
  repair:           'Repair',
  rework:           'Rework / Redo',
  reject:           'Reject / Scrap',
  return_to_vendor: 'Return to Vendor',
}

export interface Ncr {
  id:                string
  organization_id:   string
  project_id:        string
  ncr_number:        string
  title:             string
  discipline:        string
  severity:          NcrSeverity
  ncr_type:          string
  description:       string
  location:          string | null
  drawing_ref:       string | null
  spec_ref:          string | null
  weld_id:           string | null
  root_cause:        string | null
  disposition:       NcrDisposition | null
  disposition_notes: string | null
  corrective_action: string | null
  preventive_action: string | null
  raised_by:         string
  raised_date:       string
  assigned_to:       string | null
  due_date:          string | null
  closed_by:         string | null
  closed_at:         string | null
  verified_by:       string | null
  verified_date:     string | null
  status:            NcrStatus
  created_by:        string | null
  created_at:        string
  updated_at:        string
  project?:          { name: string; project_number: string }
}

// ── MTR ───────────────────────────────────────────────────────
export type MtrStatus = 'received' | 'accepted' | 'rejected' | 'quarantine' | 'consumed'
export type MtrMaterialType = 'pipe' | 'fitting' | 'flange' | 'valve' | 'bolt' | 'gasket' | 'plate' | 'bar' | 'other'

export const MTR_STATUS_LABELS: Record<MtrStatus, string> = {
  received:   'Received',
  accepted:   'Accepted',
  rejected:   'Rejected',
  quarantine: 'Quarantine',
  consumed:   'Consumed',
}

export const MTR_STATUS_COLORS: Record<MtrStatus, string> = {
  received:   'bg-blue-500/20 text-blue-300',
  accepted:   'bg-green-500/20 text-green-300',
  rejected:   'bg-red-500/20 text-red-300',
  quarantine: 'bg-orange-500/20 text-orange-300',
  consumed:   'bg-surface-700 text-surface-400',
}

export const MTR_TYPE_LABELS: Record<MtrMaterialType, string> = {
  pipe:    'Pipe',
  fitting: 'Fitting',
  flange:  'Flange',
  valve:   'Valve',
  bolt:    'Bolt/Stud',
  gasket:  'Gasket',
  plate:   'Plate',
  bar:     'Bar/Rod',
  other:   'Other',
}

export interface Mtr {
  id:               string
  organization_id:  string
  project_id:       string
  heat_number:      string
  mtr_number:       string | null
  material_spec:    string
  material_type:    MtrMaterialType
  nominal_size:     string | null
  schedule:         string | null
  quantity:         number | null
  unit:             string | null
  supplier:         string | null
  manufacturer:     string | null
  received_date:    string | null
  po_number:        string | null
  carbon_pct:       number | null
  manganese_pct:    number | null
  phosphorus_pct:   number | null
  sulfur_pct:       number | null
  silicon_pct:      number | null
  yield_strength:   number | null
  tensile_strength: number | null
  elongation_pct:   number | null
  hardness:         number | null
  strength_unit:    string | null
  status:           MtrStatus
  rejection_reason: string | null
  storage_location: string | null
  notes:            string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
  project?:         { name: string; project_number: string }
}

// ── Line List ─────────────────────────────────────────────────
export type LineStatus   = 'not_started' | 'in_fabrication' | 'fab_complete' | 'installed' | 'tested' | 'complete'
export type LinePriority = 'low' | 'normal' | 'high' | 'critical'

export const LINE_STATUS_LABELS: Record<LineStatus, string> = {
  not_started:    'Not Started',
  in_fabrication: 'In Fabrication',
  fab_complete:   'Fab Complete',
  installed:      'Installed',
  tested:         'Tested',
  complete:       'Complete',
}

export const LINE_STATUS_COLORS: Record<LineStatus, string> = {
  not_started:    'bg-surface-700 text-surface-400',
  in_fabrication: 'bg-blue-500/20 text-blue-300',
  fab_complete:   'bg-yellow-500/20 text-yellow-300',
  installed:      'bg-purple-500/20 text-purple-300',
  tested:         'bg-orange-500/20 text-orange-300',
  complete:       'bg-green-500/20 text-green-300',
}

export const LINE_PRIORITY_COLORS: Record<LinePriority, string> = {
  low:      'bg-surface-700 text-surface-400',
  normal:   'bg-blue-500/15 text-blue-400',
  high:     'bg-orange-500/20 text-orange-300',
  critical: 'bg-red-500/20 text-red-300',
}

export interface PipeLine {
  id:              string
  organization_id: string
  project_id:      string
  line_number:     string
  service:         string | null
  fluid_code:      string | null
  pipe_class:      string | null
  nominal_size:    string | null
  design_pressure: number | null
  design_temp:     number | null
  test_pressure:   number | null
  insulation:      string | null
  from_equipment:  string | null
  to_equipment:    string | null
  total_welds:     number
  total_spools:    number
  status:          LineStatus
  priority:        LinePriority
  target_date:     string | null
  notes:           string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
  project?:        { name: string; project_number: string }
}

// ── Flange Joints ─────────────────────────────────────────────
export type FlangeStatus = 'pending' | 'assembled' | 'torqued' | 'inspected' | 'leak_tested' | 'accepted' | 'rejected'

export const FLANGE_STATUS_LABELS: Record<FlangeStatus, string> = {
  pending:     'Pending',
  assembled:   'Assembled',
  torqued:     'Torqued',
  inspected:   'Inspected',
  leak_tested: 'Leak Tested',
  accepted:    'Accepted',
  rejected:    'Rejected',
}

export const FLANGE_STATUS_COLORS: Record<FlangeStatus, string> = {
  pending:     'bg-surface-700 text-surface-400',
  assembled:   'bg-blue-500/20 text-blue-300',
  torqued:     'bg-yellow-500/20 text-yellow-300',
  inspected:   'bg-purple-500/20 text-purple-300',
  leak_tested: 'bg-orange-500/20 text-orange-300',
  accepted:    'bg-green-500/20 text-green-300',
  rejected:    'bg-red-500/20 text-red-300',
}

export interface FlangeJoint {
  id:               string
  organization_id:  string
  project_id:       string
  joint_number:     string
  line_number:      string | null
  spool_id:         string | null
  flange_type:      string
  flange_rating:    string | null
  nominal_size:     string | null
  gasket_type:      string | null
  gasket_material:  string | null
  bolt_spec:        string | null
  bolt_size:        string | null
  bolt_count:       number | null
  nut_spec:         string | null
  target_torque_nm: number | null
  torque_unit:      string
  torque_passes:    number
  assembled_by:     string | null
  assembly_date:    string | null
  torque_wrench_id: string | null
  torque_cert_date: string | null
  final_torque_nm:  number | null
  status:           FlangeStatus
  inspector_name:   string | null
  inspection_date:  string | null
  rejection_reason: string | null
  notes:            string | null
  created_by:       string | null
  created_at:       string
  updated_at:       string
  project?:         { name: string; project_number: string }
}


// ── Documents ─────────────────────────────────────────────────
export type DocStatus = 'draft' | 'issued_for_review' | 'issued_for_construction' | 'approved' | 'superseded' | 'void'
export type DocType   = 'drawing' | 'specification' | 'procedure' | 'certificate' | 'report' | 'datasheet' | 'itp' | 'correspondence' | 'submittal' | 'method_statement' | 'risk_assessment' | 'other'

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  draft:                    'Draft',
  issued_for_review:        'Issued for Review',
  issued_for_construction:  'Issued for Construction',
  approved:                 'Approved',
  superseded:               'Superseded',
  void:                     'Void',
}

export const DOC_STATUS_COLORS: Record<DocStatus, string> = {
  draft:                    'bg-surface-700 text-surface-400',
  issued_for_review:        'bg-yellow-500/20 text-yellow-300',
  issued_for_construction:  'bg-blue-500/20 text-blue-300',
  approved:                 'bg-green-500/20 text-green-300',
  superseded:               'bg-surface-600 text-surface-500',
  void:                     'bg-surface-700 text-surface-500 line-through',
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  drawing:          'Drawing',
  specification:    'Specification',
  procedure:        'Procedure',
  certificate:      'Certificate',
  report:           'Report',
  datasheet:        'Datasheet',
  itp:              'ITP',
  correspondence:   'Correspondence',
  submittal:        'Submittal',
  method_statement: 'Method Statement',
  risk_assessment:  'Risk Assessment',
  other:            'Other',
}

export const DOC_TYPE_ICONS: Record<DocType, string> = {
  drawing:          '📐',
  specification:    '📋',
  procedure:        '📝',
  certificate:      '🏆',
  report:           '📊',
  datasheet:        '📄',
  itp:              '✅',
  correspondence:   '✉️',
  submittal:        '📬',
  method_statement: '📌',
  risk_assessment:  '⚠️',
  other:            '📎',
}

export interface Document {
  id:              string
  organization_id: string
  project_id:      string | null
  title:           string
  document_number: string | null
  document_type:   DocType
  revision:        string | null
  status:          DocStatus
  discipline:      string | null
  storage_path:    string
  file_name:       string
  file_size:       number | null
  mime_type:       string | null
  description:     string | null
  tags:            string | null
  linked_weld_id:  string | null
  linked_spool_id: string | null
  linked_ncr_id:   string | null
  linked_rfi_id:   string | null
  uploaded_by:     string | null
  created_at:      string
  updated_at:      string
  project?:        { name: string; project_number: string }
}

// ── ITP ───────────────────────────────────────────────────────
export type ItpStatus      = 'draft' | 'issued' | 'approved' | 'superseded'
export type ItpItemStatus  = 'pending' | 'in_progress' | 'complete' | 'not_applicable'
export type ItpLevel       = 'hold' | 'witness' | 'review' | 'monitor' | 'perform' | 'n_a'

export const ITP_STATUS_LABELS: Record<ItpStatus, string> = {
  draft:      'Draft',
  issued:     'Issued',
  approved:   'Approved',
  superseded: 'Superseded',
}

export const ITP_STATUS_COLORS: Record<ItpStatus, string> = {
  draft:      'bg-surface-700 text-surface-400',
  issued:     'bg-blue-500/20 text-blue-300',
  approved:   'bg-green-500/20 text-green-300',
  superseded: 'bg-surface-600 text-surface-500',
}

export const ITP_ITEM_STATUS_COLORS: Record<ItpItemStatus, string> = {
  pending:        'bg-surface-700 text-surface-400',
  in_progress:    'bg-blue-500/20 text-blue-300',
  complete:       'bg-green-500/20 text-green-300',
  not_applicable: 'bg-surface-700 text-surface-500',
}

export const ITP_LEVEL_LABELS: Record<ItpLevel, string> = {
  hold:    'H — Hold Point',
  witness: 'W — Witness',
  review:  'R — Review',
  monitor: 'M — Monitor',
  perform: 'P — Perform',
  n_a:     'N/A',
}

export const ITP_LEVEL_SHORT: Record<ItpLevel, string> = {
  hold: 'H', witness: 'W', review: 'R', monitor: 'M', perform: 'P', n_a: '-',
}

export const ITP_LEVEL_COLORS: Record<ItpLevel, string> = {
  hold:    'bg-red-500/20 text-red-300 font-bold',
  witness: 'bg-orange-500/20 text-orange-300',
  review:  'bg-blue-500/20 text-blue-300',
  monitor: 'bg-purple-500/20 text-purple-300',
  perform: 'bg-green-500/20 text-green-300',
  n_a:     'bg-surface-700 text-surface-500',
}

export interface Itp {
  id:              string
  organization_id: string
  project_id:      string
  itp_number:      string
  title:           string
  revision:        string | null
  discipline:      string
  status:          ItpStatus
  approved_by:     string | null
  approved_date:   string | null
  description:     string | null
  created_by:      string | null
  created_at:      string
  updated_at:      string
  completed_at?:   string | null
  project?:        { name: string; project_number: string }
  itp_items?:      ItpItem[]
}

export interface ItpItem {
  id:                  string
  organization_id:     string
  itp_id:              string
  project_id:          string
  item_number:         string
  activity:            string
  description:         string | null
  reference_doc:       string | null
  acceptance_criteria: string | null
  contractor_level:    ItpLevel
  inspector_level:     ItpLevel
  client_level:        ItpLevel
  frequency:           string | null
  record_required:     string
  record_type:         string | null
  status:              ItpItemStatus
  completed_date:      string | null
  completed_by:        string | null
  remarks:             string | null
  sort_order:          number
  created_at:          string
  updated_at:          string
}
