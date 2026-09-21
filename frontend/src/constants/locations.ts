/** Business-provided governorate list — do not rename/remove without business approval. */
export const GOVERNORATES: string[] = [
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

export const SUBMIT_QUOTE_COUNTRY = 'Egypt' as const;

export type PreferredPaymentMethod = 'KASHIER' | 'COD';

export interface SubmitQuoteContact {
  fullName: string;
  email: string;
  phone: string;
}

export interface SubmitQuoteDelivery {
  country: string;
  governorate: string;
  city: string;
  address: string;
  apartment: string;
  postalCode: string;
}

export interface SubmitQuoteBilling {
  country: string;
  governorate: string;
  city: string;
  address: string;
  apartment: string;
  postalCode: string;
}
