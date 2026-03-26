/**
 * Seed script — chatbot_knowledge + chatbot_training_examples
 *
 * Sources loaded:
 *   V2: EasyHeals_AI_Chatbot_Training_Dataset_V2_Multilingual.xlsx
 *       → 40 symptoms with 8-language aliases (330+ aliases/symptom)
 *       → 60 reports, 8 intents, 14 response templates (8 languages each)
 *   V4: EasyHeals_V4_Production_Dataset_4000.xlsx
 *       → Enriched symptom_catalog (40), report_catalog (60), procedure_catalog (30),
 *         doctor_hospital_catalog (15) — merged into chatbot_knowledge
 *   V3 JSONL: EasyHeals_V3_Finetuning_2000.jsonl → 2000 training examples
 *   V4 JSONL: EasyHeals_V4_Production_Dataset_4000.jsonl → 4000 training examples with intent+subtype
 *
 * Run: npx tsx drizzle/seed-chatbot-knowledge.ts
 * Safe to re-run — uses ON CONFLICT DO UPDATE for knowledge, full replace for training examples.
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as XLSX from "xlsx";

dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const HLD = "C:/Biswajit/Codex/HLD";
const V2_XLSX = `${HLD}/EasyHeals_AI_Chatbot_Training_Dataset_V2_Multilingual.xlsx`;
const V4_XLSX = `${HLD}/EasyHeals_V4_Production_Dataset_4000.xlsx`;
const V3_JSONL = `${HLD}/EasyHeals_V3_Finetuning_2000.jsonl`;
const V4_JSONL = `${HLD}/EasyHeals_V4_Production_Dataset_4000.jsonl`;

// ─── Cluster map — Symptom ID → cluster key ───────────────────────────────────
const CLUSTER_MAP: Record<string, string> = {
  SYM001: "infectious_general", SYM002: "neuro", SYM003: "cardiac",
  SYM004: "digestive", SYM005: "digestive", SYM006: "digestive",
  SYM007: "digestive", SYM008: "digestive", SYM009: "respiratory",
  SYM010: "respiratory", SYM011: "musculoskeletal", SYM012: "musculoskeletal",
  SYM013: "musculoskeletal", SYM014: "skin", SYM015: "skin",
  SYM016: "skin", SYM017: "metabolic", SYM018: "metabolic",
  SYM019: "metabolic", SYM020: "neuro", SYM021: "urinary",
  SYM022: "digestive", SYM023: "women_health", SYM024: "women_health",
  SYM025: "women_health", SYM026: "women_health", SYM027: "mental_health",
  SYM028: "mental_health", SYM029: "respiratory", SYM030: "ent",
  SYM031: "ent", SYM032: "cardiac", SYM033: "cardiac",
  SYM034: "neuro", SYM035: "neuro", SYM036: "eye",
  SYM037: "musculoskeletal", SYM038: "dental", SYM039: "mental_health",
  SYM040: "neuro",
};

// Symptom name → cluster (for V4 enrichment lookup)
const NAME_TO_CLUSTER: Record<string, string> = {
  "fever": "infectious_general", "headache": "neuro", "chest pain": "cardiac",
  "abdominal pain": "digestive", "bloating": "digestive", "vomiting": "digestive",
  "diarrhea": "digestive", "constipation": "digestive", "cough": "respiratory",
  "breathlessness": "respiratory", "back pain": "musculoskeletal", "knee pain": "musculoskeletal",
  "joint pain": "musculoskeletal", "skin rash": "skin", "hair loss": "skin",
  "weight loss": "metabolic", "weight gain": "metabolic", "fatigue": "metabolic",
  "dizziness": "neuro", "burning urination": "urinary", "blood in stool": "digestive",
  "irregular periods": "women_health", "pelvic pain": "women_health",
  "anxiety": "mental_health", "sleep problem": "mental_health",
  "sore throat": "ent", "ear pain": "ent", "sinus problem": "ent",
  "palpitations": "cardiac", "leg swelling": "cardiac",
  "weakness on one side": "neuro", "seizure": "neuro",
  "allergy": "skin", "eye redness": "eye", "tooth pain": "dental",
  "neck pain": "musculoskeletal", "shoulder pain": "musculoskeletal",
  "loss of appetite": "digestive", "jaundice": "digestive", "itching": "skin",
};

// ─── Upsert helper ─────────────────────────────────────────────────────────────
async function upsertKnowledge(
  type: string, key: string, aliases: string[], data: object, sortOrder: number,
) {
  await client.execute({
    sql: `INSERT INTO chatbot_knowledge (id, type, key, aliases, data, is_active, sort_order)
          VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 1, ?)
          ON CONFLICT(type, key) DO UPDATE SET
            aliases    = excluded.aliases,
            data       = excluded.data,
            sort_order = excluded.sort_order,
            updated_at = (unixepoch() * 1000)`,
    args: [type, key, JSON.stringify(aliases), JSON.stringify(data), sortOrder],
  });
}

function mapUrgency(u: string): string {
  const l = (u ?? "").toLowerCase();
  if (l === "high") return "urgent";
  if (l === "medium") return "within_week";
  if (l === "low") return "routine";
  return "within_week";
}

function splitList(s: string): string[] {
  return (s || "").split(/,|;/).map(x => x.trim()).filter(Boolean);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. V2 XLSX — multilingual aliases from Symptom_Localization
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[V2] Loading multilingual aliases...");
  const wb2 = XLSX.readFile(V2_XLSX);
  const locRows = XLSX.utils.sheet_to_json<Record<string, string>>(wb2.Sheets["Symptom_Localization"], { defval: "" });
  const v2AliasMap: Record<string, string[]> = {};
  for (const r of locRows) {
    const id = r["Symptom ID"];
    if (!v2AliasMap[id]) v2AliasMap[id] = [];
    const localized = r["Localized Symptom"]?.trim();
    const variants = (r["Common Query Variants"] || "").split("|").map(s => s.trim()).filter(Boolean);
    if (localized) v2AliasMap[id].push(localized);
    v2AliasMap[id].push(...variants);
  }
  for (const id of Object.keys(v2AliasMap)) {
    v2AliasMap[id] = [...new Set(v2AliasMap[id])];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. V2 Symptoms (40) — with multilingual aliases
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[V2] Seeding 40 symptoms...");
  const v2Sym = XLSX.utils.sheet_to_json<Record<string, string>>(wb2.Sheets["Symptom_Catalog"], { defval: "" });
  for (let i = 0; i < v2Sym.length; i++) {
    const r = v2Sym[i];
    const id = r["Symptom ID"] as string;
    const key = (r["Symptom (English)"] as string).trim();
    const data = {
      commonCauses: splitList(r["Common Causes (EN)"]),
      keyQuestions: splitList(r["Key Questions (EN)"]),
      safeInitialAdvice: (r["Safe Initial Advice (EN)"] || "").trim(),
      redFlags: splitList(r["Red Flags (EN)"]),
      likelySpecialty: (r["Likely Specialty"] || "").trim(),
      urgencyPattern: mapUrgency(r["Urgency Pattern"]),
      baseResponseTemplate: (r["Base Response Template (EN)"] || "").trim(),
      cluster: (r["Cluster / Template Key"] || "").trim(),
      coverageWeight: parseFloat(String(r["Coverage Weight %"] || "0")) || 0,
    };
    const aliases = v2AliasMap[id] ?? [key.toLowerCase()];
    await upsertKnowledge("symptom", key, aliases, data, i);
    process.stdout.write(".");
  }
  console.log(" done.");

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. V2 Reports (60)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[V2] Seeding 60 reports...");
  const v2Rep = XLSX.utils.sheet_to_json<Record<string, string>>(wb2.Sheets["Report_Catalog"], { defval: "" });
  for (let i = 0; i < v2Rep.length; i++) {
    const r = v2Rep[i];
    const key = (r["Report Finding (EN)"] as string).trim();
    const data = {
      possibleProblem: (r["Possible Problem (EN)"] || "").trim(),
      patientFriendlyMeaning: (r["Patient-Friendly Meaning (EN)"] || "").trim(),
      nextStep: (r["Next Step / Possible Solution (EN)"] || "").trim(),
      urgencyHint: mapUrgency(r["Urgency Hint"]),
      likelySpecialty: (r["Likely Specialty"] || "").trim(),
    };
    const aliases = [key.toLowerCase(), ...splitList(key.toLowerCase().replace(/[^a-z0-9\s]/g, " "))];
    await upsertKnowledge("report", key, [...new Set(aliases)], data, i);
    process.stdout.write(".");
  }
  console.log(" done.");

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. V2 Intents (8 from V2 dataset)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[V2] Seeding intents...");
  const v2Intent = XLSX.utils.sheet_to_json<Record<string, string>>(wb2.Sheets["Intent_Routing"], { defval: "" });
  for (let i = 0; i < v2Intent.length; i++) {
    const r = v2Intent[i];
    const key = (r["Intent"] as string).trim();
    const triggers = splitList(r["Trigger Examples"]);
    const data = {
      botAction: (r["Bot Action"] || "").trim(),
      escalationRule: (r["Escalation Rule"] || "").trim(),
      leadCaptureTiming: (r["Lead Capture Timing"] || "").trim(),
      followUps: triggers.slice(0, 4),
    };
    await upsertKnowledge("intent", key, triggers, data, i);
    process.stdout.write(".");
  }
  console.log(" done.");

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. V2 Response Templates (14 clusters × 8 languages)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[V2] Seeding response templates...");
  const tmplRows = XLSX.utils.sheet_to_json<Record<string, string>>(wb2.Sheets["Response_Templates"], { defval: "" });
  const templatesByCluster: Record<string, Record<string, string>> = {};
  for (const r of tmplRows) {
    const clusterKey = (r["Template Key"] || "").trim();
    const langCode = (r["Language Code"] || "en").trim();
    if (!templatesByCluster[clusterKey]) templatesByCluster[clusterKey] = {};
    templatesByCluster[clusterKey][langCode] = JSON.stringify({
      opening: r["Acknowledge / Opening"],
      causeSummary: r["Cause Summary (EN anchor)"],
      followUpQuestion: r["Follow-up Question Pattern (EN anchor)"],
      safeAdvice: r["Safe Advice Pattern (EN anchor)"],
      redFlag: r["Red Flag Pattern (EN anchor)"],
      specialtyLabel: r["Localized Specialty Label"],
      cityAsk: r["Localized City Ask"],
    });
  }
  for (const [clusterKey, langs] of Object.entries(templatesByCluster)) {
    await upsertKnowledge("template", clusterKey, [clusterKey], { templatesByLang: langs }, 0);
    process.stdout.write(".");
  }
  console.log(" done.");

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. V4 XLSX — enrich symptoms with V4 data (better basic_advice + more causes)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[V4] Enriching symptoms with V4 data...");
  const wb4 = XLSX.readFile(V4_XLSX);
  const v4Sym = XLSX.utils.sheet_to_json<Record<string, string>>(wb4.Sheets["symptom_catalog"], { defval: "" });
  for (const r of v4Sym) {
    const keyRaw = (r["symptom"] as string || "").trim();
    if (!keyRaw) continue;
    // Capitalise to match V2 keys (e.g. "fever" → "Fever")
    const key = keyRaw.charAt(0).toUpperCase() + keyRaw.slice(1);
    const cluster = NAME_TO_CLUSTER[keyRaw] ?? "general";

    // Fetch existing knowledge entry to merge
    const existing = await client.execute({ sql: "SELECT data FROM chatbot_knowledge WHERE type='symptom' AND key=?", args: [key] });
    const existingData = existing.rows[0]
      ? JSON.parse(existing.rows[0][0] as string)
      : {};

    // Merge V4 data into existing entry — V4 has concise production-quality data
    const mergedData = {
      ...existingData,
      // Enrich causes: merge V2 + V4 (V4 often cleaner)
      commonCauses: mergeUnique(existingData.commonCauses, splitList(r["common_causes"])),
      // Enrich red flags
      redFlags: mergeUnique(existingData.redFlags, splitList(r["red_flags"])),
      // V4 basic advice is production-quality — prefer it if longer
      safeInitialAdvice: betterOf(existingData.safeInitialAdvice, (r["basic_advice"] || "").trim()),
      likelySpecialty: (r["specialty"] || existingData.likelySpecialty || "").trim(),
      cluster,
    };

    await client.execute({
      sql: "UPDATE chatbot_knowledge SET data=?, updated_at=(unixepoch()*1000) WHERE type='symptom' AND key=?",
      args: [JSON.stringify(mergedData), key],
    });

    // If not found by capitalised key, try exact key from V4
    const inserted = await client.execute({ sql: "SELECT COUNT(*) FROM chatbot_knowledge WHERE type='symptom' AND key=?", args: [key] });
    if ((inserted.rows[0][0] as number) === 0) {
      // New symptom not in V2 — create it
      const newData = {
        commonCauses: splitList(r["common_causes"]),
        keyQuestions: [],
        safeInitialAdvice: (r["basic_advice"] || "").trim(),
        redFlags: splitList(r["red_flags"]),
        likelySpecialty: (r["specialty"] || "").trim(),
        urgencyPattern: "within_week",
        baseResponseTemplate: "",
        cluster,
        coverageWeight: 1,
      };
      await upsertKnowledge("symptom", key, [keyRaw, ...splitList(keyRaw)], newData, 999);
      console.log(`  [V4 NEW symptom] ${key}`);
    }
    process.stdout.write(".");
  }
  console.log(" done.");

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. V4 Reports — enrich with related symptoms + next steps
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[V4] Enriching reports...");
  const v4Rep = XLSX.utils.sheet_to_json<Record<string, string>>(wb4.Sheets["report_catalog"], { defval: "" });
  for (const r of v4Rep) {
    const key = (r["report"] as string || "").trim();
    if (!key) continue;
    const existing = await client.execute({ sql: "SELECT data FROM chatbot_knowledge WHERE type='report' AND key=?", args: [key] });
    const existingData = existing.rows[0] ? JSON.parse(existing.rows[0][0] as string) : {};
    const mergedData = {
      ...existingData,
      possibleProblem: betterOf(existingData.possibleProblem, (r["possible_meaning"] || "").trim()),
      nextStep: betterOf(existingData.nextStep, (r["possible_next_steps"] || "").trim()),
      relatedSymptoms: splitList(r["common_related_symptoms"]),
      likelySpecialty: (r["specialty"] || existingData.likelySpecialty || "").trim(),
    };
    if (existing.rows[0]) {
      await client.execute({
        sql: "UPDATE chatbot_knowledge SET data=?, updated_at=(unixepoch()*1000) WHERE type='report' AND key=?",
        args: [JSON.stringify(mergedData), key],
      });
    } else {
      await upsertKnowledge("report", key, [key.toLowerCase()], mergedData, 999);
      console.log(`  [V4 NEW report] ${key}`);
    }
    process.stdout.write(".");
  }
  console.log(" done.");

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. V4 Procedure Catalog (30 new entries)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[V4] Seeding 30 procedures...");
  const v4Proc = XLSX.utils.sheet_to_json<Record<string, string>>(wb4.Sheets["procedure_catalog"], { defval: "" });
  for (let i = 0; i < v4Proc.length; i++) {
    const r = v4Proc[i];
    const key = (r["procedure"] as string || "").trim();
    if (!key) continue;
    const data = {
      specialist: (r["specialist"] || "").trim(),
      commonRelatedConditions: splitList(r["common_related_conditions"]),
      possibleNextSupport: (r["possible_next_support"] || "").trim(),
      urgencyPattern: "within_week",
    };
    const aliases = [key.toLowerCase(), ...splitList(key.toLowerCase())];
    await upsertKnowledge("procedure", key, [...new Set(aliases)], data, i);
    process.stdout.write(".");
  }
  console.log(" done.");

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. V4 Doctor/Hospital catalog (15 specialty mappings)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("[V4] Seeding doctor/hospital search mappings...");
  const v4DH = XLSX.utils.sheet_to_json<Record<string, string>>(wb4.Sheets["doctor_hospital_catalog"], { defval: "" });
  for (let i = 0; i < v4DH.length; i++) {
    const r = v4DH[i];
    const key = (r["query_pattern"] as string || "").trim();
    if (!key) continue;
    const data = {
      mappedSpecialty: (r["mapped_specialty_or_provider"] || "").trim(),
      botAction: "Ask city → show doctor/hospital options → offer booking",
      escalationRule: "Emergency override if danger signs also mentioned",
      followUps: ["Show doctors", "Show hospitals", "Request callback"],
    };
    await upsertKnowledge("intent", key, [key.toLowerCase()], data, 100 + i);
    process.stdout.write(".");
  }
  console.log(" done.");

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Training examples — clear + reload from V3 + V4 JSONL (6000 total)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n[Training] Clearing old training examples...");
  await client.execute("DELETE FROM chatbot_training_examples");

  let totalInserted = 0;

  // V3 JSONL — 2000 multilingual examples
  if (fs.existsSync(V3_JSONL)) {
    console.log("[V3 JSONL] Inserting 2000 examples...");
    const v3Lines = fs.readFileSync(V3_JSONL, "utf8").split("\n").filter(l => l.trim());
    for (const line of v3Lines) {
      try {
        const obj = JSON.parse(line) as { language?: string; input?: string; output?: string };
        const lang = obj.language ?? "English";
        const input = (obj.input ?? "").trim();
        const output = (obj.output ?? "").trim();
        if (!input || !output) continue;
        const cluster = inferCluster(input);
        await client.execute({
          sql: "INSERT INTO chatbot_training_examples (language, intent, subtype, input, output, cluster, quality_tag) VALUES (?,?,?,?,?,?,?)",
          args: [lang, "symptom", null, input, output, cluster, "synthetic_v3"],
        });
        totalInserted++;
      } catch { /* skip */ }
    }
    console.log(`  V3: ${totalInserted} inserted`);
  }

  // V4 JSONL — 4000 high-quality multilingual examples with intent + subtype
  if (fs.existsSync(V4_JSONL)) {
    console.log("[V4 JSONL] Inserting 4000 examples...");
    const v4Lines = fs.readFileSync(V4_JSONL, "utf8").split("\n").filter(l => l.trim());
    let v4Count = 0;
    for (const line of v4Lines) {
      try {
        const obj = JSON.parse(line) as {
          language?: string; intent?: string; subtype?: string;
          user_input?: string; assistant_output?: string; quality_tag?: string;
        };
        const lang = obj.language ?? "English";
        const input = (obj.user_input ?? "").trim();
        const output = (obj.assistant_output ?? "").trim();
        if (!input || !output) continue;
        const cluster = NAME_TO_CLUSTER[obj.subtype ?? ""] ?? inferCluster(input);
        await client.execute({
          sql: "INSERT INTO chatbot_training_examples (language, intent, subtype, input, output, cluster, quality_tag) VALUES (?,?,?,?,?,?,?)",
          args: [lang, obj.intent ?? null, obj.subtype ?? null, input, output, cluster, obj.quality_tag ?? "real_world_synthetic_v4"],
        });
        totalInserted++;
        v4Count++;
      } catch { /* skip */ }
    }
    console.log(`  V4: ${v4Count} inserted`);
  }

  // ─── Final summary ────────────────────────────────────────────────────────
  const kResult = await client.execute("SELECT type, COUNT(*) as n FROM chatbot_knowledge GROUP BY type ORDER BY n DESC");
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   chatbot_knowledge summary              ║");
  for (const row of kResult.rows) {
    console.log(`║   ${String(row[0]).padEnd(12)} ${String(row[1]).padStart(4)} entries          ║`);
  }
  const tResult = await client.execute("SELECT COUNT(*) FROM chatbot_training_examples");
  console.log(`║   training examples: ${String(tResult.rows[0][0]).padStart(4)}                  ║`);
  console.log("╚══════════════════════════════════════════╝");

  await client.close();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mergeUnique(a: string[] | undefined, b: string[]): string[] {
  const set = new Set([...(a ?? []), ...b]);
  return [...set].filter(Boolean).slice(0, 12);
}

