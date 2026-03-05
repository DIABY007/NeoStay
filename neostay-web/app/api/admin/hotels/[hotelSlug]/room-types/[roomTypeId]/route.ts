import { NextResponse } from "next/server";

import { ensureHotelAdminForSlug } from "@/lib/auth/hotel-admin";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ hotelSlug: string; roomTypeId: string }> };

type UpdateRoomTypeBody = {
  name?: string;
  description?: string;
  pricePerNight?: number;
  pricePerDay?: number | null;
  dayStartTime?: string | null;
  dayEndTime?: string | null;
  nightStartTime?: string | null;
  nightEndTime?: string | null;
  hourlyRates?: unknown;
  dailyRates?: unknown;
  totalQuantity?: number;
};

type HourlyRateTier = {
  hours: number;
  price: number;
};

type DailyRateTier = {
  days: number;
  price: number;
};

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeTimeLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const short = trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
  return HHMM_PATTERN.test(short) ? short : null;
}

function parseHourlyRates(raw: unknown): { ok: true; value: HourlyRateTier[] } | { ok: false; error: string } {
  const source = raw ?? [];
  if (!Array.isArray(source)) {
    return { ok: false, error: "Tarifs horaires invalides (tableau attendu)." };
  }

  const seenHours = new Set<number>();
  const parsed: HourlyRateTier[] = [];

  for (const item of source) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Tarifs horaires invalides." };
    }

    const candidate = item as { hours?: unknown; price?: unknown };
    const hours = Number(candidate.hours);
    const price = Number(candidate.price);

    if (!Number.isInteger(hours) || hours <= 0 || hours > 24) {
      return { ok: false, error: "Chaque palier horaire doit avoir un nombre d'heures entier (1 a 24)." };
    }

    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: "Chaque palier horaire doit avoir un tarif valide." };
    }

    if (seenHours.has(hours)) {
      return { ok: false, error: "Chaque palier horaire doit avoir une duree unique." };
    }

    seenHours.add(hours);
    parsed.push({ hours, price });
  }

  parsed.sort((a, b) => a.hours - b.hours);
  return { ok: true, value: parsed };
}

function parseDailyRates(raw: unknown): { ok: true; value: DailyRateTier[] } | { ok: false; error: string } {
  const source = raw ?? [];
  if (!Array.isArray(source)) {
    return { ok: false, error: "Tarifs journaliers invalides (tableau attendu)." };
  }

  const seenDays = new Set<number>();
  const parsed: DailyRateTier[] = [];

  for (const item of source) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Tarifs journaliers invalides." };
    }

    const candidate = item as { days?: unknown; price?: unknown };
    const days = Number(candidate.days);
    const price = Number(candidate.price);

    if (!Number.isInteger(days) || days <= 0 || days > 30) {
      return { ok: false, error: "Chaque palier journalier doit avoir un nombre de jours entier (1 a 30)." };
    }

    if (!Number.isFinite(price) || price < 0) {
      return { ok: false, error: "Chaque palier journalier doit avoir un tarif valide." };
    }

    if (seenDays.has(days)) {
      return { ok: false, error: "Chaque palier journalier doit avoir une duree unique." };
    }

    seenDays.add(days);
    parsed.push({ days, price });
  }

  parsed.sort((a, b) => a.days - b.days);
  return { ok: true, value: parsed };
}

