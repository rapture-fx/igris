"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
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
  Headphones as HeadphonesIcon,
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
  CloudSun as CloudSync,
  HardDrive,
  Smartphone,
  Tablet,
  Laptop,
  Monitor as Desktop,
  Watch,
  Camera,
  Mic,
  Speaker,
  Headphones,
  Gamepad2,
  Keyboard,
  Mouse,
  Printer,
  Scan as Scanner,
  Printer as Fax,
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
  MessageCircle as MessageCircleIcon,
  MessageSquare as MessageSquareIcon,
  Info,
  AlertTriangle as AlertTriangleIcon,
  CheckCircle,
  XCircle,
  HelpCircle as HelpCircleIcon,
  HelpCircle as QuestionMarkCircle,
  AlertTriangle as ExclamationTriangleIcon,
  ShieldAlert,
  ShieldX,
  ShieldCheck as ShieldCheckIcon,
  Lock,
  Unlock,
  LockKeyhole,
  Hash,
  AtSign as At,
  Percent,
  DollarSign as Dollar,
  Euro,
  PoundSterling as Pound,
  Yen,
  Bitcoin,
  Banknote,
  Wallet,
  CreditCard as CreditCardIcon,
  Coins,
  TrendingDown,
  TrendingUp as TrendingUpIcon,
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
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
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
  Focus as Unfocus,
  Crosshair,
  Crosshair as Crosshair2,
  Scan,
  ScanLine,
  Radar,
  Radio as Sonar,
  Wifi,
  WifiOff,
  Bluetooth,
  BluetoothConnected,
  BluetoothSearching,
  BluetoothOff,
  Cast,
  Cast as CastConnected,
  Airplay,
  Radio,
  RadioTower as RadioReceiver,
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
  Server as Modem,
  Ethernet,
  Usb,
  Usb as UsbC,
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
  Gauge as Speedometer,
  Timer,
  Timer as TimerIcon,
  Stopwatch,
  AlarmClock,
  Clock as ClockIcon,
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
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarCheck,
  CalendarX,
  CalendarPlus,
  CalendarMinus,
  CalendarHeart,
  CalendarClock,
  CalendarRange,
  CalendarSearch,
  ArrowUpFromLine as CalendarArrowUp,
  ArrowDownToLine as CalendarArrowDown,
  Calendar as CalendarFold,
  Calendar as CalendarUnfold,
  CalendarX as CalendarX2,
  CalendarCheck as CalendarCheck2,
  CalendarCog,
  CalendarSync,
  Calendar as CalendarIconIcon,
  Sun as SunIcon,
  Moon as MoonIcon,
  SunDim,
  SunMedium,
  SunSnow,
  Sunrise,
  Sunset,
  Moon as Eclipse,
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
  Zap as Bolt,
  Zap as BoltIcon,
  CloudLightning as ThunderstormIcon,
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
  CloudSun as PartlyCloudyDay,
  CloudMoon as PartlyCloudyNight,
  Rainbow,
  Umbrella,
  Umbrella as UmbrellaBeach,
  Waves,
  Wind,
  Tornado,
  Snowflake,
  Thermometer,
  ThermometerSun,
  ThermometerSnowflake,
  Droplets,
  Droplet,
  Thermometer as Humidity,
  Eye as EyeIcon,
  EyeOff,
  Glasses,
  Contact as Monocle,
  Telescope,
  Microscope,
  Binoculars,
  Camera as CameraIcon,
  CameraOff,
  Video,
  VideoOff,
  Video as VideoIcon,
  Film,
  Film as FilmStrip,
  Play as PlayIcon,
  Pause as PauseIcon,
  Square as SquareIcon,
  StopCircle,
  PlayCircle,
  PauseCircle,
  PlaySquare as SquarePlay,
  PauseSquare as SquarePause,
  StopSquare as SquareStop,
  TriangleRight,
  TriangleLeft,
  Triangle,
  Triangle,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  Repeat,
  Repeat1 as RepeatOne,
  Shuffle,
  Volume,
  VolumeX as VolumeOff,
  Volume1,
  Volume2,
  VolumeX,
  Volume1 as VolumeDown,
  Volume2 as VolumeUp,
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
  Disc as Vinyl,
  CassetteTape as Cassette,
  Disc as Cd,
  Headset,
  Headphones as Airpods,
  Headphones as AirpodsCase,
  Headphones as AirpodsCharging,
  Headphones as AirpodsConnected,
  Headphones as AirpodsDisconnected,
  Headphones as AirpodsLeft,
  Headphones as AirpodsRight,
  Headphones as AirpodsOff,
  Headphones as AirpodsOn,
  Headphones as AirpodsCharging2,
  Headphones as AirpodsLow,
  Headphones as AirpodsHigh,
  Headphones as AirpodsPlaying,
  Headphones as AirpodsSearching,
  Headphones as AirpodsIcon,
  Waveform,
  Waveform as AudioWaveform,
  AudioLines,
  SoundWave,
  Equalizer,
  Sliders,
  SlidersHorizontal,
  SlidersVertical,
  Settings as SettingsIcon,
  Settings as SettingsIconIcon,
  Cog as CogIcon,
  Cog as CogIconIcon,
  Cog as Gear,
  Cog as GearIcon,
  Tool,
  Tool as ToolIcon,
  Wrench,
  Wrench as WrenchIcon,
  Screwdriver,
  Screwdriver as ScrewdriverIcon,
  Hammer,
  Hammer as HammerIcon,
  Pickaxe,
  Pickaxe as PickaxeIcon,
  Drill,
  Drill as DrillIcon,
  HandMetal as Saw,
  HandMetal as SawIcon,
  Ruler,
  Ruler as RulerIcon,
  Compass as CompassIcon,
  Compass as CompassIconIcon,
  Compass as Protractor,
  Compass as ProtractorIcon,
  Divide as Dividers,
  Divide as DividersIcon,
  Scissors,
  Scissors as ScissorsIcon,
  Paperclip as Stapler,
  Paperclip as StaplerIcon,
  Paperclip,
  Paperclip as PaperclipIcon,
  Pin,
  Pin as PinIcon,
  Pin as Pushpin,
  Pin as PushpinIcon,
  Pin as Thumbtack,
  Pin as ThumbtackIcon,
  Magnet,
  Magnet as MagnetIcon,
  Anchor,
  Anchor as AnchorIcon,
  Link,
  Link as LinkIcon,
  Unlink,
  Unlink as UnlinkIcon,
  Link as Chain,
  Link as ChainIcon,
  Cable as Rope,
  Cable as RopeIcon,
  Cable as Knot,
  Cable as KnotIcon,
  Gift as Bow,
  Gift as BowIcon,
  Gift,
  Gift as GiftIcon,
  Package as PackageIcon,
  Package as PackageIconIcon,
  PackageOpen,
  PackageOpen as PackageOpenIcon,
  PackageSearch,
  PackageSearch as PackageSearchIcon,
  PackageCheck,
  PackageCheck as PackageCheckIcon,
  PackageX,
  PackageX as PackageXIcon,
  PackagePlus,
  PackagePlus as PackagePlusIcon,
  PackageMinus,
  PackageMinus as PackageMinusIcon,
  Package2,
  Package as Package2Icon,
  Package as PackageIcon2,
  Box,
  Box as BoxIcon,
  BoxSelect,
  BoxSelect as BoxSelectIcon,
  Container,
  Container as ContainerIcon,
  Archive as ArchiveIcon,
  Archive as ArchiveIconIcon,
  ArchiveRestore,
  ArchiveRestore as ArchiveRestoreIcon,
  ArchiveX,
  ArchiveX as ArchiveXIcon,
  FolderArchive,
  FolderArchive as FolderArchiveIcon,
  FolderOpen,
  FolderOpen as FolderOpenIcon,
  FolderPlus,
  FolderPlus as FolderPlusIcon,
  FolderMinus,
  FolderMinus as FolderMinusIcon,
  FolderX,
  FolderX as FolderXIcon,
  FolderCheck,
  FolderCheck as FolderCheckIcon,
  FolderClock,
  FolderClock as FolderClockIcon,
  FolderEdit,
  FolderEdit as FolderEditIcon,
  FolderKey,
  FolderKey as FolderKeyIcon,
  FolderLock,
  FolderLock as FolderLockIcon,
  FolderRoot,
  FolderRoot as FolderRootIcon,
  FolderSync,
  FolderSync as FolderSyncIcon,
  FolderTree,
  FolderTree as FolderTreeIcon,
  FolderUp,
  FolderUp as FolderUpIcon,
  FolderDown,
  FolderDown as FolderDownIcon,
  FolderInput,
  FolderInput as FolderInputIcon,
  FolderOutput,
  FolderOutput as FolderOutputIcon,
  FolderCog,
  FolderCog as FolderCogIcon,
  FolderGit,
  FolderGit as FolderGitIcon,
  FolderGit2,
  FolderGit2 as FolderGit2Icon,
  FolderSearch,
  FolderSearch as FolderSearchIcon,
  FolderSearch2,
  FolderSearch2 as FolderSearch2Icon,
  FolderHeart,
  FolderHeart as FolderHeartIcon,
  FolderSymlink,
  FolderSymlink as FolderSymlinkIcon,
  FolderKanban,
  FolderKanban as FolderKanbanIcon,
  File as FileIcon,
  File as FileIconIcon,
  FilePlus,
  FilePlus as FilePlusIcon,
  FileMinus,
  FileMinus as FileMinusIcon,
  FileX,
  FileX as FileXIcon,
  FileCheck,
  FileCheck as FileCheckIcon,
  FileSearch as FileSearchIcon,
  FileSearch as FileSearchIconIcon,
  FileSearch2,
  FileSearch2 as FileSearch2Icon,
  FileEdit,
  FileEdit as FileEditIcon,
  FileType,
  FileType as FileTypeIcon,
  FileType2,
  FileType2 as FileType2Icon,
  FileInput,
  FileInput as FileInputIcon,
  FileOutput,
  FileOutput as FileOutputIcon,
  FileDown,
  FileDown as FileDownIcon,
  FileUp,
  FileUp as FileUpIcon,
  FileDigit,
  FileDigit as FileDigitIcon,
  FileKey,
  FileKey as FileKeyIcon,
  FileKey2,
  FileKey2 as FileKey2Icon,
  FileLock,
  FileLock as FileLockIcon,
  FileLock2,
  FileLock2 as FileLock2Icon,
  FileQuestion,
  FileQuestion as FileQuestionIcon,
  FileWarning,
  FileWarning as FileWarningIcon,
  FileX2,
  FileX2 as FileX2Icon,
  FileSliders,
  FileSliders as FileSlidersIcon,
  FileCog,
  FileCog as FileCogIcon,
  FileCog2,
  FileCog2 as FileCog2Icon,
  FileCode as FileCodeIcon,
  FileCode as FileCodeIconIcon,
  FileCode2,
  FileCode2 as FileCode2Icon,
  FileJson,
  FileJson as FileJsonIcon,
  FileJson2,
  FileJson2 as FileJson2Icon,
  FileBox,
  FileBox as FileBoxIcon,
  FileArchive,
  FileArchive as FileArchiveIcon,
  FileImage as FileImageIcon,
  FileImage as FileImageIconIcon,
  FileVideo as FileVideoIcon,
  FileVideo as FileVideoIconIcon,
  FileVideo2,
  FileVideo2 as FileVideo2Icon,
  FileAudio,
  FileAudio as FileAudioIcon,
  FileAudio2,
  FileAudio2 as FileAudio2Icon,
  FileMusic as FileMusicIcon,
  FileMusic as FileMusicIconIcon,
  FileMusic2,
  FileMusic2 as FileMusic2Icon,
  FileSpreadsheet as FileSpreadsheetIcon,
  FileSpreadsheet as FileSpreadsheetIconIcon,
  FileBarChart as FileBarChartIcon,
  FileBarChart as FileBarChartIconIcon,
  FileBarChart2,
  FileBarChart2 as FileBarChart2Icon,
  FileBarChart as FileBarChart3,
  FileBarChart as FileBarChart3Icon,
  FileBarChart as FileBarChart4,
  FileBarChart as FileBarChart4Icon,
  FileLineChart,
  FileLineChart as FileLineChartIcon,
  FilePieChart,
  FilePieChart as FilePieChartIcon,
  FileText as FileTextIcon,
  FileText as FileTextIconIcon,
  FileText as FileDoc,
  FileText as FileDocIcon,
  FileText as FilePdf,
  FileText as FilePdfIcon,
  FileSymlink,
  FileSymlink as FileSymlinkIcon,
  FileHeart,
  FileHeart as FileHeartIcon,
  FileStack,
  FileStack as FileStackIcon,
  FileTerminal,
  FileTerminal as FileTerminalIcon,
  FileVolume,
  FileVolume as FileVolumeIcon,
  FileVolume2,
  FileVolume2 as FileVolume2Icon,
  FileVolumeX,
  FileVolumeX as FileVolumeXIcon,
  FileSignature,
  FileSignature as FileSignatureIcon,
  BarChart as FileChartColumn,
  BarChart as FileChartColumnIcon,
  BarChart as FileChartColumnIncreasing,
  BarChart as FileChartColumnIncreasingIcon,
  LineChart as FileChartLine,
  LineChart as FileChartLineIcon,
  PieChart as FileChartPie,
  PieChart as FileChartPieIcon,
  FileUser,
  FileUser as FileUserIcon,
  FileUsers,
  FileUsers as FileUsersIcon,
  FileWarning as FileWarning2,
  FileWarning as FileWarning2Icon,
  FileSpreadsheet as FileSpreadsheet2,
  FileSpreadsheet as FileSpreadsheet2Icon,
  FileSpreadsheet as FileSpreadsheet3,
  FileSpreadsheet as FileSpreadsheet3Icon,
  FileSpreadsheet as FileSpreadsheet4,
  FileSpreadsheet as FileSpreadsheet4Icon,
  FileSpreadsheet as FileSpreadsheet5,
  FileSpreadsheet as FileSpreadsheet5Icon,
  FileSpreadsheet as FileSpreadsheet6,
  FileSpreadsheet as FileSpreadsheet6Icon,
  FileSpreadsheet as FileSpreadsheet7,
  FileSpreadsheet as FileSpreadsheet7Icon,
  FileSpreadsheet as FileSpreadsheet8,
  FileSpreadsheet as FileSpreadsheet8Icon,
  FileSpreadsheet as FileSpreadsheet9,
  FileSpreadsheet as FileSpreadsheet9Icon,
  FileSpreadsheet as FileSpreadsheet10,
  FileSpreadsheet as FileSpreadsheet10Icon,
  FileSpreadsheet as FileSpreadsheet11,
  FileSpreadsheet as FileSpreadsheet11Icon,
  FileSpreadsheet as FileSpreadsheet12,
  FileSpreadsheet as FileSpreadsheet12Icon,
  FileSpreadsheet as FileSpreadsheet13,
  FileSpreadsheet as FileSpreadsheet13Icon,
  FileSpreadsheet as FileSpreadsheet14,
  FileSpreadsheet as FileSpreadsheet14Icon,
  FileSpreadsheet as FileSpreadsheet15,
  FileSpreadsheet as FileSpreadsheet15Icon,
  FileSpreadsheet as FileSpreadsheet16,
  FileSpreadsheet as FileSpreadsheet16Icon,
  FileSpreadsheet as FileSpreadsheet17,
  FileSpreadsheet as FileSpreadsheet17Icon,
  FileSpreadsheet as FileSpreadsheet18,
  FileSpreadsheet as FileSpreadsheet18Icon,
  FileSpreadsheet as FileSpreadsheet19,
  FileSpreadsheet as FileSpreadsheet19Icon,
  FileSpreadsheet as FileSpreadsheet20,
  FileSpreadsheet as FileSpreadsheet20Icon,
  FileSpreadsheet as FileSpreadsheet21,
  FileSpreadsheet as FileSpreadsheet21Icon,
  FileSpreadsheet as FileSpreadsheet22,
  FileSpreadsheet as FileSpreadsheet22Icon,
  FileSpreadsheet as FileSpreadsheet23,
  FileSpreadsheet as FileSpreadsheet23Icon,
  FileSpreadsheet as FileSpreadsheet24,
  FileSpreadsheet as FileSpreadsheet24Icon,
  FileSpreadsheet as FileSpreadsheet25,
  FileSpreadsheet as FileSpreadsheet25Icon,
  FileSpreadsheet as FileSpreadsheet26,
  FileSpreadsheet as FileSpreadsheet26Icon,
  FileSpreadsheet as FileSpreadsheet27,
  FileSpreadsheet as FileSpreadsheet27Icon,
  FileSpreadsheet as FileSpreadsheet28,
  FileSpreadsheet as FileSpreadsheet28Icon,
  FileSpreadsheet as FileSpreadsheet29,
  FileSpreadsheet as FileSpreadsheet29Icon,
  FileSpreadsheet as FileSpreadsheet30,
  FileSpreadsheet as FileSpreadsheet30Icon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

