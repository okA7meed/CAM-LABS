import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useTranslation } from 'react-i18next';
import { RequiredMark, OptionalMark } from '../ui/FieldLabel';
import { PriceEstimateNotice } from '../ui/PriceEstimateNotice';

interface MarketplaceProduct {
  id: string;
  name: string;
  creator: string;
  category: string;
  price: string;
  material: string;
  process: string;
  leadTime: string;
  art: 'stand' | 'enclosure' | 'bracket' | 'fixture';
}

const PRODUCTS: MarketplaceProduct[] = [
  { id: 'phone-stand', name: 'Outdoor Phone Stand', creator: 'CAM LABS Community', category: 'Everyday Carry', price: '499 EGP', material: 'PLA', process: '3D Printing', leadTime: '2-3 days', art: 'stand' },
  { id: 'sensor-enclosure', name: 'Sealed Sensor Enclosure', creator: 'Nile Robotics', category: 'Automation', price: '1,250 EGP', material: 'PA12 Nylon', process: 'SLS', leadTime: '4-5 days', art: 'enclosure' },
  { id: 'mounting-bracket', name: 'Articulated Mounting Bracket', creator: 'Apex Motion', category: 'Workshop', price: '840 EGP', material: 'Aluminum 6061', process: 'CNC Machining', leadTime: '5-7 days', art: 'bracket' },
  { id: 'desk-fixture', name: 'Modular Desk Fixture', creator: 'Maker Lab Cairo', category: 'Workspace', price: '675 EGP', material: 'PETG', process: 'FDM', leadTime: '3-4 days', art: 'fixture' },
];

const marketplaceProductKeys: Record<string, string> = {
  'phone-stand': 'market.productPhoneStand',
  'sensor-enclosure': 'market.productSensor',
  'mounting-bracket': 'market.productBracket',
  'desk-fixture': 'market.productFixture',
};

const marketplaceCategoryKeys: Record<string, string> = {
  'Everyday Carry': 'market.categoryEveryday',
  Automation: 'market.categoryAutomation',
  Workshop: 'market.categoryWorkshop',
  Workspace: 'market.categoryWorkspace',
};

