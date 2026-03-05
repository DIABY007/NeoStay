import Link from "next/link";

import { BookingsManager } from "./bookings-manager";

type Props = {
  params: Promise<{ hotelSlug: string }>;
};

export default async function HotelAdminPage({ params }: Props) {
  const { hotelSlug } = await params;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <section className="mx-auto mb-6 max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
          Admin Hotel
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Tableau de bord Hotel</h1>
        <p className="mt-3 text-slate-600">
          Hotel cible: <span className="font-semibold">{hotelSlug}</span>
        </p>
        <p className="mt-2 text-slate-600">
          Authentification OTP et redirection role-based actives.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/admin/${hotelSlug}/rooms`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Gerer types de chambres
          </Link>
          <Link
            href={`/admin/${hotelSlug}/settings`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Parametres hotel
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl">
        <BookingsManager hotelSlug={hotelSlug} />
      </section>
    </main>
  );
}
