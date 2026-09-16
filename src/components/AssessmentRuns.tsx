"use client";

import {
  type AssessmentRun,
  type PersistedAssessment,
} from "../data/appsecgate";

type Props = {
  run: AssessmentRun | null;
  assessment: PersistedAssessment | null;
  onGoToAssets: () => void;
  onViewFindings: () => void;
};



export default function AssessmentRuns({
  run,
  assessment,
  onGoToAssets,
  onViewFindings,
}: Props) {
  if (!run) {
    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">SECURITY ASSESSMENTS</p>
            <h1>Assessment Runs</h1>
            <p className="page-description">
              Execute and review security assessment runs across managed assets.
            </p>
          </div>
        </header>

        <section className="panel empty-assessment">
          <div className="empty-icon">◇</div>
          <h2>No assessment run selected</h2>
          <p className="muted">
            Select an asset and start a full security gate assessment.
          </p>
          <button className="primary-button" onClick={onGoToAssets}>
            Select assessment target →
          </button>
        </section>
      </>
    );
  }

  const completedScanners = run.scanners.filter(
    (scanner) => scanner.status === "Completed"
  ).length;

  const totalFindings =
    assessment?.rawFindingCount ?? 0;

  const requiredScannerCount =
    run.scanners.length;

  const decision =
    assessment?.decision ??
    run.decision;

  const blockerCount =
    assessment?.blockers.length ?? 0;

  const normalizedFindings =
    assessment?.findings ?? [];

  const severityCounts =
    normalizedFindings.reduce(
      (counts, finding) => {
        counts[finding.severity] += 1;
        return counts;
      },
      {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      }
    );

  const gateMessage =
    decision === "BLOCK"
      ? "Confirmed security blockers require remediation before release."
      : decision === "INCOMPLETE"
        ? "Required scanner coverage is incomplete, so a reliable release decision cannot be issued."
        : "No confirmed policy blockers prevent release for this assessment.";

  const metrics = {
    rawFindings: assessment?.rawFindingCount ?? 0,
    normalizedFindings:
      assessment?.findings.length ?? 0,
    criticalFindings:
      assessment?.findings.filter(
        (finding) =>
          finding.severity === "CRITICAL"
      ).length ?? 0,
    blockers: assessment?.blockers.length ?? 0,
    mappedControls:
      assessment?.controls.length ?? 0,
    evidenceRecords:
      assessment?.evidence.length ?? 0,
  };

  return (
    <>
      <header className="page-header assessment-page-header">
        <div>
          <p className="eyebrow">SECURITY ASSESSMENTS</p>
          <h1>Assessment Runs</h1>
          <p className="page-description">
            Scanner execution, evidence collection, normalization, and release
            gate evaluation.
          </p>
        </div>

        <div className="run-status-card">
          <span className="status-indicator" />
          <div>
            <small>LATEST RUN</small>
            <b>{run.status}</b>
          </div>
        </div>
      </header>

      <section className="assessment-run-hero">
        <div>
          <p className="eyebrow">ASSESSMENT RUN</p>
          <h2>{run.id}</h2>
          <p>
            {run.asset.name} · {run.asset.type} · {run.asset.environment}
          </p>
        </div>

        <div className="run-decision">
          <small>RELEASE DECISION</small>
          <b>{decision}</b>
        </div>
      </section>

      <section className="assessment-kpis">
        <article>
          <small>Assessment target</small>
          <b>{run.asset.name}</b>
          <span>{run.asset.criticality} criticality</span>
        </article>

        <article>
          <small>Scanner coverage</small>
          <b>
            {completedScanners}/{requiredScannerCount}
          </b>
          <span>
            Required security engines completed
          </span>
        </article>

        <article>
          <small>Raw findings</small>
          <b>{totalFindings}</b>
          <span>Before normalization</span>
        </article>

        <article>
          <small>Confirmed blockers</small>
          <b>{blockerCount}</b>
          <span>
            {blockerCount === 0
              ? "No policy blockers"
              : blockerCount === 1
                ? "Policy blocker detected"
                : "Policy blockers detected"}
          </span>
        </article>
      </section>

      <section className="assessment-content-grid">
        <article className="panel scanner-panel">
          <div className="panel-title">
            <div>
              <h3>Scanner execution</h3>
              <span className="panel-subtitle">
                Required scanner coverage
              </span>
            </div>
            <span>
              {completedScanners}/{requiredScannerCount} required completed
            </span>
          </div>

          <div className="scanner-list">
            {run.scanners.map((scanner) => (
              <div className="scanner-row" key={scanner.category}>
                <span className="scanner-check">✓</span>

                <span className="scanner-name">
                  <b>{scanner.category}</b>
                  <small>{scanner.tool}</small>
                </span>

                <span className="scanner-status">
                  {scanner.status}
                </span>

                <span className="scanner-findings">
                  <b>{scanner.findings}</b>
                  <small>finding{scanner.findings === 1 ? "" : "s"}</small>
                </span>
              </div>
            ))}
          </div>
        </article>

        <aside className="panel assessment-result-panel">
          <p className="eyebrow">GATE ANALYSIS</p>
          <h3>Security gate result</h3>

          <div className="gate-result-block">
            <small>DECISION</small>
            <b>{decision}</b>
            <span>
              {gateMessage}
            </span>
          </div>

          <div className="result-metrics">
            <div>
              <span>Normalized findings</span>
              <b>{normalizedFindings.length}</b>
            </div>
            <div>
              <span>Critical</span>
              <b className="danger-text">
                {severityCounts.CRITICAL}
              </b>
            </div>
            <div>
              <span>High</span>
              <b>{severityCounts.HIGH}</b>
            </div>
            <div>
              <span>Medium</span>
              <b>{severityCounts.MEDIUM}</b>
            </div>
          </div>

          <p className="muted">
            Scanner results were correlated and normalized before calculating
            the release decision.
          </p>

          <button
            className="run-assessment-button"
            onClick={onViewFindings}
          >
            View normalized findings →
          </button>
        </aside>
      </section>
    </>
  );
}
