'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Database, 
  Settings,
  BarChart3,
  Users,
  ShieldCheck,
  Key,
  Zap,
  BookOpen,
  Server,
  Network,
  Search,
  AlertTriangle,
  Tags,
  Download,
  Activity,
  Shield,
  CreditCard,
  User,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  FileUp,
  FlaskConical,
  Folder,
  ChevronDown,
  BrainCircuit,
  FileCog,
  Sparkles,
  FileText,
  Layers,
  Target,
  Cpu,
  Clock,
  TrendingUp,
  Globe,
  Workflow,
  Bell,
  LogOut,
  UserCheck,
  Briefcase,
  PieChart,
  FileSearch,
  Boxes,
  Puzzle,
  Calendar,
  MessageSquare,
  HelpCircle,
  Archive,
  Trash2,
  Star,
  Filter,
  RefreshCw,
  ExternalLink,
  Palette,
  Moon,
  Sun,
  Monitor,
  Maximize2,
  Minimize2,
  UserCircle,
  Eye,
  CheckCircle2,
  AlertCircle,
  Badge,
  Beaker,
  LineChart,
  Building,
  Gauge,
  Command,
  Zap as ZapIcon,
  Cog,
  HeadphonesIcon,
  Home,
  Plus,
  Minus,
  Play,
  Pause,
  Square,
  Triangle,
  Circle,
  Hexagon,
  Octagon,
  Pentagon,
  UserCog,
  Crown,
  GraduationCap,
  Briefcase as BriefcaseIcon,
  Bot,
  Lightbulb,
  Rocket,
  Compass,
  Map,
  Route,
  Navigation,
  Layers3,
  Grid3x3,
  BarChart4,
  GitBranch,
  GitMerge,
  GitPullRequest,
  GitCommit,
  Code,
  Terminal,
  Package,
  Folder as FolderIcon,
  File,
  FileCode,
  FileImage,
  FileVideo,
  FileMusic,
  FileSpreadsheet,
  FileBarChart,
  Cloud,
  CloudUpload,
  CloudDownload,
  CloudSync,
  HardDrive,
  Smartphone,
  Tablet,
  Laptop,
  Desktop,
  Watch,
  Camera,
  Mic,
  Speaker,
  Headphones,
  Gamepad2,
  Keyboard,
  Mouse,
  Printer,
  Scanner,
  Fax,
  Phone,
  PhoneCall,
  PhoneMissed,
  PhoneOff,
  Mail,
  MailOpen,
  Send,
  Reply,
  ReplyAll,
  Forward,
  MessageCircle,
  MessageCircleIcon,
  MessageSquareIcon,
  Info,
  AlertTriangleIcon,
  CheckCircle,
  XCircle,
  HelpCircleIcon,
  QuestionMarkCircle,
  ExclamationTriangleIcon,
  ShieldAlert,
  ShieldX,
  ShieldCheck as ShieldCheckIcon,
  Lock,
  Unlock,
  LockKeyhole,
  Hash,
  At,
  Percent,
  Dollar,
  Euro,
  Pound,
  Yen,
  Bitcoin,
  Banknote,
  Wallet,
  CreditCardIcon,
  Coins,
  TrendingDown,
  TrendingUpIcon,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  ArrowUpLeft,
  ArrowBigUp,
  ArrowBigDown,
  ArrowBigLeft,
  ArrowBigRight,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsUp,
  ChevronsDown,
  ChevronsLeft,
  ChevronsRight,
  CornerDownLeft,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  CornerLeftDown,
  CornerLeftUp,
  CornerRightDown,
  CornerRightUp,
  Move,
  Move3d,
  MoveHorizontal,
  MoveVertical,
  MoveDiagonal,
  MoveDiagonal2,
  Expand,
  Shrink,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  Focus,
  Unfocus,
  Crosshair,
  Crosshair2,
  Scan,
  ScanLine,
  Radar,
  Sonar,
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  BluetoothOff,
  Cast,
  CastConnected,
  Airplay,
  Radio,
  RadioReceiver,
  Rss,
  Signal,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
  Antenna,
  Satellite,
  SatelliteDish,
  Router,
  Modem,
  Ethernet,
  Usb,
  UsbC,
  UsbCable,
  Cable,
  Plug,
  Power,
  PowerOff,
  Zap as ZapIcon2,
  Battery,
  BatteryCharging,
  BatteryFull,
  BatteryHalf,
  BatteryLow,
  BatteryWarning,
  Fuel,
  Gauge as GaugeIcon,
  Speedometer,
  Timer,
  TimerIcon,
  Stopwatch,
  AlarmClock,
  ClockIcon,
  Clock1,
  Clock2,
  Clock3,
  Clock4,
  Clock5,
  Clock6,
  Clock7,
  Clock8,
  Clock9,
  Clock10,
  Clock11,
  Clock12,
  CalendarIcon,
  CalendarDays,
  CalendarCheck,
  CalendarX,
  CalendarPlus,
  CalendarMinus,
  CalendarHeart,
  CalendarClock,
  CalendarRange,
  CalendarSearch,
  CalendarArrowUp,
  CalendarArrowDown,
  CalendarFold,
  CalendarUnfold,
  CalendarX2,
  CalendarCheck2,
  CalendarCog,
  CalendarSync,
  CalendarIcon as CalendarIconIcon,
  SunIcon,
  MoonIcon,
  SunDim,
  SunMedium,
  SunSnow,
  Sunrise,
  Sunset,
  Eclipse,
  Stars,
  Star as StarIcon,
  Sparkle,
  Sparkles as SparklesIcon,
  Flashlight,
  FlashlightOff,
  Lamp,
  LampCeiling,
  LampDesk,
  LampFloor,
  LampWallDown,
  LampWallUp,
  Lightbulb as LightbulbIcon,
  LightbulbOff,
  Candle,
  Flame,
  Zap as ZapIcon3,
  Bolt,
  BoltIcon,
  ThunderstormIcon,
  Cloud as CloudIcon,
  CloudDrizzle,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  CloudMoon,
  CloudMoonRain,
  Cloudy,
  PartlyCloudyDay,
  PartlyCloudyNight,
  Rainbow,
  Umbrella,
  UmbrellaBeach,
  Waves,
  Wind,
  Tornado,
  Snowflake,
  Thermometer,
  ThermometerSun,
  ThermometerSnowflake,
  Droplets,
  Droplet,
  Humidity,
  Eye as EyeIcon,
  EyeOff,
  Glasses,
  Monocle,
  Telescope,
  Microscope,
  Binoculars,
  Camera as CameraIcon,
  CameraOff,
  Video,
  VideoOff,
  VideoIcon,
  Film,
  FilmStrip,
  Play as PlayIcon,
  Pause as PauseIcon,
  Square as SquareIcon,
  StopCircle,
  PlayCircle,
  PauseCircle,
  SquarePlay,
  SquarePause,
  SquareStop,
  TriangleRight,
  TriangleLeft,
  TriangleUp,
  TriangleDown,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Repeat,
  RepeatOne,
  Shuffle,
  Volume,
  VolumeOff,
  Volume1,
  Volume2,
  VolumeX,
  VolumeDown,
  VolumeUp,
  Mic as MicIcon,
  MicOff,
  Headphones as HeadphonesIcon,
  Speaker as SpeakerIcon,
  Radio as RadioIcon,
  Music,
  Music2,
  Music3,
  Music4,
  Album,
  Disc,
  Disc2,
  Disc3,
  Vinyl,
  Cassette,
  Cd,
  Headset,
  Airpods,
  AirpodsCase,
  AirpodsCharging,
  AirpodsConnected,
  AirpodsDisconnected,
  AirpodsLeft,
  AirpodsRight,
  AirpodsOff,
  AirpodsOn,
  AirpodsCharging2,
  AirpodsLow,
  AirpodsHigh,
  AirpodsPlaying,
  AirpodsSearching,
  AirpodsIcon,
  Waveform,
  AudioWaveform,
  AudioLines,
  SoundWave,
  Equalizer,
  Sliders,
  SlidersHorizontal,
  SlidersVertical,
  Settings as SettingsIcon,
  SettingsIcon as SettingsIconIcon,
  Cog as CogIcon,
  CogIcon as CogIconIcon,
  Gear,
  GearIcon,
  Tool,
  ToolIcon,
  Wrench,
  WrenchIcon,
  Screwdriver,
  ScrewdriverIcon,
  Hammer,
  HammerIcon,
  Pickaxe,
  PickaxeIcon,
  Drill,
  DrillIcon,
  Saw,
  SawIcon,
  Ruler,
  RulerIcon,
  Compass as CompassIcon,
  CompassIcon as CompassIconIcon,
  Protractor,
  ProtractorIcon,
  Dividers,
  DividersIcon,
  Scissors,
  ScissorsIcon,
  Stapler,
  StaplerIcon,
  Paperclip,
  PaperclipIcon,
  Pin,
  PinIcon,
  Pushpin,
  PushpinIcon,
  Thumbtack,
  ThumbtackIcon,
  Magnet,
  MagnetIcon,
  Anchor,
  AnchorIcon,
  Link,
  LinkIcon,
  Unlink,
  UnlinkIcon,
  Chain,
  ChainIcon,
  Rope,
  RopeIcon,
  Knot,
  KnotIcon,
  Bow,
  BowIcon,
  Gift,
  GiftIcon,
  Package as PackageIcon,
  PackageIcon as PackageIconIcon,
  PackageOpen,
  PackageOpenIcon,
  PackageSearch,
  PackageSearchIcon,
  PackageCheck,
  PackageCheckIcon,
  PackageX,
  PackageXIcon,
  PackagePlus,
  PackagePlusIcon,
  PackageMinus,
  PackageMinusIcon,
  Package2,
  Package2Icon,
  PackageIcon2,
  Box,
  BoxIcon,
  BoxSelect,
  BoxSelectIcon,
  Container,
  ContainerIcon,
  Archive as ArchiveIcon,
  ArchiveIcon as ArchiveIconIcon,
  ArchiveRestore,
  ArchiveRestoreIcon,
  ArchiveX,
  ArchiveXIcon,
  FolderArchive,
  FolderArchiveIcon,
  FolderOpen,
  FolderOpenIcon,
  FolderPlus,
  FolderPlusIcon,
  FolderMinus,
  FolderMinusIcon,
  FolderX,
  FolderXIcon,
  FolderCheck,
  FolderCheckIcon,
  FolderClock,
  FolderClockIcon,
  FolderEdit,
  FolderEditIcon,
  FolderKey,
  FolderKeyIcon,
  FolderLock,
  FolderLockIcon,
  FolderRoot,
  FolderRootIcon,
  FolderSync,
  FolderSyncIcon,
  FolderTree,
  FolderTreeIcon,
  FolderUp,
  FolderUpIcon,
  FolderDown,
  FolderDownIcon,
  FolderInput,
  FolderInputIcon,
  FolderOutput,
  FolderOutputIcon,
  FolderCog,
  FolderCogIcon,
  FolderGit,
  FolderGitIcon,
  FolderGit2,
  FolderGit2Icon,
  FolderSearch,
  FolderSearchIcon,
  FolderSearch2,
  FolderSearch2Icon,
  FolderHeart,
  FolderHeartIcon,
  FolderSymlink,
  FolderSymlinkIcon,
  FolderKanban,
  FolderKanbanIcon,
  File as FileIcon,
  FileIcon as FileIconIcon,
  FilePlus,
  FilePlusIcon,
  FileMinus,
  FileMinusIcon,
  FileX,
  FileXIcon,
  FileCheck,
  FileCheckIcon,
  FileSearch as FileSearchIcon,
  FileSearchIcon as FileSearchIconIcon,
  FileSearch2,
  FileSearch2Icon,
  FileEdit,
  FileEditIcon,
  FileType,
  FileTypeIcon,
  FileType2,
  FileType2Icon,
  FileInput,
  FileInputIcon,
  FileOutput,
  FileOutputIcon,
  FileDown,
  FileDownIcon,
  FileUp,
  FileUpIcon,
  FileDigit,
  FileDigitIcon,
  FileKey,
  FileKeyIcon,
  FileKey2,
  FileKey2Icon,
  FileLock,
  FileLockIcon,
  FileLock2,
  FileLock2Icon,
  FileQuestion,
  FileQuestionIcon,
  FileWarning,
  FileWarningIcon,
  FileX2,
  FileX2Icon,
  FileSliders,
  FileSlidersIcon,
  FileCog,
  FileCogIcon,
  FileCog2,
  FileCog2Icon,
  FileCode as FileCodeIcon,
  FileCodeIcon as FileCodeIconIcon,
  FileCode2,
  FileCode2Icon,
  FileJson,
  FileJsonIcon,
  FileJson2,
  FileJson2Icon,
  FileBox,
  FileBoxIcon,
  FileArchive,
  FileArchiveIcon,
  FileImage as FileImageIcon,
  FileImageIcon as FileImageIconIcon,
  FileVideo as FileVideoIcon,
  FileVideoIcon as FileVideoIconIcon,
  FileVideo2,
  FileVideo2Icon,
  FileAudio,
  FileAudioIcon,
  FileAudio2,
  FileAudio2Icon,
  FileMusic as FileMusicIcon,
  FileMusicIcon as FileMusicIconIcon,
  FileMusic2,
  FileMusic2Icon,
  FileSpreadsheet as FileSpreadsheetIcon,
  FileSpreadsheetIcon as FileSpreadsheetIconIcon,
  FileBarChart as FileBarChartIcon,
  FileBarChartIcon as FileBarChartIconIcon,
  FileBarChart2,
  FileBarChart2Icon,
  FileBarChart3,
  FileBarChart3Icon,
  FileBarChart4,
  FileBarChart4Icon,
  FileLineChart,
  FileLineChartIcon,
  FilePieChart,
  FilePieChartIcon,
  FileText as FileTextIcon,
  FileTextIcon as FileTextIconIcon,
  FileDoc,
  FileDocIcon,
  FilePdf,
  FilePdfIcon,
  FileSymlink,
  FileSymlinkIcon,
  FileHeart,
  FileHeartIcon,
  FileStack,
  FileStackIcon,
  FileTerminal,
  FileTerminalIcon,
  FileVolume,
  FileVolumeIcon,
  FileVolume2,
  FileVolume2Icon,
  FileVolumeX,
  FileVolumeXIcon,
  FileSignature,
  FileSignatureIcon,
  FileChartColumn,
  FileChartColumnIcon,
  FileChartColumnIncreasing,
  FileChartColumnIncreasingIcon,
  FileChartLine,
  FileChartLineIcon,
  FileChartPie,
  FileChartPieIcon,
  FileUser,
  FileUserIcon,
  FileUsers,
  FileUsersIcon,
  FileWarning2,
  FileWarning2Icon,
  FileSpreadsheet2,
  FileSpreadsheet2Icon,
  FileSpreadsheet3,
  FileSpreadsheet3Icon,
  FileSpreadsheet4,
  FileSpreadsheet4Icon,
  FileSpreadsheet5,
  FileSpreadsheet5Icon,
  FileSpreadsheet6,
  FileSpreadsheet6Icon,
  FileSpreadsheet7,
  FileSpreadsheet7Icon,
  FileSpreadsheet8,
  FileSpreadsheet8Icon,
  FileSpreadsheet9,
  FileSpreadsheet9Icon,
  FileSpreadsheet10,
  FileSpreadsheet10Icon,
  FileSpreadsheet11,
  FileSpreadsheet11Icon,
  FileSpreadsheet12,
  FileSpreadsheet12Icon,
  FileSpreadsheet13,
  FileSpreadsheet13Icon,
  FileSpreadsheet14,
  FileSpreadsheet14Icon,
  FileSpreadsheet15,
  FileSpreadsheet15Icon,
  FileSpreadsheet16,
  FileSpreadsheet16Icon,
  FileSpreadsheet17,
  FileSpreadsheet17Icon,
  FileSpreadsheet18,
  FileSpreadsheet18Icon,
  FileSpreadsheet19,
  FileSpreadsheet19Icon,
  FileSpreadsheet20,
  FileSpreadsheet20Icon,
  FileSpreadsheet21,
  FileSpreadsheet21Icon,
  FileSpreadsheet22,
  FileSpreadsheet22Icon,
  FileSpreadsheet23,
  FileSpreadsheet23Icon,
  FileSpreadsheet24,
  FileSpreadsheet24Icon,
  FileSpreadsheet25,
  FileSpreadsheet25Icon,
  FileSpreadsheet26,
  FileSpreadsheet26Icon,
  FileSpreadsheet27,
  FileSpreadsheet27Icon,
  FileSpreadsheet28,
  FileSpreadsheet28Icon,
  FileSpreadsheet29,
  FileSpreadsheet29Icon,
  FileSpreadsheet30,
  FileSpreadsheet30Icon
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

