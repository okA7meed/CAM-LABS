import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useMarketplace } from '../../context/MarketplaceContext';
import { MARKETPLACE_PRODUCTS, MarketplaceProduct, getMarketplaceProduct, searchMarketplaceProducts } from '../../data/marketplace';
import { MAX_CART_QTY, MIN_CART_QTY, clampQuantity } from '../../utils/marketplaceStore';
import { useTranslation } from 'react-i18next';
import { RequiredMark, OptionalMark } from '../ui/FieldLabel';
import { Icon } from '../ui/Icon';

const COLOR_OPTIONS = ['Graphite', 'Signal Blue', 'Stone', 'Safety Orange'];
const MATERIAL_OPTIONS = ['PLA', 'PETG', 'PA12 Nylon', 'Aluminum 6061'];
const GALLERY_VIEWS = ['market.primaryPreview', 'market.detailPreview', 'market.materialPreview'] as const;

const BENEFIT_ICONS: Record<string, 'target' | 'cube' | 'shieldCheck' | 'sliders'> = {
  'market.featDurable': 'shieldCheck',
  'market.featLightweight': 'cube',
  'market.featCustomizable': 'sliders',
  'market.featHighStrength': 'shieldCheck',
  'market.featChemical': 'shieldCheck',
  'market.featPrecision': 'target',
  'market.featSturdy': 'cube',
  'market.featImpact': 'shieldCheck',
};

// ── Shared bits ─────────────────────────────────────────────────────────────

const FavoriteButton: React.FC<{ product: MarketplaceProduct; className?: string }> = ({ product, className }) => {
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite } = useMarketplace();
  const { showToast } = useStore();
  const active = isFavorite(product.id);
  const productName = t(product.nameKey);
  return (
    <button
      type="button"
      className={className ?? 'mp-fav'}
      aria-pressed={active}
      aria-label={t(active ? 'market.favoriteRemove' : 'market.favoriteAdd', { name: productName })}
      onClick={() => {
        toggleFavorite(product.id);
        showToast(
          t('market.favorites'),
          t(active ? 'market.favoriteRemoved' : 'market.favoriteAdded', { name: productName }),
          'success',
        );
      }}
    >
      <Icon name="heart" size={18} />
    </button>
  );
};

const ProductMedia: React.FC<{ product: MarketplaceProduct; label: string }> = ({ product, label }) => (
  <div className={`market-product-art art-${product.art}`} aria-hidden="true">
    <span className="product-art-grid" />
    <span className="product-art-object" />
    <span className="product-art-label">{label}</span>
  </div>
);

const ProductCard: React.FC<{ product: MarketplaceProduct }> = ({ product }) => {
  const { t } = useTranslation();
  const { openProduct, addToCart } = useMarketplace();
  const { showToast } = useStore();
  const productName = t(product.nameKey);
  const inStock = product.inStock !== false;

  const handleQuickAdd = () => {
    addToCart(product.id, { material: product.material, color: COLOR_OPTIONS[0], quantity: 1 });
    showToast(t('market.cart'), t('market.addedToCart', { name: productName }), 'success');
  };

  return (
    <article className="market-product-card mp-card">
      <div className="mp-media">
        <ProductMedia product={product} label={t(product.processKey)} />
        <FavoriteButton product={product} />
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
              <Icon name={BENEFIT_ICONS[featKey] ?? 'cube'} size={14} />
              {t(featKey)}
            </span>
          ))}
        </div>
        <div className="mp-price">{product.price}</div>
        <div className="mp-actions">
          <button type="button" className="btn btn-primary mp-view" onClick={() => openProduct(product.id)}>
            {t('actions.viewProduct')}
            <Icon name="arrowRight" size={16} className="mp-view-arrow" />
          </button>
          <button
            type="button"
            className="mp-cart"
            aria-label={t('market.cartAdd', { name: productName })}
            onClick={handleQuickAdd}
          >
            <Icon name="cart" size={19} />
          </button>
        </div>
      </div>
    </article>
  );
};

