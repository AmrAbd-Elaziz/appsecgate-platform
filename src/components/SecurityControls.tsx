"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  type AssessmentRun,
  type ControlIntelligenceRecord,
  type PersistedAssessment,
} from "../data/appsecgate";

type Props = {
  run: AssessmentRun | null;
  assessment: PersistedAssessment | null;
  onGoToFindings: () => void;
  onViewEvidence: () => void;
  selectedFindingId?: string | null;
};

type ControlsResponse = {
  data: ControlIntelligenceRecord[];
  count: number;
  summary: {
    required: number;
    implemented: number;
    verified: number;
    critical: number;
    assets: number;
  };
};

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export default function SecurityControls({
  run,
  assessment,
  onGoToFindings,
  onViewEvidence,
  selectedFindingId,
}: Props) {
  const [records, setRecords] = useState<
    ControlIntelligenceRecord[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [severityFilter, setSeverityFilter] =
    useState("All");

  const [assetFilter, setAssetFilter] =
    useState("All");

  const [
    selectedRecord,
    setSelectedRecord,
  ] =
    useState<ControlIntelligenceRecord | null>(
      null
    );

  useEffect(() => {
    let cancelled = false;

    async function loadControls() {
      setLoading(true);

      try {
        const response = await fetch(
          "/api/controls",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load controls."
          );
        }

        const payload =
          (await response.json()) as ControlsResponse;

        if (!cancelled) {
          setRecords(payload.data ?? []);
        }
      } catch {
        if (!cancelled) {
          setRecords([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadControls();

    return () => {
      cancelled = true;
    };
  }, [assessment?.id]);

  useEffect(() => {
    if (!selectedRecord) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (event.key === "Escape") {
        setSelectedRecord(null);
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

  const scopedRecords = useMemo(() => {
    if (!selectedFindingId) {
      return records;
    }

    return records.filter(
      (record) =>
        record.finding.id ===
        selectedFindingId
    );
  }, [records, selectedFindingId]);

  const assets = useMemo(
    () =>
      Array.from(
        new Set(
          scopedRecords.map(
            (record) =>
              record.asset.name
          )
        )
      ).sort(),
    [scopedRecords]
  );

  const filteredRecords = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return scopedRecords.filter(
      (record) => {
        const matchesSearch =
          !query ||
          [
            record.control.id,
            record.control.name,
            record.control.domain,
            record.finding.id,
            record.finding.title,
            record.asset.name,
            record.control.owner,
          ].some((value) =>
            value
              .toLowerCase()
              .includes(query)
          );

        const matchesStatus =
          statusFilter === "All" ||
          record.lifecycle.status ===
            statusFilter;

        const matchesSeverity =
          severityFilter === "All" ||
          record.control.severity ===
            severityFilter;

        const matchesAsset =
          assetFilter === "All" ||
          record.asset.name ===
            assetFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesSeverity &&
          matchesAsset
        );
      }
    );
  }, [
    scopedRecords,
    search,
    statusFilter,
    severityFilter,
    assetFilter,
  ]);

  const summary = useMemo(
    () => ({
      total: scopedRecords.length,
      required: scopedRecords.filter(
        (record) =>
          record.lifecycle.status ===
          "Required"
      ).length,
      implemented: scopedRecords.filter(
        (record) =>
          record.lifecycle.status ===
          "Implemented"
      ).length,
      verified: scopedRecords.filter(
        (record) =>
          record.lifecycle.status ===
          "Verified"
      ).length,
    }),
    [scopedRecords]
  );

  return (
    <>
      <header className="page-header controls-v2-header">
        <div>
          <p className="eyebrow">
            REMEDIATION GOVERNANCE
          </p>

          <h1>Security Controls</h1>

          <p className="page-description">
            Persistent remediation controls
            linked to findings, assets,
            scanner verification, and
            assurance evidence.
          </p>
        </div>

        {run && (
          <div className="findings-run-context">
            <small>ASSESSMENT CONTEXT</small>
            <b>{run.id}</b>
            <span>{run.asset.name}</span>
          </div>
        )}
      </header>

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

      <section className="controls-v2-kpis">
        <article>
          <small>Total controls</small>
          <b>{summary.total}</b>
          <span>
            Persistent mapped controls
          </span>
        </article>

        <article>
          <small>Required</small>
          <b className="control-danger">
            {summary.required}
          </b>
          <span>
            Remediation required
          </span>
        </article>

        <article>
          <small>Implemented</small>
          <b>
            {summary.implemented}
          </b>
          <span>
            Awaiting verification
          </span>
        </article>

        <article>
          <small>Verified</small>
          <b className="control-success">
            {summary.verified}
          </b>
          <span>
            Scanner validated
          </span>
        </article>
      </section>

      <section className="panel controls-v2-panel">
        <div className="controls-v2-toolbar">
          <div>
            <h3>
              Control Intelligence
            </h3>
            <span className="panel-subtitle">
              Finding → control → evidence
              → scanner verification
            </span>
          </div>

          <span className="controls-v2-count">
            {filteredRecords.length} shown
          </span>
        </div>

        <div className="controls-v2-filters">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search control, finding, asset, owner..."
            aria-label="Search security controls"
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option>All</option>
            <option>Required</option>
            <option>Implemented</option>
            <option>Verified</option>
          </select>

          <select
            value={severityFilter}
            onChange={(event) =>
              setSeverityFilter(
                event.target.value
              )
            }
          >
            <option>All</option>
            <option>CRITICAL</option>
            <option>HIGH</option>
            <option>MEDIUM</option>
            <option>LOW</option>
          </select>

          <select
            value={assetFilter}
            onChange={(event) =>
              setAssetFilter(
                event.target.value
              )
            }
          >
            <option>All</option>

            {assets.map((asset) => (
              <option
                key={asset}
                value={asset}
              >
                {asset}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="controls-v2-empty">
            Loading control intelligence...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="controls-v2-empty">
            No controls match the current
            scope or filters.
          </div>
        ) : (
          <div className="controls-v2-table-wrap">
            <table className="controls-v2-table">
              <thead>
                <tr>
                  <th>Control</th>
                  <th>Status</th>
                  <th>Severity</th>
                  <th>Asset</th>
                  <th>Finding</th>
                  <th>Owner</th>
                  <th>Updated</th>
                </tr>
              </thead>

              <tbody>
                {filteredRecords.map(
                  (record) => (
                    <tr
                      key={`${record.asset.id}:${record.finding.id}`}
                      onClick={() =>
                        setSelectedRecord(
                          record
                        )
                      }
                    >
                      <td>
                        <span className="controls-v2-id">
                          {
                            record.control
                              .id
                          }
                        </span>

                        <b>
                          {
                            record.control
                              .name
                          }
                        </b>

                        <small>
                          {
                            record.control
                              .domain
                          }
                        </small>
                      </td>

                      <td>
                        <span
                          className={`controls-v2-status ${record.lifecycle.status.toLowerCase()}`}
                        >
                          {
                            record.lifecycle
                              .status
                          }
                        </span>
                      </td>

                      <td>
                        <span
                          className={`badge ${record.control.severity.toLowerCase()}`}
                        >
                          {
                            record.control
                              .severity
                          }
                        </span>
                      </td>

                      <td>
                        <b>
                          {record.asset.name}
                        </b>
                        <small>
                          {
                            record.asset
                              .environment
                          }
                        </small>
                      </td>

                      <td>
                        <span className="controls-v2-finding">
                          {record.finding.id}
                        </span>

                        <small>
                          {
                            record.finding
                              .title
                          }
                        </small>
                      </td>

                      <td>
                        {
                          record.control
                            .owner
                        }
                      </td>

                      <td>
                        {formatDate(
                          record.lifecycle
                            .lastUpdatedAt
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedRecord && (
        <div
          className="controls-v2-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedRecord(null);
            }
          }}
        >
          <article
            className="controls-v2-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Security control details"
          >
            <div className="controls-v2-modal-head">
              <div>
                <span className="controls-v2-id">
                  {
                    selectedRecord.control
                      .id
                  }
                </span>

                <h2>
                  {
                    selectedRecord.control
                      .name
                  }
                </h2>

                <p>
                  {
                    selectedRecord.control
                      .domain
                  }
                </p>
              </div>

              <button
                type="button"
                className="controls-v2-close"
                onClick={() =>
                  setSelectedRecord(null)
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="controls-v2-modal-badges">
              <span
                className={`controls-v2-status ${selectedRecord.lifecycle.status.toLowerCase()}`}
              >
                {
                  selectedRecord.lifecycle
                    .status
                }
              </span>

              <span
                className={`badge ${selectedRecord.control.severity.toLowerCase()}`}
              >
                {
                  selectedRecord.control
                    .severity
                }
              </span>

              <span className="controls-v2-finding-state">
                Finding{" "}
                {
                  selectedRecord
                    .findingLifecycle.status
                }
              </span>
            </div>

            <div className="controls-v2-modal-grid">
              <section>
                <small>ASSET</small>
                <b>
                  {
                    selectedRecord.asset
                      .name
                  }
                </b>
                <span>
                  {
                    selectedRecord.asset
                      .environment
                  }{" "}
                  ·{" "}
                  {
                    selectedRecord.asset
                      .criticality
                  }
                </span>
              </section>

              <section>
                <small>OWNER</small>
                <b>
                  {
                    selectedRecord.control
                      .owner
                  }
                </b>
              </section>

              <section>
                <small>
                  LINKED FINDING
                </small>
                <b>
                  {
                    selectedRecord.finding
                      .id
                  }
                </b>
                <span>
                  {
                    selectedRecord.finding
                      .title
                  }
                </span>
              </section>

              <section>
                <small>
                  FINDING STATUS
                </small>
                <b>
                  {
                    selectedRecord
                      .findingLifecycle.status
                  }
                </b>
              </section>
            </div>

            <section className="controls-v2-detail-section">
              <small>
                REMEDIATION
              </small>
              <p>
                {
                  selectedRecord.control
                    .remediation
                }
              </p>
            </section>

            <section className="controls-v2-detail-section">
              <small>
                REQUIRED EVIDENCE
              </small>
              <p>
                {
                  selectedRecord.control
                    .requiredEvidence
                }
              </p>
            </section>

            <div className="controls-v2-timeline">
              <section>
                <small>
                  FIRST REQUIRED
                </small>
                <b>
                  {formatDate(
                    selectedRecord.lifecycle
                      .firstRequiredAt
                  )}
                </b>
              </section>

              <section>
                <small>
                  STATUS CHANGED
                </small>
                <b>
                  {formatDate(
                    selectedRecord.lifecycle
                      .statusChangedAt
                  )}
                </b>
              </section>

              <section>
                <small>
                  LAST UPDATED
                </small>
                <b>
                  {formatDate(
                    selectedRecord.lifecycle
                      .lastUpdatedAt
                  )}
                </b>
              </section>

              <section>
                <small>
                  VERIFIED AT
                </small>
                <b>
                  {formatDate(
                    selectedRecord.lifecycle
                      .verifiedAt
                  )}
                </b>
              </section>
            </div>

            <div className="controls-v2-modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setSelectedRecord(null);
                  onViewEvidence();
                }}
              >
                View Evidence →
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedRecord(null);
                  onGoToFindings();
                }}
              >
                Finding Intelligence
              </button>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
