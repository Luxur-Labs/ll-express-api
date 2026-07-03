/** Canonical spreadsheet column labels — must match import templates. */
export const CLINIC_IMPORT_HEADERS = [
  'Doctor Name',
  'Clinic Name',
  'Doctor phone number',
  'Address',
  'Pending Balance',
] as const;

export const PRODUCT_IMPORT_HEADERS = [
  'Product Code',
  'Product',
  'Price on paper',
  'Discount',
  'Final Price',
] as const;

export const ORDER_IMPORT_HEADERS = [
  'Order id',
  'Date',
  'Patient Name',
  'Patient Age',
  'Patient Gender',
  'New/Repeat/Correction',
  'Clinic Name',
  'Reference',
  'Address',
  'Expected Date',
  'Delivery Date',
  'Case Status',
  'Shade',
  'Column 1',
  'Product Code',
  'Product description',
  'Tooth number',
  'Units',
  'Unit Amount Including GST',
  'Discount Percentage',
  'Partner',
] as const;
