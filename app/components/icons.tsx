/* Monochrome line icons — one stroke weight across the app. Colour comes from `c`, size from `s`. */

type P = { c?: string; s?: number; w?: number };

const Svg = ({ c = "currentColor", s = 22, w = 1.8, children, fill = "none" }: P & { children: React.ReactNode; fill?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export type IconType = (p: P) => React.ReactElement;

export const BackIcon = (p: P) => <Svg {...p} w={p.w ?? 1.9}><path d="M19 12H5M11 6l-6 6 6 6" /></Svg>;
export const ArrowRight = (p: P) => <Svg {...p}><path d="M4 12h15M13 6l6 6-6 6" /></Svg>;
export const ChevronRight = (p: P) => <Svg {...p} w={p.w ?? 2.2}><path d="M9 18l6-6-6-6" /></Svg>;
export const ChevronDown = (p: P) => <Svg {...p} w={p.w ?? 2.2}><path d="M6 9l6 6 6-6" /></Svg>;
export const SearchIcon = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="7.5" /><path d="M21 21l-4.6-4.6" /></Svg>;
export const BellIcon = (p: P) => <Svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></Svg>;
export const ShareIcon = (p: P) => <Svg {...p}><circle cx="18" cy="5.5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="18.5" r="2.5" /><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1" /></Svg>;
export const CalendarIcon = (p: P) => <Svg {...p}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M8 3v4M16 3v4M4 10h16" /></Svg>;
export const ClockIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const PhoneIcon = (p: P) => <Svg {...p}><path d="M21 16.4v2.9a1.9 1.9 0 0 1-2.1 1.9A18.8 18.8 0 0 1 2.8 5.1 1.9 1.9 0 0 1 4.7 3h2.9a1.9 1.9 0 0 1 1.9 1.6c.1.9.4 1.8.7 2.7a1.9 1.9 0 0 1-.4 2L8.6 10.5a15.2 15.2 0 0 0 5.9 5.9l1.2-1.2a1.9 1.9 0 0 1 2-.4c.9.3 1.8.6 2.7.7a1.9 1.9 0 0 1 1.6 1.9z" /></Svg>;
export const ChatIcon = (p: P) => <Svg {...p}><path d="M20 12.5a7.5 7.5 0 0 1-11.1 6.6L4 20.5l1.4-4.6A7.5 7.5 0 1 1 20 12.5z" /></Svg>;
export const SendIcon = (p: P) => <Svg {...p}><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></Svg>;
export const StarIcon = ({ s = 14, off }: { s?: number; off?: boolean }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill={off ? "var(--line-strong)" : "var(--gold)"} aria-hidden="true">
    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" />
  </svg>
);
export const CheckIcon = (p: P) => <Svg {...p} w={p.w ?? 2.6}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const XIcon = (p: P) => <Svg {...p} w={p.w ?? 2.2}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const PlusIcon = (p: P) => <Svg {...p} w={p.w ?? 2.2}><path d="M12 5v14M5 12h14" /></Svg>;
export const ShieldIcon = (p: P) => <Svg {...p}><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" /><path d="M8.8 12l2.2 2.2 4.2-4.2" /></Svg>;
export const PinIcon = (p: P) => <Svg {...p}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>;
export const CardIcon = (p: P) => <Svg {...p}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h4" /></Svg>;
export const HelpIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.5 2.5 0 0 1 4.9.6c0 1.7-2.5 2-2.5 3.7M12 17h.01" /></Svg>;
export const InfoIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8h.01" /></Svg>;
export const HistoryIcon = (p: P) => <Svg {...p}><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6" /><path d="M3 4v4.5h4.5M12 7.5V12l3 2" /></Svg>;
export const GearIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15h-.3a2 2 0 1 1 0-4h.2A1.6 1.6 0 0 0 4.5 8.2l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z" /></Svg>;
export const HomeIcon = (p: P) => <Svg {...p}><path d="M3.5 11L12 4l8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5h4v5" /></Svg>;
export const BriefcaseIcon = (p: P) => <Svg {...p}><rect x="3" y="7.5" width="18" height="12.5" rx="2.5" /><path d="M9 7.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5v2M3 13h18" /></Svg>;
export const TagIcon = (p: P) => <Svg {...p}><path d="M3 12.2V4.5A1.5 1.5 0 0 1 4.5 3h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-7.1 7.1a1.5 1.5 0 0 1-2.1 0z" /><circle cx="7.8" cy="7.8" r="1.4" /></Svg>;
export const WalletIcon = (p: P) => <Svg {...p}><path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4h-12A2.5 2.5 0 0 0 3 6.5v11A2.5 2.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /><path d="M21 9h-5a3 3 0 0 0 0 6h5z" /><circle cx="16.2" cy="12" r=".6" /></Svg>;
export const CashIcon = (p: P) => <Svg {...p}><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9.5v.01M18 14.5v.01" /></Svg>;
export const UpiIcon = (p: P) => <Svg {...p}><path d="M10 4L6 20M15 4l4 8-6 8" /></Svg>;
export const NavIcon = (p: P) => <Svg {...p}><path d="M12 2.5l7.5 18.5-7.5-4-7.5 4z" /></Svg>;
export const TargetIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22" /></Svg>;
export const UsersIcon = (p: P) => <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.3a6.5 6.5 0 0 1 3 5.7" /></Svg>;
export const UserIcon = (p: P) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20.5a8 8 0 0 1 16 0" /></Svg>;
export const SteeringIcon = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2.5" /><path d="M3.5 10.5c3-1 5.6-1.5 8.5-1.5s5.5.5 8.5 1.5M10 14l-4 6M14 14l4 6" /></Svg>;
export const ChartIcon = (p: P) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>;
export const GridIcon = (p: P) => <Svg {...p}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></Svg>;
export const MapIcon = (p: P) => <Svg {...p}><path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6z" /><path d="M9 4v14M15 6v14" /></Svg>;
export const RupeeIcon = (p: P) => <Svg {...p}><path d="M6.5 4h11M6.5 8.5h11M9 4c5.5 0 5.5 9-1 9H7l8 7" /></Svg>;
export const DocIcon = (p: P) => <Svg {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></Svg>;
export const UploadIcon = (p: P) => <Svg {...p}><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" /></Svg>;
export const PowerIcon = (p: P) => <Svg {...p}><path d="M12 3v8" /><path d="M6.6 6.6a8 8 0 1 0 10.8 0" /></Svg>;
export const LogoutIcon = (p: P) => <Svg {...p}><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H15M10 16l-4-4 4-4M6 12h10" /></Svg>;
export const MegaphoneIcon = (p: P) => <Svg {...p}><path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1z" /><path d="M16 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></Svg>;
export const DownloadIcon = (p: P) => <Svg {...p}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17" /></Svg>;
export const MenuIcon = (p: P) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>;
export const SwapIcon = (p: P) => <Svg {...p}><path d="M7 4v16M3.5 7.5L7 4l3.5 3.5M17 20V4M13.5 16.5L17 20l3.5-3.5" /></Svg>;
export const BoltIcon = (p: P) => <Svg {...p}><path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z" /></Svg>;
export const GiftIcon = (p: P) => <Svg {...p}><rect x="3.5" y="8" width="17" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3.5 8 4.5 9 8 12 8zM12 8s1.5-4.5 4-3.5S15 8 12 8z" /></Svg>;
export const LockIcon = (p: P) => <Svg {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></Svg>;
export const AlertIcon = (p: P) => <Svg {...p}><path d="M12 3.5L2.5 20h19z" /><path d="M12 10v4.5M12 17.5h.01" /></Svg>;
export const CarIcon = (p: P) => <Svg {...p}><path d="M5 11l1.7-4.5A2 2 0 0 1 8.6 5h6.8a2 2 0 0 1 1.9 1.5L19 11" /><rect x="3" y="11" width="18" height="6.5" rx="2" /><path d="M5.5 17.5V19.5M18.5 17.5V19.5" /><circle cx="7.5" cy="14.2" r="1" /><circle cx="16.5" cy="14.2" r="1" /></Svg>;
export const BoxIcon = (p: P) => <Svg {...p}><path d="M12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" /><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9M7.8 5.3l8.5 4.5" /></Svg>;
export const SnowIcon = (p: P) => <Svg {...p}><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6" /><path d="M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5M4.4 10.6l3.4-.9-.9-3.4M19.6 13.4l-3.4.9.9 3.4M6.9 17.7l.9-3.4-3.4-.9M17.1 6.3l-.9 3.4 3.4.9" /></Svg>;
