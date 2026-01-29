import type { Business } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq } from "drizzle-orm";
import * as schema from "../schema.js";

export class BusinessManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  getBusinessById(id: string): Business | null {
    const result = this.db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.id, id))
      .get();

    return result as Business | null;
  }

  createBusiness(businessData: {
    firstName: string;
    lastName: string;
    businessName: string;
    ownerId: string;
    address?: string;
    phone?: string;
    vatNumber?: string;
  }): Business {
    const businessId = this.uuid.v4();
    const now = new Date();

    this.db
      .insert(schema.businesses)
      .values({
        id: businessId,
        firstName: businessData.firstName,
        lastName: businessData.lastName,
        businessName: businessData.businessName,
        ownerId: businessData.ownerId,
        address: businessData.address || "",
        phone: businessData.phone || "",
        vatNumber: businessData.vatNumber || "",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const business = this.getBusinessById(businessId);
    if (!business) {
      throw new Error("Business not found after creation");
    }
    return business;
  }

  updateBusiness(
    id: string,
    updates: Partial<{
      firstName: string;
      lastName: string;
      businessName: string;
      email: string;
      phone: string;
      website: string;
      address: string;
      country: string;
      city: string;
      postalCode: string;
      vatNumber: string;
      businessType: "retail" | "restaurant" | "service" | "wholesale" | "other";
      currency: string;
      timezone: string;

      // Receipt Email (Gmail)
      receiptEmailGmailUser: string;
      receiptEmailGmailAppPassword: string;
      receiptEmailGmailAppPasswordEncrypted: boolean;
      receiptEmailUpdatedAt: Date | null;
    }>
  ): boolean {
    const now = new Date();

    // Prepare update object, only including defined fields
    // This ensures we don't accidentally set fields to undefined
    const updateData: Record<string, any> = {
      updatedAt: now,
    };

    // Explicitly check each field before adding to update
    if (updates.firstName !== undefined)
      updateData.firstName = updates.firstName;
    if (updates.lastName !== undefined) updateData.lastName = updates.lastName;
    if (updates.businessName !== undefined)
      updateData.businessName = updates.businessName;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.website !== undefined) updateData.website = updates.website;
    if (updates.address !== undefined) updateData.address = updates.address;
    if (updates.country !== undefined) updateData.country = updates.country;
    if (updates.city !== undefined) updateData.city = updates.city;
    if (updates.postalCode !== undefined)
      updateData.postalCode = updates.postalCode;
    if (updates.vatNumber !== undefined)
      updateData.vatNumber = updates.vatNumber;
    if (updates.businessType !== undefined)
      updateData.businessType = updates.businessType;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.timezone !== undefined) updateData.timezone = updates.timezone;

    // Receipt Email (Gmail)
    if (updates.receiptEmailGmailUser !== undefined)
      updateData.receiptEmailGmailUser = updates.receiptEmailGmailUser;
    if (updates.receiptEmailGmailAppPassword !== undefined)
      updateData.receiptEmailGmailAppPassword = updates.receiptEmailGmailAppPassword;
    if (updates.receiptEmailGmailAppPasswordEncrypted !== undefined)
      updateData.receiptEmailGmailAppPasswordEncrypted =
        updates.receiptEmailGmailAppPasswordEncrypted;
    if (updates.receiptEmailUpdatedAt !== undefined)
      updateData.receiptEmailUpdatedAt = updates.receiptEmailUpdatedAt;

    // If only updatedAt is in the object, no actual updates were provided
    if (Object.keys(updateData).length === 1) {
      return false;
    }

    const result = this.db
      .update(schema.businesses)
      .set(updateData)
      .where(eq(schema.businesses.id, id))
      .run();

    return result.changes > 0;
  }
}
