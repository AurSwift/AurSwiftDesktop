/**
 * CSV Export Utilities
 * Pure functions for CSV generation and download
 */

/**
 * Converts a value to a CSV-safe string
 * Escapes quotes and wraps in quotes if needed
 */
export function toCsvValue(value: unknown): string {
  const str = String(value ?? "");
  // Escape quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  // Wrap in quotes if contains comma, quote, or newline
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

/**
 * Converts an array of objects to CSV string
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  headers: (keyof T)[],
): string {
  // Create header row
  const headerRow = headers.map((h) => toCsvValue(h)).join(",");

  // Create data rows
  const dataRows = data.map((row) =>
    headers.map((header) => toCsvValue(row[header])).join(","),
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Downloads a CSV file
 */
export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Exports data to CSV with automatic filename generation
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  headers: (keyof T)[],
  baseFilename = "export",
): void {
  const csv = arrayToCSV(data, headers);
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${baseFilename}-${timestamp}.csv`;

  downloadCSV(filename, csv);
}

/**
 * Formats a Date object or ISO string to a readable format for CSV
 */
export function formatDateForCSV(date: Date | string): string {
  if (typeof date === "string") {
    date = new Date(date);
  }

  // Return ISO format for consistency
  return date.toISOString();
}

/**
 * Formats a boolean value for CSV (Active/Inactive, Yes/No, etc.)
 */
export function formatBooleanForCSV(
  value: boolean,
  trueLabel = "Yes",
  falseLabel = "No",
): string {
  return value ? trueLabel : falseLabel;
}
