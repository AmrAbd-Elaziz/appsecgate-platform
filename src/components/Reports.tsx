"use client";

import { getAssessments } from "../lib/client/appsecgate-api";


import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  AssessmentRun,
  PersistedAssessment,
} from "../data/appsecgate";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

type ReportsProps = {
  run: AssessmentRun | null;
  assessment: PersistedAssessment | null;
};

type ReportType =
  | "executive"
  | "assessment"
  | "technical"
  | "assurance";

type BuilderStep =
  | "type"
  | "scope"
  | "content"
  | "preview";

type ReportSection =
  | "executiveSummary"
  | "gateDecisions"
  | "riskDistribution"
  | "scannerCoverage"
  | "findings"
  | "controls"
  | "evidence"
  | "assessmentHistory";

const reportTypes: Array<{
  id: ReportType;
  eyebrow: string;
  title: string;
  description: string;
}> = [
  {
    id: "executive",
    eyebrow: "LEADERSHIP",
    title: "Executive Security",
    description:
      "Security posture, risk exposure, assessment outcomes, and gate decisions.",
  },
  {
    id: "assessment",
    eyebrow: "ASSESSMENT",
    title: "Assessment",
    description:
      "Detailed scanner coverage, findings, controls, evidence, and assessment decisions.",
  },
  {
    id: "technical",
    eyebrow: "ENGINEERING",
    title: "Technical Findings",
    description:
      "Technical findings, CVEs, affected components, severity, risk, and scanner intelligence.",
  },
  {
    id: "assurance",
    eyebrow: "ASSURANCE",
    title: "Controls & Evidence",
    description:
      "Mapped security controls, evidence coverage, provenance, and decision traceability.",
  },
];

const reportSections: Array<{
  id: ReportSection;
  label: string;
}> = [
  {
    id: "executiveSummary",
    label: "Executive Summary",
  },
  {
    id: "gateDecisions",
    label: "Security Gate Decisions",
  },
  {
    id: "riskDistribution",
    label: "Risk Distribution",
  },
  {
    id: "scannerCoverage",
    label: "Scanner Coverage",
  },
  {
    id: "findings",
    label: "Finding Intelligence",
  },
  {
    id: "controls",
    label: "Security Controls",
  },
  {
    id: "evidence",
    label: "Evidence Assurance",
  },
  {
    id: "assessmentHistory",
    label: "Assessment History",
  },
];

