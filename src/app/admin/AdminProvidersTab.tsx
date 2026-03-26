"use client";

/**
 * Provider management has moved to the dedicated Provider Management portal.
 * This stub keeps the admin tab slot valid and redirects users there.
 */
export function AdminProvidersTab() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10 text-center space-y-4">
      <div className="text-4xl">🏥</div>
      <h2 className="text-lg font-bold text-slate-800">Provider Management</h2>
      <p className="text-sm text-slate-500 max-w-sm mx-auto">
        Provider verification, EasyHeals Network badges, and agreement management have moved to the
        dedicated Provider Management portal.
      </p>
      <a
        href="/provider-management/providers"
        className="inline-block px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition"
      >
        Go to Provider Management →
      </a>
    </div>
  );
}
