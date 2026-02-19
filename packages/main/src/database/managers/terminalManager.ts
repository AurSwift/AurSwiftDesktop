import type { Terminal } from "../schema.js";
import type { DrizzleDB } from "../drizzle.js";
import { eq } from "drizzle-orm";
import * as schema from "../schema.js";

export class TerminalManager {
  private db: DrizzleDB;
  private uuid: any;

  constructor(drizzle: DrizzleDB, uuid: any) {
    this.db = drizzle;
    this.uuid = uuid;
  }

  getTerminalById(id: string): Terminal | null {
    const result = this.db
      .select()
      .from(schema.terminals)
      .where(eq(schema.terminals.id, id))
      .get();

    return result as Terminal | null;
  }

  getTerminalsByBusiness(businessId: string): Terminal[] {
    const results = this.db
      .select()
      .from(schema.terminals)
      .where(eq(schema.terminals.business_id, businessId))
      .all();

    return results as Terminal[];
  }

  createTerminal(terminalData: {
    businessId: string;
    name: string;
    type?: "pos" | "kiosk" | "handheld" | "kitchen_display" | "server";
    status?: "active" | "inactive" | "maintenance" | "decommissioned";
    deviceToken?: string;
    ipAddress?: string;
    macAddress?: string;
    settings?: any;
  }): Terminal {
    const terminalId = this.uuid.v4();
    const now = new Date();

    this.db
      .insert(schema.terminals)
      .values({
        id: terminalId,
        business_id: terminalData.businessId,
        name: terminalData.name,
        type: terminalData.type || "pos",
        status: terminalData.status || "active",
        device_token: terminalData.deviceToken || null,
        ip_address: terminalData.ipAddress || null,
        mac_address: terminalData.macAddress || null,
        settings: terminalData.settings
          ? JSON.stringify(terminalData.settings)
          : null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const terminal = this.getTerminalById(terminalId);
    if (!terminal) {
      throw new Error("Terminal not found after creation");
    }
    return terminal;
  }

  updateTerminal(
    id: string,
    updates: Partial<{
      name: string;
      type: "pos" | "kiosk" | "handheld" | "kitchen_display" | "server";
      status: "active" | "inactive" | "maintenance" | "decommissioned";
      deviceToken: string;
      ipAddress: string;
      macAddress: string;
      settings: any;
    }>
  ): boolean {
    const now = new Date();

    // Prepare update object, only including defined fields
    const updateData: Record<string, any> = {
      updatedAt: now,
    };

    // Explicitly check each field before adding to update
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.deviceToken !== undefined)
      updateData.device_token = updates.deviceToken || null;
    if (updates.ipAddress !== undefined)
      updateData.ip_address = updates.ipAddress || null;
    if (updates.macAddress !== undefined)
      updateData.mac_address = updates.macAddress || null;
    if (updates.settings !== undefined)
      updateData.settings = updates.settings
        ? JSON.stringify(updates.settings)
        : null;

    // If only updated_at is in the object, no actual updates were provided
    if (Object.keys(updateData).length === 1) {
      return false;
    }

    const result = this.db
      .update(schema.terminals)
      .set(updateData)
      .where(eq(schema.terminals.id, id))
      .run();

    return result.changes > 0;
  }

  deleteTerminal(id: string): boolean {
    const result = this.db
      .delete(schema.terminals)
      .where(eq(schema.terminals.id, id))
      .run();

    return result.changes > 0;
  }
}
