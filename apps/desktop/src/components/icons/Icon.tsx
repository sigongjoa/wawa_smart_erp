/**
 * Icon — lucide-react 래퍼 (tree-shakeable registry 패턴).
 *
 * 사용 원칙 (CLAUDE.md · design/system/DESKTOP.md):
 *   - 이모지를 아이콘으로 사용 금지 (OS·브라우저별 렌더 차이)
 *   - 모든 UI 아이콘은 본 컴포넌트 경유
 *   - 색은 부모의 `color` 토큰 상속 (직접 지정 금지)
 *   - 의미 없는 장식: aria-hidden (기본값)
 *   - 의미 있는 아이콘: aria-label 명시 → aria-hidden 자동 해제
 *
 * 신규 아이콘 추가:
 *   1. https://lucide.dev/icons 에서 이름 확인
 *   2. 본 파일의 import + ICONS registry 에 추가
 *   3. `<Icon name="..." />` 사용
 *
 * 마이그레이션 가이드 (emoji → lucide):
 *   ./emoji-map.ts 참조
 *
 * 예시:
 *   <Icon name="ArrowLeft" />                       // 장식
 *   <Icon name="AlertTriangle" aria-label="경고" /> // 의미
 *   <Icon name="Check" size={20} />                 // 크기 조정 (기본 16)
 */
import { createElement, type ComponentType } from 'react';
import {
  // ── 화살표 / 방향 ──
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  // ── 상태 마커 ──
  Check,
  CheckCircle2,
  X,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Circle,
  Star,
  // ── 액션 ──
  Pencil,
  PencilLine,
  Trash2,
  Plus,
  PlusCircle,
  Eye,
  EyeOff,
  Search,
  Filter,
  Download,
  Upload,
  Send,
  Share2,
  Copy,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ExternalLink,
  Link as LinkIcon,
  Paperclip,
  // ── 도메인 (학원 운영) ──
  Calendar,
  CalendarCheck,
  CalendarX,
  CalendarClock,
  Clock,
  Timer,
  Play,
  Pause,
  Square,
  Flag,
  CheckSquare,
  Users,
  User,
  UserCheck,
  UserPlus,
  UserRoundSearch,
  School,
  Mail,
  Phone,
  MessageSquare,
  MessageSquareText,
  MessageCircle,
  FileText,
  FilePlus2,
  FileCodeIcon,
  ClipboardList,
  ClipboardCheck,
  BookOpen,
  BookOpenCheck,
  BookMarked,
  PenLine,
  FunctionSquare,
  Layers,
  LayoutDashboard,
  Activity,
  BarChart2,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Settings,
  Settings2,
  Building2,
  Sparkles,
  Loader,
  KeyRound,
  Lock,
  Briefcase,
  QrCode,
  LogIn,
  Bell,
  Megaphone,
  Palette,
  Grid2x2,
  Dices,
  ListOrdered,
  History,
  FolderOpen,
  Folder,
  Globe,
  MoreHorizontal,
  ZoomIn,
  Expand,
  Wand2,
  Undo,
  GitBranch,
  CheckCheck,
  Printer,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

/**
 * 사용 가능한 아이콘 registry — 추가 시 위 import + 본 객체에 등록.
 * tree-shaking 위해 명시 import 만 허용 (NOT `import *`).
 */
const ICONS: Record<string, ComponentType<LucideProps>> = {
  // Direction
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown,
  ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown,
  // Status
  Check, CheckCircle2, X, XCircle, AlertTriangle, AlertCircle, Info, Circle, Star,
  // Actions
  Pencil, PencilLine, Trash2, Plus, PlusCircle, Eye, EyeOff,
  Search, Filter, Download, Upload, Send, Share2, Copy,
  RefreshCw, RotateCcw, RotateCw, ExternalLink, Link: LinkIcon, Paperclip,
  // Domain
  Calendar, CalendarCheck, CalendarX, CalendarClock,
  Clock, Timer, Play, Pause, Square, Flag, CheckSquare,
  Users, User, UserCheck, UserPlus, UserRoundSearch,
  School, Mail, Phone,
  MessageSquare, MessageSquareText, MessageCircle,
  FileText, FilePlus2, FileCode: FileCodeIcon,
  ClipboardList, ClipboardCheck,
  BookOpen, BookOpenCheck, BookMarked, PenLine, FunctionSquare,
  Layers, LayoutDashboard, Activity,
  BarChart2, BarChart3, TrendingUp, TrendingDown,
  Settings, Settings2, Building2, Sparkles, Loader,
  KeyRound, Lock, Briefcase, QrCode, LogIn, Bell, Megaphone,
  Palette, Grid2x2, Dices, ListOrdered, History,
  FolderOpen, Folder, Globe, MoreHorizontal, ZoomIn, Expand, Wand2,
  Undo, GitBranch, CheckCheck, Printer,
};

export type IconName = keyof typeof ICONS;

export interface IconProps extends Omit<LucideProps, 'ref'> {
  /** lucide icon name. registry 에 등록된 것만 사용. */
  name: IconName | string;
  /** 의미 있는 아이콘일 때 — 지정 시 aria-hidden 자동 해제 */
  'aria-label'?: string;
}

export function Icon({
  name,
  size = 16,
  strokeWidth = 2,
  className,
  'aria-label': ariaLabel,
  ...rest
}: IconProps) {
  const Component = ICONS[name];

  if (!Component) {
    if (typeof console !== 'undefined') {
      console.warn(
        `[Icon] "${name}" 가 registry 에 없습니다. ` +
        `apps/desktop/src/components/icons/Icon.tsx 의 import 와 ICONS 객체에 추가하세요. ` +
        `https://lucide.dev/icons`,
      );
    }
    return null;
  }

  const a11y = ariaLabel
    ? { role: 'img' as const, 'aria-label': ariaLabel }
    : { 'aria-hidden': true as const };

  return createElement(Component, {
    size,
    strokeWidth,
    className,
    ...a11y,
    ...rest,
  });
}

export default Icon;
