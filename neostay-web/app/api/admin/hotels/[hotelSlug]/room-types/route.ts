import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { ensureHotelAdminForSlug } from "@/lib/auth/hotel-admin";
import { compressImageForUpload } from "@/lib/image-processing";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ hotelSlug: string }> };

type CreateRoomTypeBody = {
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
  primaryImage?: File | null;
  secondaryImages?: File[];
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
const MAX_ROOM_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ROOM_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function getRoomPhotosBucketName() {
  return process.env.SUPABASE_ROOM_PHOTOS_BUCKET || "room-photos";
}

function parseOptionalNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

async function parseCreateBody(request: Request): Promise<CreateRoomTypeBody> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const primaryImageValue = formData.get("primaryImage");
    const secondaryImageValues = formData
      .getAll("secondaryImages")
      .filter((value): value is File => value instanceof File);

    const hourlyRatesRaw = formData.get("hourlyRates");
    let hourlyRates: unknown = [];
    if (typeof hourlyRatesRaw === "string" && hourlyRatesRaw.trim()) {
      try {
        hourlyRates = JSON.parse(hourlyRatesRaw);
      } catch {
        hourlyRates = "invalid-json";
      }
    }

    const dailyRatesRaw = formData.get("dailyRates");
    let dailyRates: unknown = [];
    if (typeof dailyRatesRaw === "string" && dailyRatesRaw.trim()) {
      try {
        dailyRates = JSON.parse(dailyRatesRaw);
      } catch {
        dailyRates = "invalid-json";
      }
    }

    const primaryImage =
      primaryImageValue instanceof File && primaryImageValue.size > 0 ? primaryImageValue : null;
    const secondaryImages = secondaryImageValues.filter((file) => file.size > 0);

    return {
      name: typeof formData.get("name") === "string" ? String(formData.get("name")) : undefined,
      description:
        typeof formData.get("description") === "string" ? String(formData.get("description")) : undefined,
      pricePerNight: parseOptionalNumber(formData.get("pricePerNight") as string | null) ?? undefined,
      pricePerDay: parseOptionalNumber(formData.get("pricePerDay") as string | null),
      dayStartTime:
        typeof formData.get("dayStartTime") === "string" ? String(formData.get("dayStartTime")) : undefined,
      dayEndTime:
        typeof formData.get("dayEndTime") === "string" ? String(formData.get("dayEndTime")) : undefined,
      nightStartTime:
        typeof formData.get("nightStartTime") === "string"
          ? String(formData.get("nightStartTime"))
          : undefined,
      nightEndTime:
        typeof formData.get("nightEndTime") === "string" ? String(formData.get("nightEndTime")) : undefined,
      hourlyRates,
      dailyRates,
      totalQuantity: parseOptionalNumber(formData.get("totalQuantity") as string | null) ?? undefined,
      primaryImage,
      secondaryImages,
    };
  }

  return (await request.json()) as CreateRoomTypeBody;
}

async function uploadRoomPhoto(
  hotelId: string,
  file: File,
  label: "primary" | "secondary",
  index = 0,
) {
  if (!ALLOWED_ROOM_IMAGE_TYPES.has(file.type)) {
    return { ok: false as const, error: "Type image invalide (PNG, JPG, WEBP)." };
  }

  if (file.size > MAX_ROOM_IMAGE_SIZE_BYTES) {
    return { ok: false as const, error: "Une image depasse la limite de 5 MB." };
  }

  const processedImage = await compressImageForUpload(file, {
    maxWidth: 1920,
    maxHeight: 1280,
    quality: 80,
  });
  const objectPath = `${hotelId}/${Date.now()}-${label}-${index}-${randomUUID()}.${processedImage.extension}`;

  return {
    ok: true as const,
    objectPath,
    fileBytes: processedImage.bytes,
    contentType: processedImage.contentType,
  };
}

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

