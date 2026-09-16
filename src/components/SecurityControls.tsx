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
  onGoToFindings: (
    controlId: string,
    assessmentId: string
  ) => void;
  onViewEvidence: (
    controlId: string,
    assessmentId: string
  ) => void;
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

type ControlGroup = {
  key: string;
  representative: ControlIntelligenceRecord;
  records: ControlIntelligenceRecord[];
  linkedFindingCount: number;
  openFindingCount: number;
  closedFindingCount: number;
  highestSeverity: string;
  latestUpdatedAt: string;
  earliestMappedAt: string;
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

  const [severityFilter, setSeverityFilter] =
    useState("All");

  const [
    selectedGroup,
    setSelectedGroup,
  ] = useState<ControlGroup | null>(null);

  const selectedRecord =
    selectedGroup?.representative ?? null;

  function openControlDetail(
    group: ControlGroup
  ) {
    setSelectedGroup(group);

    const url = new URL(window.location.href);

    url.searchParams.set("view", "controls");
    url.searchParams.set(
      "control",
      group.key
    );

    window.history.pushState(
      {
        view: "controls",
        control: group.key,
      },
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  function closeControlDetail() {
    setSelectedGroup(null);

    const url = new URL(window.location.href);

    url.searchParams.delete("control");

    window.history.replaceState(
      {
        ...window.history.state,
        control: null,
      },
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadControls() {
      setLoading(true);

      try {
        const response = await fetch(
          assessment?.id
              ? `/api/controls?assessmentId=${encodeURIComponent(assessment.id)}`
              : "/api/controls",
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
        closeControlDetail();
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

  const groupedControls = useMemo<ControlGroup[]>(() => {
    const severityRank: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const groups = new Map<
      string,
      ControlIntelligenceRecord[]
    >();

    for (const record of scopedRecords) {
      /*
       * The persisted control ID represents a
       * finding-to-control mapping instance.
       *
       * Group by the stable control definition
       * instead of the generated instance ID.
       */
      const key = [
        record.control.domain,
        record.control.name,
        record.control.owner,
        record.control.remediation,
        record.control.requiredEvidence,
      ].join("::");

      const items = groups.get(key) ?? [];

      items.push(record);
      groups.set(key, items);
    }

    return Array.from(groups.entries())
      .map(([key, items]) => {
        const representative =
          items.reduce((best, current) => {
            const bestRank =
              severityRank[
                best.control.severity
              ] ?? 0;

            const currentRank =
              severityRank[
                current.control.severity
              ] ?? 0;

            return currentRank > bestRank
              ? current
              : best;
          });

        const linkedFindingIds = new Set(
          items.map(
            (item) => item.finding.id
          )
        );

        const openFindingIds = new Set(
          items
            .filter(
              (item) =>
                item.findingLifecycle.status ===
                "Open"
            )
            .map(
              (item) => item.finding.id
            )
        );

        const closedFindingIds = new Set(
          items
            .filter(
              (item) =>
                item.findingLifecycle.status ===
                "Closed"
            )
            .map(
              (item) => item.finding.id
            )
        );

        const updatedDates = items
          .map(
            (item) =>
              item.lifecycle.lastUpdatedAt
          )
          .filter(Boolean)
          .sort();

        const mappedDates = items
          .map(
            (item) =>
              item.lifecycle.firstRequiredAt
          )
          .filter(Boolean)
          .sort();

        return {
          key,
          representative,
          records: items,

          linkedFindingCount:
            linkedFindingIds.size,

          openFindingCount:
            openFindingIds.size,

          closedFindingCount:
            closedFindingIds.size,

          highestSeverity:
            representative.control.severity,

          latestUpdatedAt:
            updatedDates.at(-1) ?? "",

          earliestMappedAt:
            mappedDates.at(0) ?? "",
        };
      })
      .sort(
        (a, b) =>
          (severityRank[b.highestSeverity] ?? 0) -
            (severityRank[a.highestSeverity] ?? 0) ||
          b.linkedFindingCount -
            a.linkedFindingCount ||
          a.representative.control.name.localeCompare(
            b.representative.control.name
          )
      );
  }, [scopedRecords]);

  useEffect(() => {
    function syncControlFromUrl() {
      const params =
        new URLSearchParams(
          window.location.search
        );

      const controlKey =
        params.get("control");

      if (!controlKey) {
        setSelectedGroup(null);
        return;
      }

      const matchingGroup =
        groupedControls.find(
          (group) =>
            group.key === controlKey ||
            group.records.some(
              (record) =>
                record.control.id ===
                controlKey
            )
        );

      setSelectedGroup(
        matchingGroup ?? null
      );
    }

    syncControlFromUrl();

    window.addEventListener(
      "popstate",
      syncControlFromUrl
    );

    return () => {
      window.removeEventListener(
        "popstate",
        syncControlFromUrl
      );
    };
  }, [groupedControls]);

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

  const CONTROLS_PER_PAGE = 10;

  const [controlPage, setControlPage] =
    useState(1);

  const filteredGroups = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return groupedControls.filter(
      (group) => {
        const record =
          group.representative;

        const matchesSearch =
          !query ||
          [
            record.control.id,
            record.control.name,
            record.control.domain,
            record.asset.name,
            record.control.owner,

            ...group.records.flatMap(
              (item) => [
                item.finding.id,
                item.finding.title,
              ]
            ),
          ].some((value) =>
            value
              .toLowerCase()
              .includes(query)
          );

        const matchesSeverity =
          severityFilter === "All" ||
          group.highestSeverity ===
            severityFilter;

        return (
          matchesSearch &&
          matchesSeverity
        );
      }
    );
  }, [
    groupedControls,
    search,
    severityFilter,
  ]);

  const totalControlPages = Math.max(
    1,
    Math.ceil(
      filteredGroups.length /
        CONTROLS_PER_PAGE
    )
  );

  const safeControlPage = Math.min(
    controlPage,
    totalControlPages
  );

  const controlPageStart =
    (safeControlPage - 1) *
    CONTROLS_PER_PAGE;

  const paginatedGroups =
    filteredGroups.slice(
      controlPageStart,
      controlPageStart +
        CONTROLS_PER_PAGE
    );

  /*
   * Temporary compatibility aliases.
   * Step 3B will move the JSX to groups
   * and remove these aliases.
   */
  const filteredRecords =
    filteredGroups.map(
      (group) => group.representative
    );

  useEffect(() => {
    setControlPage(1);
  }, [
    search,
    severityFilter,
    selectedFindingId,
  ]);

  const summary = useMemo(
    () => ({
      total: groupedControls.length,

      findingsMapped: new Set(
        scopedRecords.map(
          (record) => record.finding.id
        )
      ).size,

      assetsCovered: new Set(
        scopedRecords.map(
          (record) => record.asset.id
        )
      ).size,

      criticalControls:
        groupedControls.filter(
          (group) =>
            group.highestSeverity ===
            "CRITICAL"
        ).length,
    }),
    [
      groupedControls,
      scopedRecords,
    ]
  );

  return (
    <>
      <header className="page-header controls-v2-header">
        <div>
          <p className="eyebrow">
            SECURITY CONTROL INTELLIGENCE
          </p>

          <h1>Security Controls</h1>

          <p className="page-description">
            Security controls mapped to
            findings, assets, assessment risk,
            and scanner evidence.
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
            onClick={() => {
              const assessmentId =
                assessment?.id;

              if (
                !selectedFindingId ||
                !assessmentId
              ) {
                return;
              }

              const url =
                new URL(
                  window.location.href
                );

              url.searchParams.set(
                "view",
                "findings"
              );
              url.searchParams.delete(
                "control"
              );
              url.searchParams.delete(
                "evidence"
              );
              url.searchParams.set(
                "finding",
                selectedFindingId
              );
              url.searchParams.set(
                "assessment",
                assessmentId
              );

              window.history.pushState(
                {
                  view: "findings",
                  finding:
                    selectedFindingId,
                  assessment:
                    assessmentId,
                },
                "",
                `${url.pathname}${url.search}${url.hash}`
              );

              window.dispatchEvent(
                new PopStateEvent(
                  "popstate"
                )
              );
            }}
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
            Mapped security controls
          </span>
        </article>

        <article>
          <small>Findings mapped</small>
          <b>{summary.findingsMapped}</b>
          <span>
            Control-linked findings
          </span>
        </article>

        <article>
          <small>Assets covered</small>
          <b>{summary.assetsCovered}</b>
          <span>
            Assessment asset coverage
          </span>
        </article>

        <article>
          <small>Critical controls</small>
          <b className="control-danger">
            {summary.criticalControls}
          </b>
          <span>
            Critical-risk coverage
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
              Finding → risk → control
              → evidence → gate decision
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
          <>
          <div className="controls-v2-table-wrap">
            <table className="controls-v2-table">
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Severity</th>
                    <th>Asset</th>
                    <th>Linked Findings</th>
                    <th>Owner</th>
                    <th>Updated</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedGroups.map(
                    (group) => {
                      const record =
                        group.representative;

                      return (
                        <tr
                          key={group.key}
                          onClick={() =>
                            openControlDetail(
                              group
                            )
                          }
                        >
                          <td>
                            <span className="controls-v2-id">
                              {
                                record.control.id
                              }
                            </span>

                            <b>
                              {
                                record.control.name
                              }
                            </b>

                            <small>
                              {
                                record.control.domain
                              }
                            </small>
                          </td>

                          <td>
                            <span
                              className={`badge ${group.highestSeverity.toLowerCase()}`}
                            >
                              {
                                group.highestSeverity
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
                              {
                                group.linkedFindingCount
                              } linked
                            </span>

                            <small>
                              {
                                group.openFindingCount
                              } open
                              {group.closedFindingCount > 0
                                ? ` · ${group.closedFindingCount} closed`
                                : ""}
                            </small>
                          </td>

                          <td>
                            {
                              record.control.owner
                            }
                          </td>

                          <td>
                            {formatDate(
                              group.latestUpdatedAt
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
          </div>

            {totalControlPages > 1 && (
              <div className="control-pagination">
                <div className="control-pagination-summary">
                  Showing{" "}
                  <b>{controlPageStart + 1}</b>
                  {" – "}
                  <b>
                    {Math.min(
                      controlPageStart +
                        CONTROLS_PER_PAGE,
                      filteredRecords.length
                    )}
                  </b>
                  {" of "}
                  <b>{filteredRecords.length}</b>
                </div>

                <div className="control-pagination-controls">
                  <button
                    type="button"
                    className="control-page-nav"
                    aria-label="First page"
                    title="First page"
                    disabled={safeControlPage === 1}
                    onClick={() => setControlPage(1)}
                  >
                    «
                  </button>

                  <button
                    type="button"
                    className="control-page-nav"
                    aria-label="Previous page"
                    title="Previous page"
                    disabled={safeControlPage === 1}
                    onClick={() =>
                      setControlPage(
                        Math.max(1, safeControlPage - 1)
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
                      safeControlPage - 1
                    );

                    const windowEnd = Math.min(
                      totalControlPages - 1,
                      safeControlPage + 1
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
                      if (
                        page !== 1 &&
                        page !== totalControlPages
                      ) {
                        pages.push(page);
                      }
                    }

                    if (
                      windowEnd <
                      totalControlPages - 1
                    ) {
                      pages.push("ellipsis-right");
                    }

                    if (totalControlPages > 1) {
                      pages.push(totalControlPages);
                    }

                    return pages.map((item) => {
                      if (
                        item === "ellipsis-left" ||
                        item === "ellipsis-right"
                      ) {
                        return (
                          <span
                            key={item}
                            className="control-page-ellipsis"
                            aria-hidden="true"
                          >
                            …
                          </span>
                        );
                      }

                      return (
                        <button
                          key={item}
                          type="button"
                          className={`control-page-number ${
                            item === safeControlPage
                              ? "active"
                              : ""
                          }`}
                          onClick={() =>
                            setControlPage(item)
                          }
                          aria-current={
                            item === safeControlPage
                              ? "page"
                              : undefined
                          }
                        >
                          {item}
                        </button>
                      );
                    });
                  })()}

                  <button
                    type="button"
                    className="control-page-nav"
                    aria-label="Next page"
                    title="Next page"
                    disabled={
                      safeControlPage ===
                      totalControlPages
                    }
                    onClick={() =>
                      setControlPage(
                        Math.min(
                          totalControlPages,
                          safeControlPage + 1
                        )
                      )
                    }
                  >
                    ›
                  </button>

                  <button
                    type="button"
                    className="control-page-nav"
                    aria-label="Last page"
                    title="Last page"
                    disabled={
                      safeControlPage ===
                      totalControlPages
                    }
                    onClick={() =>
                      setControlPage(totalControlPages)
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

      {selectedGroup && selectedRecord && (
        <div
          className="controls-v2-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeControlDetail();
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
                onClick={closeControlDetail}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="controls-v2-modal-badges">
              <span
                className={`badge ${selectedGroup.highestSeverity.toLowerCase()}`}
              >
                {selectedGroup.highestSeverity}
              </span>
            </div>

            <div className="controls-v2-modal-grid">
              <section>
                <small>ASSET</small>

                <b>
                  {selectedRecord.asset.name}
                </b>

                <span>
                  {selectedRecord.asset.environment}
                  {" · "}
                  {selectedRecord.asset.criticality}
                </span>
              </section>

              <section>
                <small>OWNER</small>

                <b>
                  {selectedRecord.control.owner}
                </b>
              </section>

              <section>
                <small>LINKED FINDINGS</small>

                <b>
                  {selectedGroup.linkedFindingCount}
                </b>

                <span>
                  Findings mapped to this control
                </span>
              </section>

              <section>
                <small>FINDING COVERAGE</small>

                <b>
                  {selectedGroup.openFindingCount} Open
                  {" · "}
                  {selectedGroup.closedFindingCount} Closed
                </b>

                <span>
                  Scanner-controlled lifecycle
                </span>
              </section>
            </div>

            <section className="controls-v2-detail-section">
              <small>
                CONTROL GUIDANCE
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
                <small>FIRST MAPPED</small>

                <b>
                  {formatDate(
                    selectedGroup.earliestMappedAt
                  )}
                </b>
              </section>

              <section>
                <small>LAST UPDATED</small>

                <b>
                  {formatDate(
                    selectedGroup.latestUpdatedAt
                  )}
                </b>
              </section>

              <section>
                <small>LAST ASSESSED</small>

                <b>
                  {formatDate(
                    selectedRecord.completedAt
                  )}
                </b>
              </section>
            </div>

            <div className="controls-v2-modal-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setSelectedGroup(null);

                  onViewEvidence(
                    selectedRecord.control.id,
                    selectedRecord.assessmentId
                  );
                }}
              >
                View Evidence →
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSelectedGroup(null);

                  onGoToFindings(
                    selectedRecord.control.id,
                    selectedRecord.assessmentId
                  );
                }}
              >
                View Linked Findings →
              </button>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
