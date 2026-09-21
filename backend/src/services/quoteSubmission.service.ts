import { randomInt } from 'crypto';
import { getPrismaClient } from '../config/database';
import { AppError } from '../utils/errors';
import { Logger } from '../utils/logger';
import { QuotesService } from './quotes.service';
import { CouponsService } from './coupons.service';
import { BusinessReferenceService } from './businessReference.service';
import { normalizeShippingCode, resolveShippingMethod } from './shipping.service';
import { TechnicalDocumentsService } from './technicalDocuments.service';

export const GOVERNORATES = [
  '6th of October',
  'Al Shargia',
  'Alexandria',
  'Aswan',
  'Asyut',
  'Beheira',
  'Beni Suef',
  'Cairo',
  'Dakahlia',
  'Damietta',
  'Faiyum',
  'Gharbia',
  'Giza',
  'Helwan',
  'Ismailia',
  'Kafr el-Sheikh',
  'Luxor',
  'Matrouh',
  'Minya',
  'Monufia',
  'New Valley',
  'North Sinai',
  'Port Said',
  'Qalyubia',
  'Qena',
  'Red Sea',
  'Sohag',
  'South Sinai',
  'Suez',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(?=.*\d)[0-9+() \-.]{7,20}$/;

const nonEmpty = (v: unknown, max = 200) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null;

function parseEgp(formatted: unknown): number {
  const m = String(formatted || '').match(/-?\d[\d,]*\.?\d*/);
  if (!m) return 0;
  const v = parseFloat(m[0].replace(/,/g, ''));
  return Number.isFinite(v) ? v : 0;
}

const formatEgp = (n: number) =>
  `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`;

export interface SubmitQuoteInput {
  userId: string;
  guestCadId?: string;
  partName: string;
  technology: string;
  material: string;
  quantity: number;
  toleranceGrade?: string;
  surfaceFinish?: string;
  cadFileIds?: string[];
  files?: Array<Record<string, any>>;
  cadFileId?: string;
  technicalNotes?: string;
  technicalDocumentIds?: string[];
  contact?: { fullName?: string; email?: string; phone?: string };
  delivery?: {
    country?: string;
    governorate?: string;
    city?: string;
    address?: string;
    addressLine1?: string;
    apartment?: string;
    addressLine2?: string;
    postalCode?: string;
  };
  saveAddress?: boolean;
  shippingMethod?: string;
  preferredPaymentMethod?: string;
  billingSameAsShipping?: boolean;
  billingAddress?: {
    country?: string;
    governorate?: string;
    city?: string;
    address?: string;
    addressLine1?: string;
    apartment?: string;
    addressLine2?: string;
    postalCode?: string;
  };
  couponCode?: string;
}

function validateSubmitInput(body: SubmitQuoteInput) {
  const quantity = Number(body.quantity);
  if (!body.partName || !body.technology || !body.material || !Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
    throw new AppError('partName, technology, material, and a quantity between 1 and 10000 are required.', 400, 'INVALID_INPUT');
  }
  // Contact
  const fullName = nonEmpty(body.contact?.fullName, 120);
  const email = typeof body.contact?.email === 'string' ? body.contact.email.trim() : '';
  const phone = typeof body.contact?.phone === 'string' ? body.contact.phone.trim() : '';
  if (!fullName) throw new AppError('Full name is required.', 400, 'CONTACT_NAME_REQUIRED');
  if (!email || !EMAIL_RE.test(email)) throw new AppError('A valid email address is required.', 400, 'CONTACT_EMAIL_INVALID');
  if (!phone || !PHONE_RE.test(phone)) throw new AppError('A valid phone number is required.', 400, 'CONTACT_PHONE_INVALID');

  // Delivery
  const d = body.delivery || {};
  const country = (d.country || 'Egypt').trim();
  if (country !== 'Egypt') throw new AppError('Only Egypt is supported for delivery in the current implementation.', 400, 'COUNTRY_UNSUPPORTED');
  const governorate = typeof d.governorate === 'string' ? d.governorate.trim() : '';
  if (!GOVERNORATES.includes(governorate)) throw new AppError('A valid governorate is required.', 400, 'GOVERNORATE_INVALID');
  const city = nonEmpty(d.city, 120);
  if (!city) throw new AppError('City is required.', 400, 'CITY_REQUIRED');
  const addressLine1 = nonEmpty(d.address || d.addressLine1, 300);
  if (!addressLine1) throw new AppError('Address is required.', 400, 'ADDRESS_REQUIRED');
  const addressLine2 = typeof (d.apartment || d.addressLine2) === 'string' ? String(d.apartment || d.addressLine2).trim().slice(0, 300) : null;
  const postalCode = typeof d.postalCode === 'string' && d.postalCode.trim() ? d.postalCode.trim().slice(0, 20) : null;

  // Shipping: client submits only the method code; the price is resolved
  // server-side from the Super Admin-controlled record (never trusted).
  const shippingMethod = normalizeShippingCode(body.shippingMethod);
  const ppmRaw = String(body.preferredPaymentMethod || 'KASHIER').trim().toUpperCase();
  const preferredPaymentMethod = ppmRaw === 'COD' || ppmRaw === 'CASH_ON_DELIVERY' || ppmRaw === 'CASH' ? 'COD' : 'KASHIER';

  // Billing
  const billingSameAsShipping = body.billingSameAsShipping !== false;
  let billing: any = null;
  if (billingSameAsShipping) {
    billing = { country, governorate, city, addressLine1, addressLine2, postalCode };
  } else {
    const b = body.billingAddress || {};
    const bCountry = (b.country || 'Egypt').trim();
    if (bCountry !== 'Egypt') throw new AppError('Only Egypt is supported for billing in the current implementation.', 400, 'BILLING_COUNTRY_UNSUPPORTED');
    const bGov = typeof b.governorate === 'string' ? b.governorate.trim() : '';
    if (!GOVERNORATES.includes(bGov)) throw new AppError('A valid billing governorate is required.', 400, 'BILLING_GOVERNORATE_INVALID');
    const bCity = nonEmpty(b.city, 120);
    const bAddr = nonEmpty(b.address || b.addressLine1, 300);
    if (!bCity || !bAddr) throw new AppError('Billing city and address are required.', 400, 'BILLING_ADDRESS_REQUIRED');
    billing = {
      country: bCountry,
      governorate: bGov,
      city: bCity,
      addressLine1: bAddr,
      addressLine2: typeof (b.apartment || b.addressLine2) === 'string' ? String(b.apartment || b.addressLine2).trim().slice(0, 300) : null,
      postalCode: typeof b.postalCode === 'string' && b.postalCode.trim() ? b.postalCode.trim().slice(0, 20) : null,
    };
  }

  return { quantity, fullName, email, phone, country, governorate, city, addressLine1, addressLine2, postalCode, shippingMethod, preferredPaymentMethod, billingSameAsShipping, billing };
}

/**
 * Submit Quote — creates/finalizes a Quote ONLY. Never creates an Order,
 * never initializes payment. Backend is authoritative for pricing, shipping
 * and coupons; frontend totals are ignored.
 */
export class QuoteSubmissionService {
  static async submit(input: SubmitQuoteInput) {
    if (!input.userId) throw new AppError('Authentication is required to submit a quote.', 401, 'AUTH_REQUIRED');
    const v = validateSubmitInput(input);
    const prisma = getPrismaClient() as any;

    // Customer must exist.
    const customer = await prisma.user.findUnique({ where: { id: input.userId } });
    if (!customer) throw new AppError('Authenticated customer not found.', 401, 'CUSTOMER_NOT_FOUND');

    // Server-side pricing (authoritative; client totals ignored).
    let pricing: any;
    let cadFileIds: string[] = [];
    let pricingEquationVersionId: string | undefined;
    let pricingBreakdown: any = null;
    let subtotal = 0;
    let unitPriceStr = '';
    let totalPriceStr = '';
    let leadTime = '3–5 business days';
    let providerQuoteRef: string | undefined;

    if (input.files && Array.isArray(input.files) && input.files.length > 0) {
      if (input.files.length > 20) throw new AppError('A quotation can reference at most 20 CAD files.', 400, 'INVALID_INPUT');
      pricing = await QuotesService.calculateMultiFileQuotation({
        files: input.files as any,
        cadOwner: { userId: input.userId },
      });
      cadFileIds = (input.files as any[]).map((f) => String(f.fileId));
      subtotal = Number(pricing.totalCustomerPrice) || 0;
      totalPriceStr = pricing.formattedTotalPrice;
      unitPriceStr = `${(subtotal / Math.max(1, v.quantity)).toFixed(2)} EGP`;
      leadTime = pricing.leadTime || leadTime;
      providerQuoteRef = pricing.quoteId;
      pricingBreakdown = pricing.pricingBreakdown;
      pricingEquationVersionId = (pricing.files?.[0]?.pricingBreakdown as any)?.equationVersionId || undefined;
    } else {
      const cadFileId = (input.cadFileIds?.[0] || input.cadFileId || '') as string;
      if (!cadFileId) throw new AppError('A CAD file reference is required.', 400, 'CAD_REQUIRED');
      pricing = await QuotesService.calculateQuotation({
        materialId: input.material,
        technology: input.technology,
        surfaceFinish: input.surfaceFinish || 'standard',
        toleranceGrade: (input.toleranceGrade as 'standard' | 'precision') || 'standard',
        quantity: v.quantity,
        cadFileId,
        cadOwner: { userId: input.userId },
      });
      cadFileIds = input.cadFileIds && input.cadFileIds.length ? input.cadFileIds.map(String) : [String(cadFileId)];
      subtotal = Number(pricing.totalCustomerPrice) || 0;
      totalPriceStr = pricing.formattedTotalPrice;
      unitPriceStr = pricing.formattedUnitPrice;
      leadTime = pricing.leadTime || leadTime;
      providerQuoteRef = pricing.quoteRef;
      pricingBreakdown = pricing.pricingBreakdown;
      pricingEquationVersionId = (pricingBreakdown as any)?.equationVersionId || undefined;
    }

    if (!Number.isFinite(subtotal) || subtotal < 0) throw new AppError('Pricing engine returned an invalid total.', 500, 'PRICING_INVALID');

    // Authoritative shipping resolution — re-read at final submission so a
    // price changed mid-checkout (or a manipulated code) can never stick.
    // Disabled/archived/unknown codes are rejected, never priced.
    const shipping = await resolveShippingMethod(v.shippingMethod);
    const shippingFee = Number(shipping.priceEgp) || 0;

    // Coupon: validate server-side against the CURRENT authoritative shipping
    // fee (Apply-time check), then re-validated atomically at submit.
    const couponCode = typeof input.couponCode === 'string' && input.couponCode.trim() ? input.couponCode.trim().toUpperCase() : null;
    let couponPreview: any = null;
    if (couponCode) {
      couponPreview = await CouponsService.validateForQuote({
        code: couponCode,
        userId: input.userId,
        subtotalAmount: subtotal,
        shippingAmount: shippingFee,
      });
    }
    const discountAmount = couponPreview ? Number(couponPreview.discountAmount) || 0 : 0;
    const eligibleAmount = couponPreview ? Number(couponPreview.eligibleAmount) || 0 : 0;
    const estimatedTotal = Math.max(0, subtotal + shippingFee - discountAmount);

    const shippingSnapshot = {
      country: v.country,
      governorate: v.governorate,
      city: v.city,
      addressLine1: v.addressLine1,
      addressLine2: v.addressLine2,
      postalCode: v.postalCode,
      // Historical snapshot — later admin edits to the method MUST NOT alter this quote.
      shippingMethodId: shipping.id,
      method: shipping.code,
      methodCode: shipping.code,
      methodName: shipping.name,
      methodLabel: shipping.name,
      deliveryEstimate: shipping.eta,
      eta: shipping.eta,
      feeEgp: shippingFee,
      priceEgp: shippingFee,
      currency: shipping.currency,
    };
    const contactSnapshot = { fullName: v.fullName, email: v.email, phone: v.phone };

    // Unified business reference (server-generated, unique).
    const reference = await BusinessReferenceService.generateUniqueReference();
    const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const technicalDocumentIds = Array.isArray(input.technicalDocumentIds)
      ? input.technicalDocumentIds.filter((id) => typeof id === 'string').slice(0, 10)
      : [];

    const generateQuoteId = () => `RFQ-2026-${randomInt(100000, 1000000)}`;

    // Transaction: create quote + consume coupon + persist address + attach docs.
    const created = await prisma.$transaction(async (tx: any) => {
      let quoteId = generateQuoteId();
      // Guard against the (unlikely) PK collision.
      for (let i = 0; i < 5; i++) {
        const exists = await tx.quote.findUnique({ where: { id: quoteId }, select: { id: true } }).catch(() => null);
        if (!exists) break;
        quoteId = generateQuoteId();
      }

      let quote: any;
      try {
        quote = await tx.quote.create({
          data: {
            id: quoteId,
            reference,
            userId: input.userId,
            partName: input.partName,
            technology: input.technology,
            material: input.material,
            quantity: v.quantity,
            toleranceGrade: input.toleranceGrade || 'standard',
            surfaceFinish: input.surfaceFinish || 'standard',
            manufacturingCost: formatEgp(subtotal),
            unitPrice: unitPriceStr,
            totalPrice: totalPriceStr,
            leadTime,
            validUntil,
            status: 'Ready for Approval',
            provider: 'CAM LABS',
            providerQuoteRef,
            cadFileIds,
            technicalNotes: typeof input.technicalNotes === 'string' ? input.technicalNotes.slice(0, 2000) : '',
            pricingEquationVersionId: pricingEquationVersionId || undefined,
            pricingBreakdown: pricingBreakdown as any,
            contactName: v.fullName,
            contactEmail: v.email,
            contactPhone: v.phone,
            contactSnapshot,
            country: v.country,
            governorate: v.governorate,
            city: v.city,
            addressLine1: v.addressLine1,
            addressLine2: v.addressLine2,
            postalCode: v.postalCode,
            shippingAddressSnapshot: shippingSnapshot,
            shippingMethod: v.shippingMethod,
            shippingCostAmount: shippingFee,
            preferredPaymentMethod: v.preferredPaymentMethod,
            billingSameAsShipping: v.billingSameAsShipping,
            billingAddressSnapshot: v.billing,
            couponId: couponPreview ? couponPreview.coupon.id : undefined,
            couponCodeSnapshot: couponPreview ? couponPreview.coupon.code : null,
            couponDiscountTypeSnapshot: couponPreview ? couponPreview.coupon.discountType : null,
            couponDiscountValueSnapshot: couponPreview ? Number(couponPreview.coupon.discountValue) : null,
            couponEligibleAmountSnapshot: couponPreview ? eligibleAmount : null,
            couponDiscountAmountApplied: discountAmount,
            couponShippingDiscountApplied: 0,
            estimatedTotalAmount: estimatedTotal,
            couponAppliedAt: couponPreview ? new Date() : null,
          },
        });
      } catch (e: any) {
        // Unique reference race — retry once with a fresh reference.
        if (String(e?.code) === 'P2002') {
          const retryRef = await BusinessReferenceService.generateUniqueReference();
          quote = await tx.quote.create({
            data: {
              id: `RFQ-2026-${randomInt(100000, 1000000)}`,
              reference: retryRef,
              userId: input.userId,
              partName: input.partName,
              technology: input.technology,
              material: input.material,
              quantity: v.quantity,
              toleranceGrade: input.toleranceGrade || 'standard',
              surfaceFinish: input.surfaceFinish || 'standard',
              manufacturingCost: formatEgp(subtotal),
              unitPrice: unitPriceStr,
              totalPrice: totalPriceStr,
              leadTime,
              validUntil,
              status: 'Ready for Approval',
              provider: 'CAM LABS',
              providerQuoteRef,
              cadFileIds,
              technicalNotes: typeof input.technicalNotes === 'string' ? input.technicalNotes.slice(0, 2000) : '',
              pricingEquationVersionId: pricingEquationVersionId || undefined,
              pricingBreakdown: pricingBreakdown as any,
              contactName: v.fullName,
              contactEmail: v.email,
              contactPhone: v.phone,
              contactSnapshot,
              country: v.country,
              governorate: v.governorate,
              city: v.city,
              addressLine1: v.addressLine1,
              addressLine2: v.addressLine2,
              postalCode: v.postalCode,
              shippingAddressSnapshot: shippingSnapshot,
              shippingMethod: v.shippingMethod,
              shippingCostAmount: shippingFee,
              preferredPaymentMethod: v.preferredPaymentMethod,
              billingSameAsShipping: v.billingSameAsShipping,
              billingAddressSnapshot: v.billing,
              couponId: couponPreview ? couponPreview.coupon.id : undefined,
              couponCodeSnapshot: couponPreview ? couponPreview.coupon.code : null,
              couponDiscountTypeSnapshot: couponPreview ? couponPreview.coupon.discountType : null,
              couponDiscountValueSnapshot: couponPreview ? Number(couponPreview.coupon.discountValue) : null,
              couponEligibleAmountSnapshot: couponPreview ? eligibleAmount : null,
              couponDiscountAmountApplied: discountAmount,
              couponShippingDiscountApplied: 0,
              estimatedTotalAmount: estimatedTotal,
              couponAppliedAt: couponPreview ? new Date() : null,
            },
          });
        } else {
          throw e;
        }
      }

      // Coupon consumption (revalidated atomically — never trust Apply-time check).
      if (couponCode && couponPreview) {
        await CouponsService.consumeInTransaction(tx, {
          code: couponCode,
          userId: input.userId,
          quoteId: quote.id,
          quoteReference: quote.reference,
          eligibleAmount,
          discountAmount,
          amountAfterDiscount: Math.max(0, eligibleAmount - discountAmount),
          shippingDiscount: 0,
        });
      }

      // "Save this information for next time" — reuse profile address infrastructure.
      if (input.saveAddress) {
        await tx.user.update({
          where: { id: input.userId },
          data: {
            governorate: v.governorate,
            city: v.city,
            addressLine1: v.addressLine1,
            addressLine2: v.addressLine2,
            postalCode: v.postalCode,
            country: v.country,
            address: [v.addressLine1, v.addressLine2, v.city, v.governorate, v.postalCode, v.country].filter(Boolean).join(', '),
            phone: v.phone,
          },
        }).catch(() => undefined);
      }

      // Claim guest CAD files to the authenticated customer (preserve work across auth).
      if (input.guestCadId && cadFileIds.length) {
        await tx.cadFile.updateMany({
          where: { id: { in: cadFileIds }, userId: null, guestId: input.guestCadId },
          data: { userId: input.userId, guestId: null },
        }).catch(() => undefined);
      }

      if (technicalDocumentIds.length) {
        await tx.technicalDocument.updateMany({
          where: { id: { in: technicalDocumentIds } },
          data: { quoteId: quote.id, userId: input.userId, guestId: null },
        }).catch(() => undefined);
      }

      return quote;
    });

    Logger.info(`[QuoteSubmission] Quote ${created.id} (${created.reference}) submitted by ${input.userId}; no order created.`);

    return {
      quote: created,
      pricing: { subtotal, shippingFee, discountAmount, estimatedTotal, currency: 'EGP' },
    };
  }
}
