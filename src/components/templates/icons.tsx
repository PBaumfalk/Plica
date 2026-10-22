import { Briefcase, CalendarDays, Clock, ListChecks, Mail, PenLine, Scale, Star, Upload, UserRound } from "lucide-react";
import type { TemplateIcon } from "@/lib/templates";

export const TEMPLATE_ICONS: Record<TemplateIcon, typeof Mail> = {
  mail: Mail,
  briefcase: Briefcase,
  scale: Scale,
  user: UserRound,
  calendar: CalendarDays,
  star: Star,
  upload: Upload,
  list: ListChecks,
  clock: Clock,
  pen: PenLine,
};
