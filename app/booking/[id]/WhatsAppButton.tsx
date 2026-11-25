"use client";

import { useTransition } from "react";
import { trackWhatsAppClick } from "@/app/actions/booking";

interface WhatsAppButtonProps {
  bookingId: string;
  whatsappLink: string;
}

export default function WhatsAppButton({ bookingId, whatsappLink }: WhatsAppButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // We let the link open natively in a new tab, but track the intent in parallel
    startTransition(() => {
      trackWhatsAppClick(bookingId);
    });
  };

  return (
    <a
      href={whatsappLink}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="bg-green-600 hover:bg-green-700 text-white"
      style={{
        display: "inline-block",
        padding: "10px 20px",
        borderRadius: 10,
        fontWeight: 600,
        fontSize: 14,
        textDecoration: "none",
        transition: "background 0.2s",
        boxShadow: "0 4px 12px rgba(34,197,94,0.2)",
      }}
    >
      💬 Chat with Owner on WhatsApp
    </a>
  );
}
