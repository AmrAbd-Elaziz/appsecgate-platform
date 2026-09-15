"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  type AssessmentRun,
  type EvidenceRecord,
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
  const [
    selectedEvidence,
    setSelectedEvidence,
  ] = useState<EvidenceRecord | null>(
    null
  );

  useEffect(() => {
    if (!selectedEvidence) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setSelectedEvidence(null);
      }
    };

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [selectedEvidence]);

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
            <article
              className="evidence-row evidence-row-clickable"
              key={record.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                setSelectedEvidence(record)
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  event.preventDefault();
                  setSelectedEvidence(record);
                }
              }}
            >
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

      {selectedEvidence &&
        (() => {
          const finding =
            assessment?.findings.find(
              (item) =>
                item.id ===
                selectedEvidence.findingId
            );

          const control =
            assessment?.controls.find(
              (item) =>
                item.id ===
                selectedEvidence.controlId
            );

          const location =
            selectedEvidence.location;

          const riskLabel =
            finding
              ? `${finding.riskScore}/100 · ${finding.riskLevel}`
              : "Not available";

          const locationTitle =
            location?.file ||
            location?.url ||
            location?.package ||
            location?.raw ||
            "Location unavailable";

          const locationDetail =
            location?.line
              ? `Line ${location.line}`
              : location?.package
                ? `${location.package}${
                    location.version
                      ? ` @ ${location.version}`
                      : ""
                  }`
                : location?.resource
                  ? location.resource
                  : location?.parameter
                    ? `Parameter: ${location.parameter}`
                    : "Scanner location metadata";

          return (
            <div
              className="evidence-detail-overlay"
              role="presentation"
              onMouseDown={(event) => {
                if (
                  event.target ===
                  event.currentTarget
                ) {
                  setSelectedEvidence(null);
                }
              }}
            >
              <section
                className="evidence-detail-modal"
                role="dialog"
                aria-modal="true"
                aria-label={`Evidence ${selectedEvidence.id}`}
              >
                <header className="evidence-detail-header">
                  <div>
                    <div className="evidence-detail-kicker">
                      EVIDENCE DETAIL · {selectedEvidence.id}
                    </div>

                    <h2>
                      {selectedEvidence.title}
                    </h2>

                    <p>
                      {selectedEvidence.source}
                      {" · "}
                      {finding?.category ||
                        selectedEvidence.type}
                    </p>
                  </div>

                  <div className="evidence-detail-header-actions">
                    <span
                      className={`evidence-integrity-badge ${
                        selectedEvidence.status ===
                        "Verified"
                          ? "verified"
                          : "pending"
                      }`}
                    >
                      INTEGRITY{" "}
                      {selectedEvidence.status.toUpperCase()}
                    </span>

                    <button
                      type="button"
                      className="evidence-detail-close"
                      aria-label="Close evidence detail"
                      onClick={() =>
                        setSelectedEvidence(null)
                      }
                    >
                      ×
                    </button>
                  </div>
                </header>

                <div className="evidence-detail-top-grid">
                  <article className="evidence-intel-card evidence-location-card">
                    <div className="evidence-card-heading">
                      <div>
                        <small>
                          FINDING LOCATION
                        </small>
                        <h3>
                          Where the scanner detected it
                        </h3>
                      </div>

                      <span>
                        {location?.kind ||
                          "Unknown"}
                      </span>
                    </div>

                    <div className="evidence-location-primary">
                      <div className="evidence-location-marker">
                        ◇
                      </div>

                      <div>
                        <b>
                          {locationTitle}
                        </b>
                        <span>
                          {locationDetail}
                        </span>
                      </div>
                    </div>

                    <div className="evidence-location-context">
                      <div className="evidence-code-line-number">
                        {location?.line || "—"}
                      </div>

                      <div className="evidence-code-content">
                        <small>
                          SCANNER PROVENANCE
                        </small>

                        <code>
                          {location?.raw ||
                            "Location was not provided by this scanner evidence."}
                        </code>

                        <span>
                          ↑ detected here
                        </span>
                      </div>
                    </div>

                    <div className="evidence-location-facts">
                      <div>
                        <small>SCANNER</small>
                        <b>
                          {selectedEvidence.source}
                        </b>
                      </div>

                      <div>
                        <small>CWE</small>
                        <b>
                          {selectedEvidence.cwe ||
                            "Not provided"}
                        </b>
                      </div>

                      {location?.package && (
                        <div>
                          <small>PACKAGE</small>
                          <b>
                            {location.package}
                          </b>
                        </div>
                      )}

                      {location?.version && (
                        <div>
                          <small>VERSION</small>
                          <b>
                            {location.version}
                          </b>
                        </div>
                      )}

                      {location?.resource && (
                        <div>
                          <small>RESOURCE</small>
                          <b>
                            {location.resource}
                          </b>
                        </div>
                      )}

                      {location?.parameter && (
                        <div>
                          <small>PARAMETER</small>
                          <b>
                            {location.parameter}
                          </b>
                        </div>
                      )}
                    </div>

                    <p className="evidence-safety-note">
                      Scanner provenance only. Secret
                      values and sensitive payloads are
                      never persisted in this evidence
                      view.
                    </p>
                  </article>

                  <article className="evidence-intel-card evidence-metadata-card">
                    <div className="evidence-card-heading">
                      <div>
                        <small>
                          EVIDENCE METADATA
                        </small>
                        <h3>
                          Traceability
                        </h3>
                      </div>
                    </div>

                    <dl className="evidence-metadata-list">
                      <div>
                        <dt>Asset</dt>
                        <dd>
                          <b>
                            {run.asset.name}
                          </b>
                          <span>
                            {run.asset.environment}
                            {" · "}
                            {run.asset.criticality}
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt>Finding</dt>
                        <dd>
                          <b>
                            {selectedEvidence.findingId}
                          </b>
                          <span>
                            {finding?.title ||
                              "Finding record"}
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt>Control</dt>
                        <dd>
                          <b>
                            {selectedEvidence.controlId}
                          </b>
                          <span>
                            {control?.name ||
                              "Mapped control"}
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt>Evidence type</dt>
                        <dd>
                          <b>
                            {selectedEvidence.type}
                          </b>
                          <span>
                            {selectedEvidence.source}
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt>Integrity</dt>
                        <dd>
                          <b>
                            {selectedEvidence.status}
                          </b>
                          <span>
                            {selectedEvidence.integrity}
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt>Assessment</dt>
                        <dd>
                          <b>
                            {selectedEvidence.runId}
                          </b>
                          <span>
                            Gate decision · {assessment?.decision || run.decision}
                          </span>
                        </dd>
                      </div>
                    </dl>
                  </article>
                </div>

                <article className="evidence-risk-panel">
                  <div className="evidence-risk-heading">
                    <div>
                      <small>
                        EXPLAINABLE RISK PIPELINE
                      </small>
                      <h3>
                        Why this evidence matters
                      </h3>
                    </div>

                    <span>
                      {riskLabel}
                    </span>
                  </div>

                  <div className="evidence-risk-flow">
                    <div className="evidence-risk-node">
                      <small>ASSET</small>
                      <b>{run.asset.name}</b>
                      <span>
                        {run.asset.environment}
                        {" · "}
                        {run.asset.criticality}
                      </span>
                    </div>

                    <div className="evidence-risk-arrow">
                      →
                    </div>

                    <div className="evidence-risk-node">
                      <small>FINDING</small>
                      <b>
                        {finding?.title ||
                          selectedEvidence.findingId}
                      </b>
                      <span>
                        {finding?.severity ||
                          "Severity unavailable"}
                      </span>
                    </div>

                    <div className="evidence-risk-arrow">
                      →
                    </div>

                    <div className="evidence-risk-node risk-context">
                      <small>RISK CONTEXT</small>
                      <b>
                        {selectedEvidence.cwe ||
                          finding?.category ||
                          "Security exposure"}
                      </b>
                      <span>
                        {finding
                          ? `Risk ${finding.riskScore}/100 · ${finding.riskLevel}`
                          : "Risk intelligence unavailable"}
                      </span>
                    </div>

                    <div className="evidence-risk-arrow">
                      →
                    </div>

                    <div className="evidence-risk-node">
                      <small>CONTROL</small>
                      <b>
                        {control?.name ||
                          selectedEvidence.controlId}
                      </b>
                      <span>
                        {control?.status ||
                          "Mapped"}
                      </span>
                    </div>

                    <div className="evidence-risk-arrow">
                      →
                    </div>

                    <div
                      className={`evidence-risk-node gate ${
                        assessment?.decision ===
                        "BLOCK"
                          ? "blocked"
                          : assessment?.decision ===
                              "INCOMPLETE"
                            ? "incomplete"
                            : "passed"
                      }`}
                    >
                      <small>SECURITY GATE</small>
                      <b>
                        {assessment?.decision ||
                          run.decision}
                      </b>
                      <span>
                        Assessment decision
                      </span>
                    </div>
                  </div>

                  {finding && (
                    <div className="evidence-risk-explanation">
                      <span>
                        Technical severity
                        <b>
                          {finding.severity}
                        </b>
                      </span>

                      <span>
                        Asset criticality
                        <b>
                          {run.asset.criticality}
                        </b>
                      </span>

                      <span>
                        Confidence
                        <b>
                          {finding.confidence}
                        </b>
                      </span>

                      <span>
                        Scanner correlation
                        <b>
                          {finding.scannerCount}
                        </b>
                      </span>

                      <span>
                        Risk score
                        <b>
                          {finding.riskScore}/100
                        </b>
                      </span>
                    </div>
                  )}
                </article>
              </section>
            </div>
          );
        })()}

    </>
  );
}
