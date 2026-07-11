/** True when Repeat/Corrections line type requires a reason. */
export function requiresEnterReason(repeatCorrections: unknown): boolean {
  const value = String(repeatCorrections ?? '').trim();
  return value === 'Repeat' || value === 'Corrections';
}

export function normalizeEnterReason(repeatCorrections: unknown, enterReason: unknown): string {
  if (!requiresEnterReason(repeatCorrections)) {
    return '';
  }
  return String(enterReason ?? '').trim();
}

type OrderProductFieldCheck = {
  productId?: unknown;
  shadeType?: unknown;
  finishingInstructions?: unknown;
  componentDetails?: unknown;
  incaseOfAllAbutments?: unknown;
  occlusalStaining?: unknown;
  ponticDesign?: unknown;
  repeatCorrections?: unknown;
  enterReason?: unknown;
};

/** Returns an error message when required order-product fields are missing. */
export function getOrderProductValidationError(product: OrderProductFieldCheck): string | null {
  if (
    !product.productId ||
    !product.shadeType ||
    !product.finishingInstructions ||
    product.componentDetails === undefined ||
    product.componentDetails === null ||
    !product.incaseOfAllAbutments ||
    !product.occlusalStaining ||
    !product.ponticDesign ||
    !product.repeatCorrections
  ) {
    return 'Each order product must have all required fields: productId, shadeType, finishingInstructions, componentDetails, incaseOfAllAbutments, occlusalStaining, ponticDesign, repeatCorrections';
  }

  if (requiresEnterReason(product.repeatCorrections) && !String(product.enterReason ?? '').trim()) {
    return 'Enter reason is required when Repeat/Corrections is Repeat or Corrections';
  }

  return null;
}
