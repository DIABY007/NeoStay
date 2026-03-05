import { NextResponse } from "next/server";

import { computeAvailabilityByHotelId, getHotelBySlug } from "@/lib/bookings/availability";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  const { slug } = await params;
  const url = new URL(request.url);

  const checkIn = url.searchParams.get("checkIn") ?? "";
  const checkOut = url.searchParams.get("checkOut") ?? "";

  if (!checkIn || !checkOut) {
    return NextResponse.json(
      { success: false, error: "checkIn et checkOut sont requis." },
      { status: 400 },
    );
  }

  const hotel = await getHotelBySlug(slug);
  if (!hotel) {
    return NextResponse.json({ success: false, error: "Hotel introuvable." }, { status: 404 });
  }

  try {
    const availability = await computeAvailabilityByHotelId(hotel.id, checkIn, checkOut);

    return NextResponse.json({
      success: true,
      hotelId: hotel.id,
      checkIn,
      checkOut,
      availability: availability.rooms,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erreur indisponibilite",
      },
      { status: 400 },
    );
  }
}
