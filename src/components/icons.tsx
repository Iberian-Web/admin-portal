// admin-portal/src/components/icons.tsx
// Iconos de lucide-react. Se mantiene el mismo envoltorio <Icon name=.../>
// de siempre para no tener que tocar cada sitio donde ya se usaba.
import {
  Plus,
  X,
  Check,
  ChevronDown,
  ArrowLeft,
  Search,
  Pencil,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  Clipboard,
  Users,
  LayoutGrid,
  RefreshCw,
  Loader2,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  plus: Plus,
  close: X,
  check: Check,
  chevronDown: ChevronDown,
  arrowLeft: ArrowLeft,
  search: Search,
  pencil: Pencil,
  trash: Trash2,
  warningCircle: AlertCircle,
  warningTriangle: AlertTriangle,
  infoCircle: Info,
  clipboard: Clipboard,
  users: Users,
  grid: LayoutGrid,
  refresh: RefreshCw,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  className = "w-4 h-4",
  strokeWidth = 2,
}: {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}) {
  const LucideIcon = ICONS[name];
  return <LucideIcon className={className} strokeWidth={strokeWidth} />;
}

export function Spinner({ className = "w-4 h-4" }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} />;
}
