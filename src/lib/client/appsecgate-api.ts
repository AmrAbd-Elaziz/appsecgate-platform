import type {
  Asset,
  ControlIntelligenceRecord,
  FindingIntelligenceRecord,
  PersistedAssessment,
} from "../../data/appsecgate";

type DemoSnapshot = {
  demo: true;
  assessment: PersistedAssessment;
  asset: Asset;
  findingLifecycles: Array<{
    findingId: string;
    assetId: number;
    status: "Open" | "Closed";
    firstSeenAt: string;
    lastSeenAt: string;
    statusChangedAt: string;
    closedAt?: string;
    reopenedAt?: string;
    firstSeenRunId: string;
    lastSeenRunId: string;
    source: string;
    category: string;
  }>;
  controlLifecycles: Array<{
    controlId: string;
    findingId: string;
    assetId: number;
    status: "Required" | "Implemented" | "Verified";
    firstRequiredAt: string;
    lastUpdatedAt: string;
    statusChangedAt: string;
    firstSeenRunId: string;
    lastSeenRunId: string;
    implementedAt?: string;
    verifiedAt?: string;
    reopenedAt?: string;
  }>;
};

const DEMO_MODE =
  process.env.NEXT_PUBLIC_APPSECGATE_DEMO === "true";

const BASE_PATH =
  process.env.NEXT_PUBLIC_APPSECGATE_BASE_PATH ?? "";

let demoSnapshotPromise: Promise<DemoSnapshot> | null = null;

function demoUrl(path: string) {
  return `${BASE_PATH}${path}`;
}

async function loadDemoSnapshot(): Promise<DemoSnapshot> {
  if (!demoSnapshotPromise) {
    demoSnapshotPromise = fetch(
      demoUrl("/demo-data/appsecgate-demo.json"),
      {
        cache: "force-cache",
      }
    ).then(async (response) => {
      if (!response.ok) {
        throw new Error(
          "Unable to load AppSecGate demo dataset."
        );
      }

      return (await response.json()) as DemoSnapshot;
    });
  }

  return demoSnapshotPromise;
}

export function isDemoMode() {
  return DEMO_MODE;
}

export function assertBackendAvailable(
  action = "This action"
) {
  if (DEMO_MODE) {
    throw new Error(
      `${action} requires the full AppSecGate backend. ` +
      "The GitHub Pages deployment is a read-only portfolio demo."
    );
  }
}

export async function getAssets(): Promise<{
  data: Asset[];
  count: number;
}> {
  if (!DEMO_MODE) {
    const response = await fetch("/api/assets", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load assets.");
    }

    return response.json();
  }

  const snapshot = await loadDemoSnapshot();

  return {
    data: [snapshot.asset],
    count: 1,
  };
}

export async function getAssessments(): Promise<{
  data: PersistedAssessment[];
  count: number;
}> {
  if (!DEMO_MODE) {
    const response = await fetch("/api/assessments", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load assessments.");
    }

    return response.json();
  }

  const snapshot = await loadDemoSnapshot();

  return {
    data: [snapshot.assessment],
    count: 1,
  };
}

export async function getAssessment(
  assessmentId: string
): Promise<PersistedAssessment> {
  if (!DEMO_MODE) {
    const response = await fetch(
      `/api/assessments/${encodeURIComponent(assessmentId)}`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("Unable to load assessment.");
    }

    const payload = await response.json();

    return (payload.data ?? payload) as PersistedAssessment;
  }

  const snapshot = await loadDemoSnapshot();

  if (snapshot.assessment.id !== assessmentId) {
    throw new Error("Demo assessment not found.");
  }

  return snapshot.assessment;
}

export async function getFindings(
  assessmentId?: string
): Promise<{
  data: FindingIntelligenceRecord[];
  count: number;
}> {
  if (!DEMO_MODE) {
    const url = assessmentId
      ? `/api/findings?assessmentId=${encodeURIComponent(
          assessmentId
        )}`
      : "/api/findings";

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        "Unable to load finding intelligence."
      );
    }

    return response.json();
  }

  const snapshot = await loadDemoSnapshot();
  const assessment = snapshot.assessment;

  if (
    assessmentId &&
    assessment.id !== assessmentId
  ) {
    return {
      data: [],
      count: 0,
    };
  }

  const lifecycleByFindingId = new Map(
    snapshot.findingLifecycles.map((lifecycle) => [
      lifecycle.findingId,
      lifecycle,
    ])
  );

  const data = assessment.findings
    .map((finding) => {
      const lifecycle =
        lifecycleByFindingId.get(finding.id);

      if (!lifecycle) {
        return null;
      }

      return {
        finding,
        lifecycle,
        asset: assessment.asset,
        assessmentId: assessment.id,
        completedAt:
          assessment.completedAt ??
          assessment.startedAt,
      } as FindingIntelligenceRecord;
    })
    .filter(
      (
        record
      ): record is FindingIntelligenceRecord =>
        record !== null
    )
    .sort((a, b) => {
      if (
        a.lifecycle.status !== b.lifecycle.status
      ) {
        return a.lifecycle.status === "Open" ? -1 : 1;
      }

      return b.lifecycle.lastSeenAt.localeCompare(
        a.lifecycle.lastSeenAt
      );
    });

  return {
    data,
    count: data.length,
  };
}

export async function getControls(
  assessmentId?: string
): Promise<{
  data: ControlIntelligenceRecord[];
  count: number;
}> {
  if (!DEMO_MODE) {
    const url = assessmentId
      ? `/api/controls?assessmentId=${encodeURIComponent(
          assessmentId
        )}`
      : "/api/controls";

    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load controls.");
    }

    return response.json();
  }

  const snapshot = await loadDemoSnapshot();
  const assessment = snapshot.assessment;

  if (
    assessmentId &&
    assessment.id !== assessmentId
  ) {
    return {
      data: [],
      count: 0,
    };
  }

  const controlLifecycleByFindingId = new Map(
    snapshot.controlLifecycles.map((lifecycle) => [
      lifecycle.findingId,
      lifecycle,
    ])
  );

  const findingLifecycleByFindingId = new Map(
    snapshot.findingLifecycles.map((lifecycle) => [
      lifecycle.findingId,
      lifecycle,
    ])
  );

  const findingById = new Map(
    assessment.findings.map((finding) => [
      finding.id,
      finding,
    ])
  );

  const data = assessment.controls
    .map((control) => {
      const finding =
        findingById.get(control.findingId);

      const lifecycle =
        controlLifecycleByFindingId.get(
          control.findingId
        );

      const findingLifecycle =
        findingLifecycleByFindingId.get(
          control.findingId
        );

      if (
        !finding ||
        !lifecycle ||
        !findingLifecycle
      ) {
        return null;
      }

      return {
        control,
        lifecycle,
        finding,
        findingLifecycle,
        asset: assessment.asset,
        assessmentId: assessment.id,
        completedAt: assessment.completedAt,
      } as ControlIntelligenceRecord;
    })
    .filter(
      (
        record
      ): record is ControlIntelligenceRecord =>
        record !== null
    )
    .sort((a, b) =>
      b.lifecycle.lastUpdatedAt.localeCompare(
        a.lifecycle.lastUpdatedAt
      )
    );

  return {
    data,
    count: data.length,
  };
}
