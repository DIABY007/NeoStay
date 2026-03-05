import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export type RoomAvailability = {
  roomTypeId: string;
  totalQuantity: number;
  bookedCount: number;
  availableCount: number;
  isAvailable: boolean;
};

export type AvailabilityResult = {
  hotelId: string;
  checkIn: string;
  checkOut: string;
  rooms: RoomAvailability[];
};

function isValidIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateStayDates(checkIn: string, checkOut: string) {
  if (!isValidIsoDate(checkIn) || !isValidIsoDate(checkOut)) {
    throw new Error("Dates invalides. Utilisez le format YYYY-MM-DD.");
  }

  if (checkOut < checkIn) {
    throw new Error("La date de check-out doit etre posterieure ou egale au check-in.");
  }
}

function plusOneDay(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function effectiveEndDate(
  checkIn: string,
  checkOut: string,
  bookingFormula: string | null,
  bookedDays: number | null,
) {
  if (bookingFormula === "hourly") {
    return plusOneDay(checkIn);
  }

  if (bookingFormula === "day") {
    if (bookedDays && bookedDays > 1) {
      const date = new Date(`${checkIn}T00:00:00`);
      date.setDate(date.getDate() + bookedDays);
      return date.toISOString().slice(0, 10);
    }
    return plusOneDay(checkIn);
  }

  return checkOut === checkIn ? plusOneDay(checkIn) : checkOut;
}

export async function getHotelBySlug(slug: string) {
  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("hotels")
    .select("id, name, slug, status, whatsapp_number")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function computeAvailabilityByHotelId(
  hotelId: string,
  checkIn: string,
  checkOut: string,
): Promise<AvailabilityResult> {
  validateStayDates(checkIn, checkOut);

  const supabase = createSupabaseServiceRoleClient();

  const { data: roomTypes, error: roomTypesError } = await supabase
    .from("room_types")
    .select("id, total_quantity")
    .eq("hotel_id", hotelId);

  if (roomTypesError) {
    throw new Error(`Impossible de charger les types de chambres: ${roomTypesError.message}`);
  }

  const { data: overlappingBookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("room_type_id, status, expires_at, check_in_date, check_out_date, booking_formula, booked_days")
    .eq("hotel_id", hotelId)
    .in("status", ["confirmed", "pending"]);

  if (bookingsError) {
    throw new Error(`Impossible de charger les reservations: ${bookingsError.message}`);
  }

  const now = Date.now();
  const requestEffectiveEnd = checkOut === checkIn ? plusOneDay(checkIn) : checkOut;
  const activeCountByRoomType = new Map<string, number>();

  for (const booking of overlappingBookings ?? []) {
    const isActivePending =
      booking.status === "pending" && booking.expires_at && Date.parse(booking.expires_at) > now;
    const isConfirmed = booking.status === "confirmed";

    if (!isConfirmed && !isActivePending) {
      continue;
    }

    const bookingStart = booking.check_in_date;
    const bookingEnd = effectiveEndDate(
      booking.check_in_date,
      booking.check_out_date,
      booking.booking_formula,
      booking.booked_days ?? null,
    );

    const overlaps = bookingStart < requestEffectiveEnd && bookingEnd > checkIn;
    if (!overlaps) {
      continue;
    }

    const roomTypeId = booking.room_type_id;
    activeCountByRoomType.set(roomTypeId, (activeCountByRoomType.get(roomTypeId) ?? 0) + 1);
  }

  const rooms = (roomTypes ?? []).map((roomType) => {
    const totalQuantity = Number(roomType.total_quantity);
    const bookedCount = activeCountByRoomType.get(roomType.id) ?? 0;
    const availableCount = Math.max(0, totalQuantity - bookedCount);

    return {
      roomTypeId: roomType.id,
      totalQuantity,
      bookedCount,
      availableCount,
      isAvailable: availableCount > 0,
    };
  });

  return {
    hotelId,
    checkIn,
    checkOut,
    rooms,
  };
}
