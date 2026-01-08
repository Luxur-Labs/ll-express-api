import { Request, Response } from 'express';
import { ClinicService, CreateClinicData, UpdateClinicData } from '../services/clinic.service';

const clinicService = new ClinicService();

export async function createClinicController(req: Request, res: Response) {
  try {
    const { clinicName, organizationId, clientAddress, contactNumber, doctorName } = req.body;

    if (!clinicName || !organizationId || !clientAddress || !contactNumber) {
      return res.status(400).json({
        message: 'clinicName, organizationId, clientAddress, and contactNumber are required'
      });
    }

    const clinicData: CreateClinicData = {
      clinicName,
      organizationId,
      clientAddress,
      contactNumber,
      doctorName,
    };

    const clinic = await clinicService.createClinic(clinicData);
    return res.status(201).json(clinic);
  } catch (error) {
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
    const { clinicName, organizationId, clientAddress, contactNumber, doctorName } = req.body;

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

    const updatedClinic = await clinicService.updateClinic(id, updateData);
    return res.json(updatedClinic);
  } catch (error) {
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

    await clinicService.deleteClinic(id);
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
    const clinics = await clinicService.getClinicsList();
    return res.json(clinics);
  } catch (error) {
    console.error('Error fetching clinics list:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
