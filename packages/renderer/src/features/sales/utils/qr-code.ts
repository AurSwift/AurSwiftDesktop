/**
 * QR Code Utilities
 * 
 * Helper functions for generating and working with QR codes for saved baskets
 */

/**
 * Generate QR code data URL from basket code
 * Note: QR code rendering is handled by the SaveBasketModal component using react-qr-code
 * This utility function is kept for potential future use but currently not needed
 * @param basketCode - The basket code (e.g., "BSK-ABC123")
 * @returns Promise resolving to basket code (QR code rendering handled by component)
 */
export async function generateQRCodeDataURL(
  basketCode: string,
  size: number = 256
): Promise<string> {
  // QR code rendering is handled directly in SaveBasketModal component
  // using react-qr-code library. This function is kept for API compatibility.
  return basketCode;
}

/**
 * Validate basket code format
 * @param code - The code to validate
 * @returns true if valid format
 */
export function isValidBasketCode(code: string): boolean {
  // Format: BSK-XXXXXX (6 alphanumeric characters)
  const pattern = /^BSK-[A-Z0-9]{6}$/;
  return pattern.test(code);
}

/**
 * Extract basket code from scanned input
 * Handles both "BSK-ABC123" and "ABC123" formats
 */
export function extractBasketCode(input: string): string | null {
  const trimmed = input.trim().toUpperCase();
  
  // If already in BSK- format
  if (isValidBasketCode(trimmed)) {
    return trimmed;
  }
  
  // If just the code part, add BSK- prefix
  if (/^[A-Z0-9]{6}$/.test(trimmed)) {
    return `BSK-${trimmed}`;
  }
  
  // Try to extract from any string
  const match = trimmed.match(/BSK-?([A-Z0-9]{6})/);
  if (match) {
    return `BSK-${match[1]}`;
  }
  
  return null;
}

