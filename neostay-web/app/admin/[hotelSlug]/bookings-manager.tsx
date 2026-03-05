"use client";

import { useEffect, useMemo, useState } from "react";

import { formatBurkinaPhone, toWhatsAppPhone } from "@/lib/phone-bf";

type BookingStatus = "pending" | "confirmed" | "cancelled" | "expired";

type Booking = {
  id: string;
  guest_name: string;
  guest_phone: string;
  special_request: string | null;
  booking_formula: "night" | "day" | "hourly";
  booked_hours: number | null;
  booked_days: number | null;
  check_in_date: string;
  check_out_date: string;
  status: BookingStatus;
  payment_proof_path: string | null;
  expires_at: string;
  created_at: string;
  room_types: { name: string } | null;
};

type Props = {
  hotelSlug: string;
};

const STATUS_FILTERS: Array<{ value: "all" | BookingStatus; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

export function BookingsManager({ hotelSlug }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState<"all" | BookingStatus>("all");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);

  function formulaLabel(formula: Booking["booking_formula"], bookedHours: number | null, bookedDays: number | null) {
    if (formula === "day") {
      return bookedDays ? `Jour (${bookedDays}j)` : "Jour";
    }
    if (formula === "hourly") {
      return bookedHours ? `Horaire (${bookedHours}h)` : "Horaire";
    }
    return "Nuit";
  }

  async function loadBookings() {
    setLoading(true);
    setStatus(null);

    const response = await fetch(`/api/admin/hotels/${hotelSlug}/bookings?status=${filter}`, {
      cache: "no-store",
    });
    const result = await response.json();

    setLoading(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Impossible de charger les reservations.");
      return;
    }

    setBookings(result.bookings ?? []);
  }

  useEffect(() => {
    void loadBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelSlug, filter]);

  async function updateStatus(
    bookingId: string,
    nextStatus: "confirmed" | "cancelled",
    rejectionReason?: string,
  ) {
    setBusyBookingId(bookingId);
    setStatus(null);

    const response = await fetch(
      `/api/admin/hotels/${hotelSlug}/bookings/${bookingId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus, rejectionReason }),
      },
    );
    const result = await response.json();

    setBusyBookingId(null);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Mise a jour impossible.");
      return;
    }

    setStatus(`Reservation ${bookingId} mise a jour: ${result.booking.status}.`);
    if (result.whatsappUrl) {
      window.location.href = result.whatsappUrl;
    }
    await loadBookings();
  }

  const counts = useMemo(() => {
    const map: Record<BookingStatus, number> = {
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      expired: 0,
    };

    bookings.forEach((booking) => {
      map[booking.status] += 1;
    });

    return map;
  }, [bookings]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Reservations</h2>
          <p className="mt-1 text-sm text-slate-600">
            Gestion quotidienne: validation, annulation et contact client.
          </p>
        </div>

        <label className="text-sm">
          <span className="mr-2 font-medium text-slate-700">Filtre</span>
          <select
            className="rounded-md border border-slate-300 px-2 py-1"
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | BookingStatus)}
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">pending: {counts.pending}</span>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">confirmed: {counts.confirmed}</span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">cancelled: {counts.cancelled}</span>
        <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">expired: {counts.expired}</span>
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-slate-600">Chargement...</p>
      ) : bookings.length === 0 ? (
        <p className="mt-5 text-sm text-slate-600">Aucune reservation pour ce filtre.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {bookings.map((booking) => {
            const contactText = encodeURIComponent(
              `Bonjour ${booking.guest_name}, concernant votre reservation ${booking.id} pour ${booking.room_types?.name ?? "votre chambre"}.`,
            );
            const waUrl = `https://wa.me/${toWhatsAppPhone(booking.guest_phone)}?text=${contactText}`;
            const isBusy = busyBookingId === booking.id;
            const canUpdate = booking.status === "pending" || booking.status === "confirmed";

            return (
              <li key={booking.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {booking.guest_name} - {booking.room_types?.name ?? "Chambre"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {booking.check_in_date} au {booking.check_out_date} - {booking.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Formule: {formulaLabel(booking.booking_formula, booking.booked_hours, booking.booked_days)}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">Tel: {formatBurkinaPhone(booking.guest_phone)}</p>
                    {booking.special_request && (
                      <p className="mt-2 text-xs text-slate-700">Demande: {booking.special_request}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      Preuve: {booking.payment_proof_path ? "Oui" : "Non"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Contacter client
                    </a>

                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      disabled={!canUpdate || isBusy}
                      onClick={() => {
                        void updateStatus(booking.id, "confirmed");
                      }}
                    >
                      Confirmer
                    </button>

                    <button
                      type="button"
                      className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                      disabled={!canUpdate || isBusy}
                      onClick={() => {
                        const reason = window.prompt("Motif du refus:", "");
                        if (!reason || reason.trim().length < 3) {
                          setStatus("Motif de refus requis (min 3 caracteres).");
                          return;
                        }
                        void updateStatus(booking.id, "cancelled", reason.trim());
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {status && <p className="mt-4 text-sm text-slate-700">{status}</p>}
    </section>
  );
}
