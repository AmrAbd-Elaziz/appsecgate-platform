import { promises as fs } from "fs";
import path from "path";

import type { Asset } from "../../data/appsecgate";
import { initialAssets } from "../../data/appsecgate";
import type { FindingLifecycle } from "../../data/appsecgate";
import type { PersistedAssessment } from "./assessment-engine";

type AppSecGateStore = {
  assets: Asset[];
  assessments: PersistedAssessment[];
  findingLifecycles: FindingLifecycle[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "appsecgate.json");

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_FILE);
  } catch {
    const initialStore: AppSecGateStore = {
      assets: initialAssets,
      assessments: [],
      findingLifecycles: [],
    };

    await fs.writeFile(
      STORE_FILE,
      JSON.stringify(initialStore, null, 2),
      "utf8"
    );
  }
}

async function readStore(): Promise<AppSecGateStore> {
  await ensureStore();

  const raw = await fs.readFile(STORE_FILE, "utf8");
  const parsed = JSON.parse(raw) as Partial<AppSecGateStore>;

  /*
   * Backward-compatible migration:
   * old V2 stores only contained { assets: [...] }.
   */
  return {
    assets: Array.isArray(parsed.assets)
      ? parsed.assets
      : initialAssets,
    assessments: Array.isArray(parsed.assessments)
      ? parsed.assessments
      : [],
    findingLifecycles: Array.isArray(
      parsed.findingLifecycles
    )
      ? parsed.findingLifecycles
      : [],
  };
}

async function writeStore(
  store: AppSecGateStore
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  await fs.writeFile(
    STORE_FILE,
    JSON.stringify(store, null, 2),
    "utf8"
  );
}

export async function listAssets(): Promise<Asset[]> {
  const store = await readStore();
  return store.assets;
}

export async function getAssetById(
  id: number
): Promise<Asset | null> {
  const store = await readStore();

  return (
    store.assets.find((asset) => asset.id === id) ??
    null
  );
}

export async function createAsset(
  input: Omit<Asset, "id">
): Promise<Asset> {
  const store = await readStore();

  const nextId =
    store.assets.length === 0
      ? 1
      : Math.max(
          ...store.assets.map((asset) => asset.id)
        ) + 1;

  const asset: Asset = {
    id: nextId,
    ...input,
  };

  store.assets.push(asset);
  await writeStore(store);

  return asset;
}

export async function saveAssessment(
  assessment: PersistedAssessment
): Promise<PersistedAssessment> {
  const store = await readStore();

  store.assessments.unshift(assessment);

  await writeStore(store);

  return assessment;
}

export async function listAssessments(): Promise<
  PersistedAssessment[]
> {
  const store = await readStore();
  return store.assessments;
}

export async function getAssessmentById(
  id: string
): Promise<PersistedAssessment | null> {
  const store = await readStore();

  return (
    store.assessments.find(
      (assessment) => assessment.id === id
    ) ?? null
  );
}


export async function listFindingLifecycles(
  assetId?: number
): Promise<FindingLifecycle[]> {
  const store = await readStore();

  if (assetId === undefined) {
    return store.findingLifecycles;
  }

  return store.findingLifecycles.filter(
    (lifecycle) =>
      lifecycle.assetId === assetId
  );
}

export async function getFindingLifecycle(
  assetId: number,
  findingId: string
): Promise<FindingLifecycle | null> {
  const store = await readStore();

  return (
    store.findingLifecycles.find(
      (lifecycle) =>
        lifecycle.assetId === assetId &&
        lifecycle.findingId === findingId
    ) ?? null
  );
}

export async function reconcileFindingLifecycles(
  assessment: PersistedAssessment
): Promise<FindingLifecycle[]> {
  const store = await readStore();

  const now =
    assessment.completedAt ??
    new Date().toISOString();

  const assetId = assessment.assetId;

  const currentFindings = new Map(
    assessment.findings.map(
      (finding) => [finding.id, finding]
    )
  );

  const successfulScannerKeys = new Set(
    assessment.scannerExecutions
      .filter(
        (scanner) =>
          scanner.status === "Completed"
      )
      .flatMap((scanner) => [
        scanner.tool,
        scanner.category,
      ])
  );

  /*
   * Findings detected in this assessment:
   * create them as Open, refresh lastSeenAt,
   * or reopen previously Closed findings.
   */
  for (const finding of assessment.findings) {
    const index =
      store.findingLifecycles.findIndex(
        (lifecycle) =>
          lifecycle.assetId === assetId &&
          lifecycle.findingId === finding.id
      );

    if (index === -1) {
      store.findingLifecycles.push({
        findingId: finding.id,
        assetId,

        status: "Open",

        firstSeenAt: now,
        lastSeenAt: now,
        statusChangedAt: now,

        firstSeenRunId: assessment.id,
        lastSeenRunId: assessment.id,

        source: finding.source,
        category: finding.category,
      });

      continue;
    }

    const lifecycle =
      store.findingLifecycles[index];

    const wasClosed =
      lifecycle.status === "Closed";

    store.findingLifecycles[index] = {
      ...lifecycle,

      status: "Open",

      lastSeenAt: now,
      lastSeenRunId: assessment.id,

      source: finding.source,
      category: finding.category,

      ...(wasClosed
        ? {
            statusChangedAt: now,
            reopenedAt: now,
            closedAt: undefined,
          }
        : {}),
    };
  }

  /*
   * Close findings only when the scanner/category
   * responsible for the previous finding completed
   * successfully in this assessment.
   *
   * Failed or non-applicable scanners MUST NOT
   * produce false closures.
   */
  for (
    let index = 0;
    index < store.findingLifecycles.length;
    index += 1
  ) {
    const lifecycle =
      store.findingLifecycles[index];

    if (
      lifecycle.assetId !== assetId ||
      lifecycle.status !== "Open" ||
      currentFindings.has(
        lifecycle.findingId
      )
    ) {
      continue;
    }

    const relevantScannerCompleted =
      successfulScannerKeys.has(
        lifecycle.source
      ) ||
      successfulScannerKeys.has(
        lifecycle.category
      );

    if (!relevantScannerCompleted) {
      continue;
    }

    store.findingLifecycles[index] = {
      ...lifecycle,
      status: "Closed",
      statusChangedAt: now,
      closedAt: now,
    };
  }

  await writeStore(store);

  return store.findingLifecycles.filter(
    (lifecycle) =>
      lifecycle.assetId === assetId
  );
}
