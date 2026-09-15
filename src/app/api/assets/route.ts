import { NextResponse } from "next/server";
import {
  createAsset,
  listAssets,
} from "../../../lib/server/store";
import type {
  AssetType,
  Criticality,
  Environment,
} from "../../../data/appsecgate";

const assetTypes: AssetType[] = [
  "Web Application",
  "API",
  "Container",
  "Cloud Infrastructure",
  "Repository",
];

const environments: Environment[] = [
  "Production",
  "Staging",
  "Development",
];

const criticalities: Criticality[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
];

export async function GET() {
  const assets = await listAssets();

  return NextResponse.json({
    data: assets,
    count: assets.length,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name =
      typeof body.name === "string"
        ? body.name.trim()
        : "";

    if (!name) {
      return NextResponse.json(
        { error: "Asset name is required." },
        { status: 400 }
      );
    }

    if (!assetTypes.includes(body.type)) {
      return NextResponse.json(
        { error: "Invalid asset type." },
        { status: 400 }
      );
    }

    if (!environments.includes(body.environment)) {
      return NextResponse.json(
        { error: "Invalid environment." },
        { status: 400 }
      );
    }

    if (!criticalities.includes(body.criticality)) {
      return NextResponse.json(
        { error: "Invalid criticality." },
        { status: 400 }
      );
    }

    const asset = await createAsset({
      name,
      type: body.type,
      environment: body.environment,
      criticality: body.criticality,
    });

    return NextResponse.json(
      { data: asset },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
