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
  selectedControlId?: string | null;
};

export default function EvidenceVault({
  run,
  assessment,
  onGoToControls,
  onViewReports,
  selectedFindingId,
  selectedControlId,
}: Props) {
  const [
    selectedEvidence,
    setSelectedEvidence,
  ] = useState<EvidenceRecord | null>(
    null
  );

  const [evidenceSearch, setEvidenceSearch] = useState("");
  const [evidenceSourceFilter, setEvidenceSourceFilter] =
    useState("All");
  const [evidencePage, setEvidencePage] = useState(1);

  const EVIDENCE_PER_PAGE = 10;

  function openEvidenceDetail(
    record: EvidenceRecord
  ) {
    setSelectedEvidence(record);

    const url = new URL(window.location.href);

    url.searchParams.set("view", "evidence");
    url.searchParams.set(
      "evidence",
      record.id
    );

    window.history.pushState(
      {
        view: "evidence",
        evidence: record.id,
      },
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  function closeEvidenceDetail() {
    setSelectedEvidence(null);

    const url = new URL(window.location.href);

    url.searchParams.delete("evidence");

    window.history.replaceState(
      {
        ...window.history.state,
        evidence: null,
      },
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  useEffect(() => {
    function syncEvidenceFromUrl() {
      const params = new URLSearchParams(
        window.location.search
      );

      const evidenceId =
        params.get("evidence");

      if (!evidenceId) {
        setSelectedEvidence(null);
        return;
      }

      const matchingRecord =
        (assessment?.evidence ?? []).find(
          (record) =>
            record.id === evidenceId
        );

      setSelectedEvidence(
        matchingRecord ?? null
      );
    }

    syncEvidenceFromUrl();

    window.addEventListener(
      "popstate",
      syncEvidenceFromUrl
    );

    return () => {
      window.removeEventListener(
        "popstate",
        syncEvidenceFromUrl
      );
    };
  }, [assessment?.id]);

  useEffect(() => {
    if (!selectedEvidence) {
      return;
    }

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        closeEvidenceDetail();
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

  useEffect(() => {
    setEvidencePage(1);
  }, [
    evidenceSearch,
    evidenceSourceFilter,
    selectedFindingId,
    selectedControlId,
    assessment?.id,
  ]);

  if (!run) {
    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">AUDITABLE SECURITY ASSURANCE</p>
            <h1>Evidence Vault</h1>
            <p className="page-description">
              Preserve scanner-generated evidence and security assessment context.
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

  const controls =
    assessment?.controls ?? [];

  /*
   * A persisted control ID represents one
   * finding-to-control mapping instance.
   *
   * When navigation comes from Security Controls,
   * resolve that instance to its stable control
   * definition, then include every finding mapped
   * to the same definition.
   */
  const selectedControl =
    selectedControlId
      ? controls.find(
          (control) =>
            control.id === selectedControlId
        ) ?? null
      : null;

  const selectedControlFindingIds =
    selectedControl
      ? new Set(
          controls
            .filter(
              (control) =>
                control.domain ===
                  selectedControl.domain &&
                control.name ===
                  selectedControl.name &&
                control.owner ===
                  selectedControl.owner &&
                control.remediation ===
                  selectedControl.remediation &&
                control.requiredEvidence ===
                  selectedControl.requiredEvidence
            )
            .map(
              (control) => control.findingId
            )
            .filter(Boolean)
        )
      : null;

  const evidenceRecords =
    selectedFindingId
      ? allEvidenceRecords.filter(
          (record) =>
            record.findingId ===
            selectedFindingId
        )
      : selectedControlFindingIds
        ? allEvidenceRecords.filter(
            (record) =>
              selectedControlFindingIds.has(
                record.findingId
              )
          )
        : allEvidenceRecords;

  const evidenceSourceOptions = Array.from(
    new Set(
      evidenceRecords
        .map((record) => record.source)
        .filter(Boolean)
    )
  ).sort();

  const normalizedEvidenceSearch =
    evidenceSearch.trim().toLowerCase();

  const filteredEvidenceRecords =
    evidenceRecords.filter((record) => {
      const control = controls.find(
        (item) => item.id === record.controlId
      );

      const searchableText = [
        record.id,
        record.title,
        record.findingId,
        record.type,
        record.source,
        record.status,
        record.controlId,
        control?.name,
        record.integrity,
        record.location?.package,
        record.location?.version,
        record.location?.file,
        record.location?.url,
        record.location?.resource,
        record.location?.parameter,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !normalizedEvidenceSearch ||
        searchableText.includes(normalizedEvidenceSearch);

      const matchesSource =
        evidenceSourceFilter === "All" ||
        record.source === evidenceSourceFilter;

      return (
        matchesSearch &&
        matchesSource
      );
    });

  const totalEvidencePages = Math.max(
    1,
    Math.ceil(
      filteredEvidenceRecords.length /
        EVIDENCE_PER_PAGE
    )
  );

  const safeEvidencePage = Math.min(
    evidencePage,
    totalEvidencePages
  );

  const evidencePageStart =
    (safeEvidencePage - 1) *
    EVIDENCE_PER_PAGE;

  const paginatedEvidenceRecords =
    filteredEvidenceRecords.slice(
      evidencePageStart,
      evidencePageStart +
        EVIDENCE_PER_PAGE
    );

  function evidencePageItems() {
    const pages: Array<number | "ellipsis"> = [];

    if (totalEvidencePages <= 5) {
      for (
        let page = 1;
        page <= totalEvidencePages;
        page += 1
      ) {
        pages.push(page);
      }

      return pages;
    }

    pages.push(1);

    if (safeEvidencePage > 3) {
      pages.push("ellipsis");
    }

    const start = Math.max(
      2,
      safeEvidencePage - 1
    );

    const end = Math.min(
      totalEvidencePages - 1,
      safeEvidencePage + 1
    );

    for (
      let page = start;
      page <= end;
      page += 1
    ) {
      pages.push(page);
    }

    if (
      safeEvidencePage <
      totalEvidencePages - 2
    ) {
      pages.push("ellipsis");
    }

    pages.push(totalEvidencePages);

    return pages;
  }

  const evidenceSources = new Set(
    evidenceRecords
      .map((record) => record.source)
      .filter(Boolean)
  ).size;

  const findingsCovered = new Set(
    evidenceRecords
      .map((record) => record.findingId)
      .filter(Boolean)
  ).size;

  const controlsMapped = new Set(
    evidenceRecords
      .map((record) => record.controlId)
      .filter(Boolean)
  ).size;

  return (
    <>
      <header className="page-header evidence-page-header">
        <div>
          <p className="eyebrow">AUDITABLE SECURITY ASSURANCE</p>
          <h1>Evidence Vault</h1>
          <p className="page-description">
            Trace assessment decisions back to scanner findings, mapped
            controls, and auditable security evidence.
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
          <span>Assurance records</span>
        </article>

        <article>
          <small>Evidence sources</small>
          <b className="evidence-success">{evidenceSources}</b>
          <span>Security scanners</span>
        </article>

        <article>
          <small>Findings covered</small>
          <b>{findingsCovered}</b>
          <span>With evidence</span>
        </article>

        <article>
          <small>
            {selectedControl
              ? "Controls in scope"
              : "Controls mapped"}
          </small>
          <b>
            {selectedControl
              ? 1
              : controlsMapped}
          </b>
          <span>
            {selectedControl
              ? "Selected control definition"
              : "Evidence-linked"}
          </span>
        </article>
      </section>

      <section className="panel evidence-panel">
        <div className="panel-title">
          <div>
            <h3>Assessment evidence</h3>
            <span className="panel-subtitle">
              Finding → control → scanner evidence → gate decision
            </span>
          </div>
          <span>{evidenceRecords.length} records</span>
        </div>

        {selectedControl && (
          <div className="control-scope-banner">
            <small>CONTROL SCOPE</small>
            <b>{selectedControl.name}</b>
            <span>
              {findingsCovered} linked findings ·{" "}
              {evidenceRecords.length} evidence records
            </span>
          </div>
        )}

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

        <div className="evidence-table-toolbar">
          <label className="evidence-search-field">
            <span>SEARCH</span>

            <input
              type="search"
              value={evidenceSearch}
              onChange={(event) =>
                setEvidenceSearch(event.target.value)
              }
              placeholder="Evidence ID, finding, scanner, package, control..."
            />
          </label>

          <label className="evidence-filter-field">
            <span>SOURCE</span>

            <select
              value={evidenceSourceFilter}
              onChange={(event) =>
                setEvidenceSourceFilter(
                  event.target.value
                )
              }
            >
              <option value="All">
                All sources
              </option>

              {evidenceSourceOptions.map(
                (source) => (
                  <option
                    key={source}
                    value={source}
                  >
                    {source}
                  </option>
                )
              )}
            </select>
          </label>

        </div>

        <div className="evidence-table">
          <div className="evidence-table-header">
            <span>EVIDENCE</span>
            <span>TYPE / SOURCE</span>
            <span>CONTROL</span>
            <span>STATUS</span>
          </div>

          <div className="evidence-table-body">
            {paginatedEvidenceRecords.length > 0 ? (
              paginatedEvidenceRecords.map(
                (record) => (
                  <article
                    className="evidence-row evidence-row-clickable"
                    key={record.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      openEvidenceDetail(record)
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        openEvidenceDetail(record);
                      }
                    }}
                  >
                    <div className="evidence-title">
                      <span className="evidence-icon">
                        ✓
                      </span>

                      <div>
                        <small>{record.id}</small>

                        <b>{record.title}</b>

                        <span>
                          Finding {record.findingId} ·{" "}
                          {record.integrity}
                        </span>

                        {(record.location?.package ||
                          record.location?.version) && (
                          <span className="evidence-component-context">
                            {record.location?.package && (
                              <>
                                Package{" "}
                                <strong>
                                  {
                                    record.location
                                      .package
                                  }
                                </strong>
                              </>
                            )}

                            {record.location?.package &&
                              record.location
                                ?.version &&
                              " · "}

                            {record.location?.version && (
                              <>
                                Version{" "}
                                <strong>
                                  {
                                    record.location
                                      .version
                                  }
                                </strong>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="evidence-source">
                      <b>{record.type}</b>
                      <span>{record.source}</span>
                    </div>

                    <div className="evidence-control">
                      {(() => {
                        const control =
                          controls.find(
                            (item) =>
                              item.id ===
                              record.controlId
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
                )
              )
            ) : (
              <div className="evidence-table-empty">
                <b>No evidence records found</b>

                <span>
                  Adjust the search or filters to
                  view assessment evidence.
                </span>
              </div>
            )}
          </div>
        </div>

        {filteredEvidenceRecords.length > 0 && (
          <div className="evidence-pagination">
            <div className="evidence-pagination-summary">
              Showing{" "}
              <b>
                {evidencePageStart + 1}
              </b>
              {" – "}
              <b>
                {Math.min(
                  evidencePageStart +
                    EVIDENCE_PER_PAGE,
                  filteredEvidenceRecords.length
                )}
              </b>
              {" of "}
              <b>
                {filteredEvidenceRecords.length}
              </b>
            </div>

            {totalEvidencePages > 1 && (
              <div className="evidence-pagination-controls">
                <button
                  type="button"
                  className="evidence-page-nav"
                  disabled={
                    safeEvidencePage === 1
                  }
                  onClick={() =>
                    setEvidencePage(1)
                  }
                  aria-label="First page"
                >
                  «
                </button>

                <button
                  type="button"
                  className="evidence-page-nav"
                  disabled={
                    safeEvidencePage === 1
                  }
                  onClick={() =>
                    setEvidencePage(
                      Math.max(
                        1,
                        safeEvidencePage - 1
                      )
                    )
                  }
                  aria-label="Previous page"
                >
                  ‹
                </button>

                {evidencePageItems().map(
                  (item, index) =>
                    item === "ellipsis" ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="evidence-page-ellipsis"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`evidence-page-number ${
                          item ===
                          safeEvidencePage
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setEvidencePage(item)
                        }
                      >
                        {item}
                      </button>
                    )
                )}

                <button
                  type="button"
                  className="evidence-page-nav"
                  disabled={
                    safeEvidencePage ===
                    totalEvidencePages
                  }
                  onClick={() =>
                    setEvidencePage(
                      Math.min(
                        totalEvidencePages,
                        safeEvidencePage + 1
                      )
                    )
                  }
                  aria-label="Next page"
                >
                  ›
                </button>

                <button
                  type="button"
                  className="evidence-page-nav"
                  disabled={
                    safeEvidencePage ===
                    totalEvidencePages
                  }
                  onClick={() =>
                    setEvidencePage(
                      totalEvidencePages
                    )
                  }
                  aria-label="Last page"
                >
                  »
                </button>
              </div>
            )}
          </div>
        )}

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
                  closeEvidenceDetail();
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
                      onClick={closeEvidenceDetail}
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
                        <h3>Traceability</h3>
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
                      <div className="evidence-node-head">
                        <small>ASSET</small>
                      </div>
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
                      <div className="evidence-node-head">
                        <small>FINDING</small>
                      </div>
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
                      <div className="evidence-node-head">
                        <small>RISK CONTEXT</small>
                      </div>
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
                      <div className="evidence-node-head">
                        <small>CONTROL</small>
                      </div>
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
                      <div className="evidence-node-head">
                        <small>SECURITY GATE</small>
                      </div>
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
