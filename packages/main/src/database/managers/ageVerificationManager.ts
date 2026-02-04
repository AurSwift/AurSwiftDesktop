import type {
  AgeVerificationRecord,
  NewAgeVerificationRecord,
} from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import * as schema from "../schema.js";

export interface AgeVerificationResponse {
  success: boolean;
  message: string;
  record?: AgeVerificationRecord;
  records?: AgeVerificationRecord[];
  errors?: string[];
}

export interface CreateAgeVerificationData {
  transactionId?: string;
  transactionItemId?: string;
  productId: string;
  verificationMethod: "manual";
  customerBirthdate: Date;
  calculatedAge: number;
  verificationNotes?: string;
  verifiedBy: string;
  businessId: string;
}

export class AgeVerificationManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  /**
   * Create age verification record
   */
  async createAgeVerification(
    data: CreateAgeVerificationData,
  ): Promise<AgeVerificationRecord> {
    const recordId = this.uuid.v4();

    // Validate required fields
    if (!data.productId) {
      throw new Error("Product ID is required");
    }
    if (!data.verifiedBy) {
      throw new Error("Verified by (staff ID) is required");
    }
    if (!data.businessId) {
      throw new Error("Business ID is required");
    }
    if (data.verificationMethod !== "manual") {
      throw new Error("Only manual verification method is supported");
    }
    if (!data.customerBirthdate) {
      throw new Error("Customer birthdate is required");
    }
    if (!data.calculatedAge && data.calculatedAge !== 0) {
      throw new Error("Calculated age is required");
    }

    await this.db.insert(schema.ageVerificationRecords).values({
      id: recordId,
      transactionId: data.transactionId ?? null,
      transactionItemId: data.transactionItemId ?? null,
      productId: data.productId,
      verificationMethod: data.verificationMethod,
      customerBirthdate: new Date(data.customerBirthdate),
      calculatedAge: data.calculatedAge,
      verificationNotes: data.verificationNotes ?? null,
      verifiedBy: data.verifiedBy,
      businessId: data.businessId,
      verifiedAt: new Date(),
    });

    return this.getAgeVerificationById(recordId);
  }

  /**
   * Get age verification record by ID
   */
  async getAgeVerificationById(id: string): Promise<AgeVerificationRecord> {
    const [record] = await this.db
      .select()
      .from(schema.ageVerificationRecords)
      .where(eq(schema.ageVerificationRecords.id, id))
      .limit(1);

    if (!record) {
      throw new Error("Age verification record not found");
    }

    return record as AgeVerificationRecord;
  }

  /**
   * Get age verification records by transaction ID
   */
  async getAgeVerificationsByTransaction(
    transactionId: string,
  ): Promise<AgeVerificationRecord[]> {
    const records = await this.db
      .select()
      .from(schema.ageVerificationRecords)
      .where(eq(schema.ageVerificationRecords.transactionId, transactionId))
      .orderBy(desc(schema.ageVerificationRecords.verifiedAt));

    return records as AgeVerificationRecord[];
  }

  /**
   * Get age verification records by transaction item ID
   */
  async getAgeVerificationsByTransactionItem(
    transactionItemId: string,
  ): Promise<AgeVerificationRecord[]> {
    const records = await this.db
      .select()
      .from(schema.ageVerificationRecords)
      .where(
        eq(schema.ageVerificationRecords.transactionItemId, transactionItemId),
      )
      .orderBy(desc(schema.ageVerificationRecords.verifiedAt));

    return records as AgeVerificationRecord[];
  }

  /**
   * Get age verification records by business ID
   */
  async getAgeVerificationsByBusiness(
    businessId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      verificationMethod?: "manual" | "scan" | "override";
    },
  ): Promise<AgeVerificationRecord[]> {
    const conditions = [
      eq(schema.ageVerificationRecords.businessId, businessId),
    ];

    if (options?.startDate) {
      conditions.push(
        gte(schema.ageVerificationRecords.verifiedAt, options.startDate),
      );
    }

    if (options?.endDate) {
      conditions.push(
        lte(schema.ageVerificationRecords.verifiedAt, options.endDate),
      );
    }

    if (options?.verificationMethod) {
      conditions.push(
        eq(
          schema.ageVerificationRecords.verificationMethod,
          options.verificationMethod as "manual",
        ),
      );
    }

    const records = await this.db
      .select()
      .from(schema.ageVerificationRecords)
      .where(and(...conditions))
      .orderBy(desc(schema.ageVerificationRecords.verifiedAt));

    return records as AgeVerificationRecord[];
  }

  /**
   * Get age verification records by product ID
   */
  async getAgeVerificationsByProduct(
    productId: string,
  ): Promise<AgeVerificationRecord[]> {
    const records = await this.db
      .select()
      .from(schema.ageVerificationRecords)
      .where(eq(schema.ageVerificationRecords.productId, productId))
      .orderBy(desc(schema.ageVerificationRecords.verifiedAt));

    return records as AgeVerificationRecord[];
  }

  /**
   * Get age verification records by staff member (verifiedBy)
   */
  async getAgeVerificationsByStaff(
    staffId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<AgeVerificationRecord[]> {
    const conditions = [eq(schema.ageVerificationRecords.verifiedBy, staffId)];

    if (options?.startDate) {
      conditions.push(
        gte(schema.ageVerificationRecords.verifiedAt, options.startDate),
      );
    }

    if (options?.endDate) {
      conditions.push(
        lte(schema.ageVerificationRecords.verifiedAt, options.endDate),
      );
    }

    const records = await this.db
      .select()
      .from(schema.ageVerificationRecords)
      .where(and(...conditions))
      .orderBy(desc(schema.ageVerificationRecords.verifiedAt));

    return records as AgeVerificationRecord[];
  }
}
