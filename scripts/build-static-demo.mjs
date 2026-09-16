import {
  existsSync,
  renameSync,
} from "node:fs";

import { spawnSync } from "node:child_process";

const apiDir = "src/app/api";
const parkedApiDir = ".appsecgate-static-api-backup";

function restoreApi() {
  if (
    existsSync(parkedApiDir) &&
    !existsSync(apiDir)
  ) {
    renameSync(parkedApiDir, apiDir);
    console.log("✓ Restored src/app/api");
  }
}

try {
  if (existsSync(parkedApiDir)) {
    throw new Error(
      `${parkedApiDir} already exists. Refusing to overwrite it.`
    );
  }

  if (existsSync(apiDir)) {
    renameSync(apiDir, parkedApiDir);
    console.log(
      "✓ Parked API routes for static export"
    );
  }

  const result = spawnSync(
    "npx",
    ["next", "build"],
    {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        NEXT_PUBLIC_APPSECGATE_DEMO: "true",
        NEXT_PUBLIC_APPSECGATE_BASE_PATH:
          "/appsecgate-platform",
        APPSECGATE_STATIC_EXPORT: "true",
      },
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  }
} finally {
  restoreApi();
}
