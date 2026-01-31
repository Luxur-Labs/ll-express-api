/**
 * Application-level Order Status Types
 * These are completely separate from database transitions
 */

export enum OrderStatus {
  NEW = 'NEW',
  MODEL = 'MODEL',
  CAD = 'CAD',
  CAM = 'CAM',
  DMLS = 'DMLS',
  METAL = 'METAL',
  CERAMIC = 'CERAMIC',
  ACRYLIC = 'ACRYLIC',
  ADMIN_REVIEW = 'ADMIN_REVIEW',
  DISPATCHED = 'DISPATCHED',
  CANCELLED = 'CANCELLED',
}

// Transition statuses can be aligned later if needed; keep minimal for now
export enum OrderTransitionStatus {
  ORDER_INITIATED = 'ORDER_INITIATED',
  TASK_ASSIGNMENT = 'TASK_ASSIGNMENT',
  TASK_COMPLETION = 'TASK_COMPLETION',
  TASK_APPROVED = 'TASK_APPROVED',
  TASK_REJECTED = 'TASK_REJECTED',
  DISPATCHED = 'DISPATCHED',
  CANCELLED = 'CANCELLED',
}
