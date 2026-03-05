import Link from "next/link";

import { RoomsManager } from "./rooms-manager";

type Props = {
  params: Promise<{ hotelSlug: string }>;
};

export default async function HotelRoomsPage({ params }: Props) {
  const { hotelSlug } = await params;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <section className="mx-auto mb-6 max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-700">
          Gestion des chambres
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Gestion des types de chambres</h1>
        <p className="mt-2 text-slate-600">Hotel: {hotelSlug}</p>
        <div className="mt-4 flex gap-3 text-sm">
          <Link className="text-amber-700 underline" href={`/admin/${hotelSlug}`}>
            Dashboard
          </Link>
          <Link className="text-amber-700 underline" href={`/admin/${hotelSlug}/settings`}>
            Parametres hotel
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl">
        <RoomsManager hotelSlug={hotelSlug} />
      </section>
    </main>
  );
}
