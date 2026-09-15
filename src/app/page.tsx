"use client";

import { useState } from "react";
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

const findings = [
  ["Hardcoded application secret", "ASG-1042 · Gitleaks · Platform API", "CRITICAL", "Confirmed"],
  ["SQL injection on user search", "ASG-1038 · Semgrep + OWASP ZAP · Customer Portal", "CRITICAL", "Confirmed"],
  ["Vulnerable OpenSSL base image", "ASG-1029 · Trivy + pip-audit · Retail API Container", "HIGH", "Validated"],
  ["S3 public access block missing", "ASG-1017 · Checkov · Retail Cloud Storage", "MEDIUM", "Validated"],
];

function FindingRows() {
  return (
    <div className="finding-list">
      {findings.map(([title, meta, severity, status]) => (
        <button className="finding-row" key={meta}>
          <span className={`risk-dot ${severity.toLowerCase()}`} />
          <span className="finding-copy">
            <b>{title}</b>
            <small>{meta}</small>
          </span>
          <span className={`badge ${severity.toLowerCase()}`}>{severity}</span>
          <span className="finding-status">{status}</span>
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
    console.log(
      "[AppSecGate UI] Starting assessment",
      asset
    );

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
      setView("assessments");
    } catch (error) {
      console.error("Assessment execution failed:", error);
    }
  }

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
                <b>BLOCK</b>
                <span>
                  2 confirmed critical finding(s) require action before production release.
                </span>
              </div>
            </header>

            <section className="decision-card">
              <p className="eyebrow">RELEASE DECISION · LATEST ASSESSMENT</p>
              <h2>BLOCK</h2>
              <p>2 confirmed critical finding(s) require action before production release.</p>
              <button onClick={() => setView("assessments")}>
                View assessment runs →
              </button>
            </section>

            <section className="kpi-grid">
              <article><small>Managed assets</small><b>4</b><span>In active assessment scope</span></article>
              <article><small>Normalized findings</small><b>4</b><span>Across scanner sources</span></article>
              <article><small>Confirmed blockers</small><b>2</b><span>Release decision drivers</span></article>
              <article><small>Evidence records</small><b>3</b><span>Auditable assessment proof</span></article>
            </section>

            <section className="content-grid">
              <article className="panel">
                <div className="panel-title">
                  <h3>Prioritized findings</h3>
                  <button onClick={() => setView("findings")}>View all →</button>
                </div>
                <FindingRows />
              </article>

              <article className="panel">
                <div className="panel-title">
                  <h3>Assessment coverage</h3>
                  <span>1 completed run(s)</span>
                </div>

                <div className="coverage">
                  {["Semgrep", "OWASP ZAP", "Gitleaks", "Trivy", "pip-audit", "Checkov"].map((tool) => (
                    <span key={tool}>✓ {tool}</span>
                  ))}
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
