import { Calendar, DollarSign, Flag, Network, Mail, NotebookPen, Phone, PhoneCall, UserPlus } from "lucide-react";

const ICONS = {
  inquiry_call: Phone,
  mgmt_call: PhoneCall,
  email: Mail,
  linkedin: Network,
  note: NotebookPen,
  stage_change: Flag,
  status: Flag,
  contact_added: UserPlus,
  demo: Calendar,
  deal: DollarSign,
} as const;

export function ActivityIcon({ kind }: { kind: string }) {
  const Icon = ICONS[kind as keyof typeof ICONS] ?? NotebookPen;
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 ring-4 ring-white">
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
