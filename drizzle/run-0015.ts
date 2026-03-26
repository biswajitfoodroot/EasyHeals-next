/**
 * Migration 0015 — Seed procedure taxonomy nodes from all metadata.relatedProcedures
 * Also normalizes procedure names against existing slugs to avoid duplicates
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL ?? "file:./local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Normalize a name for fuzzy matching (remove common suffixes, lowercase)
function normalizeForMatch(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(surgery|procedure|therapy|treatment|operation|repair|removal|transplant|test|scan|implant)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(name: string, existingSlugs: string[]): string | null {
  const normName = normalizeForMatch(name);
  const nameWords = normName.split(" ").filter(w => w.length > 2);
  
  for (const slug of existingSlugs) {
    // Try exact slug match first
    if (slug === slugify(name)) return slug;
    // Try normalized word overlap
    const slugWords = slug.replace(/-/g, " ").split(" ").filter(w => w.length > 2);
    const overlap = nameWords.filter(w => slugWords.some(sw => sw.includes(w) || w.includes(sw)));
    // If more than half the meaningful words match, consider it a match
    if (nameWords.length > 0 && overlap.length >= Math.ceil(nameWords.length * 0.6)) {
      return slug;
    }
  }
  return null;
}

async function main() {
  // Get all taxonomy nodes
  const all = await client.execute(`SELECT id, slug, title, type, metadata FROM taxonomy_nodes`);
  
  const existingSlugs = all.rows.map(r => r[1] as string);
  const existingSlugSet = new Set(existingSlugs);
  
  // Collect all procedure names from metadata
  const procedureNames = new Set<string>();
  for (const row of all.rows) {
    const metaStr = row[4] as string | null;
    if (!metaStr) continue;
    try {
      const meta = JSON.parse(metaStr);
      if (Array.isArray(meta.relatedProcedures)) {
        for (const p of meta.relatedProcedures) {
          if (typeof p === "string" && p.trim()) procedureNames.add(p.trim());
        }
      }
    } catch {}
  }
  
  console.log(`Found ${procedureNames.size} unique procedure names across all metadata`);
  
  let created = 0;
  let matched = 0;
  let skipped = 0;
  
  for (const name of procedureNames) {
    const directSlug = slugify(name);
    
    // Already exists with direct slug
    if (existingSlugSet.has(directSlug)) {
      skipped++;
      continue;
    }
    
    // Try fuzzy match against existing slugs
    const fuzzy = fuzzyMatch(name, existingSlugs);
    if (fuzzy) {
      console.log(`  MATCH: "${name}" → existing "${fuzzy}"`);
      matched++;
      continue;
    }
    
    // Create new procedure node
    try {
      await client.execute({
        sql: `INSERT OR IGNORE INTO taxonomy_nodes (id, slug, title, type, is_active, created_at) VALUES (lower(hex(randomblob(8))), ?, ?, 'procedure', 1, (unixepoch() * 1000))`,
        args: [directSlug, name],
      });
      existingSlugSet.add(directSlug);
      existingSlugs.push(directSlug);
      console.log(`  CREATE: "${name}" → "${directSlug}"`);
      created++;
    } catch (e: any) {
      console.log(`  SKIP (conflict): "${name}" → ${e.message}`);
      skipped++;
    }
  }
  
  console.log(`\nDone: ${created} created, ${matched} matched existing, ${skipped} already existed`);
  await client.close();
}

void main();