// Role-based navigation structure
const roleBasedNavigation = {
  admin: {
    core: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
      { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban, shortcut: '⌘2', badge: 'New' },
      { name: 'Data Sources', href: '/dashboard/data-sources', icon: Database, shortcut: '⌘3' },
      { name: 'Pipelines', href: '/dashboard/pipelines', icon: Workflow, shortcut: '⌘4' },
      { name: 'Analysis', href: '/dashboard/data-analysis', icon: BarChart3, shortcut: '⌘5' },
      { name: 'System Monitor', href: '/dashboard/monitoring', icon: Activity, shortcut: '⌘6' },
    ],
    management: [
      { name: 'User Management', href: '/dashboard/users', icon: Users, count: 0 },
      { name: 'Security', href: '/dashboard/security', icon: Shield, count: 0 },
      { name: 'Audit Logs', href: '/dashboard/audit', icon: FileSearch, count: 0 },
      { name: 'System Health', href: '/dashboard/system-health', icon: Gauge, count: 0 },
    ],
    ai: [
      { name: 'AI Models', href: '/dashboard/models', icon: BrainCircuit, count: 0 },
      { name: 'Auto-labeling', href: '/dashboard/labeling', icon: Tags, count: 0 },
      { name: 'ML Preparation', href: '/dashboard/ml-preparation', icon: Beaker, count: 0 },
      { name: 'Model Registry', href: '/dashboard/model-registry', icon: Archive, count: 0 },
    ]
  },
  user: {
    core: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
      { name: 'My Projects', href: '/dashboard/my-projects', icon: FolderKanban, shortcut: '⌘2' },
      { name: 'Data Sources', href: '/dashboard/data-sources', icon: Database, shortcut: '⌘3' },
  { name: 'Analysis', href: '/dashboard/data-analysis', icon: BarChart3, shortcut: '⌘4' },
      { name: 'Exports', href: '/dashboard/export', icon: Download, shortcut: '⌘5' },
    ],
    workflow: [
    { name: 'Datasets', href: '/dashboard/datasets', icon: FileText, count: 0 },
    { name: 'Transformations', href: '/dashboard/transformations', icon: Zap, count: 0 },
    { name: 'Jobs', href: '/dashboard/jobs', icon: Activity, count: 0 },
      { name: 'Anomalies', href: '/dashboard/anomalies', icon: AlertTriangle, count: 0 },
    ],
    collaboration: [
      { name: 'Shared Projects', href: '/dashboard/shared', icon: Users, count: 0 },
      { name: 'Team Insights', href: '/dashboard/team-insights', icon: TrendingUp, count: 0 },
      { name: 'Comments', href: '/dashboard/comments', icon: MessageSquare, count: 0 },
    ]
  },
  analyst: {
    core: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, shortcut: '⌘1' },
      { name: 'Analysis Hub', href: '/dashboard/analysis-hub', icon: BarChart3, shortcut: '⌘2' },
      { name: 'Data Sources', href: '/dashboard/data-sources', icon: Database, shortcut: '⌘3' },
      { name: 'ML Models', href: '/dashboard/ml-models', icon: BrainCircuit, shortcut: '⌘4' },
      { name: 'Experiments', href: '/dashboard/experiments', icon: FlaskConical, shortcut: '⌘5' },
    ],
    analytics: [
      { name: 'Statistical Analysis', href: '/dashboard/stats', icon: BarChart4, count: 0 },
      { name: 'Predictive Models', href: '/dashboard/predictions', icon: TrendingUp, count: 0 },
      { name: 'A/B Testing', href: '/dashboard/ab-testing', icon: GitBranch, count: 0 },
      { name: 'Reporting', href: '/dashboard/reports', icon: FileText, count: 0 },
    ],
    tools: [
      { name: 'Query Builder', href: '/dashboard/query-builder', icon: Code, count: 0 },
      { name: 'Visualization', href: '/dashboard/visualizations', icon: PieChart, count: 0 },
      { name: 'Notebooks', href: '/dashboard/notebooks', icon: BookOpen, count: 0 },
      { name: 'SQL Editor', href: '/dashboard/sql-editor', icon: Terminal, count: 0 },
    ]
  }
}

