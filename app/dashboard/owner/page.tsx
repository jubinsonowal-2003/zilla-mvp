"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import TopAppBar from "../../components/TopAppBar";
import BottomNav from "../../components/BottomNav";
import { supabase } from "@/lib/supabase";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBgyJm2UjeOTYSloBNtAfGng2YGbcAezqi7U0vV4CEIRGhpFw59XVGUS2guACo-zTOCMoMk1XVw0xDd6YTdlyXEB3wEmGF8SiI8Bu_Sk1OoUQtYHjh6hOMPh2gqu_InBJztB996SSz4kenNaNtP1fdF7EQlNdTceOkZtr6f5oYoxkQi84paDTq_kYSyKtBLNhXlHeWk2AbbNsT3O7LiMsBL7Dq02AMp0j1gPGDs6vV5MA01on6GZHvE4iUyR007qJpJiXNcZCdOwig";

// Dynamically import the map so it's only rendered client-side (avoids SSR "window is not defined")
const MapPicker = dynamic(() => import("../../components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-surface-container-low rounded-xl">
      <div className="flex flex-col items-center gap-3 text-outline">
        <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs font-body">Loading map…</span>
      </div>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────
interface Room {
  id: string;
  title: string;
  price: number;
  location: string;
  description: string;
  image_url: string | null;
  status: string;
  created_at: string;
}

const AMENITY_OPTIONS = [
  { label: "WiFi", icon: "wifi" },
  { label: "AC", icon: "ac_unit" },
  { label: "Geyser", icon: "hot_tub" },
  { label: "Parking", icon: "local_parking" },
  { label: "Power Backup", icon: "battery_charging_full" },
  { label: "RO Water", icon: "water_drop" },
];

/** Extra amenities shown only for PG / Hostel property types */
const PG_HOSTEL_AMENITY_OPTIONS = [
  { label: "Food / Mess Included", icon: "restaurant" },
  { label: "Laundry Service",      icon: "local_laundry_service" },
  { label: "Daily Housekeeping",   icon: "cleaning_services" },
  { label: "Strict Security / Warden", icon: "security" },
];

type SelectOption = { label: string; value: string };

const PROPERTY_TYPE_OPTIONS: SelectOption[] = [
  { label: "Rental Room", value: "rental_room" },
  { label: "Flat / Apartment", value: "flat" },
  { label: "PG", value: "pg" },
  { label: "Hostel", value: "hostel" },
];

const ROOM_TYPE_OPTIONS: SelectOption[] = [
  { label: "Single Room", value: "single" },
  { label: "Shared Room", value: "shared" },
  { label: "1 BHK", value: "1bhk" },
  { label: "2 BHK", value: "2bhk" },
];

const FURNISHING_OPTIONS: SelectOption[] = [
  { label: "Fully Furnished", value: "fully_furnished" },
  { label: "Semi-Furnished", value: "semi_furnished" },
  { label: "Unfurnished", value: "unfurnished" },
];

// ─── Sub-components ───────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
      </div>
      <div>
        <h3 className="text-sm font-headline font-semibold text-on-surface">{title}</h3>
        {subtitle && <p className="text-xs text-on-surface-variant font-body mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function FormLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label
      className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

function StyledSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 pr-10 text-sm text-on-surface focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body appearance-none cursor-pointer"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
        expand_more
      </span>
    </div>
  );
}

function Toggle({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-xl overflow-hidden bg-surface-container-low p-1 gap-1">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`flex-1 py-2 text-sm font-body font-medium rounded-lg transition-all duration-200 ${
            value === opt
              ? "bg-primary text-white shadow-sm"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function OwnerDashboard() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  // Route guard
  useEffect(() => {
    const sessionId = localStorage.getItem("zilla_session_id");
    const role = localStorage.getItem("zilla_user_role");
    if (!sessionId || !role) {
      router.push("/role");
      return;
    }
    setAuthChecked(true);
  }, [router]);

  // ── Core form fields ──────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  // ── New property detail fields ────────────────────────────────────────
  const [propertyType, setPropertyType] = useState("");
  const [roomType, setRoomType] = useState("");
  const [washroom, setWashroom] = useState("Attached");
  const [furnishing, setFurnishing] = useState("");

  // ── Amenities ─────────────────────────────────────────────────────────
  const [amenities, setAmenities] = useState<string[]>([]);

  // ── PG / Hostel-specific details (saved into rules.custom_details) ────
  const [customDetails, setCustomDetails] = useState("");

  // ── House Rules ───────────────────────────────────────────────────────
  const [food, setFood] = useState("Any");
  const [smoking, setSmoking] = useState("Not Allowed");
  const [drinking, setDrinking] = useState("Not Allowed");
  const [preferredTenant, setPreferredTenant] = useState("Anyone");
  const [curfew, setCurfew] = useState("No Curfew");

  // ── Map / Location ────────────────────────────────────────────────────
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // ── Photos ────────────────────────────────────────────────────────────
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── UI state ──────────────────────────────────────────────────────────
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [listings, setListings] = useState<Room[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Fetch listings ────────────────────────────────────────────────────
  const fetchListings = useCallback(async () => {
    const sessionId = localStorage.getItem("zilla_session_id");
    if (!sessionId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("user_id", sessionId)
      .order("created_at", { ascending: false });
    if (error) console.error("Error fetching listings:", error);
    else setListings(data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (authChecked) fetchListings();
  }, [authChecked, fetchListings]);

  // ── Amenity toggle ────────────────────────────────────────────────────
  const toggleAmenity = (label: string) => {
    setAmenities((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label]
    );
  };

  // ── Geolocation ───────────────────────────────────────────────────────
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser.", "error");
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setIsDetectingLocation(false);
        showToast("Location detected!", "success");
      },
      () => {
        setIsDetectingLocation(false);
        showToast("Unable to detect location. Please pin it on the map.", "error");
      }
    );
  };

  // ── Photos ────────────────────────────────────────────────────────────
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

  // ── Publish ───────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!title.trim() || !price.trim() || !location.trim()) {
      showToast("Please fill in Title, Price, and Location", "error");
      return;
    }
    setIsPublishing(true);
    try {
      let sessionId = localStorage.getItem("zilla_session_id");
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("zilla_session_id", sessionId);
      }

      const imageUrls: string[] = [];
      for (const file of selectedFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("room-images")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });
        if (uploadError) throw new Error(`Image upload failed for ${file.name}: ${uploadError.message}`);
        const { data: urlData } = supabase.storage.from("room-images").getPublicUrl(fileName);
        imageUrls.push(urlData.publicUrl);
      }

      const rulesPayload: Record<string, string> = {
        food,
        smoking,
        drinking,
        preferred_tenant: preferredTenant,
        curfew,
      };
      // Attach PG/Hostel custom details only when relevant and non-empty
      if ((propertyType === "pg" || propertyType === "hostel") && customDetails.trim()) {
        rulesPayload.custom_details = customDetails.trim();
      }

      const payload = {
        user_id: sessionId,
        title: title.trim(),
        price: parseInt(price),
        deposit: deposit ? parseInt(deposit) : null,
        location: location.trim(),
        description: description.trim(),
        image_url: imageUrls[0] ?? null,
        image_urls: imageUrls,
        status: "active",
        property_type: propertyType || null,
        room_type: roomType || null,
        washroom,
        furnishing: furnishing || null,
        amenities: amenities.length > 0 ? amenities : null,
        rules: rulesPayload,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
      };

      const { data, error: insertError } = await supabase.from("rooms").insert(payload).select();
      if (insertError) {
        console.error("[ZILLA] Room insert failed:", insertError);
        throw new Error(`Failed to save listing: ${insertError.message}`);
      }
      console.log("[ZILLA] Room saved:", data);

      showToast("Listing published successfully!", "success");

      // Reset form
      setTitle(""); setPrice(""); setDeposit(""); setLocation(""); setDescription("");
      setPropertyType(""); setRoomType(""); setWashroom("Attached"); setFurnishing("");
      setAmenities([]); setCustomDetails("");
      setFood("Any"); setSmoking("Not Allowed"); setDrinking("Not Allowed");
      setPreferredTenant("Anyone"); setCurfew("No Curfew");
      setLatitude(null); setLongitude(null);
      setSelectedFiles([]); setPreviewUrls([]);

      fetchListings();
      setTimeout(() => document.getElementById("active-listings")?.scrollIntoView({ behavior: "smooth" }), 300);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    } finally {
      setIsPublishing(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) showToast("Failed to delete listing", "error");
    else { showToast("Listing deleted", "success"); fetchListings(); }
  };

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-surface text-on-surface font-body min-h-dvh flex flex-col pb-28 md:pb-0 pt-24 md:pt-32">
      <TopAppBar avatarUrl={AVATAR_URL} showSearch label="Owner Dashboard" />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-xl shadow-lg font-body text-sm font-medium flex items-center gap-2 ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-error text-on-error"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.message}
        </div>
      )}

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-8 xl:gap-12">
        {/* ══ Section A: Post a Room ══ */}
        <section className="w-full lg:w-5/12 flex-shrink-0 flex flex-col gap-6">
          <div className="flex flex-col gap-2 mb-2">
            <h1 className="text-[1.75rem] font-headline font-semibold tracking-tight text-on-surface">
              Post a Room
            </h1>
            <p className="text-on-surface-variant font-body text-sm">
              Fill in the details to list your property.
            </p>
          </div>

          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>

            {/* ── Card 1: Basic Info ── */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-ambient flex flex-col gap-5 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              <SectionHeader icon="info" title="Basic Information" subtitle="Title, location & description" />

              {/* Title */}
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="room-title">Room Title</FormLabel>
                <input
                  id="room-title"
                  type="text"
                  placeholder="e.g. Cozy Studio near Metro"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body"
                />
              </div>

              {/* Price + Deposit */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-col gap-2 flex-1">
                  <FormLabel htmlFor="price">Rent / Month (₹)</FormLabel>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline text-sm">₹</span>
                    <input
                      id="price"
                      type="number"
                      placeholder="15,000"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-surface-container-low border-none rounded-xl pl-8 pr-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <FormLabel htmlFor="deposit">Security Deposit (₹)</FormLabel>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline text-sm">₹</span>
                    <input
                      id="deposit"
                      type="number"
                      placeholder="30,000"
                      value={deposit}
                      onChange={(e) => setDeposit(e.target.value)}
                      className="w-full bg-surface-container-low border-none rounded-xl pl-8 pr-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body"
                    />
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="location">Location / Area</FormLabel>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                    location_on
                  </span>
                  <input
                    id="location"
                    type="text"
                    placeholder="Neighborhood, City"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-xl pl-10 pr-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="description">Description</FormLabel>
                <textarea
                  id="description"
                  placeholder="Describe the best features of this space…"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body resize-none"
                />
              </div>
            </div>

            {/* ── Card 2: Property Details ── */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-ambient flex flex-col gap-5">
              <SectionHeader icon="apartment" title="Property Details" subtitle="Type, room & furnishing" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <FormLabel htmlFor="property-type">Property Type</FormLabel>
                  <StyledSelect
                    id="property-type"
                    value={propertyType}
                    onChange={setPropertyType}
                    options={PROPERTY_TYPE_OPTIONS}
                    placeholder="Select type…"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <FormLabel htmlFor="room-type">Room Type</FormLabel>
                  <StyledSelect
                    id="room-type"
                    value={roomType}
                    onChange={setRoomType}
                    options={ROOM_TYPE_OPTIONS}
                    placeholder="Select room…"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <FormLabel>Washroom</FormLabel>
                <Toggle
                  options={["Attached", "Shared"]}
                  value={washroom}
                  onChange={setWashroom}
                />
              </div>

              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="furnishing">Furnishing</FormLabel>
                <StyledSelect
                  id="furnishing"
                  value={furnishing}
                  onChange={setFurnishing}
                  options={FURNISHING_OPTIONS}
                  placeholder="Select furnishing…"
                />
              </div>
            </div>

            {/* ── Card 3: Amenities ── */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-ambient flex flex-col gap-4">
              <SectionHeader icon="local_convenience_store" title="Amenities" subtitle="Tap to select what's available" />
              <div className="flex flex-wrap gap-2">
                {AMENITY_OPTIONS.map((a) => {
                  const active = amenities.includes(a.label);
                  return (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => toggleAmenity(a.label)}
                      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 border ${
                        active
                          ? "bg-primary text-white border-primary shadow-sm scale-[1.03]"
                          : "bg-surface-container-low text-on-surface-variant border-transparent hover:border-outline-variant/50 hover:text-on-surface"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">{a.icon}</span>
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Card 3.5: PG / Hostel Specifics (conditional) ── */}
            {/*
              Uses a CSS max-height transition for a smooth slide-in/out effect.
              We avoid Framer Motion to keep bundle size zero and stay framework-agnostic.
            */}
            <div
              style={{
                maxHeight: (propertyType === "pg" || propertyType === "hostel") ? "600px" : "0px",
                opacity:   (propertyType === "pg" || propertyType === "hostel") ? 1 : 0,
                overflow:  "hidden",
                transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease",
              }}
              aria-hidden={propertyType !== "pg" && propertyType !== "hostel"}
            >
              <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/60 dark:border-amber-800/30 rounded-2xl p-6 shadow-ambient flex flex-col gap-5">
                {/* Accent stripe */}
                <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b from-amber-400 to-orange-400 opacity-60" />

                <SectionHeader
                  icon="corporate_fare"
                  title="PG / Hostel Specifics"
                  subtitle="Additional details for managed accommodations"
                />

                {/* PG-specific amenity pills */}
                <div className="flex flex-col gap-2">
                  <FormLabel>Included Services</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {PG_HOSTEL_AMENITY_OPTIONS.map((a) => {
                      const active = amenities.includes(a.label);
                      return (
                        <button
                          key={a.label}
                          type="button"
                          onClick={() => toggleAmenity(a.label)}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-body font-medium transition-all duration-200 border ${
                            active
                              ? "bg-amber-500 text-white border-amber-500 shadow-sm scale-[1.03]"
                              : "bg-white/60 dark:bg-surface-container-low text-on-surface-variant border-amber-200/60 dark:border-transparent hover:border-amber-300 hover:text-on-surface"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{a.icon}</span>
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Food menu / routines textarea */}
                <div className="flex flex-col gap-2">
                  <FormLabel htmlFor="custom-details">Food Menu &amp; Daily Routines</FormLabel>
                  <textarea
                    id="custom-details"
                    placeholder="e.g. Breakfast 8–9 AM (Roti + sabzi), Lunch 1–2 PM, Dinner 8 PM. Weekly off on Sundays. Lights out by 11 PM…"
                    rows={4}
                    value={customDetails}
                    onChange={(e) => setCustomDetails(e.target.value)}
                    className="w-full bg-white/60 dark:bg-surface-container-low border border-amber-200/50 dark:border-transparent rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-amber-400/40 focus:outline-none transition-shadow font-body resize-none"
                  />
                  <p className="text-[11px] text-on-surface-variant font-body flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-amber-500">info</span>
                    This is saved as a note visible to seekers on the listing detail page. (Optional)
                  </p>
                </div>
              </div>
            </div>

            {/* ── Card 4: House Rules ── */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-ambient flex flex-col gap-5">
              <SectionHeader icon="gavel" title="House Rules" subtitle="Set your preferences for tenants" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="flex flex-col gap-2">
                  <FormLabel>Food</FormLabel>
                  <Toggle options={["Veg", "Any"]} value={food} onChange={setFood} />
                </div>
                <div className="flex flex-col gap-2">
                  <FormLabel>Smoking</FormLabel>
                  <Toggle options={["Allowed", "Not Allowed"]} value={smoking} onChange={setSmoking} />
                </div>
                <div className="flex flex-col gap-2">
                  <FormLabel>Drinking</FormLabel>
                  <Toggle options={["Allowed", "Not Allowed"]} value={drinking} onChange={setDrinking} />
                </div>
                <div className="flex flex-col gap-2">
                  <FormLabel htmlFor="preferred-tenant">Preferred Tenant</FormLabel>
                  <StyledSelect
                    id="preferred-tenant"
                    value={preferredTenant}
                    onChange={setPreferredTenant}
                    options={[
                      { label: "Anyone", value: "Anyone" },
                      { label: "Students", value: "Students" },
                      { label: "Professionals", value: "Professionals" },
                      { label: "Families", value: "Families" },
                    ]}
                    placeholder="Select…"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <FormLabel htmlFor="curfew">Curfew</FormLabel>
                <StyledSelect
                  id="curfew"
                  value={curfew}
                  onChange={setCurfew}
                  options={[
                    { label: "No Curfew", value: "No Curfew" },
                    { label: "9 PM", value: "9 PM" },
                    { label: "10 PM", value: "10 PM" },
                    { label: "11 PM", value: "11 PM" },
                  ]}
                  placeholder="Select…"
                />
              </div>
            </div>

            {/* ── Card 5: Map Location Picker ── */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-ambient flex flex-col gap-4">
              <SectionHeader
                icon="map"
                title="Pin Your Location"
                subtitle="Click anywhere on the map or detect automatically"
              />

              {/* Detect location button */}
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="flex items-center gap-2 self-start px-4 py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-body font-semibold hover:bg-primary/20 active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:scale-100"
              >
                {isDetectingLocation ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Detecting…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">my_location</span>
                    Detect My Location
                  </>
                )}
              </button>

              {/* Map */}
              <div className="w-full h-64 rounded-xl overflow-hidden ring-2 ring-outline-variant/30">
                <MapPicker
                  lat={latitude}
                  lng={longitude}
                  onLocationChange={(lat, lng) => { setLatitude(lat); setLongitude(lng); }}
                />
              </div>

              {/* Coordinates display */}
              {latitude !== null && longitude !== null && (
                <div className="flex items-center gap-2 text-xs text-on-surface-variant font-body bg-surface-container-low rounded-xl px-4 py-2.5">
                  <span className="material-symbols-outlined text-[14px] text-primary">pin_drop</span>
                  <span>
                    <span className="font-semibold text-on-surface">Pinned:</span>{" "}
                    {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </span>
                </div>
              )}
            </div>

            {/* ── Card 6: Photos ── */}
            <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-ambient flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <SectionHeader icon="photo_library" title="Photos" subtitle="Up to 8 photos (first is cover)" />
                {selectedFiles.length > 0 && (
                  <span className="text-xs text-outline font-body mb-5">{selectedFiles.length} / 8</span>
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

              {selectedFiles.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {previewUrls.map((url, idx) => (
                    <div key={url} className="relative aspect-square rounded-xl overflow-hidden group/thumb">
                      <Image src={url} alt={`Preview ${idx + 1}`} fill className="object-cover" sizes="100px" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity hover:bg-error"
                        aria-label="Remove image"
                      >
                        <span className="material-symbols-outlined text-[12px]">close</span>
                      </button>
                      {idx === 0 && (
                        <div className="absolute bottom-1 left-1 bg-primary/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                          Cover
                        </div>
                      )}
                    </div>
                  ))}
                  {selectedFiles.length < 8 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-outline-variant/50 bg-surface-container-low/50 flex flex-col items-center justify-center gap-1 hover:bg-surface-container-low transition-colors text-outline"
                      aria-label="Add more photos"
                    >
                      <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
                      <span className="text-[10px] font-medium">Add</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-outline-variant/50 rounded-2xl bg-surface-container-low/50 p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-surface-container-low transition-colors group"
                >
                  <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-on-surface">Click to upload photos</p>
                    <p className="text-xs text-outline mt-1">Up to 8 photos · PNG, JPG or WebP</p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Publish Button ── */}
            <button
              className="w-full bg-gradient-to-br from-primary to-primary-container text-white font-headline font-semibold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:scale-100"
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <><Spinner /> Publishing…</>
              ) : (
                <>Publish Listing <span className="material-symbols-outlined text-sm">arrow_forward</span></>
              )}
            </button>
          </form>
        </section>

        {/* ══ Section B: Active Listings ══ */}
        <section id="active-listings" className="w-full lg:w-7/12 flex flex-col gap-6 mt-8 lg:mt-0">
          <div className="flex flex-row items-center justify-between mb-2">
            <div className="flex flex-col gap-2">
              <h2 className="text-[1.75rem] font-headline font-semibold tracking-tight text-on-surface">
                Active Listings
              </h2>
              <p className="text-on-surface-variant font-body text-sm">
                {isLoading
                  ? "Loading…"
                  : `Manage your ${listings.length} active ${listings.length === 1 ? "property" : "properties"}.`}
              </p>
            </div>
            <button
              onClick={fetchListings}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-surface-container-high text-on-surface rounded-full text-sm font-medium hover:bg-surface-container-highest transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="material-symbols-outlined text-6xl text-outline/40 mb-4">add_home</span>
              <h3 className="font-headline font-semibold text-lg text-on-surface mb-2">No listings yet</h3>
              <p className="text-sm text-on-surface-variant max-w-xs">
                Post your first room using the form to see it appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {listings.map((room) => (
                <div
                  key={room.id}
                  className="bg-surface-container-lowest rounded-2xl overflow-hidden flex flex-col shadow-[0_10px_30px_rgba(70,72,212,0.03)] hover:shadow-ambient transition-all duration-300 group"
                >
                  <div className="relative h-48 w-full overflow-hidden p-2">
                    {room.image_url ? (
                      <Image
                        alt={room.title}
                        className="w-full h-full object-cover rounded-xl group-hover:scale-105 transition-transform duration-700 ease-out"
                        src={room.image_url}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-surface-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-outline/40">image</span>
                      </div>
                    )}
                    <div className="absolute top-4 right-4 bg-surface-container-lowest/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-semibold text-primary flex items-center gap-1 shadow-sm z-10">
                      <span className="w-2 h-2 rounded-full bg-green-500" />
                      Active
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-headline font-semibold text-on-surface line-clamp-1">
                          {room.title}
                        </h3>
                        <p className="text-sm text-on-surface-variant flex items-center gap-1 mt-1">
                          <span className="material-symbols-outlined text-[16px] text-outline">location_on</span>
                          {room.location}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-surface-container/50">
                      <div className="font-headline font-bold text-lg text-primary">
                        ₹{room.price?.toLocaleString("en-IN")}
                        <span className="text-xs text-on-surface-variant font-body font-normal">/mo</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(room.id)}
                          className="w-8 h-8 rounded-full bg-error-container/50 flex items-center justify-center text-error hover:bg-error-container transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav activeTab="Profile" />
    </div>
  );
}
