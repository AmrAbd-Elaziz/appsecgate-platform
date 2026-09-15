import path from "node:path";
import fs from "node:fs/promises";

export const WORKSPACE_ROOT = path.join(
  process.cwd(),
  "data",
  "workspaces"
);

export type WorkspaceDiscovery = {
  sourceDetected: boolean;
  iacDetected: boolean;
  dockerfileDetected: boolean;
  dependencyFiles: string[];
  detectedFiles: number;
};

export function getAssetWorkspace(
  workspaceId: string
): string {
  return path.join(
    WORKSPACE_ROOT,
    workspaceId
  );
}

export function getSourceWorkspace(
  workspaceId: string
): string {
  return path.join(
    getAssetWorkspace(workspaceId),
    "source"
  );
}

export async function ensureWorkspaceRoot() {
  await fs.mkdir(
    WORKSPACE_ROOT,
    {
      recursive: true,
    }
  );
}

export async function createSourceWorkspace(
  workspaceId: string
): Promise<string> {
  const target =
    getSourceWorkspace(workspaceId);

  await fs.mkdir(
    target,
    {
      recursive: true,
    }
  );

  return target;
}

export async function removeWorkspace(
  workspaceId: string
) {
  const target =
    getAssetWorkspace(workspaceId);

  await fs.rm(
    target,
    {
      recursive: true,
      force: true,
    }
  );
}

async function walk(
  directory: string,
  root: string,
  result: string[]
) {
  const entries =
    await fs.readdir(
      directory,
      {
        withFileTypes: true,
      }
    );

  for (const entry of entries) {
    const fullPath =
      path.join(
        directory,
        entry.name
      );

    if (entry.isSymbolicLink()) {
      continue;
    }

    if (entry.isDirectory()) {
      /*
       * Avoid scanning common generated/dependency
       * directories during workspace discovery.
       */
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".next" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }

      await walk(
        fullPath,
        root,
        result
      );

      continue;
    }

    if (entry.isFile()) {
      result.push(
        path.relative(
          root,
          fullPath
        )
      );
    }
  }
}

export async function discoverWorkspace(
  sourcePath: string
): Promise<WorkspaceDiscovery> {
  const files: string[] = [];

  await walk(
    sourcePath,
    sourcePath,
    files
  );

  const lowerFiles =
    files.map((file) =>
      file.toLowerCase()
    );

  const sourceExtensions = [
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".java",
    ".go",
    ".rb",
    ".php",
    ".cs",
    ".cpp",
    ".c",
    ".rs",
  ];

  const sourceDetected =
    lowerFiles.some((file) =>
      sourceExtensions.some(
        (extension) =>
          file.endsWith(extension)
      )
    );

  const iacDetected =
    lowerFiles.some(
      (file) =>
        file.endsWith(".tf") ||
        file.endsWith(".tf.json") ||
        file.endsWith(".yaml") ||
        file.endsWith(".yml")
    );

  const dockerfileDetected =
    lowerFiles.some((file) => {
      const name =
        path.basename(file);

      return (
        name === "dockerfile" ||
        name.startsWith(
          "dockerfile."
        )
      );
    });

  const dependencyNames = new Set([
    "package.json",
    "package-lock.json",
    "requirements.txt",
    "poetry.lock",
    "pipfile",
    "pipfile.lock",
    "pom.xml",
    "build.gradle",
    "go.mod",
    "go.sum",
    "gemfile",
    "gemfile.lock",
    "composer.json",
    "composer.lock",
  ]);

  const dependencyFiles =
    files.filter((file) =>
      dependencyNames.has(
        path
          .basename(file)
          .toLowerCase()
      )
    );

  return {
    sourceDetected,
    iacDetected,
    dockerfileDetected,
    dependencyFiles,
    detectedFiles:
      files.length,
  };
}
