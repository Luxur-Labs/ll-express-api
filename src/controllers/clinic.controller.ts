import { Request, Response } from 'express';
import {
  ClinicService,
  CreateClinicData,
  OrganizationIdConflictError,
  OrganizationIdFormatError,
  PendingBalanceLockedError,
  UpdateClinicData,
} from '../services/clinic.service';
import { clinicImportService, ClinicImportField, ClinicImportMatchBy } from '../services/clinicImport.service';
import { clinicExportService } from '../services/clinicExport.service';
import { getActorUserId } from '../utils/requestUser';
import { parseExportFormat, sendSpreadsheetExport } from '../utils/spreadsheetExport.util';

const clinicService = new ClinicService();

export async function createClinicController(req: Request, res: Response) {
  try {
    const { clinicName, clientAddress, contactNumber, doctorName, pendingBalance } = req.body;

    if (!clinicName || !clientAddress || !contactNumber) {
      return res.status(400).json({
        message: 'clinicName, clientAddress, and contactNumber are required'
      });
    }

    const clinicData: CreateClinicData = {
      clinicName,
      clientAddress,
      contactNumber,
      doctorName,
      pendingBalance:
        pendingBalance !== undefined && pendingBalance !== null
          ? Number(pendingBalance) || 0
          : undefined,
    };

    const clinic = await clinicService.createClinic(clinicData, getActorUserId(res));
    return res.status(201).json(clinic);
  } catch (error) {
    if (error instanceof OrganizationIdConflictError || error instanceof OrganizationIdFormatError) {
      return res.status(409).json({ message: error.message });
    }
    console.error('Error creating clinic:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getClinicByIdController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    const clinic = await clinicService.getClinicById(id);

    if (!clinic) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    return res.json(clinic);
  } catch (error) {
    console.error('Error fetching clinic:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAllClinicsController(req: Request, res: Response) {
  try {
    const clinics = await clinicService.getAllClinics();
    return res.json(clinics);
  } catch (error) {
    console.error('Error fetching clinics:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updateClinicController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { clinicName, organizationId, clientAddress, contactNumber, doctorName, pendingBalance } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    // Check if clinic exists
    const existingClinic = await clinicService.getClinicById(id);
    if (!existingClinic) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    const updateData: UpdateClinicData = {};
    if (clinicName !== undefined) updateData.clinicName = clinicName;
    if (organizationId !== undefined) updateData.organizationId = organizationId;
    if (clientAddress !== undefined) updateData.clientAddress = clientAddress;
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber;
    if (doctorName !== undefined) updateData.doctorName = doctorName;
    if (pendingBalance !== undefined && pendingBalance !== null) {
      updateData.pendingBalance = Number(pendingBalance) || 0;
    }

    const updatedClinic = await clinicService.updateClinic(id, updateData, getActorUserId(res));
    return res.json(updatedClinic);
  } catch (error) {
    if (error instanceof PendingBalanceLockedError) {
      return res.status(409).json({ message: error.message });
    }
    if (error instanceof OrganizationIdConflictError || error instanceof OrganizationIdFormatError) {
      return res.status(409).json({ message: error.message });
    }
    console.error('Error updating clinic:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteClinicController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Clinic ID is required' });
    }

    // Check if clinic exists
    const existingClinic = await clinicService.getClinicById(id);
    if (!existingClinic) {
      return res.status(404).json({ message: 'Clinic not found' });
    }

    await clinicService.deleteClinic(id, getActorUserId(res));
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting clinic:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getClinicsByOrganizationController(req: Request, res: Response) {
  try {
    const { organizationId } = req.params;

    if (!organizationId) {
      return res.status(400).json({ message: 'Organization ID is required' });
    }

    const clinics = await clinicService.getClinicsByOrganization(organizationId);
    return res.json(clinics);
  } catch (error) {
    console.error('Error fetching clinics by organization:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getClinicsListController(req: Request, res: Response) {
  try {
    const page = Number(req.query.page) || 0;
    const limit = Number(req.query.limit) || 50;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const fields = req.query.fields === 'options' ? 'options' : 'full';

    const clinics = await clinicService.getClinicsList(page, limit, search, fields);
    return res.json(clinics);
  } catch (error) {
    console.error('Error fetching clinics list:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function importClinicsFileController(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const matchBy = parseImportStringArray(req.body?.matchBy ?? req.query?.matchBy);
    const updateFields = parseImportStringArray(req.body?.updateFields ?? req.query?.updateFields);

    const result = await clinicImportService.importFromFile(
      file.buffer,
      file.originalname,
      getActorUserId(res),
      {
        matchBy: matchBy as ClinicImportMatchBy[],
        updateFields: updateFields as ClinicImportField[],
      },
    );
    return res.status(200).json({
      message: `Imported ${result.summary.created} created, ${result.summary.updated} updated, ${result.summary.skipped} skipped`,
      data: result,
    });
  } catch (error: unknown) {
    console.error('Clinic import error:', error);
    const message = error instanceof Error ? error.message : 'Clinic import failed';
    return res.status(400).json({ message });
  }
}

function parseImportStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v).trim()).filter(Boolean);
      }
    } catch {
      return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export async function exportClinicsController(req: Request, res: Response) {
  try {
    const format = parseExportFormat(req.query.format, 'csv');
    const buffer = await clinicExportService.exportImportFormat(format);
    sendSpreadsheetExport(res, buffer, 'clinics_export', format);
  } catch (error: unknown) {
    console.error('Clinic export error:', error);
    return res.status(500).json({ message: 'Failed to export clinics' });
  }
}
