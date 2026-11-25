"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  PlusCircle,
  Building,
  Bell,
  Users,
  Key,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  X,
  Layers,
  FileText,
  Calendar,
  CreditCard,
  QrCode,
  Search,
  Filter,
  RefreshCw,
  Home,
  Check,
  MapPin,
  Trash2,
  Eye,
  MessageSquare,
  Share2,
  ExternalLink,
  Edit3,
  SlidersHorizontal,
  Wifi,
  Wind,
  Car,
  Tv,
  CheckCircle,
  AlertCircle,
  UploadCloud,
  Navigation,
  Info,
  Clock,
  Utensils,
  Shirt,
  Sparkle,
  Image as ImageIcon,
  Flame,
  BatteryCharging,
  Droplets,
  ShieldAlert,
  Lock,
  Phone,
  CalendarCheck,
  User,
  CheckCheck,
  Download,
  Mail,
  BadgeCheck,
  FileCheck,
  Receipt,
  Send,
  History,
  DollarSign,
  AlertTriangle,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import TopAppBar from "../../components/TopAppBar";
import BottomNav from "../../components/BottomNav";
import { supabase } from "@/lib/supabase";
import { getOwnerVisitRequests, updateBookingStatus, verifyGoldenKey } from "@/app/actions/booking";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBgyJm2UjeOTYSloBNtAfGng2YGbcAezqi7U0vV4CEIRGhpFw59XVGUS2guACo-zTOCMoMk1XVw0xDd6YTdlyXEB3wEmGF8SiI8Bu_Sk1OoUQtYHjh6hOMPh2gqu_InBJztB996SSz4kenNaNtP1fdF7EQlNdTceOkZtr6f5oYoxkQi84paDTq_kYSyKtBLNhXlHeWk2AbbNsT3O7LiMsBL7Dq02AMp0j1gPGDs6vV5MA01on6GZHvE4iUyR007qJpJiXNcZCdOwig";

// Dynamically import the map so it's only rendered client-side (avoids SSR window errors)
const MapPicker = dynamic(() => import("../../components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-64 flex items-center justify-center bg-slate-100 rounded-2xl border border-slate-200">
      <div className="flex flex-col items-center gap-2 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="text-xs font-body font-medium">Loading interactive map…</span>
      </div>
    </div>
  ),
});

// ─── Data Types ──────────────────────────────────────────────────────────────
export type TabType = "Add Property" | "Active Listings" | "Visit Requests" | "Rented & Tenants";

export interface OwnerListing {
  id: string;
  title: string;
  price: number;
  deposit: number;
  location: string;
  description?: string;
  image_url: string;
  image_urls?: string[];
  status: "Active" | "Occupied" | "Paused";
  property_type: string;
  room_type: string;
  furnishing: string;
  amenities: string[];
  views: number;
  inquiries: number;
  created_at: string;
}

export interface VisitRequest {
  id: string;
  seeker_name: string;
  seeker_avatar: string;
  seeker_profession: string;
  seeker_phone: string;
  property_title: string;
  property_location: string;
  property_price: number;
  property_image: string;
  request_type: "Locked (10% Paid)" | "Free Visit";
  paid_deposit_amount?: number;
  priority_date_1: { date: string; timeSlot: string };
  priority_date_2: { date: string; timeSlot: string };
  selected_date_idx: 1 | 2;
  status: "Pending" | "Confirmed" | "Declined";
  visit_time?: string;
  seeker_message?: string;
  created_at: string;
}

export interface TenantRecord {
  id: string;
  name: string;
  avatar: string;
  profession: string;
  phone: string;
  email: string;
  property_title: string;
  property_location: string;
  property_image: string;
  room_type: string;
  monthly_rent: number;
  rent_status: "Paid" | "Due Soon" | "Overdue";
  rent_status_detail: string;
  security_deposit: number;
  lease_start: string;
  lease_end: string;
  lease_duration_months: number;
  kyc_status: "Verified" | "Pending Review";
  kyc_id_type: string;
  kyc_id_number: string;
  emergency_contact: {
    name: string;
    relationship: string;
    phone: string;
  };
  agreement_id: string;
}

interface TabItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  count?: number;
}

// Helper: Format raw date/time string to human-friendly priority slot
function formatSlotDate(
  rawDate?: string | null,
  fallbackSlot: string = "11:00 AM - 12:00 PM"
): { date: string; timeSlot: string } {
  if (!rawDate) {
    return { date: "Upcoming Slot", timeSlot: fallbackSlot };
  }
  if (
    rawDate.includes(",") ||
    rawDate.includes("AM") ||
    rawDate.includes("PM") ||
    rawDate.includes("Today") ||
    rawDate.includes("Tomorrow")
  ) {
    return { date: rawDate, timeSlot: fallbackSlot };
  }
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const formattedDate = d.toLocaleDateString("en-IN", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      const formattedTime = d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return {
        date: formattedDate,
        timeSlot:
          formattedTime !== "Invalid Date" && formattedTime !== "12:00 am"
            ? formattedTime
            : fallbackSlot,
      };
    }
  } catch {
    // fallback
  }
  return { date: rawDate, timeSlot: fallbackSlot };
}

// Helper: Format relative timestamp
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

// Initial default listings for real-time demonstration
const INITIAL_OWNER_LISTINGS: OwnerListing[] = [
  {
    id: "prop-1",
    title: "Luxury 2BHK with Balcony & City View",
    price: 32000,
    deposit: 64000,
    location: "Indiranagar 100ft Road, Bangalore",
    description:
      "Fully furnished high-rise apartment with modular kitchen, high-speed WiFi, split AC, and reserved parking.",
    image_url:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
    status: "Active",
    property_type: "Flat / Apartment",
    room_type: "2 BHK",
    furnishing: "Fully Furnished",
    amenities: ["WiFi", "AC", "Parking", "Power Backup", "Geyser"],
    views: 142,
    inquiries: 8,
    created_at: "2 days ago",
  },
  {
    id: "prop-2",
    title: "Spacious Studio near Metro Station",
    price: 22000,
    deposit: 44000,
    location: "Koramangala 4th Block, Bangalore",
    description:
      "Modern sun-lit private studio suite with private attached bathroom, work desk, and 24/7 power backup.",
    image_url:
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
    status: "Active",
    property_type: "Rental Room",
    room_type: "Single Studio",
    furnishing: "Semi-Furnished",
    amenities: ["WiFi", "RO Water", "Geyser", "Power Backup"],
    views: 98,
    inquiries: 5,
    created_at: "5 days ago",
  },
];

// Realistic mock tenants aligned with owner properties (BLOCK H, Cozy Fuzz, Zax room, Brahmaputra Rooms)
const INITIAL_TENANTS: TenantRecord[] = [
  {
    id: "tenant-1",
    name: "Vikram Malhotra",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80",
    profession: "Senior Data Engineer @ Swiggy",
    phone: "+91 98452 10934",
    email: "vikram.malhotra@swiggy.in",
    property_title: "BLOCK H, NERIST, JUBIN KA ROOM",
    property_location: "Nirjuli, Papum Pare, Arunachal Pradesh",
    property_image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80",
    room_type: "Single Studio Room",
    monthly_rent: 8000,
    rent_status: "Paid",
    rent_status_detail: "Paid on 1st Aug · UPI Auto-Debit",
    security_deposit: 16000,
    lease_start: "Feb 01, 2026",
    lease_end: "Jan 31, 2027",
    lease_duration_months: 11,
    kyc_status: "Verified",
    kyc_id_type: "Aadhaar Card",
    kyc_id_number: "XXXX-XXXX-8812",
    emergency_contact: {
      name: "Sunil Malhotra",
      relationship: "Father",
      phone: "+91 98450 11990",
    },
    agreement_id: "ZILLA-AGR-2026-BLK88",
  },
  {
    id: "tenant-2",
    name: "Ananya Deshmukh",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80",
    profession: "UX Design Lead @ Flipkart",
    phone: "+91 98204 55912",
    email: "ananya.d@flipkart.com",
    property_title: "Cozy Fuzz",
    property_location: "Nirjuli, Papum Pare",
    property_image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=400&q=80",
    room_type: "2 BHK Master Suite",
    monthly_rent: 10000,
    rent_status: "Paid",
    rent_status_detail: "Paid on 2nd Aug · Bank Transfer",
    security_deposit: 20000,
    lease_start: "Mar 01, 2026",
    lease_end: "Feb 28, 2027",
    lease_duration_months: 12,
    kyc_status: "Verified",
    kyc_id_type: "Passport & Bio-KYC",
    kyc_id_number: "PASS-Z7894210",
    emergency_contact: {
      name: "Meera Deshmukh",
      relationship: "Mother",
      phone: "+91 98200 44102",
    },
    agreement_id: "ZILLA-AGR-2026-COZ99",
  },
  {
    id: "tenant-3",
    name: "Rohit Talukdar",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80",
    profession: "Research Scholar @ IIT Guwahati",
    phone: "+91 94350 88231",
    email: "rohit.talukdar@gmail.com",
    property_title: "Zax room",
    property_location: "Guwahati, Beltola, Assam",
    property_image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=400&q=80",
    room_type: "1 BHK Private Flat",
    monthly_rent: 10000,
    rent_status: "Overdue",
    rent_status_detail: "Due: 4 Days Late · Pending ₹10,000",
    security_deposit: 20000,
    lease_start: "Nov 01, 2025",
    lease_end: "Oct 31, 2026",
    lease_duration_months: 12,
    kyc_status: "Verified",
    kyc_id_type: "Aadhaar & PAN Card",
    kyc_id_number: "XXXX-XXXX-4309",
    emergency_contact: {
      name: "Biren Talukdar",
      relationship: "Guardian",
      phone: "+91 94350 11002",
    },
    agreement_id: "ZILLA-AGR-2025-ZAX43",
  },
  {
    id: "tenant-4",
    name: "Priya Nair",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80",
    profession: "Cloud Consultant @ Microsoft",
    phone: "+91 97421 66890",
    email: "priya.nair@microsoft.com",
    property_title: "Brahmaputra Rooms",
    property_location: "Nirjuli, Itanagar, Arunachal Pradesh",
    property_image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80",
    room_type: "Shared Executive Room",
    monthly_rent: 7000,
    rent_status: "Due Soon",
    rent_status_detail: "Due in 3 Days (1st Sep) · ₹7,000",
    security_deposit: 14000,
    lease_start: "Jan 15, 2026",
    lease_end: "Dec 31, 2026",
    lease_duration_months: 11,
    kyc_status: "Verified",
    kyc_id_type: "Corporate ID & Aadhaar",
    kyc_id_number: "XXXX-XXXX-1928",
    emergency_contact: {
      name: "Radhika Nair",
      relationship: "Sister",
      phone: "+91 97420 88123",
    },
    agreement_id: "ZILLA-AGR-2026-BRH12",
  },
];

