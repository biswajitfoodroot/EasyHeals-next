"use client";

/**
 * DocumentsTab — Health Documents Management
 *
 * Lists uploaded documents with AI extraction status.
 * FAB opens UploadSheet (camera + file, mobile-first).
 * Documents show status badge: pending / processing / done / failed
 * Tapping a doc opens DocumentDetailSheet.
 */

import { useState, useEffect, useRef } from "react";
import { BottomSheet } from "@/components/BottomSheet";

interface HealthDoc {
  id: string;
  title: string | null;
  docType: string | null;
  fileType: string;
  sourceName: string | null;
  docDate: string | null;
  aiStatus: string;
  uploadedAt: string | null;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  lab_report: "Lab Report",
  prescription: "Prescription",
  discharge: "Discharge Summary",
  imaging: "Scan / Imaging",
  other: "Document",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: "Queued",     color: "#64748b", bg: "#f1f5f9" },
  processing: { label: "Reading…",  color: "#1d4ed8", bg: "#dbeafe" },
  done:       { label: "Analysed",  color: "#047857", bg: "#d1fae5" },
  failed:     { label: "Failed",    color: "#be123c", bg: "#ffe4e6" },
};

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "webp"];

/** Check file type by MIME or extension (mobile cameras often send empty MIME) */
function isAllowedFile(file: File): boolean {
  if (file.type && ALLOWED_MIME.includes(file.type.toLowerCase())) return true;
  const ext = file.name?.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXT.includes(ext);
}

