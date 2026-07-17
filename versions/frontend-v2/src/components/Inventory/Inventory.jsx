import React, { useState, useEffect } from 'react';
import { Panel } from '../Panel/Panel';
import * as inventoryApi from '../../api/inventory';
import { PackageOpen } from 'lucide-react';
import './Inventory.css';

export function Inventory({ panelState, onUpdate, onBringToFront, onClose }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadInventory = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const data = await inventoryApi.getInventory();
      setItems(data);
    } catch (err) {
      setErrorMsg("Couldn't load your inventory. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (panelState.isOpen) {
      loadInventory();
    }
  }, [panelState.isOpen]);

  const filteredItems = items.filter(i => 
    i.part_name.toLowerCase().includes(search.toLowerCase()) || 
    i.part_id.toString().includes(search)
  );

  return (
    <Panel 
      {...panelState} 
      onUpdate={onUpdate} 
      onBringToFront={onBringToFront} 
      onClose={onClose}
      accentColor="var(--brick-blue)"
    >
      <div className="inventory-content">
        <div className="inventory-header">
          <input 
            type="text" 
            placeholder="Search parts..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="inventory-search"
          />
          <span className="inventory-count">{items.length} unique parts</span>
        </div>

        {isLoading && (
          <div className="inventory-state">
            <p>Loading your parts...</p>
          </div>
        )}

        {errorMsg && (
          <div className="inventory-state error">
            <p>{errorMsg}</p>
            <button className="retry-btn" onClick={loadInventory}>Retry</button>
          </div>
        )}

        {!isLoading && !errorMsg && items.length === 0 && (
          <div className="inventory-state empty">
            <PackageOpen size={48} color="var(--grey-600)" />
            <p>Your bin is empty. Scan some bricks!</p>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="inventory-grid">
            {filteredItems.map(item => (
              <div key={item.inventory_id} className="inventory-item">
                <img src={item.reference_image_url} alt={item.part_name} className="inventory-img" />
                <div className="inventory-item-details">
                  <div className="qty-badge">x{item.quantity}</div>
                  <span className="part-name">{item.part_name}</span>
                  <span className="part-id">#{item.part_id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}
