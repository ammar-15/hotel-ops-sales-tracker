// Domain vocabulary for the tracker. Everything that drives forms, filters and analytics lives here.

export const STAGES = {
  prospect: { label: "Not called", tone: "gray" },
  stage1_review: { label: "Stage 1 · review", tone: "blue" },
  research_more: { label: "Research more", tone: "amber" },
  call_again: { label: "Call again", tone: "amber" },
  not_fit: { label: "Not a fit", tone: "red" },
  stage2: { label: "Stage 2", tone: "green" },
} as const;
export type Stage = keyof typeof STAGES;

export const PIPELINE_STATUSES = [
  "Management contact identified",
  "Outreach not started",
  "Called",
  "Email sent",
  "LinkedIn sent",
  "Connected",
  "Conversation started",
  "Discovery call booked",
  "Discovery complete",
  "Demo booked",
  "Demo completed",
  "Pilot discussed",
  "Proposal requested",
  "Proposal sent",
  "Negotiating",
  "Contract sent",
  "Won",
  "Lost",
  "Follow up later",
] as const;

/** Grouping used for the pipeline board and the funnel metrics. */
export const PIPELINE_GROUPS: { label: string; statuses: string[] }[] = [
  { label: "Outreach", statuses: ["Management contact identified", "Outreach not started", "Called", "Email sent", "LinkedIn sent"] },
  { label: "Conversation", statuses: ["Connected", "Conversation started", "Discovery call booked", "Discovery complete"] },
  { label: "Demo", statuses: ["Demo booked", "Demo completed", "Pilot discussed"] },
  { label: "Proposal", statuses: ["Proposal requested", "Proposal sent", "Negotiating", "Contract sent"] },
  { label: "Closed / later", statuses: ["Won", "Lost", "Follow up later"] },
];

export const STATUS_ORDER = Object.fromEntries(PIPELINE_STATUSES.map((s, i) => [s, i])) as Record<string, number>;
export const reachedStatus = (current: string | null | undefined, target: string) =>
  !!current && current !== "Lost" && current !== "Follow up later" && STATUS_ORDER[current] >= STATUS_ORDER[target];

export const HOTEL_TAGS = ["Airport", "Shuttle", "Parking", "100+ Rooms", "Full Service", "Independent", "Franchise", "High Priority"];

export const DEPARTMENTS = [
  "Front Desk",
  "Housekeeping",
  "Houseman",
  "Maintenance",
  "Shuttle",
  "Parking",
  "Management",
  "Guest Services",
  "Other",
];

export const CONTACT_TITLES = [
  "Owner",
  "General Manager",
  "AGM",
  "Operations Manager",
  "Director of Rooms",
  "Front Office Manager",
  "Executive Housekeeper",
  "Chief Engineer",
  "Director of Engineering",
];

export const ACTIVITY_KINDS: Record<string, { label: string; icon: string }> = {
  inquiry_call: { label: "Stage 1 inquiry call", icon: "phone" },
  mgmt_call: { label: "Management call", icon: "phone-call" },
  email: { label: "Email sent", icon: "mail" },
  linkedin: { label: "LinkedIn", icon: "linkedin" },
  note: { label: "Note", icon: "note" },
  stage_change: { label: "Stage change", icon: "flag" },
  contact_added: { label: "Contact added", icon: "user" },
  demo: { label: "Demo", icon: "calendar" },
  deal: { label: "Deal", icon: "dollar" },
  status: { label: "Pipeline status", icon: "flag" },
};

// ───────────── Stage 1 inquiry form definition ─────────────

