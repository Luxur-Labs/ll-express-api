import {
  forwardFillOrderIds,
  hasOrderIdMapping,
  looksLikeClinicSheetHeaders,
  parseUploadBuffer,
  resolveFieldKey,
} from '../src/services/orderImport.parser';
import { ORDER_IMPORT_CSV } from './helpers/orderFixtures';

describe('orderImport.parser', () => {
  describe('resolveFieldKey', () => {
    const cases: Array<[string, string]> = [
      ['Order id', 'orderId'],
      ['Invoice No.', 'orderId'],
      ['Patient Name', 'patientName'],
      ['Patient Age', 'patientAge'],
      ['Patient Gender', 'patientGender'],
      ['New/Repeat/Correction', 'newRepeatCorrection'],
      ['Clinic Name', 'clinicName'],
      ['Doctor phone number', 'doctor phone number'],
      ['Address', 'address'],
      ['Expected Date', 'expectedDate'],
      ['Delivery Date', 'deliveryDate'],
      ['Case Status', 'caseStatus'],
      ['Shade', 'shade'],
      ['Column 1', 'column1'],
      ['Product Code', 'productCode'],
      ['Product description', 'productDescription'],
      ['Tooth number', 'toothNumber'],
      ['Units', 'units'],
      ['Unit Amount Including GST', 'unitAmount'],
      ['Discount Percentage', 'discountPercent'],
      ['3D Model Charges', 'model3dCharges'],
      ['Amount reduced for components', 'componentReduction'],
      ['Partner', 'partner'],
      ['Received through', 'receivedThrough'],
      ['S.No', 'sno'],
    ];

    it.each(cases)('maps header %s → %s', (header, expected) => {
      expect(resolveFieldKey(header)).toBe(expected);
    });
  });

  describe('sheet detection', () => {
    it('detects order id mapping', () => {
      expect(hasOrderIdMapping(['Patient Name', 'Order id', 'Product Code'])).toBe(true);
      expect(hasOrderIdMapping(['Doctor Name', 'Clinic Name', 'Address'])).toBe(false);
    });

    it('detects clinic sheets', () => {
      expect(looksLikeClinicSheetHeaders(['Doctor Name', 'Clinic Name', 'Address'])).toBe(true);
      expect(looksLikeClinicSheetHeaders(['Order id', 'Doctor Name', 'Clinic Name'])).toBe(false);
    });
  });

  describe('forwardFillOrderIds', () => {
    it('inherits order id and case status on continuation lines', () => {
      const filled = forwardFillOrderIds([
        { rowIndex: 2, orderId: 'OD001', caseStatus: 'NEW', productCode: 'P1' },
        { rowIndex: 3, productCode: 'P2', shade: 'A1' },
      ]);
      expect(filled[1].orderId).toBe('OD001');
      expect(filled[1].orderIdInherited).toBe(true);
      expect(filled[1].caseStatus).toBe('NEW');
    });
  });

  describe('parseUploadBuffer', () => {
    it('parses CSV with all canonical import columns', () => {
      const parsed = parseUploadBuffer(Buffer.from(ORDER_IMPORT_CSV, 'utf8'), 'orders.csv');
      expect(parsed.headers.length).toBeGreaterThan(10);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0].orderId).toBe('ODTEST001');
      expect(parsed.rows[0].patientName).toBe('CSV Patient');
      expect(parsed.rows[0].patientAge).toBe(40);
      expect(parsed.rows[0].patientGender).toBe('Male');
      expect(parsed.rows[0].newRepeatCorrection).toBe('New');
      expect(parsed.rows[0].clinicName).toBe('Test Clinic');
      expect(parsed.rows[0].reference).toBe('Ref A');
      expect(parsed.rows[0].address).toBe('1 Main St');
      expect(parsed.rows[0].shade).toBe('A2');
      expect(parsed.rows[0].column1).toBe('Finish note');
      expect(parsed.rows[0].productCode).toBe('PROD-TEST');
      expect(parsed.rows[0].toothNumber).toBe('24-25');
      expect(parsed.rows[0].units).toBe(2);
      expect(parsed.rows[0].unitAmount).toBe(1500);
      expect(parsed.rows[0].discountPercent).toBe(5);
      expect(parsed.rows[0].partner).toBe('Luxur');
      expect(parsed.rows[1].orderId).toBe('ODTEST001');
      expect(parsed.rows[1].toothNumber).toBe('32');
    });
  });
});