export async function GET(_: Request, { params }: Params) {
  const { hotelSlug } = await params;
  const auth = await ensureHotelAdminForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("room_types")
    .select(
      "id, name, description, primary_image_url, secondary_image_urls, price_per_night, price_per_day, day_start_time, day_end_time, night_start_time, night_end_time, hourly_rates, daily_rates, total_quantity, created_at",
    )
    .eq("hotel_id", auth.hotelId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: `Chargement des chambres impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, roomTypes: data ?? [] });
}

export async function POST(request: Request, { params }: Params) {
  const { hotelSlug } = await params;
  const auth = await ensureHotelAdminForSlug(hotelSlug);

  if (!auth.ok || !auth.hotelId) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  const body = await parseCreateBody(request);

  const name = body.name?.trim() ?? "";
  const description = body.description?.trim() || null;
  const pricePerNight = Number(body.pricePerNight ?? 0);
  const rawPricePerDay = body.pricePerDay;
  const pricePerDay =
    rawPricePerDay === undefined || rawPricePerDay === null
      ? null
      : Number(rawPricePerDay);
  const dayStartTime = normalizeTimeLabel(body.dayStartTime);
  const dayEndTime = normalizeTimeLabel(body.dayEndTime);
  const nightStartTime = normalizeTimeLabel(body.nightStartTime);
  const nightEndTime = normalizeTimeLabel(body.nightEndTime);
  const hourlyRatesResult = parseHourlyRates(body.hourlyRates);
  const dailyRatesResult = parseDailyRates(body.dailyRates);
  const totalQuantity = Number(body.totalQuantity ?? 0);
  const primaryImage = body.primaryImage ?? null;
  const secondaryImages = body.secondaryImages ?? [];

  if (!name || name.length < 2) {
    return NextResponse.json(
      { success: false, error: "Le nom du type de chambre est requis (min 2 caracteres)." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(pricePerNight) || pricePerNight < 0) {
    return NextResponse.json(
      { success: false, error: "Prix par nuit invalide." },
      { status: 400 },
    );
  }

  if (pricePerDay !== null && (!Number.isFinite(pricePerDay) || pricePerDay < 0)) {
    return NextResponse.json(
      { success: false, error: "Prix par jour invalide." },
      { status: 400 },
    );
  }

  if (!hourlyRatesResult.ok) {
    return NextResponse.json(
      { success: false, error: hourlyRatesResult.error },
      { status: 400 },
    );
  }

  if (!dailyRatesResult.ok) {
    return NextResponse.json(
      { success: false, error: dailyRatesResult.error },
      { status: 400 },
    );
  }

  const hasDayWindow = Boolean(dayStartTime && dayEndTime);
  if ((dayStartTime && !dayEndTime) || (!dayStartTime && dayEndTime)) {
    return NextResponse.json(
      { success: false, error: "Renseignez les deux horaires pour le tarif jour." },
      { status: 400 },
    );
  }

  if ((nightStartTime && !nightEndTime) || (!nightStartTime && nightEndTime)) {
    return NextResponse.json(
      { success: false, error: "Renseignez les deux horaires pour le tarif nuit." },
      { status: 400 },
    );
  }

  if (hasDayWindow && pricePerDay === null) {
    return NextResponse.json(
      { success: false, error: "Le tarif jour est requis quand une plage horaire jour est definie." },
      { status: 400 },
    );
  }

  if (!Number.isInteger(totalQuantity) || totalQuantity <= 0) {
    return NextResponse.json(
      { success: false, error: "Quantite totale invalide (entier > 0)." },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();
  const bucketName = getRoomPhotosBucketName();
  const uploadedPaths: string[] = [];
  let primaryImageUrl: string | null = null;
  const secondaryImageUrls: string[] = [];

  if (primaryImage) {
    const preparedPrimary = await uploadRoomPhoto(auth.hotelId, primaryImage, "primary");
    if (!preparedPrimary.ok) {
      return NextResponse.json({ success: false, error: preparedPrimary.error }, { status: 400 });
    }

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(preparedPrimary.objectPath, preparedPrimary.fileBytes, {
        upsert: false,
        contentType: preparedPrimary.contentType,
        cacheControl: "3600",
      });

    if (uploadError) {
      return NextResponse.json(
        { success: false, error: `Upload image principale impossible: ${uploadError.message}` },
        { status: 500 },
      );
    }

    uploadedPaths.push(preparedPrimary.objectPath);
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(preparedPrimary.objectPath);
    primaryImageUrl = publicData.publicUrl;
  }

  for (const [index, file] of secondaryImages.entries()) {
    const preparedSecondary = await uploadRoomPhoto(auth.hotelId, file, "secondary", index);
    if (!preparedSecondary.ok) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(bucketName).remove(uploadedPaths);
      }
      return NextResponse.json({ success: false, error: preparedSecondary.error }, { status: 400 });
    }

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(preparedSecondary.objectPath, preparedSecondary.fileBytes, {
        upsert: false,
        contentType: preparedSecondary.contentType,
        cacheControl: "3600",
      });

    if (uploadError) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(bucketName).remove(uploadedPaths);
      }
      return NextResponse.json(
        { success: false, error: `Upload image secondaire impossible: ${uploadError.message}` },
        { status: 500 },
      );
    }

    uploadedPaths.push(preparedSecondary.objectPath);
    const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(preparedSecondary.objectPath);
    secondaryImageUrls.push(publicData.publicUrl);
  }

  const { data, error } = await supabase
    .from("room_types")
    .insert({
      hotel_id: auth.hotelId,
      name,
      description,
      primary_image_url: primaryImageUrl,
      secondary_image_urls: secondaryImageUrls,
      price_per_night: pricePerNight,
      price_per_day: pricePerDay,
      day_start_time: dayStartTime,
      day_end_time: dayEndTime,
      night_start_time: nightStartTime,
      night_end_time: nightEndTime,
      hourly_rates: hourlyRatesResult.value,
      daily_rates: dailyRatesResult.value,
      total_quantity: totalQuantity,
    })
    .select(
      "id, name, description, primary_image_url, secondary_image_urls, price_per_night, price_per_day, day_start_time, day_end_time, night_start_time, night_end_time, hourly_rates, daily_rates, total_quantity, created_at",
    )
    .single();

  if (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(bucketName).remove(uploadedPaths);
    }
    return NextResponse.json(
      { success: false, error: `Creation type de chambre impossible: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, roomType: data }, { status: 201 });
}
