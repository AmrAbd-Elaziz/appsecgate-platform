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

          <span className="overview-risk-score">
            <b>{finding.riskScore ?? 0}</b>
            <small>/100</small>
          </span>

          <span
            className={`badge ${(finding.riskLevel ?? "Low").toLowerCase()}`}
          >
            {(finding.riskLevel ?? "Low").toUpperCase()}
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
  const [view, setViewState] = useState<View>("overview");

  function isValidView(value: string | null): value is View {
    return navigation.some(([candidate]) => candidate === value);
  }

  function setView(nextView: View) {
    setViewState(nextView);

    const url = new URL(window.location.href);

    if (nextView === "overview") {
      url.searchParams.delete("view");
    } else {
      url.searchParams.set("view", nextView);
    }

    window.history.pushState(
      { view: nextView },
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  useEffect(() => {
    function syncViewFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get("view");

      setViewState(
        isValidView(requestedView)
          ? requestedView
          : "overview"
      );
    }

    syncViewFromUrl();

    window.addEventListener(
      "popstate",
      syncViewFromUrl
    );

    return () => {
      window.removeEventListener(
        "popstate",
        syncViewFromUrl
      );
    };
  }, []);
  const [latestAssessment, setLatestAssessment] =
    useState<PersistedAssessment | null>(null);

  const [focusedFindingId, setFocusedFindingId] =
    useState<string | null>(null);

  const [focusedAssessment, setFocusedAssessment] =
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

  async function openFindingContext(
    targetView: "controls" | "evidence",
    findingId: string,
    assessmentId: string
  ) {
    try {
      const response = await fetch(
        `/api/assessments/${assessmentId}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to load finding assessment context."
        );
      }

      const payload = await response.json();

      const contextualAssessment =
        (payload.data ??
          payload) as PersistedAssessment;

      setFocusedFindingId(findingId);
      setFocusedAssessment(
        contextualAssessment
      );
      setView(targetView);
    } catch (error) {
      console.error(
        "Finding context navigation failed:",
        error
      );
    }
  }

  const displayedAssessment =
    focusedAssessment ??
    latestAssessment;

  const displayedRun =
    displayedAssessment
      ? {
          id: displayedAssessment.id,
          asset: displayedAssessment.asset,
          status: displayedAssessment.status,
          decision: displayedAssessment.decision,
          startedAt:
            displayedAssessment.startedAt,
          scanners:
            displayedAssessment
              .scannerExecutions,
        }
      : null;

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

  const [assessmentRunning, setAssessmentRunning] =
    useState(false);

  const [assessmentRunError, setAssessmentRunError] =
    useState("");

  async function handleRunAssessment(asset: Asset) {
    if (assessmentRunning) {
      return;
    }

    setAssessmentRunning(true);
    setAssessmentRunError("");

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
      const message =
        error instanceof Error
          ? error.message
          : "Unable to run assessment.";

      console.error(
        "Assessment execution failed:",
        error
      );

      setAssessmentRunError(message);
    } finally {
      setAssessmentRunning(false);
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

  const overviewRisks =
    latestAssessment?.findings ?? [];

  const highestRisk =
    overviewRisks.reduce(
      (highest, finding) =>
        finding.riskScore > highest
          ? finding.riskScore
          : highest,
      0
    );

  const highestRiskLevel =
    overviewRisks.length > 0
      ? overviewRisks[0]?.riskLevel ?? "Low"
      : "Low";

  const confirmedRisks =
    overviewRisks.filter(
      (finding) =>
        finding.status === "Confirmed"
    ).length;

  const highConfidenceRisks =
    overviewRisks.filter(
      (finding) =>
        finding.confidence === "High"
    ).length;

  const riskDistribution = {
    Critical: overviewRisks.filter(
      (finding) =>
        finding.riskLevel === "Critical"
    ).length,

    High: overviewRisks.filter(
      (finding) =>
        finding.riskLevel === "High"
    ).length,

    Medium: overviewRisks.filter(
      (finding) =>
        finding.riskLevel === "Medium"
    ).length,

    Low: overviewRisks.filter(
      (finding) =>
        finding.riskLevel === "Low"
    ).length,
  };

  const riskPostureMessage =
    latestAssessment
      ? `${highestRiskLevel} contextual risk posture based on asset criticality, environment, confidence, and scanner evidence.`
      : "Run an assessment to calculate contextual application risk.";

  const decisionMessage = latestAssessment
    ? overviewDecision === "INCOMPLETE"
      ? `${
          overviewScanners.filter(
            (scanner) =>
              scanner.status === "Completed"
          ).length
        }/${overviewScanners.length} required scanners completed. Security gate cannot make a reliable release decision until scanner coverage is complete.`
      : overviewBlockers > 0
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

            <section className="risk-posture-grid">
              <article className="risk-posture-card">
                <small>Enterprise Risk Posture</small>

                <div className="risk-score-line">
                  <b>
                    {overviewLoading
                      ? "—"
                      : highestRisk}
                  </b>

                  <span>/100</span>
                </div>

                <strong
                  className={`risk-level-label ${highestRiskLevel.toLowerCase()}`}
                >
                  {overviewLoading
                    ? "LOADING"
                    : `${highestRiskLevel} Risk`}
                </strong>

                <p>{riskPostureMessage}</p>
              </article>

              <article className="executive-kpi-card">
                <small>Release Decision</small>

                <b
                  className={
                    overviewDecision === "BLOCK"
                      ? "decision-block"
                      : overviewDecision === "PASS"
                        ? "decision-pass"
                        : overviewDecision === "INCOMPLETE"
                          ? "decision-incomplete"
                          : ""
                  }
                >
                  {overviewLoading
                    ? "LOADING"
                    : overviewDecision}
                </b>

                <span>
                  {overviewBlockers} release blocker(s)
                </span>
              </article>

              <article className="executive-kpi-card">
                <small>Security Risks</small>
                <b>{overviewFindings}</b>
                <span>
                  {confirmedRisks} confirmed
                </span>
              </article>

              <article className="executive-kpi-card">
                <small>High Confidence</small>
                <b>{highConfidenceRisks}</b>
                <span>
                  Correlated security intelligence
                </span>
              </article>
            </section>

            <section className="risk-distribution-panel">
              <div className="risk-distribution-header">
                <div>
                  <small>CONTEXTUAL RISK DISTRIBUTION</small>
                  <h3>Application security posture</h3>
                </div>

                <span>
                  {overviewEvidence} verified evidence record(s)
                </span>
              </div>

              <div className="risk-distribution-grid">
                <div>
                  <span className="risk-distribution-dot critical" />
                  <small>Critical</small>
                  <b>{riskDistribution.Critical}</b>
                </div>

                <div>
                  <span className="risk-distribution-dot high" />
                  <small>High</small>
                  <b>{riskDistribution.High}</b>
                </div>

                <div>
                  <span className="risk-distribution-dot medium" />
                  <small>Medium</small>
                  <b>{riskDistribution.Medium}</b>
                </div>

                <div>
                  <span className="risk-distribution-dot low" />
                  <small>Low</small>
                  <b>{riskDistribution.Low}</b>
                </div>
              </div>
            </section>

            <section className="content-grid">
              <article className="panel">
                <div className="panel-title">
                  <h3>Prioritized findings</h3>
                  <button onClick={() => setView("findings")}>View all →</button>
                </div>
                <FindingRows assessment={latestAssessment} />
              </article>

              <article className="panel scanner-health-panel">
                <div className="scanner-health-header">
                  <div>
                    <small>SCANNER HEALTH</small>
                    <h3>Assessment coverage</h3>
                  </div>

                  {overviewScanners.length > 0 ? (
                    <div
                      className={`scanner-health-summary ${
                        overviewScanners.some(
                          (scanner) => scanner.status === "Failed"
                        )
                          ? "degraded"
                          : "healthy"
                      }`}
                    >
                      <b>
                        {
                          overviewScanners.filter(
                            (scanner) =>
                              scanner.status === "Completed"
                          ).length
                        }
                        /{overviewScanners.length}
                      </b>

                      <span>
                        {overviewScanners.some(
                          (scanner) => scanner.status === "Failed"
                        )
                          ? "DEGRADED"
                          : "HEALTHY"}
                      </span>
                    </div>
                  ) : (
                    <div className="scanner-health-summary">
                      <b>0/0</b>
                      <span>NO DATA</span>
                    </div>
                  )}
                </div>

                <div className="scanner-health-list">
                  {overviewScanners.length > 0 ? (
                    overviewScanners.map((scanner) => {
                      const failed =
                        scanner.status === "Failed";

                      const duration =
                        typeof scanner.durationMs === "number"
                          ? scanner.durationMs >= 1000
                            ? `${(
                                scanner.durationMs / 1000
                              ).toFixed(1)}s`
                            : `${scanner.durationMs}ms`
                          : "—";

                      return (
                        <div
                          className={`scanner-health-row ${
                            failed ? "failed" : "completed"
                          }`}
                          key={`${scanner.category}-${scanner.tool}`}
                        >
                          <span className="scanner-health-icon">
                            {failed ? "×" : "✓"}
                          </span>

                          <div className="scanner-health-name">
                            <b>{scanner.tool}</b>
                            <small>{scanner.category}</small>

                            {failed && scanner.error ? (
                              <em title={scanner.error}>
                                {scanner.error}
                              </em>
                            ) : null}
                          </div>

                          <span className="scanner-health-status">
                            {scanner.status}
                          </span>

                          <div className="scanner-health-metrics">
                            <b>{scanner.findings}</b>
                            <small>findings</small>
                          </div>

                          <time>{duration}</time>
                        </div>
                      );
                    })
                  ) : (
                    <div className="scanner-health-empty">
                      No scanner execution yet
                    </div>
                  )}
                </div>

                <div className="scanner-health-footer">
                  <span>
                    {assessmentCount} completed run(s)
                  </span>

                  <span>
                    Scanner evidence is normalized before the
                    release decision is calculated.
                  </span>
                </div>
              </article>
            </section>
          </>
        ) : view === "assets" ? (
          <AssetsInputs
            onRunAssessment={handleRunAssessment}
            assessmentRunning={assessmentRunning}
            assessmentRunError={assessmentRunError}
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
            onViewControls={(findingId, assessmentId) =>
              void openFindingContext(
                "controls",
                findingId,
                assessmentId
              )
            }
            onViewEvidence={(findingId, assessmentId) =>
              void openFindingContext(
                "evidence",
                findingId,
                assessmentId
              )
            }
          />
        ) : view === "controls" ? (
          <SecurityControls
            run={
              focusedAssessment
                ? displayedRun
                : latestRun
            }
            assessment={
              focusedAssessment
                ? displayedAssessment
                : latestAssessment
            }
            selectedFindingId={
              focusedFindingId
            }
            onGoToFindings={() => {
              setFocusedFindingId(null);
              setFocusedAssessment(null);
              setView("findings");
            }}
            onViewEvidence={() =>
              setView("evidence")
            }
          />
        ) : view === "evidence" ? (
          <EvidenceVault
            run={
              focusedAssessment
                ? displayedRun
                : latestRun
            }
            assessment={
              focusedAssessment
                ? displayedAssessment
                : latestAssessment
            }
            selectedFindingId={
              focusedFindingId
            }
            onGoToControls={() =>
              setView("controls")
            }
            onViewReports={() =>
              setView("reports")
            }
          />
        ) : view === "reports" ? (
          <Reports
            run={latestRun}
            assessment={latestAssessment}
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
