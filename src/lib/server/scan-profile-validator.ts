import path from "node:path";

import type {
  AssetScanProfile,
} from "../../data/appsecgate";

export class ScanProfileValidationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScanProfileValidationError";
  }
}

function validateLocalPath(
  value: string,
  field:
    | "sourcePath"
    | "iacPath"
    | "dastOpenApiPath"
    | "containerArchivePath"
): string {
  if (value.includes("\0")) {
    throw new ScanProfileValidationError(
      `${field} contains an invalid null byte.`
    );
  }

  if (!path.isAbsolute(value)) {
    throw new ScanProfileValidationError(
      `${field} must be an absolute path.`
    );
  }

  return path.normalize(value);
}

function validateDastUrl(
  value: string
): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new ScanProfileValidationError(
      "dastUrl must be a valid URL."
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new ScanProfileValidationError(
      "dastUrl must use HTTP or HTTPS."
    );
  }

  if (url.username || url.password) {
    throw new ScanProfileValidationError(
      "dastUrl must not contain credentials."
    );
  }

  if (!url.hostname) {
    throw new ScanProfileValidationError(
      "dastUrl must contain a hostname."
    );
  }

  return url.toString();
}

function validateContainerImage(
  value: string
): string {
  /*
   * Conservative Docker/OCI image reference syntax.
   * Allows examples such as:
   *
   * app:latest
   * namespace/app:1.2
   * registry.example.com/team/app:latest
   * localhost:5000/team/app:v1
   * app@sha256:<64 hex chars>
   *
   * No whitespace or shell metacharacters.
   */
  const imagePattern =
    /^(?:[a-zA-Z0-9.-]+(?::[0-9]+)?\/)?(?:[a-z0-9._-]+\/)*[a-z0-9._-]+(?::[A-Za-z0-9._-]+|@sha256:[a-fA-F0-9]{64})?$/;

  if (!imagePattern.test(value)) {
    throw new ScanProfileValidationError(
      "containerImage is not a valid Docker/OCI image reference."
    );
  }

  return value;
}

export function validateScanProfile(
  profile: AssetScanProfile
): AssetScanProfile {
  const validated: AssetScanProfile = {};

  if (profile.sourcePath) {
    validated.sourcePath =
      validateLocalPath(
        profile.sourcePath,
        "sourcePath"
      );
  }

  if (profile.iacPath) {
    validated.iacPath =
      validateLocalPath(
        profile.iacPath,
        "iacPath"
      );
  }

  if (profile.dastUrl) {
    validated.dastUrl =
      validateDastUrl(profile.dastUrl);
  }

  if (profile.dastOpenApiPath) {
    validated.dastOpenApiPath =
      validateLocalPath(
        profile.dastOpenApiPath,
        "dastOpenApiPath"
      );
  }

  if (profile.containerImage) {
    validated.containerImage =
      validateContainerImage(
        profile.containerImage
      );
  }

  if (profile.containerArchivePath) {
    validated.containerArchivePath =
      validateLocalPath(
        profile.containerArchivePath,
        "containerArchivePath"
      );
  }

  if (
    validated.dastOpenApiPath &&
    !validated.dastUrl
  ) {
    throw new ScanProfileValidationError(
      "OpenAPI DAST requires a validated DAST target URL."
    );
  }

  if (
    validated.containerImage &&
    validated.containerArchivePath
  ) {
    throw new ScanProfileValidationError(
      "Configure either containerImage or containerArchivePath, not both."
    );
  }

  return validated;
}
