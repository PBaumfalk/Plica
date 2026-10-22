import {
  AlignLeft, AtSign, Calculator, Calendar, CalendarClock, CalendarRange, CircleDot, Clock, Euro, EyeOff, Grid3x3, Hash, Heading, Image, ListChecks, MapPin,
  Minus, Paperclip, Phone, Pilcrow, Repeat2, ShieldCheck, Signature, SlidersHorizontal, SquareChevronDown, Star, Tags, ToggleLeft, Type, UserRound, type LucideIcon,
} from "lucide-react";
import type { FieldType } from "@/lib/forms/schema";

export const FIELD_ICONS: Record<FieldType, LucideIcon> = {
  short_text: Type,
  long_text: AlignLeft,
  email: AtSign,
  phone: Phone,
  number: Hash,
  currency: Euro,
  date: Calendar,
  time: Clock,
  datetime: CalendarClock,
  date_range: CalendarRange,
  dropdown: SquareChevronDown,
  single_choice: CircleDot,
  multi_select: Tags,
  checkboxes: ListChecks,
  yes_no: ToggleLeft,
  name: UserRound,
  address: MapPin,
  file: Paperclip,
  signature: Signature,
  rating: Star,
  slider: SlidersHorizontal,
  matrix: Grid3x3,
  group: Repeat2,
  calculated: Calculator,
  hidden: EyeOff,
  consent: ShieldCheck,
  heading: Heading,
  paragraph: Pilcrow,
  divider: Minus,
  image: Image,
};

export function FieldIcon({ type, className }: { type: FieldType; className?: string }) {
  const I = FIELD_ICONS[type];
  return <I className={className} aria-hidden />;
}
