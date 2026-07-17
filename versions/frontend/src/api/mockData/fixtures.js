// src/api/mockData/fixtures.js

// Dynamic SVG Generator for LEGO parts to keep them visually distinct and high quality without external dependencies
export function getBrickSvg(color, type = 'brick-2x4') {
  let innerElements = '';
  let view = '0 0 120 80';
  const border = '#22222A';
  
  if (type === 'brick-2x4' || type === 'plate-2x4') {
    view = '0 0 160 90';
    const isPlate = type.includes('plate');
    // Brick Body
    innerElements = `
      <rect x="5" y="5" width="150" height="80" rx="10" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Studs -->
      <circle cx="25" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="25" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="65" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="105" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="105" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="145" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="145" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="25" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="25" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="65" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="105" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="105" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="145" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="145" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      ${isPlate ? '<line x1="5" y1="45" x2="155" y2="45" stroke="' + border + '" stroke-dasharray="4 4" stroke-width="2"/>' : ''}
    `;
  } else if (type === 'brick-2x2' || type === 'plate-2x2') {
    view = '0 0 90 90';
    const isPlate = type.includes('plate');
    innerElements = `
      <rect x="5" y="5" width="80" height="80" rx="10" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Studs -->
      <circle cx="25" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="25" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="65" cy="25" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="25" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="25" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="25" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      <circle cx="65" cy="65" r="12" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="65" r="5" fill="none" stroke="${border}" stroke-width="2" opacity="0.3"/>
      
      ${isPlate ? '<line x1="5" y1="45" x2="85" y2="45" stroke="' + border + '" stroke-dasharray="4 4" stroke-width="2"/>' : ''}
    `;
  } else if (type === 'plate-1x2' || type === 'brick-1x2') {
    view = '0 0 90 50';
    innerElements = `
      <rect x="5" y="5" width="80" height="40" rx="8" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Studs -->
      <circle cx="25" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
    `;
  } else if (type === 'slope-2x2') {
    view = '0 0 90 90';
    innerElements = `
      <rect x="5" y="5" width="80" height="80" rx="10" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Slope Visual Angle -->
      <path d="M 5,45 L 85,85" stroke="${border}" stroke-width="3"/>
      <!-- Upper Studs -->
      <circle cx="25" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <circle cx="65" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
    `;
  } else if (type === 'technic-1x1') {
    view = '0 0 50 50';
    innerElements = `
      <rect x="5" y="5" width="40" height="40" rx="8" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Stud -->
      <circle cx="25" cy="25" r="10" fill="${color}" stroke="${border}" stroke-width="3" filter="brightness(1.1)"/>
      <!-- Technic Pin Hole (cross) -->
      <circle cx="25" cy="25" r="4" fill="#22222A"/>
    `;
  } else if (type === 'minifig-torso') {
    view = '0 0 80 80';
    innerElements = `
      <!-- Neck -->
      <rect x="34" y="5" width="12" height="10" rx="2" fill="#FFD500" stroke="${border}" stroke-width="3"/>
      <!-- Torso -->
      <path d="M 20,15 L 60,15 L 68,70 L 12,70 Z" fill="${color}" stroke="${border}" stroke-width="4"/>
      <!-- Arms -->
      <path d="M 12,18 C 5,25 2,35 5,45" stroke="${color}" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M 68,18 C 75,25 78,35 75,45" stroke="${color}" stroke-width="10" stroke-linecap="round" fill="none"/>
    `;
  } else {
    // Default fallback
    view = '0 0 60 60';
    innerElements = `<rect x="5" y="5" width="50" height="50" rx="8" fill="${color}" stroke="${border}" stroke-width="4"/>`;
  }

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}">${innerElements}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