export const HK_METHODS = ["PMS automatically", "Operations platform", "Phone", "Radio", "Paper", "Spreadsheet", "Verbal", "Unknown", "Other"];
export const HM_METHODS = ["Operations software", "PMS", "Phone", "Radio", "Messaging app", "Paper", "Verbal", "Other", "Unknown"];
export const MT_METHODS = ["PMS", "Quore", "HotSOS", "hotelkit", "Other operations platform", "Paper log", "Excel", "Radio", "Phone", "Verbal", "Unknown"];
export const SH_METHODS = ["Phone", "Radio", "Paper", "Spreadsheet", "PMS", "Shuttle software", "Other", "Unknown"];
export const PK_METHODS = ["PMS", "Parking software", "Spreadsheet", "Paper", "Verbal", "Other", "Unknown"];
export const WK_METHODS = ["Phone system", "PMS", "Paper log", "Spreadsheet", "Other", "Unknown"];

export const MANUAL = {
  hk: ["Phone", "Radio", "Paper", "Spreadsheet", "Verbal"],
  hm: ["Phone", "Radio", "Messaging app", "Paper", "Verbal"],
  mt: ["Paper log", "Excel", "Radio", "Phone", "Verbal"],
  sh: ["Phone", "Radio", "Paper", "Spreadsheet"],
  pk: ["Spreadsheet", "Paper", "Verbal"],
  wk: ["Paper log", "Spreadsheet"],
};
export const OPS_PLATFORMS = ["Quore", "HotSOS", "hotelkit", "Other operations platform"];

export type QType = "yn" | "choice" | "multi";
export interface Question {
  key: string;
  label: string;
  type: QType;
  options?: string[];
}
export interface Section {
  id: string;
  title: string;
  notesKey: string;
  onlyIf?: "shuttle";
  questions: Question[];
}

