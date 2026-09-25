import type { Answers, Stage } from "./constants";

export interface Hotel {
  id: string;
  org_id: string;
  name: string;
  brand: string | null;
  management_company: string | null;
  ownership_type: "independent" | "franchise" | "corporate" | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  maps_url: string | null;
  rooms: number | null;
  airport: boolean;
  shuttle: boolean;
  shuttle_24h: boolean;
  long_term_parking: boolean;
  short_term_parking: boolean;
  restaurant: boolean;
  meeting_space: boolean;
  front_desk_24h: boolean;
  pms: string | null;
  ops_software: string | null;
  notes: string | null;
  tags: string[];
  stage: Stage;
  pipeline_status: string | null;
  not_fit_reason: string | null;
  stage1_completed_at: string | null;
  inquiry_call_count: number;
  opportunity_score: number | null;
  score_override: number | null;
  classification_override: string | null;
  score_breakdown: { label: string; points: number }[];
  corporate_controlled: boolean;
  mgmt_no_pain: boolean;
  biggest_pain: string | null;
  stage1_summary: string | null;
  manual_housekeeping: boolean | null;
  manual_houseman: boolean | null;
  manual_maintenance: boolean | null;
  manual_shuttle: boolean | null;
  manual_parking: boolean | null;
  manual_wakeup: boolean | null;
  next_action: string | null;
  next_action_date: string | null;
  last_contacted_at: string | null;
  lead_owner: string | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  hotel_id: string;
  name: string;
  title: string | null;
  linkedin_url: string | null;
  email: string | null;
  phone: string | null;
  decision_maker: "yes" | "no" | "unknown";
  influence: "low" | "medium" | "high" | null;
  preferred_contact: string | null;
  notes: string | null;
  created_at: string;
}

export interface InquiryCall {
  id: string;
  hotel_id: string;
  called_at: string;
  spoke_with: string | null;
  spoke_role: string | null;
  answered: boolean;
  answers: Answers;
  outside_pms: string | null;
  most_manual: string | null;
  notes: string | null;
  score: number | null;
  created_at: string;
}

export interface PainPoint {
  id: string;
  hotel_id: string;
  department: string;
  description: string;
  current_workflow: string | null;
  existing_system: string | null;
  severity: "Low" | "Medium" | "High" | null;
  frequency: "Rare" | "Weekly" | "Daily" | "Multiple times daily" | null;
  impact: string | null;
  product_feature: string | null;
  confirmed_by_mgmt: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  hotel_id: string;
  contact_id: string | null;
  kind: string;
  summary: string;
  outcome: string | null;
  occurred_at: string;
}

export interface Deal {
  id: string;
  hotel_id: string;
  plan: string;
  setup_fee: number;
  monthly: number;
  contract_months: number;
  free_months: number;
  discount: number;
  tcv: number;
  mrr: number;
  arr: number;
  proposal_date: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

export interface Demo {
  id: string;
  hotel_id: string;
  contact_id: string | null;
  scheduled_at: string;
  status: "booked" | "completed" | "cancelled" | "no_show";
  notes: string | null;
}

export interface Pricing {
  [plan: string]: { label: string; setup_fee: number; monthly: number; contract_months: number; free_months: number };
}
