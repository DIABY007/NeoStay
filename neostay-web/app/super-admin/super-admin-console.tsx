"use client";

import { useEffect, useMemo, useState } from "react";

import {
  BF_COUNTRY_CODE,
  BF_LOCAL_NUMBER_LENGTH,
  formatBurkinaPhone,
  normalizeBurkinaLocalNumber,
  normalizeBurkinaPhone,
} from "@/lib/phone-bf";

type Hotel = {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  status: string;
  created_at: string;
};

function toSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function SuperAdminConsole() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [isLoadingHotels, setIsLoadingHotels] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [hotelName, setHotelName] = useState("");
  const [hotelSlug, setHotelSlug] = useState("");
  const [hotelWhatsappLocal, setHotelWhatsappLocal] = useState("");
  const [isCreatingHotel, setIsCreatingHotel] = useState(false);

  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [adminPhoneLocal, setAdminPhoneLocal] = useState("");
  const [isAssigningAdmin, setIsAssigningAdmin] = useState(false);

  const [editingHotelId, setEditingHotelId] = useState<string | null>(null);
  const [editingHotelName, setEditingHotelName] = useState("");
  const [editingHotelSlug, setEditingHotelSlug] = useState("");
  const [editingHotelWhatsappLocal, setEditingHotelWhatsappLocal] = useState("");
  const [isUpdatingHotel, setIsUpdatingHotel] = useState(false);
  const [busyHotelId, setBusyHotelId] = useState<string | null>(null);

  const sortedHotels = useMemo(
    () => [...hotels].sort((a, b) => a.name.localeCompare(b.name)),
    [hotels],
  );

  async function loadHotels() {
    setIsLoadingHotels(true);
    const response = await fetch("/api/super-admin/hotels", {
      method: "GET",
      cache: "no-store",
    });

    const result = await response.json();
    setIsLoadingHotels(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Impossible de charger les hotels.");
      return;
    }

    const nextHotels = (result.hotels ?? []) as Hotel[];
    setHotels(nextHotels);
    setSelectedHotelId((current) => {
      if (nextHotels.length === 0) {
        return "";
      }

      if (current && nextHotels.some((hotel) => hotel.id === current)) {
        return current;
      }

      return nextHotels[0].id;
    });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHotels();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  async function onCreateHotel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingHotel(true);
    setStatus(null);

    const whatsappNumber = normalizeBurkinaPhone(hotelWhatsappLocal);
    if (!whatsappNumber) {
      setStatus("Numero WhatsApp invalide. Format attendu: +226XXXXXXXX.");
      setIsCreatingHotel(false);
      return;
    }

    const response = await fetch("/api/super-admin/hotels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: hotelName,
        slug: hotelSlug,
        whatsappNumber,
      }),
    });

    const result = await response.json();
    setIsCreatingHotel(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Creation hotel impossible.");
      return;
    }

    setStatus(`Hotel cree: ${result.hotel.name}`);
    setShowCreateForm(false);
    setHotelName("");
    setHotelSlug("");
    setHotelWhatsappLocal("");
    await loadHotels();
    setSelectedHotelId(result.hotel.id);
  }

  async function onAssignAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAssigningAdmin(true);
    setStatus(null);

    const phoneNumber = normalizeBurkinaPhone(adminPhoneLocal);
    if (!phoneNumber) {
      setStatus("Numero admin invalide. Format attendu: +226XXXXXXXX.");
      setIsAssigningAdmin(false);
      return;
    }

    const response = await fetch("/api/super-admin/hotel-admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber,
        hotelId: selectedHotelId,
      }),
    });

    const result = await response.json();
    setIsAssigningAdmin(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Assignation admin impossible.");
      return;
    }

    setStatus(
      `Admin ${formatBurkinaPhone(result.admin.phone_number)} assigne a l'hotel ${result.hotel.name} (${result.hotel.slug}).`,
    );
    setAdminPhoneLocal("");
  }

  function startEditHotel(hotel: Hotel) {
    setEditingHotelId(hotel.id);
    setEditingHotelName(hotel.name);
    setEditingHotelSlug(hotel.slug);
    const localPart = hotel.whatsapp_number.startsWith(BF_COUNTRY_CODE)
      ? hotel.whatsapp_number.slice(BF_COUNTRY_CODE.length)
      : hotel.whatsapp_number;
    setEditingHotelWhatsappLocal(normalizeBurkinaLocalNumber(localPart));
    setStatus(null);
  }

  function resetEditHotel() {
    setEditingHotelId(null);
    setEditingHotelName("");
    setEditingHotelSlug("");
    setEditingHotelWhatsappLocal("");
  }

  async function onUpdateHotel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingHotelId) {
      return;
    }

    setIsUpdatingHotel(true);
    setStatus(null);

    const whatsappNumber = normalizeBurkinaPhone(editingHotelWhatsappLocal);
    if (!whatsappNumber) {
      setStatus("Numero WhatsApp invalide. Format attendu: +226XXXXXXXX.");
      setIsUpdatingHotel(false);
      return;
    }

    const response = await fetch(`/api/super-admin/hotels/${editingHotelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editingHotelName,
        slug: editingHotelSlug,
        whatsappNumber,
      }),
    });

    const result = await response.json();
    setIsUpdatingHotel(false);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Modification hotel impossible.");
      return;
    }

    setStatus(`Hotel modifie: ${result.hotel.name}`);
    resetEditHotel();
    await loadHotels();
  }

  async function onDeleteHotel(hotel: Hotel) {
    const confirmed = window.confirm(
      `Supprimer l'hotel ${hotel.name} ? Cette action est irreversible.`,
    );

    if (!confirmed) {
      return;
    }

    setBusyHotelId(hotel.id);
    setStatus(null);

    const response = await fetch(`/api/super-admin/hotels/${hotel.id}`, {
      method: "DELETE",
    });

    const result = await response.json();
    setBusyHotelId(null);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Suppression hotel impossible.");
      return;
    }

    if (editingHotelId === hotel.id) {
      resetEditHotel();
    }

    setStatus(`Hotel supprime: ${hotel.name}`);
    await loadHotels();
  }

  async function onTogglePauseHotel(hotel: Hotel) {
    const nextStatus = hotel.status === "paused" ? "active" : "paused";

    setBusyHotelId(hotel.id);
    setStatus(null);

    const response = await fetch(`/api/super-admin/hotels/${hotel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    const result = await response.json();
    setBusyHotelId(null);

    if (!response.ok || !result.success) {
      setStatus(result.error ?? "Mise a jour du statut impossible.");
      return;
    }

    setStatus(
      nextStatus === "paused"
        ? `Hotel mis en pause: ${hotel.name}`
        : `Hotel reactive: ${hotel.name}`,
    );
    await loadHotels();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Hotels enregistres</h2>
            <p className="mt-1 text-sm text-slate-600">
              Liste des hotels avec actions rapides: modifier, pause et suppression.
            </p>
          </div>

          <button
            type="button"
            className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800"
            onClick={() => {
              setShowCreateForm((current) => !current);
              setStatus(null);
            }}
          >
            {showCreateForm ? "Fermer" : "Ajouter un nouvel hotel"}
          </button>
        </div>

        {showCreateForm && (
          <form
            className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
            onSubmit={onCreateHotel}
          >
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Nom</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={hotelName}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setHotelName(nextName);
                  setHotelSlug(toSlug(nextName));
                }}
                required
                minLength={2}
                placeholder="NeoStay Plateau"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">Slug URL</span>
              <input
                className="rounded-lg border border-slate-300 px-3 py-2"
                value={hotelSlug}
                onChange={(event) => setHotelSlug(toSlug(event.target.value))}
                required
                placeholder="neostay-plateau"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-700">WhatsApp reception</span>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                  {BF_COUNTRY_CODE}
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={hotelWhatsappLocal}
                  onChange={(event) =>
                    setHotelWhatsappLocal(normalizeBurkinaLocalNumber(event.target.value))
                  }
                  required
                  placeholder="70000000"
                />
              </div>
              <span className="text-xs text-slate-500">
                {hotelWhatsappLocal.length}/{BF_LOCAL_NUMBER_LENGTH} chiffres
              </span>
            </label>

            <button
              type="submit"
              className="mt-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-70"
              disabled={isCreatingHotel || hotelWhatsappLocal.length !== BF_LOCAL_NUMBER_LENGTH}
            >
              {isCreatingHotel ? "Creation..." : "Creer hotel"}
            </button>
          </form>
        )}

        {isLoadingHotels ? (
          <p className="mt-4 text-sm text-slate-600">Chargement...</p>
        ) : sortedHotels.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">Aucun hotel pour le moment.</p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm text-slate-700">
            {sortedHotels.map((hotel) => {
              const isBusy = busyHotelId === hotel.id;
              const isEditingThisHotel = editingHotelId === hotel.id;
              const isPaused = hotel.status === "paused";

              return (
                <li key={hotel.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{hotel.name}</p>
                      <p className="text-slate-600">/h/{hotel.slug}</p>
                      <p className="text-slate-600">{formatBurkinaPhone(hotel.whatsapp_number)}</p>
                      <p>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isPaused
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {isPaused ? "En pause" : "Actif"}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        onClick={() => startEditHotel(hotel)}
                        disabled={isBusy || isUpdatingHotel}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-amber-300 px-3 py-1.5 font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                        onClick={() => onTogglePauseHotel(hotel)}
                        disabled={isBusy || isUpdatingHotel}
                      >
                        {isPaused ? "Reprendre" : "Mettre en pause"}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-rose-300 px-3 py-1.5 font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                        onClick={() => onDeleteHotel(hotel)}
                        disabled={isBusy || isUpdatingHotel}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>

                  {isEditingThisHotel && (
                    <form
                      className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                      onSubmit={onUpdateHotel}
                    >
                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">Nom</span>
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={editingHotelName}
                          onChange={(event) => {
                            const nextName = event.target.value;
                            setEditingHotelName(nextName);
                            setEditingHotelSlug(toSlug(nextName));
                          }}
                          required
                          minLength={2}
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">Slug URL</span>
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          value={editingHotelSlug}
                          onChange={(event) => setEditingHotelSlug(toSlug(event.target.value))}
                          required
                        />
                      </label>

                      <label className="grid gap-1 text-sm">
                        <span className="font-medium text-slate-700">WhatsApp reception</span>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                            {BF_COUNTRY_CODE}
                          </span>
                          <input
                            type="tel"
                            inputMode="numeric"
                            autoComplete="tel"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            value={editingHotelWhatsappLocal}
                            onChange={(event) =>
                              setEditingHotelWhatsappLocal(
                                normalizeBurkinaLocalNumber(event.target.value),
                              )
                            }
                            required
                            placeholder="70000000"
                          />
                        </div>
                        <span className="text-xs text-slate-500">
                          {editingHotelWhatsappLocal.length}/{BF_LOCAL_NUMBER_LENGTH} chiffres
                        </span>
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                          disabled={
                            isUpdatingHotel ||
                            editingHotelWhatsappLocal.length !== BF_LOCAL_NUMBER_LENGTH
                          }
                        >
                          {isUpdatingHotel ? "Sauvegarde..." : "Enregistrer"}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-white"
                          onClick={resetEditHotel}
                          disabled={isUpdatingHotel}
                        >
                          Annuler
                        </button>
                      </div>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Assigner un admin hotel</h2>
        <p className="mt-1 text-sm text-slate-600">
          Le numero assigne pourra se connecter en OTP WhatsApp sur le dashboard hotel.
        </p>

        <form className="mt-5 grid gap-3" onSubmit={onAssignAdmin}>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Hotel cible</span>
            <select
              className="rounded-lg border border-slate-300 px-3 py-2"
              value={selectedHotelId}
              onChange={(event) => setSelectedHotelId(event.target.value)}
              required
              disabled={isLoadingHotels || sortedHotels.length === 0}
            >
              {sortedHotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name} ({hotel.slug})
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-slate-700">Numero admin</span>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-10 shrink-0 items-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                {BF_COUNTRY_CODE}
              </span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={adminPhoneLocal}
                onChange={(event) => setAdminPhoneLocal(normalizeBurkinaLocalNumber(event.target.value))}
                required
                placeholder="70000000"
              />
            </div>
            <span className="text-xs text-slate-500">
              {adminPhoneLocal.length}/{BF_LOCAL_NUMBER_LENGTH} chiffres
            </span>
          </label>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-70"
            disabled={
              isAssigningAdmin || sortedHotels.length === 0 || adminPhoneLocal.length !== BF_LOCAL_NUMBER_LENGTH
            }
          >
            {isAssigningAdmin ? "Assignation..." : "Assigner admin"}
          </button>
        </form>
      </section>

      {status && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {status}
        </p>
      )}
    </div>
  );
}
