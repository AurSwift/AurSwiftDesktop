/**
 * IPC Handlers for Database Seeding
 * Allows seeding categories and products from the Electron app
 */
import { ipcMain } from "electron";
import { getLogger } from "../utils/logger.js";
import { CategoryProductSeeder } from "../database/seed-data/index.js";
import type { SeedPreset } from "../database/seed-data/config.js";
import * as schema from "../database/schema.js";
import { getDatabase } from "../database/index.js";
import { getDrizzle, getRawDatabase } from "../database/drizzle.js";

const logger = getLogger("seed-handlers");

export function registerSeedHandlers() {
  /**
   * Seed categories and products with a preset
   */
  ipcMain.handle("seed:run", async (_event, preset: SeedPreset) => {
    try {
      logger.info(`Seeding with preset: ${preset}`);

      // Ensure database is initialized first
      await getDatabase();

      // Get Drizzle and SQLite instances directly from drizzle module
      const drizzleDb = getDrizzle();
      const sqliteDb = getRawDatabase();

      if (!drizzleDb || !sqliteDb) {
        throw new Error("Could not get database instances");
      }

      // Create seeder and run
      // Type assertion needed: drizzleDb is BetterSQLite3Database but TypeScript infers a more specific type
      const seeder = new CategoryProductSeeder(
        drizzleDb as any,
        sqliteDb,
        schema
      );

      await seeder.seedWithPreset(preset);

      logger.info(`Seeding completed: ${preset}`);
      return {
        success: true,
        message: `Successfully seeded with preset: ${preset}`,
      };
    } catch (error: any) {
      logger.error("Seeding failed:", error);
      return {
        success: false,
        message: error.message || "Failed to seed data",
        error: error.toString(),
      };
    }
  });

  /**
   * Seed with custom configuration
   */
  ipcMain.handle(
    "seed:custom",
    async (_event,
      config: {
        categories: number;
        products: number;
        batchSize: number;
        clearExisting: boolean;
      }
    ) => {
      try {
        logger.info(`Seeding with custom config:`, config);

        // Ensure database is initialized first
        await getDatabase();

        // Get Drizzle and SQLite instances directly from drizzle module
        const drizzleDb = getDrizzle();
        // getRawDatabase doesn't actually use the parameter, it returns the stored instance
        // Type assertion needed due to TypeScript module resolution differences
        const sqliteDb = getRawDatabase();

        if (!drizzleDb || !sqliteDb) {
          throw new Error("Could not get database instances");
        }

        // Type assertion needed: drizzleDb is BetterSQLite3Database but TypeScript infers a more specific type
        const seeder = new CategoryProductSeeder(
          drizzleDb as any,
          sqliteDb,
          schema
        );

        await seeder.seedWithConfig(config);

        logger.info(`Custom seeding completed`);
        return {
          success: true,
          message: `Successfully seeded ${config.categories} categories and ${config.products} products`,
        };
      } catch (error: any) {
        logger.error("Custom seeding failed:", error);
        return {
          success: false,
          message: error.message || "Failed to seed data",
          error: error.toString(),
        };
      }
    }
  );
}
