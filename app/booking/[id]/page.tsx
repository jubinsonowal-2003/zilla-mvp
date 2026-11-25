import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Booking | ZILLA",
  description: "Your active booking ticket and secure visit code.",
};

import { getBookingDetails } from "@/app/actions/booking";
import WhatsAppButton from "./WhatsAppButton";
export default async function BookingTicketPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const { code } = await searchParams;

  const { data: bookingData } = await getBookingDetails(id);
  
  // Use DB secure_code if available, otherwise fallback to searchParams or "----"
  const rawCode = bookingData?.secure_code || (typeof code === "string" ? code : "----");
  const secureCode = String(rawCode);
  const codeDigits = secureCode.padStart(4, "-").slice(0, 4).split("");

  // Dynamically get owner's phone number
  const rawOwnerPhone = (bookingData?.rooms as any)?.owner_phone || (bookingData?.rooms as any)?.phone || "9365497834";
  const cleanedPhone = String(rawOwnerPhone).replace(/\D/g, "");
  const whatsappNumber = cleanedPhone.startsWith("91") ? cleanedPhone : `91${cleanedPhone}`;
  const whatsappText = "Hi, I have a confirmed visit scheduled for your property through ZILLA. Can you share the exact location map?";
  const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
        fontFamily: "Inter, Helvetica Neue, sans-serif",
        color: "#e8e8f0",
        padding: "0 0 60px",
      }}
    >
      {/* Top Nav */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          backdropFilter: "blur(12px)",
          background: "rgba(255,255,255,0.03)",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
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
              letterSpacing: "-1px",
            }}
          >
            Z
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.5px" }}>ZILLA</span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: "rgba(200,200,220,0.5)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          Booking #{id.slice(0, 8)}
        </span>
      </header>

      <main style={{ maxWidth: 480, margin: "0 auto", padding: "32px 20px 0" }}>

        {/* STATUS BANNER */}
        <div
          style={{
            borderRadius: 20,
            background: "linear-gradient(135deg, rgba(108,99,255,0.18) 0%, rgba(167,139,250,0.12) 100%)",
            border: "1px solid rgba(167,139,250,0.25)",
            padding: "24px 24px 20px",
            marginBottom: 24,
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -40,
              left: "50%",
              transform: "translateX(-50%)",
              width: 200,
              height: 100,
              borderRadius: "50%",
              background: "rgba(108,99,255,0.15)",
              filter: "blur(40px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: bookingData?.status === "locked_awaiting_docs" ? "rgba(79,70,229,0.12)" : bookingData?.status === "visit_scheduled" ? "rgba(34,197,94,0.12)" : "rgba(255,190,60,0.12)",
              border: `1px solid ${bookingData?.status === "locked_awaiting_docs" ? "rgba(79,70,229,0.3)" : bookingData?.status === "visit_scheduled" ? "rgba(34,197,94,0.3)" : "rgba(255,190,60,0.3)"}`,
              borderRadius: 100,
              padding: "6px 14px",
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 14 }}>{bookingData?.status === "locked_awaiting_docs" ? "🔒" : bookingData?.status === "visit_scheduled" ? "📅" : "⏳"}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: bookingData?.status === "locked_awaiting_docs" ? "#818cf8" : bookingData?.status === "visit_scheduled" ? "#4ade80" : "#fbbf24", letterSpacing: "0.03em" }}>
              {bookingData?.status === "locked_awaiting_docs" 
                ? "Room Locked & Secured"
                : bookingData?.status === "visit_scheduled" && bookingData?.visit_time
                ? `Visit Confirmed: ${new Date(bookingData.visit_time).toLocaleString("en-IN", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" })}`
                : "Matching Schedules · ETA: 1 Hour"}
            </span>
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: "-0.5px",
              marginBottom: 10,
              lineHeight: 1.3,
              color: "#f0f0ff",
            }}
          >
            {bookingData?.status === "locked_awaiting_docs" ? "Welcome to your new home! 🎉" : bookingData?.status === "visit_scheduled" ? "Visit Scheduled! 🎉" : "Awesome! We've got your request 🎉"}
          </h1>
          <p style={{ fontSize: 14, color: "rgba(200,200,230,0.75)", lineHeight: 1.6, maxWidth: 360, margin: "0 auto" }}>
            {bookingData?.status === "locked_awaiting_docs" 
              ? "Your room is officially locked! Please go to your dashboard to complete KYC verification and deposit."
              : bookingData?.status === "visit_scheduled" 
              ? "Your visit is locked in. Be sure to arrive on time and have your Golden Key ready to share if you like the room!"
              : "Hold tight while we sync with the owner and lock in your visit slot. You'll hear from us very soon."}
          </p>
        </div>

        {/* GOLDEN KEY */}
        <div
          style={{
            borderRadius: 20,
            background: "linear-gradient(145deg, #1e1e3a 0%, #1a1a30 100%)",
            border: "1px solid rgba(255,213,100,0.2)",
            padding: "28px 24px 24px",
            marginBottom: 16,
            textAlign: "center",
            boxShadow: "0 0 40px rgba(255,190,60,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 18 }}>
            <span style={{ fontSize: 20 }}>🔑</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "rgba(255,213,100,0.8)",
              }}
            >
              Your Golden Key
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 14 }}>
            {codeDigits.map((digit, i) => (
              <div
                key={i}
                style={{
                  width: 68,
                  height: 80,
                  borderRadius: 14,
                  background: "linear-gradient(145deg, rgba(255,213,100,0.12), rgba(255,170,0,0.06))",
                  border: "1.5px solid rgba(255,213,100,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 36,
                  fontWeight: 900,
                  color: "#ffd564",
                  boxShadow: "0 4px 20px rgba(255,190,60,0.1), inset 0 1px 0 rgba(255,255,255,0.05)",
                }}
              >
                {digit}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "rgba(200,200,220,0.5)", letterSpacing: "0.05em" }}>
            Secure Code · Booking ID:{" "}
            <span style={{ color: "rgba(200,200,220,0.75)", fontFamily: "monospace" }}>
              {id.slice(0, 12)}…
            </span>
          </p>
        </div>

        {/* WARNING BOX */}
        <div
          style={{
            borderRadius: 16,
            background: "linear-gradient(135deg, rgba(255,80,60,0.1), rgba(255,120,50,0.07))",
            border: "1px solid rgba(255,100,60,0.3)",
            padding: "18px 20px",
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>⚠️</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#ff9d7a", marginBottom: 8 }}>
                DO NOT share this code just for visiting.
              </p>
              <p style={{ fontSize: 12.5, color: "rgba(255,180,150,0.85)", lineHeight: 1.65 }}>
                Share this code with the owner{" "}
                <strong style={{ color: "#ff9d7a" }}>ONLY IF you like the room</strong> and decide to finalize it.
                Handing over this code acts as your{" "}
                <strong style={{ color: "#ff9d7a" }}>digital signature</strong> to officially lock the room
                in your name and securely transfer your deposit.
              </p>
            </div>
          </div>
        </div>

        {/* MAGIC WINDOW */}
        <div
          style={{
            borderRadius: 20,
            background: "linear-gradient(145deg, #1a1a2e, #16213e)",
            border: "1px solid rgba(108,99,255,0.2)",
            padding: "28px 24px",
            marginBottom: 24,
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: "rgba(34,197,94,0.15)",
              border: "1.5px solid rgba(34,197,94,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              marginBottom: 12,
            }}
          >
            💬
          </div>
          <p style={{ fontWeight: 700, fontSize: 16, color: "#c4b8ff", textAlign: "center", marginBottom: 8 }}>
            The Magic Window
          </p>
          <p className="text-sm text-gray-400 mb-4 text-center" style={{ maxWidth: 320 }}>
            Your visit is secured. Feel free to chat or WhatsApp call the owner to coordinate your arrival and confirm exact landmarks.
          </p>
          <WhatsAppButton bookingId={id} whatsappLink={whatsappLink} />
        </div>

        {/* TIMELINE */}
        <div
          style={{
            borderRadius: 20,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            padding: "22px 24px",
            marginBottom: 24,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(200,200,220,0.45)",
              marginBottom: 18,
            }}
          >
            What happens next
          </p>
          {(
            [
              { 
                icon: <span className="material-symbols-outlined text-[20px] text-green-400">check_circle</span>, 
                label: "Booking Requested", 
                done: true 
              },
              { 
                icon: bookingData?.status === "confirmed" || bookingData?.status === "completed"
                  ? <span className="material-symbols-outlined text-[20px] text-green-400">check_circle</span>
                  : <span className="material-symbols-outlined text-[20px] text-gray-400">schedule</span>, 
                label: "Owner Confirmation", 
                done: bookingData?.status === "confirmed" || bookingData?.status === "completed"
              },
              { 
                icon: bookingData?.status === "completed" 
                  ? <span className="material-symbols-outlined text-[20px] text-green-400">check_circle</span>
                  : <span className="material-symbols-outlined text-[20px] text-gray-400">key</span>, 
                label: "Handover Golden Key", 
                done: bookingData?.status === "completed" 
              },
            ]
          ).map((step, i, arr) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: i < arr.length - 1 ? 16 : 0,
                opacity: step.done ? 1 : 0.65,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  background: step.done ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                  border: step.done ? "1.5px solid rgba(34,197,94,0.3)" : "1.5px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {step.icon}
              </div>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: step.done ? 600 : 400,
                  color: step.done ? "#e0e0f0" : "rgba(200,200,220,0.6)",
                }}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* SUPPORT */}
        <div
          style={{
            borderRadius: 16,
            background: "rgba(108,99,255,0.08)",
            border: "1px solid rgba(108,99,255,0.18)",
            padding: "18px 22px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 14,
              background: "rgba(108,99,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
            }}
          >
            💬
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 3, color: "#d0d0f0" }}>
              Need help? We&apos;re here for you.
            </p>
            <p style={{ fontSize: 12, color: "rgba(180,180,210,0.6)", lineHeight: 1.5 }}>
              ZILLA Support · Available 24 × 7 ·{" "}
              <a href="mailto:support@zilla.in" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: 600 }}>
                support@zilla.in
              </a>
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}