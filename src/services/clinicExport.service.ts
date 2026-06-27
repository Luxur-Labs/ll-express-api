import { PrismaClient } from '@prisma/client';

import { CLINIC_IMPORT_HEADERS } from '../config/importExportHeaders';
import { buildSpreadsheetBuffer, ExportFormat } from '../utils/spreadsheetExport.util';

const prisma = new PrismaClient();

export class ClinicExportService {
  async exportImportFormat(format: ExportFormat): Promise<Buffer> {
    const clinics = await prisma.clinic.findMany({
      orderBy: [{ clinicName: 'asc' }],
    });

    const rows = clinics.map((c) => [
      c.doctorName ?? '',
      c.clinicName,
      c.contactNumber,
      c.clientAddress,
    ]);

    return buildSpreadsheetBuffer(CLINIC_IMPORT_HEADERS, rows, format, 'Clinics');
  }
}

export const clinicExportService = new ClinicExportService();