// Master parts reference table
export const MOCK_PARTS = [
  { part_id: 1, part_name: "2x4 Brick (Red)", category: "Brick", color: "#D01012", type: "brick-2x4", reference_image_url: getBrickSvg("#D01012", "brick-2x4") },
  { part_id: 2, part_name: "2x4 Brick (Blue)", category: "Brick", color: "#0057A6", type: "brick-2x4", reference_image_url: getBrickSvg("#0057A6", "brick-2x4") },
  { part_id: 3, part_name: "2x2 Brick (Yellow)", category: "Brick", color: "#FFD500", type: "brick-2x2", reference_image_url: getBrickSvg("#FFD500", "brick-2x2") },
  { part_id: 4, part_name: "2x2 Slope 45° (Yellow)", category: "Slope", color: "#FFD500", type: "slope-2x2", reference_image_url: getBrickSvg("#FFD500", "slope-2x2") },
  { part_id: 5, part_name: "2x2 Plate (Red)", category: "Plate", color: "#D01012", type: "plate-2x2", reference_image_url: getBrickSvg("#D01012", "plate-2x2") },
  { part_id: 6, part_name: "1x2 Plate (Yellow)", category: "Plate", color: "#FFD500", type: "plate-1x2", reference_image_url: getBrickSvg("#FFD500", "plate-1x2") },
  { part_id: 7, part_name: "2x4 Plate (Blue)", category: "Plate", color: "#0057A6", type: "plate-2x4", reference_image_url: getBrickSvg("#0057A6", "plate-2x4") },
  { part_id: 8, part_name: "1x2 Plate (Red)", category: "Plate", color: "#D01012", type: "plate-1x2", reference_image_url: getBrickSvg("#D01012", "plate-1x2") },
  { part_id: 9, part_name: "2x2 Slope 45° (Blue)", category: "Slope", color: "#0057A6", type: "slope-2x2", reference_image_url: getBrickSvg("#0057A6", "slope-2x2") },
  { part_id: 10, part_name: "1x4 Plate (White)", category: "Plate", color: "#FFFFFF", type: "plate-2x4", reference_image_url: getBrickSvg("#FFFFFF", "plate-2x4") },
  { part_id: 11, part_name: "Technic 1x1 Brick (Grey)", category: "Technic", color: "#5B5B66", type: "technic-1x1", reference_image_url: getBrickSvg("#5B5B66", "technic-1x1") },
  { part_id: 12, part_name: "Minifig Torso (Blue)", category: "Minifig", color: "#0057A6", type: "minifig-torso", reference_image_url: getBrickSvg("#0057A6", "minifig-torso") },
  { part_id: 13, part_name: "2x4 Plate (Green)", category: "Plate", color: "#1E7A34", type: "plate-2x4", reference_image_url: getBrickSvg("#1E7A34", "plate-2x4") },
  { part_id: 14, part_name: "2x4 Brick (Grey)", category: "Brick", color: "#5B5B66", type: "brick-2x4", reference_image_url: getBrickSvg("#5B5B66", "brick-2x4") },
];

// Initial active user inventory list
export let mockInventory = [
  { inventory_id: 101, part_id: 1, part_name: "2x4 Brick (Red)", reference_image_url: getBrickSvg("#D01012", "brick-2x4"), category: "Brick", quantity: 6, date_added: "2026-07-01T12:00:00Z", source_image_key: null },
  { inventory_id: 102, part_id: 3, part_name: "2x2 Brick (Yellow)", reference_image_url: getBrickSvg("#FFD500", "brick-2x2"), category: "Brick", quantity: 3, date_added: "2026-07-02T14:30:00Z", source_image_key: null },
  { inventory_id: 103, part_id: 4, part_name: "2x2 Slope 45° (Yellow)", reference_image_url: getBrickSvg("#FFD500", "slope-2x2"), category: "Slope", quantity: 2, date_added: "2026-07-03T10:15:00Z", source_image_key: null },
  { inventory_id: 104, part_id: 5, part_name: "2x2 Plate (Red)", reference_image_url: getBrickSvg("#D01012", "plate-2x2"), category: "Plate", quantity: 2, date_added: "2026-07-04T09:00:00Z", source_image_key: null },
  { inventory_id: 105, part_id: 6, part_name: "1x2 Plate (Yellow)", reference_image_url: getBrickSvg("#FFD500", "plate-1x2"), category: "Plate", quantity: 5, date_added: "2026-07-05T16:45:00Z", source_image_key: null },
  { inventory_id: 106, part_id: 7, part_name: "2x4 Plate (Blue)", reference_image_url: getBrickSvg("#0057A6", "plate-2x4"), category: "Plate", quantity: 1, date_added: "2026-07-06T11:20:00Z", source_image_key: null },
  { inventory_id: 107, part_id: 8, part_name: "1x2 Plate (Red)", reference_image_url: getBrickSvg("#D01012", "plate-1x2"), category: "Plate", quantity: 4, date_added: "2026-07-07T15:10:00Z", source_image_key: null },
];

