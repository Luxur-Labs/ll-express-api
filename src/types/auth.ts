export type Role = 'SUPER_ADMIN' | 'LAB_MANAGER' | 'FRONT_OFFICE' | 'DOCTOR' | 'EMPLOYEE';
export type EmployeeType = 'QC' | 'TECHNICIAN' | 'DISPATCHER' | (string & {});
export type TechnicianGroup = 'CAD_TECHNICIAN' | 'CAM_TECHNICIAN' | (string & {});

export interface AuthUser {
  id: string;
  email?: string;
  role: Role;
  employeeType?: EmployeeType | null;
  technicianGroup?: TechnicianGroup | null;
  mustChangePassword?: boolean;
}


