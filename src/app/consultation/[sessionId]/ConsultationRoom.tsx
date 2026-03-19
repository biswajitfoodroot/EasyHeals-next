"use client";

/**
 * ConsultationRoom.tsx  —  P3 Day 3
 * Professional video consultation room built on Jitsi Meet (free tier).
 * Brand: EasyHeals green (#1B8A4A). Dark UI (video call convention).
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface JoinData {
  sessionId: string;
  roomId?: string;
  joinUrl?: string;
  status?: string;
  waitingRoom?: boolean;
  isModerator?: boolean;
  message?: string;
}

type PageState = "loading" | "waiting_room" | "active" | "ended" | "error";

// ── Small icon components ────────────────────────────────────────────────────

function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="h-7 w-7 flex-shrink-0">
      <rect width="32" height="32" rx="8" fill="#1B8A4A" />
      <path d="M9 16h6m0 0v-6m0 6v6m6-6h-6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ShieldCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zm2.707 6.78a1 1 0 00-1.414-1.414L9 9.586 8.707 9.293a1 1 0 00-1.414 1.414l1 1a1 1 0 001.414 0l3-3z" clipRule="evenodd" />
    </svg>
  );
}

// ── Session timer ────────────────────────────────────────────────────────────

function useTimer(running: boolean) {
  const [s, setS] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (running) { ref.current = setInterval(() => setS((x) => x + 1), 1000); }
    else { if (ref.current) clearInterval(ref.current); }
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// ── Screens ──────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-[#0a0f14] flex flex-col items-center justify-center gap-8 p-6">
      <LogoMark />
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <div className="absolute inset-0 rounded-full border-[3px] border-[#1B8A4A]/20" />
          <div className="absolute inset-0 rounded-full border-[3px] border-[#1B8A4A] border-t-transparent animate-spin" />
        </div>
        <div className="text-center">
          <p className="text-gray-200 text-base font-medium">Connecting to consultation room</p>
          <p className="text-gray-500 text-sm mt-1">Verifying your session…</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-gray-600 text-xs">
        <ShieldCheck />
        <span>End-to-end encrypted · DPDP compliant</span>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-8 max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8 text-red-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Unable to Join</h2>
        <p className="text-gray-400 text-sm leading-relaxed mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="w-full bg-[#1B8A4A] hover:bg-[#136836] text-white text-sm font-semibold py-3 rounded-xl transition-colors"
        >
          Try Again
        </button>
        <a href="/" className="block mt-3 text-gray-600 hover:text-gray-400 text-xs transition-colors">
          ← Return to Home
        </a>
      </div>
    </div>
  );
}

function WaitingRoomScreen({ message }: { message?: string }) {
  const bars = [0.35, 0.6, 0.9, 0.75, 1, 0.75, 0.9, 0.6, 0.35];
  return (
    <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-8 max-w-sm w-full">
        {/* Animated equalizer bars */}
        <div className="flex items-end justify-center gap-1 h-10 mb-8">
          {bars.map((h, i) => (
            <div
              key={i}
              className="w-1.5 rounded-full bg-[#1B8A4A] animate-pulse"
              style={{ height: `${h * 100}%`, animationDelay: `${i * 0.1}s`, animationDuration: "1s" }}
            />
          ))}
        </div>

        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-white mb-2">Waiting Room</h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            {message ?? "The doctor will admit you shortly. Please make sure your camera and microphone are working."}
          </p>
        </div>

        {/* Preparation tips */}
        <div className="bg-[#0d1117] rounded-xl border border-[#21262d] p-4 space-y-3">
          <p className="text-[#1B8A4A] text-xs font-semibold uppercase tracking-wider">Preparation Tips</p>
          {[
            "Sit facing a window for good lighting",
            "Use headphones to reduce echo",
            "Find a quiet, private location",
            "Have your medical reports handy",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1B8A4A] mt-1.5 flex-shrink-0" />
              <p className="text-gray-500 text-xs leading-relaxed">{tip}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-gray-600 text-xs">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#1B8A4A]/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <span>Checking every 5 seconds</span>
        </div>
      </div>
    </div>
  );
}

function EndedScreen({ duration }: { duration: string }) {
  return (
    <div className="min-h-screen bg-[#0a0f14] flex items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#21262d] rounded-2xl p-8 max-w-sm w-full">
        <div className="w-16 h-16 rounded-full bg-[#1B8A4A]/10 border border-[#1B8A4A]/20 flex items-center justify-center mx-auto mb-5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-8 w-8 text-[#1B8A4A]">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-white mb-1">Consultation Complete</h2>
          <p className="text-gray-500 text-sm">Duration: <span className="text-gray-300 font-mono">{duration}</span></p>
        </div>

        <div className="bg-[#0d1117] rounded-xl border border-[#21262d] p-4 mb-6">
          <p className="text-gray-400 text-sm leading-relaxed">
            Your visit summary will appear in <strong className="text-gray-300">My Health Records</strong> shortly.
            Any prescriptions issued by your doctor are available in <strong className="text-gray-300">My Prescriptions</strong>.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          <a
            href="/"
            className="block w-full text-center bg-[#1B8A4A] hover:bg-[#136836] text-white text-sm font-semibold py-3 rounded-xl transition-colors"
          >
            Return to Home
          </a>
          <a
            href="/appointments"
            className="block w-full text-center border border-[#21262d] hover:border-[#30363d] text-gray-400 hover:text-gray-300 text-sm py-3 rounded-xl transition-colors"
          >
            View Appointments
          </a>
        </div>
      </div>
    </div>
  );
}

