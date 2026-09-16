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

  function setView(
    nextView: View,
    context?: {
      findingId?: string | null;
      assessmentId?: string | null;
    }
  ) {
    setViewState(nextView);

    const url = new URL(window.location.href);

    // Modal state belongs only to its owning page.
    url.searchParams.delete("control");
    url.searchParams.delete("evidence");

    if (nextView === "overview") {
      url.searchParams.delete("view");
    } else {
      url.searchParams.set("view", nextView);
    }

    if (context?.findingId) {
      url.searchParams.set(
        "finding",
        context.findingId
      );
    } else {
      url.searchParams.delete("finding");
    }

    if (context?.assessmentId) {
      url.searchParams.set(
        "assessment",
        context.assessmentId
      );
    } else {
      url.searchParams.delete("assessment");
    }

    window.history.pushState(
      {
        view: nextView,
        finding: context?.findingId ?? null,
        assessment:
          context?.assessmentId ?? null,
      },
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function syncNavigationFromUrl() {
      const params = new URLSearchParams(
        window.location.search
      );

      const requestedView =
        params.get("view");

      const findingId =
        params.get("finding");

      const assessmentId =
        params.get("assessment");

      const nextView = isValidView(
        requestedView
      )
        ? requestedView
        : "overview";

      setViewState(nextView);

      if (
        findingId &&
        assessmentId &&
        (
          nextView === "controls" ||
          nextView === "evidence"
        )
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
              "Unable to restore assessment context."
            );
          }

          const payload =
            await response.json();

          if (cancelled) {
            return;
          }

          const contextualAssessment =
            (payload.data ??
              payload) as PersistedAssessment;

          setFocusedFindingId(
            findingId
          );

          setFocusedAssessment(
            contextualAssessment
          );

          return;
        } catch (error) {
          console.error(
            "Navigation context restore failed:",
            error
          );
        }
      }

      setFocusedFindingId(null);
      setFocusedAssessment(null);
    }

    function handlePopState() {
      void syncNavigationFromUrl();
    }

    void syncNavigationFromUrl();

    window.addEventListener(
      "popstate",
      handlePopState
    );

    return () => {
      cancelled = true;

      window.removeEventListener(
        "popstate",
        handlePopState
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
      setView(targetView, {
        findingId,
        assessmentId,
      });
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

  const overviewCompletedScanners =
    overviewScanners.filter(
      (scanner) =>
        scanner.status === "Completed"
    ).length;

  const overviewControls =
    latestAssessment?.controls.length ?? 0;

  const overviewRawFindings =
    latestAssessment?.rawFindingCount ?? 0;

  const overviewDeduped =
    Math.max(
      0,
      overviewRawFindings -
        overviewFindings
    );

  const overviewAsset =
    latestAssessment?.asset ?? null;

  const overviewRiskTotal =
    Math.max(overviewFindings, 1);

  const mediumRiskPercent =
    Math.round(
      (
        riskDistribution.Medium /
        overviewRiskTotal
      ) * 100
    );

  const lowRiskPercent =
    Math.round(
      (
        riskDistribution.Low /
        overviewRiskTotal
      ) * 100
    );

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
          <b>
            {latestAssessment?.asset.name ??
              "No assessment"}
          </b>
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

      <main
        className={`main-content ${
          view === "overview"
            ? "overview-main-content"
            : ""
        }`}
      >
        {view === "overview" ? (
          <>
            <header className="showcase-header">
              <div>
                <h1 className="showcase-product-title">
                  Intelligent{" "}
                  <span>DevSecOps</span>{" "}
                  Security Gate
                </h1>

                <p className="showcase-product-subtitle">
                  Security posture, with context. Turn security
                  findings into confident release decisions.
                </p>
              </div>

              <div className="showcase-last-assessment">
                <small>LAST ASSESSMENT</small>

                <b>
                  {latestAssessment?.completedAt
                    ? new Intl.DateTimeFormat(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      ).format(
                        new Date(
                          latestAssessment.completedAt
                        )
                      )
                    : "—"}
                </b>

                <span>
                  {latestAssessment?.completedAt
                    ? new Intl.DateTimeFormat(
                        "en-US",
                        {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        }
                      ).format(
                        new Date(
                          latestAssessment.completedAt
                        )
                      )
                    : "No completed assessment"}
                </span>
              </div>
            </header>

            <section
              className={`showcase-release ${
                overviewDecision === "BLOCK"
                  ? "block"
                  : overviewDecision === "INCOMPLETE"
                    ? "incomplete"
                    : "pass"
              }`}
            >
              <div className="showcase-release-shield">
                <span>✓</span>
              </div>

              <div className="showcase-release-copy">
                <small>FINAL RELEASE DECISION</small>

                <div>
                  <h2>
                    {overviewLoading
                      ? "LOADING"
                      : overviewDecision}
                  </h2>

                  <span className="showcase-release-check">
                    ✓
                  </span>
                </div>
              </div>

              <div className="showcase-release-context">
                <b>
                  {overviewBlockers} release blocker
                  {overviewBlockers === 1 ? "" : "s"}
                </b>

                <span>
                  {latestAssessment
                    ? `Assessment ${latestAssessment.id} · ${latestAssessment.asset.name}`
                    : "No persisted assessment available"}
                </span>
              </div>

              <div className="showcase-release-quote">
                <span />
                <blockquote>
                  “Built for secure delivery
                  <br />
                  at the speed of development.”
                </blockquote>
              </div>
            </section>

            <section className="showcase-kpis">
              <article className="showcase-kpi">
                <div className="showcase-kpi-icon risk">
                  ⚡
                </div>

                <div className="showcase-kpi-body">
                  <small>HIGHEST FINDING RISK</small>

                  <div className="showcase-kpi-value">
                    <b>{overviewLoading ? "—" : highestRisk}</b>
                    <span>/100</span>

                    <strong
                      className={`showcase-risk-badge ${highestRiskLevel.toLowerCase()}`}
                    >
                      {highestRiskLevel}
                    </strong>
                  </div>

                  <p>
                    Maximum contextual risk in the
                    latest assessment.
                  </p>
                </div>
              </article>

              <article className="showcase-kpi">
                <div className="showcase-kpi-icon findings">
                  ▤
                </div>

                <div className="showcase-kpi-body">
                  <small>SECURITY FINDINGS</small>

                  <div className="showcase-kpi-value">
                    <b>{overviewFindings}</b>
                  </div>

                  <strong className="showcase-positive">
                    {confirmedRisks} confirmed
                  </strong>

                  <p>
                    Normalized findings after correlation
                    and deduplication.
                  </p>
                </div>
              </article>

              <article className="showcase-kpi">
                <div className="showcase-kpi-icon scanner">
                  ◉
                </div>

                <div className="showcase-kpi-body">
                  <small>SCANNER COVERAGE</small>

                  <div className="showcase-kpi-value">
                    <b>{overviewCompletedScanners}</b>
                    <span>/{overviewScanners.length}</span>
                  </div>

                  <strong className="showcase-positive">
                    {overviewScanners.length > 0 &&
                    overviewCompletedScanners ===
                      overviewScanners.length
                      ? "All completed"
                      : "Coverage degraded"}
                  </strong>

                  <p>
                    Required scanner executions in the
                    latest assessment.
                  </p>
                </div>
              </article>

              <article className="showcase-kpi">
                <div className="showcase-kpi-icon evidence">
                  ◇
                </div>

                <div className="showcase-kpi-body">
                  <small>EVIDENCE COVERAGE</small>

                  <div className="showcase-kpi-value">
                    <b>{overviewEvidence}</b>
                    <span>/{overviewFindings}</span>
                  </div>

                  <strong className="showcase-positive">
                    {overviewFindings > 0 &&
                    overviewEvidence >= overviewFindings
                      ? "Full coverage"
                      : "Coverage gap"}
                  </strong>

                  <p>
                    Assessment evidence mapped to
                    normalized findings.
                  </p>
                </div>
              </article>
            </section>

            <section className="showcase-context-grid">
              <article className="showcase-risk-panel">
                <div className="showcase-section-title">
                  <span className="showcase-section-icon">
                    ◉
                  </span>

                  <div>
                    <small>
                      CONTEXTUAL RISK DISTRIBUTION
                    </small>
                    <h3>
                      Risk after asset and environment
                      context
                    </h3>
                  </div>
                </div>

                <div className="showcase-risk-content">
                  <div
                    className="showcase-donut"
                    style={{
                      background: `conic-gradient(
                        #f3bd36 0 ${mediumRiskPercent}%,
                        #55d6b1 ${mediumRiskPercent}% ${
                          mediumRiskPercent +
                          lowRiskPercent
                        }%,
                        #ff8a4c ${
                          mediumRiskPercent +
                          lowRiskPercent
                        }% 100%
                      )`,
                    }}
                  >
                    <div>
                      <b>{overviewFindings}</b>
                      <span>Findings</span>
                    </div>
                  </div>

                  <div className="showcase-risk-legend">
                    {(
                      [
                        [
                          "Critical",
                          riskDistribution.Critical,
                          "critical",
                        ],
                        [
                          "High",
                          riskDistribution.High,
                          "high",
                        ],
                        [
                          "Medium",
                          riskDistribution.Medium,
                          "medium",
                        ],
                        [
                          "Low",
                          riskDistribution.Low,
                          "low",
                        ],
                      ] as const
                    ).map(
                      ([level, count, className]) => (
                        <div key={level}>
                          <span
                            className={`showcase-risk-dot ${className}`}
                          />
                          <small>{level}</small>
                          <b>{count}</b>
                          <em>
                            {overviewFindings > 0
                              ? Math.round(
                                  (count /
                                    overviewFindings) *
                                    100
                                )
                              : 0}
                            %
                          </em>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </article>

              <article className="showcase-asset">
                <div className="showcase-asset-main">
                  <small>ASSET CONTEXT</small>

                  <h3>
                    {overviewAsset?.name ??
                      "No assessed asset"}
                  </h3>

                  <span className="showcase-asset-pill">
                    {overviewAsset
                      ? `${overviewAsset.environment} · ${overviewAsset.criticality} Criticality`
                      : "No context"}
                  </span>

                  <div className="showcase-asset-facts">
                    <div>
                      <span className="asset-fact-icon">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <circle cx="12" cy="12" r="8" />
                          <path d="M4 12h16" />
                          <path d="M12 4c2.2 2.2 3.4 4.9 3.4 8S14.2 17.8 12 20" />
                          <path d="M12 4C9.8 6.2 8.6 8.9 8.6 12S9.8 17.8 12 20" />
                        </svg>
                      </span>

                      <small>Asset type</small>
                      <b>
                        {overviewAsset?.type ?? "—"}
                      </b>
                    </div>

                    <div>
                      <span className="asset-fact-icon">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <rect
                            x="4"
                            y="5"
                            width="16"
                            height="6"
                            rx="1.5"
                          />
                          <rect
                            x="4"
                            y="13"
                            width="16"
                            height="6"
                            rx="1.5"
                          />
                          <path d="M7 8h.01" />
                          <path d="M7 16h.01" />
                        </svg>
                      </span>

                      <small>Environment</small>
                      <b>
                        {overviewAsset?.environment ??
                          "—"}
                      </b>
                    </div>

                    <div>
                      <span className="asset-fact-icon">
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <rect
                            x="4"
                            y="14"
                            width="3"
                            height="6"
                            rx="1"
                          />
                          <rect
                            x="10.5"
                            y="9"
                            width="3"
                            height="11"
                            rx="1"
                          />
                          <rect
                            x="17"
                            y="4"
                            width="3"
                            height="16"
                            rx="1"
                          />
                        </svg>
                      </span>

                      <small>Criticality</small>
                      <b>
                        {overviewAsset?.criticality ??
                          "—"}
                      </b>
                    </div>
                  </div>
                </div>

                <div className="showcase-asset-quote">
                  <span />
                  <blockquote>
                    “Context turns
                    <br />
                    findings into
                    <br />
                    real risk.”
                  </blockquote>
                </div>
              </article>
            </section>

            <section className="showcase-bottom-grid">
              <article className="showcase-findings panel">
                <div className="showcase-panel-header">
                  <div>
                    <small>PRIORITIZED FINDINGS</small>
                    <h3>
                      Top 5 highest-risk findings from
                      the latest assessment
                    </h3>
                  </div>

                  <button
                    onClick={() =>
                      setView("findings")
                    }
                  >
                    View all findings →
                  </button>
                </div>

                <div className="showcase-findings-head">
                  <span>#</span>
                  <span>FINDING</span>
                  <span>RISK</span>
                  <span>SCORE</span>
                  <span>STATUS</span>
                </div>

                <div className="showcase-findings-list">
                  {latestAssessment?.findings
                    .slice()
                    .sort(
                      (a, b) =>
                        b.riskScore -
                        a.riskScore
                    )
                    .slice(0, 5)
                    .map((finding, index) => (
                      <div
                        className="showcase-finding"
                        key={finding.id}
                      >
                        <span className="showcase-index">
                          {index + 1}
                        </span>

                        <div className="showcase-finding-name">
                          <span
                            className={`risk-dot ${finding.severity.toLowerCase()}`}
                          />

                          <div>
                            <b>{finding.title}</b>
                            <small>
                              {finding.id} ·{" "}
                              {finding.source}
                            </small>
                          </div>
                        </div>

                        <span
                          className={`showcase-risk-badge ${finding.riskLevel.toLowerCase()}`}
                        >
                          {finding.riskLevel}
                        </span>

                        <div className="showcase-finding-score">
                          <b>{finding.riskScore}</b>
                          <span>/100</span>
                        </div>

                        <span className="showcase-finding-status">
                          <i />
                          {finding.status}
                        </span>

                      </div>
                    ))}

                  {!latestAssessment ||
                  latestAssessment.findings.length === 0 ? (
                    <p className="muted">
                      No assessment findings available.
                    </p>
                  ) : null}
                </div>
              </article>

              <article className="showcase-integrity panel">
                <div className="showcase-panel-header">
                  <div className="showcase-integrity-title">
                    <span className="showcase-section-icon">
                      ◈
                    </span>

                    <div>
                      <small>
                        ASSESSMENT INTEGRITY
                      </small>
                      <h3>
                        End-to-end pipeline assurance
                      </h3>
                    </div>
                  </div>

                  <span
                    className={`showcase-health ${
                      overviewScanners.length > 0 &&
                      overviewCompletedScanners ===
                        overviewScanners.length
                        ? "healthy"
                        : "degraded"
                    }`}
                  >
                    ●{" "}
                    {overviewScanners.length > 0 &&
                    overviewCompletedScanners ===
                      overviewScanners.length
                      ? "HEALTHY"
                      : "DEGRADED"}
                  </span>
                </div>

                <div className="showcase-integrity-list">
                  <div>
                    <span>Scanner coverage</span>
                    <b>
                      {overviewCompletedScanners}/
                      {overviewScanners.length}
                    </b>
                  </div>

                  <div>
                    <span>Normalized findings</span>
                    <b>{overviewFindings}</b>
                  </div>

                  <div>
                    <span>Controls mapped</span>
                    <b>
                      {overviewControls}/
                      {overviewFindings}
                    </b>
                  </div>

                  <div>
                    <span>Evidence coverage</span>
                    <b>
                      {overviewEvidence}/
                      {overviewFindings}
                    </b>
                  </div>

                  <div>
                    <span>Raw scanner findings</span>
                    <b>{overviewRawFindings}</b>
                  </div>

                  <div>
                    <span>Correlated / deduped</span>
                    <b>{overviewDeduped}</b>
                  </div>
                </div>

                <small className="showcase-scanner-label">
                  SCANNER EXECUTIONS
                </small>

                <div className="showcase-scanners">
                  {overviewScanners.map(
                    (scanner) => (
                      <div
                        key={`${scanner.category}-${scanner.tool}`}
                      >
                        <span
                          className={
                            scanner.status ===
                            "Completed"
                              ? "completed"
                              : "failed"
                          }
                        >
                          {scanner.status ===
                          "Completed"
                            ? "✓"
                            : "×"}
                        </span>

                        <div>
                          <b>{scanner.tool}</b>
                          <small>
                            {scanner.findings} raw
                            finding
                            {scanner.findings === 1
                              ? ""
                              : "s"}
                          </small>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </article>
            </section>

            <footer className="showcase-footer">
              <span>
                AppSecGate · Intelligent DevSecOps
                Security Gate
              </span>

              <b>
                Security today. Stronger tomorrow.
              </b>
            </footer>
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
              setView("evidence", {
                findingId: focusedFindingId,
                assessmentId:
                  focusedAssessment?.id ?? null,
              })
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
              setView("controls", {
                findingId: focusedFindingId,
                assessmentId:
                  focusedAssessment?.id ?? null,
              })
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