const systemAndIntegration = [
  { name: 'Integrations', href: '/dashboard/integrations', icon: Globe, shortcut: '⌘I' },
  { name: 'API Keys', href: '/dashboard/api-keys', icon: Key, shortcut: '⌘K' },
  { name: 'Webhooks', href: '/dashboard/webhooks', icon: Network, shortcut: '⌘W' },
]

const settingsAndSupport = [
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, shortcut: '⌘,' },
  { name: 'Usage', href: '/dashboard/usage', icon: PieChart, shortcut: '⌘U' },
  { name: 'Documentation', href: '/documentation', icon: BookOpen, shortcut: '⌘D' },
  { name: 'Support', href: '/dashboard/support', icon: HeadphonesIcon, shortcut: '⌘H' },
]

// Role definitions
const roleDefinitions = {
  admin: {
    name: 'Administrator',
    description: 'Full system access',
    icon: Crown,
    color: 'text-red-600 bg-red-50',
    badge: 'ADMIN'
  },
  user: {
    name: 'Data User',
    description: 'Standard user access',
    icon: User,
    color: 'text-blue-600 bg-blue-50',
    badge: 'USER'
  },
  analyst: {
    name: 'Data Analyst',
    description: 'Advanced analytics',
    icon: GraduationCap,
    color: 'text-purple-600 bg-purple-50',
    badge: 'ANALYST'
  }
}

