import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../common/Button';
import { Card } from '../common/Card';
import { Spinner, EmptyState, ErrorState } from '../common/Feedback';
import { getInventory, updateInventoryItem, deleteInventoryItem } from '../../api/inventory';
import { Search, Plus, Minus, Trash2, Filter } from 'lucide-react';
import './InventoryPanel.css';

export function InventoryPanel({ refreshKey, onInventoryChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Container width monitoring for container-responsive layouts
  const containerRef = useRef(null);
  const [panelWidth, setPanelWidth] = useState(450);

  // Load inventory items
  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInventory();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError('Could not retrieve your brick inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [refreshKey]);

  // Set up ResizeObserver to reflow contents based on Panel width (not screen width!)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setPanelWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleUpdateQty = async (inventory_id, newQty) => {
    try {
      if (newQty <= 0) {
        await deleteInventoryItem(inventory_id);
      } else {
        await updateInventoryItem(inventory_id, { quantity: newQty });
      }
      onInventoryChange();
      loadInventory();
    } catch (err) {
      alert('Failed to update brick count');
    }
  };

  const handleDelete = async (inventory_id) => {
    try {
      await deleteInventoryItem(inventory_id);
      onInventoryChange();
      loadInventory();
    } catch (err) {
      alert('Failed to delete piece');
    }
  };

  // Determine width category class
  let widthClass = 'width-wide';
  if (panelWidth < 360) {
    widthClass = 'width-narrow';
  } else if (panelWidth < 480) {
    widthClass = 'width-medium';
  }

  // Get categories for filtering
  const categories = ['All', ...new Set(items.map((i) => i.category))];

  // Filtering / Search filter logic
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.part_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const totalBricksCount = items.reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div
      ref={containerRef}
      className={`inventory-panel-container ${widthClass}`}
    >
      {/* Header filters */}
      <div className="inventory-header-search">
        <div className="search-box-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search parts bin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="category-select-wrapper">
          <Filter size={14} className="filter-icon" />
          <select
            className="category-select font-display"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Running total count bar */}
      <div className="inventory-running-totals font-display">
        <span>Bricks Catalogued: {totalBricksCount} total</span>
        <span>Categories: {categories.length - 1}</span>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <Spinner message="Retrieving catalogued parts..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadInventory} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={searchQuery || selectedCategory !== 'All' ? 'No filter matches' : 'Inventory is empty'}
          description={
            searchQuery || selectedCategory !== 'All'
              ? 'Try widening your search terms or category filter.'
              : 'Add parts from the Scanner Panel to compile your inventory!'
          }
        />
      ) : (
        <div className="inventory-items-grid">
          {filteredItems.map((item) => (
            <Card key={item.inventory_id} className="inventory-part-card">
              <div className="part-card-inner">
                {/* Visual */}
                <div className="part-img-holder">
                  <img src={item.reference_image_url} alt={item.part_name} />
                </div>

                {/* Details */}
                <div className="part-card-content">
                  <div className="part-meta-row font-display">
                    <span className="part-badge-cat">{item.category}</span>
                  </div>
                  <h6 className="part-display-name font-display" title={item.part_name}>
                    {item.part_name}
                  </h6>
                  
                  {/* Actions & Qty adjustment */}
                  <div className="part-card-footer-actions">
                    <div className="qty-picker">
                      <button
                        type="button"
                        className="qty-picker-btn font-display"
                        onClick={() => handleUpdateQty(item.inventory_id, item.quantity - 1)}
                        title="Reduce quantity"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="qty-value font-display">{item.quantity}</span>
                      <button
                        type="button"
                        className="qty-picker-btn font-display"
                        onClick={() => handleUpdateQty(item.inventory_id, item.quantity + 1)}
                        title="Increase quantity"
                        aria-label="Increase quantity"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <button
                      type="button"
                      className="part-delete-btn"
                      onClick={() => handleDelete(item.inventory_id)}
                      title="Remove item"
                      aria-label="Delete item"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
export default InventoryPanel;