const AMENITY_OPTIONS = [
  { label: "WiFi", icon: Wifi },
  { label: "AC", icon: Wind },
  { label: "Geyser", icon: Flame },
  { label: "Parking", icon: Car },
  { label: "Power Backup", icon: BatteryCharging },
  { label: "RO Water", icon: Droplets },
];

const PG_HOSTEL_AMENITY_OPTIONS = [
  { label: "Food / Mess Included", icon: Utensils },
  { label: "Laundry Service", icon: Shirt },
  { label: "Daily Housekeeping", icon: Sparkles },
  { label: "Strict Security / Warden", icon: ShieldAlert },
];

const PROPERTY_TYPE_OPTIONS = [
  { label: "Rental Room", value: "rental_room" },
  { label: "Flat / Apartment", value: "flat" },
  { label: "PG", value: "pg" },
  { label: "Hostel", value: "hostel" },
];

const ROOM_TYPE_OPTIONS = [
  { label: "Single Room", value: "single" },
  { label: "Shared Room", value: "shared" },
  { label: "1 BHK", value: "1bhk" },
  { label: "2 BHK", value: "2bhk" },
];

const FURNISHING_OPTIONS = [
  { label: "Fully Furnished", value: "fully_furnished" },
  { label: "Semi-Furnished", value: "semi_furnished" },
  { label: "Unfurnished", value: "unfurnished" },
];