// Initial mock builds definitions
export const MOCK_BUILDS = [
  {
    build_id: 1,
    build_name: "Classic Yellow Duck",
    description: "The timeless LEGO mascot model. Extremely easy to build and requires just five yellow and red parts.",
    difficulty: "Easy",
    hero_image_url: "https://images.unsplash.com/photo-1585155770447-2f66e2a397b5?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", // yellow duck
    parts: [
      { part_id: 3, part_name: "2x2 Brick (Yellow)", quantity_required: 1 },
      { part_id: 4, part_name: "2x2 Slope 45° (Yellow)", quantity_required: 1 },
      { part_id: 5, part_name: "2x2 Plate (Red)", quantity_required: 1 },
      { part_id: 6, part_name: "1x2 Plate (Yellow)", quantity_required: 2 },
    ]
  },
  {
    build_id: 2,
    build_name: "Micro Shuttle Fighter",
    description: "Launch into deep orbit with this compact galactic explorer. Complete with folding wings and rear engine block.",
    difficulty: "Medium",
    hero_image_url: "https://images.unsplash.com/photo-1581822261290-991b38693d1b?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", // space shuttle
    parts: [
      { part_id: 7, part_name: "2x4 Plate (Blue)", quantity_required: 2 },
      { part_id: 8, part_name: "1x2 Plate (Red)", quantity_required: 2 },
      { part_id: 9, part_name: "2x2 Slope 45° (Blue)", quantity_required: 2 },
      { part_id: 10, part_name: "1x4 Plate (White)", quantity_required: 1 },
      { part_id: 11, part_name: "Technic 1x1 Brick (Grey)", quantity_required: 1 },
    ]
  },
  {
    build_id: 3,
    build_name: "Tiny Castle Guard Gate",
    description: "A defensive fortress segment with two arch towers, perfect for protecting your LEGO kingdoms.",
    difficulty: "Hard",
    hero_image_url: "https://images.unsplash.com/photo-1597081758517-4927b196a3f9?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", // castle gates
    parts: [
      { part_id: 14, part_name: "2x4 Brick (Grey)", quantity_required: 4 },
      { part_id: 11, part_name: "Technic 1x1 Brick (Grey)", quantity_required: 2 },
      { part_id: 8, part_name: "1x2 Plate (Red)", quantity_required: 4 },
      { part_id: 13, part_name: "2x4 Plate (Green)", quantity_required: 2 },
    ]
  },
  {
    build_id: 4,
    build_name: "Desktop Phone Cradle",
    description: "An angled brick stand that keeps your smartphone steady on your desk. Customizable and very sturdy.",
    difficulty: "Easy",
    hero_image_url: "https://images.unsplash.com/photo-1584438784894-089d6a128f3e?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3", // phone holder/desk
    parts: [
      { part_id: 1, part_name: "2x4 Brick (Red)", quantity_required: 4 },
      { part_id: 2, part_name: "2x4 Brick (Blue)", quantity_required: 2 },
      { part_id: 3, part_name: "2x2 Brick (Yellow)", quantity_required: 2 },
      { part_id: 7, part_name: "2x4 Plate (Blue)", quantity_required: 2 },
    ]
  }
];

// Helper functions for updating inventory states
export function addMockInventoryItem(item) {
  const newId = Math.max(...mockInventory.map(i => i.inventory_id), 0) + 1;
  const part = MOCK_PARTS.find(p => p.part_id === item.part_id);
  const newItem = {
    inventory_id: newId,
    part_id: item.part_id,
    part_name: part ? part.part_name : "Unknown Part",
    reference_image_url: part ? part.reference_image_url : getBrickSvg("#5B5B66"),
    category: part ? part.category : "Misc",
    quantity: item.quantity,
    date_added: new Date().toISOString(),
    source_image_key: item.source_image_key || null
  };
  
  // Check if item already exists in inventory, if so update quantity
  const existingIndex = mockInventory.findIndex(i => i.part_id === item.part_id);
  if (existingIndex !== -1) {
    mockInventory[existingIndex].quantity += item.quantity;
    return mockInventory[existingIndex];
  }

  mockInventory.push(newItem);
  return newItem;
}

export function updateMockInventoryItem(inventory_id, { quantity }) {
  const index = mockInventory.findIndex(i => i.inventory_id === inventory_id);
  if (index !== -1) {
    mockInventory[index].quantity = quantity;
    return mockInventory[index];
  }
  return null;
}

export function deleteMockInventoryItem(inventory_id) {
  const index = mockInventory.findIndex(i => i.inventory_id === inventory_id);
  if (index !== -1) {
    mockInventory.splice(index, 1);
    return true;
  }
  return false;
}
