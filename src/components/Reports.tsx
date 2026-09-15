"use client";

import {
  type AssessmentRun,
  type PersistedAssessment,
} from "../data/appsecgate";

type Props = {
  run: AssessmentRun | null;
  assessment: PersistedAssessment | null;
  onGoToEvidence: () => void;
};

export default function Reports({
  run,
  assessment,
  onGoToEvidence,
}: Props) {
  if (!run) {
    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">SECURITY REPORTING</p>
            <h1>Reports</h1>
            <p className="page-description">
              Consolidated assessment and release decision reporting.
            </p>
          </div>
        </header>

        <section className="panel empty-assessment">
          <div className="empty-icon">◇</div>
          <h2>No assessment report available</h2>
          <p className="muted">
            Complete an assessment before generating a security report.
          </p>
          <button className="primary-button" onClick={onGoToEvidence}>
            View evidence vault →
          </button>
        </section>
      </>
    );
  }

  const findings =
    assessment?.findings ?? [];

  const controls =
    assessment?.controls ?? [];

  const evidence =
    assessment?.evidence ?? [];

  const metrics = {
    rawFindings:
      assessment?.rawFindingCount ?? 0,

    normalizedFindings:
      findings.length,

    criticalFindings: findings.filter(
      (finding) =>
        finding.severity === "CRITICAL"
    ).length,

    blockers:
      assessment?.blockers.length ?? 0,

    mappedControls:
      controls.length,

    implementedControls: controls.filter(
      (control) =>
        control.status === "Implemented"
    ).length,

    evidenceRecords:
      evidence.length,

    verifiedEvidence: evidence.filter(
      (record) =>
        record.status === "Verified"
    ).length,

    scannerCoverage:
      assessment?.scannerExecutions.length ?? 0,
  };

  const highFindings = findings.filter(
    (finding) => finding.severity === "HIGH"
  ).length;

  const mediumFindings = findings.filter(
    (finding) => finding.severity === "MEDIUM"
  ).length;

  const pendingEvidence =
    metrics.evidenceRecords - metrics.verifiedEvidence;

  const controlProgress =
    metrics.mappedControls === 0
      ? 0
      : (metrics.implementedControls / metrics.mappedControls) * 100;

  const evidenceProgress =
    metrics.evidenceRecords === 0
      ? 0
      : (metrics.verifiedEvidence / metrics.evidenceRecords) * 100;

  const scannerProgress =
    run.scanners.length === 0
      ? 0
      : (metrics.scannerCoverage / run.scanners.length) * 100;

  return (
    <>
      <header className="page-header reports-page-header">
        <div>
          <p className="eyebrow">SECURITY REPORTING</p>
          <h1>Assessment Report</h1>
          <p className="page-description">
            Executive security posture, technical findings, remediation
            controls, evidence, and release decision.
          </p>
        </div>

        <div className="findings-run-context">
          <small>REPORT FOR</small>
          <b>{run.id}</b>
          <span>{run.asset.name}</span>
        </div>
      </header>

      <section className="report-decision-card">
        <div>
          <p className="eyebrow">FINAL RELEASE DECISION</p>
          <h2>{run.decision}</h2>
          <p>
            {metrics.blockers} confirmed critical finding(s) require remediation before this
            assessment target can proceed to production.
          </p>
        </div>

        <div className="report-score">
          <small>SECURITY GATE</small>
          <b>BLOCKED</b>
          <span>Critical risk threshold exceeded</span>
        </div>
      </section>

      <section className="report-kpis">
        <article>
          <small>Assessment target</small>
          <b>{run.asset.name}</b>
          <span>{run.asset.environment}</span>
        </article>

        <article>
          <small>Normalized findings</small>
          <b>{metrics.normalizedFindings}</b>
          <span>
            {metrics.criticalFindings} critical · {highFindings} high ·{" "}
            {mediumFindings} medium
          </span>
        </article>

        <article>
          <small>Mapped controls</small>
          <b>{metrics.mappedControls}</b>
          <span>
            {metrics.mappedControls - metrics.implementedControls} remediation
            controls open
          </span>
        </article>

        <article>
          <small>Evidence records</small>
          <b>{metrics.evidenceRecords}</b>
          <span>
            {metrics.verifiedEvidence} verified · {pendingEvidence} pending
          </span>
        </article>
      </section>

      <section className="report-layout">
        <div className="report-main">
          <article className="panel report-section">
            <div className="report-section-heading">
              <span>01</span>
              <div>
                <p className="eyebrow">ASSESSMENT SCOPE</p>
                <h3>Target & execution</h3>
              </div>
            </div>

            <div className="report-detail-grid">
              <span>
                <small>ASSET</small>
                <b>{run.asset.name}</b>
              </span>

              <span>
                <small>TYPE</small>
                <b>{run.asset.type}</b>
              </span>

              <span>
                <small>ENVIRONMENT</small>
                <b>{run.asset.environment}</b>
              </span>

              <span>
                <small>CRITICALITY</small>
                <b>{run.asset.criticality}</b>
              </span>

              <span>
                <small>SCANNER COVERAGE</small>
                <b>{metrics.scannerCoverage} / {run.scanners.length}</b>
              </span>

              <span>
                <small>RUN ID</small>
                <b>{run.id}</b>
              </span>
            </div>
          </article>

          <article className="panel report-section">
            <div className="report-section-heading">
              <span>02</span>
              <div>
                <p className="eyebrow">RISK SUMMARY</p>
                <h3>Normalized security findings</h3>
              </div>
            </div>

            <div className="report-risk-list">
              {findings.map((finding) => (
                <div key={finding.id}>
                  <span
                    className={`report-risk-dot ${finding.severity.toLowerCase()}`}
                  />
                  <b>{finding.title}</b>
                  <small>
                    {finding.severity} · {finding.status}
                    {finding.blocker ? " · Release blocker" : ""}
                  </small>
                </div>
              ))}
            </div>
          </article>

          <article className="panel report-section">
            <div className="report-section-heading">
              <span>03</span>
              <div>
                <p className="eyebrow">REMEDIATION & ASSURANCE</p>
                <h3>Control and evidence posture</h3>
              </div>
            </div>

            <div className="report-progress-row">
              <span>Controls implemented</span>
              <div className="report-progress">
                <i style={{ width: `${controlProgress}%` }} />
              </div>
              <b>{metrics.implementedControls} / {metrics.mappedControls}</b>
            </div>

            <div className="report-progress-row">
              <span>Evidence verified</span>
              <div className="report-progress">
                <i style={{ width: `${evidenceProgress}%` }} />
              </div>
              <b>{metrics.verifiedEvidence} / {metrics.evidenceRecords}</b>
            </div>

            <div className="report-progress-row">
              <span>Scanner coverage</span>
              <div className="report-progress">
                <i style={{ width: `${scannerProgress}%` }} />
              </div>
              <b>{metrics.scannerCoverage} / {run.scanners.length}</b>
            </div>
          </article>
        </div>

        <aside className="panel report-sidebar">
          <p className="eyebrow">DECISION EXPLANATION</p>
          <h3>Why is this release blocked?</h3>

          <p className="muted">
            AppSecGate identified {metrics.blockers} confirmed critical finding(s)
            that exceed the configured production release threshold.
          </p>

          <div className="report-decision-reasons">
            <span>
              <b>01</b>
              Hardcoded secret remains an active release blocker.
            </span>

            <span>
              <b>02</b>
              SQL injection requires validated remediation and retesting.
            </span>

            <span>
              <b>03</b>
              Required evidence must be verified before reassessment.
            </span>
          </div>

          <div className="report-required-action">
            <small>REQUIRED ACTION</small>
            <b>Remediate → Retest → Reassess</b>
          </div>

          <button
            className="run-assessment-button"
            onClick={onGoToEvidence}
          >
            Review assessment evidence →
          </button>
        </aside>
      </section>

      <section className="report-footer-card">
        <div>
          <p className="eyebrow">AUDIT TRACE</p>
          <h3>Decision fully traceable</h3>
          <p className="muted">
            This report links the release decision to assessment evidence,
            normalized findings, and remediation controls.
          </p>
        </div>

        <div className="report-trace">
          <span>Assessment</span>
          <b>→</b>
          <span>Findings</span>
          <b>→</b>
          <span>Controls</span>
          <b>→</b>
          <span>Evidence</span>
          <b>→</b>
          <span>BLOCK</span>
        </div>
      </section>
    </>
  );
}
