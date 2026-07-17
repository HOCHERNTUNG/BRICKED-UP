import React, { useState, useEffect } from 'react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { ProgressBar } from '../common/ProgressBar';
import { Spinner, EmptyState, ErrorState } from '../common/Feedback';
import { getBuilds, getBuildDetail } from '../../api/builds';
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import './BuildIdeasPanel.css';

export function BuildIdeasPanel({ inventoryRefreshKey }) {
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sub-view: Active selected build detail
  const [activeBuildId, setActiveBuildId] = useState(null);
  const [buildDetail, setBuildDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Load build list
  const loadBuilds = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBuilds();
      setBuilds(data);
    } catch (err) {
      console.error(err);
      setError('Could not retrieve build templates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuilds();
  }, [inventoryRefreshKey]);

  // Load specific build detailed breakdown
  const handleSelectBuild = async (buildId) => {
    setActiveBuildId(buildId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await getBuildDetail(buildId);
      setBuildDetail(detail);
    } catch (err) {
      console.error(err);
      setDetailError('Could not fetch build instructions details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToList = () => {
    setActiveBuildId(null);
    setBuildDetail(null);
    loadBuilds(); // Reload list to refresh % owned counts
  };

  return (
    <div className="builds-panel-container">
      {/* 1. Detail Sub-view */}
      {activeBuildId !== null ? (
        <div className="build-detail-view">
          <button
            type="button"
            className="back-btn font-display"
            onClick={handleBackToList}
          >
            <ArrowLeft size={16} />
            Back to builds
          </button>

          {detailLoading ? (
            <Spinner message="Retrieving schematic parts checklist..." />
          ) : detailError ? (
            <ErrorState message={detailError} onRetry={() => handleSelectBuild(activeBuildId)} />
          ) : (
            buildDetail && (
              <div className="detail-content-scroll font-body">
                {/* Hero section */}
                <div className="detail-hero">
                  <img
                    src={buildDetail.hero_image_url}
                    alt={buildDetail.build_name}
                    className="detail-hero-img"
                  />
                  <div className="detail-hero-overlay">
                    <span className={`difficulty-badge ${buildDetail.difficulty.toLowerCase()}`}>
                      {buildDetail.difficulty}
                    </span>
                  </div>
                </div>

                <h4 className="detail-title font-display">{buildDetail.build_name}</h4>
                <p className="detail-description">{buildDetail.description}</p>

                {/* Parts Requirement Checklist */}
                <div className="detail-checklist">
                  <h5 className="checklist-title font-display">Required Parts</h5>
                  <div className="parts-checklist-list">
                    {buildDetail.parts.map((part) => {
                      const isComplete = part.quantity_owned >= part.quantity_required;
                      const missingCount = part.quantity_required - part.quantity_owned;

                      return (
                        <div
                          key={part.part_id}
                          className={`checklist-item-row ${isComplete ? 'complete' : 'missing'}`}
                        >
                          {/* Part graphic */}
                          <div className="checklist-item-img-holder">
                            <img src={part.reference_image_url} alt={part.part_name} />
                          </div>

                          {/* Part details */}
                          <div className="checklist-item-details">
                            <h6 className="checklist-item-name font-display">{part.part_name}</h6>
                            <div className="checklist-item-counts font-display">
                              <span>
                                Owned: <strong>{part.quantity_owned}</strong>
                              </span>
                              <span>
                                Required: <strong>{part.quantity_required}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="checklist-item-status">
                            {isComplete ? (
                              <span className="status-indicator success" title="You have enough!">
                                <CheckCircle2 size={18} />
                              </span>
                            ) : (
                              <span
                                className="status-indicator warning font-display"
                                title={`Missing ${missingCount} pieces`}
                              >
                                <AlertTriangle size={16} />
                                <span className="warning-text">+{missingCount}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        /* 2. Catalog Grid View */
        <div className="build-catalog-view">
          {loading ? (
            <Spinner message="Calculating matching build plans..." />
          ) : error ? (
            <ErrorState message={error} onRetry={loadBuilds} />
          ) : builds.length === 0 ? (
            <EmptyState
              title="No builds discovered"
              description="No blueprints are matching the database."
            />
          ) : (
            <div className="builds-grid">
              {builds.map((build) => {
                const is100Percent = build.pct_owned === 100;
                
                return (
                  <Card
                    key={build.build_id}
                    interactive={true}
                    onClick={() => handleSelectBuild(build.build_id)}
                    className="build-catalog-card"
                  >
                    <div className="build-card-visual">
                      <img
                        src={build.hero_image_url}
                        alt={build.build_name}
                        className="build-card-img"
                      />
                      <div className="build-card-tags">
                        <span className={`difficulty-badge ${build.difficulty.toLowerCase()}`}>
                          {build.difficulty}
                        </span>
                        {is100Percent && (
                          <span className="build-ready-badge font-display">
                            <ShieldCheck size={14} /> Ready!
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="build-card-details font-body">
                      <h5 className="build-name font-display">{build.build_name}</h5>
                      <p className="build-desc">{build.description}</p>
                      
                      {/* Percent owned gauge */}
                      <div className="build-progress-section">
                        <span className="progress-label font-display">Parts Owned</span>
                        <ProgressBar
                          value={build.pct_owned}
                          showText={true}
                          color={is100Percent ? 'var(--brick-green)' : 'var(--brick-purple)'}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default BuildIdeasPanel;
