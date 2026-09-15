"use client";

import {
  type AssessmentRun,
  type PersistedAssessment,
} from "../data/appsecgate";

type Props = {
  run: AssessmentRun | null;
  assessment: PersistedAssessment | null;
  onGoToControls: () => void;
  onViewReports: () => void;
  selectedFindingId?: string | null;
};

export default function EvidenceVault({
  run,
  assessment,
  onGoToControls,
  onViewReports,
  selectedFindingId,
}: Props) {
  if (!run) {
    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">AUDITABLE SECURITY ASSURANCE</p>
            <h1>Evidence Vault</h1>
            <p className="page-description">
              Preserve scanner output, remediation proof, and retest evidence.
            </p>
          </div>
        </header>

        <section className="panel empty-assessment">
          <div className="empty-icon">◇</div>
          <h2>No assessment evidence available</h2>
          <p className="muted">
            Run an assessment before reviewing assurance evidence.
          </p>
          <button className="primary-button" onClick={onGoToControls}>
            View security controls →
          </button>
        </section>
      </>
    );
  }

  const allEvidenceRecords =
    assessment?.evidence ?? [];

  const evidenceRecords =
    selectedFindingId
      ? allEvidenceRecords.filter(
          (record) =>
            record.findingId ===
            selectedFindingId
        )
      : allEvidenceRecords;

  const controls =
    assessment?.controls ?? [];

  const verified = evidenceRecords.filter(
    (record) => record.status === "Verified"
  ).length;

  const pending = evidenceRecords.filter(
    (record) => record.status === "Pending Review"
  ).length;

  const scannerEvidence = evidenceRecords.filter(
    (record) => record.type === "Scanner Output"
  ).length;

  return (
    <>
      <header className="page-header evidence-page-header">
        <div>
          <p className="eyebrow">AUDITABLE SECURITY ASSURANCE</p>
          <h1>Evidence Vault</h1>
          <p className="page-description">
            Trace assessment decisions back to scanner output, remediation
            proof, and validated retest evidence.
          </p>
        </div>

        <div className="findings-run-context">
          <small>ASSESSMENT RUN</small>
          <b>{run.id}</b>
          <span>{run.asset.name}</span>
        </div>
      </header>

      <section className="evidence-kpis">
        <article>
          <small>Evidence records</small>
          <b>{evidenceRecords.length}</b>
          <span>Linked assurance records</span>
        </article>

        <article>
          <small>Verified</small>
          <b className="evidence-success">{verified}</b>
          <span>Integrity validated</span>
        </article>

        <article>
          <small>Pending review</small>
          <b className="evidence-warning">{pending}</b>
          <span>Requires validation</span>
        </article>

        <article>
          <small>Scanner evidence</small>
          <b>{scannerEvidence}</b>
          <span>Machine-generated records</span>
        </article>
      </section>

      <section className="panel evidence-panel">
        <div className="panel-title">
          <div>
            <h3>Assessment evidence</h3>
            <span className="panel-subtitle">
              Finding → control → evidence → verification
            </span>
          </div>
          <span>{evidenceRecords.length} records</span>
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
              onClick={onGoToControls}
            >
              View Security Control
            </button>
          </div>
        )}

        <div className="evidence-table">
          <div className="evidence-table-header">
            <span>EVIDENCE</span>
            <span>TYPE / SOURCE</span>
            <span>CONTROL</span>
            <span>STATUS</span>
          </div>

          {evidenceRecords.map((record) => (
            <article className="evidence-row" key={record.id}>
              <div className="evidence-title">
                <span className="evidence-icon">✓</span>
                <div>
                  <small>{record.id}</small>
                  <b>{record.title}</b>
                  <span>
                    Finding {record.findingId} · {record.integrity}
                  </span>
                </div>
              </div>

              <div className="evidence-source">
                <b>{record.type}</b>
                <span>{record.source}</span>
              </div>

              <div className="evidence-control">
                {(() => {
                  const control = controls.find(
                    (item) => item.id === record.controlId
                  );

                  return control
                    ? `${control.id} · ${control.name}`
                    : record.controlId;
                })()}
              </div>

              <div>
                <span
                  className={`evidence-status ${record.status
                    .toLowerCase()
                    .replaceAll(" ", "-")}`}
                >
                  {record.status}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="evidence-trace panel">
        <div>
          <p className="eyebrow">DECISION TRACEABILITY</p>
          <h3>Assessment evidence chain</h3>
        </div>

        <div className="trace-chain">
          <span>Asset</span>
          <b>→</b>
          <span>Assessment</span>
          <b>→</b>
          <span>Finding</span>
          <b>→</b>
          <span>Control</span>
          <b>→</b>
          <span>Evidence</span>
          <b>→</b>
          <span>Release Decision</span>
        </div>
      </section>

      <section className="evidence-next-step">
        <div>
          <p className="eyebrow">SECURITY REPORTING</p>
          <h3>Generate the assessment decision report</h3>
          <p className="muted">
            Consolidate assessment scope, findings, controls, evidence, and
            release decision into one report.
          </p>
        </div>

        <button className="primary-button" onClick={onViewReports}>
          Open reports →
        </button>
      </section>
    </>
  );
}
