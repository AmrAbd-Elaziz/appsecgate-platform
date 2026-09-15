"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  type Asset,
  type AssetType,
  type Environment,
  type Criticality,
} from "../data/appsecgate";

type Props = {
  onRunAssessment: (asset: Asset) => void;
  assessmentRunning: boolean;
  assessmentRunError: string;
};

export default function AssetsInputs({
  onRunAssessment,
  assessmentRunning,
  assessmentRunError,
}: Props) {
  const [assets, setAssets] =
    useState<Asset[]>([]);

  const [
    selectedAssetId,
    setSelectedAssetId,
  ] = useState<number>(0);

  const [showForm, setShowForm] =
    useState(false);

  const [loadingAssets, setLoadingAssets] =
    useState(true);

  const [assetError, setAssetError] =
    useState("");

  const [creatingAsset, setCreatingAsset] =
    useState(false);

  const [uploadingSource, setUploadingSource] =
    useState(false);

  const [sourceUploadName, setSourceUploadName] =
    useState("");

  const [sourceUploadSize, setSourceUploadSize] =
    useState(0);

  const [sourceDiscovery, setSourceDiscovery] =
    useState<{
      sourceDetected: boolean;
      iacDetected: boolean;
      dockerfileDetected: boolean;
      dependencyFiles: string[];
      detectedFiles: number;
    } | null>(null);

  const [repositoryUrl, setRepositoryUrl] =
    useState("");

  const [
    importingRepository,
    setImportingRepository,
  ] = useState(false);

  const [
    sourceAcquisition,
    setSourceAcquisition,
  ] = useState<
    "upload" | "repository" | null
  >(null);

  const [name, setName] =
    useState("");

  const [type, setType] =
    useState<AssetType>("Web Application");

  const [environment, setEnvironment] =
    useState<Environment>("Production");

  const [criticality, setCriticality] =
    useState<Criticality>("High");

  /*
   * Asset-specific scanner targets.
   */
  const [sourcePath, setSourcePath] =
    useState("");

  const [iacPath, setIacPath] =
    useState("");

  const [dastUrl, setDastUrl] =
    useState("");

  const [
    containerImage,
    setContainerImage,
  ] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      try {
        setLoadingAssets(true);
        setAssetError("");

        const response =
          await fetch("/api/assets", {
            cache: "no-store",
          });

        if (!response.ok) {
          throw new Error(
            "Unable to load assets."
          );
        }

        const payload =
          await response.json();

        const loadedAssets =
          payload.data as Asset[];

        if (cancelled) {
          return;
        }

        setAssets(loadedAssets);

        if (loadedAssets.length > 0) {
          setSelectedAssetId(
            (current) =>
              loadedAssets.some(
                (asset) =>
                  asset.id === current
              )
                ? current
                : loadedAssets[0].id
          );
        }
      } catch (error) {
        if (!cancelled) {
          setAssetError(
            error instanceof Error
              ? error.message
              : "Unable to load assets."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAssets(false);
        }
      }
    }

    loadAssets();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAsset =
    assets.find(
      (asset) =>
        asset.id === selectedAssetId
    ) ?? null;

  const selectedProfile =
    selectedAsset?.scanProfile;

  const configuredTargets =
    selectedProfile
      ? Object.values(
          selectedProfile
        ).filter(Boolean).length
      : 0;

  const profileConfigured =
    configuredTargets > 0;

  const requiredScannerCount =
    !selectedProfile
      ? 6
      : (
          selectedProfile.sourcePath
            ? 4
            : selectedProfile.iacPath
              ? 1
              : 0
        ) +
        (selectedProfile.dastUrl ? 1 : 0) +
        (
          selectedProfile.containerImage
            ? 1
            : 0
        );

  const assessmentMode =
    !selectedProfile
      ? "Legacy full security gate"
      : requiredScannerCount > 0
        ? "Profile-aware security gate"
        : "No scanner targets";

  async function handleSourceUpload(
    file: File
  ) {
    if (
      !file.name
        .toLowerCase()
        .endsWith(".zip")
    ) {
      setAssetError(
        "Source code must be uploaded as a ZIP archive."
      );
      return;
    }

    try {
      setUploadingSource(true);
      setAssetError("");

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/uploads/source",
          {
            method: "POST",
            body: formData,
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to upload source archive."
        );
      }

      const upload =
        payload.data;

      setSourcePath(
        upload.sourcePath
      );

      /*
       * IaC files discovered inside the source
       * workspace use the same workspace root.
       * Checkov can therefore operate on the
       * extracted source tree automatically.
       */
      setIacPath(
        upload.discovery?.iacDetected
          ? upload.sourcePath
          : ""
      );

      setSourceUploadName(
        upload.originalName
      );

      setSourceUploadSize(
        upload.uploadSize
      );

      setSourceDiscovery(
        upload.discovery
      );

      setSourceAcquisition(
        "upload"
      );

      setRepositoryUrl("");
    } catch (error) {
      setSourcePath("");
      setIacPath("");
      setSourceUploadName("");
      setSourceUploadSize(0);
      setSourceDiscovery(null);

      setAssetError(
        error instanceof Error
          ? error.message
          : "Unable to upload source archive."
      );
    } finally {
      setUploadingSource(false);
    }
  }

  async function handleRepositoryImport() {
    const cleanUrl =
      repositoryUrl.trim();

    if (!cleanUrl) {
      setAssetError(
        "Repository URL is required."
      );
      return;
    }

    try {
      setImportingRepository(true);
      setAssetError("");

      const response =
        await fetch(
          "/api/imports/repository",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              repositoryUrl:
                cleanUrl,
            }),
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to import repository."
        );
      }

      const imported =
        payload.data;

      setSourcePath(
        imported.sourcePath
      );

      setIacPath(
        imported.discovery?.iacDetected
          ? imported.sourcePath
          : ""
      );

      setSourceUploadName(
        imported.repositoryName
      );

      setSourceUploadSize(0);

      setSourceDiscovery(
        imported.discovery
      );

      setSourceAcquisition(
        "repository"
      );

      setRepositoryUrl(
        imported.repositoryUrl
      );
    } catch (error) {
      setSourcePath("");
      setIacPath("");
      setSourceUploadName("");
      setSourceUploadSize(0);
      setSourceDiscovery(null);
      setSourceAcquisition(null);

      setAssetError(
        error instanceof Error
          ? error.message
          : "Unable to import repository."
      );
    } finally {
      setImportingRepository(false);
    }
  }

  function resetForm() {
    setName("");
    setType("Web Application");
    setEnvironment("Production");
    setCriticality("High");

    setSourcePath("");
    setIacPath("");
    setDastUrl("");
    setContainerImage("");

    setSourceUploadName("");
    setSourceUploadSize(0);
    setSourceDiscovery(null);

    setRepositoryUrl("");
    setSourceAcquisition(null);
    setImportingRepository(false);
  }

  async function handleAddAsset(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      setAssetError(
        "Asset name is required."
      );
      return;
    }

    try {
      setCreatingAsset(true);
      setAssetError("");

      const scanProfile = {
        sourcePath:
          sourcePath.trim() || undefined,

        iacPath:
          iacPath.trim() || undefined,

        dastUrl:
          dastUrl.trim() || undefined,

        containerImage:
          containerImage.trim() ||
          undefined,
      };

      const hasScanProfile =
        Object.values(
          scanProfile
        ).some(Boolean);

      const response =
        await fetch("/api/assets", {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name: cleanName,
            type,
            environment,
            criticality,

            ...(hasScanProfile
              ? { scanProfile }
              : {}),
          }),
        });

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to create asset."
        );
      }

      const newAsset =
        payload.data as Asset;

      setAssets(
        (current) => [
          ...current,
          newAsset,
        ]
      );

      setSelectedAssetId(
        newAsset.id
      );

      resetForm();
      setShowForm(false);
    } catch (error) {
      setAssetError(
        error instanceof Error
          ? error.message
          : "Unable to create asset."
      );
    } finally {
      setCreatingAsset(false);
    }
  }

  function handleRunAssessment() {
    if (
      !selectedAsset ||
      assessmentRunning
    ) {
      return;
    }

    onRunAssessment(selectedAsset);
  }

  return (
    <>
      <header
        className="page-header assets-header"
      >
        <div>
          <p className="eyebrow">
            ASSESSMENT SCOPE
          </p>

          <h1>
            Assets &amp; Inputs
          </h1>

          <p className="page-description">
            Define application scope and
            persist scanner-specific targets
            for repeatable security
            assessments.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setAssetError("");

            setShowForm(
              (current) => !current
            );
          }}
        >
          {showForm
            ? "Cancel"
            : "+ Add asset"}
        </button>
      </header>

      {assetError && (
        <div className="asset-error-banner">
          <b>Asset configuration error</b>
          <span>{assetError}</span>
        </div>
      )}

      {showForm && (
        <section
          className="panel asset-form-panel"
        >
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                NEW ASSET
              </p>

              <h3>
                Add assessment input
              </h3>

              <p className="asset-form-copy">
                Define the asset and provide
                the security inputs AppSecGate
                should assess.
              </p>
            </div>
          </div>

          <form
            className="asset-form"
            onSubmit={handleAddAsset}
          >
            <label
              className={
                "form-field " +
                "asset-name-field"
              }
            >
              <span>Asset name</span>

              <input
                value={name}
                onChange={(event) =>
                  setName(
                    event.target.value
                  )
                }
                placeholder="e.g. Payments API"
                autoFocus
              />
            </label>

            <label className="form-field">
              <span>Asset type</span>

              <select
                value={type}
                onChange={(event) =>
                  setType(
                    event.target
                      .value as AssetType
                  )
                }
              >
                <option>
                  Web Application
                </option>
                <option>API</option>
                <option>Container</option>
                <option>
                  Cloud Infrastructure
                </option>
                <option>
                  Repository
                </option>
              </select>
            </label>

            <label className="form-field">
              <span>Environment</span>

              <select
                value={environment}
                onChange={(event) =>
                  setEnvironment(
                    event.target
                      .value as Environment
                  )
                }
              >
                <option>
                  Production
                </option>
                <option>Staging</option>
                <option>
                  Development
                </option>
              </select>
            </label>

            <label className="form-field">
              <span>Criticality</span>

              <select
                value={criticality}
                onChange={(event) =>
                  setCriticality(
                    event.target
                      .value as Criticality
                  )
                }
              >
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>

            <div className="scan-profile-heading">
              <div>
                <p className="eyebrow">
                  SECURITY INPUTS
                </p>

                <h4>
                  Assessment artifacts
                </h4>
              </div>

              <span>
                Upload · detect · assess
              </span>
            </div>

            <div className="security-input-source">
              <div className="security-input-source-head">
                <div>
                  <span className="security-input-label">
                    SOURCE CODE
                  </span>

                  <b>
                    Upload application source
                  </b>
                </div>

                <span className="security-input-tools">
                  Semgrep · Gitleaks · Trivy FS · Checkov
                </span>
              </div>

              {!sourcePath ? (
                <div className="source-acquisition-options">
                  <label
                    className={
                      "source-upload-zone" +
                      (uploadingSource
                        ? " uploading"
                        : "")
                    }
                  >
                    <input
                      type="file"
                      accept=".zip,application/zip"
                      disabled={
                        uploadingSource ||
                        importingRepository
                      }
                      onChange={(event) => {
                        const file =
                          event.target.files?.[0];

                        if (file) {
                          void handleSourceUpload(
                            file
                          );
                        }

                        event.currentTarget.value =
                          "";
                      }}
                    />

                    <span className="source-upload-icon">
                      ↑
                    </span>

                    <b>
                      {uploadingSource
                        ? "Uploading & inspecting..."
                        : "Drop source ZIP here or browse"}
                    </b>

                    <small>
                      ZIP archive · Maximum 50 MB ·
                      safely extracted into an isolated workspace
                    </small>
                  </label>

                  <div className="source-acquisition-divider">
                    <span>OR</span>
                  </div>

                  <div className="repository-import-box">
                    <div className="repository-import-heading">
                      <div>
                        <span className="security-input-label">
                          GIT REPOSITORY
                        </span>

                        <b>
                          Import public repository
                        </b>
                      </div>

                      <span>
                        HTTPS · shallow clone
                      </span>
                    </div>

                    <div className="repository-import-controls">
                      <input
                        type="url"
                        value={repositoryUrl}
                        disabled={
                          importingRepository ||
                          uploadingSource
                        }
                        onChange={(event) =>
                          setRepositoryUrl(
                            event.target.value
                          )
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key ===
                            "Enter"
                          ) {
                            event.preventDefault();

                            void handleRepositoryImport();
                          }
                        }}
                        placeholder="https://github.com/org/project.git"
                      />

                      <button
                        type="button"
                        disabled={
                          importingRepository ||
                          uploadingSource ||
                          !repositoryUrl.trim()
                        }
                        onClick={() =>
                          void handleRepositoryImport()
                        }
                      >
                        {importingRepository
                          ? "Importing..."
                          : "Import repository"}
                      </button>
                    </div>

                    <small>
                      Public HTTPS repositories only.
                      Credentials and local repository
                      URLs are rejected.
                    </small>
                  </div>
                </div>
              ) : (
                <div className="source-upload-result">
                  <div className="source-upload-file">
                    <span className="source-upload-success">
                      ✓
                    </span>

                    <div>
                      <b>
                        {sourceUploadName}
                      </b>

                      <span>
                        {sourceAcquisition ===
                        "repository"
                          ? "Repository imported"
                          : `${(
                              sourceUploadSize /
                              1024
                            ).toFixed(1)} KB`}
                        {" · "}
                        {sourceDiscovery?.detectedFiles ?? 0}
                        {" files detected"}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="source-upload-replace"
                      onClick={() => {
                        setSourcePath("");
                        setIacPath("");
                        setSourceUploadName("");
                        setSourceUploadSize(0);
                        setSourceDiscovery(null);
                        setRepositoryUrl("");
                        setSourceAcquisition(null);
                      }}
                    >
                      Replace
                    </button>
                  </div>

                  <div className="source-discovery-grid">
                    <span
                      className={
                        sourceDiscovery?.sourceDetected
                          ? "detected"
                          : ""
                      }
                    >
                      {sourceDiscovery?.sourceDetected
                        ? "✓"
                        : "—"}{" "}
                      Source code
                    </span>

                    <span
                      className={
                        sourceDiscovery?.iacDetected
                          ? "detected"
                          : ""
                      }
                    >
                      {sourceDiscovery?.iacDetected
                        ? "✓"
                        : "—"}{" "}
                      Infrastructure as Code
                    </span>

                    <span
                      className={
                        sourceDiscovery?.dockerfileDetected
                          ? "detected"
                          : ""
                      }
                    >
                      {sourceDiscovery?.dockerfileDetected
                        ? "✓"
                        : "—"}{" "}
                      Dockerfile
                    </span>

                    <span
                      className={
                        (
                          sourceDiscovery
                            ?.dependencyFiles
                            ?.length ?? 0
                        ) > 0
                          ? "detected"
                          : ""
                      }
                    >
                      {(
                        sourceDiscovery
                          ?.dependencyFiles
                          ?.length ?? 0
                      ) > 0
                        ? "✓"
                        : "—"}{" "}
                      Dependencies
                    </span>
                  </div>

                  <div className="source-workspace-note">
                    <span>
                      INTERNAL WORKSPACE
                    </span>

                    <code>
                      {sourcePath}
                    </code>
                  </div>
                </div>
              )}
            </div>

            <label className="form-field">
              <span>DAST URL</span>

              <input
                value={dastUrl}
                onChange={(event) =>
                  setDastUrl(
                    event.target.value
                  )
                }
                placeholder="https://staging.example.com"
              />

              <small>
                OWASP ZAP target
              </small>
            </label>

            <label className="form-field">
              <span>
                Container image
              </span>

              <input
                value={containerImage}
                onChange={(event) =>
                  setContainerImage(
                    event.target.value
                  )
                }
                placeholder="app:latest"
              />

              <small>
                Trivy Container target
              </small>
            </label>

            <div className="asset-form-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={
                  creatingAsset ||
                  uploadingSource ||
                  importingRepository
                }
                onClick={() => {
                  resetForm();
                  setAssetError("");
                  setShowForm(false);
                }}
              >
                Cancel
              </button>

              <button
                className="primary-button"
                type="submit"
                disabled={
                  creatingAsset ||
                  uploadingSource ||
                  importingRepository
                }
              >
                {creatingAsset
                  ? "Creating..."
                  : uploadingSource
                    ? "Processing source..."
                    : importingRepository
                      ? "Importing repository..."
                      : "Create asset"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="assets-layout">
        <article
          className="panel asset-inventory"
        >
          <div className="panel-title">
            <div>
              <h3>
                Asset inventory
              </h3>

              <span className="panel-subtitle">
                {assets.length} managed asset
                {assets.length === 1
                  ? ""
                  : "s"}
              </span>
            </div>

            <span>
              Select one asset for assessment
            </span>
          </div>

          {loadingAssets ? (
            <p className="muted">
              Loading persisted assets...
            </p>
          ) : assets.length === 0 ? (
            <div className="asset-empty-state">
              No assets configured yet.
            </div>
          ) : (
            <div className="asset-table">
              <div className="asset-table-header">
                <span>ASSET</span>
                <span>TYPE</span>
                <span>ENVIRONMENT</span>
                <span>CRITICALITY</span>
              </div>

              {assets.map((asset) => {
                const selected =
                  selectedAssetId ===
                  asset.id;

                return (
                  <button
                    type="button"
                    className={
                      selected
                        ? "asset-row selected"
                        : "asset-row"
                    }
                    key={asset.id}
                    onClick={() =>
                      setSelectedAssetId(
                        asset.id
                      )
                    }
                  >
                    <span className="asset-identity">
                      <span
                        className={
                          selected
                            ? "asset-selector selected"
                            : "asset-selector"
                        }
                      />

                      <span>
                        <b>
                          {asset.name}
                        </b>

                        <small>
                          ASG-AST-
                          {String(
                            asset.id
                          ).padStart(
                            4,
                            "0"
                          )}
                        </small>
                      </span>
                    </span>

                    <span>
                      {asset.type}
                    </span>

                    <span>
                      <span className="neutral-tag">
                        {asset.environment}
                      </span>
                    </span>

                    <span>
                      <span
                        className={
                          `criticality-tag ` +
                          asset.criticality
                            .toLowerCase()
                        }
                      >
                        {asset.criticality}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </article>

        <aside
          className="panel assessment-launcher"
        >
          <p className="eyebrow">
            ASSESSMENT TARGET
          </p>

          <h3>
            Run security assessment
          </h3>

          {selectedAsset ? (
            <>
              <div className="selected-asset-card">
                <div className="selected-asset-card-heading">
                  <small>
                    SELECTED ASSET
                  </small>

                  <span
                    className={
                      profileConfigured
                        ? "profile-status configured"
                        : "profile-status unconfigured"
                    }
                  >
                    {profileConfigured
                      ? "CONFIGURED"
                      : "NOT CONFIGURED"}
                  </span>
                </div>

                <b>
                  {selectedAsset.name}
                </b>

                <span>
                  {selectedAsset.type}
                  {" · "}
                  {selectedAsset.environment}
                </span>
              </div>

              <div className="assessment-summary">
                <div>
                  <span>
                    Criticality
                  </span>

                  <b>
                    {
                      selectedAsset.criticality
                    }
                  </b>
                </div>

                <div>
                  <span>
                    Assessment mode
                  </span>

                  <b>
                    {assessmentMode}
                  </b>
                </div>

                <div>
                  <span>
                    Required scanners
                  </span>

                  <b>
                    {requiredScannerCount}/6
                  </b>
                </div>
              </div>

              <div className="scan-profile-card">
                <div className="scan-profile-card-header">
                  <span>
                    SECURITY SCAN PROFILE
                  </span>

                  <b>
                    {configuredTargets}/4
                  </b>
                </div>

                <div className="scan-profile-values">
                  <div>
                    <span>
                      Source
                    </span>

                    <code>
                      {selectedProfile
                        ?.sourcePath ||
                        "Not configured"}
                    </code>
                  </div>

                  <div>
                    <span>IaC</span>

                    <code>
                      {selectedProfile
                        ?.iacPath ||
                        selectedProfile
                          ?.sourcePath ||
                        "Not configured"}
                    </code>
                  </div>

                  <div>
                    <span>DAST</span>

                    <code>
                      {selectedProfile
                        ?.dastUrl ||
                        "Not configured"}
                    </code>
                  </div>

                  <div>
                    <span>
                      Container
                    </span>

                    <code>
                      {selectedProfile
                        ?.containerImage ||
                        "Not configured"}
                    </code>
                  </div>
                </div>
              </div>

              <p className="muted">
                AppSecGate resolves persisted
                scanner targets server-side,
                collects evidence, correlates
                security signals, and calculates
                the release decision.
              </p>

              {assessmentRunError && (
                <div className="assessment-run-error">
                  <b>Assessment failed</b>
                  <span>
                    {assessmentRunError}
                  </span>
                </div>
              )}

              {assessmentRunning && (
                <div className="assessment-running-state">
                  <span className="assessment-running-dot" />

                  <div>
                    <b>
                      Security assessment running
                    </b>

                    <span>
                      Executing applicable scanners
                      against the selected asset.
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="run-assessment-button"
                onClick={
                  handleRunAssessment
                }
                disabled={
                  assessmentRunning
                }
              >
                {assessmentRunning
                  ? "Running security assessment..."
                  : "Run assessment →"}
              </button>
            </>
          ) : (
            <p className="muted">
              Select an asset from the
              inventory before running an
              assessment.
            </p>
          )}
        </aside>
      </section>
    </>
  );
}