function formatDate(value?: string) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export default function Reports({
  assessment,
}: ReportsProps) {
  const [assessments, setAssessments] = useState<
    PersistedAssessment[]
  >(assessment ? [assessment] : []);

  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] =
    useState(false);

  const [step, setStep] =
    useState<BuilderStep>("type");

  const [reportType, setReportType] =
    useState<ReportType>("assessment");

  const [selectedAssessmentIds, setSelectedAssessmentIds] =
    useState<string[]>(
      assessment ? [assessment.id] : []
    );

  const [sections, setSections] =
    useState<ReportSection[]>(
      reportSections.map((section) => section.id)
    );

  const [reportScopePage, setReportScopePage] =
    useState(1);

  const REPORT_SCOPE_PAGE_SIZE = 10;

  useEffect(() => {
    let active = true;

    async function loadAssessments() {
      try {
        const payload =
          await getAssessments();

        const loaded = Array.isArray(payload.data)
          ? (payload.data as PersistedAssessment[])
          : [];

        loaded.sort(
          (a, b) =>
            new Date(b.completedAt).getTime() -
            new Date(a.completedAt).getTime()
        );

        if (!active) {
          return;
        }

        setAssessments(loaded);

        setSelectedAssessmentIds(
          (current) => {
            if (current.length > 0) {
              return current;
            }

            return loaded[0]
              ? [loaded[0].id]
              : [];
          }
        );
      } catch (error) {
        console.error(error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAssessments();

    return () => {
      active = false;
    };
  }, []);

  const selectedAssessments = useMemo(
    () =>
      assessments.filter((item) =>
        selectedAssessmentIds.includes(item.id)
      ),
    [assessments, selectedAssessmentIds]
  );

  const workspace = useMemo(() => {
    const source =
      selectedAssessments.length > 0
        ? selectedAssessments
        : assessments;

    const findings = source.flatMap(
      (item) => item.findings
    );

    const controls = source.flatMap(
      (item) => item.controls
    );

    const evidence = source.flatMap(
      (item) => item.evidence
    );

    const scanners = source.flatMap(
      (item) => item.scannerExecutions
    );

    const assets = unique(
      source.map((item) => item.asset.id)
    );

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

    const blockers = findings.filter(
      (finding) => finding.blocker
    ).length;

    const completedScanners = scanners.filter(
      (scanner) =>
        scanner.status === "Completed"
    ).length;

    const decisions = {
      PASS: source.filter(
        (item) => item.decision === "PASS"
      ).length,
      BLOCK: source.filter(
        (item) => item.decision === "BLOCK"
      ).length,
      INCOMPLETE: source.filter(
        (item) =>
          item.decision === "INCOMPLETE"
      ).length,
    };

    return {
      assessments: source.length,
      assets: assets.length,
      findings: findings.length,
      controls: controls.length,
      evidence: evidence.length,
      scanners: scanners.length,
      completedScanners,
      critical,
      high,
      medium,
      low,
      blockers,
      decisions,
      highestRisk:
        findings.length > 0
          ? Math.max(
              ...findings.map(
                (finding) =>
                  finding.riskScore ?? 0
              )
            )
          : 0,
    };
  }, [assessments, selectedAssessments]);

  /*
   * Landing-page reporting KPIs
   *
   * Assessment history can contain many historical runs for the
   * same asset. The landing cards represent the CURRENT reporting
   * posture, so only the latest assessment for each unique asset
   * participates in these KPIs.
   *
   * `assessments` is already sorted newest -> oldest.
   */
  /*
   * Landing-page reporting scope.
   *
   * Keep historical assessments available for Report Builder,
   * PDF and Excel exports.
   *
   * The landing dashboard represents the 8 latest unique assets
   * shown in Available report scope.
   */
  const landingAssessments = useMemo(() => {
    const latestByAsset = new Map<
      number,
      PersistedAssessment
    >();

    /*
     * assessments is already sorted newest -> oldest.
     * Keep only the latest assessment for each asset.
     */
    for (const item of assessments) {
      if (!latestByAsset.has(item.asset.id)) {
        latestByAsset.set(
          item.asset.id,
          item
        );
      }
    }

    return Array.from(
      latestByAsset.values()
    );
  }, [assessments]);

  const reportingOverview = useMemo(() => {
    const findings =
      landingAssessments.flatMap(
        (item) => item.findings
      );

    return {
      assessments:
        landingAssessments.length,

      assets:
        new Set(
          landingAssessments.map(
            (item) => item.asset.id
          )
        ).size,

      findings:
        findings.length,
    };
  }, [landingAssessments]);

  const reportScopeTotalPages = Math.max(
    1,
    Math.ceil(
      landingAssessments.length /
        REPORT_SCOPE_PAGE_SIZE
    )
  );

  const paginatedLandingAssessments =
    useMemo(() => {
      const start =
        (reportScopePage - 1) *
        REPORT_SCOPE_PAGE_SIZE;

      return landingAssessments.slice(
        start,
        start + REPORT_SCOPE_PAGE_SIZE
      );
    }, [
      landingAssessments,
      reportScopePage,
    ]);

  useEffect(() => {
    setReportScopePage((current) =>
      Math.min(
        Math.max(current, 1),
        reportScopeTotalPages
      )
    );
  }, [reportScopeTotalPages]);

  const reportScopePageNumbers =
    useMemo(() => {
      const total =
        reportScopeTotalPages;

      if (total <= 5) {
        return Array.from(
          { length: total },
          (_, index) => index + 1
        );
      }

      let start = Math.max(
        1,
        reportScopePage - 2
      );

      let end = Math.min(
        total,
        start + 4
      );

      if (end - start < 4) {
        start = Math.max(
          1,
          end - 4
        );
      }

      return Array.from(
        { length: end - start + 1 },
        (_, index) => start + index
      );
    }, [
      reportScopePage,
      reportScopeTotalPages,
    ]);

  const latest = assessments[0] ?? null;

  function toggleAssessment(id: string) {
    setSelectedAssessmentIds(
      (current) =>
        current.includes(id)
          ? current.filter(
              (item) => item !== id
            )
          : [...current, id]
    );
  }

  function toggleSection(
    section: ReportSection
  ) {
    setSections((current) =>
      current.includes(section)
        ? current.filter(
            (item) => item !== section
          )
        : [...current, section]
    );
  }

  function openBuilder() {
    setBuilderOpen(true);
    setStep("type");
  }

  function closeBuilder() {
    setBuilderOpen(false);
    setStep("type");
  }

  function exportFileName(extension: "pdf" | "xlsx") {
    const label =
      selectedType.title
        .replace(/&/g, "and")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    const date =
      new Date().toISOString().slice(0, 10);

    return `AppSecGate-${label}-${date}.${extension}`;
  }

  function scopedAssessments() {
    return selectedAssessments;
  }

  function sectionEnabled(section: ReportSection) {
    return sections.includes(section);
  }

  function assetName(assetId: number) {
    for (const item of selectedAssessments) {
      if (item.asset.id === assetId) {
        return item.asset.name;
      }
    }

    return `Asset ${assetId}`;
  }

  function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString();
  }

  function exportPdf() {
    const source = scopedAssessments();

    if (source.length === 0) {
      return;
    }

    const findings =
      source.flatMap((item) =>
        item.findings.map((finding) => ({
          ...finding,
          assessmentId: item.id,
          assetName: item.asset.name,
        }))
      );

    const controls =
      source.flatMap((item) =>
        item.controls.map((control) => ({
          ...control,
          assessmentId: item.id,
          assetName: item.asset.name,
        }))
      );

    const evidence =
      source.flatMap((item) =>
        item.evidence.map((record) => ({
          ...record,
          assessmentId: item.id,
          assetName: item.asset.name,
        }))
      );

    const scanners =
      source.flatMap((item) =>
        item.scannerExecutions.map((scanner) => ({
          ...scanner,
          assessmentId: item.id,
          assetName: item.asset.name,
        }))
      );

    const prioritizedFindings =
      [...findings].sort(
        (a, b) =>
          (b.riskScore ?? 0) -
          (a.riskScore ?? 0)
      );

    const uniqueScannerTools =
      new Set(
        scanners.map((scanner) => scanner.tool)
      ).size;

    const completedScanners =
      scanners.filter(
        (scanner) =>
          scanner.status === "Completed"
      ).length;

    const verifiedEvidence =
      evidence.filter(
        (record) =>
          record.status === "Verified"
      ).length;

    const pendingEvidence =
      evidence.filter(
        (record) =>
          record.status === "Pending Review"
      ).length;

    const requiredControls =
      controls.filter(
        (control) =>
          control.status === "Required"
      ).length;

    const inProgressControls =
      controls.filter(
        (control) =>
          control.status === "In Progress"
      ).length;

    const implementedControls =
      controls.filter(
        (control) =>
          control.status === "Implemented"
      ).length;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    const margin = 14;
    const contentWidth =
      pageWidth - margin * 2;

    let y = 18;

    function addPage() {
      pdf.addPage();
      y = 18;
    }

    function ensureSpace(required = 20) {
      if (y + required > pageHeight - 18) {
        addPage();
      }
    }

    function title(
      value: string,
      subtitle?: string
    ) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(21);
      pdf.text(value, margin, y);

      y += 8;

      if (subtitle) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);

        const lines =
          pdf.splitTextToSize(
            subtitle,
            contentWidth
          );

        pdf.text(lines, margin, y);

        y += lines.length * 4.2 + 4;
      }
    }

    function heading(value: string) {
      ensureSpace(15);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text(value, margin, y);

      y += 7;
    }

    function paragraph(value: string) {
      ensureSpace(16);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);

      const lines =
        pdf.splitTextToSize(
          value,
          contentWidth
        );

      pdf.text(lines, margin, y);

      y += lines.length * 4.3 + 4;
    }

    function table(
      head: string[][],
      body: Array<Array<string | number>>,
      options?: {
        fontSize?: number;
        widths?: Record<number, number>;
      }
    ) {
      if (body.length === 0) {
        paragraph("No records in the selected scope.");
        return;
      }

      ensureSpace(24);

      autoTable(pdf, {
        startY: y,
        head,
        body,
        margin: {
          left: margin,
          right: margin,
          bottom: 18,
        },
        styles: {
          font: "helvetica",
          fontSize:
            options?.fontSize ?? 7.5,
          cellPadding: 2,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: {
          fontStyle: "bold",
        },
        columnStyles:
          options?.widths
            ? Object.fromEntries(
                Object.entries(
                  options.widths
                ).map(
                  ([key, cellWidth]) => [
                    key,
                    { cellWidth },
                  ]
                )
              )
            : undefined,
      });

      const finalY =
        (
          pdf as jsPDF & {
            lastAutoTable?: {
              finalY: number;
            };
          }
        ).lastAutoTable?.finalY ?? y;

      y = finalY + 8;
    }

    function metricTable(
      rows: Array<
        [string, string | number]
      >
    ) {
      table(
        [["Metric", "Value"]],
        rows
      );
    }

    function addReportHeader(
      reportTitle: string,
      description: string
    ) {
      title(
        reportTitle,
        description
      );

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      pdf.text(
        `Generated: ${new Date().toLocaleString()}`,
        margin,
        y
      );

      y += 4.5;

      pdf.text(
        `Scope: ${source.length} assessment${
          source.length === 1 ? "" : "s"
        } across ${workspace.assets} asset${
          workspace.assets === 1 ? "" : "s"
        }`,
        margin,
        y
      );

      y += 9;
    }

    function addGateDecision() {
      heading("Security Gate Decision");

      table(
        [["Decision", "Assessments"]],
        [
          ["PASS", workspace.decisions.PASS],
          ["BLOCK", workspace.decisions.BLOCK],
          [
            "INCOMPLETE",
            workspace.decisions.INCOMPLETE,
          ],
        ]
      );
    }

    function addRiskDistribution() {
      heading("Risk Distribution");

      table(
        [["Severity", "Findings"]],
        [
          ["Critical", workspace.critical],
          ["High", workspace.high],
          ["Medium", workspace.medium],
          ["Low", workspace.low],
        ]
      );
    }

    function addScannerSummary() {
      heading("Scanner Coverage");

      table(
        [
          [
            "Asset",
            "Category",
            "Scanner",
            "Status",
            "Findings",
          ],
        ],
        scanners.map((scanner) => [
          scanner.assetName,
          scanner.category,
          scanner.tool,
          scanner.status,
          scanner.findings,
        ])
      );
    }

    function addAssessmentOutcomes() {
      heading("Assessment Outcomes");

      table(
        [
          [
            "Assessment",
            "Asset",
            "Environment",
            "Decision",
            "Findings",
          ],
        ],
        source.map((item) => [
          item.id,
          item.asset.name,
          item.asset.environment,
          item.decision,
          item.findings.length,
        ])
      );
    }

    function addFindingTable(
      limit: number
    ) {
      const rows =
        prioritizedFindings.slice(0, limit);

      table(
        [
          [
            "Finding",
            "Severity",
            "Risk",
            "Scanner",
            "Blocker",
          ],
        ],
        rows.map((finding) => [
          finding.title,
          finding.severity,
          `${finding.riskScore}/100`,
          finding.source,
          finding.blocker ? "Yes" : "No",
        ]),
        {
          fontSize: 7,
          widths: {
            0: 94,
            1: 22,
            2: 19,
            3: 35,
            4: 17,
          },
        }
      );
    }

    /*
     * EXECUTIVE SECURITY
     * Concise leadership report.
     * Full technical data intentionally stays in Excel.
     */
    if (reportType === "executive") {
      addReportHeader(
        "Executive Security Report",
        "Leadership-level security posture, risk exposure, assessment outcomes, and security gate decisions."
      );

      heading("Executive Summary");

      paragraph(
        `${workspace.findings} security findings were analyzed across ` +
          `${workspace.assets} asset${
            workspace.assets === 1 ? "" : "s"
          }. The selected scope contains ` +
          `${workspace.critical} critical and ${workspace.high} high severity findings. ` +
          `${workspace.blockers} findings currently influence policy blocking. ` +
          `The highest contextual risk score is ${workspace.highestRisk}/100.`
      );

      metricTable([
        ["Assessments", workspace.assessments],
        ["Assets", workspace.assets],
        ["Findings Analyzed", workspace.findings],
        [
          "Critical + High",
          workspace.critical + workspace.high,
        ],
        ["Policy Blockers", workspace.blockers],
        [
          "Highest Contextual Risk",
          `${workspace.highestRisk}/100`,
        ],
      ]);

      addGateDecision();
      addRiskDistribution();
      addScannerSummary();

      heading("Highest-Risk Findings");
      paragraph(
        "The following findings represent the highest contextual risk within the selected assessment scope."
      );
      addFindingTable(10);

      addAssessmentOutcomes();

      heading("Reporting Note");
      paragraph(
        "This executive report intentionally summarizes security posture and decision-driving risk. The complete findings, controls, scanner, and evidence datasets are available through the Excel export."
      );
    }

    /*
     * ASSESSMENT REPORT
     * Detailed assessment summary without dumping
     * hundreds of raw records.
     */
    if (reportType === "assessment") {
      addReportHeader(
        "Assessment Report",
        "Assessment-level security analysis covering asset context, scanner coverage, risk distribution, findings, controls, evidence, and gate outcome."
      );

      heading("Assessment Summary");

      metricTable([
        ["Assessments", workspace.assessments],
        ["Assets", workspace.assets],
        ["Findings", workspace.findings],
        ["Critical", workspace.critical],
        ["High", workspace.high],
        ["Medium", workspace.medium],
        ["Low", workspace.low],
        ["Policy Blockers", workspace.blockers],
        ["Security Controls", workspace.controls],
        ["Evidence Records", workspace.evidence],
        [
          "Highest Contextual Risk",
          `${workspace.highestRisk}/100`,
        ],
      ]);

      heading("Asset Context");

      table(
        [
          [
            "Asset",
            "Type",
            "Environment",
            "Criticality",
            "Decision",
          ],
        ],
        source.map((item) => [
          item.asset.name,
          item.asset.type,
          item.asset.environment,
          item.asset.criticality,
          item.decision,
        ])
      );

      addGateDecision();
      addScannerSummary();
      addRiskDistribution();

      heading("Prioritized Findings");
      paragraph(
        "The report highlights the 25 highest-risk findings. The complete finding dataset is retained in the Excel export."
      );
      addFindingTable(25);

      heading("Controls & Evidence Coverage");

      metricTable([
        ["Mapped Controls", controls.length],
        ["Required Controls", requiredControls],
        [
          "Controls In Progress",
          inProgressControls,
        ],
        [
          "Implemented Controls",
          implementedControls,
        ],
        ["Evidence Records", evidence.length],
        ["Verified Evidence", verifiedEvidence],
        ["Pending Review", pendingEvidence],
      ]);

      addAssessmentOutcomes();

      heading("Reporting Note");
      paragraph(
        "This PDF is designed as an assessment decision document rather than a raw data dump. Full findings, scanner results, controls, and evidence records are available in the corresponding Excel export."
      );
    }

    /*
     * TECHNICAL FINDINGS
     * Prioritized engineering report.
     */
    if (reportType === "technical") {
      addReportHeader(
        "Technical Findings Report",
        "Engineering-focused report of prioritized security findings, contextual risk, scanner intelligence, and policy blockers."
      );

      heading("Technical Summary");

      metricTable([
        ["Total Findings", workspace.findings],
        ["Critical", workspace.critical],
        ["High", workspace.high],
        ["Medium", workspace.medium],
        ["Low", workspace.low],
        ["Policy Blockers", workspace.blockers],
        ["Scanner Tools", uniqueScannerTools],
        [
          "Completed Scanner Executions",
          completedScanners,
        ],
        [
          "Highest Contextual Risk",
          `${workspace.highestRisk}/100`,
        ],
      ]);

      addRiskDistribution();
      addScannerSummary();

      heading("Prioritized Finding Register");

      paragraph(
        `The PDF contains the top ${Math.min(
          50,
          prioritizedFindings.length
        )} findings ordered by contextual risk. ` +
          `The complete ${workspace.findings}-finding dataset is available in the Excel export for filtering and analysis.`
      );

      addFindingTable(50);

      heading("Technical Reporting Note");

      paragraph(
        "Finding prioritization is based on the contextual risk score produced by AppSecGate. The Excel export remains the authoritative full tabular dataset for engineering analysis."
      );
    }

    /*
     * CONTROLS & EVIDENCE
     * Assurance report.
     */
    if (reportType === "assurance") {
      addReportHeader(
        "Controls & Evidence Report",
        "Security assurance view of mapped controls, evidence coverage, provenance, and decision traceability."
      );

      heading("Assurance Summary");

      metricTable([
        ["Mapped Controls", controls.length],
        ["Required", requiredControls],
        ["In Progress", inProgressControls],
        ["Implemented", implementedControls],
        ["Evidence Records", evidence.length],
        ["Verified Evidence", verifiedEvidence],
        ["Pending Review", pendingEvidence],
        ["Assets", workspace.assets],
      ]);

      heading("Control Status");

      table(
        [["Status", "Controls"]],
        [
          ["Required", requiredControls],
          ["In Progress", inProgressControls],
          ["Implemented", implementedControls],
        ]
      );

      heading("Evidence Assurance");

      table(
        [["Evidence Status", "Records"]],
        [
          ["Verified", verifiedEvidence],
          ["Pending Review", pendingEvidence],
        ]
      );

      heading("Control Domains");

      const domainCounts =
        controls.reduce<Record<string, number>>(
          (result, control) => {
            result[control.domain] =
              (result[control.domain] ?? 0) + 1;

            return result;
          },
          {}
        );

      table(
        [["Control Domain", "Mapped Controls"]],
        Object.entries(domainCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([domain, count]) => [
            domain,
            count,
          ])
      );

      heading("Evidence Sources");

      const evidenceSources =
        evidence.reduce<Record<string, number>>(
          (result, record) => {
            result[record.source] =
              (result[record.source] ?? 0) + 1;

            return result;
          },
          {}
        );

      table(
        [["Evidence Source", "Records"]],
        Object.entries(evidenceSources)
          .sort((a, b) => b[1] - a[1])
          .map(([sourceName, count]) => [
            sourceName,
            count,
          ])
      );

      addGateDecision();
      addAssessmentOutcomes();

      heading("Assurance Reporting Note");

      paragraph(
        "This report summarizes control and evidence assurance without reproducing the complete record inventory. Full control and evidence traceability remains available in the Excel export."
      );
    }

    /*
     * Add one footer per physical PDF page.
     * This is deliberately done after all tables/pages
     * have been generated to avoid duplicate footers.
     */
    const totalPages =
      pdf.getNumberOfPages();

    for (
      let pageNumber = 1;
      pageNumber <= totalPages;
      pageNumber += 1
    ) {
      pdf.setPage(pageNumber);

      pdf.setFont(
        "helvetica",
        "normal"
      );

      pdf.setFontSize(7);

      pdf.text(
        "AppSecGate Security Reporting",
        margin,
        pageHeight - 7
      );

      pdf.text(
        `Page ${pageNumber} of ${totalPages}`,
        pageWidth - margin,
        pageHeight - 7,
        {
          align: "right",
        }
      );
    }

    pdf.save(
      exportFileName("pdf")
    );
  }

  async function exportExcel() {
    const source = scopedAssessments();

    if (source.length === 0) {
      return;
    }

    const findings =
      source.flatMap((item) =>
        item.findings.map((finding) => ({
          ...finding,
          assessmentId: item.id,
          assetName: item.asset.name,
        }))
      );

    const controls =
      source.flatMap((item) =>
        item.controls.map((control) => ({
          ...control,
          assessmentId: item.id,
          assetName: item.asset.name,
        }))
      );

    const evidence =
      source.flatMap((item) =>
        item.evidence.map((record) => ({
          ...record,
          assessmentId: item.id,
          assetName: item.asset.name,
        }))
      );

    const scanners =
      source.flatMap((item) =>
        item.scannerExecutions.map((scanner) => ({
          ...scanner,
          assessmentId: item.id,
          assetName: item.asset.name,
        }))
      );

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator = "AppSecGate";
    workbook.company = "AppSecGate";
    workbook.subject =
      `${selectedType.title} Security Report`;
    workbook.title =
      `${selectedType.title} Report`;
    workbook.created = new Date();
    workbook.modified = new Date();

    const reportTitle =
      `${selectedType.title} Report`;

    const generatedAt =
      new Date().toLocaleString();

    const scopeLabel =
      `${source.length} assessment${
        source.length === 1 ? "" : "s"
      } / ${workspace.assets} asset${
        workspace.assets === 1 ? "" : "s"
      }`;

    const thinBorder = {
      top: {
        style: "thin" as const,
        color: { argb: "FFD7DEE8" },
      },
      left: {
        style: "thin" as const,
        color: { argb: "FFD7DEE8" },
      },
      bottom: {
        style: "thin" as const,
        color: { argb: "FFD7DEE8" },
      },
      right: {
        style: "thin" as const,
        color: { argb: "FFD7DEE8" },
      },
    };

    function safeSheetName(value: string) {
      return value
        .replace(/[\\/*?:[\]]/g, "-")
        .slice(0, 31);
    }

    function addReportHeader(
      sheet: ExcelJS.Worksheet,
      title: string,
      subtitle: string,
      columnCount: number
    ) {
      const lastColumn =
        Math.max(columnCount, 2);

      sheet.mergeCells(
        1,
        1,
        1,
        lastColumn
      );

      const titleCell =
        sheet.getCell(1, 1);

      titleCell.value = title;
      titleCell.font = {
        bold: true,
        size: 20,
        color: {
          argb: "FFFFFFFF",
        },
      };

      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FF111827",
        },
      };

      titleCell.alignment = {
        vertical: "middle",
      };

      sheet.getRow(1).height = 34;

      sheet.mergeCells(
        2,
        1,
        2,
        lastColumn
      );

      const subtitleCell =
        sheet.getCell(2, 1);

      subtitleCell.value = subtitle;
      subtitleCell.font = {
        italic: true,
        size: 10,
        color: {
          argb: "FF475569",
        },
      };

      subtitleCell.alignment = {
        wrapText: true,
        vertical: "middle",
      };

      sheet.getRow(2).height = 28;

      sheet.getCell(3, 1).value =
        "Generated";
      sheet.getCell(3, 2).value =
        generatedAt;

      sheet.getCell(4, 1).value =
        "Scope";
      sheet.getCell(4, 2).value =
        scopeLabel;

      sheet.getCell(5, 1).value =
        "Report Type";
      sheet.getCell(5, 2).value =
        selectedType.title;

      for (let row = 3; row <= 5; row += 1) {
        sheet.getCell(row, 1).font = {
          bold: true,
          color: {
            argb: "FF475569",
          },
        };
      }

      sheet.getRow(6).height = 8;
    }

    function styleTableHeader(
      row: ExcelJS.Row
    ) {
      row.height = 24;

      row.eachCell((cell) => {
        cell.font = {
          bold: true,
          color: {
            argb: "FFFFFFFF",
          },
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: "FF1E293B",
          },
        };

        cell.alignment = {
          vertical: "middle",
          wrapText: true,
        };

        cell.border = thinBorder;
      });
    }

    function styleDataRows(
      sheet: ExcelJS.Worksheet,
      startRow: number,
      endRow: number
    ) {
      for (
        let rowNumber = startRow;
        rowNumber <= endRow;
        rowNumber += 1
      ) {
        const row =
          sheet.getRow(rowNumber);

        row.alignment = {
          vertical: "top",
          wrapText: true,
        };

        row.eachCell((cell) => {
          cell.border = thinBorder;
        });
      }
    }

    function severityFill(
      severity: string
    ) {
      switch (severity.toUpperCase()) {
        case "CRITICAL":
          return "FFFEE2E2";
        case "HIGH":
          return "FFFFEDD5";
        case "MEDIUM":
          return "FFFEF3C7";
        case "LOW":
          return "FFDCFCE7";
        default:
          return "FFFFFFFF";
      }
    }

    function decisionFill(
      decision: string
    ) {
      switch (decision.toUpperCase()) {
        case "BLOCK":
          return "FFFEE2E2";
        case "PASS":
          return "FFDCFCE7";
        case "INCOMPLETE":
          return "FFFEF3C7";
        default:
          return "FFFFFFFF";
      }
    }

    function applySeverityStyle(
      cell: ExcelJS.Cell
    ) {
      const value =
        String(cell.value ?? "");

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: severityFill(value),
        },
      };

      cell.font = {
        bold: true,
      };
    }

    function applyDecisionStyle(
      cell: ExcelJS.Cell
    ) {
      const value =
        String(cell.value ?? "");

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: decisionFill(value),
        },
      };

      cell.font = {
        bold: true,
      };
    }

    function createDataSheet(
      name: string,
      subtitle: string,
      columns: Array<{
        header: string;
        key: string;
        width: number;
      }>,
      rows: Array<
        Record<
          string,
          string | number | boolean
        >
      >
    ) {
      const sheet =
        workbook.addWorksheet(
          safeSheetName(name)
        );

      addReportHeader(
        sheet,
        reportTitle,
        subtitle,
        columns.length
      );

      const headerRowNumber = 7;

      columns.forEach(
        (column, index) => {
          const cell =
            sheet.getCell(
              headerRowNumber,
              index + 1
            );

          cell.value = column.header;

          sheet.getColumn(
            index + 1
          ).width = column.width;
        }
      );

      styleTableHeader(
        sheet.getRow(headerRowNumber)
      );

      rows.forEach((record) => {
        const values =
          columns.map(
            (column) =>
              record[column.key] ?? ""
          );

        sheet.addRow(values);
      });

      const lastRow =
        sheet.rowCount;

      if (lastRow >= 8) {
        styleDataRows(
          sheet,
          8,
          lastRow
        );

        sheet.autoFilter = {
          from: {
            row: headerRowNumber,
            column: 1,
          },
          to: {
            row: headerRowNumber,
            column: columns.length,
          },
        };
      }

      sheet.views = [
        {
          state: "frozen",
          ySplit: headerRowNumber,
        },
      ];

      sheet.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.25,
          right: 0.25,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2,
        },
      };

      return {
        sheet,
        headerRowNumber,
      };
    }

    function createSummarySheet(
      name: string,
      subtitle: string,
      metrics: Array<
        [string, string | number]
      >
    ) {
      const sheet =
        workbook.addWorksheet(
          safeSheetName(name)
        );

      addReportHeader(
        sheet,
        reportTitle,
        subtitle,
        4
      );

      sheet.getColumn(1).width = 30;
      sheet.getColumn(2).width = 24;
      sheet.getColumn(3).width = 4;
      sheet.getColumn(4).width = 30;

      const headerRow =
        sheet.getRow(7);

      headerRow.getCell(1).value =
        "Security Metric";
      headerRow.getCell(2).value =
        "Value";

      styleTableHeader(headerRow);

      metrics.forEach(
        ([metric, value]) => {
          const row =
            sheet.addRow([
              metric,
              value,
            ]);

          row.getCell(1).font = {
            bold: true,
          };

          row.getCell(1).border =
            thinBorder;
          row.getCell(2).border =
            thinBorder;

          row.getCell(1).alignment = {
            vertical: "middle",
          };

          row.getCell(2).alignment = {
            vertical: "middle",
          };
        }
      );

      sheet.views = [
        {
          state: "frozen",
          ySplit: 7,
        },
      ];

      return sheet;
    }

    function addRiskDistribution(
      sheet: ExcelJS.Worksheet,
      startRow: number
    ) {
      sheet.getCell(
        startRow,
        1
      ).value = "Risk Distribution";

      sheet.getCell(
        startRow,
        1
      ).font = {
        bold: true,
        size: 13,
      };

      const header =
        sheet.getRow(startRow + 1);

      header.getCell(1).value =
        "Severity";
      header.getCell(2).value =
        "Findings";

      styleTableHeader(header);

      const riskRows = [
        ["Critical", workspace.critical],
        ["High", workspace.high],
        ["Medium", workspace.medium],
        ["Low", workspace.low],
      ] as Array<[string, number]>;

      riskRows.forEach(
        ([severity, count], index) => {
          const row =
            sheet.getRow(
              startRow + 2 + index
            );

          row.getCell(1).value =
            severity;
          row.getCell(2).value =
            count;

          row.getCell(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb:
                severityFill(severity),
            },
          };

          row.getCell(1).font = {
            bold: true,
          };

          row.getCell(1).border =
            thinBorder;
          row.getCell(2).border =
            thinBorder;
        }
      );
    }

    function addDecisionDistribution(
      sheet: ExcelJS.Worksheet,
      startRow: number
    ) {
      sheet.getCell(
        startRow,
        1
      ).value = "Security Gate Decisions";

      sheet.getCell(
        startRow,
        1
      ).font = {
        bold: true,
        size: 13,
      };

      const header =
        sheet.getRow(startRow + 1);

      header.getCell(1).value =
        "Decision";
      header.getCell(2).value =
        "Assessments";

      styleTableHeader(header);

      const rows = [
        ["PASS", workspace.decisions.PASS],
        ["BLOCK", workspace.decisions.BLOCK],
        [
          "INCOMPLETE",
          workspace.decisions.INCOMPLETE,
        ],
      ] as Array<[string, number]>;

      rows.forEach(
        ([decision, count], index) => {
          const row =
            sheet.getRow(
              startRow + 2 + index
            );

          row.getCell(1).value =
            decision;
          row.getCell(2).value =
            count;

          applyDecisionStyle(
            row.getCell(1)
          );

          row.getCell(1).border =
            thinBorder;
          row.getCell(2).border =
            thinBorder;
        }
      );
    }

    function addAssessmentSheet() {
      const result =
        createDataSheet(
          "Assessment Outcomes",
          "Assessment scope, asset context, findings volume, and final security gate decision.",
          [
            {
              header: "Assessment ID",
              key: "id",
              width: 30,
            },
            {
              header: "Asset",
              key: "asset",
              width: 30,
            },
            {
              header: "Type",
              key: "type",
              width: 22,
            },
            {
              header: "Environment",
              key: "environment",
              width: 18,
            },
            {
              header: "Criticality",
              key: "criticality",
              width: 16,
            },
            {
              header: "Decision",
              key: "decision",
              width: 16,
            },
            {
              header: "Findings",
              key: "findings",
              width: 14,
            },
            {
              header: "Completed",
              key: "completed",
              width: 24,
            },
          ],
          source.map((item) => ({
            id: item.id,
            asset: item.asset.name,
            type: item.asset.type,
            environment:
              item.asset.environment,
            criticality:
              item.asset.criticality,
            decision: item.decision,
            findings:
              item.findings.length,
            completed:
              formatDate(
                item.completedAt
              ),
          }))
        );

      const decisionColumn = 6;

      for (
        let row = 8;
        row <= result.sheet.rowCount;
        row += 1
      ) {
        applyDecisionStyle(
          result.sheet.getCell(
            row,
            decisionColumn
          )
        );
      }
    }

    function addScannerSheet() {
      const result =
        createDataSheet(
          "Scanner Coverage",
          "Scanner execution coverage and finding contribution across the selected assessment scope.",
          [
            {
              header: "Assessment ID",
              key: "assessment",
              width: 30,
            },
            {
              header: "Asset",
              key: "asset",
              width: 30,
            },
            {
              header: "Category",
              key: "category",
              width: 18,
            },
            {
              header: "Scanner",
              key: "scanner",
              width: 24,
            },
            {
              header: "Status",
              key: "status",
              width: 18,
            },
            {
              header: "Findings",
              key: "findings",
              width: 14,
            },
          ],
          scanners.map((scanner) => ({
            assessment:
              scanner.assessmentId,
            asset: scanner.assetName,
            category: scanner.category,
            scanner: scanner.tool,
            status: scanner.status,
            findings: scanner.findings,
          }))
        );

      for (
        let row = 8;
        row <= result.sheet.rowCount;
        row += 1
      ) {
        const statusCell =
          result.sheet.getCell(row, 5);

        const status =
          String(
            statusCell.value ?? ""
          );

        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              status === "Completed"
                ? "FFDCFCE7"
                : "FFFEE2E2",
          },
        };

        statusCell.font = {
          bold: true,
        };
      }
    }

    function addFindingsSheet() {
      const result =
        createDataSheet(
          "Findings",
          `Full finding intelligence dataset for the selected scope (${findings.length} records).`,
          [
            {
              header: "Assessment ID",
              key: "assessment",
              width: 30,
            },
            {
              header: "Asset",
              key: "asset",
              width: 30,
            },
            {
              header: "Finding ID",
              key: "id",
              width: 38,
            },
            {
              header: "Title",
              key: "title",
              width: 62,
            },
            {
              header: "Category",
              key: "category",
              width: 22,
            },
            {
              header: "Severity",
              key: "severity",
              width: 14,
            },
            {
              header: "Risk Score",
              key: "riskScore",
              width: 14,
            },
            {
              header: "Risk Level",
              key: "riskLevel",
              width: 14,
            },
            {
              header: "Confidence",
              key: "confidence",
              width: 14,
            },
            {
              header: "Scanner",
              key: "scanner",
              width: 24,
            },
            {
              header: "Blocker",
              key: "blocker",
              width: 12,
            },
          ],
          findings
            .slice()
            .sort(
              (a, b) =>
                b.riskScore -
                a.riskScore
            )
            .map((finding) => ({
              assessment:
                finding.assessmentId,
              asset:
                finding.assetName,
              id: finding.id,
              title: finding.title,
              category:
                finding.category,
              severity:
                finding.severity,
              riskScore:
                finding.riskScore,
              riskLevel:
                finding.riskLevel,
              confidence:
                finding.confidence,
              scanner:
                finding.source,
              blocker:
                finding.blocker
                  ? "Yes"
                  : "No",
            }))
        );

      for (
        let row = 8;
        row <= result.sheet.rowCount;
        row += 1
      ) {
        applySeverityStyle(
          result.sheet.getCell(row, 6)
        );

        const riskCell =
          result.sheet.getCell(row, 7);

        const risk =
          Number(riskCell.value ?? 0);

        riskCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              risk >= 90
                ? "FFFEE2E2"
                : risk >= 75
                  ? "FFFFEDD5"
                  : risk >= 50
                    ? "FFFEF3C7"
                    : "FFDCFCE7",
          },
        };

        riskCell.font = {
          bold: true,
        };

        const blockerCell =
          result.sheet.getCell(row, 11);

        if (
          String(
            blockerCell.value
          ) === "Yes"
        ) {
          blockerCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: "FFFEE2E2",
            },
          };

          blockerCell.font = {
            bold: true,
          };
        }
      }
    }

    function addControlsSheet() {
      const result =
        createDataSheet(
          "Controls",
          `Mapped security control dataset for the selected scope (${controls.length} records).`,
          [
            {
              header: "Assessment ID",
              key: "assessment",
              width: 30,
            },
            {
              header: "Asset",
              key: "asset",
              width: 30,
            },
            {
              header: "Control ID",
              key: "id",
              width: 34,
            },
            {
              header: "Control",
              key: "name",
              width: 52,
            },
            {
              header: "Domain",
              key: "domain",
              width: 24,
            },
            {
              header: "Severity",
              key: "severity",
              width: 14,
            },
            {
              header: "Status",
              key: "status",
              width: 18,
            },
            {
              header: "Finding ID",
              key: "findingId",
              width: 38,
            },
            {
              header: "Required Evidence",
              key: "requiredEvidence",
              width: 52,
            },
          ],
          controls.map((control) => ({
            assessment:
              control.assessmentId,
            asset: control.assetName,
            id: control.id,
            name: control.name,
            domain: control.domain,
            severity: control.severity,
            status: control.status,
            findingId:
              control.findingId,
            requiredEvidence:
              control.requiredEvidence,
          }))
        );

      for (
        let row = 8;
        row <= result.sheet.rowCount;
        row += 1
      ) {
        applySeverityStyle(
          result.sheet.getCell(row, 6)
        );

        const statusCell =
          result.sheet.getCell(row, 7);

        const status =
          String(
            statusCell.value ?? ""
          );

        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              status === "Implemented"
                ? "FFDCFCE7"
                : status === "In Progress"
                  ? "FFFEF3C7"
                  : "FFF1F5F9",
          },
        };

        statusCell.font = {
          bold: true,
        };
      }
    }

    function addEvidenceSheet() {
      const result =
        createDataSheet(
          "Evidence",
          `Evidence assurance and provenance dataset for the selected scope (${evidence.length} records).`,
          [
            {
              header: "Assessment ID",
              key: "assessment",
              width: 30,
            },
            {
              header: "Asset",
              key: "asset",
              width: 30,
            },
            {
              header: "Evidence ID",
              key: "id",
              width: 38,
            },
            {
              header: "Title",
              key: "title",
              width: 52,
            },
            {
              header: "Source",
              key: "source",
              width: 24,
            },
            {
              header: "Status",
              key: "status",
              width: 18,
            },
            {
              header: "Integrity",
              key: "integrity",
              width: 28,
            },
            {
              header: "Location Type",
              key: "locationType",
              width: 24,
            },
            {
              header: "Location",
              key: "location",
              width: 64,
            },
            {
              header: "Package",
              key: "package",
              width: 28,
            },
            {
              header: "Version",
              key: "version",
              width: 22,
            },
            {
              header: "CWE",
              key: "cwe",
              width: 16,
            },
            {
              header: "Finding ID",
              key: "findingId",
              width: 38,
            },
            {
              header: "Control ID",
              key: "controlId",
              width: 34,
            },
          ],
          evidence.map((record) => ({
            assessment:
              record.assessmentId,
            asset: record.assetName,
            id: record.id,
            title: record.title,
            source: record.source,
            status: record.status,
            integrity:
              record.integrity,
            locationType:
              record.location?.kind ?? "",
            location:
              record.location?.raw ?? "",
            package:
              record.location?.package ??
              "",
            version:
              record.location?.version ??
              "",
            cwe: record.cwe ?? "",
            findingId:
              record.findingId,
            controlId:
              record.controlId,
          }))
        );

      for (
        let row = 8;
        row <= result.sheet.rowCount;
        row += 1
      ) {
        const statusCell =
          result.sheet.getCell(row, 6);

        const status =
          String(
            statusCell.value ?? ""
          );

        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              status === "Verified"
                ? "FFDCFCE7"
                : "FFFEF3C7",
          },
        };

        statusCell.font = {
          bold: true,
        };
      }
    }

    /*
     * EXECUTIVE SECURITY WORKBOOK
     */
    if (reportType === "executive") {
      const summary =
        createSummarySheet(
          "Executive Summary",
          "Leadership-level security posture and decision intelligence.",
          [
            [
              "Assessments",
              workspace.assessments,
            ],
            [
              "Assets Covered",
              workspace.assets,
            ],
            [
              "Findings Analyzed",
              workspace.findings,
            ],
            [
              "Critical",
              workspace.critical,
            ],
            [
              "High",
              workspace.high,
            ],
            [
              "Critical + High",
              workspace.critical +
                workspace.high,
            ],
            [
              "Policy Blockers",
              workspace.blockers,
            ],
            [
              "Highest Risk",
              `${workspace.highestRisk}/100`,
            ],
          ]
        );

      addRiskDistribution(
        summary,
        summary.rowCount + 3
      );

      addDecisionDistribution(
        summary,
        summary.rowCount + 3
      );

      addAssessmentSheet();
      addScannerSheet();
    }

    /*
     * ASSESSMENT WORKBOOK
     */
    if (reportType === "assessment") {
      const summary =
        createSummarySheet(
          "Assessment Summary",
          "Assessment-level security analysis and complete supporting dataset.",
          [
            [
              "Assessments",
              workspace.assessments,
            ],
            [
              "Assets",
              workspace.assets,
            ],
            [
              "Findings",
              workspace.findings,
            ],
            [
              "Critical",
              workspace.critical,
            ],
            [
              "High",
              workspace.high,
            ],
            [
              "Medium",
              workspace.medium,
            ],
            [
              "Low",
              workspace.low,
            ],
            [
              "Policy Blockers",
              workspace.blockers,
            ],
            [
              "Controls",
              controls.length,
            ],
            [
              "Evidence Records",
              evidence.length,
            ],
            [
              "Highest Risk",
              `${workspace.highestRisk}/100`,
            ],
          ]
        );

      addRiskDistribution(
        summary,
        summary.rowCount + 3
      );

      addDecisionDistribution(
        summary,
        summary.rowCount + 3
      );

      addAssessmentSheet();
      addScannerSheet();
      addFindingsSheet();
      addControlsSheet();
      addEvidenceSheet();
    }

    /*
     * TECHNICAL FINDINGS WORKBOOK
     */
    if (reportType === "technical") {
      const summary =
        createSummarySheet(
          "Technical Summary",
          "Engineering-focused security finding intelligence and scanner coverage.",
          [
            [
              "Total Findings",
              workspace.findings,
            ],
            [
              "Critical",
              workspace.critical,
            ],
            [
              "High",
              workspace.high,
            ],
            [
              "Medium",
              workspace.medium,
            ],
            [
              "Low",
              workspace.low,
            ],
            [
              "Policy Blockers",
              workspace.blockers,
            ],
            [
              "Scanner Executions",
              scanners.length,
            ],
            [
              "Highest Risk",
              `${workspace.highestRisk}/100`,
            ],
          ]
        );

      addRiskDistribution(
        summary,
        summary.rowCount + 3
      );

      addFindingsSheet();
      addScannerSheet();
    }

    /*
     * CONTROLS & EVIDENCE WORKBOOK
     */
    if (reportType === "assurance") {
      const required =
        controls.filter(
          (control) =>
            control.status === "Required"
        ).length;

      const inProgress =
        controls.filter(
          (control) =>
            control.status ===
            "In Progress"
        ).length;

      const implemented =
        controls.filter(
          (control) =>
            control.status ===
            "Implemented"
        ).length;

      const verified =
        evidence.filter(
          (record) =>
            record.status === "Verified"
        ).length;

      const pending =
        evidence.filter(
          (record) =>
            record.status ===
            "Pending Review"
        ).length;

      const summary =
        createSummarySheet(
          "Assurance Summary",
          "Security control coverage, evidence assurance, provenance, and decision traceability.",
          [
            [
              "Mapped Controls",
              controls.length,
            ],
            [
              "Required Controls",
              required,
            ],
            [
              "Controls In Progress",
              inProgress,
            ],
            [
              "Implemented Controls",
              implemented,
            ],
            [
              "Evidence Records",
              evidence.length,
            ],
            [
              "Verified Evidence",
              verified,
            ],
            [
              "Pending Review",
              pending,
            ],
            [
              "Assets",
              workspace.assets,
            ],
          ]
        );

      addDecisionDistribution(
        summary,
        summary.rowCount + 3
      );

      addControlsSheet();
      addEvidenceSheet();
      addAssessmentSheet();
    }

    /*
     * Workbook safety fallback.
     */
    if (
      workbook.worksheets.length === 0
    ) {
      createSummarySheet(
        "Report Summary",
        "AppSecGate security report.",
        [
          [
            "Assessments",
            workspace.assessments,
          ],
          [
            "Assets",
            workspace.assets,
          ],
        ]
      );
    }

    /*
     * Global worksheet polish.
     */
    workbook.eachSheet((sheet) => {
      sheet.properties.defaultRowHeight = 18;

      sheet.headerFooter = {
        oddFooter:
          "AppSecGate Security Reporting | Page &P of &N",
      };

      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.alignment = {
            ...cell.alignment,
            vertical:
              cell.alignment?.vertical ??
              "top",
            wrapText:
              cell.alignment?.wrapText ??
              true,
          };
        });
      });
    });

    const buffer =
      await workbook.xlsx.writeBuffer();

    const blob =
      new Blob(
        [buffer as BlobPart],
        {
          type:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      exportFileName("xlsx");

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(url);
  }

  const selectedType =
    reportTypes.find(
      (item) => item.id === reportType
    ) ?? reportTypes[1];

  return (
    <div className="reports-v3">
      <header className="reports-v3-hero">
        <div>
          <p className="eyebrow">
            SECURITY ASSESSMENT REPORT
          </p>

          <h1>Assessment Report</h1>

          <p className="reports-v3-description">
            Executive risk posture, scanner
            coverage, finding intelligence,
            mapped security controls, evidence
            assurance, and the final security
            gate decision.
          </p>
        </div>

        <div className="reports-v3-workspace-badge">
          <small>REPORTING WORKSPACE</small>
          <strong>Build · Preview · Export</strong>
          <span>PDF + Excel</span>
        </div>
      </header>

      <section className="reports-v3-toolbar">
        <div>
          <p className="eyebrow">
            REPORTING WORKSPACE
          </p>
          <h2>Security reporting</h2>
          <p className="muted">
            Build reports across assessments
            and assets instead of exporting a
            single finding.
          </p>
        </div>

        <button
          type="button"
          className="run-assessment-button"
          onClick={openBuilder}
          disabled={assessments.length === 0}
        >
          + Create Report
        </button>
      </section>

      <section className="reports-v3-kpis">
        <article>
          <small>ASSESSMENTS</small>
          <strong>
            {reportingOverview.assessments}
          </strong>
          <span>
            Current unique assessments
          </span>
        </article>

        <article>
          <small>ASSETS COVERED</small>
          <strong>
            {reportingOverview.assets}
          </strong>
          <span>
            Unique assessed assets
          </span>
        </article>

        <article>
          <small>FINDINGS ANALYZED</small>
          <strong>
            {reportingOverview.findings}
          </strong>
          <span>
            Latest findings per asset
          </span>
        </article>

        <article>
          <small>LATEST ASSESSMENT</small>
          <strong>
            {latest
              ? latest.decision
              : "—"}
          </strong>
          <span>
            {latest
              ? formatDate(
                  latest.completedAt
                )
              : "No assessment data"}
          </span>
        </article>
      </section>

      <section className="reports-v3-library">
        <div className="reports-v3-section-heading">
          <div>
            <p className="eyebrow">
              ASSESSMENT HISTORY
            </p>

            <h2>
              Available report scope
            </h2>
          </div>

          <span>
            {loading
              ? "Loading..."
              : `${landingAssessments.length} assessment(s)`}
          </span>
        </div>

        {assessments.length === 0 &&
        !loading ? (
          <div className="reports-v3-empty">
            No persisted assessments are
            available for reporting.
          </div>
        ) : (
          <>
            <div className="reports-v3-assessment-list">
              {paginatedLandingAssessments.map(
                (item) => (
                  <article
                    key={item.id}
                    className="reports-v3-assessment-row"
                  >
                    <div>
                      <small>
                        {item.asset.environment} ·{" "}
                        {item.asset.criticality}
                      </small>

                      <strong>
                        {item.asset.name}
                      </strong>

                      <span>
                        {item.id}
                      </span>
                    </div>

                    <div>
                      <small>
                        FINDINGS
                      </small>

                      <strong>
                        {item.findings.length}
                      </strong>
                    </div>

                    <div>
                      <small>
                        SCANNERS
                      </small>

                      <strong>
                        {
                          item.scannerExecutions
                            .length
                        }
                      </strong>
                    </div>

                    <div>
                      <small>
                        DECISION
                      </small>

                      <strong
                        className={`report-decision-${item.decision.toLowerCase()}`}
                      >
                        {item.decision}
                      </strong>
                    </div>

                    <div>
                      <small>
                        COMPLETED
                      </small>

                      <strong>
                        {formatDate(
                          item.completedAt
                        )}
                      </strong>
                    </div>
                  </article>
                )
              )}
            </div>

            {reportScopeTotalPages > 1 && (
              <nav
                className="reports-v3-pagination"
                aria-label="Assessment history pages"
              >
                <button
                  type="button"
                  className="reports-v3-page-arrow"
                  onClick={() =>
                    setReportScopePage(1)
                  }
                  disabled={
                    reportScopePage === 1
                  }
                  aria-label="First page"
                  title="First page"
                >
                  «
                </button>

                <button
                  type="button"
                  className="reports-v3-page-arrow"
                  onClick={() =>
                    setReportScopePage(
                      (current) =>
                        Math.max(
                          1,
                          current - 1
                        )
                    )
                  }
                  disabled={
                    reportScopePage === 1
                  }
                  aria-label="Previous page"
                  title="Previous page"
                >
                  ‹
                </button>

                <div className="reports-v3-page-numbers">
                  {reportScopePageNumbers[0] > 1 && (
                    <span
                      className="reports-v3-page-ellipsis"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  )}

                  {reportScopePageNumbers.map(
                    (page) => (
                      <button
                        key={page}
                        type="button"
                        className={
                          page ===
                          reportScopePage
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setReportScopePage(
                            page
                          )
                        }
                        aria-label={`Page ${page}`}
                        aria-current={
                          page ===
                          reportScopePage
                            ? "page"
                            : undefined
                        }
                      >
                        {page}
                      </button>
                    )
                  )}

                  {reportScopePageNumbers[
                    reportScopePageNumbers.length -
                      1
                  ] < reportScopeTotalPages && (
                    <span
                      className="reports-v3-page-ellipsis"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="reports-v3-page-arrow"
                  onClick={() =>
                    setReportScopePage(
                      (current) =>
                        Math.min(
                          reportScopeTotalPages,
                          current + 1
                        )
                    )
                  }
                  disabled={
                    reportScopePage ===
                    reportScopeTotalPages
                  }
                  aria-label="Next page"
                  title="Next page"
                >
                  ›
                </button>

                <button
                  type="button"
                  className="reports-v3-page-arrow"
                  onClick={() =>
                    setReportScopePage(
                      reportScopeTotalPages
                    )
                  }
                  disabled={
                    reportScopePage ===
                    reportScopeTotalPages
                  }
                  aria-label="Last page"
                  title="Last page"
                >
                  »
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {builderOpen && (
        <div className="reports-v3-builder-shell">
          <div className="reports-v3-builder">
            <div className="reports-v3-builder-header">
              <div>
                <p className="eyebrow">
                  CREATE SECURITY REPORT
                </p>
                <h2>Report Builder</h2>
              </div>

              <button
                type="button"
                className="reports-v3-close"
                onClick={closeBuilder}
              >
                ×
              </button>
            </div>

            <nav className="reports-v3-steps">
              {[
                ["type", "01", "Type"],
                ["scope", "02", "Scope"],
                ["content", "03", "Content"],
                ["preview", "04", "Preview"],
              ].map(
                ([id, number, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      step === id
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setStep(
                        id as BuilderStep
                      )
                    }
                  >
                    <span>{number}</span>
                    {label}
                  </button>
                )
              )}
            </nav>

            {step === "type" && (
              <section className="reports-v3-builder-panel">
                <div className="reports-v3-panel-heading">
                  <p className="eyebrow">
                    01 · REPORT TYPE
                  </p>
                  <h3>
                    What should this report
                    communicate?
                  </h3>
                </div>

                <div className="reports-v3-type-grid">
                  {reportTypes.map(
                    (type) => (
                      <button
                        key={type.id}
                        type="button"
                        className={
                          reportType ===
                          type.id
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setReportType(
                            type.id
                          )
                        }
                      >
                        <small>
                          {type.eyebrow}
                        </small>
                        <strong>
                          {type.title}
                        </strong>
                        <span>
                          {type.description}
                        </span>
                      </button>
                    )
                  )}
                </div>

                <div className="reports-v3-builder-actions">
                  <span />
                  <button
                    type="button"
                    className="run-assessment-button"
                    onClick={() =>
                      setStep("scope")
                    }
                  >
                    Continue to Scope →
                  </button>
                </div>
              </section>
            )}

            {step === "scope" && (
              <section className="reports-v3-builder-panel">
                <div className="reports-v3-panel-heading">
                  <p className="eyebrow">
                    02 · REPORT SCOPE
                  </p>
                  <h3>
                    Select assessments to
                    include
                  </h3>
                  <p className="muted">
                    Multiple runs and assets
                    can be included in one
                    security report.
                  </p>
                </div>

                <div className="reports-v3-scope-summary">
                  <article>
                    <small>SELECTED</small>
                    <strong>
                      {
                        selectedAssessments.length
                      }
                    </strong>
                    <span>Assessments</span>
                  </article>

                  <article>
                    <small>ASSETS</small>
                    <strong>
                      {workspace.assets}
                    </strong>
                    <span>Unique assets</span>
                  </article>

                  <article>
                    <small>FINDINGS</small>
                    <strong>
                      {workspace.findings}
                    </strong>
                    <span>In report scope</span>
                  </article>
                </div>

                <div className="reports-v3-scope-list">
                  {assessments.map(
                    (item) => {
                      const checked =
                        selectedAssessmentIds.includes(
                          item.id
                        );

                      return (
                        <label
                          key={item.id}
                          className={
                            checked
                              ? "selected"
                              : ""
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleAssessment(
                                item.id
                              )
                            }
                          />

                          <span>
                            <strong>
                              {item.asset.name}
                            </strong>
                            <small>
                              {item.id}
                            </small>
                          </span>

                          <span>
                            {
                              item.findings
                                .length
                            }{" "}
                            findings
                          </span>

                          <b>
                            {item.decision}
                          </b>
                        </label>
                      );
                    }
                  )}
                </div>

                <div className="reports-v3-builder-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setStep("type")
                    }
                  >
                    ← Back
                  </button>

                  <button
                    type="button"
                    className="run-assessment-button"
                    disabled={
                      selectedAssessmentIds.length ===
                      0
                    }
                    onClick={() =>
                      setStep("content")
                    }
                  >
                    Continue to Content →
                  </button>
                </div>
              </section>
            )}

            {step === "content" && (
              <section className="reports-v3-builder-panel">
                <div className="reports-v3-panel-heading">
                  <p className="eyebrow">
                    03 · REPORT CONTENT
                  </p>
                  <h3>
                    Choose report sections
                  </h3>
                </div>

                <div className="reports-v3-content-grid">
                  {reportSections.map(
                    (section) => {
                      const checked =
                        sections.includes(
                          section.id
                        );

                      return (
                        <label
                          key={section.id}
                          className={
                            checked
                              ? "selected"
                              : ""
                          }
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleSection(
                                section.id
                              )
                            }
                          />

                          <span>
                            {section.label}
                          </span>
                        </label>
                      );
                    }
                  )}
                </div>

                <div className="reports-v3-builder-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setStep("scope")
                    }
                  >
                    ← Back
                  </button>

                  <button
                    type="button"
                    className="run-assessment-button"
                    disabled={
                      sections.length === 0
                    }
                    onClick={() =>
                      setStep("preview")
                    }
                  >
                    Preview Report →
                  </button>
                </div>
              </section>
            )}

            {step === "preview" && (
              <section className="reports-v3-builder-panel">
                <div className="reports-v3-panel-heading">
                  <p className="eyebrow">
                    04 · REPORT PREVIEW
                  </p>

                  <h3>
                    {selectedType.title} Report
                  </h3>

                  <p className="muted">
                    Aggregated from{" "}
                    {workspace.assessments}{" "}
                    {workspace.assessments === 1
                      ? "assessment"
                      : "assessments"}{" "}
                    across {workspace.assets}{" "}
                    {workspace.assets === 1
                      ? "asset"
                      : "assets"}.
                  </p>
                </div>

                <div className="reports-v3-preview">
                  <div className="reports-v3-preview-banner">
                    <div>
                      <small>SECURITY REPORT</small>

                      <h2>
                        {selectedType.title}
                      </h2>

                      <span>
                        AppSecGate assessment
                        intelligence
                      </span>
                    </div>

                    <div>
                      <small>REPORT SCOPE</small>

                      <strong>
                        {workspace.assessments}{" "}
                        {workspace.assessments === 1
                          ? "Assessment"
                          : "Assessments"}
                      </strong>

                      <span>
                        {workspace.assets}{" "}
                        {workspace.assets === 1
                          ? "Asset"
                          : "Assets"}
                      </span>
                    </div>
                  </div>

                  {reportType === "executive" && (
                    <>
                      <div className="reports-v3-preview-kpis">
                        <article>
                          <small>ASSESSMENTS</small>
                          <strong>
                            {workspace.assessments}
                          </strong>
                        </article>

                        <article>
                          <small>ASSETS</small>
                          <strong>
                            {workspace.assets}
                          </strong>
                        </article>

                        <article>
                          <small>
                            CRITICAL + HIGH
                          </small>
                          <strong>
                            {workspace.critical +
                              workspace.high}
                          </strong>
                        </article>

                        <article>
                          <small>
                            HIGHEST RISK
                          </small>
                          <strong>
                            {workspace.highestRisk}
                            /100
                          </strong>
                        </article>
                      </div>

                      <div className="reports-v3-preview-section reports-v3-preview-accent">
                        <small>
                          EXECUTIVE SECURITY POSTURE
                        </small>
                        <h3>
                          {workspace.decisions.BLOCK >
                          0
                            ? "Security policy blocking conditions are present."
                            : workspace.decisions
                                  .INCOMPLETE > 0
                              ? "Assessment coverage is incomplete."
                              : "Selected assessments satisfy the current security gate."}
                        </h3>
                        <p>
                          {workspace.critical} critical
                          {" · "}
                          {workspace.high} high-risk
                          findings across{" "}
                          {workspace.assets}{" "}
                          {workspace.assets === 1
                            ? "asset"
                            : "assets"}.
                        </p>
                      </div>

                      {sections.includes(
                        "gateDecisions"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            GATE OUTCOMES
                          </small>
                          <h3>
                            {
                              workspace.decisions
                                .BLOCK
                            }{" "}
                            Block ·{" "}
                            {
                              workspace.decisions
                                .PASS
                            }{" "}
                            Pass ·{" "}
                            {
                              workspace.decisions
                                .INCOMPLETE
                            }{" "}
                            Incomplete
                          </h3>
                          <p>
                            {workspace.blockers} policy
                            blocker finding(s) in
                            scope.
                          </p>
                        </div>
                      )}

                      {sections.includes(
                        "riskDistribution"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            RISK EXPOSURE
                          </small>
                          <h3>
                            {workspace.critical} Critical
                            {" · "}
                            {workspace.high} High
                            {" · "}
                            {workspace.medium} Medium
                            {" · "}
                            {workspace.low} Low
                          </h3>
                        </div>
                      )}

                      {sections.includes(
                        "assessmentHistory"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            ASSESSMENT OUTCOMES
                          </small>

                          <div className="reports-v3-mini-table">
                            {selectedAssessments
                              .slice(0, 6)
                              .map((item) => (
                                <div key={item.id}>
                                  <span>
                                    {item.asset.name}
                                  </span>
                                  <span>
                                    {
                                      item.findings
                                        .length
                                    }{" "}
                                    findings
                                  </span>
                                  <b>
                                    {item.decision}
                                  </b>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {reportType === "assessment" && (
                    <>
                      <div className="reports-v3-preview-kpis">
                        <article>
                          <small>FINDINGS</small>
                          <strong>
                            {workspace.findings}
                          </strong>
                        </article>

                        <article>
                          <small>CRITICAL</small>
                          <strong>
                            {workspace.critical}
                          </strong>
                        </article>

                        <article>
                          <small>SCANNERS</small>
                          <strong>
                            {
                              workspace.completedScanners
                            }
                            /{workspace.scanners}
                          </strong>
                        </article>

                        <article>
                          <small>
                            HIGHEST RISK
                          </small>
                          <strong>
                            {workspace.highestRisk}
                            /100
                          </strong>
                        </article>
                      </div>

                      {sections.includes(
                        "executiveSummary"
                      ) && (
                        <div className="reports-v3-preview-section reports-v3-preview-accent">
                          <small>
                            ASSESSMENT CONTEXT
                          </small>
                          <h3>
                            {workspace.assessments}{" "}
                            {workspace.assessments === 1
                              ? "assessment"
                              : "assessments"}{" "}
                            across {workspace.assets}{" "}
                            {workspace.assets === 1
                              ? "asset"
                              : "assets"}
                          </h3>
                          <p>
                            {workspace.findings} normalized
                            findings ·{" "}
                            {workspace.controls} mapped
                            controls ·{" "}
                            {workspace.evidence} evidence
                            records.
                          </p>
                        </div>
                      )}

                      {sections.includes(
                        "scannerCoverage"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            SCANNER COVERAGE
                          </small>
                          <h3>
                            {
                              workspace.completedScanners
                            }
                            /{workspace.scanners} scanner
                            executions completed
                          </h3>

                          <div className="reports-v3-mini-table">
                            {selectedAssessments.flatMap(
                              (item) =>
                                item.scannerExecutions.map(
                                  (scanner, index) => (
                                    <div
                                      key={`${item.id}-${index}`}
                                    >
                                      <span>
                                        {
                                          scanner.tool
                                        }
                                      </span>
                                      <span>
                                        {item.asset.name}
                                      </span>
                                      <b>
                                        {
                                          scanner.status
                                        }
                                      </b>
                                    </div>
                                  )
                                )
                            ).slice(0, 8)}
                          </div>
                        </div>
                      )}

                      {sections.includes(
                        "riskDistribution"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            RISK DISTRIBUTION
                          </small>
                          <h3>
                            {workspace.critical} Critical
                            {" · "}
                            {workspace.high} High
                            {" · "}
                            {workspace.medium} Medium
                            {" · "}
                            {workspace.low} Low
                          </h3>
                        </div>
                      )}

                      {sections.includes(
                        "gateDecisions"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            FINAL SECURITY GATE
                          </small>
                          <h3>
                            {
                              workspace.decisions
                                .BLOCK
                            }{" "}
                            Block ·{" "}
                            {
                              workspace.decisions
                                .PASS
                            }{" "}
                            Pass ·{" "}
                            {
                              workspace.decisions
                                .INCOMPLETE
                            }{" "}
                            Incomplete
                          </h3>
                          <p>
                            {workspace.blockers} policy
                            blocker finding(s).
                          </p>
                        </div>
                      )}

                      {(sections.includes(
                        "controls"
                      ) ||
                        sections.includes(
                          "evidence"
                        )) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            CONTROL & EVIDENCE ASSURANCE
                          </small>
                          <h3>
                            {workspace.controls} mapped
                            controls ·{" "}
                            {workspace.evidence} evidence
                            records
                          </h3>
                        </div>
                      )}
                    </>
                  )}

                  {reportType === "technical" && (
                    <>
                      <div className="reports-v3-preview-kpis">
                        <article>
                          <small>FINDINGS</small>
                          <strong>
                            {workspace.findings}
                          </strong>
                        </article>

                        <article>
                          <small>CRITICAL</small>
                          <strong>
                            {workspace.critical}
                          </strong>
                        </article>

                        <article>
                          <small>HIGH</small>
                          <strong>
                            {workspace.high}
                          </strong>
                        </article>

                        <article>
                          <small>BLOCKERS</small>
                          <strong>
                            {workspace.blockers}
                          </strong>
                        </article>
                      </div>

                      {sections.includes(
                        "findings"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            TECHNICAL FINDING INTELLIGENCE
                          </small>
                          <h3>
                            Highest-priority findings in
                            selected scope
                          </h3>

                          <div className="reports-v3-findings-table">
                            <div className="reports-v3-table-head">
                              <span>Finding</span>
                              <span>Asset</span>
                              <span>Severity</span>
                              <span>Risk</span>
                              <span>Scanner</span>
                            </div>

                            {selectedAssessments
                              .flatMap((item) =>
                                item.findings.map(
                                  (finding) => ({
                                    finding,
                                    assessment:
                                      item,
                                  })
                                )
                              )
                              .sort(
                                (a, b) =>
                                  (b.finding
                                    .riskScore ?? 0) -
                                  (a.finding
                                    .riskScore ?? 0)
                              )
                              .slice(0, 12)
                              .map(
                                ({
                                  finding,
                                  assessment:
                                    item,
                                }) => (
                                  <div
                                    key={`${item.id}-${finding.id}`}
                                  >
                                    <span>
                                      <strong>
                                        {finding.id}
                                      </strong>
                                      <small>
                                        {
                                          finding.title
                                        }
                                      </small>
                                    </span>

                                    <span>
                                      {item.asset.name}
                                    </span>

                                    <b>
                                      {
                                        finding.severity
                                      }
                                    </b>

                                    <span>
                                      {finding.riskScore ??
                                        0}
                                      /100
                                    </span>

                                    <span>
                                      {
                                        finding.source
                                      }
                                    </span>
                                  </div>
                                )
                              )}
                          </div>
                        </div>
                      )}

                      {sections.includes(
                        "riskDistribution"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            SEVERITY DISTRIBUTION
                          </small>
                          <h3>
                            {workspace.critical} Critical
                            {" · "}
                            {workspace.high} High
                            {" · "}
                            {workspace.medium} Medium
                            {" · "}
                            {workspace.low} Low
                          </h3>
                        </div>
                      )}

                      {sections.includes(
                        "scannerCoverage"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            DETECTION COVERAGE
                          </small>
                          <h3>
                            {
                              workspace.completedScanners
                            }
                            /{workspace.scanners} scanner
                            executions completed
                          </h3>
                        </div>
                      )}
                    </>
                  )}

                  {reportType === "assurance" && (
                    <>
                      <div className="reports-v3-preview-kpis">
                        <article>
                          <small>CONTROLS</small>
                          <strong>
                            {workspace.controls}
                          </strong>
                        </article>

                        <article>
                          <small>EVIDENCE</small>
                          <strong>
                            {workspace.evidence}
                          </strong>
                        </article>

                        <article>
                          <small>FINDINGS</small>
                          <strong>
                            {workspace.findings}
                          </strong>
                        </article>

                        <article>
                          <small>ASSETS</small>
                          <strong>
                            {workspace.assets}
                          </strong>
                        </article>
                      </div>

                      {sections.includes(
                        "controls"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            SECURITY CONTROL COVERAGE
                          </small>
                          <h3>
                            {workspace.controls} mapped
                            security controls
                          </h3>

                          <div className="reports-v3-findings-table reports-v3-assurance-table">
                            <div className="reports-v3-table-head">
                              <span>Control</span>
                              <span>Assessment</span>
                              <span>Finding</span>
                              <span>Status</span>
                            </div>

                            {selectedAssessments
                              .flatMap((item) =>
                                item.controls.map(
                                  (control) => ({
                                    control,
                                    assessment:
                                      item,
                                  })
                                )
                              )
                              .slice(0, 10)
                              .map(
                                ({
                                  control,
                                  assessment:
                                    item,
                                }) => (
                                  <div
                                    key={`${item.id}-${control.id}`}
                                  >
                                    <span>
                                      <strong>
                                        {control.id}
                                      </strong>
                                      <small>
                                        {
                                          control.name
                                        }
                                      </small>
                                    </span>

                                    <span>
                                      {item.asset.name}
                                    </span>

                                    <span>
                                      {
                                        control.findingId
                                      }
                                    </span>

                                    <b>
                                      {
                                        control.status
                                      }
                                    </b>
                                  </div>
                                )
                              )}
                          </div>
                        </div>
                      )}

                      {sections.includes(
                        "evidence"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            EVIDENCE TRACEABILITY
                          </small>
                          <h3>
                            {workspace.evidence} evidence
                            records preserve finding and
                            scanner provenance.
                          </h3>

                          <div className="reports-v3-mini-table">
                            {selectedAssessments
                              .flatMap((item) =>
                                item.evidence.map(
                                  (record) => ({
                                    record,
                                    assessment:
                                      item,
                                  })
                                )
                              )
                              .slice(0, 8)
                              .map(
                                ({
                                  record,
                                  assessment:
                                    item,
                                }) => (
                                  <div
                                    key={`${item.id}-${record.id}`}
                                  >
                                    <span>
                                      {record.id}
                                    </span>
                                    <span>
                                      {
                                        record.findingId
                                      }
                                    </span>
                                    <b>
                                      {
                                        record.source
                                      }
                                    </b>
                                  </div>
                                )
                              )}
                          </div>
                        </div>
                      )}

                      {sections.includes(
                        "gateDecisions"
                      ) && (
                        <div className="reports-v3-preview-section">
                          <small>
                            DECISION TRACEABILITY
                          </small>
                          <h3>
                            {workspace.blockers} policy
                            blockers ·{" "}
                            {workspace.decisions.BLOCK}{" "}
                            blocked assessment(s)
                          </h3>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="reports-v3-export">
                  <div>
                    <small>EXPORT</small>
                    <strong>
                      PDF and Excel export will
                      use this report scope and
                      template.
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={exportPdf}
                    disabled={
                      selectedAssessments.length === 0
                    }
                  >
                    Export PDF
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void exportExcel();
                    }}
                    disabled={
                      selectedAssessments.length === 0
                    }
                  >
                    Export Excel
                  </button>
                </div>

                <div className="reports-v3-builder-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setStep("content")
                    }
                  >
                    ← Back
                  </button>

                  <button
                    type="button"
                    onClick={closeBuilder}
                  >
                    Close Preview
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
