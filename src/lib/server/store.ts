import { promises as fs } from "fs";
import path from "path";
import type { Asset } from "../../data/appsecgate";
import { initialAssets } from "../../data/appsecgate";

type AppSecGateStore = {
  assets: Asset[];
};

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "appsecgate.json");

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    await fs.access(STORE_FILE);
  } catch {
    const initialStore: AppSecGateStore = {
      assets: initialAssets,
    };

    await fs.writeFile(
      STORE_FILE,
      JSON.stringify(initialStore, null, 2),
      "utf8"
    );
  }
}

async function readStore(): Promise<AppSecGateStore> {
  await ensureStore();

  const raw = await fs.readFile(STORE_FILE, "utf8");
  return JSON.parse(raw) as AppSecGateStore;
}

async function writeStore(store: AppSecGateStore): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  await fs.writeFile(
    STORE_FILE,
    JSON.stringify(store, null, 2),
    "utf8"
  );
}

export async function listAssets(): Promise<Asset[]> {
  const store = await readStore();
  return store.assets;
}

export async function createAsset(
  input: Omit<Asset, "id">
): Promise<Asset> {
  const store = await readStore();

  const nextId =
    store.assets.length === 0
      ? 1
      : Math.max(...store.assets.map((asset) => asset.id)) + 1;

  const asset: Asset = {
    id: nextId,
    ...input,
  };

  store.assets.push(asset);
  await writeStore(store);

  return asset;
}