function betterOf(a: string | undefined, b: string): string {
  if (!a) return b;
  if (!b) return a;
  return b.length > a.length ? b : a;
}

function inferCluster(input: string): string | null {
  const t = input.toLowerCase();
  if (/fever|bukhar|ताप|জ্বর/.test(t)) return "infectious_general";
  if (/headache|migraine|सिरदर्द|தலைவலி|صداع/.test(t)) return "neuro";
  if (/chest|heart|cardiac|chhati/.test(t)) return "cardiac";
  if (/stomach|abdom|bloat|vomit|diarrhea|constip|digest|gastro/.test(t)) return "digestive";
  if (/cough|breath|asthma|lung/.test(t)) return "respiratory";
  if (/back|knee|joint|bone|spine|ortho|shoulder|neck/.test(t)) return "musculoskeletal";
  if (/skin|rash|itch|hair|derma/.test(t)) return "skin";
  if (/weight|sugar|diabet|thyroid|fatigue/.test(t)) return "metabolic";
  if (/period|women|gynaec|pregnancy|pcos/.test(t)) return "women_health";
  if (/anxiety|depress|mental|sleep|mood/.test(t)) return "mental_health";
  if (/urin|uti|burn/.test(t)) return "urinary";
  if (/ear|nose|throat|sinus|tonsil/.test(t)) return "ent";
  if (/eye|vision|blurr/.test(t)) return "eye";
  if (/tooth|dental|gum/.test(t)) return "dental";
  return null;
}

void main().catch(e => { console.error(e); process.exit(1); });