export const INQUIRY_SECTIONS: Section[] = [
  {
    id: "hk",
    title: "Housekeeping / room readiness",
    notesKey: "hk_notes",
    questions: [
      { key: "hk_early_checkin", label: "How are early check-ins handled?", type: "choice", options: ["Guest waits / checks back", "FD calls housekeeping", "Room prioritized on request", "PMS shows ready rooms", "Other"] },
      { key: "hk_fd_sees_ready", label: "Front desk sees immediately when a room is done?", type: "yn" },
      { key: "hk_digital_status", label: "Housekeeping updates room status digitally?", type: "yn" },
      { key: "hk_fd_calls", label: "Front desk has to call/radio housekeeping?", type: "yn" },
      { key: "hk_guest_notified", label: "Guest notified when room is ready?", type: "yn" },
      { key: "hk_system", label: "What system handles this?", type: "choice", options: HK_METHODS },
    ],
  },
  {
    id: "hm",
    title: "Houseman / guest requests",
    notesKey: "hm_notes",
    questions: [
      { key: "hm_guest_request", label: "How does a guest request towels/pillows/crib?", type: "choice", options: ["Calls front desk", "Calls housekeeping", "App / text", "In person", "Other"] },
      { key: "hm_trackable", label: "Front desk creates a trackable request?", type: "yn" },
      { key: "hm_method", label: "How is it passed to the houseman?", type: "choice", options: HM_METHODS },
      { key: "hm_ack_visible", label: "FD sees when it's acknowledged?", type: "yn" },
      { key: "hm_completion_visible", label: "FD sees when it's completed?", type: "yn" },
      { key: "hm_history", label: "Is there a request history?", type: "yn" },
    ],
  },
  {
    id: "mt",
    title: "Maintenance",
    notesKey: "mt_notes",
    questions: [
      { key: "mt_reported", label: "How are issues reported?", type: "choice", options: ["FD calls engineering", "Radio", "Paper log", "Ops software", "PMS", "Other"] },
      { key: "mt_method", label: "Where are requests recorded?", type: "choice", options: MT_METHODS },
      { key: "mt_ack", label: "Engineering can acknowledge requests?", type: "yn" },
      { key: "mt_fd_status", label: "Front desk can see status?", type: "yn" },
      { key: "mt_completion", label: "Completion is recorded?", type: "yn" },
      { key: "mt_room_history", label: "History stays attached to the room?", type: "yn" },
      { key: "mt_recurring_visible", label: "Recurring room problems visible?", type: "yn" },
    ],
  },
  {
    id: "sh",
    title: "Shuttle operations",
    notesKey: "sh_notes",
    onlyIf: "shuttle",
    questions: [
      { key: "sh_type", label: "Scheduled or on-demand?", type: "choice", options: ["Scheduled", "On-demand", "Both"] },
      { key: "sh_24h", label: "24-hour shuttle?", type: "yn" },
      { key: "sh_guest_calls", label: "Guest calls front desk after landing?", type: "yn" },
      { key: "sh_info", label: "Info collected", type: "multi", options: ["Name", "Phone", "Terminal", "Pickup post", "# guests", "Luggage", "Flight", "Other"] },
      { key: "sh_record", label: "Where is the pickup request recorded?", type: "choice", options: SH_METHODS },
      { key: "sh_driver_notify", label: "How is the driver notified?", type: "choice", options: SH_METHODS },
      { key: "sh_driver_ack", label: "Driver can acknowledge pickup?", type: "yn" },
      { key: "sh_fd_driver_status", label: "FD can see driver status?", type: "yn" },
      { key: "sh_guest_track", label: "Guest can track pickup?", type: "yn" },
      { key: "sh_sms", label: "Guest gets SMS updates?", type: "yn" },
      { key: "sh_pickup_confirmed", label: "Staff see whether guest was picked up?", type: "yn" },
      { key: "sh_history", label: "Pickup history retained?", type: "yn" },
      { key: "sh_departures_fd", label: "Departure shuttles booked through FD?", type: "yn" },
    ],
  },
  {
    id: "pk",
    title: "Parking",
    notesKey: "pk_notes",
    questions: [
      { key: "pk_long_term", label: "Long-term airport parking?", type: "yn" },
      { key: "pk_short_term", label: "Short-term hotel parking?", type: "yn" },
      { key: "pk_park_fly", label: "Park-and-fly packages?", type: "yn" },
      { key: "pk_record", label: "Where are vehicle details recorded?", type: "choice", options: PK_METHODS },
      { key: "pk_plate", label: "Licence plate recorded?", type: "yn" },
      { key: "pk_linked", label: "Parking linked to reservation?", type: "yn" },
      { key: "pk_digital_list", label: "Digital list of vehicles?", type: "yn" },
      { key: "pk_overdue_known", label: "How do they know a vehicle should have left?", type: "choice", options: ["System alert", "Manual check", "Don't really know", "Unknown"] },
      { key: "pk_overstays", label: "How are overstays handled?", type: "choice", options: ["Charged automatically", "Manual follow-up", "Not tracked", "Unknown"] },
    ],
  },
  {
    id: "wk",
    title: "Wake-up calls",
    notesKey: "wk_notes",
    questions: [
      { key: "wk_offered", label: "Wake-up calls offered?", type: "yn" },
      { key: "wk_mode", label: "Manual or automated?", type: "choice", options: ["Automated", "Manual", "Unknown"] },
      { key: "wk_record", label: "Where are requests recorded?", type: "choice", options: WK_METHODS },
      { key: "wk_pending_visible", label: "Staff can see pending wake-ups?", type: "yn" },
      { key: "wk_completion", label: "Completion / failure recorded?", type: "yn" },
      { key: "wk_shift_clear", label: "Responsibility clear across shift changes?", type: "yn" },
    ],
  },
  {
    id: "gen",
    title: "Overall",
    notesKey: "gen_notes",
    questions: [
      { key: "gen_multi_systems", label: "Multiple separate systems / logs in use?", type: "yn" },
      { key: "gen_shift_visibility", label: "Staff can see outstanding requests across shifts?", type: "yn" },
      { key: "gen_ops_platform_most", label: "An ops platform already handles most workflows?", type: "yn" },
      { key: "gen_pms_most", label: "PMS handles almost everything effectively?", type: "yn" },
    ],
  },
];

export type Answers = Record<string, string | string[] | undefined>;
