import dns from "node:dns/promises";
import net from "node:net";

export class DastTargetPolicyError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "DastTargetPolicyError";
  }
}

/*
 * Explicit development/lab destinations.
 *
 * Do not treat arbitrary private hosts as safe.
 * Production deployments should configure their
 * own controlled allowlist.
 */
const BUILTIN_ALLOWED_HOSTS =
  new Set([
    "appsecgate-zap-target",
  ]);

function configuredAllowedHosts():
  Set<string> {
  const configured =
    (
      process.env
        .APPSECGATE_DAST_ALLOWED_HOSTS ||
      ""
    )
      .split(",")
      .map((value) =>
        value
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);

  return new Set([
    ...BUILTIN_ALLOWED_HOSTS,
    ...configured,
  ]);
}

function isPrivateIPv4(
  address: string
): boolean {
  const parts =
    address
      .split(".")
      .map(Number);

  if (
    parts.length !== 4 ||
    parts.some(
      (part) =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
    )
  ) {
    return true;
  }

  const [a, b] = parts;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (
      a === 169 &&
      b === 254
    ) ||
    (
      a === 172 &&
      b >= 16 &&
      b <= 31
    ) ||
    (
      a === 192 &&
      b === 168
    ) ||
    (
      a === 100 &&
      b >= 64 &&
      b <= 127
    ) ||
    a >= 224
  );
}

function isPrivateIPv6(
  address: string
): boolean {
  const normalized =
    address
      .toLowerCase()
      .split("%")[0];

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith(
      "fc"
    ) ||
    normalized.startsWith(
      "fd"
    ) ||
    normalized.startsWith(
      "fe8"
    ) ||
    normalized.startsWith(
      "fe9"
    ) ||
    normalized.startsWith(
      "fea"
    ) ||
    normalized.startsWith(
      "feb"
    ) ||
    normalized.startsWith(
      "::ffff:127."
    ) ||
    normalized.startsWith(
      "::ffff:10."
    ) ||
    normalized.startsWith(
      "::ffff:192.168."
    )
  );
}

function isPrivateAddress(
  address: string
): boolean {
  const family =
    net.isIP(address);

  if (family === 4) {
    return isPrivateIPv4(
      address
    );
  }

  if (family === 6) {
    return isPrivateIPv6(
      address
    );
  }

  return true;
}

export type ValidatedDastTarget = {
  dastUrl: string;
  hostname: string;
  protocol: "http:" | "https:";
  allowedBy:
    | "public-network"
    | "explicit-allowlist";
  resolvedAddresses: string[];
};

export async function validateDastTarget(
  input: string
): Promise<ValidatedDastTarget> {
  let url: URL;

  try {
    url =
      new URL(
        input.trim()
      );
  } catch {
    throw new DastTargetPolicyError(
      "DAST target must be a valid URL."
    );
  }

  if (
    url.protocol !== "http:" &&
    url.protocol !== "https:"
  ) {
    throw new DastTargetPolicyError(
      "DAST target must use HTTP or HTTPS."
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new DastTargetPolicyError(
      "DAST target must not contain credentials."
    );
  }

  const hostname =
    url.hostname
      .toLowerCase();

  if (!hostname) {
    throw new DastTargetPolicyError(
      "DAST target must contain a hostname."
    );
  }

  const allowedHosts =
    configuredAllowedHosts();

  if (
    allowedHosts.has(hostname)
  ) {
    return {
      dastUrl:
        url.toString(),
      hostname,
      protocol:
        url.protocol as
          | "http:"
          | "https:",
      allowedBy:
        "explicit-allowlist",
      resolvedAddresses: [],
    };
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(
      ".localhost"
    ) ||
    hostname.endsWith(
      ".local"
    )
  ) {
    throw new DastTargetPolicyError(
      "Local DAST targets are blocked unless explicitly allowlisted."
    );
  }

  if (net.isIP(hostname)) {
    if (
      isPrivateAddress(
        hostname
      )
    ) {
      throw new DastTargetPolicyError(
        "Private, loopback, link-local, and reserved DAST targets are blocked."
      );
    }

    return {
      dastUrl:
        url.toString(),
      hostname,
      protocol:
        url.protocol as
          | "http:"
          | "https:",
      allowedBy:
        "public-network",
      resolvedAddresses: [
        hostname,
      ],
    };
  }

  let resolved: Array<{
    address: string;
    family: number;
  }>;

  try {
    resolved =
      await dns.lookup(
        hostname,
        {
          all: true,
          verbatim: true,
        }
      );
  } catch {
    throw new DastTargetPolicyError(
      "DAST target hostname could not be resolved."
    );
  }

  if (
    resolved.length === 0
  ) {
    throw new DastTargetPolicyError(
      "DAST target hostname did not resolve to an address."
    );
  }

  const addresses =
    resolved.map(
      (entry) =>
        entry.address
    );

  if (
    addresses.some(
      isPrivateAddress
    )
  ) {
    throw new DastTargetPolicyError(
      "DAST target resolves to a private, loopback, link-local, or reserved address."
    );
  }

  return {
    dastUrl:
      url.toString(),
    hostname,
    protocol:
      url.protocol as
        | "http:"
        | "https:",
    allowedBy:
      "public-network",
    resolvedAddresses:
      addresses,
  };
}
