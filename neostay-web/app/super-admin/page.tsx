import { SuperAdminConsole } from "./super-admin-console";

export default function SuperAdminPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-16 text-slate-900">
      <section className="mx-auto mb-6 max-w-5xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-700">
          Espace Super Admin
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Super Admin</h1>
        <p className="mt-3 text-slate-600">
          Gestion des tenants (hotels) et des acces admin hotel.
        </p>
      </section>

      <section className="mx-auto max-w-5xl">
        <SuperAdminConsole />
      </section>
    </main>
  );
}
