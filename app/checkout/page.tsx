"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface PendingBooking {
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  date1: string;
  date2: string;
  roomId: string;
  roomTitle: string;
  roomPrice: number;
  securityDeposit: number;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [booking, setBooking] = useState<PendingBooking | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("zilla_pending_booking");
    if (!raw) {
      router.replace("/dashboard/seeker");
      return;
    }
    try {
      setBooking(JSON.parse(raw));
    } catch {
      router.replace("/dashboard/seeker");
    }
  }, [router]);

  const lockFee = booking ? Math.round(booking.securityDeposit * 0.1) : 700;
  const rentDisplay = booking?.roomPrice ?? 7000;
  const depositDisplay = booking?.securityDeposit ?? 7000;

  const handlePay = async () => {
    if (isProcessing || !booking) return;
    setIsProcessing(true);
    setError(null);

    try {
      // ── Resolve (or auto-create) the seeker_profiles row ──────────────────
      // bookings.seeker_id is a FK → seeker_profiles.id, NOT auth.users.id.
      // Using the raw localStorage session ID here causes an FK violation.
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        setError("You must be logged in to complete this booking. Please log in and try again.");
        setIsProcessing(false);
        return;
      }

      // Try to find an existing profile first
      let { data: seekerProfile } = await supabase
        .from("seeker_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      // Auto-heal: no profile yet → insert a minimal placeholder row
      if (!seekerProfile) {
        console.log("[Checkout] No seeker_profiles row found — auto-creating a placeholder.");
        const { data: newProfile, error: insertError } = await supabase
          .from("seeker_profiles")
          .insert({
            user_id: user.id,
            full_name: booking.tenantName,
            // Use the email the user typed in the form; fall back to the auth session email
            email: booking.tenantEmail || user.email || "",
            budget_min: 0,
            budget_max: 100000,
            location: "",
            vibe: "",
            work_style: "",
          })
          .select("id")
          .single();

        if (insertError || !newProfile) {
          console.error("[Checkout] Failed to auto-create seeker profile:", insertError);
          setError("Could not set up your booking profile. Please complete onboarding and try again.");
          setIsProcessing(false);
          return;
        }
        seekerProfile = newProfile;
      }

      const seekerId = seekerProfile.id;

      // Simulate 2-second payment gateway delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { createBooking } = await import("@/app/actions/booking");
      const result = await createBooking({
        roomId: booking.roomId,
        seekerId,
        isPremium: true,
        tenantName: booking.tenantName,
        tenantPhone: booking.tenantPhone,
        tenantEmail: booking.tenantEmail,
        date1: booking.date1,
        date2: booking.date2,
      });

      if (!result.success) {
        setError(result.error ?? "Payment failed. Please try again.");
        setIsProcessing(false);
        return;
      }

      sessionStorage.removeItem("zilla_pending_booking");
      router.push("/booking/" + result.bookingId + "?code=" + result.secureCode);
    } catch (e) {
      setError("Something went wrong. Please try again.");
      setIsProcessing(false);
    }
  };

  // ─── Styles ──────────────────────────────────────────────────────────────
  const s = {
    page: {
      minHeight: "100dvh",
      background: "linear-gradient(135deg, #0a0a12 0%, #12121f 60%, #0f1520 100%)",
      fontFamily: "Inter, Helvetica Neue, sans-serif",
      color: "#e8e8f0",
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      padding: "0 16px 60px",
    } as React.CSSProperties,
    header: {
      width: "100%",
      maxWidth: 480,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "20px 0 24px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      marginBottom: 32,
    } as React.CSSProperties,
    logo: {
      display: "flex",
      alignItems: "center",
      gap: 10,
    } as React.CSSProperties,
    logoBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: "linear-gradient(135deg, #6c63ff, #a78bfa)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: 900,
      fontSize: 16,
      color: "#fff",
    } as React.CSSProperties,
    main: {
      width: "100%",
      maxWidth: 480,
    } as React.CSSProperties,
    card: {
      borderRadius: 20,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "24px",
      marginBottom: 16,
    } as React.CSSProperties,
    row: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontSize: 14,
      marginBottom: 12,
    } as React.CSSProperties,
    divider: {
      height: 1,
      background: "rgba(255,255,255,0.07)",
      margin: "16px 0",
    } as React.CSSProperties,
    totalRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    } as React.CSSProperties,
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 11,
      fontWeight: 600,
      padding: "5px 10px",
      borderRadius: 100,
    } as React.CSSProperties,
    payBtn: {
      width: "100%",
      padding: "18px",
      borderRadius: 16,
      border: "none",
      fontSize: 16,
      fontWeight: 800,
      letterSpacing: "-0.2px",
      cursor: isProcessing ? "not-allowed" : "pointer",
      background: isProcessing
        ? "linear-gradient(135deg, #4a4580, #5a5090)"
        : "linear-gradient(135deg, #6c63ff 0%, #a78bfa 100%)",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      transition: "all 0.2s ease",
      boxShadow: isProcessing
        ? "none"
        : "0 8px 32px rgba(108,99,255,0.4), 0 2px 8px rgba(0,0,0,0.3)",
      marginTop: 8,
    } as React.CSSProperties,
  };

  if (!booking) {
    return (
      <div style={{ ...s.page, justifyContent: "center" }}>
        <div style={{ fontSize: 14, color: "rgba(200,200,220,0.5)" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <header style={s.header}>
        <div style={s.logo}>
          <div style={s.logoBox}>Z</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.3px" }}>ZILLA</div>
            <div style={{ fontSize: 10, color: "rgba(200,200,220,0.4)", marginTop: -1, letterSpacing: "0.05em" }}>
              SECURE CHECKOUT
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "#4ade80",
            fontWeight: 600,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          SSL Secured
        </div>
      </header>

      <main style={s.main}>

        {/* ── Page Title ── */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.5px", marginBottom: 6 }}>
            Complete Your Booking
          </h1>
          <p style={{ fontSize: 13, color: "rgba(200,200,230,0.55)" }}>
            {booking.roomTitle ?? "Selected Room"} &bull; Lock for 5 Days
          </p>
        </div>

        {/* ── Order Summary ── */}
        <div style={s.card}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(200,200,220,0.4)",
              marginBottom: 18,
            }}
          >
            Order Summary
          </p>

          <div style={s.row}>
            <span style={{ color: "rgba(200,200,230,0.7)" }}>Room Rent</span>
            <span style={{ fontWeight: 600 }}>
              {rentDisplay.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
              <span style={{ fontSize: 11, color: "rgba(180,180,210,0.5)", marginLeft: 3 }}>/mo</span>
            </span>
          </div>

          <div style={s.row}>
            <span style={{ color: "rgba(200,200,230,0.7)" }}>Security Deposit</span>
            <span style={{ fontWeight: 600 }}>
              {depositDisplay.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
            </span>
          </div>

          <div style={s.divider} />

          <div style={s.totalRow}>
            <div>
              <div style={{ fontSize: 13, color: "rgba(200,200,230,0.6)", marginBottom: 2 }}>
                Amount to Pay Now
              </div>
              <div style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>
                10% Lock Fee &bull; 100% Refundable
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "-1px" }}>
              {lockFee.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* ── Trust Badges ── */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
            flexWrap: "wrap" as const,
          }}
        >
          {[
            { icon: "↩", label: "100% Refundable", color: "#4ade80", bg: "rgba(74,222,128,0.1)", border: "rgba(74,222,128,0.2)" },
            { icon: "✗", label: "No Brokerage", color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)" },
            { icon: "🔒", label: "Encrypted Payment", color: "#a78bfa", bg: "rgba(167,139,250,0.1)", border: "rgba(167,139,250,0.2)" },
          ].map((b) => (
            <div
              key={b.label}
              style={{
                ...s.badge,
                background: b.bg,
                border: `1px solid ${b.border}`,
                color: b.color,
                flex: 1,
                justifyContent: "center",
                minWidth: 100,
              }}
            >
              <span style={{ fontSize: 13 }}>{b.icon}</span>
              {b.label}
            </div>
          ))}
        </div>

        {/* ── Booking Details Summary ── */}
        <div
          style={{
            ...s.card,
            background: "rgba(108,99,255,0.06)",
            border: "1px solid rgba(108,99,255,0.15)",
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(167,139,250,0.5)",
              marginBottom: 14,
            }}
          >
            Your Details
          </p>
          {[
            { label: "Name", value: booking.tenantName },
            { label: "Phone", value: booking.tenantPhone },
            { label: "Email", value: booking.tenantEmail },
          ].map((item) => (
            <div key={item.label} style={{ ...s.row, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "rgba(180,180,210,0.55)" }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#d0d0f0" }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* ── Error ── */}
        {error && (
          <div
            style={{
              borderRadius: 12,
              background: "rgba(255,60,60,0.1)",
              border: "1px solid rgba(255,60,60,0.25)",
              padding: "12px 16px",
              fontSize: 13,
              color: "#ff9090",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* ── Pay Button ── */}
        <button onClick={handlePay} disabled={isProcessing} style={s.payBtn}>
          {isProcessing ? (
            <>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Processing Payment...
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Pay {lockFee.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })} Securely
            </>
          )}
        </button>

        {/* Spin keyframe via a hidden style tag */}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        <p
          style={{
            textAlign: "center",
            fontSize: 11,
            color: "rgba(160,160,190,0.4)",
            marginTop: 16,
            lineHeight: 1.5,
          }}
        >
          By paying, you agree to ZILLA&apos;s terms. This fee locks the room exclusively for you
          for 5 working days and is 100% refundable if you change your mind.
        </p>

      </main>
    </div>
  );
}