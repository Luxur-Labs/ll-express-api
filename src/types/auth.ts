export type Role = 'SUPER_ADMIN' | 'DOCTOR' | 'EMPLOYEE';
export type EmployeeType = 'QC' | 'TECHNICIAN' | 'DISPATCHER' | (string & {});
export type TechnicianGroup = 'CAD_TECHNICIAN' | 'CAM_TECHNICIAN' | (string & {});

export interface AuthUser {
  id: string;
  role: Role;
  employeeType?: EmployeeType | null;
  technicianGroup?: TechnicianGroup | null;
}


