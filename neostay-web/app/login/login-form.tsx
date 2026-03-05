"use client";

import { useState } from "react";
import { Globe } from "lucide-react";

import {
  BF_COUNTRY_CODE,
  BF_LOCAL_NUMBER_LENGTH,
  formatBurkinaPhone,
  normalizeBurkinaLocalNumber,
  normalizeBurkinaPhone,
} from "@/lib/phone-bf";

type Step = "phone" | "otp";

const OTP_LENGTH = 6;

export function LoginForm() {
  const [step, setStep] = useState<Step>("phone");
  const [localNumber, setLocalNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp() {
    const fullPhone = normalizeBurkinaPhone(localNumber);
    if (!fullPhone) {
      setStatus("Numero WhatsApp invalide. Utilisez un numero Burkina Faso (8 chiffres).");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de l'envoi OTP");
      }

      const sentPhone =
        typeof data.phone === "string" && data.phone.length > 0
          ? data.phone
          : fullPhone;

      setPhone(formatBurkinaPhone(sentPhone));
      setStep("otp");
      setStatus("OTP envoye. Saisissez le code recu sur WhatsApp.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Code incorrect");
      }

      setStatus("Connexion reussie. Redirection...");

      // Redirection selon le rôle
      const role = data.user?.role;
      if (role === "super_admin") {
        window.location.href = "/super-admin";
      } else if (role === "hotel_admin") {
        const slug = data.user?.hotelId; // affiné côté route si besoin
        window.location.href = slug ? `/admin/${slug}` : "/admin";
      } else {
        window.location.href = "/";
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Code incorrect");
    } finally {
      setLoading(false);
    }
  }

  function backToPhoneStep() {
    setStep("phone");
    setOtp("");
    setPhone("");
    setStatus(null);
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-slate-700" htmlFor="phone-local">
        Numero WhatsApp
      </label>

      <div className="flex items-center gap-2">
        <span className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
          <Globe className="h-4 w-4" /> {BF_COUNTRY_CODE}
        </span>
        <input
          id="phone-local"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none ring-emerald-300 focus:ring"
          placeholder="70000000"
          value={localNumber}
          onChange={(event) => setLocalNumber(normalizeBurkinaLocalNumber(event.target.value))}
          disabled={loading || step === "otp"}
        />
      </div>

      <p
        className={`text-xs ${
          localNumber.length === BF_LOCAL_NUMBER_LENGTH ? "text-emerald-700" : "text-slate-500"
        }`}
      >
        {localNumber.length}/{BF_LOCAL_NUMBER_LENGTH} chiffres
      </p>

      {step === "otp" && (
        <>
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
            Code envoye sur {phone}
          </p>
          <label className="block text-sm font-medium text-slate-700" htmlFor="otp">
            Code OTP
          </label>
          <input
            id="otp"
            inputMode="numeric"
            maxLength={OTP_LENGTH}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.35em] outline-none ring-emerald-300 focus:ring"
            placeholder="123456"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
            disabled={loading}
          />
        </>
      )}

      <button
        type="button"
        className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        onClick={step === "phone" ? requestOtp : verifyOtp}
        disabled={loading || (step === "phone" && localNumber.length !== BF_LOCAL_NUMBER_LENGTH)}
      >
        {loading
          ? "Traitement..."
          : step === "phone"
            ? "Envoyer le code"
            : "Verifier le code"}
      </button>

      {step === "otp" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={backToPhoneStep}
            disabled={loading}
          >
            Retour
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={requestOtp}
            disabled={loading}
          >
            Renvoyer OTP
          </button>
        </div>
      )}

      {status && <p className="text-sm text-slate-600">{status}</p>}
    </div>
  );
}
