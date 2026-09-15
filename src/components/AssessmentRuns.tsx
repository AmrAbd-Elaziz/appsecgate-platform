"use client";

import {
  getAssessmentMetrics,
  type AssessmentRun,
} from "../data/appsecgate";

type Props = {
  run: AssessmentRun | null;
  onGoToAssets: () => void;
  onViewFindings: () => void;
};



export default function AssessmentRuns({
  run,
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

  const metrics = getAssessmentMetrics(run);
  const completedScanners = run.scanners.filter(
    (scanner) => scanner.status === "Completed"
  ).length;
  const totalFindings = metrics.rawFindings;

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
          <b>{run.decision}</b>
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
          <b>{completedScanners}/6</b>
          <span>Security engines completed</span>
        </article>

        <article>
          <small>Raw findings</small>
          <b>{totalFindings}</b>
          <span>Before normalization</span>
        </article>

        <article>
          <small>Confirmed blockers</small>
          <b>2</b>
          <span>Require remediation</span>
        </article>
      </section>

      <section className="assessment-content-grid">
        <article className="panel scanner-panel">
          <div className="panel-title">
            <div>
              <h3>Scanner execution</h3>
              <span className="panel-subtitle">
                Full security gate coverage
              </span>
            </div>
            <span>{completedScanners}/6 completed</span>
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
            <b>BLOCK</b>
            <span>
              Confirmed critical findings prevent production release.
            </span>
          </div>

          <div className="result-metrics">
            <div>
              <span>Normalized findings</span>
              <b>4</b>
            </div>
            <div>
              <span>Critical</span>
              <b className="danger-text">2</b>
            </div>
            <div>
              <span>High</span>
              <b>1</b>
            </div>
            <div>
              <span>Medium</span>
              <b>1</b>
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
