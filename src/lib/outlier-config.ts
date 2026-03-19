import fs from "fs";
import path from "path";

export type OutlierThresholds = {
  autoApproveMaxScore: number;
  autoApproveMinTrust: number;
  autoRejectMinScore: number;
  massEditBurstLimit: number;
  feeOutlierMax: number;
  feeOutlierMin: number;
  semanticSuspiciousWeight: number;
};

const DEFAULTS: OutlierThresholds = {
  autoApproveMaxScore: 20,
  autoApproveMinTrust: 80,
  autoRejectMinScore: 70,
  massEditBurstLimit: 20,
  feeOutlierMax: 50000,
  feeOutlierMin: 100,
  semanticSuspiciousWeight: 25,
};

const CONFIG_PATH = path.join(process.cwd(), "data", "outlier-thresholds.json");

export function loadThresholds(): OutlierThresholds {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<OutlierThresholds>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveThresholds(thresholds: OutlierThresholds): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(thresholds, null, 2), "utf8");
}