const marketplaceProcessKeys: Record<string, string> = {
  '3D Printing': 'market.process3d',
  SLS: 'market.processSls',
  'CNC Machining': 'market.processCnc',
  FDM: 'market.processFdm',
};
export const MarketplaceView: React.FC = () => {
  const { addOrder, setActiveView, showToast } = useStore();
  const { t } = useTranslation();
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customText, setCustomText] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('PLA');
  const [selectedColor, setSelectedColor] = useState('Graphite');
  const [notes, setNotes] = useState('');
  const [showRequest, setShowRequest] = useState(false);

  const openProduct = (product: MarketplaceProduct) => {
    setSelectedProduct(product);
    setSelectedMaterial(product.material);
    setQuantity(1);
    setShowRequest(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sendRequest = () => {
    if (!selectedProduct) return;
    addOrder({
      partName: customText ? `${selectedProduct.name} - ${customText}` : selectedProduct.name,
      technology: selectedProduct.process,
      material: `${selectedMaterial} / ${selectedColor}`,
      quantity,
      totalCost: selectedProduct.price,
      tolerance: 'Standard production tolerance',
    });
    showToast('Manufacturing Request Sent', `${selectedProduct.name} is now in the CAM LABS review queue.`, 'success');
    setActiveView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (selectedProduct) {
    return (
      <main className="marketplace-page">
        <div className="container marketplace-detail">
          <button className="marketplace-back" onClick={() => setSelectedProduct(null)}>
            <span aria-hidden="true">←</span> {t('market.back')}
          </button>
          <div className="product-detail-grid">
            <section className="product-gallery" aria-label={`${selectedProduct.name} preview`}>
              <div className={`market-product-art market-product-art--large art-${selectedProduct.art}`}>
                <span className="product-art-grid" />
                <span className="product-art-object" />
                <span className="product-art-label">{t('market.preview')}</span>
              </div>
              <div className="product-thumbnail-row">
                <button className="product-thumbnail active" aria-label={t('market.primaryPreview')} />
                <button className="product-thumbnail" aria-label={t('market.detailPreview')} />
                <button className="product-thumbnail" aria-label={t('market.materialPreview')} />
              </div>
            </section>

            <section className="product-config-panel">
              <div className="marketplace-kicker">{selectedProduct.category} · Made to order</div>
              <div className="marketplace-kicker">{t(marketplaceCategoryKeys[selectedProduct.category])} · Made to order</div>
              <h1>{t(marketplaceProductKeys[selectedProduct.id])}</h1>
              <div className="product-price"><span>{selectedProduct.price}</span><PriceEstimateNotice /></div>
              <div className="product-specs">
                <span><strong>{t('market.material')}</strong>{selectedProduct.material}</span>
                <span><strong>{t('market.process')}</strong>{selectedProduct.process}</span>
                <span><strong>{t('market.process')}</strong>{t(marketplaceProcessKeys[selectedProduct.process])}</span>
              </div>

              <div className="product-option-group">
                <label className="form-label" htmlFor="market-material">{t('market.material')}<RequiredMark /></label>
                <select id="market-material" className="form-control" value={selectedMaterial} onChange={(event) => setSelectedMaterial(event.target.value)} required aria-required="true">
                  <option>PLA</option><option>PETG</option><option>PA12 Nylon</option><option>Aluminum 6061</option>
                </select>
              </div>
              <div className="product-option-group">
                <span className="form-label">{t('market.color')}<RequiredMark /></span>
                <div className="market-color-options" role="group" aria-label={t('market.colorSelection')}>
                  {['Graphite', 'Signal Blue', 'Stone', 'Safety Orange'].map((color) => <button key={color} className={`market-color-swatch ${selectedColor === color ? 'active' : ''}`} onClick={() => setSelectedColor(color)} aria-label={color} title={color} />)}
                </div>
              </div>
              <div className="product-option-group">
                <label className="form-label" htmlFor="market-text">{t('market.addCustomText')}<OptionalMark /></label>
                <input id="market-text" className="form-control" value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder="e.g. Lab asset 04" />
              </div>
              <div className="market-upload-row">
                <label className="market-upload-control"><input type="file" accept=".svg,.png,.jpg,.pdf" />{t('market.uploadLogo')}<OptionalMark /></label>
                <label className="market-upload-control"><input type="file" accept=".step,.stp,.stl,.obj,.ply" />{t('market.uploadCad')}<OptionalMark /></label>
              </div>
              <div className="market-quantity-row"><span className="form-label">{t('market.quantity')}<RequiredMark /></span><div className="market-stepper"><button onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease quantity">−</button><span>{quantity}</span><button onClick={() => setQuantity(quantity + 1)} aria-label="Increase quantity">+</button></div></div>
              <button className="market-primary-action" onClick={() => showToast('Added to workspace', `${selectedProduct.name} is ready for manufacturing configuration.`, 'success')}>{t('market.addToCart')}</button>
              <button className="market-secondary-action" onClick={() => setShowRequest(true)}>{t('market.requestQuote')}</button>
            </section>
          </div>

          {showRequest && <section className="market-request-panel">
            <div><div className="marketplace-kicker">{t('market.request')}</div><h2>{t('market.reviewSummary')}</h2><p>{t('market.confirmReview')}</p></div>
            <div className="market-request-summary"><span>{t('market.product')}<strong>{t(marketplaceProductKeys[selectedProduct.id])}</strong></span><span>{t('market.process')}<strong>{t(marketplaceProcessKeys[selectedProduct.process])}</strong></span><span>{t('market.estimatedCost')}<strong className="price-cell">{selectedProduct.price}<PriceEstimateNotice /></strong></span><span>{t('market.delivery')}<strong>{selectedProduct.leadTime}</strong></span></div>
            <label className="form-label" htmlFor="market-notes">{t('market.notes')}<OptionalMark /></label>
            <textarea id="market-notes" className="form-control" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Tolerances, use case, or delivery notes" rows={3} />
            <button className="market-primary-action" onClick={sendRequest}>{t('market.sendRequest')}</button>
          </section>}
        </div>
      </main>
    );
  }

  return (
    <main className="marketplace-page">
      <section className="marketplace-hero">
        <div className="container marketplace-hero-content">
          <div><div className="marketplace-kicker">{t('market.marketKicker')}</div><h1>{t('market.title')}</h1><p>{t('market.description')}</p><button className="market-primary-action" onClick={() => document.getElementById('marketplace-catalog')?.scrollIntoView({ behavior: 'smooth' })}>{t('market.exploreDesigns')} <span aria-hidden="true">↓</span></button></div>
          <div className="market-hero-visual"><span className="market-orbit market-orbit-one" /><span className="market-orbit market-orbit-two" /><span className="market-hero-part" /><span className="market-hero-coordinate">X 120 · Y 85 · Z 45</span></div>
        </div>
      </section>
      <section className="marketplace-catalog section-padding" id="marketplace-catalog">
        <div className="container"><div className="marketplace-section-heading"><div><div className="marketplace-kicker">{t('market.readyKicker')}</div><h2>{t('market.designedToBeMade')}</h2></div><p>{t('market.listingDescription')}</p></div><div className="market-product-grid">{PRODUCTS.map((product) => <article className="market-product-card" key={product.id}><div className={`market-product-art art-${product.art}`}><span className="product-art-grid" /><span className="product-art-object" /><span className="product-art-label">{product.process}</span></div><div className="market-product-card-body"><div className="market-product-meta"><span>{product.category}</span><span>{product.material}</span></div><h3>{product.name}</h3><p>{t('market.by')} {product.creator}</p><div className="market-product-footer"><strong>{product.price}</strong><button className="btn btn-sm btn-outline" onClick={() => openProduct(product)}>{t('actions.viewProduct')}</button></div><div className="market-product-actions"><button onClick={() => openProduct(product)}>{t('actions.customize')}</button><button onClick={() => openProduct(product)}>{t('market.requestManufacturing')}</button></div></div></article>)}</div></div>
      </section>
    </main>
  );
};
