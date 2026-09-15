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

  const [iacUploadName, setIacUploadName] =
    useState("");

  const [iacUploadSize, setIacUploadSize] =
    useState(0);

  const [uploadingIac, setUploadingIac] =
    useState(false);

  const [
    iacAcquisition,
    setIacAcquisition,
  ] = useState<
    "source" | "upload" | null
  >(null);

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
    validatingDast,
    setValidatingDast,
  ] = useState(false);

  const [
    dastValidated,
    setDastValidated,
  ] = useState(false);

  const [
    dastHostname,
    setDastHostname,
  ] = useState("");

  const [
    dastAllowedBy,
    setDastAllowedBy,
  ] = useState<
    "public-network" |
    "explicit-allowlist" |
    ""
  >("");

  const [
    containerImage,
    setContainerImage,
  ] = useState("");

  const [
    validatingContainer,
    setValidatingContainer,
  ] = useState(false);

  const [
    containerValidated,
    setContainerValidated,
  ] = useState(false);

  const [
    containerImageId,
    setContainerImageId,
  ] = useState("");

  const [
    containerArchivePath,
    setContainerArchivePath,
  ] = useState("");

  const [
    containerArchiveName,
    setContainerArchiveName,
  ] = useState("");

  const [
    containerArchiveSize,
    setContainerArchiveSize,
  ] = useState(0);

  const [
    uploadingContainerArchive,
    setUploadingContainerArchive,
  ] = useState(false);

  const [
    containerAcquisition,
    setContainerAcquisition,
  ] = useState<
    "image" | "archive" | null
  >(null);

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
          selectedProfile.containerImage ||
          selectedProfile.containerArchivePath
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

      setIacAcquisition(
        upload.discovery?.iacDetected
          ? "source"
          : null
      );

      setIacUploadName("");
      setIacUploadSize(0);

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

  async function handleDastValidation() {
    const target =
      dastUrl.trim();

    if (!target) {
      setAssetError(
        "Enter a DAST target URL first."
      );
      return;
    }

    try {
      setValidatingDast(true);
      setAssetError("");

      const response =
        await fetch(
          "/api/inputs/dast/validate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              dastUrl: target,
            }),
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to validate DAST target."
        );
      }

      setDastUrl(
        payload.data.dastUrl
      );

      setDastHostname(
        payload.data.hostname || ""
      );

      setDastAllowedBy(
        payload.data.allowedBy || ""
      );

      setDastValidated(true);
    } catch (error) {
      setDastValidated(false);
      setDastHostname("");
      setDastAllowedBy("");

      setAssetError(
        error instanceof Error
          ? error.message
          : "Unable to validate DAST target."
      );
    } finally {
      setValidatingDast(false);
    }
  }

  async function handleContainerArchiveUpload(
    file: File
  ) {
    if (
      !file.name
        .toLowerCase()
        .endsWith(".tar")
    ) {
      setAssetError(
        "Container archive must be a Docker/OCI TAR file."
      );
      return;
    }

    try {
      setUploadingContainerArchive(true);
      setAssetError("");

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/uploads/container",
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
            "Unable to upload container archive."
        );
      }

      const upload =
        payload.data;

      setContainerArchivePath(
        upload.containerArchivePath
      );

      setContainerArchiveName(
        upload.originalName
      );

      setContainerArchiveSize(
        upload.uploadSize
      );

      setContainerAcquisition(
        "archive"
      );

      /*
       * Image reference and uploaded archive
       * are mutually exclusive inputs.
       */
      setContainerImage("");
      setContainerValidated(false);
      setContainerImageId("");
    } catch (error) {
      setContainerArchivePath("");
      setContainerArchiveName("");
      setContainerArchiveSize(0);
      setContainerAcquisition(null);

      setAssetError(
        error instanceof Error
          ? error.message
          : "Unable to upload container archive."
      );
    } finally {
      setUploadingContainerArchive(false);
    }
  }

  async function handleContainerValidation() {
    const cleanImage =
      containerImage.trim();

    if (!cleanImage) {
      setAssetError(
        "Container image reference is required."
      );
      return;
    }

    try {
      setValidatingContainer(true);
      setContainerValidated(false);
      setContainerImageId("");
      setAssetError("");

      const response =
        await fetch(
          "/api/inputs/container/validate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              containerImage:
                cleanImage,
            }),
          }
        );

      const payload =
        await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Unable to validate container image."
        );
      }

      setContainerImage(
        payload.data.containerImage
      );

      setContainerValidated(true);

      setContainerImageId(
        payload.data.imageId || ""
      );

      setContainerAcquisition(
        "image"
      );

      setContainerArchivePath("");
      setContainerArchiveName("");
      setContainerArchiveSize(0);
    } catch (error) {
      setContainerValidated(false);
      setContainerImageId("");

      setAssetError(
        error instanceof Error
          ? error.message
          : "Unable to validate container image."
      );
    } finally {
      setValidatingContainer(false);
    }
  }

  async function handleIacUpload(
    file: File
  ) {
    if (
      !file.name
        .toLowerCase()
        .endsWith(".zip")
    ) {
      setAssetError(
        "Infrastructure as Code must be uploaded as a ZIP archive."
      );
      return;
    }

    try {
      setUploadingIac(true);
      setAssetError("");

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/uploads/iac",
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
            "Unable to upload IaC archive."
        );
      }

      const upload =
        payload.data;

      setIacPath(
        upload.iacPath
      );

      setIacUploadName(
        upload.originalName
      );

      setIacUploadSize(
        upload.uploadSize
      );

      setIacAcquisition(
        "upload"
      );
    } catch (error) {
      setIacPath("");
      setIacUploadName("");
      setIacUploadSize(0);
      setIacAcquisition(null);

      setAssetError(
        error instanceof Error
          ? error.message
          : "Unable to upload IaC archive."
      );
    } finally {
      setUploadingIac(false);
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

      setIacAcquisition(
        imported.discovery?.iacDetected
          ? "source"
          : null
      );

      setIacUploadName("");
      setIacUploadSize(0);

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
    setDastValidated(false);
    setDastHostname("");
    setDastAllowedBy("");
    setValidatingDast(false);
    setContainerImage("");
    setContainerValidated(false);
    setContainerImageId("");
    setValidatingContainer(false);

    setContainerArchivePath("");
    setContainerArchiveName("");
    setContainerArchiveSize(0);
    setUploadingContainerArchive(false);
    setContainerAcquisition(null);

    setSourceUploadName("");
    setSourceUploadSize(0);
    setSourceDiscovery(null);

    setRepositoryUrl("");
    setSourceAcquisition(null);
    setImportingRepository(false);

    setIacUploadName("");
    setIacUploadSize(0);
    setUploadingIac(false);
    setIacAcquisition(null);
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

    if (
      dastUrl.trim() &&
      !dastValidated
    ) {
      setAssetError(
        "Validate the DAST target before creating the asset."
      );
      return;
    }

    if (
      containerImage.trim() &&
      !containerValidated
    ) {
      setAssetError(
        "Validate the container image before creating the asset."
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

        containerArchivePath:
          containerArchivePath.trim() ||
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

            <div className="security-input-iac">
              <div className="security-input-source-head">
                <div>
                  <span className="security-input-label">
                    INFRASTRUCTURE AS CODE
                  </span>

                  <b>
                    Infrastructure configuration
                  </b>
                </div>

                <span className="security-input-tools">
                  Checkov
                </span>
              </div>

              {iacPath ? (
                <div className="iac-input-result">
                  <div>
                    <span className="source-upload-success">
                      ✓
                    </span>

                    <div>
                      <b>
                        {iacAcquisition === "source"
                          ? "IaC auto-detected from source"
                          : iacUploadName ||
                            "IaC workspace ready"}
                      </b>

                      <span>
                        {iacAcquisition === "source"
                          ? "Using the application source workspace"
                          : `${(
                              iacUploadSize /
                              1024
                            ).toFixed(1)} KB · Separate IaC input`}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="source-upload-replace"
                    onClick={() => {
                      setIacPath("");
                      setIacUploadName("");
                      setIacUploadSize(0);
                      setIacAcquisition(null);
                    }}
                  >
                    {iacAcquisition === "source"
                      ? "Use separate IaC"
                      : "Replace"}
                  </button>
                </div>
              ) : (
                <label
                  className={
                    "iac-upload-zone" +
                    (uploadingIac
                      ? " uploading"
                      : "")
                  }
                >
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    disabled={
                      uploadingIac ||
                      creatingAsset
                    }
                    onChange={(event) => {
                      const file =
                        event.target.files?.[0];

                      if (file) {
                        void handleIacUpload(
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

                  <div>
                    <b>
                      {uploadingIac
                        ? "Uploading & validating IaC..."
                        : "Upload separate IaC ZIP"}
                    </b>

                    <small>
                      Terraform · YAML · Kubernetes ·
                      CloudFormation · Maximum 25 MB
                    </small>
                  </div>
                </label>
              )}
            </div>

            <div className="security-input-container dast-input-container">
              <div className="security-input-source-head">
                <div>
                  <span className="security-input-label">
                    DAST TARGET
                  </span>

                  <b>
                    Dynamic application target
                  </b>
                </div>

                <span className="security-input-tools">
                  OWASP ZAP
                </span>
              </div>

              {dastValidated ? (
                <div className="container-input-result">
                  <div>
                    <span className="source-upload-success">
                      ✓
                    </span>

                    <div>
                      <b>
                        {dastHostname ||
                          dastUrl}
                      </b>

                      <span>
                        Target validated · Ready for
                        OWASP ZAP
                      </span>

                      <code>
                        {dastUrl}
                      </code>

                      <span>
                        {dastAllowedBy ===
                        "explicit-allowlist"
                          ? "Explicitly allowlisted target"
                          : "Public network target"}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="source-upload-replace"
                    onClick={() => {
                      setDastValidated(false);
                      setDastHostname("");
                      setDastAllowedBy("");
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="container-input-controls">
                  <input
                    value={dastUrl}
                    disabled={
                      validatingDast ||
                      creatingAsset
                    }
                    onChange={(event) => {
                      setDastUrl(
                        event.target.value
                      );

                      setDastValidated(false);
                      setDastHostname("");
                      setDastAllowedBy("");
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter"
                      ) {
                        event.preventDefault();

                        void handleDastValidation();
                      }
                    }}
                    placeholder="https://staging.example.com"
                  />

                  <button
                    type="button"
                    disabled={
                      validatingDast ||
                      !dastUrl.trim()
                    }
                    onClick={() =>
                      void handleDastValidation()
                    }
                  >
                    {validatingDast
                      ? "Validating..."
                      : "Validate target"}
                  </button>
                </div>
              )}

              <small className="container-input-note">
                HTTP/HTTPS target · SSRF-aware network
                policy · OWASP ZAP
              </small>
            </div>

            <div className="security-input-container">
              <div className="security-input-source-head">
                <div>
                  <span className="security-input-label">
                    CONTAINER IMAGE
                  </span>

                  <b>
                    Container vulnerability target
                  </b>
                </div>

                <span className="security-input-tools">
                  Trivy Container
                </span>
              </div>

              {containerAcquisition === "archive" &&
              containerArchivePath ? (
                <div className="container-input-result">
                  <div>
                    <span className="source-upload-success">
                      ✓
                    </span>

                    <div>
                      <b>
                        {containerArchiveName}
                      </b>

                      <span>
                        {(
                          containerArchiveSize /
                          1024 /
                          1024
                        ).toFixed(2)} MB · Docker/OCI
                        archive ready
                      </span>

                      <span>
                        Scanned directly · Image is not
                        loaded or executed
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="source-upload-replace"
                    onClick={() => {
                      setContainerArchivePath("");
                      setContainerArchiveName("");
                      setContainerArchiveSize(0);
                      setContainerAcquisition(null);
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : containerValidated ? (
                <div className="container-input-result">
                  <div>
                    <span className="source-upload-success">
                      ✓
                    </span>

                    <div>
                      <b>
                        {containerImage}
                      </b>

                      <span>
                        Local image verified · Ready for
                        Trivy assessment
                      </span>

                      {containerImageId ? (
                        <code>
                          {containerImageId}
                        </code>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="source-upload-replace"
                    onClick={() => {
                      setContainerValidated(false);
                      setContainerImageId("");
                      setContainerImage("");
                      setContainerAcquisition(null);
                    }}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="container-input-controls">
                    <input
                      value={containerImage}
                      disabled={
                        validatingContainer ||
                        uploadingContainerArchive ||
                        creatingAsset
                      }
                      onChange={(event) => {
                        setContainerImage(
                          event.target.value
                        );

                        setContainerValidated(false);
                        setContainerImageId("");
                        setContainerAcquisition(null);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter"
                        ) {
                          event.preventDefault();

                          void handleContainerValidation();
                        }
                      }}
                      placeholder="appsecgate-vulnerable-test:latest"
                    />

                    <button
                      type="button"
                      disabled={
                        validatingContainer ||
                        uploadingContainerArchive ||
                        !containerImage.trim()
                      }
                      onClick={() =>
                        void handleContainerValidation()
                      }
                    >
                      {validatingContainer
                        ? "Validating..."
                        : "Validate image"}
                    </button>
                  </div>

                  <div className="container-input-divider">
                    <span>OR</span>
                  </div>

                  <label
                    className={
                      "container-archive-upload" +
                      (uploadingContainerArchive
                        ? " uploading"
                        : "")
                    }
                  >
                    <input
                      type="file"
                      accept=".tar,application/x-tar"
                      disabled={
                        uploadingContainerArchive ||
                        validatingContainer ||
                        creatingAsset
                      }
                      onChange={(event) => {
                        const file =
                          event.target.files?.[0];

                        if (file) {
                          void handleContainerArchiveUpload(
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

                    <div>
                      <b>
                        {uploadingContainerArchive
                          ? "Uploading container archive..."
                          : "Upload Docker / OCI TAR"}
                      </b>

                      <small>
                        Stored as an opaque artifact ·
                        Maximum 1 GB
                      </small>
                    </div>
                  </label>
                </>
              )}

              <small className="container-input-note">
                Image reference or Docker/OCI TAR · Trivy
                vulnerability assessment
              </small>
            </div>

            <div className="asset-form-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={
                  creatingAsset ||
                  uploadingSource ||
                  importingRepository ||
                  uploadingIac ||
                  validatingContainer
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
                  importingRepository ||
                  uploadingIac ||
                  validatingContainer
                }
              >
                {creatingAsset
                  ? "Creating..."
                  : uploadingSource
                    ? "Processing source..."
                    : importingRepository
                      ? "Importing repository..."
                      : uploadingIac
                        ? "Processing IaC..."
                        : validatingContainer
                          ? "Validating container..."
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
                        selectedProfile
                          ?.containerArchivePath ||
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
