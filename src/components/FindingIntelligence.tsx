"use client";

import { getFindings } from "../lib/client/appsecgate-api";


import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AssessmentRun,
  FindingIntelligenceRecord,
  PersistedAssessment,
} from "../data/appsecgate";

type Props = {
  run: AssessmentRun | null;
  assessment: PersistedAssessment | null;
  selectedControlId?: string | null;
  onGoToAssessment: () => void;
  onViewControls: (
    findingId: string,
    assessmentId: string
  ) => void;
  onViewEvidence?: (
    findingId: string,
    assessmentId: string
  ) => void;
};

type FindingsResponse = {
  data: FindingIntelligenceRecord[];
  count: number;
  summary: {
    open: number;
    closed: number;
    critical: number;
    assets: number;
  };
};

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

export default function FindingIntelligence({
  run,
  assessment,
  selectedControlId,
  onGoToAssessment,
  onViewControls,
  onViewEvidence,
}: Props) {
  const [records, setRecords] = useState<
    FindingIntelligenceRecord[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [severity, setSeverity] =
    useState("ALL");

  const [status, setStatus] =
    useState("ALL");

  const [assetId, setAssetId] =
    useState("ALL");

  const [
    selectedRecord,
    setSelectedRecord,
  ] = useState<
    FindingIntelligenceRecord | null
  >(null);

  function openFindingDetail(
    record: FindingIntelligenceRecord
  ) {
    setSelectedRecord(record);

    const url = new URL(window.location.href);
    url.searchParams.set("view", "findings");
    url.searchParams.set(
      "finding",
      record.finding.id
    );

    window.history.pushState(
      {
        view: "findings",
        finding: record.finding.id,
      },
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  function closeFindingDetail() {
    setSelectedRecord(null);

    const url = new URL(window.location.href);

    url.searchParams.set("view", "findings");
    url.searchParams.delete("finding");

    window.history.replaceState(
      { view: "findings" },
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadFindings() {
      setLoading(true);
      setError("");

      try {
        const payload =
          await getFindings(assessment?.id);

        if (!cancelled) {
          setRecords(
            Array.isArray(payload.data)
              ? payload.data
              : []
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load finding intelligence."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFindings();

    return () => {
      cancelled = true;
    };
  }, [assessment?.id]);

  useEffect(() => {
    function syncFindingFromUrl() {
      const params = new URLSearchParams(
        window.location.search
      );

      const findingId = params.get("finding");

      if (!findingId) {
        setSelectedRecord(null);
        return;
      }

      const matchingRecord = records.find(
        (record) =>
          record.finding.id === findingId
      );

      setSelectedRecord(
        matchingRecord ?? null
      );
    }

    syncFindingFromUrl();

    window.addEventListener(
      "popstate",
      syncFindingFromUrl
    );

    return () => {
      window.removeEventListener(
        "popstate",
        syncFindingFromUrl
      );
    };
  }, [records]);

  useEffect(() => {
    if (!selectedRecord) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        closeFindingDetail();
      }
    }

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [selectedRecord]);

  const assets = useMemo(() => {
    const map = new Map<
      number,
      string
    >();

    for (const record of records) {
      map.set(
        record.asset.id,
        record.asset.name
      );
    }

    return Array.from(
      map.entries()
    ).sort((a, b) =>
      a[1].localeCompare(b[1])
    );
  }, [records]);

  const selectedControl =
    useMemo(() => {
      if (!selectedControlId) {
        return null;
      }

      return (
        (assessment?.controls ?? []).find(
          (control) =>
            control.id ===
            selectedControlId
        ) ?? null
      );
    }, [
      assessment,
      selectedControlId,
    ]);

  const selectedControlFindingIds =
    useMemo(() => {
      if (!selectedControl) {
        return selectedControlId
          ? new Set<string>()
          : null;
      }

      const controls =
        assessment?.controls ?? [];

      return new Set(
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
            (control) =>
              control.findingId
          )
          .filter(Boolean)
      );
    }, [
      assessment,
      selectedControl,
      selectedControlId,
    ]);

  const controlScopedRecords =
    useMemo(
      () =>
        selectedControlFindingIds
          ? records.filter((record) =>
              selectedControlFindingIds.has(
                record.finding.id
              )
            )
          : records,
      [
        records,
        selectedControlFindingIds,
      ]
    );

  const filteredRecords =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return records.filter(
        (record) => {
          const finding =
            record.finding;

          const lifecycle =
            record.lifecycle;

          const matchesControl =
            !selectedControlFindingIds ||
            selectedControlFindingIds.has(
              finding.id
            );

          const matchesSearch =
            !query ||
            finding.id
              .toLowerCase()
              .includes(query) ||
            finding.title
              .toLowerCase()
              .includes(query) ||
            finding.source
              .toLowerCase()
              .includes(query) ||
            finding.category
              .toLowerCase()
              .includes(query) ||
            record.asset.name
              .toLowerCase()
              .includes(query);

          const matchesSeverity =
            severity === "ALL" ||
            finding.severity ===
              severity;

          const matchesStatus =
            status === "ALL" ||
            lifecycle.status ===
              status;

          const matchesAsset =
            assetId === "ALL" ||
            String(record.asset.id) ===
              assetId;

          return (
            matchesControl &&
            matchesSearch &&
            matchesSeverity &&
            matchesStatus &&
            matchesAsset
          );
        }
      );
    }, [
      records,
      selectedControlFindingIds,
      search,
      severity,
      status,
      assetId,
    ]);

  const FINDINGS_PER_PAGE = 10;

  const [findingPage, setFindingPage] =
    useState(1);

  const totalFindingPages = Math.max(
    1,
    Math.ceil(
      filteredRecords.length /
        FINDINGS_PER_PAGE
    )
  );

  const safeFindingPage = Math.min(
    findingPage,
    totalFindingPages
  );

  const findingPageStart =
    (safeFindingPage - 1) *
    FINDINGS_PER_PAGE;

  const paginatedRecords =
    filteredRecords.slice(
      findingPageStart,
      findingPageStart +
        FINDINGS_PER_PAGE
    );

  useEffect(() => {
    setFindingPage(1);
  }, [
    search,
    severity,
    status,
    assetId,
  ]);

  const openCount =
    controlScopedRecords.filter(
      (record) =>
        record.lifecycle.status ===
        "Open"
    ).length;

  const closedCount =
    controlScopedRecords.filter(
      (record) =>
        record.lifecycle.status ===
        "Closed"
    ).length;

  const criticalCount =
    controlScopedRecords.filter(
      (record) =>
        record.finding.severity ===
        "CRITICAL"
    ).length;

  if (
    !run &&
    !loading &&
    records.length === 0
  ) {
    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">
              NORMALIZED SECURITY INTELLIGENCE
            </p>

            <h1>
              Finding Intelligence
            </h1>

            <p className="page-description">
              Persistent vulnerability
              intelligence derived from
              normalized scanner evidence.
            </p>
          </div>
        </header>

        <section className="panel empty-assessment">
          <div className="empty-icon">
            ◇
          </div>

          <h2>
            No finding intelligence
            available
          </h2>

          <p className="muted">
            Run an assessment before
            reviewing normalized findings.
          </p>

          <button
            className="primary-button"
            onClick={onGoToAssessment}
          >
            View assessment runs →
          </button>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="page-header findings-page-header">
        <div>
          <p className="eyebrow">
            NORMALIZED SECURITY INTELLIGENCE
          </p>

          <h1>
            Finding Intelligence
          </h1>

          <p className="page-description">
            Persistent vulnerability
            lifecycle across assets,
            assessments, and scanner
            evidence.
          </p>
        </div>

        <div className="findings-run-context">
          <small>
            ASSESSMENT CONTEXT
          </small>

          <b>
            {assessment?.id ?? "—"}
          </b>

          <span>
            {assessment?.asset?.name ?? "—"}
          </span>
        </div>
      </header>

      {selectedControl && (
        <div className="control-scope-banner">
          <small>CONTROL SCOPE</small>
          <b>{selectedControl.name}</b>
          <span>
            {controlScopedRecords.length} linked findings
          </span>
        </div>
      )}

      <section className="finding-kpis">
        <article>
          <small>
            Total findings
          </small>

          <b>{controlScopedRecords.length}</b>

          <span>
            Persistent intelligence
          </span>
        </article>

        <article>
          <small>
            Open
          </small>

          <b className="finding-open-number">
            {openCount}
          </b>

          <span>
            Currently detected
          </span>
        </article>

        <article>
          <small>
            Closed
          </small>

          <b className="finding-closed-number">
            {closedCount}
          </b>

          <span>
            Cleared by scanner evidence
          </span>
        </article>

        <article>
          <small>
            Critical
          </small>

          <b className="finding-critical-number">
            {criticalCount}
          </b>

          <span>
            Highest severity
          </span>
        </article>
      </section>

      <section className="panel finding-table-panel">
        <div className="finding-table-toolbar">
          <div>
            <h3>
              Normalized Findings
            </h3>

            <span className="panel-subtitle">
              Scanner-controlled lifecycle —
              no manual status changes
            </span>
          </div>

          <span className="finding-result-count">
            {filteredRecords.length} of{" "}
            {records.length}
          </span>
        </div>

        <div className="finding-filter-grid">
          <label className="finding-search-field">
            <span>SEARCH</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="ID, finding, scanner, asset..."
            />
          </label>

          <label>
            <span>SEVERITY</span>

            <select
              value={severity}
              onChange={(event) =>
                setSeverity(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All severities
              </option>

              <option value="CRITICAL">
                Critical
              </option>

              <option value="HIGH">
                High
              </option>

              <option value="MEDIUM">
                Medium
              </option>

              <option value="LOW">
                Low
              </option>
            </select>
          </label>

          <label>
            <span>STATUS</span>

            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value
                )
              }
            >
              <option value="ALL">
                All statuses
              </option>

              <option value="Open">
                Open
              </option>

              <option value="Closed">
                Closed
              </option>
            </select>
          </label>


        </div>

        {loading ? (
          <div className="finding-table-state">
            Loading finding intelligence...
          </div>
        ) : error ? (
          <div className="finding-table-state finding-table-error">
            {error}
          </div>
        ) : filteredRecords.length ===
          0 ? (
          <div className="finding-table-state">
            {records.length === 0
              ? "No findings were generated for this assessment."
              : "No findings match the current filters."}
          </div>
        ) : (
          <>
          <div className="finding-table-scroll">
            <table className="finding-intelligence-table">
              <thead>
                <tr>
                  <th>FINDING ID</th>
                  <th>FINDING</th>
                  <th>STATUS</th>
                  <th>SEVERITY</th>
                  <th>ASSET</th>
                  <th>RISK</th>
                  <th>LAST SEEN</th>
                </tr>
              </thead>

              <tbody>
                {paginatedRecords.map(
                  (record) => {
                    const finding =
                      record.finding;

                    const lifecycle =
                      record.lifecycle;

                    return (
                      <tr
                        key={`${record.asset.id}:${finding.id}`}
                        tabIndex={0}
                        role="button"
                        onClick={() =>
                          openFindingDetail(
                            record
                          )
                        }
                        onKeyDown={(
                          event
                        ) => {
                          if (
                            event.key ===
                              "Enter" ||
                            event.key ===
                              " "
                          ) {
                            event.preventDefault();

                            openFindingDetail(
                              record
                            );
                          }
                        }}
                      >
                        <td>
                          <span className="finding-table-id">
                            {finding.id}
                          </span>
                        </td>

                        <td>
                          <div className="finding-table-title">
                            <b>
                              {finding.title}
                            </b>

                            <small>
                              {finding.source}
                            </small>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`finding-lifecycle-badge finding-lifecycle-${lifecycle.status.toLowerCase()}`}
                          >
                            {lifecycle.status}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${finding.severity.toLowerCase()}`}
                          >
                            {finding.severity}
                          </span>
                        </td>

                        <td>
                          <div className="finding-asset-cell">
                            <b>
                              {record.asset.name}
                            </b>

                            <small>
                              {record.asset.environment}
                            </small>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`finding-risk-score risk-${finding.riskLevel.toLowerCase()}`}
                          >
                            {finding.riskScore}
                          </span>
                        </td>

                        <td>
                          <span className="finding-last-seen">
                            {formatDate(
                              lifecycle.lastSeenAt
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                  )}
              </tbody>
            </table>
          </div>

            {totalFindingPages > 1 && (
              <div className="finding-pagination">
                <div className="finding-pagination-summary">
                  Showing{" "}
                  <b>
                    {findingPageStart + 1}
                  </b>
                  {" – "}
                  <b>
                    {Math.min(
                      findingPageStart +
                        FINDINGS_PER_PAGE,
                      filteredRecords.length
                    )}
                  </b>
                  {" of "}
                  <b>
                    {filteredRecords.length}
                  </b>
                </div>

                <div className="finding-pagination-controls">
                  <button
                    type="button"
                    className="finding-page-nav"
                    aria-label="First page"
                    title="First page"
                    disabled={safeFindingPage === 1}
                    onClick={() =>
                      setFindingPage(1)
                    }
                  >
                    «
                  </button>

                  <button
                    type="button"
                    className="finding-page-nav"
                    aria-label="Previous page"
                    title="Previous page"
                    disabled={safeFindingPage === 1}
                    onClick={() =>
                      setFindingPage(
                        Math.max(
                          1,
                          safeFindingPage - 1
                        )
                      )
                    }
                  >
                    ‹
                  </button>

                  {(() => {
                    const pages: Array<
                      number | "ellipsis-left" | "ellipsis-right"
                    > = [];

                    const windowStart = Math.max(
                      2,
                      safeFindingPage - 2
                    );

                    const windowEnd = Math.min(
                      totalFindingPages - 1,
                      safeFindingPage + 2
                    );

                    pages.push(1);

                    if (windowStart > 2) {
                      pages.push("ellipsis-left");
                    }

                    for (
                      let page = windowStart;
                      page <= windowEnd;
                      page += 1
                    ) {
                      pages.push(page);
                    }

                    if (
                      windowEnd <
                      totalFindingPages - 1
                    ) {
                      pages.push("ellipsis-right");
                    }

                    if (totalFindingPages > 1) {
                      pages.push(
                        totalFindingPages
                      );
                    }

                    return pages.map((page) => {
                      if (
                        page === "ellipsis-left" ||
                        page === "ellipsis-right"
                      ) {
                        return (
                          <span
                            key={page}
                            className="finding-page-ellipsis"
                            aria-hidden="true"
                          >
                            …
                          </span>
                        );
                      }

                      return (
                        <button
                          key={page}
                          type="button"
                          className={`finding-page-number ${
                            page ===
                            safeFindingPage
                              ? "active"
                              : ""
                          }`}
                          aria-current={
                            page ===
                            safeFindingPage
                              ? "page"
                              : undefined
                          }
                          onClick={() =>
                            setFindingPage(page)
                          }
                        >
                          {page}
                        </button>
                      );
                    });
                  })()}

                  <button
                    type="button"
                    className="finding-page-nav"
                    aria-label="Next page"
                    title="Next page"
                    disabled={
                      safeFindingPage ===
                      totalFindingPages
                    }
                    onClick={() =>
                      setFindingPage(
                        Math.min(
                          totalFindingPages,
                          safeFindingPage + 1
                        )
                      )
                    }
                  >
                    ›
                  </button>

                  <button
                    type="button"
                    className="finding-page-nav"
                    aria-label="Last page"
                    title="Last page"
                    disabled={
                      safeFindingPage ===
                      totalFindingPages
                    }
                    onClick={() =>
                      setFindingPage(
                        totalFindingPages
                      )
                    }
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {selectedRecord && (
        <div
          className="finding-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeFindingDetail();
            }
          }}
        >
          <section
            className="finding-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finding-detail-title"
          >
            <div className="finding-modal-head">
              <div>
                <p className="eyebrow">
                  FINDING DETAILS
                </p>

                <span className="finding-modal-id">
                  {
                    selectedRecord
                      .finding.id
                  }
                </span>
              </div>

              <button
                type="button"
                className="finding-modal-close"
                aria-label="Close finding details"
                onClick={closeFindingDetail}
              >
                ×
              </button>
            </div>

            <div className="finding-modal-title-row">
              <div>
                <h2 id="finding-detail-title">
                  {
                    selectedRecord
                      .finding.title
                  }
                </h2>

                <span>
                  {
                    selectedRecord
                      .finding.category
                  }
                </span>
              </div>

              <div className="finding-modal-badges">
                <span
                  className={`finding-lifecycle-badge finding-lifecycle-${selectedRecord.lifecycle.status.toLowerCase()}`}
                >
                  {
                    selectedRecord
                      .lifecycle.status
                  }
                </span>

                <span
                  className={`badge ${selectedRecord.finding.severity.toLowerCase()}`}
                >
                  {
                    selectedRecord
                      .finding.severity
                  }
                </span>
              </div>
            </div>

            <div className="finding-modal-metrics">
              <article>
                <small>RISK SCORE</small>

                <b>
                  {
                    selectedRecord
                      .finding.riskScore
                  }
                  /100
                </b>

                <span>
                  {
                    selectedRecord
                      .finding.riskLevel
                  }
                </span>
              </article>

              <article>
                <small>ASSET</small>

                <b>
                  {
                    selectedRecord
                      .asset.name
                  }
                </b>

                <span>
                  {
                    selectedRecord
                      .asset.environment
                  }{" "}
                  ·{" "}
                  {
                    selectedRecord
                      .asset.criticality
                  }
                </span>
              </article>

              <article>
                <small>SOURCE</small>

                <b>
                  {
                    selectedRecord
                      .finding.source
                  }
                </b>

                <span>
                  {
                    selectedRecord
                      .finding.scannerCount
                  }{" "}
                  scanner
                  {selectedRecord.finding
                    .scannerCount === 1
                    ? ""
                    : "s"}
                </span>
              </article>

              <article>
                <small>CONFIDENCE</small>

                <b>
                  {
                    selectedRecord
                      .finding.confidence
                  }
                </b>

                <span>
                  {
                    selectedRecord
                      .finding.status
                  }
                </span>
              </article>
            </div>

            <div className="finding-modal-section">
              <small>DESCRIPTION</small>

              <p>
                {
                  selectedRecord
                    .finding.description
                }
              </p>
            </div>

            <div className="finding-modal-timeline">
              <article>
                <small>FIRST SEEN</small>

                <b>
                  {formatDate(
                    selectedRecord
                      .lifecycle
                      .firstSeenAt
                  )}
                </b>

                <span>
                  {
                    selectedRecord
                      .lifecycle
                      .firstSeenRunId
                  }
                </span>
              </article>

              <article>
                <small>LAST SEEN</small>

                <b>
                  {formatDate(
                    selectedRecord
                      .lifecycle
                      .lastSeenAt
                  )}
                </b>

                <span>
                  {
                    selectedRecord
                      .lifecycle
                      .lastSeenRunId
                  }
                </span>
              </article>

              <article>
                <small>
                  STATUS CHANGED
                </small>

                <b>
                  {formatDate(
                    selectedRecord
                      .lifecycle
                      .statusChangedAt
                  )}
                </b>

                <span>
                  {selectedRecord.lifecycle
                    .reopenedAt
                    ? "Reopened"
                    : selectedRecord.lifecycle
                        .closedAt
                      ? "Closed"
                      : "First detected"}
                </span>
              </article>
            </div>

            <div className="finding-modal-control">
              <div>
                <small>
                  SECURITY CONTROL
                </small>

                <b>
                  {
                    selectedRecord
                      .finding.controlId
                  }
                </b>
              </div>

              {selectedRecord.finding
                .blocker && (
                <span className="blocker-tag">
                  RELEASE BLOCKER
                </span>
              )}
            </div>

            <div className="finding-modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedRecord(null);

                  if (onViewEvidence) {
                    onViewEvidence(
                      selectedRecord.finding.id,
                      selectedRecord.assessmentId
                    );
                  }
                }}
              >
                View Evidence
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  onViewControls(
                    selectedRecord.finding.id,
                    selectedRecord.assessmentId
                  );
                  setSelectedRecord(null);
                }}
              >
                Security Control →
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
