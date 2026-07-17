import React, { useState, useRef } from 'react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { ProgressBar } from '../common/ProgressBar';
import { Spinner, ErrorState } from '../common/Feedback';
import { getUploadUrl, uploadImage, scanBrick, scanBatch } from '../../api/scanner';
import { addInventoryItem } from '../../api/inventory';
import { Upload, Camera, AlertCircle, CheckCircle2, RotateCcw, PackagePlus } from 'lucide-react';
import './ScannerPanel.css';

export function ScannerPanel({ onAddInventory }) {
  const [scanState, setScanState] = useState('idle'); // idle | uploading | scanning | results | error
  const [candidates, setCandidates] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [addedIds, setAddedIds] = useState(new Set()); // Tracks which pieces have been added to inventory
  
  const fileInputRef = useRef(null);

  // Trigger scanning process
  const processFile = async (file, isBatch = false) => {
    try {
      setScanState('uploading');
      setAddedIds(new Set());
      setErrorMsg('');

      // Step 1: Request S3 pre-signed upload URL
      const { uploadUrl, key } = await getUploadUrl(file.name);

      // Step 2: Upload image bytes to S3 destination
      await uploadImage(uploadUrl, file);

      // Step 3: Run recognition labels analysis
      setScanState('scanning');
      if (isBatch) {
        const result = await scanBatch(key);
        setCandidates(result.candidates);
      } else {
        const result = await scanBrick(key);
        setCandidates([result]); // Standardize single scan as array size 1
      }
      setScanState('results');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Detection failed. Please check your network.');
      setScanState('error');
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Assume files with "batch" or "multi" in their names are multi-brick scans
      const isBatch = file.name.toLowerCase().includes('batch') || file.name.toLowerCase().includes('multi');
      processFile(file, isBatch);
    }
  };

  // Helper trigger buttons to demo recognition with preset configs without requiring files
  const triggerDemoScan = (type) => {
    let dummyFile = new File([''], 'red_brick.jpg', { type: 'image/jpeg' });
    if (type === 'blue') {
      dummyFile = new File([''], 'blue_plate.jpg', { type: 'image/jpeg' });
    } else if (type === 'batch') {
      dummyFile = new File([''], 'batch_bricks.jpg', { type: 'image/jpeg' });
    }
    processFile(dummyFile, type === 'batch');
  };

  const handleAddSingle = async (cand, index) => {
    try {
      await addInventoryItem({
        part_id: cand.part.part_id,
        quantity: 1,
        source_image_key: cand.label,
      });
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      onAddInventory();
    } catch (err) {
      alert('Could not add item to bin');
    }
  };

  const handleAddAll = async () => {
    try {
      const promises = candidates.map((cand, idx) => {
        if (!addedIds.has(idx)) {
          return handleAddSingle(cand, idx);
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
    } catch (err) {
      alert('Could not add all items');
    }
  };

  const handleRescan = () => {
    setCandidates([]);
    setAddedIds(new Set());
    setScanState('idle');
  };

  return (
    <div className="scanner-panel-container">
      {scanState === 'idle' && (
        <div className="scanner-idle-state">
          {/* Drag & Drop Visual Box */}
          <div
            className="scanner-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              style={{ display: 'none' }}
            />
            <div className="dropzone-circle">
              <Upload size={32} />
            </div>
            <h4 className="font-display">Upload Brick Photo</h4>
            <p>Drag files here or click to browse</p>
          </div>

          {/* Quick Demo Scan Helpers */}
          <div className="demo-scans-section">
            <span className="demo-label font-display">Or Try Demo Photos:</span>
            <div className="demo-buttons-grid">
              <button
                type="button"
                className="demo-scan-btn font-display"
                onClick={() => triggerDemoScan('red')}
              >
                🔴 Red Brick
              </button>
              <button
                type="button"
                className="demo-scan-btn font-display"
                onClick={() => triggerDemoScan('blue')}
              >
                🔵 Blue Plate
              </button>
              <button
                type="button"
                className="demo-scan-btn font-display"
                onClick={() => triggerDemoScan('batch')}
              >
                📦 Multi-Scan (Batch)
              </button>
            </div>
          </div>
        </div>
      )}

      {scanState === 'uploading' && (
        <Spinner message="Uploading image to S3 bucket..." />
      )}

      {scanState === 'scanning' && (
        <Spinner message="AI Recognition identifying LEGO parts..." />
      )}

      {scanState === 'error' && (
        <ErrorState message={errorMsg} onRetry={handleRescan} />
      )}

      {scanState === 'results' && (
        <div className="scanner-results-state">
          <div className="results-header-actions">
            <h4 className="font-display">
              Pieces Identified ({candidates.length})
            </h4>
            <div className="header-action-buttons">
              {candidates.length > 1 && addedIds.size < candidates.length && (
                <Button
                  variant="success"
                  size="small"
                  onClick={handleAddAll}
                  className="bulk-add-btn"
                >
                  <PackagePlus size={16} />
                  Add All
                </Button>
              )}
              <Button variant="secondary" size="small" onClick={handleRescan}>
                <RotateCcw size={14} />
                Rescan
              </Button>
            </div>
          </div>

          {/* Candidate cards list */}
          <div className="candidates-list">
            {candidates.map((cand, idx) => {
              const isAdded = addedIds.has(idx);
              return (
                <Card key={idx} className="candidate-card">
                  <div className="candidate-card-layout">
                    {/* Left: part image */}
                    <div className="candidate-image-wrapper">
                      <img
                        src={cand.part.reference_image_url}
                        alt={cand.part.part_name}
                        className="candidate-part-img"
                      />
                    </div>
                    {/* Right: details and buttons */}
                    <div className="candidate-info-wrapper">
                      <div className="candidate-header-row">
                        <span className="candidate-category font-display">
                          {cand.part.category}
                        </span>
                        <span
                          className={`confidence-badge ${
                            cand.confidence > 90 ? 'high' : 'medium'
                          }`}
                        >
                          {cand.confidence}% Match
                        </span>
                      </div>
                      <h5 className="candidate-name font-display">
                        {cand.part.part_name}
                      </h5>

                      <div className="candidate-actions">
                        {isAdded ? (
                          <div className="added-badge font-display text-success">
                            <CheckCircle2 size={16} />
                            Added to Bin
                          </div>
                        ) : (
                          <Button
                            variant="primary"
                            size="small"
                            onClick={() => handleAddSingle(cand, idx)}
                          >
                            Add to bin
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
