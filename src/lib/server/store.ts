import { promises as fs } from "fs";
import path from "path";

import type { Asset } from "../../data/appsecgate";
import { initialAssets } from "../../data/appsecgate";
import type {
  ControlLifecycle,
  FindingLifecycle,
  RemediationProof,
} from "../../data/appsecgate";
import type { PersistedAssessment } from "./assessment-engine";

type AppSecGateStore = {
  assets: Asset[];
  assessments: PersistedAssessment[];
  findingLifecycles: FindingLifecycle[];
  controlLifecycles: ControlLifecycle[];
  remediationProofs: RemediationProof[];
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
      controlLifecycles: [],
      remediationProofs: [],
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
    controlLifecycles: Array.isArray(
      parsed.controlLifecycles
    )
      ? parsed.controlLifecycles
      : [],
    remediationProofs: Array.isArray(
      parsed.remediationProofs
    )
      ? parsed.remediationProofs
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


export async function listRemediationProofs(
  assetId?: number
): Promise<RemediationProof[]> {
  const store = await readStore();

  if (assetId === undefined) {
    return store.remediationProofs;
  }

  return store.remediationProofs.filter(
    (proof) => proof.assetId === assetId
  );
}

export async function saveRemediationProof(
  proof: RemediationProof
): Promise<RemediationProof> {
  const store = await readStore();

  const existingIndex =
    store.remediationProofs.findIndex(
      (item) => item.id === proof.id
    );

  if (existingIndex >= 0) {
    store.remediationProofs[existingIndex] =
      proof;
  } else {
    store.remediationProofs.unshift(proof);
  }

  /*
   * A control becomes Implemented only when a
   * Remediation Proof has itself been Verified.
   *
   * Scanner Output evidence MUST NOT trigger this.
   */
  if (proof.status === "Verified") {
    const controlIndex =
      store.controlLifecycles.findIndex(
        (lifecycle) =>
          lifecycle.assetId ===
            proof.assetId &&
          lifecycle.findingId ===
            proof.findingId
      );

    if (controlIndex >= 0) {
      const lifecycle =
        store.controlLifecycles[
          controlIndex
        ];

      if (
        lifecycle.status === "Required"
      ) {
        const now =
          proof.verifiedAt ??
          new Date().toISOString();

        store.controlLifecycles[
          controlIndex
        ] = {
          ...lifecycle,
          status: "Implemented",
          lastUpdatedAt: now,
          statusChangedAt: now,
          implementedAt: now,
          verifiedAt: undefined,
        };
      }
    }
  }

  await writeStore(store);

  return proof;
}

export async function listControlLifecycles(
  assetId?: number
): Promise<ControlLifecycle[]> {
  const store = await readStore();

  if (assetId === undefined) {
    return store.controlLifecycles;
  }

  return store.controlLifecycles.filter(
    (lifecycle) =>
      lifecycle.assetId === assetId
  );
}

export async function reconcileControlLifecycles(
  assessment: PersistedAssessment
): Promise<ControlLifecycle[]> {
  const store = await readStore();

  const now =
    assessment.completedAt ??
    new Date().toISOString();

  const assetId = assessment.assetId;

  const findingLifecycleById = new Map(
    store.findingLifecycles
      .filter(
        (lifecycle) =>
          lifecycle.assetId === assetId
      )
      .map(
        (lifecycle) => [
          lifecycle.findingId,
          lifecycle,
        ]
      )
  );

  /*
   * Phase 1:
   * Create or refresh lifecycle records for controls
   * generated by findings in the current assessment.
   */
  for (const control of assessment.controls) {
    const index =
      store.controlLifecycles.findIndex(
        (lifecycle) =>
          lifecycle.assetId === assetId &&
          lifecycle.findingId ===
            control.findingId
      );

    const findingLifecycle =
      findingLifecycleById.get(
        control.findingId
      );

    if (index === -1) {
      store.controlLifecycles.push({
        controlId: control.id,
        findingId: control.findingId,
        assetId,
        status: "Required",
        firstRequiredAt: now,
        lastUpdatedAt: now,
        statusChangedAt: now,
        firstSeenRunId: assessment.id,
        lastSeenRunId: assessment.id,
      });

      continue;
    }

    const lifecycle =
      store.controlLifecycles[index];

    /*
     * Finding is present/Open again.
     * Any previous verification is invalidated.
     */
    if (
      findingLifecycle?.status === "Open"
    ) {
      const wasAssured =
        lifecycle.status !== "Required";

      store.controlLifecycles[index] = {
        ...lifecycle,
        controlId: control.id,
        status: "Required",
        lastUpdatedAt: now,
        lastSeenRunId: assessment.id,
        ...(wasAssured
          ? {
              statusChangedAt: now,
              reopenedAt: now,
              implementedAt: undefined,
              verifiedAt: undefined,
            }
          : {}),
      };

      continue;
    }

    store.controlLifecycles[index] = {
      ...lifecycle,
      controlId: control.id,
      lastUpdatedAt: now,
      lastSeenRunId: assessment.id,
    };
  }

  /*
   * Phase 2:
   * A remediated finding disappears from the current
   * assessment, so its control is NOT regenerated.
   *
   * Therefore verification must be driven from the
   * persistent FindingLifecycle, not only from the
   * current assessment.controls array.
   */
  for (
    let index = 0;
    index < store.controlLifecycles.length;
    index += 1
  ) {
    const lifecycle =
      store.controlLifecycles[index];

    if (lifecycle.assetId !== assetId) {
      continue;
    }

    const findingLifecycle =
      findingLifecycleById.get(
        lifecycle.findingId
      );

    if (!findingLifecycle) {
      continue;
    }

    if (
      findingLifecycle.status === "Closed" &&
      lifecycle.status === "Implemented"
    ) {
      /*
       * Verification requires BOTH:
       *
       * 1. verified remediation proof -> Implemented
       * 2. successful scanner retest -> Finding Closed
       *
       * A clean scanner result alone must not skip
       * the Implemented lifecycle stage.
       */
      store.controlLifecycles[index] = {
        ...lifecycle,
        status: "Verified",
        lastUpdatedAt: now,
        statusChangedAt: now,
        lastSeenRunId: assessment.id,
        verifiedAt: now,
      };

      continue;
    }

    /*
     * Regression after previous verification:
     * scanner-driven FindingLifecycle has reopened.
     */
    if (
      findingLifecycle.status === "Open" &&
      lifecycle.status !== "Required"
    ) {
      store.controlLifecycles[index] = {
        ...lifecycle,
        status: "Required",
        lastUpdatedAt: now,
        statusChangedAt: now,
        lastSeenRunId: assessment.id,
        implementedAt: undefined,
        verifiedAt: undefined,
        reopenedAt: now,
      };
    }
  }

  await writeStore(store);

  return store.controlLifecycles.filter(
    (lifecycle) =>
      lifecycle.assetId === assetId
  );
}