function EndDialog({
  notes, onNotesChange, onCancel, onConfirm, loading,
}: {
  notes: string;
  onNotesChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#161b22] border border-[#21262d] rounded-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="px-6 pt-6 pb-4 border-b border-[#21262d]">
          <h3 className="text-base font-semibold text-white">End Consultation?</h3>
          <p className="text-gray-400 text-sm mt-1">This will close the room for all participants.</p>
        </div>
        <div className="px-6 py-5">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Post-Visit Notes <span className="font-normal normal-case">(optional — saved to patient EMR)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="e.g. Prescribed paracetamol 500mg for fever. Follow up in 2 weeks if symptoms persist…"
            rows={4}
            className="w-full bg-[#0d1117] text-gray-200 placeholder-gray-600 text-sm rounded-xl p-3.5 border border-[#30363d] focus:outline-none focus:border-[#1B8A4A]/60 resize-none transition-colors"
          />
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white border border-[#30363d] hover:border-[#484f58] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {loading ? "Ending…" : "End Session"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function ConsultationRoom({ sessionId }: { sessionId: string }) {
  const [state, setState] = useState<PageState>("loading");
  const [joinData, setJoinData] = useState<JoinData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [endingSession, setEndingSession] = useState(false);
  const [notes, setNotes] = useState("");
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [endedDuration, setEndedDuration] = useState("—");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useTimer(state === "active");

  const fetchJoin = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/consultations/${sessionId}/join`);
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 410) { setState("ended"); return; }
        setError(json?.error?.message ?? "Failed to join consultation.");
        setState("error");
        return;
      }
      const data: JoinData = json.data;
      setJoinData(data);
      if (data.waitingRoom) { setState("waiting_room"); }
      else if (data.joinUrl) { setState("active"); }
      else { setError("Unable to get consultation room URL."); setState("error"); }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setState("error");
    }
  }, [sessionId]);

  useEffect(() => { fetchJoin(); }, [fetchJoin]);

  useEffect(() => {
    if (state === "waiting_room") {
      pollRef.current = setTimeout(() => fetchJoin(), 5000);
    }
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [state, joinData, fetchJoin]);

  const handleEnd = async () => {
    setEndingSession(true);
    setEndedDuration(timer);
    try {
      const res = await fetch(`/api/v1/consultations/${sessionId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notes ? { postVisitNotes: notes } : {}),
      });
      if (res.ok) { setState("ended"); }
      else { const j = await res.json(); setError(j?.error?.message ?? "Failed to end session."); }
    } catch { setError("Network error while ending session."); }
    finally { setEndingSession(false); setShowEndDialog(false); }
  };

  if (state === "loading") return <LoadingScreen />;
  if (state === "error") return <ErrorScreen message={error ?? "Something went wrong."} onRetry={() => { setState("loading"); fetchJoin(); }} />;
  if (state === "waiting_room") return <WaitingRoomScreen message={joinData?.message} />;
  if (state === "ended") return <EndedScreen duration={endedDuration} />;

  return (
    <div className="h-screen bg-[#0a0f14] flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-[#161b22] border-b border-[#21262d] flex-shrink-0 z-10">
        <div className="flex items-center gap-3">
          <LogoMark />
          <div className="hidden sm:block w-px h-5 bg-[#30363d]" />
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute h-full w-full rounded-full bg-[#1B8A4A] opacity-60" />
              <span className="relative rounded-full h-2 w-2 bg-[#1B8A4A]" />
            </span>
            <span className="text-gray-300 text-sm font-medium">Live Consultation</span>
          </div>
          <span className="font-mono text-xs bg-[#0d1117] border border-[#21262d] text-[#1B8A4A] px-2.5 py-0.5 rounded-lg">
            {timer}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-gray-600 text-xs">
            <ShieldCheck />
            <span>Encrypted</span>
          </div>
          {joinData?.isModerator && (
            <>
              <div className="hidden sm:block w-px h-4 bg-[#30363d]" />
              <button
                onClick={() => setShowEndDialog(true)}
                className="flex items-center gap-2 bg-red-600/90 hover:bg-red-600 text-white text-xs sm:text-sm font-semibold px-3 sm:px-4 py-1.5 rounded-xl transition-all hover:shadow-lg hover:shadow-red-900/30"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.773-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                <span className="hidden sm:inline">End Session</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Jitsi iframe — fills remaining viewport */}
      {joinData?.joinUrl && (
        <iframe
          key={joinData.joinUrl}
          src={joinData.joinUrl}
          className="flex-1 w-full border-0"
          allow="camera; microphone; display-capture; fullscreen; autoplay; clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-orientation-lock allow-pointer-lock allow-presentation allow-top-navigation-by-user-activation"
          title="EasyHeals Consultation Room"
        />
      )}

      {showEndDialog && (
        <EndDialog
          notes={notes}
          onNotesChange={setNotes}
          onCancel={() => setShowEndDialog(false)}
          onConfirm={handleEnd}
          loading={endingSession}
        />
      )}
    </div>
  );
}
