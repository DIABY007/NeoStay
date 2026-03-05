"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

const COUNTRY_CODE = "+226";
const LOCAL_NUMBER_LENGTH = 8;

function normalizeLocalNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, LOCAL_NUMBER_LENGTH);
}

type RoomType = {
  id: string;
  name: string;
  description: string | null;
  primaryImageUrl: string | null;
  secondaryImageUrls: unknown[];
  pricePerNight: number;
  pricePerDay: number | null;
  dayStartTime: string | null;
  dayEndTime: string | null;
  nightStartTime: string | null;
  nightEndTime: string | null;
  hourlyRates: unknown[];
  dailyRates: unknown[];
  totalQuantity: number;
};

type HourlyRateTier = {
  hours: number;
  price: number;
};

type RoomAvailability = {
  roomTypeId: string;
  totalQuantity: number;
  bookedCount: number;
  availableCount: number;
  isAvailable: boolean;
};

type Props = {
  hotelSlug: string;
  roomTypes: RoomType[];
};

type ReservationState = {
  guestName: string;
  guestPhoneLocal: string;
  bookingFormulaKey: string;
  specialRequest: string;
  paymentProof: File | null;
  isSubmitting: boolean;
  status: string | null;
};

type FormulaOption = {
  key: string;
  label: string;
  bookingFormula: "night" | "day" | "hourly";
  hourlyHours: number | null;
  dailyDays: number | null;
  price: number;
};

function getTonightDate() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number) {
  const clone = new Date(date);
  clone.setDate(clone.getDate() + days);
  return clone;
}

function createDefaultReservationState(): ReservationState {
  return {
    guestName: "",
    guestPhoneLocal: "",
    bookingFormulaKey: "night",
    specialRequest: "",
    paymentProof: null,
    isSubmitting: false,
    status: null,
  };
}

function getFormulaOptions(roomType: RoomType): FormulaOption[] {
  const options: FormulaOption[] = [
    {
      key: "night",
      label: "Nuit",
      bookingFormula: "night",
      hourlyHours: null,
      dailyDays: null,
      price: roomType.pricePerNight,
    },
  ];

  if (roomType.pricePerDay !== null) {
    options.push({
      key: "day:1",
      label: "Jour (1j)",
      bookingFormula: "day",
      hourlyHours: null,
      dailyDays: 1,
      price: roomType.pricePerDay,
    });
  }

  const parsedDailyRates: Array<{ days: number; price: number }> = [];
  for (const item of roomType.dailyRates) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const candidate = item as { days?: unknown; price?: unknown };
    const days = Number(candidate.days);
    const price = Number(candidate.price);
    if (Number.isInteger(days) && days >= 2 && days <= 30 && Number.isFinite(price) && price >= 0) {
      parsedDailyRates.push({ days, price });
    }
  }

  parsedDailyRates.sort((a, b) => a.days - b.days);
  for (const tier of parsedDailyRates) {
    options.push({
      key: `day:${tier.days}`,
      label: `Jour (${tier.days}j)`,
      bookingFormula: "day",
      hourlyHours: null,
      dailyDays: tier.days,
      price: tier.price,
    });
  }

  for (const tier of normalizeHourlyRates(roomType.hourlyRates)) {
    options.push({
      key: `hourly:${tier.hours}`,
      label: `Horaire (${tier.hours}h)`,
      bookingFormula: "hourly",
      hourlyHours: tier.hours,
      dailyDays: null,
      price: tier.price,
    });
  }

  return options;
}

function computeCheckOutByFormula(start: string, option: FormulaOption | undefined) {
  if (!option) {
    return toIsoDate(addDays(new Date(`${start}T00:00:00`), 1));
  }

  if (option.bookingFormula === "night") {
    return toIsoDate(addDays(new Date(`${start}T00:00:00`), 1));
  }

  if (option.bookingFormula === "day") {
    const dayCount = option.dailyDays ?? 1;
    return toIsoDate(addDays(new Date(`${start}T00:00:00`), Math.max(0, dayCount - 1)));
  }

  return start;
}

function normalizeHourlyRates(raw: unknown): HourlyRateTier[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed: HourlyRateTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const candidate = item as { hours?: unknown; price?: unknown };
    const hours = Number(candidate.hours);
    const price = Number(candidate.price);
    if (Number.isInteger(hours) && hours > 0 && Number.isFinite(price) && price >= 0) {
      parsed.push({ hours, price });
    }
  }

  return parsed.sort((a, b) => a.hours - b.hours);
}

