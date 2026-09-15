"use client";

import {
  type AssessmentRun,
  type PersistedAssessment,
} from "../data/appsecgate";

type Props = {
  run: AssessmentRun | null;
  assessment: PersistedAssessment | null;
  onGoToAssessment: () => void;
  onViewControls: () => void;
};

export default function FindingIntelligence({
  run,
  assessment,
  onGoToAssessment,
  onViewControls,
}: Props) {
  if (!run) {
    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">NORMALIZED SECURITY INTELLIGENCE</p>
            <h1>Finding Intelligence</h1>
            <p className="page-description">
              Correlated and validated security findings from assessment evidence.
            </p>
          </div>
        </header>

        <section className="panel empty-assessment">
          <div className="empty-icon">◇</div>
          <h2>No finding intelligence available</h2>
          <p className="muted">
            Run an assessment before reviewing normalized security findings.
          </p>
          <button className="primary-button" onClick={onGoToAssessment}>
            View assessment runs →
          </button>
        </section>
      </>
    );
  }

  const normalizedFindings =
    assessment?.findings ?? [];

  const controls =
    assessment?.controls ?? [];

  const critical = normalizedFindings.filter(
    (finding) =>
      finding.severity === "CRITICAL"
  ).length;

  const blockers =
    assessment?.blockers.length ?? 0;

  return (
    <>
      <header className="page-header findings-page-header">
        <div>
          <p className="eyebrow">NORMALIZED SECURITY INTELLIGENCE</p>
          <h1>Finding Intelligence</h1>
          <p className="page-description">
            Scanner signals are correlated, normalized, and validated before
            influencing the release gate.
          </p>
        </div>

        <div className="findings-run-context">
          <small>ASSESSMENT RUN</small>
          <b>{run.id}</b>
          <span>{run.asset.name}</span>
        </div>
      </header>

      <section className="finding-kpis">
        <article>
          <small>Normalized findings</small>
          <b>{normalizedFindings.length}</b>
          <span>After correlation</span>
        </article>

        <article>
          <small>Critical</small>
          <b className="finding-critical-number">{critical}</b>
          <span>Highest severity</span>
        </article>

        <article>
          <small>Confirmed blockers</small>
          <b>{blockers}</b>
          <span>Driving release decision</span>
        </article>

        <article>
          <small>Gate decision</small>
          <b className="finding-critical-number">{run.decision}</b>
          <span>Current assessment</span>
        </article>
      </section>

      <section className="panel finding-intelligence-panel">
        <div className="panel-title">
          <div>
            <h3>Normalized findings</h3>
            <span className="panel-subtitle">
              Deduplicated security intelligence
            </span>
          </div>

          <span>{normalizedFindings.length} findings</span>
        </div>

        <div className="finding-intelligence-list">
          {normalizedFindings.map((finding) => (
            <article className="intelligence-finding" key={finding.id}>
              <div
                className={`finding-severity-line ${finding.severity.toLowerCase()}`}
              />

              <div className="finding-main">
                <div className="finding-heading">
                  <div>
                    <span className="finding-id">{finding.id}</span>
                    <h3>{finding.title}</h3>
                  </div>

                  <div className="finding-tags">
                    <span
                      className={`badge ${finding.severity.toLowerCase()}`}
                    >
                      {finding.severity}
                    </span>

                    <span className="validation-tag">
                      {finding.status}
                    </span>

                    {finding.blocker && (
                      <span className="blocker-tag">
                        RELEASE BLOCKER
                      </span>
                    )}
                  </div>
                </div>

                <p>{finding.description}</p>

                <div className="finding-metadata">
                  <span>
                    <small>SOURCE</small>
                    <b>{finding.source}</b>
                  </span>

                  <span>
                    <small>CATEGORY</small>
                    <b>{finding.category}</b>
                  </span>

                  <span>
                    <small>ASSET</small>
                    <b>{run.asset.name}</b>
                  </span>

                  <span>
                    <small>CONTROL</small>
                    <b>
                      {controls.find(
                        (control) => control.id === finding.controlId
                      )?.name ?? finding.controlId}
                    </b>
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="finding-next-step">
        <div>
          <p className="eyebrow">CONTROL MAPPING</p>
          <h3>Translate findings into remediation controls</h3>
          <p className="muted">
            Review the security controls mapped to validated findings and
            release blockers.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={onViewControls}
        >
          View security controls →
        </button>
      </section>
    </>
  );
}
