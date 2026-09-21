import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../../styles/submit-quote.css';
import { ApiService, MultiFileQuotation } from '../../services/api';
import type { CadFile } from '../../types';
import { useQuoteFileThumbnails } from './useQuoteFileThumbnails';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { DRAFT_KEY } from '../manufacturing/workspace/constants';
import { GOVERNORATES, PreferredPaymentMethod } from '../../constants/locations';
import { ContactInformationSection } from './sections/ContactInformationSection';
import { DeliveryInformationSection, DeliveryForm } from './sections/DeliveryInformationSection';
import { ShippingMethodSection, ShippingRateOption } from './sections/ShippingMethodSection';
import { PaymentMethodSection } from './sections/PaymentMethodSection';
import { BillingAddressSection, BillingForm } from './sections/BillingAddressSection';
import { QuoteSummaryCard, SummaryItem } from './sections/QuoteSummaryCard';
import type { DraftData } from '../../hooks/useDraftPersistence';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(?=.*\d)[0-9+() \-.]{7,20}$/;
const FORM_KEY = 'cam_labs_submit_quote_form_v1';

interface PersistedForm {
  delivery: DeliveryForm;
  billing: BillingForm;
  shippingMethod: string;
  payment: PreferredPaymentMethod;
  couponCode: string;
}

const defaultDelivery: DeliveryForm = {
  country: 'Egypt',
  governorate: '',
  city: '',
  address: '',
  apartment: '',
  postalCode: '',
  saveForNextTime: false,
};

const defaultBilling: BillingForm = {
  sameAsShipping: true,
  country: 'Egypt',
  governorate: '',
  city: '',
  address: '',
  apartment: '',
  postalCode: '',
};

