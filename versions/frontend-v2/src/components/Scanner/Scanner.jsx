import React, { useState } from 'react';
import { Panel } from '../Panel/Panel';
import { Upload, ScanLine, Check, RotateCcw } from 'lucide-react';
import * as scannerApi from '../../api/scanner';
import * as inventoryApi from '../../api/inventory';
import './Scanner.css';

export function Scanner({ panelState, onUpdate, onBringToFront, onClose }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, scanning, results, error
  const [results, setResults] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const handleUpload = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setStatus('uploading');
    
    try {
      const { uploadUrl, key } = await scannerApi.getUploadUrl(selected.name);
      await scannerApi.uploadImage(uploadUrl, selected);
      
      setStatus('scanning');
      const scanRes = await scannerApi.scanBrick(key);
      setResults([{ ...scanRes, source_image_key: key }]);
      setStatus('results');
    } catch (err) {
      setErrorMsg("Couldn't scan your brick. Try again.");
      setStatus('error');
    }
  };

  const handleAddToBin = async (result, index) => {
    try {
      await inventoryApi.addInventoryItem({
        part_id: result.part.part_id,
        quantity: 1,
        source_image_key: result.source_image_key
      });
      // Mark as added in UI
      const newResults = [...results];
      newResults[index].added = true;
      setResults(newResults);
    } catch (err) {
      alert("Failed to add to bin");
    }
  };

  const reset = () => {
    setFile(null);
    setResults([]);
    setStatus('idle');
  };

  return (
    <Panel 
      {...panelState} 
      onUpdate={onUpdate} 
      onBringToFront={onBringToFront} 
      onClose={onClose}
      accentColor="var(--brick-red)"
    >
      <div className="scanner-content">
        {status === 'idle' && (
          <div className="scanner-empty">
            <Upload size={48} color="var(--grey-600)" />
            <p>Upload a photo of a LEGO piece to identify it.</p>
            <label className="scanner-btn-primary">
              Select Image
              <input type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {(status === 'uploading' || status === 'scanning') && (
          <div className="scanner-loading">
            <ScanLine size={48} className="spin-pulse" color="var(--brick-red)" />
            <p>{status === 'uploading' ? 'Uploading image...' : 'Scanning part...'}</p>
          </div>
        )}

        {status === 'results' && (
          <div className="scanner-results">
            {results.map((res, i) => (
              <div key={i} className="result-card">
                <img src={res.part.reference_image_url} alt={res.part.part_name} className="result-img" />
                <div className="result-info">
                  <h4>{res.part.part_name}</h4>
                  <p>Confidence: {res.confidence.toFixed(1)}%</p>
                </div>
                <button 
                  className="scanner-btn-action" 
                  onClick={() => handleAddToBin(res, i)}
                  disabled={res.added}
                >
                  {res.added ? <Check size={16} /> : 'Add to bin'}
                </button>
              </div>
            ))}
            <div className="scanner-actions">
              <button className="scanner-btn-secondary" onClick={reset}>
                <RotateCcw size={16} /> Rescan
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="scanner-error">
            <p>{errorMsg}</p>
            <button className="scanner-btn-primary" onClick={reset}>Try again</button>
          </div>
        )}
      </div>
    </Panel>
  );
}