// Role-based navigation structure
const roleBasedNavigation = {
  admin: {
    core: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        shortcut: "⌘1",
      },
      {
        name: "Projects",
        href: "/dashboard/projects",
        icon: FolderKanban,
        shortcut: "⌘2",
        badge: "New",
      },
      {
        name: "Data Sources",
        href: "/dashboard/data-sources",
        icon: Database,
        shortcut: "⌘3",
      },
      {
        name: "Pipelines",
        href: "/dashboard/pipelines",
        icon: Workflow,
        shortcut: "⌘4",
      },
      {
        name: "Analysis",
        href: "/dashboard/data-analysis",
        icon: BarChart3,
        shortcut: "⌘5",
      },
      {
        name: "System Monitor",
        href: "/dashboard/monitoring",
        icon: Activity,
        shortcut: "⌘6",
      },
    ],
    management: [
      {
        name: "User Management",
        href: "/dashboard/users",
        icon: Users,
        count: 0,
      },
      { name: "Security", href: "/dashboard/security", icon: Shield, count: 0 },
      {
        name: "Audit Logs",
        href: "/dashboard/audit",
        icon: FileSearch,
        count: 0,
      },
      {
        name: "System Health",
        href: "/dashboard/system-health",
        icon: Gauge,
        count: 0,
      },
    ],
    ai: [
      {
        name: "AI Models",
        href: "/dashboard/models",
        icon: BrainCircuit,
        count: 0,
      },
      {
        name: "Auto-labeling",
        href: "/dashboard/labeling",
        icon: Tags,
        count: 0,
      },
      {
        name: "ML Preparation",
        href: "/dashboard/ml-preparation",
        icon: Beaker,
        count: 0,
      },
      {
        name: "Model Registry",
        href: "/dashboard/model-registry",
        icon: Archive,
        count: 0,
      },
    ],
  },
  user: {
    core: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        shortcut: "⌘1",
      },
      {
        name: "My Projects",
        href: "/dashboard/my-projects",
        icon: FolderKanban,
        shortcut: "⌘2",
      },
      {
        name: "Data Sources",
        href: "/dashboard/data-sources",
        icon: Database,
        shortcut: "⌘3",
      },
      {
        name: "Analysis",
        href: "/dashboard/data-analysis",
        icon: BarChart3,
        shortcut: "⌘4",
      },
      {
        name: "Exports",
        href: "/dashboard/export",
        icon: Download,
        shortcut: "⌘5",
      },
    ],
    workflow: [
      {
        name: "Datasets",
        href: "/dashboard/datasets",
        icon: FileText,
        count: 0,
      },
      {
        name: "Transformations",
        href: "/dashboard/transformations",
        icon: Zap,
        count: 0,
      },
      { name: "Jobs", href: "/dashboard/jobs", icon: Activity, count: 0 },
      {
        name: "Anomalies",
        href: "/dashboard/anomalies",
        icon: AlertTriangle,
        count: 0,
      },
    ],
    collaboration: [
      {
        name: "Shared Projects",
        href: "/dashboard/shared",
        icon: Users,
        count: 0,
      },
      {
        name: "Team Insights",
        href: "/dashboard/team-insights",
        icon: TrendingUp,
        count: 0,
      },
      {
        name: "Comments",
        href: "/dashboard/comments",
        icon: MessageSquare,
        count: 0,
      },
    ],
  },
  analyst: {
    core: [
      {
        name: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        shortcut: "⌘1",
      },
      {
        name: "Analysis Hub",
        href: "/dashboard/analysis-hub",
        icon: BarChart3,
        shortcut: "⌘2",
      },
      {
        name: "Data Sources",
        href: "/dashboard/data-sources",
        icon: Database,
        shortcut: "⌘3",
      },
      {
        name: "ML Models",
        href: "/dashboard/ml-models",
        icon: BrainCircuit,
        shortcut: "⌘4",
      },
      {
        name: "Experiments",
        href: "/dashboard/experiments",
        icon: FlaskConical,
        shortcut: "⌘5",
      },
    ],
    analytics: [
      {
        name: "Statistical Analysis",
        href: "/dashboard/stats",
        icon: BarChart4,
        count: 0,
      },
      {
        name: "Predictive Models",
        href: "/dashboard/predictions",
        icon: TrendingUp,
        count: 0,
      },
      {
        name: "A/B Testing",
        href: "/dashboard/ab-testing",
        icon: GitBranch,
        count: 0,
      },
      {
        name: "Reporting",
        href: "/dashboard/reports",
        icon: FileText,
        count: 0,
      },
    ],
    tools: [
      {
        name: "Query Builder",
        href: "/dashboard/query-builder",
        icon: Code,
        count: 0,
      },
      {
        name: "Visualization",
        href: "/dashboard/visualizations",
        icon: PieChart,
        count: 0,
      },
      {
        name: "Notebooks",
        href: "/dashboard/notebooks",
        icon: BookOpen,
        count: 0,
      },
      {
        name: "SQL Editor",
        href: "/dashboard/sql-editor",
        icon: Terminal,
        count: 0,
      },
    ],
  },
};

