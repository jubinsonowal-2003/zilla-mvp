"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import TopAppBar from "../../components/TopAppBar";
import BottomNav from "../../components/BottomNav";
import { supabase } from "@/lib/supabase";

const AVATAR_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBgyJm2UjeOTYSloBNtAfGng2YGbcAezqi7U0vV4CEIRGhpFw59XVGUS2guACo-zTOCMoMk1XVw0xDd6YTdlyXEB3wEmGF8SiI8Bu_Sk1OoUQtYHjh6hOMPh2gqu_InBJztB996SSz4kenNaNtP1fdF7EQlNdTceOkZtr6f5oYoxkQi84paDTq_kYSyKtBLNhXlHeWk2AbbNsT3O7LiMsBL7Dq02AMp0j1gPGDs6vV5MA01on6GZHvE4iUyR007qJpJiXNcZCdOwig";

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

export default function OwnerDashboard() {
  // Form state
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [isPublishing, setIsPublishing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [listings, setListings] = useState<Room[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch listings
  const fetchListings = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching listings:", error);
    } else {
      setListings(data || []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  // Handle publish
  const handlePublish = async () => {
    if (!title.trim() || !price.trim() || !location.trim()) {
      showToast("Please fill in Title, Price, and Location", "error");
      return;
    }

    setIsPublishing(true);

    try {
      // MVP Session Hack: generate or reuse a unique session ID
      let sessionId = localStorage.getItem("zilla_session_id");
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("zilla_session_id", sessionId);
      }

      let imageUrl: string | null = null;

      // 1. Upload image to Supabase Storage if selected
      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("room-images")
          .upload(fileName, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }

        // 2. Get public URL
        const { data: urlData } = supabase.storage
          .from("room-images")
          .getPublicUrl(fileName);

        imageUrl = urlData.publicUrl;
      }

      // 3. Insert room data into the rooms table
      const payload = {
        user_id: sessionId,
        title: title.trim(),
        price: parseInt(price),
        location: location.trim(),
        description: description.trim(),
        image_url: imageUrl,
        status: "active",
      };

      console.log("[ZILLA] Inserting room:", payload);

      const { data, error: insertError } = await supabase
        .from("rooms")
        .insert(payload)
        .select();

      if (insertError) {
        console.error("[ZILLA] Room insert failed:", {
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
          code: insertError.code,
        });
        throw new Error(`Failed to save listing: ${insertError.message}`);
      }

      console.log("[ZILLA] Room saved successfully:", data);

      showToast("Listing published successfully!", "success");

      // Reset form
      setTitle("");
      setPrice("");
      setLocation("");
      setDescription("");
      setSelectedFile(null);
      setPreviewUrl(null);

      // Refresh listings
      fetchListings();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Something went wrong",
        "error"
      );
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) {
      showToast("Failed to delete listing", "error");
    } else {
      showToast("Listing deleted", "success");
      fetchListings();
    }
  };

  return (
    <div className="bg-surface text-on-surface font-body min-h-dvh flex flex-col pb-28 md:pb-0 pt-24 md:pt-32">
      <TopAppBar avatarUrl={AVATAR_URL} showSearch label="Owner Dashboard" />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-xl shadow-lg font-body text-sm font-medium flex items-center gap-2 ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-error text-on-error"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {toast.type === "success" ? "check_circle" : "error"}
          </span>
          {toast.message}
        </div>
      )}

      <main className="flex-grow max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row gap-8 xl:gap-12">
        {/* Section A: Post a Room */}
        <section className="w-full lg:w-5/12 flex-shrink-0 flex flex-col gap-6">
          <div className="flex flex-col gap-2 mb-2">
            <h1 className="text-[1.75rem] font-headline font-semibold tracking-tight text-on-surface">
              Post a Room
            </h1>
            <p className="text-on-surface-variant font-body text-sm">
              Add a new listing to your portfolio.
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 shadow-ambient flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

            <form
              className="flex flex-col gap-5 z-10"
              onSubmit={(e) => e.preventDefault()}
            >
              {/* Room Title */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="room-title">
                  Room Title
                </label>
                <input
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body"
                  id="room-title"
                  placeholder="e.g. Modern Loft in Downtown"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              {/* Price & Location */}
              <div className="flex flex-col sm:flex-row gap-5">
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="price">
                    Price (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline text-sm">₹</span>
                    <input
                      className="w-full bg-surface-container-low border-none rounded-xl pl-8 pr-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body"
                      id="price"
                      placeholder="15,000"
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <label className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="location">
                    Location
                  </label>
                  <input
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body"
                    id="location"
                    placeholder="Neighborhood, City"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant" htmlFor="description">
                  Description
                </label>
                <textarea
                  className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary/40 focus:outline-none transition-shadow font-body resize-none"
                  id="description"
                  placeholder="Describe the best features of this space..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* Photos Upload */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-label font-semibold uppercase tracking-wider text-on-surface-variant">
                  Photos
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-outline-variant/50 rounded-2xl bg-surface-container-low/50 p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-surface-container-low transition-colors group relative overflow-hidden"
                >
                  {previewUrl ? (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden">
                      <Image
                        src={previewUrl}
                        alt="Preview"
                        fill
                        className="object-cover"
                        sizes="400px"
                      />
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <span className="text-white text-sm font-medium bg-black/40 px-3 py-1 rounded-full">
                          Click to change
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-full bg-primary-container/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined text-2xl">
                          cloud_upload
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-on-surface">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-outline mt-1">
                          PNG, JPG or WebP (max. 5MB)
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Publish Button */}
              <button
                className="mt-4 w-full bg-gradient-to-br from-primary to-primary-container text-white font-headline font-semibold py-4 rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:scale-100"
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Publishing...
                  </>
                ) : (
                  <>
                    Publish Listing
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </section>

        {/* Section B: Active Listings */}
        <section className="w-full lg:w-7/12 flex flex-col gap-6 mt-8 lg:mt-0">
          <div className="flex flex-row items-center justify-between mb-2">
            <div className="flex flex-col gap-2">
              <h2 className="text-[1.75rem] font-headline font-semibold tracking-tight text-on-surface">
                Active Listings
              </h2>
              <p className="text-on-surface-variant font-body text-sm">
                {isLoading
                  ? "Loading..."
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
              <span className="material-symbols-outlined text-6xl text-outline/40 mb-4">
                add_home
              </span>
              <h3 className="font-headline font-semibold text-lg text-on-surface mb-2">
                No listings yet
              </h3>
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
                        <span className="material-symbols-outlined text-4xl text-outline/40">
                          image
                        </span>
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
                          <span className="material-symbols-outlined text-[16px] text-outline">
                            location_on
                          </span>
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