interface DynamicSectionProps {
  title: string;
  icon: React.ElementType;
  items: Array<{
    name: string;
    href: string;
    icon: React.ElementType;
    count?: number;
    badge?: string;
  }>;
  isCollapsed: boolean;
  pathname: string;
  openCollapsible: string | null;
  setOpenCollapsible: (title: string | null) => void;
}

function DynamicSection({ 
  title, 
  icon: Icon, 
  items, 
  isCollapsed, 
  pathname, 
  openCollapsible, 
  setOpenCollapsible 
}: DynamicSectionProps) {
  const isOpen = openCollapsible === title;
  const isParentActive = items.some(item => pathname.startsWith(item.href));

  return (
    <div className="group">
      <Collapsible open={isOpen} onOpenChange={(open) => setOpenCollapsible(open ? title : null)}>
        <CollapsibleTrigger className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group-hover:bg-gray-50/80",
          isCollapsed ? "justify-center px-2" : "justify-between",
          isParentActive 
            ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
            : 'text-gray-600 hover:text-gray-900'
        )}>
          <div className="flex items-center gap-3">
            <Icon className={cn(
              'w-5 h-5 transition-colors',
              isParentActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
            )} />
            {!isCollapsed && (
              <span className="font-medium">{title}</span>
            )}
          </div>
          {!isCollapsed && (
            <ChevronDown className={cn(
              "w-4 h-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )} />
          )}
        </CollapsibleTrigger>
        {!isCollapsed && (
          <CollapsibleContent className="mt-1 space-y-1">
            {items.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 ml-6 rounded-lg text-sm transition-all duration-200 group",
                  pathname.startsWith(item.href)
                    ? 'text-blue-600 bg-blue-50 font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="flex-1">{item.name}</span>
                {item.count !== undefined && item.count > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {item.count}
                  </Badge>
                )}
                {item.badge && (
                  <Badge variant="outline" className="text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  );
}

interface RoleSwitcherProps {
  currentRole: string;
  onRoleChange: (role: string) => void;
  isCollapsed: boolean;
}

function RoleSwitcher({ currentRole, onRoleChange, isCollapsed }: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentRoleData = roleDefinitions[currentRole as keyof typeof roleDefinitions];

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <currentRoleData.icon className="w-5 h-5 text-gray-600" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            <p>{currentRoleData.name}</p>
            <p className="text-xs text-gray-400">{currentRoleData.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:bg-gray-50/80",
          currentRoleData.color
        )}
      >
        <currentRoleData.icon className="w-5 h-5" />
        <div className="flex-1 text-left">
          <div className="font-medium">{currentRoleData.name}</div>
          <div className="text-xs opacity-75">{currentRoleData.description}</div>
        </div>
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
          {Object.entries(roleDefinitions).map(([roleKey, role]) => (
            <button
              key={roleKey}
              onClick={() => {
                onRoleChange(roleKey);
                setIsOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:bg-gray-50",
                roleKey === currentRole && "bg-blue-50 text-blue-700",
                roleKey === Object.keys(roleDefinitions)[0] && "rounded-t-xl",
                roleKey === Object.keys(roleDefinitions)[Object.keys(roleDefinitions).length - 1] && "rounded-b-xl"
              )}
            >
              <role.icon className="w-5 h-5" />
              <div className="flex-1 text-left">
                <div className="font-medium">{role.name}</div>
                <div className="text-xs opacity-75">{role.description}</div>
              </div>
              {roleKey === currentRole && (
                <CheckCircle2 className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [openCollapsible, setOpenCollapsible] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string>('user'); // Default to user, can be set from user context

  // Get role-based navigation
  const roleNav = roleBasedNavigation[currentRole as keyof typeof roleBasedNavigation];

  const renderNav = (items: any[]) => (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive = (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)));

        const NavLink = ({ children }: { children: React.ReactNode }) => (
          <Link 
            href={item.href} 
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
              isCollapsed ? "justify-center px-2" : "",
              isActive
                ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50/80'
            )}
          >
            {children}
          </Link>
        );

        const content = (
          <>
            <item.icon className={cn(
              'w-5 h-5 transition-colors',
              isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
            )} />
            {!isCollapsed && (
              <span className="flex-1">{item.name}</span>
            )}
            {!isCollapsed && item.badge && (
              <Badge variant={item.badge === 'New' ? 'default' : 'outline'} className="text-xs">
                {item.badge}
              </Badge>
            )}
            {!isCollapsed && item.shortcut && (
              <span className="text-xs text-gray-400 font-mono">{item.shortcut}</span>
            )}
          </>
        );

        return (
          <div key={item.name}>
            {isCollapsed ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <NavLink>{content}</NavLink>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    <p>{item.name}</p>
                    {item.shortcut && (
                      <p className="text-xs text-gray-400 font-mono">{item.shortcut}</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <NavLink>{content}</NavLink>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={cn(
      "relative hidden lg:flex lg:flex-col lg:h-[calc(100vh-5rem)] transition-all duration-300 ease-in-out bg-white border-r border-gray-100/80",
      isCollapsed ? "lg:w-16" : "lg:w-80"
    )}>
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100/80">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Schlep-engine</h2>
              <p className="text-xs text-gray-500">Data Intelligence Platform</p>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "p-2 rounded-lg hover:bg-gray-100 transition-colors",
            isCollapsed && "mx-auto"
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? 
            <ChevronRight className="w-4 h-4 text-gray-600" /> : 
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          }
        </button>
      </div>

      {/* Role Switcher */}
      <div className="p-4 border-b border-gray-100/80">
        <RoleSwitcher
          currentRole={currentRole}
          onRoleChange={setCurrentRole}
          isCollapsed={isCollapsed}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-8">
        {/* Core Navigation */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
              Core
            </h3>
          )}
          {renderNav(roleNav.core)}
        </div>

        {/* Role-specific sections */}
        {Object.entries(roleNav).slice(1).map(([sectionKey, sectionItems]) => (
          <div key={sectionKey} className="space-y-6">
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
                {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}
            </h3>
          )}
          <DynamicSection
              title={sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}
              icon={sectionKey === 'management' ? Settings : sectionKey === 'ai' ? BrainCircuit : sectionKey === 'workflow' ? Activity : sectionKey === 'collaboration' ? Users : sectionKey === 'analytics' ? BarChart3 : sectionKey === 'tools' ? Code : Folder}
              items={sectionItems as any[]}
            isCollapsed={isCollapsed}
            pathname={pathname}
            openCollapsible={openCollapsible}
            setOpenCollapsible={setOpenCollapsible}
          />
        </div>
        ))}

        {/* System & Integration */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
              System
            </h3>
          )}
          {renderNav(systemAndIntegration)}
        </div>

        {/* Settings & Support */}
        <div>
          {!isCollapsed && (
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
              General
            </h3>
          )}
          {renderNav(settingsAndSupport)}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100/80">
        <div className={cn(
          "flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer",
          isCollapsed && "justify-center"
        )}>
          <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || 'Admin User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || 'admin@company.com'}
              </p>
            </div>
          )}
          {!isCollapsed && (
            <button className="p-1.5 hover:bg-gray-200 rounded-md transition-colors">
              <LogOut className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
} 