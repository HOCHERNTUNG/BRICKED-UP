import React, { useState, useEffect } from 'react';
import { Panel } from '../Panel/Panel';
import * as buildsApi from '../../api/builds';
import { ArrowLeft } from 'lucide-react';
import './BuildIdeas.css';

export function BuildIdeas({ panelState, onUpdate, onBringToFront, onClose }) {
  const [builds, setBuilds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [selectedBuildId, setSelectedBuildId] = useState(null);
  const [buildDetail, setBuildDetail] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  useEffect(() => {
    if (panelState.isOpen && !selectedBuildId) {
      loadBuilds();
    }
  }, [panelState.isOpen]);

  const loadBuilds = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await buildsApi.getBuilds();
      setBuilds(data);
    } catch (err) {
      setErrorMsg("Couldn't load build ideas. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectBuild = async (id) => {
    setSelectedBuildId(id);
    setIsDetailLoading(true);
    try {
      const detail = await buildsApi.getBuildDetail(id);
      setBuildDetail(detail);
    } catch (err) {
      // Error handling for detail
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleBack = () => {
    setSelectedBuildId(null);
    setBuildDetail(null);
  };

  return (
    <Panel 
      {...panelState} 
      onUpdate={onUpdate} 
      onBringToFront={onBringToFront} 
      onClose={onClose}
      accentColor="var(--brick-purple)"
    >
      <div className="builds-content">
        {!selectedBuildId ? (
          // LIST VIEW
          <>
            {isLoading && <div className="builds-state"><p>Finding ideas...</p></div>}
            {errorMsg && (
              <div className="builds-state">
                <p>{errorMsg}</p>
                <button className="retry-btn" onClick={loadBuilds}>Retry</button>
              </div>
            )}
            {!isLoading && !errorMsg && (
              <div className="builds-list">
                {builds.map(b => (
                  <div key={b.build_id} className="build-card" onClick={() => handleSelectBuild(b.build_id)}>
                    <img src={b.hero_image_url} alt={b.build_name} className="build-img" />
                    <div className="build-info">
                      <h4>{b.build_name}</h4>
                      <p>{b.difficulty}</p>
                      
                      <div className="progress-container">
                        <div className="progress-bar" style={{ width: `${b.pct_owned}%`, backgroundColor: b.pct_owned === 100 ? 'var(--brick-green)' : 'var(--brick-yellow)' }} />
                      </div>
                      <p className="pct-text">{b.pct_owned}% of parts owned</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          // DETAIL VIEW
          <div className="build-detail">
            <div className="detail-header">
              <button className="back-btn" onClick={handleBack}><ArrowLeft size={20} /></button>
              <h3>{buildDetail?.build_name || 'Loading...'}</h3>
            </div>
            
            {isDetailLoading ? (
              <div className="builds-state"><p>Loading details...</p></div>
            ) : buildDetail ? (
              <div className="detail-body">
                <img src={buildDetail.hero_image_url} alt={buildDetail.build_name} className="detail-hero" />
                <p className="detail-desc">{buildDetail.description}</p>
                
                <h4 className="parts-title">Required Parts</h4>
                <div className="parts-list">
                  {buildDetail.parts.map(p => {
                    const hasEnough = p.quantity_owned >= p.quantity_required;
                    return (
                      <div key={p.part_id} className="part-req-row">
                        <img src={p.reference_image_url} alt={p.part_name} className="part-req-img" />
                        <div className="part-req-info">
                          <span>{p.part_name}</span>
                          <span style={{ color: hasEnough ? 'var(--brick-green)' : 'var(--brick-red)', fontWeight: 'bold' }}>
                            {p.quantity_owned} / {p.quantity_required}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="builds-state"><p>Error loading details.</p></div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