const loadForm = (): Partial<PersistedForm> => {
  try {
    const raw = window.localStorage.getItem(FORM_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedForm;
  } catch {
    return {};
  }
};

const fmtEgp = (n: number) =>
  `EGP ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const SubmitQuoteView: React.FC = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const { setActiveView, openAuthModal, setSubmittedQuote, showToast } = useStore();

  const [contact, setContact] = useState({ fullName: '', email: '', phone: '' });
  const [delivery, setDelivery] = useState<DeliveryForm>(defaultDelivery);
  const [billing, setBilling] = useState<BillingForm>(defaultBilling);
  const [shippingMethod, setShippingMethod] = useState('STANDARD');
  const [payment, setPayment] = useState<PreferredPaymentMethod>('KASHIER');
  // Shipping methods are Super Admin-controlled database records fetched from
  // the backend. No prices are hardcoded here: until the server responds the
  // list is empty (loading state) and submission stays disabled.
  const [rates, setRates] = useState<ShippingRateOption[]>([]);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [ratesError, setRatesError] = useState<string | null>(null);

  const [couponCode, setCouponCode] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponApplied, setCouponApplied] = useState<{ code: string; discountAmount: number; eligibleAmount: number } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [quote, setQuote] = useState<MultiFileQuotation | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  // Full CAD objects (with processing metadata) for real geometry thumbnails.
  // The priced `files` payload sent to the server stays geometry-free.
  const [cadFileList, setCadFileList] = useState<CadFile[]>([]);
  const [draftMeta, setDraftMeta] = useState<{ partName: string; technology: string; material: string; quantity: number; files: any[]; cadFileIds: string[]; technicalNotes: string; technicalDocumentIds: string[]; toleranceGrade: string; surfaceFinish: string } | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Prefill contact from authenticated account; restore persisted form.
  useEffect(() => {
    const saved = loadForm();
    if (saved.delivery) setDelivery((d) => ({ ...d, ...saved.delivery }));
    if (saved.billing) setBilling((b) => ({ ...b, ...saved.billing }));
    if (saved.shippingMethod) setShippingMethod(saved.shippingMethod);
    if (saved.payment) setPayment(saved.payment);
    if (saved.couponCode) setCouponCode(saved.couponCode);
  }, []);

  useEffect(() => {
    setContact({
      fullName: currentUser?.name || '',
      email: currentUser?.email || '',
      phone: currentUser?.phone || '',
    });
    // Restore saved profile address into delivery defaults when available.
    // Prefers the Account Settings default address-book entry; falls back to
    // the legacy profile fields. Historical quotes keep their own snapshots.
    if (currentUser && !loadForm().delivery) {
      const u: any = currentUser;
      const book = Array.isArray(u?.preferences?.addressBook) ? u.preferences.addressBook : [];
      const defaultEntry = book.find((a: any) => a?.id === u?.preferences?.defaultAddressId) ?? book[0];
      setDelivery((d) => ({
        ...d,
        governorate: d.governorate || defaultEntry?.governorate || u.governorate || '',
        city: d.city || defaultEntry?.city || u.city || '',
        address:
          d.address ||
          defaultEntry?.street ||
          (typeof u.address === 'string' && !u.addressLine1 ? u.address.split(',')[0] || '' : u.addressLine1 || ''),
        apartment: d.apartment || defaultEntry?.building || '',
        postalCode: d.postalCode || defaultEntry?.postalCode || '',
      }));
    }
  }, [currentUser]);

  // Persist form (never persist contact PII beyond session need — delivery/billing only).
  useEffect(() => {
    try {
      window.localStorage.setItem(FORM_KEY, JSON.stringify({ delivery, billing, shippingMethod, payment, couponCode } satisfies PersistedForm));
    } catch {
      /* ignore */
    }
  }, [delivery, billing, shippingMethod, payment, couponCode]);

  // Authoritative shipping rates (Super Admin-controlled). Single controlled
  // fetch with an explicit Retry — no silent swallowing, no toast per failure.
  const loadRates = useCallback(async () => {
    setRatesLoading(true);
    setRatesError(null);
    try {
      const r = await ApiService.getShippingRates();
      const next = (r?.rates || []).map((x) => ({
        id: x.id,
        label: x.label,
        description: x.description,
        eta: x.eta,
        feeEgp: Number(x.feeEgp) || 0,
      }));
      if (!next.length) {
        setRates([]);
        setRatesError('No shipping methods are available right now. Please try again.');
        return;
      }
      setRates(next);
      setShippingMethod((current) => (next.some((x) => x.id === current) ? current : next[0].id));
    } catch (e) {
      setRates([]);
      setRatesError(e instanceof Error ? e.message : 'Shipping methods could not be loaded.');
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRates();
  }, [loadRates]);

  // Load workspace configuration (draft + server CAD) and recalculate pricing server-side.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setQuoteLoading(true);
      setQuoteError(null);
      try {
        let draft: DraftData | null = null;
        try {
          const raw = window.localStorage.getItem(DRAFT_KEY);
          if (raw) draft = JSON.parse(raw) as DraftData;
        } catch {
          draft = null;
        }
        const cadFiles = (await ApiService.getCadFiles().catch(() => null)) || [];
        const fileConfigs = draft?.fileConfigurations || {};
        const request: any = draft?.request || {};
        const usableIds = Object.keys(fileConfigs).length
          ? Object.keys(fileConfigs).filter((id) => cadFiles.some((f) => f.id === id))
          : cadFiles.map((f) => f.id);
        const ids = usableIds.length ? usableIds : cadFiles.filter((f) => (f as any).latestVersion?.processingStatus === 'COMPLETE').map((f) => f.id);
        if (!ids.length) {
          if (!cancelled) {
            setQuoteError('No configured CAD files found. Please configure your quote first.');
            setQuoteLoading(false);
          }
          return;
        }
        const files = ids.map((id) => {
          const f = cadFiles.find((x) => x.id === id);
          const cfg: any = (fileConfigs as any)[id] || {};
          const md: any = (f as any)?.latestVersion?.metadata || {};
          return {
            fileId: id,
            fileName: f?.name || 'part.stl',
            format: (f?.format || 'STL') as string,
            materialId: cfg.material || request.material || 'pla',
            technology: String(cfg.process || request.process || 'fdm').toUpperCase(),
            surfaceFinish: cfg.finish || request.finish || 'standard',
            toleranceGrade: cfg.tolerance === 'precision' ? ('precision' as const) : ('standard' as const),
            quantity: Number(cfg.quantity || request.quantity || 1),
            volumeCm3: md?.volume,
            surfaceAreaCm2: md?.surfaceArea,
            triangleCount: md?.triangleCount,
          };
        });
        const techDocs = Array.isArray((draft as any)?.technicalDocuments)
          ? (draft as any).technicalDocuments.filter((d: any) => d?.id).map((d: any) => d.id)
          : [];
        const calc = await ApiService.calculateMultiFileQuotation({ files });
        if (cancelled) return;
        setQuote(calc);
        setCadFileList(cadFiles.filter((f) => ids.includes(f.id)));
        const primary = cadFiles.find((f) => f.id === ids[0]);
        setDraftMeta({
          partName: (primary?.name as string) || 'Custom_Component.step',
          technology: String(files[0]?.technology || 'FDM'),
          material: String(files[0]?.materialId || 'pla'),
          quantity: files.reduce((s, f) => s + Number(f.quantity || 1), 0),
          files,
          cadFileIds: ids,
          technicalNotes: typeof draft?.note === 'string' ? draft.note : '',
          technicalDocumentIds: techDocs,
          toleranceGrade: String((fileConfigs as any)[ids[0]]?.tolerance || request.tolerance || 'standard'),
          surfaceFinish: String((fileConfigs as any)[ids[0]]?.finish || request.finish || 'standard'),
        });
      } catch (e) {
        if (!cancelled) setQuoteError(e instanceof Error ? e.message : 'Pricing could not be calculated.');
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const subtotal = useMemo(() => (quote ? Number(quote.totalCustomerPrice) || 0 : 0), [quote]);
  // Display-only estimate from the selected server-provided rate. The backend
  // re-resolves the method code at submission and ignores any client amount.
  const shippingFee = useMemo(() => {
    const r = rates.find((x) => x.id === shippingMethod);
    return r ? Number(r.feeEgp) || 0 : 0;
  }, [rates, shippingMethod]);
  const discountAmount = couponApplied ? Number(couponApplied.discountAmount) || 0 : 0;
  const estimatedTotal = Math.max(0, subtotal + shippingFee - discountAmount);

  // Real per-file geometry thumbnails through the shared single-context
  // renderer (cached per cadFile.id — no viewer per card, no re-render cost).
  const thumbs = useQuoteFileThumbnails(cadFileList);

  const items: SummaryItem[] = useMemo(() => {
    if (!quote) return [];
    return quote.files.map((f) => {
      const thumb = thumbs[f.fileId];
      return {
        id: f.fileId,
        fileId: f.fileId,
        name: f.fileName,
        meta: `${f.process} · ${f.material}`,
        quantity: f.quantity,
        priceText: fmtEgp(Number(f.discountedSubtotal ?? f.subtotalBeforeFee) || 0),
        thumbUrl: thumb?.url || null,
        thumbState: thumb?.state || 'loading',
      };
    });
  }, [quote, thumbs]);

  const applyCoupon = useCallback(async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    if (!isAuthenticated) {
      openAuthModal('login');
      return;
    }
    setCouponApplying(true);
    setCouponError(null);
    try {
      const res = await ApiService.validateCoupon({ code, subtotalAmount: subtotal, shippingAmount: shippingFee });
      if (!res) throw new Error('Coupon validation is unavailable.');
      setCouponApplied({ code: res.code, discountAmount: Number(res.discountAmount) || 0, eligibleAmount: Number(res.eligibleAmount) || 0 });
      showToast('Coupon applied', `${res.code} — ${fmtEgp(Number(res.discountAmount) || 0)} off.`, 'success');
    } catch (e: any) {
      setCouponApplied(null);
      setCouponError(e?.message || 'This coupon could not be applied.');
    } finally {
      setCouponApplying(false);
    }
  }, [couponCode, isAuthenticated, openAuthModal, subtotal, shippingFee, showToast]);

  const validateForm = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (!contact.fullName.trim()) next.fullName = 'Full name is required.';
    if (!EMAIL_RE.test(contact.email.trim())) next.email = 'Enter a valid email address.';
    if (!PHONE_RE.test(contact.phone.trim())) next.phone = 'Enter a valid phone number.';
    if (delivery.country !== 'Egypt') next.country = 'Only Egypt is supported.';
    if (!GOVERNORATES.includes(delivery.governorate)) next.governorate = 'Select a governorate.';
    if (!delivery.city.trim()) next.city = 'City is required.';
    if (!delivery.address.trim()) next.address = 'Address is required.';
    if (!billing.sameAsShipping) {
      if (billing.country !== 'Egypt') next.billingCountry = 'Only Egypt is supported.';
      if (!GOVERNORATES.includes(billing.governorate)) next.billingGovernorate = 'Select a governorate.';
      if (!billing.city.trim()) next.billingCity = 'City is required.';
      if (!billing.address.trim()) next.billingAddress = 'Address is required.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [contact, delivery, billing]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    if (!isAuthenticated) {
      openAuthModal('login');
      showToast('Sign in required', 'Please sign in or create an account to submit your quote.', 'info');
      return;
    }
    if (!validateForm()) {
      setSubmitError('Please complete the highlighted fields.');
      return;
    }
    if (!draftMeta || !quote) {
      setSubmitError('Your quote configuration is not ready yet.');
      return;
    }
    if (ratesLoading || rates.length === 0) {
      setSubmitError('Shipping methods are still loading or unavailable. Please wait or retry loading shipping methods.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        partName: draftMeta.partName,
        technology: draftMeta.technology,
        material: draftMeta.material,
        quantity: draftMeta.quantity,
        toleranceGrade: draftMeta.toleranceGrade,
        surfaceFinish: draftMeta.surfaceFinish,
        cadFileIds: draftMeta.cadFileIds,
        files: draftMeta.files,
        technicalNotes: draftMeta.technicalNotes,
        technicalDocumentIds: draftMeta.technicalDocumentIds,
        contact: { fullName: contact.fullName.trim(), email: contact.email.trim(), phone: contact.phone.trim() },
        delivery: {
          country: delivery.country,
          governorate: delivery.governorate,
          city: delivery.city.trim(),
          address: delivery.address.trim(),
          apartment: delivery.apartment.trim(),
          postalCode: delivery.postalCode.trim(),
        },
        saveAddress: delivery.saveForNextTime,
        shippingMethod,
        preferredPaymentMethod: payment,
        billingSameAsShipping: billing.sameAsShipping,
        billingAddress: billing.sameAsShipping
          ? undefined
          : {
              country: billing.country,
              governorate: billing.governorate,
              city: billing.city.trim(),
              address: billing.address.trim(),
              apartment: billing.apartment.trim(),
              postalCode: billing.postalCode.trim(),
            },
        couponCode: couponApplied ? couponApplied.code : couponCode.trim() ? couponCode.trim().toUpperCase() : undefined,
      };
      // The server revalidates the coupon, recalculates pricing/shipping, and
      // creates a Quote ONLY (never an Order or payment).
      const res = await ApiService.submitQuote(payload);
      if (!res?.quote) throw new Error('Quote submission did not return a quote.');
      setSubmittedQuote(res.quote as any);
      try {
        window.localStorage.removeItem(FORM_KEY);
      } catch {
        /* ignore */
      }
      setActiveView('quote-success');
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      const msg = e?.message || 'Quote could not be submitted. Please try again.';
      setSubmitError(msg);
      showToast('Submission failed', msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, isAuthenticated, validateForm, draftMeta, quote, contact, delivery, shippingMethod, payment, billing, couponApplied, couponCode, ratesLoading, rates, setSubmittedQuote, setActiveView, showToast, openAuthModal]);

  if (!isAuthenticated) {
    return (
      <main className="sq-page" aria-label="Submit Quote — sign in required">
        <div className="sq-auth-gate">
          <h1>Sign in to submit your quote</h1>
          <p>Your configuration is preserved. Sign in or create an account to continue to the Submit Quote page.</p>
          <div className="sq-auth-actions">
            <button type="button" className="sq-submit" onClick={() => openAuthModal('login')}>
              Sign In
            </button>
            <button type="button" className="sq-edit" onClick={() => openAuthModal('register')}>
              Create Account
            </button>
            <button type="button" className="sq-link" onClick={() => setActiveView('manufacturing-request')}>
              ← Back to configuration
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="sq-page" aria-label="Submit Quote">
      <div className="sq-head">
        <div>
          <h1 className="sq-title">Submit Quote</h1>
          <p className="sq-subtitle">Review your details — CAM LABS confirms final pricing after review.</p>
        </div>
        <div className="sq-help">
          <span>Need Help?</span>
          <span className="sq-help-sub">Contact our team</span>
        </div>
      </div>

      {quoteError ? (
        <p className="sq-error" role="alert">
          {quoteError}{' '}
          <button type="button" className="sq-link" onClick={() => setActiveView('manufacturing-request')}>
            Edit Items
          </button>
        </p>
      ) : null}

      <div className="sq-layout">
        <div className="sq-main">
          <ContactInformationSection
            fullName={contact.fullName}
            email={contact.email}
            phone={contact.phone}
            errors={errors}
            onChange={(p) => setContact((c) => ({ ...c, ...p }))}
          />
          <DeliveryInformationSection value={delivery} errors={errors} onChange={(p) => setDelivery((d) => ({ ...d, ...p }))} />
          <ShippingMethodSection rates={rates} selected={shippingMethod} loading={ratesLoading} error={ratesError} onSelect={setShippingMethod} onRetry={() => void loadRates()} />
          <PaymentMethodSection selected={payment} onSelect={setPayment} />
          <BillingAddressSection value={billing} errors={errors} onChange={(p) => setBilling((b) => ({ ...b, ...p }))} />
        </div>

        <QuoteSummaryCard
          items={items}
          itemCountText={quoteLoading ? 'Loading…' : `${items.length} item${items.length === 1 ? '' : 's'} in your quote`}
          subtotalText={quoteLoading ? '…' : fmtEgp(subtotal)}
          shippingText={fmtEgp(shippingFee)}
          discountText={discountAmount > 0 ? `−${fmtEgp(discountAmount).replace('EGP ', 'EGP −')}` : null}
          estimatedTotalText={quoteLoading ? '…' : fmtEgp(estimatedTotal)}
          couponCode={couponCode}
          couponApplying={couponApplying}
          couponApplied={couponApplied}
          couponError={couponError}
          submitting={submitting}
          canSubmit={!quoteLoading && !!quote && !quoteError && !ratesLoading && rates.length > 0}
          onCouponCodeChange={(v) => {
            setCouponCode(v);
            setCouponError(null);
          }}
          onCouponApply={applyCoupon}
          onCouponRemove={() => {
            setCouponApplied(null);
            setCouponCode('');
            setCouponError(null);
          }}
          onEditItems={() => setActiveView('manufacturing-request')}
          onSubmit={handleSubmit}
          submitError={submitError}
        />
      </div>
    </main>
  );
};
