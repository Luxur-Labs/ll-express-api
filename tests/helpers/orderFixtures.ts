/** Shared payloads for order API integration tests. */

export function buildOrderProductLine(overrides: Record<string, unknown> = {}) {
  return {
    productId: overrides.productId as string,
    shadeType: 'A1',
    finishingInstructions: 'High polish',
    componentDetails: 'Ti base',
    incaseOfAllAbutments: 'Separate',
    occlusalStaining: 'Light',
    ponticDesign: 'Ovate',
    repeatCorrections: 'New',
    enterReason: 'Test order',
    workType: 'Crown',
    workSpecification: 'Full contour',
    unitNumbers: '24,32',
    unitPrice: 1000,
    discountPercent: 10,
    unitDiscounts: { '24': 10, '32': 20 },
    ...overrides,
  };
}

export function buildCreateOrderBody(args: {
  clinicId: string;
  productId: string;
  overrides?: Record<string, unknown>;
}) {
  const { clinicId, productId, overrides = {} } = args;
  return {
    patient: {
      name: 'Integration Test Patient',
      age: 35,
      gender: 'Female',
      contactNumber: '9876543210',
    },
    clinicId,
    referenceName: 'Dr Referrer',
    partner: 'Luxur',
    estimateDate: '2026-06-15T10:00:00.000Z',
    scanningMode: 'Digital',
    schedule: '2026-06-20T10:00:00.000Z',
    enterRemark: 'Rush case',
    dateOfApproach: '2026-06-10T10:00:00.000Z',
    orderProducts: [buildOrderProductLine({ productId })],
    ...overrides,
  };
}

export const ORDER_IMPORT_CSV = [
  'Order id,Date,Patient Name,Patient Age,Patient Gender,New/Repeat/Correction,Clinic Name,Reference,Address,Expected Date,Delivery Date,Case Status,Shade,Column 1,Product Code,Product description,Tooth number,Units,Unit Amount Including GST,Discount Percentage,Partner',
  'ODTEST001,2026-06-01,CSV Patient,40,Male,New,Test Clinic,Ref A,1 Main St,2026-06-15T10:00:00.000Z,2026-06-20T10:00:00.000Z,NEW,A2,Finish note,PROD-TEST,Crown product,24-25,2,1500,5,Luxur',
  ',,,,,,,,,,,,A2,Finish note,PROD-TEST,Bridge,32,1,1500,0,Luxur',
].join('\n');
