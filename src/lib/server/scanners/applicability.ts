import type {
  Asset,
} from "../../../data/appsecgate";

import type {
  ScannerAdapter,
} from "./types";

export type ScannerApplicability = {
  adapter: ScannerAdapter;
  required: boolean;
  reason: string;
};

function hasValue(
  value: string | undefined
): boolean {
  return Boolean(value?.trim());
}

/*
 * Asset scanner applicability policy
 *
 * Legacy assets:
 *   Assets created before scan profiles existed have
 *   no scanProfile property. They retain the original
 *   six-scanner full security gate.
 *
 * Profile-aware assets:
 *
 * sourcePath:
 *   Semgrep
 *   Gitleaks
 *   Trivy FS
 *
 * iacPath:
 *   Checkov
 *
 * Checkov also falls back to sourcePath.
 *
 * dastUrl:
 *   OWASP ZAP
 *
 * containerImage / containerArchivePath:
 *   Trivy Container
 */
export function resolveScannerApplicability(
  asset: Asset,
  adapters: ScannerAdapter[]
): ScannerApplicability[] {
  const profile = asset.scanProfile;

  /*
   * Backward compatibility for assets created
   * before persisted scan profiles were introduced.
   */
  if (!profile) {
    return adapters.map((adapter) => ({
      adapter,
      required: true,
      reason:
        "Legacy asset uses full security gate.",
    }));
  }

  const hasSource =
    hasValue(profile.sourcePath);

  const hasIac =
    hasValue(profile.iacPath);

  const hasDastUrl =
    hasValue(profile.dastUrl);

  const hasDastOpenApi =
    hasValue(
      profile.dastOpenApiPath
    );

  const hasDast =
    hasDastUrl ||
    hasDastOpenApi;

  const hasContainerImage =
    hasValue(profile.containerImage);

  const hasContainerArchive =
    hasValue(
      profile.containerArchivePath
    );

  const hasContainer =
    hasContainerImage ||
    hasContainerArchive;

  return adapters.map((adapter) => {
    switch (adapter.name) {
      case "Semgrep":
        return {
          adapter,
          required: hasSource,
          reason: hasSource
            ? "sourcePath configured."
            : "sourcePath not configured.",
        };

      case "Gitleaks":
        return {
          adapter,
          required: hasSource,
          reason: hasSource
            ? "sourcePath configured."
            : "sourcePath not configured.",
        };

      case "Trivy FS":
        return {
          adapter,
          required: hasSource,
          reason: hasSource
            ? "sourcePath configured."
            : "sourcePath not configured.",
        };

      case "Checkov":
        return {
          adapter,
          required:
            hasIac || hasSource,
          reason: hasIac
            ? "iacPath configured."
            : hasSource
              ? "sourcePath configured as IaC fallback."
              : "No IaC or source path configured.",
        };

      case "OWASP ZAP":
        return {
          adapter,
          required: hasDast,
          reason: hasDastUrl
            ? "dastUrl configured."
            : hasDastOpenApi
              ? "dastOpenApiPath configured."
              : "No DAST input configured.",
        };

      case "Trivy Container":
        return {
          adapter,
          required: hasContainer,
          reason: hasContainerImage
            ? "containerImage configured."
            : hasContainerArchive
              ? "containerArchivePath configured."
              : "No container input configured.",
        };

      default:
        /*
         * Fail closed for newly registered scanners.
         *
         * A scanner added to the registry must not be
         * silently skipped simply because applicability
         * policy has not yet been defined for it.
         */
        return {
          adapter,
          required: true,
          reason:
            "No applicability policy defined; required by default.",
        };
    }
  });
}

export function getRequiredScannerAdapters(
  asset: Asset,
  adapters: ScannerAdapter[]
): ScannerAdapter[] {
  return resolveScannerApplicability(
    asset,
    adapters
  )
    .filter((entry) => entry.required)
    .map((entry) => entry.adapter);
}
