import React from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { SectionReveal, StaggerReveal } from '../ui/Reveal';
import { PriceEstimateNotice } from '../ui/PriceEstimateNotice';

interface FeaturedProduct {
  id: string;
  name: string;
  creator: string;
  material: string;
  process: string;
  price: string;
  art: 'stand' | 'enclosure' | 'bracket' | 'fixture';
}

const FEATURED_PRODUCTS: FeaturedProduct[] = [
  { id: 'phone-stand', name: 'Outdoor Phone Stand', creator: 'CAM LABS Community', material: 'PLA', process: '3D Printing', price: '499 EGP', art: 'stand' },
  { id: 'sensor-enclosure', name: 'Sealed Sensor Enclosure', creator: 'Nile Robotics', material: 'PA12 Nylon', process: 'SLS', price: '1,250 EGP', art: 'enclosure' },
  { id: 'mounting-bracket', name: 'Articulated Mounting Bracket', creator: 'Apex Motion', material: 'Aluminum 6061', process: 'CNC Machining', price: '840 EGP', art: 'bracket' },
  { id: 'desk-fixture', name: 'Modular Desk Fixture', creator: 'Maker Lab Cairo', material: 'PETG', process: 'FDM', price: '675 EGP', art: 'fixture' },
];

const marketplaceProductKeys: Record<string, string> = {
  'phone-stand': 'market.productPhoneStand',
  'sensor-enclosure': 'market.productSensor',
  'mounting-bracket': 'market.productBracket',
  'desk-fixture': 'market.productFixture',
};

const marketplaceProcessKeys: Record<string, string> = {
  '3D Printing': 'market.process3d',
  SLS: 'market.processSls',
  'CNC Machining': 'market.processCnc',
  FDM: 'market.processFdm',
};

export const MarketplaceSection: React.FC = () => {
  const { setActiveView } = useStore();
  const { t } = useTranslation();

  const goToMarketplace = () => {
    setActiveView('marketplace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <SectionReveal className="section-padding marketplace-section" id="marketplace-section">
      <div className="container">
        <div className="marketplace-section-heading">
          <div>
            <div className="section-badge">
              <span className="section-badge-dot"></span>
              <span>{t('sections.marketplace')}</span>
            </div>
            <h2 className="section-title">{t('sections.marketplaceTitle')}</h2>
          </div>
          <p className="section-subtitle" style={{ marginBottom: 0 }}>
            {t('sections.marketplaceDescription')}
          </p>
        </div>

        <StaggerReveal className="market-product-grid">
          {FEATURED_PRODUCTS.map((product) => (
            <article className="market-product-card" key={product.id}>
              <div className={`market-product-art art-${product.art}`}>
                <span className="product-art-grid" />
                <span className="product-art-object" />
                <span className="product-art-label">{t(marketplaceProcessKeys[product.process])}</span>
              </div>
              <div className="market-product-card-body">
                <div className="market-product-meta">
                  <span>{product.material}</span>
                  <span>{t(marketplaceProcessKeys[product.process])}</span>
                </div>
                <h3>{t(marketplaceProductKeys[product.id])}</h3>
                <p>{t('market.by')} {product.creator}</p>
                <div className="market-product-footer">
                  <span className="price-cell"><strong>{product.price}</strong><PriceEstimateNotice /></span>
                  <button className="btn btn-sm btn-outline" onClick={goToMarketplace}>{t('actions.viewProduct')}</button>
                </div>
                <div className="market-product-actions">
                  <button onClick={goToMarketplace}>{t('actions.customize')}</button>
                </div>
              </div>
            </article>
          ))}
        </StaggerReveal>

        <div className="marketplace-cta-row">
          <button className="btn btn-lg btn-primary" onClick={goToMarketplace} id="marketplace-section-explore-btn">
            {t('actions.exploreMarketplace')}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '6px' }}>
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>
    </SectionReveal>
  );
};