export default function OwnerDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("Active Listings");
  const [listings, setListings] = useState<OwnerListing[]>([]);
  const [visitRequests, setVisitRequests] = useState<VisitRequest[]>([]);
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [isLoadingVisits, setIsLoadingVisits] = useState(true);
  const [goldenKeyModalOpen, setGoldenKeyModalOpen] = useState(false);
  const [goldenKeyCode, setGoldenKeyCode] = useState("");
  const [keySubmitting, setKeySubmitting] = useState(false);
  const [keySuccess, setKeySuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info" = "success") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3500);
    },
    []
  );

  const pendingVisitCount = visitRequests.filter((r) => r.status === "Pending").length;

  const DASHBOARD_TABS: TabItem[] = [
    {
      id: "Add Property",
      label: "Add Property",
      icon: PlusCircle,
      badge: "Create",
    },
    {
      id: "Active Listings",
      label: "Active Listings",
      icon: Building,
      count: listings.length,
    },
    {
      id: "Visit Requests",
      label: "Visit Requests",
      icon: Bell,
      count: visitRequests.length,
      badge: pendingVisitCount > 0 ? `${pendingVisitCount} New` : undefined,
    },
    {
      id: "Rented & Tenants",
      label: "Rented & Tenants",
      icon: Users,
      count: tenants.length,
    },
  ];

  // ── 1. Fetch Supabase Listings ──────────────────────────────────────────────
  const loadDbListings = useCallback(async () => {
    try {
      setIsLoadingListings(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setListings([]);
        return;
      }
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        const dbListings: OwnerListing[] = data.map((item) => ({
          id: item.id,
          title: item.title || "Untitled Property",
          price: item.price || 0,
          deposit: item.deposit ?? (item.price ? item.price * 2 : 0),
          location: item.location || "Bangalore",
          description: item.description || "",
          image_url:
            item.image_url ||
            (item.image_urls && item.image_urls[0]) ||
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
          image_urls: item.image_urls || (item.image_url ? [item.image_url] : []),
          status: item.status === "inactive" ? "Occupied" : "Active",
          property_type: item.property_type || "Rental Room",
          room_type: item.room_type || "Single Room",
          furnishing: item.furnishing || "Furnished",
          amenities: item.amenities || ["WiFi", "Power Backup", "Geyser"],
          views: 0,
          inquiries: 0,
          created_at: "Recently",
        }));
        setListings(dbListings);
      } else {
        setListings([]);
      }
    } catch (err) {
      console.warn("Failed to fetch listings:", err);
      setListings([]);
    } finally {
      setIsLoadingListings(false);
    }
  }, []);

  // ── 2. Fetch Live Supabase Visit Requests & Bookings ────────────────────────
  const fetchLiveVisitRequests = useCallback(async () => {
    setIsLoadingVisits(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setVisitRequests([]);
        return;
      }

      // Fetch live visit requests via server action (joins bookings, rooms, seeker_profiles)
      const res = await getOwnerVisitRequests(user.id);

      if (!res.success) {
        console.error("[OwnerDashboard] Error fetching visit requests from Supabase:", res.error);
        showToast("Could not load latest visit requests from server.", "error");
        setVisitRequests([]);
        return;
      }

      const bookingsData = res.data;
      if (!bookingsData || bookingsData.length === 0) {
        setVisitRequests([]);
        return;
      }

      // Ensure visit requests ONLY show pending or visit_scheduled/confirmed
      const activeVisitBookings = bookingsData.filter((b: any) => 
        b.status === "pending" || b.status === "visit_scheduled" || b.status === "confirmed" || b.status === "completed" || b.status === "cancelled" || b.status === "declined" || b.status === "expired"
      ).filter((b: any) => 
        b.status !== "locked_awaiting_docs" && b.status !== "active_tenant" && b.status !== "rented"
      );

      const mappedRequests: VisitRequest[] = activeVisitBookings.map((b: any) => {
        const room = Array.isArray(b.rooms) ? b.rooms[0] : b.rooms;
        const seeker = Array.isArray(b.seeker_profiles) ? b.seeker_profiles[0] : b.seeker_profiles;

        const seekerName = b.tenant_name || seeker?.full_name || "Verified Seeker";
        const seekerAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(
          seekerName
        )}`;

        const seekerProfession = seeker?.work_style
          ? `${seeker.work_style} · ${seeker.vibe || "Verified Seeker"}`
          : "Verified Room Seeker";

        const propertyTitle = room?.title || "ZILLA Verified Property";
        const propertyLocation = room?.location || "Bangalore, India";
        const propertyPrice = room?.price || 0;
        const propertyImage =
          room?.image_url ||
          (room?.image_urls && room?.image_urls[0]) ||
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80";

        const isLocked = Boolean(b.is_premium);
        const paidDepositAmount =
          isLocked && room?.deposit
            ? Math.round(room.deposit * 0.1)
            : isLocked
            ? Math.round(propertyPrice * 0.1)
            : undefined;

        const slot1 = formatSlotDate(b.priority_date_1, "11:00 AM - 12:00 PM");
        const slot2 = formatSlotDate(b.priority_date_2, "04:30 PM - 05:30 PM");

        const statusCapitalized =
          b.status === "visit_scheduled" || b.status === "confirmed" || b.status === "completed"
            ? "Confirmed"
            : b.status === "cancelled" || b.status === "declined" || b.status === "expired"
            ? "Declined"
            : "Pending";

        const createdTimeAgo = b.created_at
          ? formatTimeAgo(new Date(b.created_at))
          : "Recently";

        return {
          id: b.id,
          seeker_name: seekerName,
          seeker_avatar: seekerAvatar,
          seeker_profession: seekerProfession,
          seeker_phone: b.tenant_phone || seeker?.phone || "+91 98450 00000",
          property_title: propertyTitle,
          property_location: propertyLocation,
          property_price: propertyPrice,
          property_image: propertyImage,
          request_type: isLocked ? "Locked (10% Paid)" : "Free Visit",
          paid_deposit_amount: paidDepositAmount,
          priority_date_1: slot1,
          priority_date_2: slot2,
          selected_date_idx: 1,
          status: statusCapitalized as "Pending" | "Confirmed" | "Declined",
          visit_time: b.visit_time,
          seeker_message: isLocked
            ? "10% Security Deposit pre-paid to lock the visit and prioritize walkthrough."
            : "Interested in scheduling an in-person tour of the room.",
          created_at: createdTimeAgo,
        };
      });

      setVisitRequests(mappedRequests);

      // Extract tenants (bookings that are locked awaiting docs or active tenants)
      const tenantBookings = bookingsData.filter((b: any) => 
        b.status === "locked_awaiting_docs" || b.status === "active_tenant"
      );

      const mappedTenants: TenantRecord[] = tenantBookings.map((b: any) => {
        const room = Array.isArray(b.rooms) ? b.rooms[0] : b.rooms;
        const seeker = Array.isArray(b.seeker_profiles) ? b.seeker_profiles[0] : b.seeker_profiles;

        const seekerName = b.tenant_name || seeker?.full_name || "Verified Seeker";
        const seekerAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seekerName)}`;

        return {
          id: b.id,
          name: seekerName,
          avatar: seekerAvatar,
          profession: seeker?.work_style || "Verified Professional",
          phone: b.tenant_phone || seeker?.phone || "Awaiting Contact Info",
          email: seeker?.email || "N/A",
          property_title: room?.title || "ZILLA Verified Property",
          property_location: room?.location || "Bangalore, India",
          property_image: room?.image_url || room?.image_urls?.[0] || "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=400&q=80",
          room_type: room?.room_type || "Private Room",
          monthly_rent: room?.price || 0,
          rent_status: "Paid",
          rent_status_detail: "Security Deposit Vaulted",
          security_deposit: room?.deposit || (room?.price ? room.price * 2 : 0),
          lease_start: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
          lease_end: "TBD",
          lease_duration_months: 11,
          kyc_status: b.status === "locked_awaiting_docs" ? "Pending" : "Verified",
          kyc_details: {
            document_type: "Aadhaar / PAN (Required)",
          },
        };
      });

      setTenants(mappedTenants);
    } catch (err) {
      console.error("[OwnerDashboard] Unexpected error fetching visit requests:", err);
      showToast("Network error loading visit requests.", "error");
      setVisitRequests([]);
    } finally {
      setIsLoadingVisits(false);
    }
  }, [showToast]);

  useEffect(() => {
    let isMounted = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      await Promise.all([loadDbListings(), fetchLiveVisitRequests()]);

      // Supabase Realtime Data Sync Setup
      channel = supabase.channel('owner_dashboard_sync');

      channel
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rooms' },
          (payload) => {
            // Strict client-side isolation check
            const payloadUserId = (payload.new as any)?.user_id || (payload.old as any)?.user_id;
            if (payloadUserId && payloadUserId !== user.id) return;
            
            // Re-fetch to apply changes mapping to local state smoothly
            loadDbListings();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'bookings' },
          (payload) => {
            // Refetch bookings to ensure we get joined relations (seeker_profiles, rooms). 
            // The server action getOwnerVisitRequests strictly filters by user.id.
            fetchLiveVisitRequests();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime sync established for owner dashboard.');
          }
        });
    };

    init();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadDbListings, fetchLiveVisitRequests]);

  const handleAddNewListing = (newListing: OwnerListing) => {
    setListings((prev) => [newListing, ...prev]);
    showToast("Property published successfully to Active Listings!");
    setActiveTab("Active Listings");
  };

  const handleDeleteListing = async (id: string) => {
    setListings((prev) => prev.filter((item) => item.id !== id));
    try {
      await supabase.from("rooms").delete().eq("id", id);
    } catch {
      // ignore
    }
    showToast("Property listing removed from Active Listings.");
  };

  const handleToggleStatus = (id: string) => {
    setListings((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newStatus = item.status === "Active" ? "Occupied" : "Active";
          showToast(`Status updated to "${newStatus}" for ${item.title}`);
          return { ...item, status: newStatus };
        }
        return item;
      })
    );
  };

  const handleConfirmVisitSchedule = async (
    requestId: string,
    selectedDate: { date: string; timeSlot: string }
  ) => {
    // Optimistic state update
    setVisitRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return { ...req, status: "Confirmed" };
        }
        return req;
      })
    );

    try {
      const visitDateStr = `${selectedDate.date} ${selectedDate.timeSlot}`;
      await updateBookingStatus(requestId, "visit_scheduled", visitDateStr);
    } catch (err) {
      console.warn("Could not sync confirmation to Supabase:", err);
    }

    showToast(
      `Visit scheduled for ${selectedDate.date} (${selectedDate.timeSlot})! Notification sent to seeker.`
    );
  };

  const handleDeclineVisit = async (requestId: string) => {
    // Optimistic state update
    setVisitRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return { ...req, status: "Declined" };
        }
        return req;
      })
    );

    try {
      await updateBookingStatus(requestId, "declined");
    } catch (err) {
      console.warn("Could not sync decline to Supabase:", err);
    }

    showToast("Visit request declined. Seeker notified.");
  };

  const handleSelectPriorityDate = (requestId: string, dateIdx: 1 | 2) => {
    setVisitRequests((prev) =>
      prev.map((req) => {
        if (req.id === requestId) {
          return { ...req, selected_date_idx: dateIdx };
        }
        return req;
      })
    );
  };

  const handleSyncGoldenKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goldenKeyCode.trim()) return;
    setKeySubmitting(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setKeySubmitting(false);
      showToast("Unauthorized. Please log in.", "error");
      return;
    }

    const res = await verifyGoldenKey(goldenKeyCode, user.id);
    setKeySubmitting(false);

    if (res.success) {
      setKeySuccess(true);
      showToast("Room Locked! Awaiting tenant documents.", "success");
    } else {
      showToast(res.error || "Invalid code, please try again.", "error");
    }
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-body antialiased selection:bg-indigo-100 selection:text-indigo-900 pb-28 md:pb-16 transition-colors duration-200">
      {/* ── Top Navigation Bar ── */}
      <TopAppBar avatarUrl={AVATAR_URL} showSearch label="Owner Dashboard" />

      {/* ── Toast Notification Banner ── */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white font-headline text-xs font-semibold shadow-2xl flex items-center gap-2.5 animate-[fadeIn_0.15s_ease-out] border border-slate-800 dark:border-slate-700">
          {toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          ) : toast.type === "info" ? (
            <Info className="w-4 h-4 text-indigo-400" />
          ) : (
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Main Dashboard Workspace ── */}
      <main className="flex-grow pt-24 md:pt-28 px-4 sm:px-6 lg:px-10 max-w-7xl mx-auto w-full flex flex-col gap-6">
        
        {/* ── Header Bar with Segmented Tab Navigation & Golden Key Trigger ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                Owner Portal
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">· Real-time PropTech Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-slate-900 dark:text-slate-100 mt-1">
              Property Command Center
            </h1>
          </div>

          {/* ── Golden Key Primary Action Button ── */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setGoldenKeyModalOpen(true)}
              className="group relative inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 text-white font-headline text-sm font-semibold tracking-wide shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.02] active:scale-[0.98] border border-indigo-400/30 transition-all duration-200 cursor-pointer overflow-hidden"
              aria-label="Enter Golden Key"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
              <div className="w-6 h-6 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-amber-300 group-hover:rotate-12 transition-transform duration-200">
                <Key className="w-3.5 h-3.5 fill-current" />
              </div>
              <span className="flex items-center gap-1.5">
                <span>🔑 Enter Golden Key</span>
              </span>
              <span className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white rounded-md">
                Sync
              </span>
            </button>
          </div>
        </div>

        {/* ── Horizontal Sleek Segmented Control Tab Bar ── */}
        <div className="sticky top-20 z-30 py-2 -mx-4 px-4 sm:mx-0 sm:px-0 bg-[#f8fafc]/90 dark:bg-slate-950/90 backdrop-blur-md">
          <div className="bg-slate-200/70 dark:bg-slate-900/80 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {DASHBOARD_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-max flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl font-headline text-sm font-semibold transition-all duration-200 cursor-pointer select-none ${
                    isActive
                      ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-[0_2px_10px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_10px_rgba(0,0,0,0.4)] ring-1 ring-slate-950/5 dark:ring-white/10 scale-[1.01]"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-slate-800/60"
                  }`}
                  role="tab"
                  aria-selected={isActive}
                >
                  <Icon
                    className={`w-4 h-4 transition-colors duration-200 ${
                      isActive ? "text-indigo-600 dark:text-indigo-400 stroke-[2.5]" : "text-slate-500 dark:text-slate-400 stroke-[2]"
                    }`}
                  />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-700/60"
                          : "bg-slate-300/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                  {tab.badge && (
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? "bg-indigo-600 text-white"
                          : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Dynamic Tab Content Area with Smooth State Transitions ── */}
        <div className="w-full transition-all duration-300 ease-out min-h-[500px]">
          {activeTab === "Add Property" && (
            <AddPropertyView
              onListingCreated={handleAddNewListing}
              onSwitchTab={setActiveTab}
              onShowToast={showToast}
            />
          )}
          {activeTab === "Active Listings" && (
            <ActiveListingsView
              listings={listings}
              visitRequests={visitRequests}
              isLoading={isLoadingListings}
              onSwitchTab={setActiveTab}
              onDelete={handleDeleteListing}
              onToggleStatus={handleToggleStatus}
              onShowToast={showToast}
            />
          )}
          {activeTab === "Visit Requests" && (
            <VisitRequestsView
              requests={visitRequests}
              isLoading={isLoadingVisits}
              onRefresh={fetchLiveVisitRequests}
              onSelectDate={handleSelectPriorityDate}
              onConfirmSchedule={handleConfirmVisitSchedule}
              onDecline={handleDeclineVisit}
              onSwitchTab={setActiveTab}
              onShowToast={showToast}
            />
          )}
          {activeTab === "Rented & Tenants" && (
            <TenantVaultView
              tenants={tenants}
              onOpenGoldenKey={() => setGoldenKeyModalOpen(true)}
              onSwitchTab={setActiveTab}
              onShowToast={showToast}
              onUpdateTenantRentStatus={(tenantId, status) => {
                setTenants((prev) =>
                  prev.map((t) =>
                    t.id === tenantId
                      ? {
                          ...t,
                          rent_status: status,
                          rent_status_detail:
                            status === "Paid"
                              ? "Paid · Manual Cash Record"
                              : t.rent_status_detail,
                        }
                      : t
                  )
                );
              }}
            />
          )}
        </div>
      </main>

      {/* ── Offline-to-Online Golden Key Modal ── */}
      {goldenKeyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setGoldenKeyModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden animate-[slideUp_0.25s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top decorative accent */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-800" />
            
            <button
              onClick={() => setGoldenKeyModalOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                <Key className="w-6 h-6 fill-indigo-600/20 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/50">
                  Offline-to-Online Sync
                </span>
                <h3 className="text-xl font-bold font-headline text-slate-900 dark:text-slate-100 mt-1">
                  Enter Golden Key
                </h3>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
              Pair an offline physical lease, digital voucher, or direct tenant handshake instantly with your ZILLA dashboard. This triggers automatic KYC verification, digital rent tracking, and verified tenant onboarding.
            </p>

            {keySuccess ? (
              <div className="p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center text-center gap-4 animate-[fadeIn_0.2s_ease-out]">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mt-2">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h4 className="font-bold font-headline text-emerald-900 dark:text-emerald-200 text-base">Golden Key Verified!</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">Tenant verification and digital lease synced successfully.</p>
                </div>
                <button
                  onClick={() => {
                    setKeySuccess(false);
                    setGoldenKeyModalOpen(false);
                    setGoldenKeyCode("");
                    setActiveTab("Rented & Tenants");
                  }}
                  className="mt-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-headline text-sm font-semibold shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSyncGoldenKey} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 items-center">
                  <label htmlFor="goldenKeyInput" className="text-sm font-semibold font-headline text-slate-700 dark:text-slate-300 text-center w-full mt-2">
                    Enter the 4-digit Secure Code provided by the tenant
                  </label>
                  <div className="relative mt-4 mb-2">
                    <input
                      id="goldenKeyInput"
                      type="text"
                      maxLength={4}
                      placeholder="----"
                      value={goldenKeyCode}
                      onChange={(e) => setGoldenKeyCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-48 text-center bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-2xl px-4 py-4 text-4xl font-mono font-bold tracking-[0.5em] indent-[0.25em] text-indigo-700 dark:text-indigo-400 placeholder:text-slate-300 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 focus:outline-none transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-100 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Encrypted handshake: Verifies biometric KYC, connects UPI auto-debit, and vaults security deposit on chain/escrow.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setGoldenKeyModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-sm transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={goldenKeyCode.length < 4 || keySubmitting}
                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-headline text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    {keySubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying…</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Lock Room</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom Navigation ── */}
      <BottomNav activeTab="Profile" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. ADD PROPERTY FORM VIEW (INJECTED FULL POST-ROOM WORKFLOW)
// ─────────────────────────────────────────────────────────────────────────────
function AddPropertyView({
  onListingCreated,
  onSwitchTab,
  onShowToast,
}: {
  onListingCreated: (listing: OwnerListing) => void;
  onSwitchTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}) {
  // ── Core Form Fields ───────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  // ── Property & Room Details ───────────────────────────────────────────
  const [propertyType, setPropertyType] = useState("rental_room");
  const [roomType, setRoomType] = useState("single");
  const [washroom, setWashroom] = useState("Attached");
  const [furnishing, setFurnishing] = useState("fully_furnished");

  // ── Amenities ─────────────────────────────────────────────────────────
  const [amenities, setAmenities] = useState<string[]>(["WiFi", "Geyser"]);
  const [customDetails, setCustomDetails] = useState("");

  // ── House Rules & Preferences ─────────────────────────────────────────
  const [food, setFood] = useState("Any");
  const [smoking, setSmoking] = useState("Not Allowed");
  const [drinking, setDrinking] = useState("Not Allowed");
  const [preferredTenant, setPreferredTenant] = useState("Anyone");
  const [curfew, setCurfew] = useState("No Curfew");

  // ── Map / Location Picker ─────────────────────────────────────────────
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // ── Photos ────────────────────────────────────────────────────────────
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const toggleAmenity = (label: string) => {
    setAmenities((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  };

  // ── Geolocation ───────────────────────────────────────────────────────
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      onShowToast("Geolocation is not supported by your browser.");
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setIsDetectingLocation(false);
        onShowToast("Location coordinates pinned from GPS!");
      },
      () => {
        setIsDetectingLocation(false);
        onShowToast("Unable to detect location. Please click on the map to pin.");
      }
    );
  };

  // ── Photo Selection ───────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newFiles = [...selectedFiles, ...files].slice(0, 8);
    const newUrls = newFiles.map((f, i) =>
      i < selectedFiles.length ? previewUrls[i] : URL.createObjectURL(f)
    );
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Publish Form Submission ───────────────────────────────────────────
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      onShowToast("Please provide a property title.");
      return;
    }
    if (!price || isNaN(Number(price))) {
      onShowToast("Please enter a valid monthly rent.");
      return;
    }
    if (!location.trim()) {
      onShowToast("Please enter the property location/area.");
      return;
    }

    setIsPublishing(true);
    try {
      let sessionId = typeof window !== "undefined" ? localStorage.getItem("zilla_session_id") : null;
      if (!sessionId) {
        sessionId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "demo-owner-session";
        if (typeof window !== "undefined") localStorage.setItem("zilla_session_id", sessionId);
      }

      // Upload photos to Supabase Storage if available
      const uploadedImageUrls: string[] = [];
      for (const file of selectedFiles) {
        try {
          const fileExt = file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("room-images")
            .upload(fileName, file, { cacheControl: "3600", upsert: false });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from("room-images").getPublicUrl(fileName);
            uploadedImageUrls.push(urlData.publicUrl);
          }
        } catch {
          // ignore upload fallback
        }
      }

      const defaultCover =
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80";
      const finalCoverUrl =
        uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : defaultCover;

      const rulesPayload: Record<string, string> = {
        food,
        smoking,
        drinking,
        preferred_tenant: preferredTenant,
        curfew,
      };
      if ((propertyType === "pg" || propertyType === "hostel") && customDetails.trim()) {
        rulesPayload.custom_details = customDetails.trim();
      }

      // Auto-geocode location text if the owner didn't pin on the map or use GPS
      let finalLat = latitude;
      let finalLng = longitude;
      if ((finalLat == null || finalLng == null) && location.trim()) {
        try {
          const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location.trim())}&limit=1`;
          const geoRes = await fetch(geoUrl, {
            headers: { "Accept-Language": "en", "User-Agent": "ZillaApp/1.0" },
          });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            if (geoData.length > 0) {
              const parsedLat = parseFloat(geoData[0].lat);
              const parsedLng = parseFloat(geoData[0].lon);
              if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
                finalLat = parsedLat;
                finalLng = parsedLng;
              }
            }
          }
        } catch {
          // Graceful fallback: keep null if geocoding fails
        }
      }

      const roomPayload = {
        user_id: sessionId,
        title: title.trim(),
        price: parseInt(price),
        deposit: deposit ? parseInt(deposit) : parseInt(price) * 2,
        location: location.trim(),
        description: description.trim(),
        image_url: finalCoverUrl,
        image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : [finalCoverUrl],
        status: "active",
        property_type: propertyType || "rental_room",
        room_type: roomType || "single",
        washroom,
        furnishing: furnishing || "fully_furnished",
        amenities: amenities.length > 0 ? amenities : null,
        rules: rulesPayload,
        latitude: finalLat ?? null,
        longitude: finalLng ?? null,
      };

      try {
        await supabase.from("rooms").insert(roomPayload);
      } catch (err) {
        console.warn("Supabase insert fallback:", err);
      }

      const propertyLabelMap: Record<string, string> = {
        rental_room: "Rental Room",
        flat: "Flat / Apartment",
        pg: "PG / Co-Living",
        hostel: "Hostel",
      };

      const newListingObj: OwnerListing = {
        id: `prop-${Date.now()}`,
        title: title.trim(),
        price: parseInt(price),
        deposit: deposit ? parseInt(deposit) : parseInt(price) * 2,
        location: location.trim(),
        description: description.trim(),
        image_url: finalCoverUrl,
        status: "Active",
        property_type: propertyLabelMap[propertyType] || "Rental Room",
        room_type: roomType.toUpperCase(),
        furnishing: furnishing.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        amenities: amenities,
        views: 1,
        inquiries: 0,
        created_at: "Just now",
      };

      onListingCreated(newListingObj);
    } catch (err) {
      onShowToast(err instanceof Error ? err.message : "Error publishing listing.");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6 transition-all animate-[fadeIn_0.2s_ease-out]">
      {/* ── Header Bar ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold font-headline text-slate-900">
              List a New Property
            </h2>
            <p className="text-sm text-slate-500 font-body mt-0.5">
              Fill in the property details, amenities, location, and photos to publish live on ZILLA.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSwitchTab("Active Listings")}
          className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 px-4 py-2.5 rounded-xl border border-indigo-100 self-start sm:self-auto cursor-pointer transition-colors"
        >
          <span>View Active Listings</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── The Multi-Card Form Grid ── */}
      <form onSubmit={handlePublish} className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* ══ Left Column: Information, Specs & Rules ══ */}
        <div className="w-full lg:w-7/12 flex flex-col gap-6">
          
          {/* Card 1: Basic Information */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-5">
            <SectionHeader
              icon={Info}
              title="Basic Information"
              subtitle="Title, monthly rent, deposit & neighborhood"
            />

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="room-title" className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                Property / Room Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="room-title"
                type="text"
                required
                placeholder="e.g. Spacious 2BHK with Balcony near Metro"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
              />
            </div>

            {/* Price + Deposit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="price" className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Rent / Month (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                  <input
                    id="price"
                    type="number"
                    required
                    placeholder="25,000"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="deposit" className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Security Deposit (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">₹</span>
                  <input
                    id="deposit"
                    type="number"
                    placeholder="50,000"
                    value={deposit}
                    onChange={(e) => setDeposit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Location Area */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="location" className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                Locality / Area <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="location"
                  type="text"
                  required
                  placeholder="e.g. Indiranagar 100ft Road, Bangalore"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="description" className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                Description & Highlights
              </label>
              <textarea
                id="description"
                rows={3}
                placeholder="Describe key highlights (natural sunlight, proximity to metro, peaceful neighborhood, modular kitchen)…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all resize-none"
              />
            </div>
          </div>

          {/* Card 2: Property & Room Configuration */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-5">
            <SectionHeader
              icon={Building}
              title="Property Configuration"
              subtitle="Category, layout & furnishing tier"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Property Type
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all cursor-pointer font-medium"
                >
                  {PROPERTY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Room Configuration
                </label>
                <select
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all cursor-pointer font-medium"
                >
                  {ROOM_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Washroom Type
                </label>
                <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
                  {["Attached", "Shared"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWashroom(opt)}
                      className={`flex-1 py-2 text-xs font-headline font-semibold rounded-lg transition-all cursor-pointer ${
                        washroom === opt
                          ? "bg-white text-indigo-700 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Furnishing
                </label>
                <select
                  value={furnishing}
                  onChange={(e) => setFurnishing(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all cursor-pointer font-medium"
                >
                  {FURNISHING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Card 3: Amenities Selection */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-5">
            <SectionHeader
              icon={Sparkle}
              title="Amenities & Utilities"
              subtitle="Select all verified features included in the stay"
            />

            <div className="flex flex-wrap gap-2.5">
              {AMENITY_OPTIONS.map((a) => {
                const IconComponent = a.icon;
                const active = amenities.includes(a.label);
                return (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => toggleAmenity(a.label)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-headline font-semibold transition-all duration-150 cursor-pointer border ${
                      active
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm scale-[1.02]"
                        : "bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100"
                    }`}
                  >
                    <IconComponent className="w-3.5 h-3.5" />
                    <span>{a.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Conditional PG / Hostel Features */}
            {(propertyType === "pg" || propertyType === "hostel") && (
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-3 animate-[fadeIn_0.2s_ease-out]">
                <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                  PG / Hostel Specific Services
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {PG_HOSTEL_AMENITY_OPTIONS.map((a) => {
                    const IconComponent = a.icon;
                    const active = amenities.includes(a.label);
                    return (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => toggleAmenity(a.label)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-headline font-semibold transition-all duration-150 cursor-pointer border ${
                          active
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm scale-[1.02]"
                            : "bg-indigo-50/50 text-indigo-900 border-indigo-100 hover:bg-indigo-50"
                        }`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                        <span>{a.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Mess / Meal Timings or Warden Rules
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Breakfast 8-10 AM, Dinner 8-10 PM. Gate closes 10:30 PM."
                    value={customDetails}
                    onChange={(e) => setCustomDetails(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Card 4: House Rules & Tenant Compatibility */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-5">
            <SectionHeader
              icon={ShieldCheck}
              title="House Rules & Guidelines"
              subtitle="Set clear expectations for peaceful co-living"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Food Habit
                </label>
                <select
                  value={food}
                  onChange={(e) => setFood(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Any">Any (Veg / Non-Veg)</option>
                  <option value="Veg Only">Veg Only</option>
                  <option value="Non-Veg Allowed">Non-Veg Allowed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Smoking
                </label>
                <select
                  value={smoking}
                  onChange={(e) => setSmoking(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Not Allowed">Not Allowed</option>
                  <option value="Allowed (Balcony)">Allowed (Balcony)</option>
                  <option value="Allowed">Allowed</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Drinking
                </label>
                <select
                  value={drinking}
                  onChange={(e) => setDrinking(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="Not Allowed">Not Allowed</option>
                  <option value="Allowed Responsibly">Allowed Responsibly</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Preferred Tenant
                </label>
                <select
                  value={preferredTenant}
                  onChange={(e) => setPreferredTenant(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer font-medium"
                >
                  <option value="Anyone">Anyone (Open to all)</option>
                  <option value="Working Professionals">Working Professionals</option>
                  <option value="Students">Students Only</option>
                  <option value="Female Only">Female Seekers Only</option>
                  <option value="Male Only">Male Seekers Only</option>
                  <option value="Family">Families</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-headline font-semibold text-slate-700 uppercase tracking-wider">
                  Curfew / Gate Closing
                </label>
                <select
                  value={curfew}
                  onChange={(e) => setCurfew(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer font-medium"
                >
                  <option value="No Curfew">No Curfew (24/7 Access)</option>
                  <option value="10:00 PM">10:00 PM</option>
                  <option value="10:30 PM">10:30 PM</option>
                  <option value="11:00 PM">11:00 PM</option>
                  <option value="11:30 PM">11:30 PM</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ══ Right Column: Map Location, Photos & Publish Action ══ */}
        <div className="w-full lg:w-5/12 flex flex-col gap-6 lg:sticky lg:top-36">
          
          {/* Card 5: Interactive Map Picker */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionHeader
                icon={Navigation}
                title="Pin Your Location"
                subtitle="Click map or detect via GPS"
              />
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 flex-shrink-0"
              >
                {isDetectingLocation ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5" />
                )}
                <span>{isDetectingLocation ? "Detecting…" : "Auto Detect"}</span>
              </button>
            </div>

            <div className="w-full h-56 rounded-2xl overflow-hidden border border-slate-200 relative">
              <MapPicker
                lat={latitude}
                lng={longitude}
                onLocationChange={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
              />
            </div>

            {latitude !== null && longitude !== null ? (
              <div className="flex items-center gap-2 text-xs text-indigo-700 font-mono bg-indigo-50/70 rounded-xl px-3.5 py-2 border border-indigo-100">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  Pinned: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 italic">
                * Click on the map to pinpoint your building for seeker navigation.
              </p>
            )}
          </div>

          {/* Card 6: Photo Uploads */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionHeader
                icon={ImageIcon}
                title="Property Photos"
                subtitle="Up to 8 photos (first is cover image)"
              />
              {selectedFiles.length > 0 && (
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  {selectedFiles.length}/8
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {previewUrls.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {previewUrls.map((url, idx) => (
                  <div
                    key={url}
                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 group/thumb"
                  >
                    <Image
                      src={url}
                      alt={`Upload ${idx + 1}`}
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {idx === 0 && (
                      <div className="absolute bottom-1 left-1 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                        Cover
                      </div>
                    )}
                  </div>
                ))}
                {previewUrls.length < 8 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/50 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span className="text-[10px] font-semibold">Add</span>
                  </button>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-indigo-200 hover:border-indigo-400 rounded-2xl bg-indigo-50/30 hover:bg-indigo-50/60 p-7 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-xs sm:text-sm font-bold font-headline text-slate-800">
                    Click to browse photos
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    PNG, JPG or WebP (Up to 8 photos)
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Publish CTA Button ── */}
          <button
            type="submit"
            disabled={isPublishing}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white font-headline text-sm font-bold tracking-wide shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2.5"
          >
            {isPublishing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Publishing Listing to ZILLA…</span>
              </>
            ) : (
              <>
                <span>Publish Listing Live</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Header Helper Sub-component ─────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <h3 className="text-sm font-bold font-headline text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 font-body">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ACTIVE LISTINGS VIEW (INJECTED GRID + 3 SUMMARY METRIC HEADERS)
// ─────────────────────────────────────────────────────────────────────────────
function ActiveListingsView({
  listings,
  visitRequests,
  isLoading,
  onSwitchTab,
  onDelete,
  onToggleStatus,
  onShowToast,
}: {
  listings: OwnerListing[];
  visitRequests: VisitRequest[];
  isLoading: boolean;
  onSwitchTab: (tab: TabType) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
  onShowToast: (msg: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("All");
  const [selectedProperty, setSelectedProperty] = useState<OwnerListing | null>(null);

  // Compute live metrics dynamically from the active listings dataset
  const activeCount = listings.filter((l) => l.status === "Active").length;
  const totalMonthlyPotential = listings
    .filter((l) => l.status === "Active")
    .reduce((sum, l) => sum + (l.price || 0), 0);
  const totalInquiries = visitRequests.length;

  // Filter listings based on search & category
  const filteredListings = useMemo(() => {
    return listings.filter((room) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        room.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.property_type.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (selectedFilter === "All") return true;
      if (selectedFilter === "Flats") return room.property_type.toLowerCase().includes("flat");
      if (selectedFilter === "Rooms") return room.property_type.toLowerCase().includes("room");
      if (selectedFilter === "PG")
        return (
          room.property_type.toLowerCase().includes("pg") ||
          room.property_type.toLowerCase().includes("hostel")
        );
      return true;
    });
  }, [listings, searchQuery, selectedFilter]);

  const handleCopyLink = (title: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      onShowToast(`Shareable link copied for "${title}"`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-[0_10px_30px_rgba(70,72,212,0.04)] border border-slate-100 dark:border-slate-800 flex flex-col gap-8 transition-all animate-[fadeIn_0.2s_ease-out]">
      {/* ── Header Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <Building className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold font-headline text-slate-900 dark:text-slate-100">
                Active Listings
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/60">
                {activeCount} Live Units
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-body mt-0.5">
              Live inventory visible to seekers. Manage rates, availability, and media.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => onSwitchTab("Add Property")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-headline text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post New Room</span>
          </button>
        </div>
      </div>

      {/* ── 3 Intact Summary Metric Headers ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Listings
          </span>
          <span className="text-2xl font-bold font-headline text-slate-900 dark:text-slate-100">
            {listings.length} {listings.length === 1 ? "Property" : "Properties"}
          </span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            100% Verified status
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Monthly Potential
          </span>
          <span className="text-2xl font-bold font-headline text-indigo-600 dark:text-indigo-400">
            ₹{totalMonthlyPotential.toLocaleString("en-IN")}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Across all live units</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Inquiries
          </span>
          <span className="text-2xl font-bold font-headline text-slate-900 dark:text-slate-100">
            {totalInquiries} Leads · {activeCount} Active Units
          </span>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
            Real-time interest index
          </span>
        </div>
      </div>

      {/* ── Search & Filter Controls Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, location, or type…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
          {["All", "Flats", "Rooms", "PG"].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-headline font-semibold transition-all cursor-pointer whitespace-nowrap ${
                selectedFilter === filter
                  ? "bg-slate-900 dark:bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* ── Injected Active Listings Property Cards Grid ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Loading your active listings…</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Building className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold font-headline text-slate-800 dark:text-slate-200">
            No listings found
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            {searchQuery
              ? `No property matches "${searchQuery}". Try changing your search keywords.`
              : "You do not have any active properties yet. Post your first room to get started."}
          </p>
          <button
            onClick={() => onSwitchTab("Add Property")}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-headline text-xs font-semibold hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Post a Room Now</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onQuickView={() => setSelectedProperty(property)}
              onDelete={() => onDelete(property.id)}
              onToggleStatus={() => onToggleStatus(property.id)}
              onCopyLink={() => handleCopyLink(property.title)}
            />
          ))}
        </div>
      )}

      {/* ── Quick View Detail Modal ── */}
      {selectedProperty && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
          onClick={() => setSelectedProperty(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 relative animate-[slideUp_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedProperty(null)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-900/60 text-white hover:bg-slate-900 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative h-64 w-full bg-slate-100 dark:bg-slate-800">
              <Image
                src={selectedProperty.image_url}
                alt={selectedProperty.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 672px"
              />
              <div className="absolute bottom-4 left-4 bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {selectedProperty.status} · {selectedProperty.property_type}
              </div>
            </div>

            <div className="p-6 sm:p-8 flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold font-headline text-slate-900 dark:text-slate-100">
                    {selectedProperty.title}
                  </h3>
                  <div className="text-xl font-bold font-headline text-indigo-600 dark:text-indigo-400">
                    ₹{selectedProperty.price.toLocaleString("en-IN")}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400 font-body">/mo</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {selectedProperty.location}
                </p>
              </div>

              {selectedProperty.description && (
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-body bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60">
                  {selectedProperty.description}
                </p>
              )}

              {/* Amenities */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Verified Amenities & Features
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedProperty.amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium"
                    >
                      ✓ {amenity}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  Security Deposit:{" "}
                  <strong className="text-slate-800">
                    ₹{selectedProperty.deposit.toLocaleString("en-IN")}
                  </strong>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onToggleStatus(selectedProperty.id);
                      setSelectedProperty((prev) =>
                        prev
                          ? { ...prev, status: prev.status === "Active" ? "Occupied" : "Active" }
                          : null
                      );
                    }}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Toggle {selectedProperty.status === "Active" ? "Occupied" : "Active"}
                  </button>
                  <button
                    onClick={() => {
                      handleCopyLink(selectedProperty.title);
                      setSelectedProperty(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Individual Property Card Component ─────────────────────────────────────
function PropertyCard({
  property,
  onQuickView,
  onDelete,
  onToggleStatus,
  onCopyLink,
}: {
  property: OwnerListing;
  onQuickView: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onCopyLink: () => void;
}) {
  const isOccupied = property.status === "Occupied";

  return (
    <div className="bg-surface-container-lowest rounded-2xl overflow-hidden flex flex-col border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-ambient hover:-translate-y-1 transition-all duration-300 group">
      {/* ── Image & Badges ── */}
      <div
        className="relative h-48 w-full overflow-hidden p-2 bg-slate-100 cursor-pointer"
        onClick={onQuickView}
      >
        <Image
          src={property.image_url}
          alt={property.title}
          fill
          className="object-cover rounded-xl group-hover:scale-105 transition-transform duration-700 ease-out"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 z-10">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/90 backdrop-blur-md text-slate-800 shadow-sm border border-slate-200/50">
            {property.property_type}
          </span>
        </div>

        <div className="absolute top-4 right-4 z-10 flex items-center gap-1">
          <div
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md flex items-center gap-1.5 shadow-sm ${
              isOccupied ? "bg-slate-900/90 text-slate-100" : "bg-emerald-500/90 text-white"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isOccupied ? "bg-slate-400" : "bg-white animate-pulse"
              }`}
            />
            {property.status}
          </div>
        </div>

        {/* Bottom Tag overlay */}
        <div className="absolute bottom-4 left-4 z-10">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-950/70 text-slate-200 backdrop-blur-xs">
            {property.furnishing} · {property.room_type}
          </span>
        </div>
      </div>

      {/* ── Body Info ── */}
      <div className="p-5 flex flex-col flex-grow gap-3">
        <div>
          <h3
            onClick={onQuickView}
            className="text-base font-headline font-bold text-slate-900 line-clamp-1 hover:text-indigo-600 transition-colors cursor-pointer"
            title={property.title}
          >
            {property.title}
          </h3>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1 font-body line-clamp-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span>{property.location}</span>
          </p>
        </div>

        {/* Performance micro-stats */}
        <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 font-medium">
          <div className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-slate-400" />
            <span>{property.views} Views</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-indigo-700 dark:text-indigo-400 font-semibold">{property.inquiries} Leads</span>
          </div>
          <span className="text-slate-400 font-normal">{property.created_at}</span>
        </div>

        {/* ── Footer: Pricing & Action Buttons ── */}
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
          <div>
            <div className="font-headline font-bold text-lg text-indigo-600 dark:text-indigo-400">
              ₹{property.price.toLocaleString("en-IN")}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-body font-normal">/mo</span>
            </div>
            <div className="text-[10px] text-slate-400">
              ₹{property.deposit.toLocaleString("en-IN")} deposit
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={onCopyLink}
              title="Share listing link"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition-colors cursor-pointer"
              aria-label="Share listing"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onToggleStatus}
              title={isOccupied ? "Mark as Live / Active" : "Mark as Occupied"}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                isOccupied
                  ? "bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-slate-600 dark:text-slate-300 hover:text-emerald-600"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950 text-slate-600 dark:text-slate-300 hover:text-amber-600"
              }`}
              aria-label="Toggle status"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onDelete}
              title="Delete listing"
              className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
              aria-label="Delete listing"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. VISIT REQUESTS VIEW (WIRED TO REAL SUPABASE BOOKINGS BACKEND)
// ─────────────────────────────────────────────────────────────────────────────
function VisitRequestsView({
  requests,
  isLoading,
  onRefresh,
  onSelectDate,
  onConfirmSchedule,
  onDecline,
  onSwitchTab,
  onShowToast,
}: {
  requests: VisitRequest[];
  isLoading: boolean;
  onRefresh: () => void;
  onSelectDate: (requestId: string, dateIdx: 1 | 2) => void;
  onConfirmSchedule: (
    requestId: string,
    selectedDate: { date: string; timeSlot: string }
  ) => void;
  onDecline: (requestId: string) => void;
  onSwitchTab: (tab: TabType) => void;
  onShowToast: (msg: string) => void;
}) {
  const [filterType, setFilterType] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const pendingCount = requests.filter((r) => r.status === "Pending").length;
  const lockedDepositCount = requests.filter(
    (r) => r.status === "Pending" && r.request_type === "Locked (10% Paid)"
  ).length;

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        req.seeker_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.property_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.property_location.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === "All") return true;
      if (filterType === "Locked") return req.request_type === "Locked (10% Paid)";
      if (filterType === "Free") return req.request_type === "Free Visit";
      if (filterType === "Confirmed") return req.status === "Confirmed";
      return true;
    });
  }, [requests, searchQuery, filterType]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-[0_10px_30px_rgba(70,72,212,0.04)] border border-slate-100 dark:border-slate-800 flex flex-col gap-8 transition-all animate-[fadeIn_0.2s_ease-out]">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold font-headline text-slate-900 dark:text-slate-100">
                Visit & Tour Requests
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-700/60">
                {pendingCount} Pending
              </span>
              {lockedDepositCount > 0 && (
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/60">
                  {lockedDepositCount} Locked (10% Paid)
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-body mt-0.5">
              Live tour requests from Supabase. Review seeker profiles, select dates, and confirm visits.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onRefresh}
            title="Refresh requests from Supabase"
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-indigo-600 dark:text-indigo-400" : ""}`} />
          </button>
          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl flex items-center gap-2 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Auto-Sync with Calendar</span>
          </span>
        </div>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by seeker or property name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
          {[
            { id: "All", label: "All Requests" },
            { id: "Locked", label: "Locked (10% Paid)" },
            { id: "Free", label: "Free Visits" },
            { id: "Confirmed", label: "Confirmed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-headline font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filterType === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Pending Requests List / Skeleton / Empty State ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">
            Fetching live visit requests from Supabase…
          </p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 sm:p-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
            <Bell className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-bold font-headline text-slate-900 dark:text-slate-100">
              No pending requests right now
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-body">
              {searchQuery
                ? `No requests matched your query "${searchQuery}". Try changing search keywords or filters.`
                : "All incoming walkthroughs are scheduled and confirmed! We will alert you the moment a new seeker books a slot on your properties."}
            </p>
          </div>
          <button
            onClick={() => onSwitchTab("Active Listings")}
            className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white text-xs font-headline font-semibold transition-colors cursor-pointer"
          >
            <span>View Active Listings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredRequests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onSelectDate={(idx) => onSelectDate(request.id, idx)}
              onConfirmSchedule={() => {
                const chosenDate =
                  request.selected_date_idx === 1
                    ? request.priority_date_1
                    : request.priority_date_2;
                onConfirmSchedule(request.id, chosenDate);
              }}
              onDecline={() => onDecline(request.id)}
              onShowToast={onShowToast}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Individual Request Card Component ───────────────────────────────────────
function RequestCard({
  request,
  onSelectDate,
  onConfirmSchedule,
  onDecline,
  onShowToast,
}: {
  request: VisitRequest;
  onSelectDate: (idx: 1 | 2) => void;
  onConfirmSchedule: () => void;
  onDecline: () => void;
  onShowToast: (msg: string) => void;
}) {
  const isLocked = request.request_type === "Locked (10% Paid)";
  const isConfirmed = request.status === "Confirmed";
  const isDeclined = request.status === "Declined";

  const selectedDate =
    request.selected_date_idx === 1 ? request.priority_date_1 : request.priority_date_2;

  return (
    <div
      className={`rounded-3xl border p-6 sm:p-7 flex flex-col gap-5 transition-all duration-200 relative overflow-hidden ${
        isConfirmed
          ? "bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-800/80 shadow-sm"
          : isDeclined
          ? "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60"
          : isLocked
          ? "bg-white dark:bg-slate-900 border-indigo-200/90 dark:border-indigo-800/80 shadow-[0_6px_24px_rgba(70,72,212,0.06)] hover:shadow-ambient ring-1 ring-indigo-500/10"
          : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-ambient"
      }`}
    >
      {/* ── Top Row: Seeker Profile & Request Type Badge ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700">
            <Image
              src={request.seeker_avatar}
              alt={request.seeker_name}
              fill
              unoptimized
              className="object-cover"
              sizes="48px"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold font-headline text-slate-900 dark:text-slate-100">
                {request.seeker_name}
              </h3>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-body line-clamp-1">
              {request.seeker_profession}
            </p>
          </div>
        </div>

        {/* ── Request Type Badge (Locked vs Free Visit) ── */}
        <div className="flex flex-col items-end gap-1">
          {isLocked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-headline bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/60 dark:to-teal-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
              <Lock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>Locked (10% Paid)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold font-headline bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <Eye className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              <span>Free Visit</span>
            </span>
          )}

          {isLocked && request.paid_deposit_amount && (
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
              ₹{request.paid_deposit_amount.toLocaleString("en-IN")} held in escrow
            </span>
          )}
        </div>
      </div>

      {/* ── Property Requested Snippet ── */}
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
            <Image
              src={request.property_image}
              alt={request.property_title}
              fill
              className="object-cover"
              sizes="44px"
            />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Property Requested
            </span>
            <h4 className="text-xs sm:text-sm font-bold font-headline text-slate-900 dark:text-slate-100 line-clamp-1">
              {request.property_title}
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-body flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              {request.property_location}
            </span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="font-headline font-bold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400">
            ₹{request.property_price.toLocaleString("en-IN")}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">/mo</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{request.created_at}</span>
        </div>
      </div>

      {/* Seeker Note/Message */}
      {request.seeker_message && (
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-body italic bg-slate-50/60 dark:bg-slate-800/40 px-3.5 py-2.5 rounded-xl border border-slate-100/80 dark:border-slate-800">
          &ldquo;{request.seeker_message}&rdquo;
        </p>
      )}

      {/* ── Scheduling Options (Priority Date 1 vs Priority Date 2) ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold font-headline uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>Select Appointment Slot</span>
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">Seeker&apos;s preferred times</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Priority Date 1 */}
          <button
            type="button"
            disabled={isConfirmed || isDeclined}
            onClick={() => onSelectDate(1)}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
              request.selected_date_idx === 1
                ? "bg-indigo-50/70 dark:bg-indigo-950/60 border-indigo-600 ring-2 ring-indigo-600/20 shadow-xs"
                : "bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  request.selected_date_idx === 1
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                Priority Date 1
              </span>
              {request.selected_date_idx === 1 && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <span className="text-xs font-bold font-headline text-slate-900 dark:text-slate-100 mt-0.5">
              {request.priority_date_1.date}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-body">
              {request.priority_date_1.timeSlot}
            </span>
          </button>

          {/* Priority Date 2 */}
          <button
            type="button"
            disabled={isConfirmed || isDeclined}
            onClick={() => onSelectDate(2)}
            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
              request.selected_date_idx === 2
                ? "bg-indigo-50/70 dark:bg-indigo-950/60 border-indigo-600 ring-2 ring-indigo-600/20 shadow-xs"
                : "bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  request.selected_date_idx === 2
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                Priority Date 2
              </span>
              {request.selected_date_idx === 2 && (
                <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              )}
            </div>
            <span className="text-xs font-bold font-headline text-slate-900 dark:text-slate-100 mt-0.5">
              {request.priority_date_2.date}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-body">
              {request.priority_date_2.timeSlot}
            </span>
          </button>
        </div>
      </div>

      {/* ── Status Banner / Primary Actions ── */}
      {isConfirmed ? (
        <div className="pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>
              Confirmed for {selectedDate.date} ({selectedDate.timeSlot})
            </span>
          </div>
          <button
            type="button"
            onClick={() => onShowToast(`Contacting ${request.seeker_name} at ${request.seeker_phone}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Phone className="w-3 h-3" />
            <span>Call Seeker</span>
          </button>
        </div>
      ) : isDeclined ? (
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Request has been declined.</span>
        </div>
      ) : (
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onShowToast(`Chat initiated with ${request.seeker_name}`)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              title="Chat with seeker"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onShowToast(`Draft email created for ${request.seeker_name}`)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              title="Email seeker"
            >
              <Mail className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onShowToast(`Calling ${request.seeker_name} at ${request.seeker_phone}`)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              title="Call seeker"
            >
              <Phone className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDecline}
              className="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold font-headline transition-colors cursor-pointer"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={onConfirmSchedule}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-headline text-xs font-bold tracking-wide shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <CalendarCheck className="w-4 h-4" />
              <span>Confirm Schedule</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. RENTED & TENANTS (TENANT VAULT & RENT ROLL) VIEW
// ─────────────────────────────────────────────────────────────────────────────
function TenantVaultView({
  tenants,
  onOpenGoldenKey,
  onSwitchTab,
  onShowToast,
  onUpdateTenantRentStatus,
}: {
  tenants: TenantRecord[];
  onOpenGoldenKey: () => void;
  onSwitchTab: (tab: TabType) => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
  onUpdateTenantRentStatus: (tenantId: string, status: "Paid" | "Due Soon" | "Overdue") => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [selectedKycTenant, setSelectedKycTenant] = useState<TenantRecord | null>(null);
  const [selectedLeaseTenant, setSelectedLeaseTenant] = useState<TenantRecord | null>(null);

  // Live computed metrics from tenants data
  const totalOccupants = tenants.length;
  const verifiedKycCount = tenants.filter((t) => t.kyc_status === "Verified").length;
  const totalMonthlyRent = tenants.reduce((acc, t) => acc + t.monthly_rent, 0);
  const collectedRent = tenants
    .filter((t) => t.rent_status === "Paid")
    .reduce((acc, t) => acc + t.monthly_rent, 0);
  const totalEscrowDeposit = tenants.reduce((acc, t) => acc + t.security_deposit, 0);
  const collectionRate = totalMonthlyRent > 0 ? Math.round((collectedRent / totalMonthlyRent) * 100) : 0;

  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.property_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.email.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === "All") return true;
      if (filterType === "Paid") return t.rent_status === "Paid";
      if (filterType === "Due") return t.rent_status === "Due Soon" || t.rent_status === "Overdue";
      if (filterType === "Overdue") return t.rent_status === "Overdue";
      if (filterType === "Verified") return t.kyc_status === "Verified";
      return true;
    });
  }, [tenants, searchQuery, filterType]);

  const handleSendRentReminder = (tenant: TenantRecord) => {
    onShowToast(`Instant UPI payment reminder & SMS sent to ${tenant.name}!`, "success");
  };

  const handleRecordCashPayment = (tenant: TenantRecord) => {
    onUpdateTenantRentStatus(tenant.id, "Paid");
    onShowToast(`Offline cash payment of ₹${tenant.monthly_rent.toLocaleString("en-IN")} recorded for ${tenant.name}!`, "success");
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 shadow-[0_10px_30px_rgba(70,72,212,0.04)] border border-slate-100 dark:border-slate-800 flex flex-col gap-8 transition-all animate-[fadeIn_0.2s_ease-out]">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold font-headline text-slate-900 dark:text-slate-100">
                Rented Units & Tenant Vault
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-700/60">
                {totalOccupants} Active Leases
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-body mt-0.5">
              Digital rent roll, KYC identity dossiers, escrow-protected security deposits, and e-Lease agreements.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={onOpenGoldenKey}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-headline text-xs font-semibold border border-indigo-200/80 dark:border-indigo-800/80 transition-colors cursor-pointer"
          >
            <Key className="w-3.5 h-3.5" />
            <span>Sync via Golden Key</span>
          </button>
        </div>
      </div>

      {/* ── 3 Summary Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Active Tenants */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Tenants
          </span>
          <span className="text-2xl font-bold font-headline text-slate-900 dark:text-slate-100">
            {totalOccupants} Occupants
          </span>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5 mt-0.5">
            <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            {verifiedKycCount}/{totalOccupants} Verified KYC Dossiers
          </span>
        </div>

        {/* Card 2: Rent Collected */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Rent Collected (This Month)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-headline text-emerald-600 dark:text-emerald-400">
              ₹{collectedRent.toLocaleString("en-IN")}
            </span>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
              / ₹{totalMonthlyRent.toLocaleString("en-IN")}
            </span>
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {collectionRate}% Collection Rate
          </span>
        </div>

        {/* Card 3: Security Deposit Escrow */}
        <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Security Deposit Escrow
          </span>
          <span className="text-2xl font-bold font-headline text-indigo-600 dark:text-indigo-400">
            ₹{totalEscrowDeposit.toLocaleString("en-IN")}
          </span>
          <span className="text-xs text-indigo-700/80 dark:text-indigo-300/80 font-medium mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Protected Vault Balance
          </span>
        </div>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tenant, property, or phone…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
          {[
            { id: "All", label: "All Tenants" },
            { id: "Paid", label: "Rent Paid" },
            { id: "Due", label: "Rent Due / Overdue" },
            { id: "Overdue", label: "Overdue" },
            { id: "Verified", label: "KYC Verified" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-headline font-semibold transition-all cursor-pointer whitespace-nowrap ${
                filterType === tab.id
                  ? "bg-slate-900 dark:bg-indigo-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tenant Cards Grid ── */}
      {filteredTenants.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 sm:p-16 flex flex-col items-center justify-center text-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50/80 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
            <Users className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-bold font-headline text-slate-900 dark:text-slate-100">
              No active tenants yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-body">
              {searchQuery
                ? `No tenant matched your search query "${searchQuery}". Try different keywords.`
                : "When a seeker rents your room or you pair an offline lease with Golden Key, their tenant dossier will be vaulted here."}
            </p>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={onOpenGoldenKey}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-headline font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Enter Golden Key</span>
            </button>
            <button
              onClick={() => onSwitchTab("Active Listings")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-headline font-semibold transition-colors cursor-pointer"
            >
              <span>View Listings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredTenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onViewKyc={() => setSelectedKycTenant(tenant)}
              onViewLease={() => setSelectedLeaseTenant(tenant)}
              onSendReminder={() => handleSendRentReminder(tenant)}
              onRecordCash={() => handleRecordCashPayment(tenant)}
              onShowToast={onShowToast}
            />
          ))}
        </div>
      )}

      {/* ── KYC Dossier Viewer Modal ── */}
      {selectedKycTenant && (
        <KYCModal
          tenant={selectedKycTenant}
          onClose={() => setSelectedKycTenant(null)}
          onShowToast={onShowToast}
        />
      )}

      {/* ── Digital Lease Agreement Modal ── */}
      {selectedLeaseTenant && (
        <LeaseAgreementModal
          tenant={selectedLeaseTenant}
          onClose={() => setSelectedLeaseTenant(null)}
          onShowToast={onShowToast}
        />
      )}
    </div>
  );
}

// ─── Individual Tenant Card Component ───────────────────────────────────────
function TenantCard({
  tenant,
  onViewKyc,
  onViewLease,
  onSendReminder,
  onRecordCash,
  onShowToast,
}: {
  tenant: TenantRecord;
  onViewKyc: () => void;
  onViewLease: () => void;
  onSendReminder: () => void;
  onRecordCash: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  const isPaid = tenant.rent_status === "Paid";
  const isOverdue = tenant.rent_status === "Overdue";

  return (
    <div
      className={`rounded-3xl border p-6 sm:p-7 flex flex-col gap-5 transition-all duration-200 relative overflow-hidden bg-white dark:bg-slate-900 shadow-[0_4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-ambient ${
        isOverdue
          ? "border-rose-200/90 dark:border-rose-800/80 ring-1 ring-rose-500/10"
          : isPaid
          ? "border-slate-200/90 dark:border-slate-800"
          : "border-amber-200/90 dark:border-amber-800/80 ring-1 ring-amber-500/10"
      }`}
    >
      {/* ── Top Row: Tenant Profile & Rent Status Indicator ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="relative w-12 h-12 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700">
            <Image
              src={tenant.avatar}
              alt={tenant.name}
              fill
              unoptimized
              className="object-cover"
              sizes="48px"
            />
            {tenant.kyc_status === "Verified" && (
              <div
                className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center border-2 border-white dark:border-slate-900"
                title="KYC Verified"
              >
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold font-headline text-slate-900 dark:text-slate-100">
                {tenant.name}
              </h3>
              {tenant.kyc_status === "Pending" ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 animate-pulse">
                  Awaiting Documents
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                  KYC Verified
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-body line-clamp-1">
              {tenant.profession}
            </p>
          </div>
        </div>

        {/* ── Rent Status Tag Indicator ── */}
        <div className="flex flex-col items-end gap-1">
          {tenant.rent_status === "Paid" && tenant.kyc_status === "Pending" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-headline bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>10% in ZILLA Vault</span>
            </span>
          ) : tenant.rent_status === "Paid" ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-headline bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>100% Secured</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold font-headline bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>₹0 Paid (Pending)</span>
            </span>
          )}

          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            {tenant.rent_status === "Paid" && tenant.kyc_status === "Pending" ? "Security Deposit Vaulted" : tenant.rent_status_detail}
          </span>
        </div>
      </div>

      {/* ── Rented Property Snapshot ── */}
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
            <Image
              src={tenant.property_image}
              alt={tenant.property_title}
              fill
              className="object-cover"
              sizes="44px"
            />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
              Rented Property
            </span>
            <h4 className="text-xs sm:text-sm font-bold font-headline text-slate-900 dark:text-slate-100 line-clamp-1">
              {tenant.property_title}
            </h4>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-body flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              {tenant.property_location} · {tenant.room_type}
            </span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="font-headline font-bold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400">
            ₹{tenant.monthly_rent.toLocaleString("en-IN")}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">/mo</span>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{tenant.lease_duration_months} Mo Lease</span>
        </div>
      </div>

      {/* ── Security Deposit Escrow & Lease Info ── */}
      <div className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100/80 dark:border-indigo-800/60 text-xs">
        <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-semibold">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <span>Security Deposit:</span>
          <span className="text-indigo-700 dark:text-indigo-300 font-mono font-bold">
            {tenant.rent_status === "Paid" && tenant.kyc_status === "Verified" 
              ? `₹${tenant.security_deposit.toLocaleString("en-IN")} Secured`
              : tenant.rent_status === "Paid" && tenant.kyc_status === "Pending"
                ? "10% Token Vaulted"
                : "₹0 Secured"
            }
          </span>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          Lease: {tenant.lease_start} – {tenant.lease_end}
        </span>
      </div>

      {/* ── Smart Action Bar & Fallback Menu ── */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Main Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSendReminder}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-headline shadow-sm shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Remind</span>
          </button>
          <button
            type="button"
            onClick={tenant.kyc_status === "Pending" ? () => onShowToast("Tenant has not uploaded documents yet. Please click 'Remind' to notify them.", "info") : onViewKyc}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold font-headline border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Verification</span> Details
          </button>
          <button
            type="button"
            onClick={tenant.kyc_status === "Pending" ? () => onShowToast("Tenant has not uploaded documents yet. Please click 'Remind' to notify them.", "info") : onViewLease}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold font-headline border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          >
            <FileCheck className="w-3.5 h-3.5" />
            Lease <span className="hidden sm:inline">Agreement</span>
          </button>
        </div>

        {/* Fallback Menu / Overrides */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onShowToast("Manual ID upload flow coming soon.", "info")}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-[10px] font-semibold uppercase tracking-wider border border-transparent transition-colors cursor-pointer"
            title="Upload ID Manually"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          {!isPaid && (
            <button
              type="button"
              onClick={onRecordCash}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-[10px] font-semibold uppercase tracking-wider border border-transparent transition-colors cursor-pointer"
              title="Mark Cash Received"
            >
              <Receipt className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KYC Dossier Modal Component ────────────────────────────────────────────
function KYCModal({
  tenant,
  onClose,
  onShowToast,
}: {
  tenant: TenantRecord;
  onClose: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden animate-[slideUp_0.2s_ease-out] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-headline text-slate-900 dark:text-slate-100">
                  KYC Verification Dossier
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-700/60">
                  Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">Auth ID: {tenant.agreement_id}-KYC</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 overflow-y-auto flex flex-col gap-5">
          {/* Tenant Identity Header */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 flex-shrink-0">
              <Image
                src={tenant.avatar}
                alt={tenant.name}
                fill
                unoptimized
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div>
              <h4 className="text-base font-bold font-headline text-slate-900 dark:text-slate-100">{tenant.name}</h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-body">{tenant.profession}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span>{tenant.phone}</span>
                <span>·</span>
                <span>{tenant.email}</span>
              </div>
            </div>
          </div>

          {/* Government ID Verification Snapshot */}
          <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-headline uppercase tracking-wider text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <BadgeCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Government Identity Verification</span>
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-100/80 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md">
                100% Cryptographic Match
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-100/80 dark:border-indigo-800/50">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Document Type</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{tenant.kyc_id_type}</p>
              </div>
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-indigo-100/80 dark:border-indigo-800/50">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Masked Number</span>
                <p className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">{tenant.kyc_id_number}</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span>Issuing Authority: Govt. of India (UIDAI / MoEA)</span>
              <span>Verification Hash: SHA256-VALID</span>
            </div>
          </div>

          {/* Police Clearance & Background */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-headline text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Police Clearance Certificate</span>
              </span>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">Cleared & Filed</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-body">
              Verified with local station jurisdiction in accordance with state tenancy laws. Zero adverse criminal or legal disputes found.
            </p>
          </div>

          {/* Emergency Contact */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Emergency Contact</span>
              <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {tenant.emergency_contact.name} ({tenant.emergency_contact.relationship})
              </h5>
            </div>
            <a
              href={`tel:${tenant.emergency_contact.phone}`}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800 flex items-center gap-1.5"
            >
              <Phone className="w-3 h-3" />
              <span>{tenant.emergency_contact.phone}</span>
            </a>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onShowToast(`Downloading Verified KYC Dossier for ${tenant.name}…`, "info")}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-headline shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Verified Dossier (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Digital Lease Agreement Modal Component ────────────────────────────────
function LeaseAgreementModal({
  tenant,
  onClose,
  onShowToast,
}: {
  tenant: TenantRecord;
  onClose: () => void;
  onShowToast: (msg: string, type?: "success" | "error" | "info") => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 relative overflow-hidden animate-[slideUp_0.2s_ease-out] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-6 sm:p-7 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300">
              <FileCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-headline text-white">
                  Digital Residential Lease Agreement
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-300/30">
                  e-Stamped
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">
                Certificate #{tenant.agreement_id} · Govt. e-Stamp Duty Paid
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex flex-col gap-6 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-body">
          {/* Summary Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Monthly Rent</span>
              <p className="text-base font-bold font-headline text-indigo-600 dark:text-indigo-400 mt-0.5">
                ₹{tenant.monthly_rent.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Security Deposit</span>
              <p className="text-base font-bold font-headline text-slate-900 dark:text-slate-100 mt-0.5">
                ₹{tenant.security_deposit.toLocaleString("en-IN")}
              </p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Lease Period</span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{tenant.lease_duration_months} Months</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Notice Period</span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">30 Days Written</p>
            </div>
          </div>

          {/* Parties & Property */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-bold font-headline uppercase tracking-wider text-slate-900 dark:text-slate-100">
              1. Contracting Parties & Demised Premises
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Lessor (Property Owner)</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">ZILLA Verified Owner Portal</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">Authorized Landlord Account</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Lessee (Tenant)</span>
                <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{tenant.name}</p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">{tenant.kyc_id_type} · {tenant.kyc_id_number}</p>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Property Demised</span>
              <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{tenant.property_title}</p>
              <p className="text-slate-500 dark:text-slate-400 mt-0.5">{tenant.property_location} ({tenant.room_type})</p>
            </div>
          </div>

          {/* Key Clauses */}
          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-bold font-headline uppercase tracking-wider text-slate-900 dark:text-slate-100">
              2. Core Tenancy Clauses & Rules
            </h4>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-300">
              <li>
                <strong>Rent Schedule:</strong> Rent of ₹{tenant.monthly_rent.toLocaleString("en-IN")} shall be payable on or before the 1st of each calendar month via UPI/ZILLA Auto-Debit.
              </li>
              <li>
                <strong>Deposit Escrow:</strong> The security deposit of ₹{tenant.security_deposit.toLocaleString("en-IN")} is safeguarded in the ZILLA Escrow Vault and refundable upon checkout post utility clearance.
              </li>
              <li>
                <strong>Lock-in & Termination:</strong> A lock-in period of 3 months applies. Either party may terminate with 30 days prior written notice.
              </li>
            </ul>
          </div>

          {/* Dual e-Sign Stamps */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex flex-col gap-3">
            <span className="text-xs font-bold font-headline uppercase tracking-wider text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Digital e-Signature Verification</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/60">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Lessor Signature</span>
                <p className="font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">✓ Digitally Signed & Locked</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Timestamp: {tenant.lease_start} 10:00 AM IST</p>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/60">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Lessee Signature ({tenant.name})</span>
                <p className="font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">✓ Aadhaar e-Sign Verified</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Timestamp: {tenant.lease_start} 10:45 AM IST</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => onShowToast(`Downloading official e-Stamped Lease Agreement #${tenant.agreement_id}…`, "info")}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold font-headline shadow-md shadow-indigo-600/20 flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Signed Agreement (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
