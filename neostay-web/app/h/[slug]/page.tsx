import Image from "next/image";
import { notFound } from "next/navigation";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { formatBurkinaPhone } from "@/lib/phone-bf";

import { BookingCatalog } from "./booking-catalog";
import { HotelAssistant } from "./hotel-assistant";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

function extractIframeSrc(input: string) {
  const iframeSrcMatch = input.match(/<iframe[^>]*\ssrc=["']([^"']+)["'][^>]*>/i);
  return iframeSrcMatch?.[1]?.trim() ?? null;
}

function isAllowedGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isGoogleHost = host === "www.google.com" || host === "google.com" || host === "maps.google.com";
    const isMapsPath = url.pathname.startsWith("/maps") || url.pathname.startsWith("/maps/embed");
    return url.protocol === "https:" && isGoogleHost && isMapsPath;
  } catch {
    return false;
  }
}

function normalizeGoogleMapsEmbedInput(input: string | null) {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = trimmed.includes("<iframe") ? extractIframeSrc(trimmed) : trimmed;
  if (!candidate || !isAllowedGoogleMapsUrl(candidate)) {
    return null;
  }

  return candidate;
}

export default async function PublicHotelPage({ params }: Props) {
  const { slug } = await params;
  const supabase = createSupabaseServiceRoleClient();

  const { data: hotel, error: hotelError } = await supabase
    .from("hotels")
    .select(
      "id, name, slug, description, hero_title, hero_subtitle, theme_color, theme_template, logo_url, whatsapp_number, status, map_embed_html",
    )
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (hotelError || !hotel) {
    notFound();
  }

  const { data: roomTypes, error: roomError } = await supabase
    .from("room_types")
    .select(
      "id, name, description, primary_image_url, secondary_image_urls, price_per_night, price_per_day, day_start_time, day_end_time, night_start_time, night_end_time, hourly_rates, total_quantity",
    )
    .eq("hotel_id", hotel.id)
    .order("created_at", { ascending: false });

  if (roomError) {
    throw new Error(`Impossible de charger les chambres: ${roomError.message}`);
  }

  const safeRoomTypes = (roomTypes ?? []).map((roomType) => ({
    id: roomType.id,
    name: roomType.name,
    description: roomType.description,
    primaryImageUrl: roomType.primary_image_url,
    secondaryImageUrls: Array.isArray(roomType.secondary_image_urls) ? roomType.secondary_image_urls : [],
    pricePerNight: Number(roomType.price_per_night),
    pricePerDay: roomType.price_per_day === null ? null : Number(roomType.price_per_day),
    dayStartTime: roomType.day_start_time,
    dayEndTime: roomType.day_end_time,
    nightStartTime: roomType.night_start_time,
    nightEndTime: roomType.night_end_time,
    hourlyRates: Array.isArray(roomType.hourly_rates) ? roomType.hourly_rates : [],
    dailyRates: [],
    totalQuantity: Number(roomType.total_quantity),
  }));

  const mapEmbedUrl = normalizeGoogleMapsEmbedInput(hotel.map_embed_html);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <section className="mx-auto mb-6 max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div
          className="px-8 py-10"
          style={{
            background: `linear-gradient(135deg, ${hotel.theme_color}20, #ffffff)`,
          }}
        >
          <p className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
            NeoStay - Reservation directe
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {hotel.hero_title || hotel.name}
              </h1>
              <p className="mt-2 text-slate-700">
                {hotel.hero_subtitle || "Reservez votre sejour en quelques clics."}
              </p>
            </div>

            {hotel.logo_url && (
              <Image
                src={hotel.logo_url}
                alt={`Logo ${hotel.name}`}
                className="h-16 w-16 rounded-xl border border-white/70 bg-white object-cover"
                width={64}
                height={64}
              />
            )}
          </div>

          {hotel.description && <p className="mt-5 max-w-3xl text-sm text-slate-700">{hotel.description}</p>}

          <p className="mt-4 text-xs text-slate-500">
            WhatsApp reception: {formatBurkinaPhone(hotel.whatsapp_number)}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl">
        <BookingCatalog hotelSlug={slug} roomTypes={safeRoomTypes} />
      </section>

      <section className="mx-auto mt-6 max-w-5xl">
        <HotelAssistant hotelSlug={slug} hotelName={hotel.name} />
      </section>

      {mapEmbedUrl && (
        <section className="mx-auto mt-6 max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Localisation</p>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Trouver facilement l&apos;hotel</h2>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <iframe
              title={`Carte Google Maps - ${hotel.name}`}
              src={mapEmbedUrl}
              className="h-72 w-full md:h-80"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </section>
      )}
    </main>
  );
}