function timeLabel(value: string | null) {
  if (!value) {
    return null;
  }
  return value.slice(0, 5);
}

function formatPrice(value: number) {
  return Math.round(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export function BookingCatalog({ hotelSlug, roomTypes }: Props) {
  const today = useMemo(() => getTonightDate(), []);
  const [startDate, setStartDate] = useState(toIsoDate(today));
  const [searchQuery, setSearchQuery] = useState("");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, RoomAvailability>>(new Map());
  const [reservationByRoomType, setReservationByRoomType] = useState<Record<string, ReservationState>>({});
  const [activeRoomTypeId, setActiveRoomTypeId] = useState<string | null>(null);

  const activeRoomType = roomTypes.find((room) => room.id === activeRoomTypeId) ?? null;
  const activeState = activeRoomTypeId ? reservationByRoomType[activeRoomTypeId] : null;
  const activeFormulaOptions = activeRoomType ? getFormulaOptions(activeRoomType) : [];
  const activeFormulaOption =
    activeFormulaOptions.find((option) => option.key === (activeState?.bookingFormulaKey ?? "night")) ??
    activeFormulaOptions[0];

  const checkIn = startDate;
  const checkOut = computeCheckOutByFormula(startDate, activeFormulaOption);
  const isDateRangeValid = checkOut >= checkIn;
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredRoomTypes = useMemo(() => {
    if (!normalizedSearch) {
      return roomTypes;
    }

    return roomTypes.filter((roomType) => {
      const searchablePrice = [
        roomType.pricePerNight,
        roomType.pricePerDay,
        ...normalizeHourlyRates(roomType.hourlyRates).map((tier) => tier.price),
      ]
        .filter((value): value is number => value !== null)
        .map((value) => `${Math.round(value)} ${formatPrice(value)}`)
        .join(" ");

      const searchableText = [roomType.name, roomType.description ?? "", searchablePrice]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [roomTypes, normalizedSearch]);

  function getReservationState(roomTypeId: string) {
    return reservationByRoomType[roomTypeId] ?? createDefaultReservationState();
  }

  function updateReservationState(
    roomTypeId: string,
    updater: (previous: ReservationState) => ReservationState,
  ) {
    setReservationByRoomType((previous) => {
      const current = previous[roomTypeId] ?? createDefaultReservationState();
      return {
        ...previous,
        [roomTypeId]: updater(current),
      };
    });
  }

  useEffect(() => {
    async function loadAvailability() {
      if (!checkIn || !checkOut || !isDateRangeValid) {
        setAvailabilityMap(new Map());
        return;
      }

      setAvailabilityLoading(true);
      setAvailabilityError(null);

      const response = await fetch(
        `/api/public/hotels/${hotelSlug}/availability?checkIn=${checkIn}&checkOut=${checkOut}`,
        { cache: "no-store" },
      );
      const result = await response.json();

      setAvailabilityLoading(false);

      if (!response.ok || !result.success) {
        setAvailabilityError(result.error ?? "Indisponibilite introuvable.");
        setAvailabilityMap(new Map());
        return;
      }

      const nextMap = new Map<string, RoomAvailability>();
      for (const room of result.availability as RoomAvailability[]) {
        nextMap.set(room.roomTypeId, room);
      }
      setAvailabilityMap(nextMap);
    }

    void loadAvailability();
  }, [hotelSlug, checkIn, checkOut, isDateRangeValid]);

  async function submitReservation(roomType: RoomType) {
    const state = getReservationState(roomType.id);
    const formulaOptions = getFormulaOptions(roomType);
    const selectedFormulaOption =
      formulaOptions.find((option) => option.key === state.bookingFormulaKey) ?? formulaOptions[0];

    if (!selectedFormulaOption) {
      updateReservationState(roomType.id, (previous) => ({
        ...previous,
        status: "Aucune formule disponible pour cette chambre.",
      }));
      return;
    }

    if (state.guestName.trim().length < 2) {
      updateReservationState(roomType.id, (previous) => ({
        ...previous,
        status: "Nom client requis (min 2 caracteres).",
      }));
      return;
    }

    if (state.guestPhoneLocal.length !== LOCAL_NUMBER_LENGTH) {
      updateReservationState(roomType.id, (previous) => ({
        ...previous,
        status: `Numero client invalide (${LOCAL_NUMBER_LENGTH} chiffres requis).`,
      }));
      return;
    }

    const guestPhone = `${COUNTRY_CODE}${state.guestPhoneLocal}`;

    updateReservationState(roomType.id, (previous) => ({
      ...previous,
      isSubmitting: true,
      status: null,
    }));

    const payload = new FormData();
    payload.set("roomTypeId", roomType.id);
    payload.set("guestName", state.guestName.trim());
    payload.set("guestPhone", guestPhone);
    payload.set("bookingFormula", selectedFormulaOption.bookingFormula);
    if (selectedFormulaOption.hourlyHours !== null) {
      payload.set("bookingHourlyHours", String(selectedFormulaOption.hourlyHours));
    }
    if (selectedFormulaOption.dailyDays !== null) {
      payload.set("bookingDailyDays", String(selectedFormulaOption.dailyDays));
    }
    payload.set("specialRequest", state.specialRequest.trim());
    payload.set("checkIn", startDate);
    payload.set("checkOut", computeCheckOutByFormula(startDate, selectedFormulaOption));
    if (state.paymentProof) {
      payload.set("paymentProof", state.paymentProof);
    }

    const response = await fetch(`/api/public/hotels/${hotelSlug}/bookings`, {
      method: "POST",
      body: payload,
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      updateReservationState(roomType.id, (previous) => ({
        ...previous,
        isSubmitting: false,
        status: result.error ?? "Reservation impossible.",
      }));
      return;
    }

    updateReservationState(roomType.id, () => ({
      ...createDefaultReservationState(),
      status: result.paymentProofWarning
        ? `Reservation enregistree (${result.booking.id}). ${result.paymentProofWarning}`
        : `Reservation enregistree. Reference: ${result.booking.id}`,
    }));

    if (result.whatsappUrl) {
      window.location.assign(result.whatsappUrl);
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label className="grid gap-2 text-sm" htmlFor="room-search">
            <span className="font-medium text-slate-700">
              Rechercher une chambre (nom, description, prix)
            </span>
            <input
              id="room-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Ex: Suite, vue piscine, 25000"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            {filteredRoomTypes.length} resultat{filteredRoomTypes.length > 1 ? "s" : ""}
          </p>
        </div>

        {roomTypes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Aucun type de chambre disponible pour le moment.
          </div>
        ) : filteredRoomTypes.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            Aucun resultat pour cette recherche.
          </div>
        ) : (
          filteredRoomTypes.map((roomType) => {
            const hourlyRates = normalizeHourlyRates(roomType.hourlyRates);
            const formulaOptions = getFormulaOptions(roomType);
            const availability = availabilityMap.get(roomType.id);
            const isAvailable = availability ? availability.isAvailable : true;
            const state = getReservationState(roomType.id);
            const selectedFormulaOption =
              formulaOptions.find((option) => option.key === state.bookingFormulaKey) ?? formulaOptions[0];
            const totalPrice = selectedFormulaOption?.price ?? roomType.pricePerNight;

            return (
              <article key={roomType.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    {roomType.primaryImageUrl ? (
                      <Image
                        src={roomType.primaryImageUrl}
                        alt={roomType.name}
                        width={112}
                        height={84}
                        className="h-[84px] w-28 rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-[84px] w-28 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-[11px] text-slate-500">
                        Pas d image
                      </div>
                    )}

                    <div>
                    <h3 className="text-xl font-semibold text-slate-900">{roomType.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Capacite stock: {roomType.totalQuantity} chambre(s)
                    </p>
                    {availability && (
                      <p className={`mt-1 text-sm ${isAvailable ? "text-emerald-700" : "text-rose-700"}`}>
                        {isAvailable
                          ? `${availability.availableCount} chambre(s) disponible(s)`
                          : "Indisponible pour ces dates"}
                      </p>
                    )}
                    {roomType.description && (
                      <p className="mt-3 max-w-2xl text-sm text-slate-700">{roomType.description}</p>
                    )}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl bg-slate-900 px-4 py-3 text-right text-white">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-300">Tarif nuit</p>
                      <p className="text-lg font-bold">{formatPrice(roomType.pricePerNight)}</p>
                      {roomType.nightStartTime && roomType.nightEndTime && (
                        <p className="text-xs text-slate-300">
                          {timeLabel(roomType.nightStartTime)} - {timeLabel(roomType.nightEndTime)}
                        </p>
                      )}
                    </div>

                    {roomType.pricePerDay !== null && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-300">Tarif jour</p>
                        <p className="text-lg font-bold">{formatPrice(roomType.pricePerDay)}</p>
                        {roomType.dayStartTime && roomType.dayEndTime && (
                          <p className="text-xs text-slate-300">
                            {timeLabel(roomType.dayStartTime)} - {timeLabel(roomType.dayEndTime)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {hourlyRates.length > 0 && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tarifs horaires</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {hourlyRates.map((tier) => (
                        <span
                          key={`${roomType.id}-${tier.hours}`}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"
                        >
                          {tier.hours}h: {formatPrice(tier.price)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm text-slate-700">
                    {selectedFormulaOption?.label ?? "Nuit"} x {formatPrice(selectedFormulaOption?.price ?? roomType.pricePerNight)}
                  </p>
                  <p className="text-lg font-bold text-slate-900">
                    {formatPrice(totalPrice)}
                  </p>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    onClick={() => {
                      setActiveRoomTypeId((previous) => (previous === roomType.id ? null : roomType.id));
                    }}
                  >
                    {activeRoomTypeId === roomType.id ? "Fermer le formulaire" : "Reserver cette chambre"}
                  </button>
                </div>

                {activeRoomTypeId === roomType.id && (
                  <div className="mt-5 grid gap-2 rounded-xl border border-slate-200 p-4">
                  <h4 className="text-sm font-semibold text-slate-900">Demande de reservation</h4>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Date de debut</span>
                    <input
                      type="date"
                      min={toIsoDate(today)}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      {selectedFormulaOption?.label ?? "Nuit"}
                    </p>
                    {availabilityLoading && <p className="text-xs text-slate-500">Verification disponibilites...</p>}
                    {availabilityError && <p className="text-xs text-rose-700">{availabilityError}</p>}
                  </div>
                  <p className="text-xs text-slate-600">
                    Check-out calcule automatiquement: {computeCheckOutByFormula(startDate, selectedFormulaOption)}
                  </p>

                  <label className="grid gap-1 text-sm">
                    <span className="font-medium text-slate-700">Formule souhaitee</span>
                    <select
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                      value={selectedFormulaOption?.key ?? "night"}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateReservationState(roomType.id, (previous) => ({
                          ...previous,
                          bookingFormulaKey: value,
                        }));
                      }}
                    >
                      {formulaOptions.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Nom complet"
                    value={state.guestName}
                    onChange={(event) =>
                      updateReservationState(roomType.id, (previous) => ({
                        ...previous,
                        guestName: event.target.value,
                      }))
                    }
                  />
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-10 shrink-0 items-center rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                      {COUNTRY_CODE}
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      placeholder="70000000"
                      value={state.guestPhoneLocal}
                      onChange={(event) =>
                        updateReservationState(roomType.id, (previous) => ({
                          ...previous,
                          guestPhoneLocal: normalizeLocalNumber(event.target.value),
                        }))
                      }
                    />
                  </div>
                  <p
                    className={`text-xs ${
                      state.guestPhoneLocal.length === LOCAL_NUMBER_LENGTH
                        ? "text-emerald-700"
                        : "text-slate-500"
                    }`}
                  >
                    {state.guestPhoneLocal.length}/{LOCAL_NUMBER_LENGTH} chiffres
                  </p>
                  <textarea
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                    rows={2}
                    placeholder="Demande speciale (optionnel)"
                    value={state.specialRequest}
                    onChange={(event) =>
                      updateReservationState(roomType.id, (previous) => ({
                        ...previous,
                        specialRequest: event.target.value,
                      }))
                    }
                  />
                  <label className="text-xs text-slate-600">
                    Preuve de paiement (optionnel, jpg/png/pdf, max 5 Mo)
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      className="mt-1 block w-full text-xs"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        updateReservationState(roomType.id, (previous) => ({
                          ...previous,
                          paymentProof: file,
                        }));
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={state.isSubmitting || !isDateRangeValid || !isAvailable}
                    onClick={() => {
                      void submitReservation(roomType);
                    }}
                  >
                    {state.isSubmitting ? "Envoi..." : "Reserver"}
                  </button>

                  {state.status && <p className="text-xs text-slate-700">{state.status}</p>}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
