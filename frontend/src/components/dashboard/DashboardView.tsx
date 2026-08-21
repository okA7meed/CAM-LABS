import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { OrderTimelineModal } from './OrderTimelineModal';
import { CadVaultPanel } from './CadVaultPanel';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { Icon, IconName } from '../ui/Icon';
import { PriceEstimateNotice } from '../ui/PriceEstimateNotice';

const orderStages: Array<{ label: string; icon: IconName }> = [
  { label: 'Upload', icon: 'upload' },
  { label: 'Analysis', icon: 'file' },
  { label: 'Manufacturing', icon: 'technology' },
  { label: 'Quality Check', icon: 'review' },
  { label: 'Shipping', icon: 'send' },
  { label: 'Delivered', icon: 'check' },
];

const getOrderStageIndex = (status: string, progressStep: number) => {
  if (status === 'Delivered') return 5;
  if (status === 'Quality Inspection') return 3;
  if (status === 'In Production') return Math.max(2, Math.min(progressStep + 1, 2));
  if (status === 'Cancelled') return -1;
  return Math.max(1, Math.min(progressStep, 1));
};

export const DashboardView: React.FC = () => {
  const { currentUser } = useAuth();
  const { orders, quotes, startManufacturingRequest, openOrderTimeline, approveQuote, showToast, setActiveView } = useStore();
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const { t } = useTranslation();

  if (!currentUser) return <main className="dashboard-layout"><div className="container"><p>{t('dashboard.signInRequired')}</p></div></main>;

  const filteredOrders = orders.filter((order) => {
    const query = orderSearchQuery.toLowerCase().trim();
    return !query || [order.id, order.partName, order.technology, order.material].some((value) => value.toLowerCase().includes(query));
  });

  const handleDownloadSpec = (quoteId: string) => {
    showToast('Specification PDF Ready', `Engineering Spec sheet for ${quoteId} downloaded.`, 'info');
  };

  return (
    <main className="dashboard-layout">
      <div className="container">
        <div className="dashboard-header-bar">
          <div>
            <div className="user-welcome-title"><span>{t('dashboard.welcome')}, {currentUser.name}</span><span className="badge badge-blue">{currentUser.tier}</span></div>
            <div className="dashboard-user-meta">{currentUser.role} · {currentUser.company}</div>
          </div>
          <div className="dashboard-actions-cluster">
            <button className="btn btn-sm btn-outline" onClick={() => { setActiveView('materials'); document.getElementById('materials-section')?.scrollIntoView({ behavior: 'smooth' }); }}>{t('dashboard.materials')}</button>
            <button className="btn btn-sm btn-outline" onClick={() => setActiveView('profile')}>{t('dashboard.preferences')}</button>
            <button className="btn btn-primary cam-shine-auto" onClick={() => startManufacturingRequest()}>{t('nav.startManufacturing')}</button>
          </div>
        </div>

        <div className="metrics-row">
          <div className="stat-card active"><div className="stat-label">{t('dashboard.activeOrders')}</div><div className="stat-value">{orders.filter((order) => order.status !== 'Delivered').length}</div><div className="stat-subtext">{t('dashboard.allNodes')}</div></div>
          <div className="stat-card"><div className="stat-label">{t('dashboard.quotes')}</div><div className="stat-value">{quotes.length}</div><div className="stat-subtext">{t('dashboard.awaitingApproval')}</div></div>
          <div className="stat-card"><div className="stat-label">{t('dashboard.parts')}</div><div className="stat-value">{new Intl.NumberFormat(i18n.language.startsWith('ar') ? 'ar-EG' : 'en-US').format(orders.reduce((total, order) => total + (order.quantity || 1), 0) + 1420)}</div><div className="stat-subtext">{t('dashboard.projectBatches')}</div></div>
          <div className="stat-card"><div className="stat-label">{t('dashboard.quality')}</div><div className="stat-value">99.94%</div><div className="stat-subtext">{t('dashboard.toleranceTarget')}</div></div>
        </div>

        <div className="dashboard-section-panel dashboard-orders-panel">
          <div className="panel-header-row"><div className="panel-title-group"><h3 className="panel-title">{t('dashboard.orders')}</h3><span className="badge badge-neutral">{t('dashboard.liveTelemetry')}</span></div><input className="form-control dashboard-order-search" placeholder={t('dashboard.search')} value={orderSearchQuery} onChange={(event) => setOrderSearchQuery(event.target.value)} /></div>
          {filteredOrders.length === 0 ? <div className="dashboard-empty-state"><span className="dashboard-empty-icon"><Icon name="technology" size={24} /></span><strong>{t('dashboard.noOrders')}</strong><p>Start a manufacturing request to see production telemetry here.</p><button className="btn btn-primary cam-shine-auto" onClick={() => startManufacturingRequest()}><Icon name="upload" size={15} />{t('nav.startManufacturing')}</button></div> : <div className="order-card-list">{filteredOrders.map((order) => {
            const stageIndex = getOrderStageIndex(order.status, order.progressStep);
            const lastUpdate = order.history.find((milestone) => milestone.done)?.date || order.date;
            return <article className="order-card" key={order.id}>
              <div className="order-card-main">
                <div className="order-card-heading"><div><span className="mono-tag">{order.id}</span><h4>{order.partName}</h4></div><span className={`badge ${order.statusBadge || 'badge-blue'}`}><span className="pulse-dot" />{order.status}</span></div>
                <div className="order-card-meta"><span><b>Technology</b>{order.technology}</span><span><b>Material</b>{order.material}</span><span><b>Quantity</b>{order.quantity} {t('dashboard.pcs')}</span><span><b>Total</b>{order.totalCost}<PriceEstimateNotice /></span><span><b>Expected delivery</b>{order.estDelivery}</span><span><b>Last update</b>{lastUpdate}</span></div>
              </div>
              <div className="order-card-footer"><div className="order-timeline" aria-label={`Production stage: ${stageIndex >= 0 ? orderStages[stageIndex].label : 'Cancelled'}`}>
                {orderStages.map((stage, index) => <div className={`order-timeline-step ${stageIndex === index ? 'is-current' : stageIndex > index ? 'is-complete' : ''}`} key={stage.label}><span><Icon name={stageIndex > index ? 'check' : stage.icon} size={13} /></span><small>{stage.label}</small></div>)}
              </div><button className="btn btn-sm btn-outline" onClick={() => openOrderTimeline(order)}><Icon name="review" size={14} />{t('dashboard.track')}</button></div>
            </article>;
          })}</div>}
        </div>

        <div className="dashboard-section-panel">
          <div className="panel-header-row"><div className="panel-title-group"><h3 className="panel-title">{t('dashboard.pendingQuotes')}</h3><span className="badge badge-warning">{t('dashboard.priceGuaranteed')}</span></div><button className="btn btn-sm btn-outline" onClick={() => startManufacturingRequest()}>{t('dashboard.requestNewQuote')}</button></div>
          <div className="table-responsive"><table className="cam-table"><thead><tr><th>{t('dashboard.quoteId')}</th><th>{t('dashboard.component')}</th><th>{t('dashboard.process')}</th><th>{t('dashboard.qty')}</th><th>{t('dashboard.unitPrice')}</th><th>{t('dashboard.total')}</th><th>{t('dashboard.approval')}</th></tr></thead><tbody>
            {quotes.length === 0 ? <tr><td colSpan={7} className="dashboard-empty-cell">{t('dashboard.noQuotes')}</td></tr> : quotes.map((quote) => <tr key={quote.id}><td><strong className="mono-primary">{quote.id}</strong></td><td>{quote.partName}</td><td><span className="mono-tag">{quote.technology}</span></td><td>{quote.quantity} {t('dashboard.pcs')}</td><td><span className="price-cell">{quote.unitPrice}<PriceEstimateNotice /></span></td><td><span className="price-cell">{quote.totalPrice}<PriceEstimateNotice /></span></td><td><div className="dashboard-quote-actions"><button className="btn btn-sm btn-primary" onClick={() => approveQuote(quote.id)}>{t('dashboard.approve')}</button><button className="btn btn-sm btn-outline" onClick={() => handleDownloadSpec(quote.id)}>{t('dashboard.specPdf')}</button></div></td></tr>)}
          </tbody></table></div>
        </div>

        <CadVaultPanel />
      </div>
      <OrderTimelineModal />
    </main>
  );
};