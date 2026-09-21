import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal, StaggerReveal } from '../ui/Reveal';
import { Icon } from '../ui/Icon';

interface FeaturedProduct {
  id: string;
  name: string;
  creator: string;
  material: string;
  process: string;
  price: string;
  art: 'stand' | 'enclosure' | 'bracket' | 'fixture';
  /** Real product render. Undefined until product imagery is supplied —
      the card then shows a neutral technical stage (never a fake product). */
  image?: string;
  /** Real inventory flag. Undefined renders the default In Stock state and
      is structured to bind to live inventory later. */
  inStock?: boolean;
  features: [string, string, string];
}

const FEATURED_PRODUCTS: FeaturedProduct[] = [
  { id: 'phone-stand', name: 'Outdoor Phone Stand', creator: 'CAM LABS Community', material: 'PLA', process: '3D Printing', price: '499 EGP', art: 'stand', features: ['market.featDurable', 'market.featLightweight', 'market.featCustomizable'] },
  { id: 'sensor-enclosure', name: 'Sealed Sensor Enclosure', creator: 'Nile Robotics', material: 'PA12 Nylon', process: 'SLS', price: '1,250 EGP', art: 'enclosure', features: ['market.featHighStrength', 'market.featChemical', 'market.featCustomizable'] },
  { id: 'mounting-bracket', name: 'Articulated Mounting Bracket', creator: 'Apex Motion', material: 'Aluminum 6061', process: 'CNC Machining', price: '840 EGP', art: 'bracket', features: ['market.featPrecision', 'market.featLightweight', 'market.featCustomizable'] },
  { id: 'desk-fixture', name: 'Modular Desk Fixture', creator: 'Maker Lab Cairo', material: 'PETG', process: 'FDM', price: '675 EGP', art: 'fixture', features: ['market.featSturdy', 'market.featImpact', 'market.featCustomizable'] },
];

const marketplaceProductKeys: Record<string, string> = {
  'phone-stand': 'market.productPhoneStand',
  'sensor-enclosure': 'market.productSensor',
  'mounting-bracket': 'market.productBracket',
  'desk-fixture': 'market.productFixture',
};

/** Inline glyphs for icons the internal library does not provide.
    Same 1.8px outline language as `Icon` — no new dependency. */
const HeartGlyph: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20.5s-7.5-4.7-9.3-9.2C1.5 8.6 3.3 5.5 6.2 5.5c2 0 3.4 1.1 5.8 3.7 2.4-2.6 3.8-3.7 5.8-3.7 2.9 0 4.7 3.1 3.5 5.8-1.8 4.5-9.3 9.2-9.3 9.2Z" />
  </svg>
);

const CartGlyph: React.FC = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="20" r="1.6" />
    <circle cx="17" cy="20" r="1.6" />
    <path d="M2 3h2.5l2.2 12h9.8l2.5-8H6" />
  </svg>
);

const GridGlyph: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  </svg>
);

const FeatherGlyph: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 4c-7 0-13 5-15 11l-1.5 5L9 18.5C15 16.5 20 11 20 4Z" />
    <line x1="3.5" y1="20.5" x2="16" y2="8" />
  </svg>
);

const SlidersGlyph: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="4" y1="8" x2="14" y2="8" />
    <line x1="18" y1="8" x2="20" y2="8" />
    <line x1="4" y1="16" x2="8" y2="16" />
    <line x1="12" y1="16" x2="20" y2="16" />
    <circle cx="16" cy="8" r="2" />
    <circle cx="10" cy="16" r="2" />
  </svg>
);

const FlaskGlyph: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3h6" />
    <path d="M10 3v5l-5.2 9.4A2 2 0 0 0 6.6 20h10.8a2 2 0 0 0 1.8-2.6L14 8V3" />
    <line x1="7.5" y1="15" x2="16.5" y2="15" />
  </svg>
);

/** Feature key → icon. Unique within each card by construction. */
const FEATURE_ICONS: Record<string, React.ReactNode> = {
  'market.featDurable': <Icon name="shieldCheck" size={14} />,
  'market.featLightweight': <FeatherGlyph />,
  'market.featCustomizable': <SlidersGlyph />,
  'market.featHighStrength': <Icon name="shieldCheck" size={14} />,
  'market.featChemical': <FlaskGlyph />,
  'market.featPrecision': <Icon name="target" size={14} />,
  'market.featSturdy': <Icon name="cube" size={14} />,
  'market.featImpact': <Icon name="shieldCheck" size={14} />,
};

/** Split "CAM LABS <rest>" so the brand stays white and the descriptor blue. */
const splitBrandTitle = (title: string): { lead: string; rest: string } => {
  const idx = title.indexOf('CAM LABS');
  if (idx >= 0) {
    return { lead: 'CAM LABS', rest: `${title.slice(0, idx)}${title.slice(idx + 'CAM LABS'.length)}`.trim() };
  }
  const [first, ...tail] = title.split(' ').filter(Boolean);
  return { lead: first ?? title, rest: tail.join(' ') };
};

