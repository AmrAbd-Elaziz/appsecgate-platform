import {
  NextResponse,
} from "next/server";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

import {
  createSourceWorkspace,
  discoverWorkspace,
  ensureWorkspaceRoot,
  removeWorkspace,
} from "../../../../lib/server/workspaces/workspace";

export const runtime = "nodejs";

const CLONE_TIMEOUT_MS = 60_000;

function createWorkspaceId() {
  return (
    "WS-" +
    Date.now()
      .toString(36)
      .toUpperCase() +
    "-" +
    crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()
  );
}

function validateRepositoryUrl(
  input: unknown
): URL {
  if (
    typeof input !== "string" ||
    !input.trim()
  ) {
    throw new Error(
      "Repository URL is required."
    );
  }

  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error(
      "Repository URL is invalid."
    );
  }

  if (url.protocol !== "https:") {
    throw new Error(
      "Only HTTPS repositories are supported."
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new Error(
      "Repository URLs must not contain credentials."
    );
  }

  if (!url.hostname) {
    throw new Error(
      "Repository hostname is required."
    );
  }

  const hostname =
    url.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  ) {
    throw new Error(
      "Local repository hosts are not allowed."
    );
  }

  return url;
}

function cloneRepository(
  repositoryUrl: string,
  sourcePath: string
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      const child = spawn(
        "git",
        [
          "clone",
          "--depth",
          "1",
          "--single-branch",
          "--no-tags",
          repositoryUrl,
          sourcePath,
        ],
        {
          shell: false,
          stdio: [
            "ignore",
            "ignore",
            "pipe",
          ],
          env: {
            ...process.env,

            /*
             * Never allow git to prompt the
             * server process for credentials.
             */
            GIT_TERMINAL_PROMPT: "0",
          },
        }
      );

      let stderr = "";

      child.stderr.on(
        "data",
        (chunk) => {
          stderr += chunk.toString();

          if (stderr.length > 8000) {
            stderr =
              stderr.slice(-8000);
          }
        }
      );

      const timer = setTimeout(
        () => {
          child.kill("SIGKILL");
        },
        CLONE_TIMEOUT_MS
      );

      child.on(
        "error",
        (error) => {
          clearTimeout(timer);
          reject(error);
        }
      );

      child.on(
        "close",
        (code, signal) => {
          clearTimeout(timer);

          if (code === 0) {
            resolve();
            return;
          }

          if (signal === "SIGKILL") {
            reject(
              new Error(
                "Repository clone timed out."
              )
            );
            return;
          }

          const safeMessage =
            stderr
              .replace(
                /https:\/\/[^@\s]+@/gi,
                "https://"
              )
              .trim();

          reject(
            new Error(
              safeMessage ||
                "Repository clone failed."
            )
          );
        }
      );
    }
  );
}

export async function POST(
  request: Request
) {
  let workspaceId:
    | string
    | undefined;

  try {
    const body =
      await request.json();

    const repositoryUrl =
      validateRepositoryUrl(
        body?.repositoryUrl
      );

    await ensureWorkspaceRoot();

    workspaceId =
      createWorkspaceId();

    /*
     * createSourceWorkspace() normally
     * creates source/. Git requires the
     * destination not to exist for this
     * acquisition flow, so create the
     * workspace and remove the empty
     * source directory before cloning.
     */
    const sourcePath =
      await createSourceWorkspace(
        workspaceId
      );

    await fs.rm(
      sourcePath,
      {
        recursive: true,
        force: true,
      }
    );

    await cloneRepository(
      repositoryUrl.toString(),
      sourcePath
    );

    const discovery =
      await discoverWorkspace(
        sourcePath
      );

    const repositoryName =
      repositoryUrl.pathname
        .split("/")
        .filter(Boolean)
        .at(-1)
        ?.replace(/\.git$/i, "") ||
      "repository";

    return NextResponse.json(
      {
        data: {
          workspaceId,
          sourcePath,
          repositoryUrl:
            repositoryUrl.toString(),
          repositoryName,
          discovery,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    if (workspaceId) {
      await removeWorkspace(
        workspaceId
      ).catch(() => {});
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unable to import repository.";

    const validationError =
      message ===
        "Repository URL is required." ||
      message ===
        "Repository URL is invalid." ||
      message ===
        "Only HTTPS repositories are supported." ||
      message ===
        "Repository URLs must not contain credentials." ||
      message ===
        "Repository hostname is required." ||
      message ===
        "Local repository hosts are not allowed.";

    console.error(
      "[AppSecGate] Repository import failed:",
      message
    );

    return NextResponse.json(
      {
        error:
          validationError
            ? message
            : "Unable to import repository. Confirm that it is a public HTTPS Git repository.",
      },
      {
        status:
          validationError
            ? 400
            : 422,
      }
    );
  }
}
