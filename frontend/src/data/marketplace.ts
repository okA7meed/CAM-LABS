/**
 * CAM LABS Marketplace — single source of truth for product data.
 *
 * The four products below are the REAL catalog entries already used by both
 * the landing showcase (MarketplaceSection) and the marketplace view
 * (MarketplaceView). Names, creators, categories, materials, processes,
 * prices and lead times are preserved exactly — no mock data is introduced.
 *
 * Feature/benefit chips reference i18n keys (`market.feat*`) so Arabic
 * translations keep working. No engineering claims are invented: every chip
 * maps to a key that already exists in the locale files.
 */

export type MarketplaceArt = 'stand' | 'enclosure' | 'bracket' | 'fixture';

export interface MarketplaceProduct {
  id: string;
  name: string;
  creator: string;
  category: string;
  categoryKey: string;
  nameKey: string;
  processKey: string;
  priceEgp: number;
  /** Display price, e.g. "499 EGP" (locale formatting stays in components). */
  price: string;
  material: string;
  process: string;
  leadTime: string;
  art: MarketplaceArt;
  /** Real inventory flag. Undefined = unknown → renders the neutral default. */
  inStock?: boolean;
  /** i18n keys for the three card chips. */
  features: [string, string, string];
  /** i18n keys for the product-benefit row on the details panel. */
  benefits: [string, string, string, string];
  /** Searchable specification text (material + process + category). */
  specText: string;
}

export const MARKETPLACE_PRODUCTS: MarketplaceProduct[] = [
  {
    id: 'phone-stand',
    name: 'Outdoor Phone Stand',
    creator: 'CAM LABS Community',
    category: 'Everyday Carry',
    categoryKey: 'market.categoryEveryday',
    nameKey: 'market.productPhoneStand',
    processKey: 'market.process3d',
    priceEgp: 499,
    price: '499 EGP',
    material: 'PLA',
    process: '3D Printing',
    leadTime: '2-3 days',
    art: 'stand',
    features: ['market.featDurable', 'market.featLightweight', 'market.featCustomizable'],
    benefits: ['market.featDurable', 'market.featLightweight', 'market.featSturdy', 'market.featCustomizable'],
    specText: 'PLA 3D Printing Everyday Carry',
  },
  {
    id: 'sensor-enclosure',
    name: 'Sealed Sensor Enclosure',
    creator: 'Nile Robotics',
    category: 'Automation',
    categoryKey: 'market.categoryAutomation',
    nameKey: 'market.productSensor',
    processKey: 'market.processSls',
    priceEgp: 1250,
    price: '1,250 EGP',
    material: 'PA12 Nylon',
    process: 'SLS',
    leadTime: '4-5 days',
    art: 'enclosure',
    features: ['market.featHighStrength', 'market.featChemical', 'market.featCustomizable'],
    benefits: ['market.featHighStrength', 'market.featChemical', 'market.featPrecision', 'market.featCustomizable'],
    specText: 'PA12 Nylon SLS Automation',
  },
  {
    id: 'mounting-bracket',
    name: 'Articulated Mounting Bracket',
    creator: 'Apex Motion',
    category: 'Workshop',
    categoryKey: 'market.categoryWorkshop',
    nameKey: 'market.productBracket',
    processKey: 'market.processCnc',
    priceEgp: 840,
    price: '840 EGP',
    material: 'Aluminum 6061',
    process: 'CNC Machining',
    leadTime: '5-7 days',
    art: 'bracket',
    features: ['market.featPrecision', 'market.featLightweight', 'market.featCustomizable'],
    benefits: ['market.featPrecision', 'market.featLightweight', 'market.featDurable', 'market.featCustomizable'],
    specText: 'Aluminum 6061 CNC Machining Workshop',
  },
  {
    id: 'desk-fixture',
    name: 'Modular Desk Fixture',
    creator: 'Maker Lab Cairo',
    category: 'Workspace',
    categoryKey: 'market.categoryWorkspace',
    nameKey: 'market.productFixture',
    processKey: 'market.processFdm',
    priceEgp: 675,
    price: '675 EGP',
    material: 'PETG',
    process: 'FDM',
    leadTime: '3-4 days',
    art: 'fixture',
    features: ['market.featSturdy', 'market.featImpact', 'market.featCustomizable'],
    benefits: ['market.featSturdy', 'market.featImpact', 'market.featLightweight', 'market.featCustomizable'],
    specText: 'PETG FDM Workspace',
  },
];

export const getMarketplaceProduct = (id: string): MarketplaceProduct | undefined =>
  MARKETPLACE_PRODUCTS.find((product) => product.id === id);

/**
 * Functional search over real fields: name, creator, material, process,
 * category and spec text. Case-insensitive, token-aware (every token must
 * match somewhere). Returns the full catalog on empty query.
 */
export function searchMarketplaceProducts(query: string): MarketplaceProduct[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return MARKETPLACE_PRODUCTS;
  return MARKETPLACE_PRODUCTS.filter((product) => {
    const haystack =
      `${product.name} ${product.creator} ${product.material} ${product.process} ${product.category} ${product.specText}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}
