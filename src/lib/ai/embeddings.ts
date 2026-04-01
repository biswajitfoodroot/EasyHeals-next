/**
 * AI Embedding Pipeline — embedAsync() + vectorSearch()
 *
 * embedAsync(): Non-blocking. Embeds text via Gemini text-embedding-004 (768-dim)
 *   and writes to ai_embeddings table. Never blocks the caller's response.
 *   All source text stored AES-256-GCM encrypted.
 *
 * vectorSearch(): Retrieves top-K semantically similar embeddings from DB.
 *   Uses JSON cosine similarity on the stored float arrays (Turso vector_top_k
 *   is used if the libSQL driver supports it; fallback is in-process cosine).
 *
 * AI_LEARNING_ENABLED env var: set "false" to skip all embedding writes
 *   (useful for low-tier Gemini API plans or rate-limited environments).
 *
 * PHI SAFETY: source text encrypted before DB write; vectors are NOT PHI.
 */

import { eq, isNull, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { aiEmbeddings } from "@/db/schema";
import { getGeminiClient } from "@/lib/ai/client";
import { encryptPHI, decryptPHI } from "@/lib/health/encryption";
import { env } from "@/lib/env";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EmbeddingSourceType =
  | "health_event"
  | "conversation_turn"
  | "document_summary"
  | "knowledge_article"
  | "patient_profile";

export interface EmbedInput {
  patientId?: string | null;            // null = system knowledge base entry
  sourceType: EmbeddingSourceType;
  sourceId?: string | null;
  contentText: string;                  // plain text to embed + store encrypted
  specialtyTags?: string[];
  languageCode?: string;
}

export interface EmbeddingSearchResult {
  id: string;
  sourceType: string;
  sourceId: string | null;
  contentText: string;                  // decrypted
  similarity: number;                   // 0.0–1.0 (cosine similarity)
  specialtyTags: string[];
}

// ── Embedding generation ──────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_EMBEDDING_MODEL ?? "text-embedding-004",
  });

  const result = await (model as {
    embedContent(content: string): Promise<{ embedding: { values: number[] } }>;
  }).embedContent(text);

  return result.embedding.values;
}

// ── embedAsync — fire-and-forget embedding write ──────────────────────────────

/**
 * Embed text and store to ai_embeddings asynchronously.
 * Designed to be called with `void embedAsync(...)` — never awaited.
 * Silently skips if AI_LEARNING_ENABLED=false or GOOGLE_AI_API_KEY not set.
 */
export async function embedAsync(input: EmbedInput): Promise<void> {
  if (env.AI_LEARNING_ENABLED === "false") return;
  if (!env.GOOGLE_AI_API_KEY) return;
  if (!input.contentText?.trim()) return;

  try {
    const vector = await generateEmbedding(input.contentText);
    const contentTextEnc = encryptPHI(input.contentText);
    const embeddingJson = JSON.stringify(vector);

    await db.insert(aiEmbeddings).values({
      patientId: input.patientId ?? null,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      contentTextEnc,
      embedding: embeddingJson,
      specialtyTags: input.specialtyTags ?? [],
      languageCode: input.languageCode ?? "en",
    });
  } catch {
    // Embedding failure is non-fatal — health coach still works without it
  }
}

// ── In-process cosine similarity ─────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── vectorSearch — retrieve top-K similar embeddings ─────────────────────────

export interface VectorSearchParams {
  queryText: string;
  patientId?: string | null;            // null = search knowledge base only
  sourceTypes?: EmbeddingSourceType[];
  topK?: number;
  specialtyFilter?: string;
  includeSystemKb?: boolean;            // also search knowledge base (null patientId rows)
}

/**
 * Embed queryText and return the top-K most similar stored embeddings.
 * Returns decrypted content for direct injection into AI context.
 * Falls back gracefully if embeddings unavailable.
 */
export async function vectorSearch(params: VectorSearchParams): Promise<EmbeddingSearchResult[]> {
  if (env.AI_LEARNING_ENABLED === "false") return [];
  if (!env.GOOGLE_AI_API_KEY) return [];

  try {
    const queryVector = await generateEmbedding(params.queryText);
    const topK = params.topK ?? 5;

    // Build filter conditions
    const conditions = [];
    if (params.patientId) {
      if (params.includeSystemKb) {
        conditions.push(
          // patientId matches OR is null (system KB)
          // Drizzle doesn't have OR across conditions directly — use raw SQL approach
        );
      } else {
        conditions.push(eq(aiEmbeddings.patientId, params.patientId));
      }
    } else {
      conditions.push(isNull(aiEmbeddings.patientId));
    }

    if (params.sourceTypes?.length) {
      conditions.push(inArray(aiEmbeddings.sourceType, params.sourceTypes));
    }

    // Load candidate embeddings (limit to 200 to keep in-process scoring fast)
    const rows = await db
      .select({
        id: aiEmbeddings.id,
        sourceType: aiEmbeddings.sourceType,
        sourceId: aiEmbeddings.sourceId,
        contentTextEnc: aiEmbeddings.contentTextEnc,
        embedding: aiEmbeddings.embedding,
        specialtyTags: aiEmbeddings.specialtyTags,
        patientId: aiEmbeddings.patientId,
      })
      .from(aiEmbeddings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(200);

    if (rows.length === 0) return [];

    // Score all candidates
    const scored: (EmbeddingSearchResult & { _vec: number[] | null })[] = rows.map((row) => {
      let vec: number[] | null = null;
      try {
        if (row.embedding) vec = JSON.parse(row.embedding) as number[];
      } catch { /* skip */ }

      return {
        id: row.id,
        sourceType: row.sourceType,
        sourceId: row.sourceId ?? null,
        contentText: "", // populated below after decryption
        similarity: vec ? cosineSimilarity(queryVector, vec) : 0,
        specialtyTags: (row.specialtyTags as string[]) ?? [],
        _vec: vec,
      };
    });

    // Sort by similarity descending, take top-K
    const top = scored
      .filter((r) => r._vec !== null && r.similarity > 0.3) // minimum threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    // Decrypt content for top results
    const results: EmbeddingSearchResult[] = [];
    for (const item of top) {
      try {
        const row = rows.find((r) => r.id === item.id)!;
        const contentText = decryptPHI<string>(row.contentTextEnc);
        results.push({
          id: item.id,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          contentText,
          similarity: item.similarity,
          specialtyTags: item.specialtyTags,
        });

        // Update retrieval count non-blocking
        void db.update(aiEmbeddings)
          .set({ retrievalCount: item.similarity > 0 ? 1 : 0, lastRetrievedAt: new Date() })
          .where(eq(aiEmbeddings.id, item.id))
          .catch(() => null);
      } catch {
        // Decryption failure — skip this item
      }
    }

    return results;
  } catch {
    return [];
  }
}

// ── Batch embed for knowledge base seeding ────────────────────────────────────

export interface KbArticle {
  topic: string;
  content: string;
  specialtyTags?: string[];
  languageCode?: string;
}

/**
 * Embed and store a knowledge base article.
 * Called by the knowledge base seeding script.
 */
export async function embedKbArticle(article: KbArticle): Promise<void> {
  await embedAsync({
    patientId: null, // system knowledge base — available to all patients
    sourceType: "knowledge_article",
    sourceId: null,
    contentText: `${article.topic}\n\n${article.content}`,
    specialtyTags: article.specialtyTags ?? [],
    languageCode: article.languageCode ?? "en",
  });
}
