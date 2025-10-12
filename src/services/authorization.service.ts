import { EmployeeType, TechnicianGroup } from '../types/auth';

export type RolesConfig = {
  employeeTypes: Set<EmployeeType>;
  technicianGroups: Set<TechnicianGroup>;
};

const config: RolesConfig = {
  employeeTypes: new Set<EmployeeType>(['QC', 'TECHNICIAN']),
  technicianGroups: new Set<TechnicianGroup>(['CAD_TECHNICIAN', 'CAM_TECHNICIAN']),
};

export function listEmployeeTypes(): EmployeeType[] {
  return Array.from(config.employeeTypes);
}

export function listTechnicianGroups(): TechnicianGroup[] {
  return Array.from(config.technicianGroups);
}

export function addEmployeeType(type: EmployeeType) {
  config.employeeTypes.add(type);
}

export function addTechnicianGroup(group: TechnicianGroup) {
  config.technicianGroups.add(group);
}


