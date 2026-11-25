"use client";

import TopAppBar from "@/app/components/TopAppBar";
import MyBookingsList from "@/app/components/MyBookingsList";
import { Booking } from "@/app/components/MyBookingsList";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getSeekerBookings } from "@/app/actions/booking";

export default function MyBookingsPage() {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Basic check for avatar URL, similar to TopAppBar avatar fetch logic
    const zillaUserStr = localStorage.getItem("zillaUser");
    if (zillaUserStr) {
      try {
        const u = JSON.parse(zillaUserStr);
        if (u?.avatarUrl) setAvatarUrl(u.avatarUrl);
      } catch (e) {
        console.warn("Could not parse zillaUser");
      }
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setLoading(false);
        return;
      }

      // bookings.seeker_id references seeker_profiles.id, not the auth user directly.
      const { data: profile } = await supabase
        .from("seeker_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!profile) {
        setLoading(false);
        return;
      }

      const { success, data, error } = await getSeekerBookings(profile.id);

      if (!success) {
        console.error("Error fetching bookings via Server Action:", error);
        setLoading(false);
        return;
      }
      
      console.log("Fetched Bookings data:", data, "error:", error);

      const formattedBookings: Booking[] = (data || []).map((b: any) => {
        let mappedStatus: "Confirmed" | "Pending" | "Cancelled" | "Locked" = "Pending";
        if (b.status === "completed" || b.status === "visit_scheduled" || b.status === "confirmed") mappedStatus = "Confirmed";
        else if (b.status === "expired" || b.status === "declined" || b.status === "cancelled") mappedStatus = "Cancelled";
        else if (b.status === "locked_awaiting_docs") mappedStatus = "Locked";

        let dateStr = "TBD";
        let timeStr = "TBD";
        
        const dateObj = b.priority_date_1 ? new Date(b.priority_date_1) : (b.visit_time ? new Date(b.visit_time) : null);

        if (dateObj && !isNaN(dateObj.getTime())) {
          dateStr = dateObj.toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' });
          timeStr = dateObj.toLocaleTimeString("en-US", { hour: 'numeric', minute: 'numeric' });
        }
        
        const roomObj = Array.isArray(b.rooms) ? b.rooms[0] : b.rooms;
        let imageUrl = roomObj?.image_url;
        if (!imageUrl && roomObj?.image_urls?.length > 0) {
            imageUrl = roomObj.image_urls[0];
        }
        
        if (!imageUrl) {
            imageUrl = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?q=80&w=800&auto=format&fit=crop"; // placeholder
        }

        return {
          id: b.id,
          propertyName: roomObj?.title || "Unknown Property",
          propertyImage: imageUrl,
          location: roomObj?.location,
          visitDate: dateStr,
          visitTime: timeStr,
          status: mappedStatus,
        };
      });

      setBookings(formattedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) fetchBookings();
    });
    
    return () => {
        subscription?.unsubscribe();
    }
  }, [fetchBookings]);

  useEffect(() => {
    let channel: any;
    let isMounted = true;
    
    const setupRealtime = async () => {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || !isMounted) return;
        
        const { data: profile } = await supabase
          .from("seeker_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
          
        if (!profile || !isMounted) return;

        const channelName = `bookings_changes_${Date.now()}_${Math.random()}`;
        channel = supabase.channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'bookings',
                    filter: `seeker_id=eq.${profile.id}`,
                },
                (payload) => {
                    console.log("Realtime payload:", payload);
                    fetchBookings(); // re-fetch to get room details too
                }
            )
            .subscribe();

        // If unmounted while we were setting up the channel, remove it immediately
        if (!isMounted) {
            supabase.removeChannel(channel);
        }
    }
    
    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) {
          supabase.removeChannel(channel);
      }
    };
  }, [fetchBookings]);

  return (
    <div className="min-h-dvh bg-surface text-on-surface font-body selection:bg-primary/20">
      <TopAppBar 
        showBackButton 
        onBackClick={() => router.back()} 
        label="My Bookings"
        avatarUrl={avatarUrl}
      />
      
      <main className="pt-24 pb-20 px-4 md:px-8 max-w-7xl mx-auto animate-[fadeIn_0.3s_ease-out]">
        <header className="mb-10 text-center md:text-left">
          <button onClick={() => router.push("/dashboard/seeker")} className="flex items-center justify-center md:justify-start gap-1.5 text-primary hover:text-primary/80 transition-colors mb-4 md:mb-6 mx-auto md:mx-0 w-fit">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span className="font-semibold">Back to Dashboard</span>
          </button>
          <h1 className="text-4xl md:text-5xl font-headline font-bold text-primary dark:text-indigo-400 mb-4 tracking-tight">
            My Bookings
          </h1>
          <p className="text-lg text-on-surface-variant max-w-2xl mx-auto md:mx-0">
            Track your upcoming property visits and manage your schedules.
          </p>
        </header>

        {loading ? (
            <div className="flex justify-center items-center py-20">
                <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            </div>
        ) : (
            <MyBookingsList bookings={bookings} />
        )}
      </main>
    </div>
  );
}