function DocCard({ doc, onTap }: { doc: HealthDoc; onTap: () => void }) {
  const statusCfg = STATUS_CONFIG[doc.aiStatus] ?? STATUS_CONFIG.pending;
  const typeLabel = doc.docType ? (DOC_TYPE_LABELS[doc.docType] ?? doc.docType) : "Document";
  const uploadDate = doc.uploadedAt
    ? new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";

  return (
    <button
      onClick={onTap}
      style={{
        width: "100%",
        background: "#fff",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 8,
        border: "1px solid #f1f5f9",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {/* File type icon */}
      <div style={{
        width: 40,
        height: 44,
        borderRadius: 8,
        background: doc.fileType === "pdf" ? "#fef3c7" : "#e0f2fe",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontSize: 18,
      }}>
        {doc.fileType === "pdf" ? "📄" : "🖼️"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {doc.title ?? typeLabel}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {doc.sourceName && (
            <span style={{ fontSize: 12, color: "#64748b" }}>{doc.sourceName}</span>
          )}
          {uploadDate && (
            <span style={{ fontSize: 11, color: "#cbd5e1" }}>{uploadDate}</span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <div style={{
        padding: "3px 8px",
        borderRadius: 6,
        background: statusCfg.bg,
        color: statusCfg.color,
        fontSize: 11,
        fontWeight: 600,
        flexShrink: 0,
      }}>
        {statusCfg.label}
      </div>
    </button>
  );
}

function UploadSheet({ onSuccess }: { onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("lab_report");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(file: File | null) {
    if (!file) return;
    if (!isAllowedFile(file)) {
      setError("Only PDF, JPEG, PNG, and WebP files are supported");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File must be under 10MB");
      return;
    }
    setSelectedFile(file);
    setError(null);
  }

  async function upload() {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      if (title.trim()) fd.append("title", title.trim());
      fd.append("docType", docType);

      const res = await fetch("/api/v1/patients/documents", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Upload failed. Try again.");
        return;
      }
      onSuccess();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      {!selectedFile ? (
        <>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
            Upload your lab reports, prescriptions, or discharge summaries. Our AI will extract the health data automatically.
          </div>

          {/* Camera option */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            style={{
              width: "100%",
              padding: "16px",
              background: "#f0fdf4",
              border: "1.5px dashed #16a34a",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              marginBottom: 10,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ fontSize: 28 }}>📷</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 600, color: "#15803d", fontSize: 14 }}>Take a Photo</div>
              <div style={{ fontSize: 12, color: "#4ade80" }}>Opens your camera</div>
            </div>
          </button>

          {/* Gallery / file option */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%",
              padding: "16px",
              background: "#f8fafc",
              border: "1.5px dashed #94a3b8",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ fontSize: 28 }}>📁</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 600, color: "#475569", fontSize: 14 }}>Choose File</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>PDF, JPEG, PNG up to 10MB</div>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          />

          {error && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "#fef2f2", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>
              {error}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Preview + metadata */}
          <div style={{
            padding: 12,
            background: "#f8fafc",
            borderRadius: 10,
            border: "1px solid #e2e8f0",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span style={{ fontSize: 24 }}>{selectedFile.type === "application/pdf" ? "📄" : "🖼️"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{selectedFile.name}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{(selectedFile.size / 1024).toFixed(0)} KB</div>
            </div>
            <button
              onClick={() => setSelectedFile(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 18 }}
            >
              ×
            </button>
          </div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
            Document Type
          </label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
          >
            <option value="lab_report">Lab Report</option>
            <option value="prescription">Prescription</option>
            <option value="discharge">Discharge Summary</option>
            <option value="imaging">Scan / Imaging</option>
            <option value="other">Other</option>
          </select>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
            Title (optional)
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. CBC Report — March 2025"
            style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e2e8f0", borderRadius: 10, fontSize: 14, marginBottom: 16, boxSizing: "border-box", outline: "none" }}
          />

          {error && (
            <div style={{ padding: "8px 12px", background: "#fef2f2", borderRadius: 8, color: "#ef4444", fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button
            onClick={upload}
            disabled={uploading}
            style={{
              width: "100%",
              padding: "14px",
              background: uploading ? "#94a3b8" : "#0f766e",
              color: "#fff",
              border: "none",
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              cursor: uploading ? "not-allowed" : "pointer",
            }}
          >
            {uploading ? "Uploading & analysing..." : "Upload Document"}
          </button>
        </>
      )}
    </div>
  );
}

export function DocumentsTab() {
  const [docs, setDocs] = useState<HealthDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<HealthDoc | null>(null);

  function loadDocs() {
    setLoading(true);
    fetch("/api/v1/patients/documents", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { data?: HealthDoc[]; error?: string }) => {
        if (d.data) setDocs(d.data);
        else setError(d.error ?? "Failed to load documents");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadDocs(); }, []);

  return (
    <div style={{ padding: "0 16px", position: "relative" }}>
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading documents...</div>
      )}

      {error && (
        <div style={{ padding: 16, background: "#fef2f2", borderRadius: 10, color: "#ef4444", fontSize: 14 }}>
          {error}
        </div>
      )}

      {!loading && !error && docs.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>No documents yet</div>
          <div style={{ fontSize: 14, color: "#64748b", marginBottom: 20 }}>
            Upload lab reports, prescriptions, or discharge summaries. Our AI extracts health events automatically.
          </div>
          <button
            onClick={() => setShowUpload(true)}
            style={{
              padding: "12px 24px",
              background: "#0f766e",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Upload Document
          </button>
        </div>
      )}

      {docs.map((doc) => (
        <DocCard key={doc.id} doc={doc} onTap={() => setSelectedDoc(doc)} />
      ))}

      {/* FAB */}
      {!loading && (
        <button
          onClick={() => setShowUpload(true)}
          aria-label="Upload document"
          style={{
            position: "fixed",
            bottom: 88,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#0f766e",
            color: "#fff",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(15,118,110,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          +
        </button>
      )}

      {/* Upload sheet */}
      <BottomSheet open={showUpload} onClose={() => setShowUpload(false)} title="Upload Document">
        <UploadSheet onSuccess={() => { setShowUpload(false); loadDocs(); }} />
      </BottomSheet>

      {/* Document detail sheet */}
      <BottomSheet
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        title={selectedDoc?.title ?? selectedDoc?.docType ?? "Document"}
        subtitle={selectedDoc?.sourceName ?? undefined}
      >
        {selectedDoc && (
          <div style={{ padding: 20 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <InfoItem label="Type" value={selectedDoc.docType ? (DOC_TYPE_LABELS[selectedDoc.docType] ?? selectedDoc.docType) : "Document"} />
              <InfoItem label="Status" value={STATUS_CONFIG[selectedDoc.aiStatus]?.label ?? selectedDoc.aiStatus} />
              {selectedDoc.docDate && <InfoItem label="Document Date" value={new Date(selectedDoc.docDate).toLocaleDateString("en-IN")} />}
              {selectedDoc.uploadedAt && <InfoItem label="Uploaded" value={new Date(selectedDoc.uploadedAt).toLocaleDateString("en-IN")} />}
            </div>
            {selectedDoc.aiStatus === "done" && (
              <div style={{ padding: 12, background: "#f0fdf4", borderRadius: 10, fontSize: 13, color: "#15803d", marginBottom: 12 }}>
                ✓ AI extraction complete. Health events have been added to your timeline.
              </div>
            )}
            {selectedDoc.aiStatus === "failed" && (
              <div style={{ padding: 12, background: "#fef2f2", borderRadius: 10, fontSize: 13, color: "#ef4444", marginBottom: 12 }}>
                ⚠ AI extraction failed. The document is saved but events were not extracted.
              </div>
            )}
            {selectedDoc.aiStatus === "processing" && (
              <div style={{ padding: 12, background: "#dbeafe", borderRadius: 10, fontSize: 13, color: "#1d4ed8", marginBottom: 12 }}>
                🔄 AI is reading your document...
              </div>
            )}

            {/* Download button */}
            <a
              href={`/api/v1/patients/documents/${selectedDoc.id}/download`}
              download
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "12px",
                background: "#0f766e",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              📥 Download Document
            </a>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{value}</div>
    </div>
  );
}
