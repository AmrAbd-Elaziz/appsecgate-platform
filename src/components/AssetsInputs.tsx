"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  type Asset,
  type AssetType,
  type Environment,
  type Criticality,
} from "../data/appsecgate";

type Props = {
  onRunAssessment: (asset: Asset) => void;
};

export default function AssetsInputs({ onRunAssessment }: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<number>(0);
  const [showForm, setShowForm] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetError, setAssetError] = useState("");

  const [name, setName] = useState("");
  const [type, setType] = useState<AssetType>("Web Application");
  const [environment, setEnvironment] =
    useState<Environment>("Production");
  const [criticality, setCriticality] =
    useState<Criticality>("High");

  useEffect(() => {
    let cancelled = false;

    async function loadAssets() {
      try {
        setLoadingAssets(true);
        setAssetError("");

        const response = await fetch("/api/assets", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load assets.");
        }

        const payload = await response.json();
        const loadedAssets = payload.data as Asset[];

        if (cancelled) {
          return;
        }

        setAssets(loadedAssets);

        if (loadedAssets.length > 0) {
          setSelectedAssetId((current) =>
            loadedAssets.some((asset) => asset.id === current)
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
    assets.find((asset) => asset.id === selectedAssetId) ?? null;

  async function handleAddAsset(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanName = name.trim();

    if (!cleanName) {
      return;
    }

    try {
      setAssetError("");

      const response = await fetch("/api/assets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          type,
          environment,
          criticality,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(
          payload.error || "Unable to create asset."
        );
      }

      const newAsset = payload.data as Asset;

      setAssets((current) => [...current, newAsset]);
      setSelectedAssetId(newAsset.id);

      setName("");
      setType("Web Application");
      setEnvironment("Production");
      setCriticality("High");
      setShowForm(false);
    } catch (error) {
      setAssetError(
        error instanceof Error
          ? error.message
          : "Unable to create asset."
      );
    }
  }

  function handleRunAssessment() {
    if (!selectedAsset) {
      return;
    }

    onRunAssessment(selectedAsset);
  }

  return (
    <>
      <header className="page-header assets-header">
        <div>
          <p className="eyebrow">ASSESSMENT SCOPE</p>
          <h1>Assets &amp; Inputs</h1>
          <p className="page-description">
            Define the applications, APIs, containers, repositories, and
            infrastructure included in your security assessment scope.
          </p>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={() => setShowForm((current) => !current)}
        >
          {showForm ? "Cancel" : "+ Add asset"}
        </button>
      </header>

      {showForm && (
        <section className="panel asset-form-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NEW ASSET</p>
              <h3>Add assessment input</h3>
            </div>
          </div>

          <form className="asset-form" onSubmit={handleAddAsset}>
            <label className="form-field asset-name-field">
              <span>Asset name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Payments API"
                autoFocus
              />
            </label>

            <label className="form-field">
              <span>Asset type</span>
              <select
                value={type}
                onChange={(event) =>
                  setType(event.target.value as AssetType)
                }
              >
                <option>Web Application</option>
                <option>API</option>
                <option>Container</option>
                <option>Cloud Infrastructure</option>
                <option>Repository</option>
              </select>
            </label>

            <label className="form-field">
              <span>Environment</span>
              <select
                value={environment}
                onChange={(event) =>
                  setEnvironment(event.target.value as Environment)
                }
              >
                <option>Production</option>
                <option>Staging</option>
                <option>Development</option>
              </select>
            </label>

            <label className="form-field">
              <span>Criticality</span>
              <select
                value={criticality}
                onChange={(event) =>
                  setCriticality(event.target.value as Criticality)
                }
              >
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </label>

            <div className="asset-form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>

              <button className="primary-button" type="submit">
                Add asset
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="assets-layout">
        <article className="panel asset-inventory">
          <div className="panel-title">
            <div>
              <h3>Asset inventory</h3>
              <span className="panel-subtitle">
                {assets.length} managed asset{assets.length === 1 ? "" : "s"}
              </span>
            </div>

            <span>Select one asset for assessment</span>
          </div>

          <div className="asset-table">
            <div className="asset-table-header">
              <span>ASSET</span>
              <span>TYPE</span>
              <span>ENVIRONMENT</span>
              <span>CRITICALITY</span>
            </div>

            {assets.map((asset) => {
              const selected = selectedAssetId === asset.id;

              return (
                <button
                  type="button"
                  className={
                    selected ? "asset-row selected" : "asset-row"
                  }
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
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
                      <b>{asset.name}</b>
                      <small>ASG-AST-{String(asset.id).slice(-4)}</small>
                    </span>
                  </span>

                  <span>{asset.type}</span>

                  <span>
                    <span className="neutral-tag">
                      {asset.environment}
                    </span>
                  </span>

                  <span>
                    <span
                      className={`criticality-tag ${asset.criticality.toLowerCase()}`}
                    >
                      {asset.criticality}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        <aside className="panel assessment-launcher">
          <p className="eyebrow">ASSESSMENT TARGET</p>
          <h3>Run security assessment</h3>

          {selectedAsset ? (
            <>
              <div className="selected-asset-card">
                <small>SELECTED ASSET</small>
                <b>{selectedAsset.name}</b>
                <span>
                  {selectedAsset.type} · {selectedAsset.environment}
                </span>
              </div>

              <div className="assessment-summary">
                <div>
                  <span>Criticality</span>
                  <b>{selectedAsset.criticality}</b>
                </div>

                <div>
                  <span>Assessment mode</span>
                  <b>Full security gate</b>
                </div>
              </div>

              <p className="muted">
                AppSecGate will collect scanner evidence, normalize
                findings, correlate security signals, and calculate the
                release decision.
              </p>

              <button
                type="button"
                className="run-assessment-button"
                onClick={handleRunAssessment}
              >
                Run assessment →
              </button>
            </>
          ) : (
            <p className="muted">
              Select an asset from the inventory before running an
              assessment.
            </p>
          )}
        </aside>
      </section>
    </>
  );
}
