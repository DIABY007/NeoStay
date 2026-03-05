"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type HourlyRateTier = {
  hours: number;
  price: number;
};

type DailyRateTier = {
  days: number;
  price: number;
};

type RoomType = {
  id: string;
  name: string;
  description: string | null;
  primary_image_url: string | null;
  secondary_image_urls: unknown;
  price_per_night: number;
  price_per_day: number | null;
  day_start_time: string | null;
  day_end_time: string | null;
  night_start_time: string | null;
  night_end_time: string | null;
  hourly_rates: unknown;
  daily_rates: unknown;
  total_quantity: number;
  created_at: string;
};

type HourlyRateDraft = {
  key: string;
  hours: string;
  price: string;
};

type Props = {
  hotelSlug: string;
};

export function RoomsManager({ hotelSlug }: Props) {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerNight, setPricePerNight] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [dayStartTime, setDayStartTime] = useState("");
  const [dayEndTime, setDayEndTime] = useState("");
  const [nightStartTime, setNightStartTime] = useState("");
  const [nightEndTime, setNightEndTime] = useState("");
  const [hourlyRates, setHourlyRates] = useState<HourlyRateDraft[]>([{ key: "rate-1", hours: "", price: "" }]);
  const [dailyRates, setDailyRates] = useState<HourlyRateDraft[]>([{ key: "day-rate-1", hours: "", price: "" }]);
  const [totalQuantity, setTotalQuantity] = useState("1");
  const [primaryImage, setPrimaryImage] = useState<File | null>(null);
  const [secondaryImages, setSecondaryImages] = useState<File[]>([]);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPricePerNight, setEditPricePerNight] = useState("");
  const [editPricePerDay, setEditPricePerDay] = useState("");
  const [editDayStartTime, setEditDayStartTime] = useState("");
  const [editDayEndTime, setEditDayEndTime] = useState("");
  const [editNightStartTime, setEditNightStartTime] = useState("");
  const [editNightEndTime, setEditNightEndTime] = useState("");
  const [editHourlyRates, setEditHourlyRates] = useState<HourlyRateDraft[]>([]);
  const [editDailyRates, setEditDailyRates] = useState<HourlyRateDraft[]>([]);
  const [editTotalQuantity, setEditTotalQuantity] = useState("1");

  function formatPrice(value: number | null) {
    if (value === null) {
      return "-";
    }

    // Display in whole units to avoid floating-point artifacts (e.g. 14999.999).
    return Math.round(value).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
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

  function parseHourlyDrafts(source: HourlyRateDraft[] = hourlyRates) {
    const seenHours = new Set<number>();
    const parsed: HourlyRateTier[] = [];

    for (const row of source) {
      const hoursRaw = row.hours.trim();
      const priceRaw = row.price.trim();

      if (!hoursRaw && !priceRaw) {
        continue;
      }

      if (!hoursRaw || !priceRaw) {
        return { ok: false as const, error: "Chaque ligne horaire doit contenir heures et tarif." };
      }

      const hours = Number(hoursRaw);
      const price = Number(priceRaw);

      if (!Number.isInteger(hours) || hours <= 0 || hours > 24) {
        return { ok: false as const, error: "Heures horaires invalides (entier de 1 a 24)." };
      }

      if (!Number.isFinite(price) || price < 0) {
        return { ok: false as const, error: "Tarif horaire invalide." };
      }

      if (seenHours.has(hours)) {
        return { ok: false as const, error: "Chaque palier horaire doit avoir une duree unique." };
      }

      seenHours.add(hours);
      parsed.push({ hours, price });
    }

    parsed.sort((a, b) => a.hours - b.hours);
    return { ok: true as const, value: parsed };
  }

  function normalizeDailyRates(raw: unknown): DailyRateTier[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const parsed: DailyRateTier[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const candidate = item as { days?: unknown; price?: unknown };
      const days = Number(candidate.days);
      const price = Number(candidate.price);
      if (Number.isInteger(days) && days > 0 && days <= 30 && Number.isFinite(price) && price >= 0) {
        parsed.push({ days, price });
      }
    }

    return parsed.sort((a, b) => a.days - b.days);
  }

  function parseDailyDrafts(source: HourlyRateDraft[] = dailyRates) {
    const seenDays = new Set<number>();
    const parsed: DailyRateTier[] = [];

    for (const row of source) {
      const daysRaw = row.hours.trim();
      const priceRaw = row.price.trim();

      if (!daysRaw && !priceRaw) {
        continue;
      }

      if (!daysRaw || !priceRaw) {
        return { ok: false as const, error: "Chaque ligne journaliere doit contenir jours et tarif." };
      }

      const days = Number(daysRaw);
      const price = Number(priceRaw);

      if (!Number.isInteger(days) || days <= 0 || days > 30) {
        return { ok: false as const, error: "Jours journaliers invalides (entier de 1 a 30)." };
      }

      if (!Number.isFinite(price) || price < 0) {
        return { ok: false as const, error: "Tarif journalier invalide." };
      }

      if (seenDays.has(days)) {
        return { ok: false as const, error: "Chaque palier journalier doit avoir une duree unique." };
      }

      seenDays.add(days);
      parsed.push({ days, price });
    }

    parsed.sort((a, b) => a.days - b.days);
    return { ok: true as const, value: parsed };
  }

  function addHourlyRateRow() {
    setHourlyRates((previous) => [
      ...previous,
      { key: `rate-${Date.now()}-${previous.length + 1}`, hours: "", price: "" },
    ]);
  }

  function removeHourlyRateRow(key: string) {
    setHourlyRates((previous) => {
      const filtered = previous.filter((row) => row.key !== key);
      return filtered.length > 0 ? filtered : [{ key: `rate-${Date.now()}-1`, hours: "", price: "" }];
    });
  }

  function addDailyRateRow() {
    setDailyRates((previous) => [
      ...previous,
      { key: `day-rate-${Date.now()}-${previous.length + 1}`, hours: "", price: "" },
    ]);
  }

  function removeDailyRateRow(key: string) {
    setDailyRates((previous) => {
      const filtered = previous.filter((row) => row.key !== key);
      return filtered.length > 0 ? filtered : [{ key: `day-rate-${Date.now()}-1`, hours: "", price: "" }];
    });
  }

  function createDraftRatesFromRoom(roomType: RoomType) {
    const tiers = normalizeHourlyRates(roomType.hourly_rates);
    if (tiers.length === 0) {
      return [{ key: `edit-rate-${roomType.id}-1`, hours: "", price: "" }];
    }

    return tiers.map((tier, index) => ({
      key: `edit-rate-${roomType.id}-${index + 1}`,
      hours: String(tier.hours),
      price: String(tier.price),
    }));
  }

  function createDailyDraftRatesFromRoom(roomType: RoomType) {
    const tiers = normalizeDailyRates(roomType.daily_rates);
    if (tiers.length === 0) {
      return [{ key: `edit-day-rate-${roomType.id}-1`, hours: "", price: "" }];
    }

    return tiers.map((tier, index) => ({
      key: `edit-day-rate-${roomType.id}-${index + 1}`,
      hours: String(tier.days),
      price: String(tier.price),
    }));
  }

  function addEditHourlyRateRow() {
    if (!editingRoomId) {
      return;
    }

    setEditHourlyRates((previous) => [
      ...previous,
      { key: `edit-rate-${editingRoomId}-${Date.now()}`, hours: "", price: "" },
    ]);
  }

  function removeEditHourlyRateRow(key: string) {
    setEditHourlyRates((previous) => {
      const filtered = previous.filter((row) => row.key !== key);
      return filtered.length > 0 ? filtered : [{ key: `edit-rate-${Date.now()}-1`, hours: "", price: "" }];
    });
  }

  function addEditDailyRateRow() {
    if (!editingRoomId) {
      return;
    }

    setEditDailyRates((previous) => [
      ...previous,
      { key: `edit-day-rate-${editingRoomId}-${Date.now()}`, hours: "", price: "" },
    ]);
  }

  function removeEditDailyRateRow(key: string) {
    setEditDailyRates((previous) => {
      const filtered = previous.filter((row) => row.key !== key);
      return filtered.length > 0 ? filtered : [{ key: `edit-day-rate-${Date.now()}-1`, hours: "", price: "" }];
    });
  }

  function startEditRoom(roomType: RoomType) {
    setEditingRoomId(roomType.id);
    setEditName(roomType.name);
    setEditDescription(roomType.description ?? "");
    setEditPricePerNight(String(roomType.price_per_night));
    setEditPricePerDay(roomType.price_per_day === null ? "" : String(roomType.price_per_day));
    setEditDayStartTime(roomType.day_start_time?.slice(0, 5) ?? "");
    setEditDayEndTime(roomType.day_end_time?.slice(0, 5) ?? "");
    setEditNightStartTime(roomType.night_start_time?.slice(0, 5) ?? "");
    setEditNightEndTime(roomType.night_end_time?.slice(0, 5) ?? "");
    setEditHourlyRates(createDraftRatesFromRoom(roomType));
    setEditDailyRates(createDailyDraftRatesFromRoom(roomType));
    setEditTotalQuantity(String(roomType.total_quantity));
  }

  function cancelEditRoom() {
    setEditingRoomId(null);
    setUpdatingRoomId(null);
    setEditName("");
    setEditDescription("");
    setEditPricePerNight("");
    setEditPricePerDay("");
    setEditDayStartTime("");
    setEditDayEndTime("");
    setEditNightStartTime("");
    setEditNightEndTime("");
    setEditHourlyRates([]);
    setEditDailyRates([]);
    setEditTotalQuantity("1");
  }

  async function loadRoomTypes() {
    setLoading(true);
    const response = await fetch(`/api/admin/hotels/${hotelSlug}/room-types`, {
      cache: "no-store",
    });
    const result = await response.json();
    setLoading(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Impossible de charger les types de chambres.");
      return;
    }

    setRoomTypes(result.roomTypes ?? []);
  }

  useEffect(() => {
    void loadRoomTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelSlug]);

  async function onCreateRoomType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);

    const hourlyRatesParsed = parseHourlyDrafts();
    const dailyRatesParsed = parseDailyDrafts();
    if (!hourlyRatesParsed.ok) {
      setSaving(false);
      setStatus(hourlyRatesParsed.error);
      return;
    }
    if (!dailyRatesParsed.ok) {
      setSaving(false);
      setStatus(dailyRatesParsed.error);
      return;
    }

    const payload = new FormData();
    payload.set("name", name);
    payload.set("description", description);
    payload.set("pricePerNight", pricePerNight);
    payload.set("pricePerDay", pricePerDay);
    payload.set("dayStartTime", dayStartTime);
    payload.set("dayEndTime", dayEndTime);
    payload.set("nightStartTime", nightStartTime);
    payload.set("nightEndTime", nightEndTime);
    payload.set("hourlyRates", JSON.stringify(hourlyRatesParsed.value));
    payload.set("dailyRates", JSON.stringify(dailyRatesParsed.value));
    payload.set("totalQuantity", totalQuantity);

    if (primaryImage) {
      payload.set("primaryImage", primaryImage);
    }

    for (const image of secondaryImages) {
      payload.append("secondaryImages", image);
    }

    const response = await fetch(`/api/admin/hotels/${hotelSlug}/room-types`, {
      method: "POST",
      body: payload,
    });

    const result = await response.json();
    setSaving(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Creation impossible.");
      return;
    }

    setName("");
    setDescription("");
    setPricePerNight("");
    setPricePerDay("");
    setDayStartTime("");
    setDayEndTime("");
    setNightStartTime("");
    setNightEndTime("");
    setHourlyRates([{ key: "rate-1", hours: "", price: "" }]);
    setDailyRates([{ key: "day-rate-1", hours: "", price: "" }]);
    setTotalQuantity("1");
    setPrimaryImage(null);
    setSecondaryImages([]);
    setStatus(`Type de chambre cree: ${result.roomType.name}`);
    await loadRoomTypes();
  }

  async function onQuickUpdateQuantity(roomTypeId: string, value: number) {
    const response = await fetch(`/api/admin/hotels/${hotelSlug}/room-types/${roomTypeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalQuantity: value }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Mise a jour quantite impossible.");
      return;
    }

    setStatus(`Quantite mise a jour pour ${result.roomType.name}.`);
    await loadRoomTypes();
  }

  async function onSaveRoomEdit(event: React.FormEvent<HTMLFormElement>, roomTypeId: string) {
    event.preventDefault();

    const hourlyRatesParsed = parseHourlyDrafts(editHourlyRates);
    const dailyRatesParsed = parseDailyDrafts(editDailyRates);
    if (!hourlyRatesParsed.ok) {
      setStatus(hourlyRatesParsed.error);
      return;
    }
    if (!dailyRatesParsed.ok) {
      setStatus(dailyRatesParsed.error);
      return;
    }

    setUpdatingRoomId(roomTypeId);
    setStatus(null);

    const response = await fetch(`/api/admin/hotels/${hotelSlug}/room-types/${roomTypeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        description: editDescription,
        pricePerNight: Number(editPricePerNight),
        pricePerDay: editPricePerDay.trim() ? Number(editPricePerDay) : null,
        dayStartTime: editDayStartTime || null,
        dayEndTime: editDayEndTime || null,
        nightStartTime: editNightStartTime || null,
        nightEndTime: editNightEndTime || null,
        hourlyRates: hourlyRatesParsed.value,
        dailyRates: dailyRatesParsed.value,
        totalQuantity: Number(editTotalQuantity),
      }),
    });

    const result = await response.json();
    setUpdatingRoomId(null);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Modification impossible.");
      return;
    }

    setStatus(`Type de chambre modifie: ${result.roomType.name}`);
    cancelEditRoom();
    await loadRoomTypes();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Nouveau type de chambre</h2>

        <form className="mt-5 grid gap-3" onSubmit={onCreateRoomType}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Nom</span>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              placeholder="Suite Royale"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Description</span>
            <textarea
              className="rounded-lg border border-slate-300 px-3 py-2"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Vue mer, lit king size..."
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Tarif nuit</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={pricePerNight}
                onChange={(event) => setPricePerNight(event.target.value)}
                type="number"
                min={0}
                step="0.01"
                required
                placeholder="35000"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Tarif jour (optionnel)</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={pricePerDay}
                onChange={(event) => setPricePerDay(event.target.value)}
                type="number"
                min={0}
                step="0.01"
                placeholder="25000"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Debut plage nuit</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={nightStartTime}
                onChange={(event) => setNightStartTime(event.target.value)}
                type="time"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Fin plage nuit</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={nightEndTime}
                onChange={(event) => setNightEndTime(event.target.value)}
                type="time"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Debut plage jour</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={dayStartTime}
                onChange={(event) => setDayStartTime(event.target.value)}
                type="time"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Fin plage jour</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={dayEndTime}
                onChange={(event) => setDayEndTime(event.target.value)}
                type="time"
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-700">Tarifs horaires (optionnel)</p>
            <p className="mt-1 text-xs text-slate-500">Exemple: 3h = 12000, 6h = 20000, 12h = 30000</p>

            <div className="mt-3 space-y-2">
              {hourlyRates.map((row) => (
                <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    type="number"
                    min={1}
                    max={24}
                    step="1"
                    placeholder="Heures"
                    value={row.hours}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHourlyRates((previous) =>
                        previous.map((item) => (item.key === row.key ? { ...item, hours: value } : item)),
                      );
                    }}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Tarif"
                    value={row.price}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHourlyRates((previous) =>
                        previous.map((item) => (item.key === row.key ? { ...item, price: value } : item)),
                      );
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => removeHourlyRateRow(row.key)}
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={addHourlyRateRow}
            >
              Ajouter un palier horaire
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-medium text-slate-700">Tarifs journaliers (optionnel)</p>
            <p className="mt-1 text-xs text-slate-500">Exemple: 2j = 40000, 5j = 90000</p>

            <div className="mt-3 space-y-2">
              {dailyRates.map((row) => (
                <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    type="number"
                    min={1}
                    max={30}
                    step="1"
                    placeholder="Jours"
                    value={row.hours}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDailyRates((previous) =>
                        previous.map((item) => (item.key === row.key ? { ...item, hours: value } : item)),
                      );
                    }}
                  />
                  <input
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Tarif"
                    value={row.price}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDailyRates((previous) =>
                        previous.map((item) => (item.key === row.key ? { ...item, price: value } : item)),
                      );
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => removeDailyRateRow(row.key)}
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={addDailyRateRow}
            >
              Ajouter un palier journalier
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Quantite physique</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={totalQuantity}
                onChange={(event) => setTotalQuantity(event.target.value)}
                type="number"
                min={1}
                step="1"
                required
                placeholder="2"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Image principale</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="rounded-lg border border-slate-300 px-3 py-2"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setPrimaryImage(file);
                }}
              />
              <span className="text-xs text-slate-500">Utilisee sur le feed public de l hotel.</span>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Images secondaires</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="rounded-lg border border-slate-300 px-3 py-2"
                onChange={(event) => {
                  setSecondaryImages(Array.from(event.target.files ?? []));
                }}
              />
              <span className="text-xs text-slate-500">Affichees dans la fiche detail de la chambre.</span>
            </label>
          </div>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-70"
            disabled={saving}
          >
            {saving ? "Creation..." : "Creer type de chambre"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Catalogue actuel</h2>

        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Chargement...</p>
        ) : roomTypes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">Aucun type de chambre defini.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {roomTypes.map((roomType) => (
              <li key={roomType.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-start gap-3">
                    {roomType.primary_image_url && (
                      <Image
                        src={roomType.primary_image_url}
                        alt={roomType.name}
                        width={96}
                        height={72}
                        className="h-[72px] w-24 rounded-md border border-slate-200 object-cover"
                      />
                    )}

                    <div>
                      <p className="font-semibold text-slate-900">{roomType.name}</p>
                      <p className="text-sm text-slate-600">Quantite: {roomType.total_quantity}</p>
                      <p className="text-sm text-slate-700">
                        Nuit: {formatPrice(roomType.price_per_night)}
                        {roomType.night_start_time && roomType.night_end_time
                          ? ` (${roomType.night_start_time.slice(0, 5)} - ${roomType.night_end_time.slice(0, 5)})`
                          : ""}
                      </p>
                      {roomType.price_per_day !== null && (
                        <p className="text-sm text-slate-700">
                          Jour: {formatPrice(roomType.price_per_day)}
                          {roomType.day_start_time && roomType.day_end_time
                            ? ` (${roomType.day_start_time.slice(0, 5)} - ${roomType.day_end_time.slice(0, 5)})`
                            : ""}
                        </p>
                      )}
                      {normalizeHourlyRates(roomType.hourly_rates).length > 0 && (
                        <p className="text-sm text-slate-700">
                          Horaire: {normalizeHourlyRates(roomType.hourly_rates)
                            .map((tier) => `${tier.hours}h=${formatPrice(tier.price)}`)
                            .join(" | ")}
                        </p>
                      )}
                      {normalizeDailyRates(roomType.daily_rates).length > 0 && (
                        <p className="text-sm text-slate-700">
                          Journalier: {normalizeDailyRates(roomType.daily_rates)
                            .map((tier) => `${tier.days}j=${formatPrice(tier.price)}`)
                            .join(" | ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => startEditRoom(roomType)}
                    >
                      Modifier
                    </button>
                    <input
                      type="number"
                      min={1}
                      defaultValue={roomType.total_quantity}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1"
                      onBlur={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isInteger(value) && value > 0 && value !== roomType.total_quantity) {
                          void onQuickUpdateQuantity(roomType.id, value);
                        }
                      }}
                    />
                    <span className="text-slate-500">maj qty</span>
                  </div>
                </div>

                {roomType.description && <p className="mt-2 text-sm text-slate-700">{roomType.description}</p>}

                {editingRoomId === roomType.id && (
                  <form
                    className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    onSubmit={(event) => {
                      void onSaveRoomEdit(event, roomType.id);
                    }}
                  >
                    <p className="text-sm font-semibold text-slate-800">Modifier ce type de chambre</p>

                    <label className="grid gap-1 text-sm">
                      <span className="font-medium text-slate-700">Nom</span>
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        required
                        minLength={2}
                      />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="font-medium text-slate-700">Description</span>
                      <textarea
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        rows={2}
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                      />
                    </label>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">Tarif nuit</span>
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={editPricePerNight}
                          onChange={(event) => setEditPricePerNight(event.target.value)}
                          type="number"
                          min={0}
                          step="0.01"
                          required
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">Tarif jour (optionnel)</span>
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={editPricePerDay}
                          onChange={(event) => setEditPricePerDay(event.target.value)}
                          type="number"
                          min={0}
                          step="0.01"
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">Debut plage nuit</span>
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={editNightStartTime}
                          onChange={(event) => setEditNightStartTime(event.target.value)}
                          type="time"
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">Fin plage nuit</span>
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={editNightEndTime}
                          onChange={(event) => setEditNightEndTime(event.target.value)}
                          type="time"
                        />
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">Debut plage jour</span>
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={editDayStartTime}
                          onChange={(event) => setEditDayStartTime(event.target.value)}
                          type="time"
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">Fin plage jour</span>
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={editDayEndTime}
                          onChange={(event) => setEditDayEndTime(event.target.value)}
                          type="time"
                        />
                      </label>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-sm font-medium text-slate-700">Tarifs horaires</p>
                      <div className="mt-2 space-y-2">
                        {editHourlyRates.map((row) => (
                          <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <input
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              type="number"
                              min={1}
                              max={24}
                              step="1"
                              placeholder="Heures"
                              value={row.hours}
                              onChange={(event) => {
                                const value = event.target.value;
                                setEditHourlyRates((previous) =>
                                  previous.map((item) =>
                                    item.key === row.key ? { ...item, hours: value } : item,
                                  ),
                                );
                              }}
                            />
                            <input
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Tarif"
                              value={row.price}
                              onChange={(event) => {
                                const value = event.target.value;
                                setEditHourlyRates((previous) =>
                                  previous.map((item) =>
                                    item.key === row.key ? { ...item, price: value } : item,
                                  ),
                                );
                              }}
                            />
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => removeEditHourlyRateRow(row.key)}
                            >
                              Retirer
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={addEditHourlyRateRow}
                      >
                        Ajouter un palier horaire
                      </button>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-sm font-medium text-slate-700">Tarifs journaliers</p>
                      <div className="mt-2 space-y-2">
                        {editDailyRates.map((row) => (
                          <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <input
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              type="number"
                              min={1}
                              max={30}
                              step="1"
                              placeholder="Jours"
                              value={row.hours}
                              onChange={(event) => {
                                const value = event.target.value;
                                setEditDailyRates((previous) =>
                                  previous.map((item) =>
                                    item.key === row.key ? { ...item, hours: value } : item,
                                  ),
                                );
                              }}
                            />
                            <input
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Tarif"
                              value={row.price}
                              onChange={(event) => {
                                const value = event.target.value;
                                setEditDailyRates((previous) =>
                                  previous.map((item) =>
                                    item.key === row.key ? { ...item, price: value } : item,
                                  ),
                                );
                              }}
                            />
                            <button
                              type="button"
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => removeEditDailyRateRow(row.key)}
                            >
                              Retirer
                            </button>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={addEditDailyRateRow}
                      >
                        Ajouter un palier journalier
                      </button>
                    </div>

                    <label className="grid gap-1 text-sm sm:max-w-xs">
                      <span className="font-medium text-slate-700">Quantite physique</span>
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        value={editTotalQuantity}
                        onChange={(event) => setEditTotalQuantity(event.target.value)}
                        type="number"
                        min={1}
                        step="1"
                        required
                      />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-70"
                        disabled={updatingRoomId === roomType.id}
                      >
                        {updatingRoomId === roomType.id ? "Enregistrement..." : "Enregistrer"}
                      </button>

                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        onClick={cancelEditRoom}
                        disabled={updatingRoomId === roomType.id}
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {status && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{status}</p>
      )}
    </div>
  );
}