const systemAndIntegration = [
  {
    name: "Integrations",
    href: "/dashboard/integrations",
    icon: Globe,
    shortcut: "⌘I",
  },
  { name: "API Keys", href: "/dashboard/api-keys", icon: Key, shortcut: "⌘K" },
  {
    name: "Webhooks",
    href: "/dashboard/webhooks",
    icon: Network,
    shortcut: "⌘W",
  },
];

const settingsAndSupport = [
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    shortcut: "⌘,",
  },
  { name: "Usage", href: "/dashboard/usage", icon: PieChart, shortcut: "⌘U" },
  {
    name: "Documentation",
    href: "/documentation",
    icon: BookOpen,
    shortcut: "⌘D",
  },
  {
    name: "Support",
    href: "/dashboard/support",
    icon: HeadphonesIcon,
    shortcut: "⌘H",
  },
];

// Role definitions
const roleDefinitions = {
  admin: {
    name: "Administrator",
    description: "Full system access",
    icon: Crown,
    color: "text-red-600 bg-red-50",
    badge: "ADMIN",
  },
  user: {
    name: "Data User",
    description: "Standard user access",
    icon: User,
    color: "text-blue-600 bg-blue-50",
    badge: "USER",
  },
  analyst: {
    name: "Data Analyst",
    description: "Advanced analytics",
    icon: GraduationCap,
    color: "text-purple-600 bg-purple-50",
    badge: "ANALYST",
  },
};

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
  setOpenCollapsible,
}: DynamicSectionProps) {
  const isOpen = openCollapsible === title;
  const isParentActive = items.some((item) => pathname.startsWith(item.href));

  return (
    <div className="group">
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => setOpenCollapsible(open ? title : null)}
      >
        <CollapsibleTrigger
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group-hover:bg-gray-50/80",
            isCollapsed ? "justify-center px-2" : "justify-between",
            isParentActive
              ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100"
              : "text-gray-600 hover:text-gray-900",
          )}
        >
          <div className="flex items-center gap-3">
            <Icon
              className={cn(
                "w-5 h-5 transition-colors",
                isParentActive
                  ? "text-blue-600"
                  : "text-gray-400 group-hover:text-gray-600",
              )}
            />
            {!isCollapsed && <span className="font-medium">{title}</span>}
          </div>
          {!isCollapsed && (
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform duration-200",
                isOpen && "rotate-180",
              )}
            />
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
                    ? "text-blue-600 bg-blue-50 font-medium"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50",
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