export async function PATCH(request: Request, { params }: Params) {
  const { hotelSlug, roomTypeId } = await params;
  const auth = await ensureHotelAdminForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as UpdateRoomTypeBody;

  const payload: {
    name?: string;
    description?: string | null;
    price_per_night?: number;
    price_per_day?: number | null;
    day_start_time?: string | null;
    day_end_time?: string | null;
    night_start_time?: string | null;
    night_end_time?: string | null;
    hourly_rates?: HourlyRateTier[];
    daily_rates?: DailyRateTier[];
    total_quantity?: number;
  } = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 2) {
      return NextResponse.json(
        { success: false, error: "Nom invalide (min 2 caracteres)." },
        { status: 400 },
      );
    }
    payload.name = name;
  }

  if (body.description !== undefined) {
    payload.description = body.description.trim() || null;
  }

  if (body.pricePerNight !== undefined) {
    const pricePerNight = Number(body.pricePerNight);
    if (!Number.isFinite(pricePerNight) || pricePerNight < 0) {
      return NextResponse.json(
        { success: false, error: "Prix par nuit invalide." },
        { status: 400 },
      );
    }
    payload.price_per_night = pricePerNight;
  }

  if (body.pricePerDay !== undefined) {
    if (body.pricePerDay === null) {
      payload.price_per_day = null;
    } else {
      const pricePerDay = Number(body.pricePerDay);
      if (!Number.isFinite(pricePerDay) || pricePerDay < 0) {
        return NextResponse.json(
          { success: false, error: "Prix par jour invalide." },
          { status: 400 },
        );
      }
      payload.price_per_day = pricePerDay;
    }
  }

  if (body.dayStartTime !== undefined) {
    payload.day_start_time = normalizeTimeLabel(body.dayStartTime);
  }

  if (body.dayEndTime !== undefined) {
    payload.day_end_time = normalizeTimeLabel(body.dayEndTime);
  }

  if (body.nightStartTime !== undefined) {
    payload.night_start_time = normalizeTimeLabel(body.nightStartTime);
  }

  if (body.nightEndTime !== undefined) {
    payload.night_end_time = normalizeTimeLabel(body.nightEndTime);
  }

  if (body.hourlyRates !== undefined) {
    const hourlyRatesResult = parseHourlyRates(body.hourlyRates);
    if (!hourlyRatesResult.ok) {
      return NextResponse.json(
        { success: false, error: hourlyRatesResult.error },
        { status: 400 },
      );
    }
    payload.hourly_rates = hourlyRatesResult.value;
  }

  if (body.dailyRates !== undefined) {
    const dailyRatesResult = parseDailyRates(body.dailyRates);
    if (!dailyRatesResult.ok) {
      return NextResponse.json(
        { success: false, error: dailyRatesResult.error },
        { status: 400 },
      );
    }
    payload.daily_rates = dailyRatesResult.value;
  }

  if (body.totalQuantity !== undefined) {
    const totalQuantity = Number(body.totalQuantity);
    if (!Number.isInteger(totalQuantity) || totalQuantity <= 0) {
      return NextResponse.json(
        { success: false, error: "Quantite totale invalide (entier > 0)." },
        { status: 400 },
      );
    }
    payload.total_quantity = totalQuantity;
  }

  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ success: false, error: "Aucun champ a modifier." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();

  if (
    payload.day_start_time !== undefined ||
    payload.day_end_time !== undefined ||
    payload.night_start_time !== undefined ||
    payload.night_end_time !== undefined ||
    payload.price_per_day !== undefined
  ) {
    const { data: existing, error: existingError } = await supabase
      .from("room_types")
      .select("day_start_time, day_end_time, night_start_time, night_end_time, price_per_day")
      .eq("id", roomTypeId)
      .eq("hotel_id", auth.hotelId)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json(
        { success: false, error: "Type de chambre introuvable." },
        { status: 404 },
      );
    }

    const effectiveDayStart =
      payload.day_start_time !== undefined ? payload.day_start_time : normalizeTimeLabel(existing.day_start_time);
    const effectiveDayEnd =
      payload.day_end_time !== undefined ? payload.day_end_time : normalizeTimeLabel(existing.day_end_time);
    const effectiveNightStart =
      payload.night_start_time !== undefined
        ? payload.night_start_time
        : normalizeTimeLabel(existing.night_start_time);
    const effectiveNightEnd =
      payload.night_end_time !== undefined ? payload.night_end_time : normalizeTimeLabel(existing.night_end_time);
    const effectivePricePerDay =
      payload.price_per_day !== undefined ? payload.price_per_day : Number(existing.price_per_day ?? NaN);

    if ((effectiveDayStart && !effectiveDayEnd) || (!effectiveDayStart && effectiveDayEnd)) {
      return NextResponse.json(
        { success: false, error: "Renseignez les deux horaires pour le tarif jour." },
        { status: 400 },
      );
    }

    if ((effectiveNightStart && !effectiveNightEnd) || (!effectiveNightStart && effectiveNightEnd)) {
      return NextResponse.json(
        { success: false, error: "Renseignez les deux horaires pour le tarif nuit." },
        { status: 400 },
      );
    }

    const hasDayWindow = Boolean(effectiveDayStart && effectiveDayEnd);
    if (hasDayWindow && !Number.isFinite(effectivePricePerDay)) {
      return NextResponse.json(
        { success: false, error: "Le tarif jour est requis quand une plage horaire jour est definie." },
        { status: 400 },
      );
    }
  }

  const { data, error } = await supabase
    .from("room_types")
    .update(payload)
    .eq("id", roomTypeId)
    .eq("hotel_id", auth.hotelId)
    .select(
      "id, name, description, price_per_night, price_per_day, day_start_time, day_end_time, night_start_time, night_end_time, hourly_rates, daily_rates, total_quantity, created_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { success: false, error: `Modification type de chambre impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, roomType: data });
}
