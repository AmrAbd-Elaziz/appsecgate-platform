"use client";

import {
  type AssessmentRun,
  type PersistedAssessment,
} from "../data/appsecgate";

type Props = {
  run: AssessmentRun | null;
  assessment: PersistedAssessment | null;
  onGoToFindings: () => void;
  onViewEvidence: () => void;
  selectedFindingId?: string | null;
};

export default function SecurityControls({
  run,
  assessment,
  onGoToFindings,
  onViewEvidence,
  selectedFindingId,
}: Props) {
  if (!run) {
    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">REMEDIATION GOVERNANCE</p>
            <h1>Security Controls</h1>
            <p className="page-description">
              Map validated security findings to remediation controls.
            </p>
          </div>
        </header>

        <section className="panel empty-assessment">
          <div className="empty-icon">◇</div>
          <h2>No mapped controls available</h2>
          <p className="muted">
            Security controls are generated from normalized assessment findings.
          </p>
          <button className="primary-button" onClick={onGoToFindings}>
            View finding intelligence →
          </button>
        </section>
      </>
    );
  }

  const allControls =
    assessment?.controls ?? [];

  const findings =
    assessment?.findings ?? [];

  const controls = selectedFindingId
    ? allControls.filter(
        (control) =>
          control.findingId ===
          selectedFindingId
      )
    : allControls;

  const required = controls.filter(
    (control) => control.status === "Required"
  ).length;

  const inProgress = controls.filter(
    (control) => control.status === "In Progress"
  ).length;

  const implemented = controls.filter(
    (control) => control.status === "Implemented"
  ).length;

  return (
    <>
      <header className="page-header controls-page-header">
        <div>
          <p className="eyebrow">REMEDIATION GOVERNANCE</p>
          <h1>Security Controls</h1>
          <p className="page-description">
            Translate validated findings into actionable remediation controls
            with ownership and evidence requirements.
          </p>
        </div>

        <div className="findings-run-context">
          <small>ASSESSMENT RUN</small>
          <b>{run.id}</b>
          <span>{run.asset.name}</span>
        </div>
      </header>

      <section className="control-kpis">
        <article>
          <small>Mapped controls</small>
          <b>{controls.length}</b>
          <span>Across validated findings</span>
        </article>

        <article>
          <small>Required</small>
          <b className="control-danger">{required}</b>
          <span>Remediation not started</span>
        </article>

        <article>
          <small>In progress</small>
          <b>{inProgress}</b>
          <span>Active remediation</span>
        </article>

        <article>
          <small>Implemented</small>
          <b className="control-success">{implemented}</b>
          <span>Ready for evidence review</span>
        </article>
      </section>

      <section className="panel controls-panel">
        <div className="panel-title">
          <div>
            <h3>Remediation control plan</h3>
            <span className="panel-subtitle">
              Finding → control → owner → evidence
            </span>
          </div>
          <span>{controls.length} mapped controls</span>
        </div>

        {selectedFindingId && (
          <div className="finding-context-banner">
            <div>
              <small>FOCUSED FINDING</small>
              <b>{selectedFindingId}</b>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={onGoToFindings}
            >
              Back to Finding Intelligence
            </button>
          </div>
        )}

        <div className="controls-list">
          {controls.map((control) => (
            <article className="control-card" key={control.id}>
              <div className="control-card-top">
                <div>
                  <span className="control-id">{control.id}</span>
                  <h3>{control.name}</h3>
                  <span className="control-domain">{control.domain}</span>
                </div>

                <div className="control-tags">
                  <span
                    className={`badge ${control.severity.toLowerCase()}`}
                  >
                    {control.severity}
                  </span>

                  <span
                    className={`control-status ${control.status
                      .toLowerCase()
                      .replace(" ", "-")}`}
                  >
                    {control.status}
                  </span>
                </div>
              </div>

              <div className="mapped-finding">
                <small>MAPPED FINDING</small>
                <b>
                  {(() => {
                    const finding = findings.find(
                      (item) => item.id === control.findingId
                    );

                    return finding
                      ? `${finding.id} · ${finding.title}`
                      : control.findingId;
                  })()}
                </b>
              </div>

              <p className="control-remediation">
                {control.remediation}
              </p>

              <div className="control-metadata">
                <span>
                  <small>OWNER</small>
                  <b>{control.owner}</b>
                </span>

                <span>
                  <small>REQUIRED EVIDENCE</small>
                  <b>{control.requiredEvidence}</b>
                </span>

                <span>
                  <small>ASSESSMENT TARGET</small>
                  <b>{run.asset.name}</b>
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="control-next-step">
        <div>
          <p className="eyebrow">ASSURANCE EVIDENCE</p>
          <h3>Validate remediation with auditable evidence</h3>
          <p className="muted">
            Review scanner output, remediation proof, and retest records
            associated with these controls.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={onViewEvidence}
        >
          Open evidence vault →
        </button>
      </section>
    </>
  );
}