export const MarketplaceSection: React.FC = () => {
  const { setActiveView, showToast } = useStore();
  const { favorites, toggleFavorite, addToCart, openProduct } = useMarketplace();
  const { t } = useTranslation();

  const goToMarketplace = () => {
    setActiveView('marketplace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const viewProduct = (id: string) => {
    setActiveView('marketplace');
    openProduct(id);
  };

  const toggleFavoriteWithFeedback = (id: string) => {
    const wasFav = favorites.has(id);
    toggleFavorite(id);
    showToast(
      t('market.favorites'),
      t(wasFav ? 'market.favoriteRemoved' : 'market.favoriteAdded', { name: t(marketplaceProductKeys[id]) }),
      'success',
    );
  };

  const handleCart = (product: FeaturedProduct) => {
    addToCart(product.id, { material: product.material, color: 'Graphite', quantity: 1 });
    showToast(t('market.cart'), t('market.addedToCart', { name: t(marketplaceProductKeys[product.id]) }), 'success');
  };

  const { lead, rest } = splitBrandTitle(t('sections.marketplaceTitle'));

  const trustItems = [
    { icon: <Icon name="cube" size={22} />, titleKey: 'market.trustValidated', descKey: 'market.trustValidatedDesc' },
    { icon: <Icon name="gear" size={22} />, titleKey: 'market.trustManufacturing', descKey: 'market.trustManufacturingDesc' },
    { icon: <Icon name="shieldCheck" size={22} />, titleKey: 'market.trustQuality', descKey: 'market.trustQualityDesc' },
  ];

  return (
    <SectionReveal className="section-padding marketplace-section" id="marketplace-section">
      <span className="mp-annot mp-annot-top" aria-hidden="true">{t('market.annotTop')}</span>
      <span className="mp-annot mp-annot-bottom" aria-hidden="true">{t('market.annotBottom')}</span>
      <div className="container mp-container">
        <div className="mp-head">
          <div className="mp-head-main">
            <div className="section-badge">
              <span className="section-badge-dot"></span>
              <span>{t('sections.marketplaceEyebrow')}</span>
            </div>
            <h2 className="section-title mp-heading">
              <span className="mp-heading-lead">{lead}</span>{' '}
              {rest ? <span className="mp-heading-rest">{rest}</span> : null}
            </h2>
            <p className="section-subtitle mp-desc">
              {t('sections.marketplaceDescription')}
            </p>
          </div>
          <div className="mp-trust">
            {trustItems.map((item) => (
              <div className="mp-trust-item" key={item.titleKey}>
                <span className="mp-trust-icon">{item.icon}</span>
                <span className="mp-trust-text">
                  <strong>{t(item.titleKey)}</strong>
                  <span>{t(item.descKey)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <StaggerReveal className="market-product-grid mp-grid">
          {FEATURED_PRODUCTS.map((product) => {
            const isFav = favorites.has(product.id);
            const inStock = product.inStock !== false;
            const productName = t(marketplaceProductKeys[product.id]);
            return (
              <article className="market-product-card mp-card" key={product.id}>
                <div className="mp-media">
                  {product.image ? (
                    <img className="mp-img" src={product.image} alt={productName} loading="lazy" />
                  ) : (
                    <span className="mp-img-stage" aria-hidden="true">
                      <Icon name="cube" size={44} />
                    </span>
                  )}
                  <button
                    type="button"
                    className={`mp-fav${isFav ? ' active' : ''}`}
                    aria-pressed={isFav}
                    aria-label={t(isFav ? 'market.favoriteRemove' : 'market.favoriteAdd', { name: productName })}
                    onClick={() => toggleFavoriteWithFeedback(product.id)}
                  >
                    <HeartGlyph />
                  </button>
                </div>
                <div className="mp-body">
                  <div className="mp-statusrow">
                    <span className="mp-material">{product.material}</span>
                    <span className={`mp-stock${inStock ? '' : ' out'}`}>
                      <span className="mp-stock-dot" aria-hidden="true" />
                      {t(inStock ? 'market.inStock' : 'market.outOfStock')}
                    </span>
                  </div>
                  <h3 className="mp-title">{productName}</h3>
                  <p className="mp-creator">{t('market.by')} {product.creator}</p>
                  <div className="mp-chips">
                    {product.features.map((featKey) => (
                      <span className="mp-chip" key={featKey}>
                        {FEATURE_ICONS[featKey]}
                        {t(featKey)}
                      </span>
                    ))}
                  </div>
                  <div className="mp-price">{product.price}</div>
                  <div className="mp-actions">
                    <button type="button" className="btn btn-primary mp-view" onClick={() => viewProduct(product.id)}>
                      {t('actions.viewProduct')}
                      <Icon name="arrowRight" size={16} className="mp-view-arrow" />
                    </button>
                    <button
                      type="button"
                      className="mp-cart"
                      aria-label={t('market.cartAdd', { name: productName })}
                      onClick={() => handleCart(product)}
                    >
                      <CartGlyph />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </StaggerReveal>

        <div className="marketplace-cta-row">
          <button className="btn btn-lg btn-primary mp-explore" onClick={goToMarketplace} id="marketplace-section-explore-btn">
            <GridGlyph />
            {t('actions.exploreMarketplace')}
            <Icon name="arrowRight" size={17} className="mp-explore-arrow" />
          </button>
        </div>
      </div>
    </SectionReveal>
  );
};