// ── Listing ─────────────────────────────────────────────────────────────────

const ListingView: React.FC = () => {
  const { t } = useTranslation();
  const { searchQuery, setSearchQuery, clearSearch } = useMarketplace();

  const results = useMemo(() => searchMarketplaceProducts(searchQuery), [searchQuery]);
  const searching = searchQuery.trim().length > 0;

  const trustItems = [
    { icon: 'cube' as const, titleKey: 'market.trustValidated', descKey: 'market.trustValidatedDesc' },
    { icon: 'gear' as const, titleKey: 'market.trustManufacturing', descKey: 'market.trustManufacturingDesc' },
    { icon: 'shieldCheck' as const, titleKey: 'market.trustQuality', descKey: 'market.trustQualityDesc' },
  ];

  // Target header: "Designed to be made" with Electric Blue emphasis on "made".
  const headline = t('market.designedToBeMade');
  const madeWord = headline.split(' ').slice(-1).join(' ');
  const headlineLead = headline.slice(0, headline.length - madeWord.length).trim();

  return (
    <section className="marketplace-catalog mk-catalog section-padding" id="marketplace-catalog">
      <div className="container">
        <div className="mk-head">
          <div className="mk-head-main">
            <div className="marketplace-kicker">{t('market.readyKicker')}</div>
            <h2 className="mk-heading">
              {headlineLead} <span className="mk-heading-made">{madeWord}</span>
            </h2>
            <p className="mk-desc">{t('market.listingDescription')}</p>
            <div className="mk-search" role="search">
              <Icon name="search" size={17} className="mk-search-icon" />
              <label className="mk-search-label" htmlFor="mk-search-input">{t('market.searchLabel')}</label>
              <input
                id="mk-search-input"
                className="mk-search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('market.searchPlaceholder')}
                aria-label={t('market.searchLabel')}
              />
              {searching && (
                <button type="button" className="mk-search-clear" onClick={clearSearch}>
                  {t('market.clearSearch')}
                </button>
              )}
            </div>
          </div>
          <ul className="mk-trust" aria-label={t('market.readyKicker')}>
            {trustItems.map((item) => (
              <li className="mk-trust-item" key={item.titleKey}>
                <span className="mk-trust-icon" aria-hidden="true">
                  <Icon name={item.icon} size={22} />
                </span>
                <span className="mk-trust-text">
                  <strong>{t(item.titleKey)}</strong>
                  <span>{t(item.descKey)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {searching && (
          <p className="mk-results" role="status">
            {t('market.searchResults', { query: searchQuery.trim() })} — {results.length}
          </p>
        )}

        {results.length > 0 ? (
          <div className="market-product-grid mp-grid">
            {results.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="mk-empty" role="status">
            <h3>{t('market.noResultsTitle')}</h3>
            <p>{t('market.noResultsBody')}</p>
            <button type="button" className="btn btn-outline" onClick={clearSearch}>
              {t('market.clearSearch')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

// ── Product details ─────────────────────────────────────────────────────────

const ACCORDIONS = [
  { id: 'description', titleKey: 'market.accordionDescription' },
  { id: 'specifications', titleKey: 'market.accordionSpecifications' },
  { id: 'manufacturing', titleKey: 'market.accordionManufacturing' },
  { id: 'shipping', titleKey: 'market.accordionShipping' },
] as const;

const ProductDetailsView: React.FC<{ product: MarketplaceProduct }> = ({ product }) => {
  const { t } = useTranslation();
  const { goToListing, openProduct, addToCart, openCart } = useMarketplace();
  const { showToast, startManufacturingRequest, openAuthModal, setPostAuthDestination, setActiveView } = useStore();
  const { isAuthenticated } = useAuth();

  const [quantity, setQuantity] = useState(1);
  const [selectedMaterial, setSelectedMaterial] = useState(product.material);
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [customText, setCustomText] = useState('');
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [openAccordion, setOpenAccordion] = useState<string | null>('description');
  const [configOpen, setConfigOpen] = useState(false);

  // Reset per-product configuration when navigating between products.
  useEffect(() => {
    setQuantity(1);
    setSelectedMaterial(product.material);
    setSelectedColor(COLOR_OPTIONS[0]);
    setCustomText('');
    setGalleryIndex(0);
    setOpenAccordion('description');
    setConfigOpen(false);
  }, [product.id, product.material]);

  const productName = t(product.nameKey);
  const featured = MARKETPLACE_PRODUCTS.filter((item) => item.id !== product.id);

  const handleAddToCart = () => {
    addToCart(product.id, { material: selectedMaterial, color: selectedColor, customText, quantity });
    showToast(t('market.cart'), t('market.addedToCart', { name: productName }), 'success');
  };

  /**
   * Buy Now: shortcut into the REAL purchase flow. Captures product +
   * quantity + configuration into the cart, enforces authentication, then
   * continues into the manufacturing-request workspace (quote → approval →
   * order). It NEVER creates an order, quote, or payment directly.
   */
  const handleBuyNow = () => {
    addToCart(product.id, { material: selectedMaterial, color: selectedColor, customText, quantity });
    if (!isAuthenticated) {
      openCart();
      setPostAuthDestination('marketplace');
      showToast(t('market.buyNow'), t('market.signInToCheckout'), 'info');
      openAuthModal('login');
      return;
    }
    showToast(t('market.buyNow'), t('market.addedToCart', { name: productName }), 'success');
    startManufacturingRequest();
  };

  const stepGallery = (delta: number) =>
    setGalleryIndex((prev) => (prev + delta + GALLERY_VIEWS.length) % GALLERY_VIEWS.length);

  return (
    <div className="container marketplace-detail mk-detail">
      <nav className="mk-breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="marketplace-back" onClick={goToListing}>
          <span aria-hidden="true">←</span> {t('market.back')}
        </button>
        <span className="mk-crumb-sep" aria-hidden="true">/</span>
        <span className="mk-crumb">{t(product.categoryKey)}</span>
        <span className="mk-crumb-sep" aria-hidden="true">/</span>
        <span className="mk-crumb mk-crumb--current" aria-current="page">{productName}</span>
      </nav>

      <div className="mk-detail-grid">
        {/* Information / commerce panel */}
        <section className="mk-info" aria-labelledby="mk-product-title">
          <div className="mk-badges">
            <span className="mp-material">{t(product.categoryKey)}</span>
            <span className="mk-made">{t('market.madeToOrder')}</span>
          </div>
          <h1 id="mk-product-title" className="mk-title">{productName}</h1>
          <p className="mk-creator">{t('market.by')} {product.creator}</p>
          <p className="mk-desc">
            {productName} · {t(product.processKey)} · {selectedMaterial} — {t('market.madeToOrder')} · {t('market.leadTimeLabel')}: {product.leadTime}
          </p>

          <div className="mk-price">{product.price}</div>

          <div className="mk-qty-row">
            <div className="mk-stepper" role="group" aria-label={t('market.quantity')}>
              <button type="button" onClick={() => setQuantity((q) => clampQuantity(q - 1))} aria-label={t('market.decreaseQuantity')} disabled={quantity <= MIN_CART_QTY}>−</button>
              <span aria-live="polite" aria-label={t('market.quantity')}>{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => clampQuantity(q + 1))} aria-label={t('market.increaseQuantity')} disabled={quantity >= MAX_CART_QTY}>+</button>
            </div>
            <button type="button" className="btn btn-primary mk-add" onClick={handleAddToCart}>
              <Icon name="cart" size={18} />
              {t('market.addToCart')}
            </button>
          </div>
          <button type="button" className="btn btn-outline mk-buy" onClick={handleBuyNow}>
            {t('market.buyNow')}
          </button>

          <ul className="mk-benefits">
            {product.benefits.map((benefitKey) => (
              <li key={benefitKey} className="mk-benefit">
                <span className="mk-benefit-icon" aria-hidden="true">
                  <Icon name={BENEFIT_ICONS[benefitKey] ?? 'cube'} size={18} />
                </span>
                <span>{t(benefitKey)}</span>
              </li>
            ))}
          </ul>

          {/* Preserved customization: material, color, custom text, logo + CAD
              upload. Reorganized into an expandable configuration area so the
              target architecture keeps every working capability. */}
          <div className="mk-accordion">
            <button
              type="button"
              className="mk-accordion-trigger"
              aria-expanded={configOpen}
              aria-controls="mk-config-panel"
              onClick={() => setConfigOpen((open) => !open)}
            >
              {t('market.configurationTitle')}
              <span className="mk-accordion-mark" aria-hidden="true">{configOpen ? '−' : '+'}</span>
            </button>
            {configOpen && (
              <div className="mk-accordion-panel" id="mk-config-panel" role="region">
                <div className="product-option-group">
                  <label className="form-label" htmlFor="mk-material">{t('market.material')}<RequiredMark /></label>
                  <select id="mk-material" className="form-control" value={selectedMaterial} onChange={(event) => setSelectedMaterial(event.target.value)} required aria-required="true">
                    {MATERIAL_OPTIONS.map((material) => <option key={material}>{material}</option>)}
                  </select>
                </div>
                <div className="product-option-group">
                  <span className="form-label">{t('market.color')}<RequiredMark /></span>
                  <div className="market-color-options" role="group" aria-label={t('market.colorSelection')}>
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`market-color-swatch color-${color.toLowerCase().replace(/[^a-z]+/g, '-')} ${selectedColor === color ? 'active' : ''}`}
                        onClick={() => setSelectedColor(color)}
                        aria-label={color}
                        aria-pressed={selectedColor === color}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
                <div className="product-option-group">
                  <label className="form-label" htmlFor="mk-text">{t('market.addCustomText')}<OptionalMark /></label>
                  <input id="mk-text" className="form-control" value={customText} onChange={(event) => setCustomText(event.target.value)} placeholder="e.g. Lab asset 04" maxLength={60} />
                </div>
                <div className="market-upload-row">
                  <label className="market-upload-control"><input type="file" accept=".svg,.png,.jpg,.pdf" />{t('market.uploadLogo')}<OptionalMark /></label>
                  <label className="market-upload-control"><input type="file" accept=".step,.stp,.stl,.obj,.ply" />{t('market.uploadCad')}<OptionalMark /></label>
                </div>
              </div>
            )}
          </div>

          <div className="mk-accordion">
            {ACCORDIONS.map((section) => {
              const open = openAccordion === section.id;
              return (
                <div key={section.id} className="mk-accordion-item">
                  <button
                    type="button"
                    className="mk-accordion-trigger"
                    aria-expanded={open}
                    aria-controls={`mk-acc-${section.id}`}
                    onClick={() => setOpenAccordion(open ? null : section.id)}
                  >
                    {t(section.titleKey)}
                    <span className="mk-accordion-mark" aria-hidden="true">{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <div className="mk-accordion-panel" id={`mk-acc-${section.id}`} role="region">
                      {section.id === 'description' && (
                        <p>{productName} — {t(product.categoryKey)} · {t(product.processKey)} · {selectedMaterial}. {t('market.listingDescription')}</p>
                      )}
                      {section.id === 'specifications' && (
                        <dl className="mk-specs">
                          <div><dt>{t('market.material')}</dt><dd>{selectedMaterial}</dd></div>
                          <div><dt>{t('market.process')}</dt><dd>{t(product.processKey)}</dd></div>
                          <div><dt>{t('market.leadTimeLabel')}</dt><dd>{product.leadTime}</dd></div>
                          <div><dt>{t('market.product')}</dt><dd>{productName}</dd></div>
                        </dl>
                      )}
                      {section.id === 'manufacturing' && (
                        <p>{t('market.manufacturingDetailsBody', { material: selectedMaterial, process: t(product.processKey) })}</p>
                      )}
                      {section.id === 'shipping' && (
                        <p>
                          {t('market.shippingDetailsBody', { leadTime: product.leadTime })}{' '}
                          <button type="button" className="mk-link" onClick={() => setActiveView('shipping')}>
                            {t('market.viewShipping')}
                          </button>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Gallery hero */}
        <section className="mk-gallery" aria-label={t('market.galleryLabel')}>
          <div className="mk-viewer">
            <span className="mp-material mk-viewer-badge">{selectedMaterial}</span>
            <FavoriteButton product={product} className="mp-fav mk-viewer-fav" />
            <ProductMedia product={product} label={t(GALLERY_VIEWS[galleryIndex])} />
            <div className="mk-viewer-nav">
              <button type="button" className="mk-nav-btn" onClick={() => stepGallery(-1)} aria-label={t('market.prevImage')}>
                <span aria-hidden="true">←</span>
              </button>
              <button type="button" className="mk-nav-btn mk-nav-btn--primary" onClick={() => stepGallery(1)} aria-label={t('market.nextImage')}>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
          <div className="mk-thumbs" role="group" aria-label={t('market.galleryLabel')}>
            {GALLERY_VIEWS.map((viewKey, viewIndex) => (
              <button
                key={viewKey}
                type="button"
                className={`mk-thumb${viewIndex === galleryIndex ? ' active' : ''}`}
                aria-label={t(viewKey)}
                aria-pressed={viewIndex === galleryIndex}
                onClick={() => setGalleryIndex(viewIndex)}
              >
                <span className={`mk-thumb-art art-${product.art}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="mk-featured" aria-labelledby="mk-featured-title">
        <h2 id="mk-featured-title" className="mk-featured-title">{t('market.featuredProducts')}</h2>
        <div className="market-product-grid mp-grid mk-featured-grid">
          {featured.map((item) => (
            <article className="market-product-card mp-card mp-card--compact" key={item.id}>
              <div className="mp-media mp-media--compact">
                <ProductMedia product={item} label={t(item.processKey)} />
                <FavoriteButton product={item} />
              </div>
              <div className="mp-body">
                <span className="mp-material">{item.material}</span>
                <h3 className="mp-title">{t(item.nameKey)}</h3>
                <div className="mp-price">{item.price}</div>
                <div className="mp-actions">
                  <button type="button" className="btn btn-primary mp-view" onClick={() => openProduct(item.id)}>
                    {t('actions.viewProduct')}
                    <Icon name="arrowRight" size={16} className="mp-view-arrow" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

// ── Cart ────────────────────────────────────────────────────────────────────

const CartView: React.FC = () => {
  const { t } = useTranslation();
  const { cartItems, updateQuantity, removeLine, goToListing, openProduct } = useMarketplace();
  const { showToast, startManufacturingRequest, openAuthModal, setPostAuthDestination } = useStore();
  const { isAuthenticated } = useAuth();

  const formatEgp = (value: number) => `${value.toLocaleString('en-US')} EGP`;
  const total = cartItems.reduce((sum, item) => {
    const product = getMarketplaceProduct(item.productId);
    return sum + (product ? product.priceEgp * item.quantity : 0);
  }, 0);

  const handleCheckout = () => {
    if (cartItems.length === 0) return;
    if (!isAuthenticated) {
      setPostAuthDestination('marketplace');
      showToast(t('market.cart'), t('market.signInToCheckout'), 'info');
      openAuthModal('login');
      return;
    }
    // Enters the real manufacturing-request workspace (quote → approval →
    // order). No order, quote, or payment is created here.
    startManufacturingRequest();
  };

  if (cartItems.length === 0) {
    return (
      <div className="container marketplace-detail mk-detail">
        <div className="mk-empty">
          <h2>{t('market.cartEmptyTitle')}</h2>
          <p>{t('market.cartEmptyBody')}</p>
          <button type="button" className="btn btn-primary" onClick={goToListing}>
            {t('market.browseMarketplace')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container marketplace-detail mk-detail">
      <nav className="mk-breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="marketplace-back" onClick={goToListing}>
          <span aria-hidden="true">←</span> {t('market.back')}
        </button>
        <span className="mk-crumb-sep" aria-hidden="true">/</span>
        <span className="mk-crumb mk-crumb--current" aria-current="page">{t('market.cart')}</span>
      </nav>
      <h1 className="mk-title">{t('market.cart')} — {cartItems.length}</h1>
      <ul className="mk-cart-lines">
        {cartItems.map((item) => {
          const product = getMarketplaceProduct(item.productId);
          if (!product) return null;
          const productName = t(product.nameKey);
          return (
            <li key={item.lineId} className="mk-cart-line">
              <button type="button" className="mk-cart-thumb" onClick={() => openProduct(product.id)} aria-label={productName}>
                <span className={`mk-thumb-art mk-thumb-art--sm art-${product.art}`} aria-hidden="true" />
              </button>
              <div className="mk-cart-main">
                <strong>{productName}</strong>
                <span className="mk-cart-config">
                  {item.material} · {item.color}
                  {item.customText ? ` · “${item.customText}”` : ''}
                </span>
                <div className="mk-stepper mk-stepper--sm" role="group" aria-label={t('market.quantity')}>
                  <button type="button" onClick={() => updateQuantity(item.lineId, item.quantity - 1)} aria-label={t('market.decreaseQuantity')} disabled={item.quantity <= MIN_CART_QTY}>−</button>
                  <span aria-live="polite">{item.quantity}</span>
                  <button type="button" onClick={() => updateQuantity(item.lineId, item.quantity + 1)} aria-label={t('market.increaseQuantity')} disabled={item.quantity >= MAX_CART_QTY}>+</button>
                </div>
              </div>
              <div className="mk-cart-side">
                <strong>{formatEgp(product.priceEgp * item.quantity)}</strong>
                <button
                  type="button"
                  className="mk-link mk-link--danger"
                  onClick={() => {
                    removeLine(item.lineId);
                    showToast(t('market.cart'), t('market.removeFromCart', { name: productName }), 'info');
                  }}
                  aria-label={t('market.removeFromCart', { name: productName })}
                >
                  {t('market.remove')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mk-cart-footer">
        <div className="mk-cart-total">
          <span>{t('market.cartTotal')}</span>
          <strong>{formatEgp(total)}</strong>
        </div>
        <div className="mk-cart-actions">
          <button type="button" className="btn btn-outline" onClick={goToListing}>
            {t('market.continueShopping')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCheckout}>
            {t('market.proceedToCheckout')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Favorites ───────────────────────────────────────────────────────────────

const FavoritesView: React.FC = () => {
  const { t } = useTranslation();
  const { favorites, goToListing } = useMarketplace();
  const items = MARKETPLACE_PRODUCTS.filter((product) => favorites.has(product.id));

  if (items.length === 0) {
    return (
      <div className="container marketplace-detail mk-detail">
        <div className="mk-empty">
          <h2>{t('market.favoritesEmptyTitle')}</h2>
          <p>{t('market.favoritesEmptyBody')}</p>
          <button type="button" className="btn btn-primary" onClick={goToListing}>
            {t('market.browseMarketplace')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container marketplace-detail mk-detail">
      <nav className="mk-breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="marketplace-back" onClick={goToListing}>
          <span aria-hidden="true">←</span> {t('market.back')}
        </button>
        <span className="mk-crumb-sep" aria-hidden="true">/</span>
        <span className="mk-crumb mk-crumb--current" aria-current="page">{t('market.favorites')}</span>
      </nav>
      <h1 className="mk-title">{t('market.favorites')} — {items.length}</h1>
      <div className="market-product-grid mp-grid">
        {items.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </div>
  );
};

// ── Root ────────────────────────────────────────────────────────────────────

export const MarketplaceView: React.FC = () => {
  const { resolvedTheme } = useTheme();
  const { t } = useTranslation();
  const { subView, selectedProductId } = useMarketplace();
  const { setActiveView } = useStore();
  const selectedProduct = selectedProductId ? getMarketplaceProduct(selectedProductId) : undefined;

  // Theme artwork mapping follows the established BBGG01 (dark) / BBGG02
  // (light) convention. Mirrored in RTL via CSS on the background layer only.
  const heroBackground = resolvedTheme === 'dark' ? '/assets/BBGG66.png' : '/assets/BBGG77.png';

  const heroTitleWords = t('market.title').split(' ').filter(Boolean);
  const heroTitleLead = heroTitleWords.slice(0, -1).join(' ') || t('market.title');
  const heroTitleRest = heroTitleWords.slice(-1).join(' ');

  const heroTrust: { icon: 'cube' | 'gear' | 'shieldCheck' | 'users'; titleKey: string; descKey: string }[] = [
    { icon: 'cube', titleKey: 'market.trustValidated', descKey: 'market.trustValidatedDesc' },
    { icon: 'gear', titleKey: 'market.trustManufacturing', descKey: 'market.trustManufacturingDesc' },
    { icon: 'shieldCheck', titleKey: 'market.trustQuality', descKey: 'market.trustQualityDesc' },
    { icon: 'users', titleKey: 'market.trustEngineers', descKey: 'market.trustEngineersDesc' },
  ];

  const scrollToCatalog = () => {
    document.getElementById('marketplace-catalog')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Secondary action follows the header navigation convention: switch to the
  // landing workflow view, then scroll to its section below the sticky header.
  const goHowItWorks = () => {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setActiveView('workflow');
    window.setTimeout(() => {
      const el = document.getElementById('workflow-section');
      if (!el) return;
      const headerHeight = document.querySelector('.cam-header')?.getBoundingClientRect().height ?? 72;
      const targetTop = el.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
      window.scrollTo({ top: targetTop, behavior: 'smooth' });
    }, 50);
  };

  return (
    <main className="marketplace-page">
      <section className="marketplace-hero">
        <img
          className="market-hero-bg"
          src={heroBackground}
          alt={t('market.heroBackgroundAlt')}
          key={heroBackground}
          aria-hidden="true"
          draggable={false}
        />
        <div className="market-hero-veil" aria-hidden="true" />
        <p className="market-hero-annot-top" aria-hidden="true">{t('market.heroAnnotTop')}</p>
        <div className="container marketplace-hero-content">
          <div className="market-hero-copy">
            <p className="marketplace-kicker">{t('market.marketKicker')}</p>
            <h1 className="market-hero-title">
              <span className="market-hero-title-lead">{heroTitleLead}</span>{' '}
              <span className="market-hero-title-rest">{heroTitleRest}</span>
            </h1>
            <p className="market-hero-desc">{t('market.description')}</p>
            <div className="market-hero-actions">
              <button type="button" className="market-hero-primary" onClick={scrollToCatalog}>
                <span>{t('market.exploreDesigns')}</span>
                <span className="market-hero-primary-arrow" aria-hidden="true">
                  <Icon name="arrowRight" size={18} />
                </span>
              </button>
              <button type="button" className="market-hero-secondary" onClick={goHowItWorks}>
                <span className="market-hero-play" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                  </svg>
                </span>
                <span>{t('market.seeHowItWorks')}</span>
              </button>
            </div>
            <ul className="market-hero-trust">
              {heroTrust.map((item) => (
                <li className="market-hero-trust-item" key={item.titleKey}>
                  <span className="market-hero-trust-icon" aria-hidden="true">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <span className="market-hero-trust-text">
                    <strong>{t(item.titleKey)}</strong>
                    <span>{t(item.descKey)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="market-hero-annot-bottom" aria-hidden="true">
          <span>{t('market.heroAnnotBottom')}</span>
        </p>
      </section>

      {subView === 'listing' && <ListingView />}
      {subView === 'product' && selectedProduct && <ProductDetailsView key={selectedProduct.id} product={selectedProduct} />}
      {subView === 'product' && !selectedProduct && <ListingView />}
      {subView === 'cart' && <CartView />}
      {subView === 'favorites' && <FavoritesView />}
    </main>
  );
};
