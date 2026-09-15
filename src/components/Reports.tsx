"use client";

import type {
  AssessmentRun,
  PersistedAssessment,
} from "../data/appsecgate";

type ReportsProps = {
  run: AssessmentRun | null;
  assessment: PersistedAssessment | null;
};

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

export default function Reports({
  run,
  assessment,
}: ReportsProps) {
  if (!assessment) {
    return (
      <>
        <header className="page-header reports-page-header">
          <div>
            <p className="eyebrow">
              SECURITY ASSESSMENT REPORT
            </p>
            <h1>Reports</h1>
            <p className="page-description">
              Generate an assessment before reviewing
              security reporting intelligence.
            </p>
          </div>
        </header>

        <section className="panel report-section">
          <p className="muted">
            No persisted assessment is available yet.
          </p>
        </section>
      </>
    );
  }

  const findings = assessment.findings ?? [];
  const controls = assessment.controls ?? [];
  const evidence = assessment.evidence ?? [];
  const scanners =
    assessment.scannerExecutions ?? [];

  const critical = findings.filter(
    (finding) =>
      finding.severity === "CRITICAL"
  ).length;

  const high = findings.filter(
    (finding) =>
      finding.severity === "HIGH"
  ).length;

  const medium = findings.filter(
    (finding) =>
      finding.severity === "MEDIUM"
  ).length;

  const low = findings.filter(
    (finding) =>
      finding.severity === "LOW"
  ).length;

  const completedScanners = scanners.filter(
    (scanner) =>
      scanner.status === "Completed"
  ).length;

  const failedScanners = scanners.filter(
    (scanner) =>
      scanner.status === "Failed"
  ).length;

  const scannerCoverage =
    scanners.length === 0
      ? 0
      : Math.round(
          (completedScanners /
            scanners.length) *
            100
        );

  const evidenceSources = new Set(
    evidence
      .map((record) => record.source)
      .filter(Boolean)
  ).size;

  const evidenceFindings = new Set(
    evidence
      .map((record) => record.findingId)
      .filter(Boolean)
  ).size;

  const mappedFindings = new Set(
    controls
      .map((control) => control.findingId)
      .filter(Boolean)
  ).size;

  const highestRiskScore = findings.reduce(
    (highest, finding) =>
      Math.max(
        highest,
        finding.riskScore ?? 0
      ),
    0
  );

  const averageRiskScore =
    findings.length === 0
      ? 0
      : Math.round(
          findings.reduce(
            (total, finding) =>
              total +
              (finding.riskScore ?? 0),
            0
          ) / findings.length
        );

  const decision =
    assessment.decision ?? run?.decision ?? "INCOMPLETE";

  const decisionClass =
    decision === "PASS"
      ? "decision-pass"
      : decision === "BLOCK"
        ? "decision-block"
        : "decision-incomplete";

  const decisionHeadline =
    decision === "PASS"
      ? "Assessment passed the security gate"
      : decision === "BLOCK"
        ? "Assessment blocked by security policy"
        : "Assessment coverage is incomplete";

  const decisionExplanation =
    decision === "PASS"
      ? "The completed assessment did not identify a condition that triggered the configured security gate."
      : decision === "BLOCK"
        ? `${assessment.blockers.length} policy blocker(s) triggered the configured security gate.`
        : `${failedScanners} scanner execution(s) failed or required assessment coverage was incomplete.`;

  const topFindings = [...findings]
    .sort(
      (a, b) =>
        (b.riskScore ?? 0) -
        (a.riskScore ?? 0)
    )
    .slice(0, 8);

  function generateReport() {
    if (!assessment) {
      return;
    }

    const previousTitle = document.title;

    document.title =
      `AppSecGate-${assessment.asset.name}-${assessment.id}`;

    document.body.classList.add(
      "appsecgate-report-print"
    );

    const cleanup = () => {
      document.body.classList.remove(
        "appsecgate-report-print"
      );

      document.title = previousTitle;

      window.removeEventListener(
        "afterprint",
        cleanup
      );
    };

    window.addEventListener(
      "afterprint",
      cleanup
    );

    window.print();

    window.setTimeout(() => {
      if (
        document.body.classList.contains(
          "appsecgate-report-print"
        )
      ) {
        cleanup();
      }
    }, 1000);
  }

  return (
    <>
      <header className="page-header reports-page-header">
        <div>
          <p className="eyebrow">
            SECURITY ASSESSMENT REPORT
          </p>

          <h1>Assessment Report</h1>

          <p className="page-description">
            Executive risk posture, scanner coverage,
            finding intelligence, mapped security
            controls, evidence assurance, and the final
            security gate decision.
          </p>
        </div>

        <div className="findings-run-context">
          <small>REPORT FOR</small>
          <b>{assessment.id}</b>
          <span>{assessment.asset.name}</span>
        </div>
      </header>

      <section
        className={`report-decision-card ${decisionClass}`}
      >
        <div>
          <p className="eyebrow">
            FINAL SECURITY GATE
          </p>

          <h2>{decision}</h2>

          <p>{decisionHeadline}</p>
        </div>

        <div className="report-score">
          <small>HIGHEST RISK</small>
          <b>{highestRiskScore}/100</b>
          <span>
            Average risk {averageRiskScore}/100
          </span>
        </div>
      </section>

      <section className="report-kpis">
        <article>
          <small>Findings</small>
          <b>{findings.length}</b>
          <span>
            {critical} critical · {high} high
          </span>
        </article>

        <article>
          <small>Scanner coverage</small>
          <b>{scannerCoverage}%</b>
          <span>
            {completedScanners}/{scanners.length} completed
          </span>
        </article>

        <article>
          <small>Mapped controls</small>
          <b>{controls.length}</b>
          <span>
            {mappedFindings} findings covered
          </span>
        </article>

        <article>
          <small>Evidence records</small>
          <b>{evidence.length}</b>
          <span>
            {evidenceSources} scanner sources
          </span>
        </article>
      </section>

      <section className="report-layout">
        <div className="report-main">
          <article className="panel report-section">
            <div className="report-section-heading">
              <span>01</span>

              <div>
                <p className="eyebrow">
                  ASSESSMENT CONTEXT
                </p>
                <h3>Target & execution</h3>
              </div>
            </div>

            <div className="report-detail-grid">
              <span>
                <small>ASSET</small>
                <b>{assessment.asset.name}</b>
              </span>

              <span>
                <small>TYPE</small>
                <b>{assessment.asset.type}</b>
              </span>

              <span>
                <small>ENVIRONMENT</small>
                <b>
                  {assessment.asset.environment}
                </b>
              </span>

              <span>
                <small>CRITICALITY</small>
                <b>
                  {assessment.asset.criticality}
                </b>
              </span>

              <span>
                <small>RAW FINDINGS</small>
                <b>
                  {assessment.rawFindingCount}
                </b>
              </span>

              <span>
                <small>RUN ID</small>
                <b>{assessment.id}</b>
              </span>

              <span>
                <small>STARTED</small>
                <b>
                  {formatDate(
                    assessment.startedAt
                  )}
                </b>
              </span>

              <span>
                <small>COMPLETED</small>
                <b>
                  {formatDate(
                    assessment.completedAt
                  )}
                </b>
              </span>

              <span>
                <small>GATE DECISION</small>
                <b className={decisionClass}>
                  {decision}
                </b>
              </span>
            </div>
          </article>

          <article className="panel report-section">
            <div className="report-section-heading">
              <span>02</span>

              <div>
                <p className="eyebrow">
                  SCANNER COVERAGE
                </p>
                <h3>
                  Security scanner execution
                </h3>
              </div>
            </div>

            <div className="report-progress-row">
              <span>Coverage</span>

              <div className="report-progress">
                <i
                  style={{
                    width: `${scannerCoverage}%`,
                  }}
                />
              </div>

              <b>{scannerCoverage}%</b>
            </div>

            <div className="report-scanner-grid">
              {scanners.map((scanner) => (
                <div
                  key={`${scanner.category}:${scanner.tool}`}
                  className="report-scanner-item"
                >
                  <div>
                    <b>{scanner.tool}</b>
                    <small>
                      {scanner.category}
                    </small>
                  </div>

                  <span
                    className={
                      scanner.status ===
                      "Completed"
                        ? "report-scanner-complete"
                        : "report-scanner-failed"
                    }
                  >
                    {scanner.status}
                  </span>

                  <small>
                    {scanner.findings} finding(s)
                  </small>
                </div>
              ))}

              {scanners.length === 0 && (
                <p className="muted">
                  No scanner executions were
                  recorded.
                </p>
              )}
            </div>
          </article>

          <article className="panel report-section">
            <div className="report-section-heading">
              <span>03</span>

              <div>
                <p className="eyebrow">
                  FINDING INTELLIGENCE
                </p>
                <h3>
                  Risk distribution & priority
                </h3>
              </div>
            </div>

            <div className="report-severity-grid">
              <div>
                <small>CRITICAL</small>
                <b>{critical}</b>
              </div>

              <div>
                <small>HIGH</small>
                <b>{high}</b>
              </div>

              <div>
                <small>MEDIUM</small>
                <b>{medium}</b>
              </div>

              <div>
                <small>LOW</small>
                <b>{low}</b>
              </div>
            </div>

            <div className="report-risk-list">
              {topFindings.map((finding) => (
                <div key={finding.id}>
                  <span
                    className={`report-risk-dot ${finding.severity.toLowerCase()}`}
                  />

                  <b>{finding.title}</b>

                  <small>
                    {finding.severity} · Risk{" "}
                    {finding.riskScore ?? 0}/100
                    {finding.blocker
                      ? " · Gate blocker"
                      : ""}
                  </small>
                </div>
              ))}

              {topFindings.length === 0 && (
                <p className="muted">
                  No normalized findings were
                  recorded.
                </p>
              )}
            </div>
          </article>

          <article className="panel report-section">
            <div className="report-section-heading">
              <span>04</span>

              <div>
                <p className="eyebrow">
                  CONTROL & EVIDENCE ASSURANCE
                </p>
                <h3>
                  Assessment traceability
                </h3>
              </div>
            </div>

            <div className="report-assurance-grid">
              <div>
                <small>MAPPED CONTROLS</small>
                <b>{controls.length}</b>
                <span>
                  {mappedFindings} finding(s)
                  linked
                </span>
              </div>

              <div>
                <small>EVIDENCE RECORDS</small>
                <b>{evidence.length}</b>
                <span>
                  {evidenceFindings} finding(s)
                  covered
                </span>
              </div>

              <div>
                <small>EVIDENCE SOURCES</small>
                <b>{evidenceSources}</b>
                <span>Scanner provenance</span>
              </div>

              <div>
                <small>POLICY BLOCKERS</small>
                <b>
                  {assessment.blockers.length}
                </b>
                <span>
                  Gate-impacting conditions
                </span>
              </div>
            </div>
          </article>
        </div>

        <aside className="panel report-sidebar">
          <p className="eyebrow">
            DECISION EXPLANATION
          </p>

          <h3>{decisionHeadline}</h3>

          <p className="muted">
            {decisionExplanation}
          </p>

          <div className="report-decision-reasons">
            {decision === "BLOCK" &&
              assessment.blockers
                .slice(0, 5)
                .map((blocker, index) => (
                  <span key={blocker}>
                    <b>
                      {String(index + 1).padStart(
                        2,
                        "0"
                      )}
                    </b>
                    {blocker}
                  </span>
                ))}

            {decision === "PASS" && (
              <>
                <span>
                  <b>01</b>
                  Required scanner execution
                  completed without a blocking
                  policy condition.
                </span>

                <span>
                  <b>02</b>
                  Findings were normalized,
                  risk-scored, and evaluated
                  against the security gate.
                </span>

                <span>
                  <b>03</b>
                  Assessment evidence remains
                  traceable to scanner output.
                </span>
              </>
            )}

            {decision === "INCOMPLETE" && (
              <>
                <span>
                  <b>01</b>
                  Required scanner coverage is
                  incomplete.
                </span>

                <span>
                  <b>02</b>
                  {failedScanners} scanner
                  execution(s) reported failure.
                </span>

                <span>
                  <b>03</b>
                  The gate cannot issue a complete
                  security decision from partial
                  coverage.
                </span>
              </>
            )}
          </div>

          <div className="report-required-action">
            <small>ASSESSMENT STATE</small>
            <b>
              {decision === "PASS"
                ? "Security gate passed"
                : decision === "BLOCK"
                  ? "Security gate blocked"
                  : "Coverage incomplete"}
            </b>
          </div>

          <button
            type="button"
            className="run-assessment-button"
            onClick={generateReport}
          >
            Generate Report
          </button>
        </aside>
      </section>

      <section className="report-footer-card">
        <div>
          <p className="eyebrow">
            AUDIT TRACE
          </p>

          <h3>Decision fully traceable</h3>

          <p className="muted">
            The security gate is traceable to
            scanner execution, normalized
            findings, risk context, mapped
            controls, and assessment evidence.
          </p>
        </div>

        <div className="report-trace">
          <span>Assessment</span>
          <b>→</b>
          <span>Scanners</span>
          <b>→</b>
          <span>Findings</span>
          <b>→</b>
          <span>Controls</span>
          <b>→</b>
          <span>Evidence</span>
          <b>→</b>
          <span>{decision}</span>
        </div>
      </section>
    </>
  );
}
