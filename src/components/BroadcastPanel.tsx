"use client";

/**
 * BroadcastPanel
 *
 * P2 Day 4 — Admin mass broadcast UI (HLD §5.8)
 *
 * Used inside the admin dashboard (src/app/admin/AdminDashboardClient.tsx)
 * as the "broadcast" tab. Allows owner/admin to:
 *   1. Preview recipient count (consent-filtered, with optional hospital/city filter)
 *   2. Send WA template or SMS campaign to consented patients
 *   3. View recent broadcast history
 *
 * API: POST /api/admin/broadcast + GET /api/admin/broadcast
 *
 * DPDP-first: the panel shows a consent gate reminder before every send.
 * Recipients are always filtered to marketing-consented patients only.
 */

import { useEffect, useState } from "react";

interface BroadcastHistory {
  id: string;
  channel: string;
  templateName: string;
  recipientCount: number;
  sent: number;
  failed: number;
  hospitalId?: string | null;
  city?: string | null;
  sentBy?: string;
  sentAt: string;
}

interface PreviewResult {
  eligibleRecipients: number;
  channel: string;
  templateName: string;
}

interface SendResult {
  recipientCount: number;
  sent: number;
  failed: number;
}

export function BroadcastPanel() {
  // Form state
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [templateName, setTemplateName] = useState("");
  const [vars, setVars] = useState("");       // JSON string of { KEY: "value" }
  const [hospitalId, setHospitalId] = useState("");
  const [city, setCity] = useState("");

  // UI state
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Load history on mount
  useEffect(() => {
    fetch("/api/admin/broadcast?limit=20")
      .then((r) => r.json())
      .then((d) => setHistory(d.data ?? []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }, [sendResult]);

  function parseVars(): Record<string, string> | null {
    if (!vars.trim()) return {};
    try {
      return JSON.parse(vars);
    } catch {
      return null;
    }
  }

  async function handlePreview() {
    setError(null);
    setPreview(null);
    setSendResult(null);
    setConfirmed(false);

    const parsedVars = parseVars();
    if (parsedVars === null) {
      setError("Template variables must be valid JSON. Example: {\"HOSPITAL\": \"Apollo\"}");
      return;
    }

    if (!templateName.trim()) {
      setError("Template name is required.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          templateName: templateName.trim(),
          vars: parsedVars,
          hospitalId: hospitalId.trim() || undefined,
          city: city.trim() || undefined,
          previewOnly: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
      setPreview({
        eligibleRecipients: data.eligibleRecipients,
        channel: data.channel,
        templateName: data.templateName,
      });
    } catch (err: any) {
      setError(err.message ?? "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!confirmed) return;
    setError(null);
    setSendResult(null);

    const parsedVars = parseVars();
    if (parsedVars === null) {
      setError("Invalid JSON in template variables.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          templateName: templateName.trim(),
          vars: parsedVars,
          hospitalId: hospitalId.trim() || undefined,
          city: city.trim() || undefined,
          previewOnly: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
      setSendResult({
        recipientCount: data.recipientCount,
        sent: data.sent,
        failed: data.failed,
      });
      setPreview(null);
      setConfirmed(false);
    } catch (err: any) {
      setError(err.message ?? "Broadcast failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Mass Broadcast</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Messages are sent only to patients who have granted{" "}
            <span className="font-medium text-green-700">marketing consent</span>.
          </p>
        </div>
      </div>

      {/* Compose form */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-800">Compose Broadcast</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Channel */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Channel</label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as "whatsapp" | "sms")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="whatsapp">WhatsApp</option>
              <option value="sms">SMS</option>
            </select>
          </div>

          {/* Template */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {channel === "whatsapp" ? "WA Template Name" : "DLT Template ID"}
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder={channel === "whatsapp" ? "easyheals_promo_v1" : "1007xxxxxxxx"}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Filters */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Filter by Hospital ID{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={hospitalId}
              onChange={(e) => setHospitalId(e.target.value)}
              placeholder="UUID of hospital"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Filter by City{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. mumbai"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Template vars */}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Template Variables{" "}
              <span className="font-normal text-gray-400">(JSON)</span>
            </label>
            <input
              type="text"
              value={vars}
              onChange={(e) => setVars(e.target.value)}
              placeholder='{"HOSPITAL": "Apollo", "OFFER": "20% off"}'
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
        )}

        {/* Preview result + consent gate */}
        {preview && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-800">
              Ready to send to{" "}
              <span className="text-amber-900">{preview.eligibleRecipients.toLocaleString("en-IN")}</span>{" "}
              consented patients
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Channel: <strong>{preview.channel.toUpperCase()}</strong> · Template:{" "}
              <strong>{preview.templateName}</strong>
            </p>
            <label className="mt-3 flex items-start gap-2 text-xs text-amber-700">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 rounded border-amber-400"
              />
              I confirm that this broadcast targets only consented patients and complies with
              DPDP Act 2023 marketing consent requirements.
            </label>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSend}
                disabled={!confirmed || loading}
                className="rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? "Sending…" : `Send to ${preview.eligibleRecipients.toLocaleString("en-IN")} patients`}
              </button>
              <button
                onClick={() => { setPreview(null); setConfirmed(false); }}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Send result */}
        {sendResult && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">Broadcast sent</p>
            <div className="mt-1 flex gap-4 text-xs text-green-700">
              <span>Sent: <strong>{sendResult.sent.toLocaleString("en-IN")}</strong></span>
              <span>Failed: <strong className={sendResult.failed > 0 ? "text-red-600" : ""}>{sendResult.failed}</strong></span>
              <span>Total: <strong>{sendResult.recipientCount.toLocaleString("en-IN")}</strong></span>
            </div>
          </div>
        )}

        {/* Actions */}
        {!preview && !sendResult && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={handlePreview}
              disabled={loading || !templateName.trim()}
              className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Preview Recipients"}
            </button>
          </div>
        )}
      </div>

      {/* Broadcast history */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Recent Broadcasts</h3>
        {historyLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs text-gray-400">No broadcasts sent yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Channel</th>
                  <th className="pb-2 pr-4 font-medium">Template</th>
                  <th className="pb-2 pr-4 font-medium text-right">Sent</th>
                  <th className="pb-2 pr-4 font-medium text-right">Failed</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((h) => (
                  <tr key={h.id} className="text-gray-700">
                    <td className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${
                        h.channel === "whatsapp"
                          ? "bg-green-50 text-green-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {h.channel?.toUpperCase() ?? "—"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-gray-500">{h.templateName}</td>
                    <td className="py-2 pr-4 text-right font-semibold text-green-700">
                      {(h.sent ?? 0).toLocaleString("en-IN")}
                    </td>
                    <td className={`py-2 pr-4 text-right font-semibold ${h.failed > 0 ? "text-red-600" : "text-gray-400"}`}>
                      {(h.failed ?? 0).toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 text-gray-400">
                      {h.sentAt
                        ? new Date(h.sentAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
