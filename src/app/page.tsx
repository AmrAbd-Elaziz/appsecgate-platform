"use client";

import { useEffect, useState } from "react";
import AssetsInputs from "../components/AssetsInputs";
import AssessmentRuns from "../components/AssessmentRuns";
import {
  type Asset,
  type PersistedAssessment,
} from "../data/appsecgate";
import FindingIntelligence from "../components/FindingIntelligence";
import SecurityControls from "../components/SecurityControls";
import EvidenceVault from "../components/EvidenceVault";
import Reports from "../components/Reports";

type View =
  | "overview"
  | "assets"
  | "assessments"
  | "findings"
  | "controls"
  | "evidence"
  | "reports";

const navigation: Array<[View, string]> = [
  ["overview", "Overview"],
  ["assets", "Assets & inputs"],
  ["assessments", "Assessment runs"],
  ["findings", "Finding intelligence"],
  ["controls", "Security controls"],
  ["evidence", "Evidence vault"],
  ["reports", "Reports"],
];

function FindingRows({
  assessment,
}: {
  assessment: PersistedAssessment | null;
}) {
  if (!assessment || assessment.findings.length === 0) {
    return (
      <p className="muted">
        No persisted assessment findings are available yet.
      </p>
    );
  }

  return (
    <div className="finding-list">
      {assessment.findings.map((finding) => (
        <button
          className="finding-row"
          key={finding.id}
          onClick={() => undefined}
        >
          <span
            className={`risk-dot ${finding.severity.toLowerCase()}`}
          />

          <span className="finding-copy">
            <b>{finding.title}</b>
            <small>
              {finding.id} · {finding.source} · {assessment.asset.name}
            </small>
          </span>

          <span
            className={`badge ${finding.severity.toLowerCase()}`}
          >
            {finding.severity}
          </span>

          <span className="finding-status">
            {finding.status}
          </span>

          <span>›</span>
        </button>
      ))}
    </div>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <section className="panel placeholder">
      <p className="eyebrow">APPSECGATE PLATFORM</p>
      <h2>{title}</h2>
      <p>
        This page will use the same validated AppSecGate design, backed by a
        dedicated Next.js data layer instead of localStorage.
      </p>
    </section>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [latestAssessment, setLatestAssessment] =
    useState<PersistedAssessment | null>(null);

  const [assetCount, setAssetCount] = useState(0);
  const [assessmentCount, setAssessmentCount] = useState(0);
  const [overviewLoading, setOverviewLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function hydrateDashboard() {
      try {
        setOverviewLoading(true);

        const [assetsResponse, assessmentsResponse] =
          await Promise.all([
            fetch("/api/assets", {
              cache: "no-store",
            }),
            fetch("/api/assessments", {
              cache: "no-store",
            }),
          ]);

        if (!assetsResponse.ok || !assessmentsResponse.ok) {
          throw new Error(
            "Unable to hydrate persisted AppSecGate state."
          );
        }

        const assetsPayload = await assetsResponse.json();
        const assessmentsPayload =
          await assessmentsResponse.json();

        if (cancelled) {
          return;
        }

        setAssetCount(assetsPayload.count ?? 0);
        setAssessmentCount(assessmentsPayload.count ?? 0);

        const latest =
          assessmentsPayload.data?.[0] ?? null;

        setLatestAssessment(
          latest as PersistedAssessment | null
        );
      } catch (error) {
        console.error(
          "Dashboard hydration failed:",
          error
        );
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    }

    hydrateDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  const latestRun = latestAssessment
    ? {
        id: latestAssessment.id,
        asset: latestAssessment.asset,
        status: latestAssessment.status,
        decision: latestAssessment.decision,
        startedAt: latestAssessment.startedAt,
        scanners: latestAssessment.scannerExecutions,
      }
    : null;

  async function handleRunAssessment(asset: Asset) {
    try {
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assetId: asset.id,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Unable to run assessment."
        );
      }

      const assessment =
        payload.data as PersistedAssessment;

      setLatestAssessment(assessment);
      setAssessmentCount((current) => current + 1);
      setView("assessments");
    } catch (error) {
      console.error("Assessment execution failed:", error);
    }
  }

  const overviewDecision =
    latestAssessment?.decision ?? "NO RUN";

  const overviewBlockers =
    latestAssessment?.blockers.length ?? 0;

  const overviewFindings =
    latestAssessment?.findings.length ?? 0;

  const overviewEvidence =
    latestAssessment?.evidence.length ?? 0;

  const overviewScanners =
    latestAssessment?.scannerExecutions ?? [];

  const decisionMessage = latestAssessment
    ? overviewBlockers > 0
      ? `${overviewBlockers} confirmed critical finding(s) require action before production release.`
      : "No confirmed critical blockers are preventing release."
    : "Run an assessment to calculate the release decision.";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">A</span>
          <div>
            <b>AppSecGate</b>
            <small>AI SECURITY GATE</small>
          </div>
        </div>

        <div className="workspace">
          <small>WORKSPACE</small>
          <b>Retail Platform</b>
        </div>

        <nav>
          {navigation.map(([id, label]) => (
            <button
              key={id}
              className={view === id ? "nav-item active" : "nav-item"}
              onClick={() => setView(id)}
            >
              ◇ {label}
            </button>
          ))}
        </nav>

        <small className="side-note">
          Security assessment &amp; release decision platform
        </small>
      </aside>

      <main className="main-content">
        {view === "overview" ? (
          <>
            <header className="page-header">
              <div>
                <p className="eyebrow">INTELLIGENT DEVSECOPS SECURITY GATE</p>
                <h1>Security posture, with context.</h1>
              </div>

              <div className="gate-mini">
                <b>{overviewLoading ? "LOADING" : overviewDecision}</b>
                <span>{decisionMessage}</span>
              </div>
            </header>

            <section className="decision-card">
              <p className="eyebrow">
                RELEASE DECISION · LATEST ASSESSMENT
              </p>

              <h2>
                {overviewLoading
                  ? "LOADING"
                  : overviewDecision}
              </h2>

              <p>{decisionMessage}</p>

              <button onClick={() => setView("assessments")}>
                View assessment runs →
              </button>
            </section>

            <section className="kpi-grid">
              <article>
                <small>Managed assets</small>
                <b>{assetCount}</b>
                <span>In active assessment scope</span>
              </article>

              <article>
                <small>Normalized findings</small>
                <b>{overviewFindings}</b>
                <span>Across scanner sources</span>
              </article>

              <article>
                <small>Confirmed blockers</small>
                <b>{overviewBlockers}</b>
                <span>Release decision drivers</span>
              </article>

              <article>
                <small>Evidence records</small>
                <b>{overviewEvidence}</b>
                <span>Auditable assessment proof</span>
              </article>
            </section>

            <section className="content-grid">
              <article className="panel">
                <div className="panel-title">
                  <h3>Prioritized findings</h3>
                  <button onClick={() => setView("findings")}>View all →</button>
                </div>
                <FindingRows assessment={latestAssessment} />
              </article>

              <article className="panel">
                <div className="panel-title">
                  <h3>Assessment coverage</h3>
                  <span>{assessmentCount} completed run(s)</span>
                </div>

                <div className="coverage">
                  {overviewScanners.length > 0 ? (
                    overviewScanners.map((scanner) => (
                      <span
                        key={`${scanner.category}-${scanner.tool}`}
                      >
                        ✓ {scanner.tool}
                      </span>
                    ))
                  ) : (
                    <span>No scanner execution yet</span>
                  )}
                </div>

                <p className="muted">
                  Scanner evidence is normalized before the release decision is calculated.
                </p>
              </article>
            </section>
          </>
        ) : view === "assets" ? (
          <AssetsInputs
            onRunAssessment={handleRunAssessment}
          />
        ) : view === "assessments" ? (
          <AssessmentRuns
            run={latestRun}
            assessment={latestAssessment}
            onGoToAssets={() => setView("assets")}
            onViewFindings={() => setView("findings")}
          />
        ) : view === "findings" ? (
          <FindingIntelligence
            run={latestRun}
            assessment={latestAssessment}
            onGoToAssessment={() => setView("assessments")}
            onViewControls={() => setView("controls")}
          />
        ) : view === "controls" ? (
          <SecurityControls
            run={latestRun}
            assessment={latestAssessment}
            onGoToFindings={() => setView("findings")}
            onViewEvidence={() => setView("evidence")}
          />
        ) : view === "evidence" ? (
          <EvidenceVault
            run={latestRun}
            assessment={latestAssessment}
            onGoToControls={() => setView("controls")}
            onViewReports={() => setView("reports")}
          />
        ) : view === "reports" ? (
          <Reports
            run={latestRun}
            assessment={latestAssessment}
            onGoToEvidence={() => setView("evidence")}
          />
        ) : (
          <Placeholder
            title={navigation.find(([id]) => id === view)?.[1] || "AppSecGate"}
          />
        )}
      </main>
    </div>
  );
}
