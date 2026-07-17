export const inventoryFixtures = [
  { inventory_id: 1, part_id: 3001, part_name: "2x4 Brick", reference_image_url: "https://via.placeholder.com/150/FFD500/000000?text=2x4+Brick", category: "Bricks", quantity: 15, date_added: "2026-07-01T10:00:00Z", source_image_key: null },
  { inventory_id: 2, part_id: 3020, part_name: "2x4 Plate", reference_image_url: "https://via.placeholder.com/150/D01012/FFFFFF?text=2x4+Plate", category: "Plates", quantity: 8, date_added: "2026-07-02T11:00:00Z", source_image_key: null },
  { inventory_id: 3, part_id: 3003, part_name: "2x2 Brick", reference_image_url: "https://via.placeholder.com/150/0057A6/FFFFFF?text=2x2+Brick", category: "Bricks", quantity: 4, date_added: "2026-07-03T09:30:00Z", source_image_key: null },
  { inventory_id: 4, part_id: 3622, part_name: "1x3 Brick", reference_image_url: "https://via.placeholder.com/150/1E7A34/FFFFFF?text=1x3+Brick", category: "Bricks", quantity: 12, date_added: "2026-07-04T14:15:00Z", source_image_key: null },
  { inventory_id: 5, part_id: 3022, part_name: "2x2 Plate", reference_image_url: "https://via.placeholder.com/150/5E1E9A/FFFFFF?text=2x2+Plate", category: "Plates", quantity: 20, date_added: "2026-07-05T16:45:00Z", source_image_key: null }
];

export const buildFixtures = [
  { build_id: 101, build_name: "Mini Red Car", description: "A classic small red car.", difficulty: "Easy", hero_image_url: "https://via.placeholder.com/300/D01012/FFFFFF?text=Red+Car", pct_owned: 100 },
  { build_id: 102, build_name: "Blue Space Fighter", description: "Swooshable space fighter.", difficulty: "Medium", hero_image_url: "https://via.placeholder.com/300/0057A6/FFFFFF?text=Space+Fighter", pct_owned: 65 },
  { build_id: 103, build_name: "Yellow Submarine", description: "Explore the deep.", difficulty: "Hard", hero_image_url: "https://via.placeholder.com/300/FFD500/000000?text=Submarine", pct_owned: 20 }
];

export const buildDetailFixtures = {
  101: {
    build_id: 101, build_name: "Mini Red Car", description: "A classic small red car.", difficulty: "Easy", hero_image_url: "https://via.placeholder.com/300/D01012/FFFFFF?text=Red+Car",
    parts: [
      { part_id: 3001, part_name: "2x4 Brick", reference_image_url: "https://via.placeholder.com/150/FFD500/000000?text=2x4+Brick", quantity_required: 4, quantity_owned: 15 },
      { part_id: 3020, part_name: "2x4 Plate", reference_image_url: "https://via.placeholder.com/150/D01012/FFFFFF?text=2x4+Plate", quantity_required: 2, quantity_owned: 8 }
    ]
  },
  102: {
    build_id: 102, build_name: "Blue Space Fighter", description: "Swooshable space fighter.", difficulty: "Medium", hero_image_url: "https://via.placeholder.com/300/0057A6/FFFFFF?text=Space+Fighter",
    parts: [
      { part_id: 3003, part_name: "2x2 Brick", reference_image_url: "https://via.placeholder.com/150/0057A6/FFFFFF?text=2x2+Brick", quantity_required: 6, quantity_owned: 4 },
      { part_id: 3622, part_name: "1x3 Brick", reference_image_url: "https://via.placeholder.com/150/1E7A34/FFFFFF?text=1x3+Brick", quantity_required: 8, quantity_owned: 12 }
    ]
  }
};

export const scanResultFixtures = {
  label: "2x4_brick_red",
  confidence: 98.5,
  part: {
    part_id: 3001,
    part_name: "2x4 Brick",
    category: "Bricks",
    reference_image_url: "https://via.placeholder.com/150/FFD500/000000?text=2x4+Brick"
  }
};