function RoleSwitcher({
  currentRole,
  onRoleChange,
  isCollapsed,
}: RoleSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentRoleData =
    roleDefinitions[currentRole as keyof typeof roleDefinitions];

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
            <p className="text-xs text-gray-400">
              {currentRoleData.description}
            </p>
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
          currentRoleData.color,
        )}
      >
        <currentRoleData.icon className="w-5 h-5" />
        <div className="flex-1 text-left">
          <div className="font-medium">{currentRoleData.name}</div>
          <div className="text-xs opacity-75">
            {currentRoleData.description}
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
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
                roleKey ===
                  Object.keys(roleDefinitions)[
                    Object.keys(roleDefinitions).length - 1
                  ] && "rounded-b-xl",
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
  const [currentRole, setCurrentRole] = useState<string>("user"); // Default to user, can be set from user context

  // Get role-based navigation
  const roleNav =
    roleBasedNavigation[currentRole as keyof typeof roleBasedNavigation];

  const renderNav = (items: any[]) => (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));

        const NavLink = ({ children }: { children: React.ReactNode }) => (
          <Link
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
              isCollapsed ? "justify-center px-2" : "",
              isActive
                ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50/80",
            )}
          >
            {children}
          </Link>
        );

        const content = (
          <>
            <item.icon
              className={cn(
                "w-5 h-5 transition-colors",
                isActive
                  ? "text-blue-600"
                  : "text-gray-400 group-hover:text-gray-600",
              )}
            />
            {!isCollapsed && <span className="flex-1">{item.name}</span>}
            {!isCollapsed && item.badge && (
              <Badge
                variant={item.badge === "New" ? "default" : "outline"}
                className="text-xs"
              >
                {item.badge}
              </Badge>
            )}
            {!isCollapsed && item.shortcut && (
              <span className="text-xs text-gray-400 font-mono">
                {item.shortcut}
              </span>
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
                      <p className="text-xs text-gray-400 font-mono">
                        {item.shortcut}
                      </p>
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
    <div
      className={cn(
        "relative hidden lg:flex lg:flex-col lg:h-[calc(100vh-5rem)] transition-all duration-300 ease-in-out bg-white border-r border-gray-100/80",
        isCollapsed ? "lg:w-16" : "lg:w-80",
      )}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100/80">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Igris-engine</h2>
              <p className="text-xs text-gray-500">
                Data Intelligence Platform
              </p>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className={cn(
            "p-2 rounded-lg hover:bg-gray-100 transition-colors",
            isCollapsed && "mx-auto",
          )}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          )}
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
        {Object.entries(roleNav)
          .slice(1)
          .map(([sectionKey, sectionItems]) => (
            <div key={sectionKey} className="space-y-6">
              {!isCollapsed && (
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 px-3">
                  {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}
                </h3>
              )}
              <DynamicSection
                title={sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}
                icon={
                  sectionKey === "management"
                    ? Settings
                    : sectionKey === "ai"
                      ? BrainCircuit
                      : sectionKey === "workflow"
                        ? Activity
                        : sectionKey === "collaboration"
                          ? Users
                          : sectionKey === "analytics"
                            ? BarChart3
                            : sectionKey === "tools"
                              ? Code
                              : Folder
                }
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
        <div
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer",
            isCollapsed && "justify-center",
          )}
        >
          <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-800 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name || "Admin User"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || "admin@company.com"}
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
  );
}
