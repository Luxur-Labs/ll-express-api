import { Request, Response } from 'express';
import { PatientService, CreatePatientData, UpdatePatientData } from '../services/patient.service';

const patientService = new PatientService();

export async function createPatientController(req: Request, res: Response) {
  try {
    const { name, age, gender, contactNumber } = req.body;

    if (!name || age === undefined || !gender || !contactNumber) {
      return res.status(400).json({
        message: 'name, age, gender, and contactNumber are required'
      });
    }

    if (typeof age !== 'number' || age < 0 || age > 150) {
      return res.status(400).json({
        message: 'Age must be a valid number between 0 and 150'
      });
    }

    const patientData: CreatePatientData = {
      name,
      age,
      gender,
      contactNumber,
    };

    const patient = await patientService.createPatient(patientData);
    return res.status(201).json(patient);
  } catch (error) {
    console.error('Error creating patient:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getPatientByIdController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    const patient = await patientService.getPatientById(id);

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    return res.json(patient);
  } catch (error) {
    console.error('Error fetching patient:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAllPatientsController(req: Request, res: Response) {
  try {
    const patients = await patientService.getAllPatients();
    return res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function updatePatientController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { name, age, gender, contactNumber } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    // Check if patient exists
    const existingPatient = await patientService.getPatientById(id);
    if (!existingPatient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Validate age if provided
    if (age !== undefined && (typeof age !== 'number' || age < 0 || age > 150)) {
      return res.status(400).json({
        message: 'Age must be a valid number between 0 and 150'
      });
    }

    const updateData: UpdatePatientData = {};
    if (name !== undefined) updateData.name = name;
    if (age !== undefined) updateData.age = age;
    if (gender !== undefined) updateData.gender = gender;
    if (contactNumber !== undefined) updateData.contactNumber = contactNumber;

    const updatedPatient = await patientService.updatePatient(id, updateData);
    return res.json(updatedPatient);
  } catch (error) {
    console.error('Error updating patient:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deletePatientController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: 'Patient ID is required' });
    }

    // Check if patient exists
    const existingPatient = await patientService.getPatientById(id);
    if (!existingPatient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    await patientService.deletePatient(id);
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting patient:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getPatientsByGenderController(req: Request, res: Response) {
  try {
    const { gender } = req.params;

    if (!gender) {
      return res.status(400).json({ message: 'Gender is required' });
    }

    const patients = await patientService.getPatientsByGender(gender);
    return res.json(patients);
  } catch (error) {
    console.error('Error fetching patients by gender:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getPatientsByAgeRangeController(req: Request, res: Response) {
  try {
    const { minAge, maxAge } = req.query;

    if (!minAge || !maxAge) {
      return res.status(400).json({ message: 'minAge and maxAge are required' });
    }

    const min = parseInt(minAge as string);
    const max = parseInt(maxAge as string);

    if (isNaN(min) || isNaN(max) || min < 0 || max < 0 || min > max || min > 150 || max > 150) {
      return res.status(400).json({
        message: 'minAge and maxAge must be valid numbers between 0 and 150, and minAge must be less than or equal to maxAge'
      });
    }

    const patients = await patientService.getPatientsByAgeRange(min, max);
    return res.json(patients);
  } catch (error) {
    console.error('Error fetching patients by age range:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

export async function searchPatientsByNameController(req: Request, res: Response) {
  try {
    const { name } = req.query;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'Name search parameter is required' });
    }

    const patients = await patientService.searchPatientsByName(name);
    return res.json(patients);
  } catch (error) {
    console.error('Error searching patients by name:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
