import fs from "fs";

export interface BookerDepartment {
  department: string;
  balanceOnHand: number;
  totalCostPrice: number;
  totalRetailPrice: number;
  totalVatAmount: number;
  totalNetPrice: number;
  totalPotentialProfit: number;
}

export interface BookerProduct {
  department: string;
  category: string;
  productDescription: string;
  itemCode: string;
  eans: string[]; // Multiple barcodes
  vatRate: string;
  vatPercentage: number;
  supplierName: string;
  costPrice: number;
  retailPrice: number;
  balanceOnHand: number;
  totalCostPrice: number;
  totalRetailPrice: number;
  totalVatAmount: number;
  totalNetPrice: number;
  totalPotentialProfit: number;
}

export type BookerFileType = "department" | "product" | "unknown";

export interface ParseResult<T> {
  success: boolean;
  data: T[];
  errors: ParseError[];
  warnings: string[];
  fileType: BookerFileType;
  rowCount: number;
  validRowCount: number;
}

export interface ParseError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export class BookerImportService {
  /**
   * Read and parse a Booker CSV file
   */
  async parseFile(
    filePath: string
  ): Promise<ParseResult<BookerDepartment | BookerProduct>> {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const fileType = this.detectFileType(content);

      switch (fileType) {
        case "department":
          return this.parseDepartmentReport(content);
        case "product":
          return this.parseProductReport(content);
        default:
          return {
            success: false,
            data: [],
            errors: [
              { row: 0, field: "", value: "", message: "Unknown file type" },
            ],
            warnings: [],
            fileType: "unknown",
            rowCount: 0,
            validRowCount: 0,
          };
      }
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [
          {
            row: 0,
            field: "",
            value: "",
            message:
              error instanceof Error
                ? `File read error: ${error.message}`
                : "Failed to read file",
          },
        ],
        warnings: [],
        fileType: "unknown",
        rowCount: 0,
        validRowCount: 0,
      };
    }
  }

  /**
   * Detect file type from content
   */
  private detectFileType(content: string): BookerFileType {
    if (content.includes("Stock Holding (Department) Report")) {
      return "department";
    }
    if (content.includes("Stock Holding (Product) Report")) {
      return "product";
    }
    return "unknown";
  }

  /**
   * Parse Department Report
   */
  private parseDepartmentReport(
    content: string
  ): ParseResult<BookerDepartment> {
    // Handle all types of line endings: \r\n (Windows), \n (Unix), \r (old Mac)
    const lines = content.split(/\r\n|\r|\n/).filter((line) => line.trim());
    const errors: ParseError[] = [];
    const warnings: string[] = [];
    const data: BookerDepartment[] = [];

    // Skip header lines (first 3 lines), Contains unnecessary information
    const dataLines = lines.slice(3);

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];

      // Skip totals row
      if (line.toLowerCase().startsWith("totals")) {
        warnings.push(`Row ${i + 4}: Skipped totals row`);
        continue;
      }

      const row = this.parseCSVLine(line);

      if (row.length < 7) {
        errors.push({
          row: i + 4,
          field: "",
          value: line,
          message: `Expected 7 columns, got ${row.length}`,
        });
        continue;
      }

      try {
        data.push({
          department: row[0].trim(),
          balanceOnHand: this.parseNumber(row[1]),
          totalCostPrice: this.parseNumber(row[2]),
          totalRetailPrice: this.parseNumber(row[3]),
          totalVatAmount: this.parseNumber(row[4]),
          totalNetPrice: this.parseNumber(row[5]),
          totalPotentialProfit: this.parseNumber(row[6]),
        });
      } catch (error) {
        errors.push({
          row: i + 4,
          field: "",
          value: line,
          message: error instanceof Error ? error.message : "Parse error",
        });
      }
    }

    return {
      success: errors.length === 0,
      data,
      errors,
      warnings,
      fileType: "department",
      rowCount: dataLines.length,
      validRowCount: data.length,
    };
  }

  /**
   * Parse Product Report
   */
  private parseProductReport(content: string): ParseResult<BookerProduct> {
    // Handle all types of line endings: \r\n (Windows), \n (Unix), \r (old Mac)
    const lines = content.split(/\r\n|\r|\n/).filter((line) => line.trim());
    const errors: ParseError[] = [];
    const warnings: string[] = [];
    const data: BookerProduct[] = [];

    // Skip header lines (first 3 lines)
    const dataLines = lines.slice(3);

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];

      // Skip totals row
      if (line.toLowerCase().startsWith("totals")) {
        warnings.push(`Row ${i + 4}: Skipped totals row`);
        continue;
      }

      const row = this.parseCSVLine(line);

      if (row.length < 16) {
        errors.push({
          row: i + 4,
          field: "",
          value: line,
          message: `Expected 16 columns, got ${row.length}`,
        });
        continue;
      }

      try {
        // Split EANs by pipe character
        const eans = row[4]
          .split("|")
          .map((ean) => ean.trim())
          .filter(Boolean);

        // Parse VAT percentage from "standard rate 20%" format
        const vatPercentage = this.parseVatPercentage(row[6]);

        data.push({
          department: row[0].trim(),
          category: row[1].trim(),
          productDescription: row[2].trim(),
          itemCode: row[3].trim(),
          eans,
          vatRate: row[5].trim(),
          vatPercentage,
          supplierName: row[7].trim(),
          costPrice: this.parseNumber(row[8]),
          retailPrice: this.parseNumber(row[9]),
          balanceOnHand: this.parseNumber(row[10]),
          totalCostPrice: this.parseNumber(row[11]),
          totalRetailPrice: this.parseNumber(row[12]),
          totalVatAmount: this.parseNumber(row[13]),
          totalNetPrice: this.parseNumber(row[14]),
          totalPotentialProfit: this.parseNumber(row[15]),
        });
      } catch (error) {
        errors.push({
          row: i + 4,
          field: "",
          value: line,
          message: error instanceof Error ? error.message : "Parse error",
        });
      }
    }

    return {
      success: errors.length === 0,
      data,
      errors,
      warnings,
      fileType: "product",
      rowCount: dataLines.length,
      validRowCount: data.length,
    };
  }

  /**
   * Parse CSV line handling quoted fields and escaped quotes
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = i < line.length - 1 ? line[i + 1] : null;

      if (char === '"') {
        // Handle escaped quotes ("")
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Parse number from string
   */
  private parseNumber(value: string): number {
    const cleaned = value.trim().replace(/[^0-9.-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Parse VAT percentage from "standard rate 20%" format
   */
  private parseVatPercentage(vatRate: string): number {
    const match = vatRate.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Validate parsed data before import
   */
  validateData(data: BookerProduct[]): ValidationResult {
    const errors: ValidationError[] = [];
    const duplicates: DuplicateInfo[] = [];

    const seenSkus = new Set<string>();
    const seenBarcodes = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const product = data[i];

      // Check required fields
      if (!product.productDescription) {
        errors.push({
          row: i + 1,
          field: "productDescription",
          message: "Product description is required",
        });
      }

      if (!product.itemCode) {
        errors.push({
          row: i + 1,
          field: "itemCode",
          message: "Item code (SKU) is required",
        });
      }

      if (product.retailPrice <= 0) {
        errors.push({
          row: i + 1,
          field: "retailPrice",
          message: "Retail price must be greater than 0",
        });
      }

      // Check for duplicates within file
      if (product.itemCode) {
        if (seenSkus.has(product.itemCode)) {
          duplicates.push({
            row: i + 1,
            field: "itemCode",
            value: product.itemCode,
            type: "within-file",
          });
        }
        seenSkus.add(product.itemCode);
      }

      if (product.eans.length > 0) {
        const primaryBarcode = product.eans[0];
        if (seenBarcodes.has(primaryBarcode)) {
          duplicates.push({
            row: i + 1,
            field: "barcode",
            value: primaryBarcode,
            type: "within-file",
          });
        }
        seenBarcodes.add(primaryBarcode);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      duplicates,
    };
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  duplicates: DuplicateInfo[];
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface DuplicateInfo {
  row: number;
  field: string;
  value: string;
  type: "within-file" | "in-database";
}
