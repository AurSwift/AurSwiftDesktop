/**
 * Quick Sell IPC Handlers
 *
 * Handles IPC communication for quick sell button configuration.
 */

import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";
import { getLogger } from "../utils/logger.js";
import { v4 as uuidv4 } from "uuid";

const logger = getLogger("quickSellHandlers");

/** Grid configuration constants */
const QUICK_SELL_GRID = {
  COLUMNS: 4,
  ROWS: 6,
  BUTTONS_PER_PAGE: 24,
};

const QUICK_SELL_MAX_PAGES = 7;

const QUICK_SELL_PAGE_NAMES = [
  "Main Screen",
  "Sub Page 1",
  "Sub Page 2",
  "Sub Page 3",
  "Sub Page 4",
  "Sub Page 5",
  "Sub Page 6",
];

export function registerQuickSellHandlers() {
  /**
   * Get all pages with buttons for a business
   */
  ipcMain.handle("quickSell:getPages", async (_event, businessId: string) => {
    try {
      const db = await getDatabase();
      const pages = await db.quickSell.getPagesWithButtons(businessId);
      return {
        success: true,
        pages,
      };
    } catch (error: any) {
      logger.error("Get quick sell pages error:", error);
      return {
        success: false,
        message: error.message || "Failed to get quick sell pages",
      };
    }
  });

  /**
   * Initialize default pages and buttons for a business
   * Creates Main Screen + 6 Sub Pages with 24 unassigned buttons each
   */
  ipcMain.handle(
    "quickSell:initializeDefaults",
    async (_event, businessId: string) => {
      try {
        const db = await getDatabase();

        // Check if pages already exist
        const existingPages = await db.quickSell.getPagesByBusiness(businessId);
        if (existingPages && existingPages.length > 0) {
          logger.info(
            "Quick sell pages already exist for business:",
            businessId,
          );
          const pagesWithButtons =
            await db.quickSell.getPagesWithButtons(businessId);
          return {
            success: true,
            pages: pagesWithButtons,
            message: "Pages already initialized",
          };
        }

        logger.info(
          "Initializing default quick sell pages for business:",
          businessId,
        );

        // Create pages and buttons
        const createdPages = [];

        for (let pageIndex = 0; pageIndex < QUICK_SELL_MAX_PAGES; pageIndex++) {
          const pageId = uuidv4();
          const isMainScreen = pageIndex === 0;
          const pageName = QUICK_SELL_PAGE_NAMES[pageIndex];

          // Create page
          await db.quickSell.createPage({
            id: pageId,
            name: pageName,
            pageIndex,
            isMainScreen,
            isActive: true,
            businessId,
          });

          // Create 24 unassigned buttons for this page
          const buttons = [];
          for (
            let position = 0;
            position < QUICK_SELL_GRID.BUTTONS_PER_PAGE;
            position++
          ) {
            const buttonId = uuidv4();
            await db.quickSell.createButton({
              id: buttonId,
              pageId,
              position,
              label: null,
              color: "#3b82f6",
              textColor: "#ffffff",
              shape: "rounded",
              linkType: "unassigned",
              productId: null,
              categoryId: null,
              isActive: true,
              businessId,
            });
            buttons.push({
              id: buttonId,
              pageId,
              position,
              label: null,
              color: "#3b82f6",
              textColor: "#ffffff",
              shape: "rounded",
              linkType: "unassigned",
              productId: null,
              categoryId: null,
              isActive: true,
              businessId,
            });
          }

          createdPages.push({
            id: pageId,
            name: pageName,
            pageIndex,
            isMainScreen,
            isActive: true,
            businessId,
            buttons,
          });
        }

        logger.info(
          `Created ${createdPages.length} pages with ${QUICK_SELL_GRID.BUTTONS_PER_PAGE} buttons each`,
        );

        return {
          success: true,
          pages: createdPages,
        };
      } catch (error: any) {
        logger.error("Initialize quick sell defaults error:", error);
        return {
          success: false,
          message: error.message || "Failed to initialize quick sell pages",
        };
      }
    },
  );

  /**
   * Update a button's configuration
   */
  ipcMain.handle(
    "quickSell:updateButton",
    async (
      _event,
      buttonData: {
        id: string;
        label?: string | null;
        color?: string;
        textColor?: string;
        shape?: "rectangle" | "rounded" | "pill";
        linkType?: "product" | "category" | "unassigned";
        productId?: string | null;
        categoryId?: string | null;
        isActive?: boolean;
      },
    ) => {
      try {
        const db = await getDatabase();
        const { id, ...updates } = buttonData;

        await db.quickSell.updateButton(id, updates);

        // Fetch with resolved references
        const buttonWithDetails = await db.quickSell.getButtonWithDetails(id);

        return {
          success: true,
          button: buttonWithDetails,
        };
      } catch (error: any) {
        logger.error("Update quick sell button error:", error);
        return {
          success: false,
          message: error.message || "Failed to update button",
        };
      }
    },
  );

  /**
   * Swap positions of two buttons
   */
  ipcMain.handle(
    "quickSell:swapPositions",
    async (
      _event,
      { buttonId1, buttonId2 }: { buttonId1: string; buttonId2: string },
    ) => {
      try {
        const db = await getDatabase();

        // Get both buttons
        const button1 = await db.quickSell.getButtonById(buttonId1);
        const button2 = await db.quickSell.getButtonById(buttonId2);

        if (!button1 || !button2) {
          return {
            success: false,
            message: "One or both buttons not found",
          };
        }

        // Swap positions
        const pos1 = button1.position;
        const pos2 = button2.position;

        // Use a temporary position to avoid unique constraint violation
        const tempPos = -1;
        await db.quickSell.updateButton(buttonId1, { position: tempPos });
        await db.quickSell.updateButton(buttonId2, { position: pos1 });
        await db.quickSell.updateButton(buttonId1, { position: pos2 });

        return {
          success: true,
        };
      } catch (error: any) {
        logger.error("Swap button positions error:", error);
        return {
          success: false,
          message: error.message || "Failed to swap button positions",
        };
      }
    },
  );

  /**
   * Reset a page to unassigned buttons
   */
  ipcMain.handle("quickSell:resetPage", async (_event, pageId: string) => {
    try {
      const db = await getDatabase();

      // Reset all buttons on this page to unassigned
      await db.quickSell.resetPageButtons(pageId);

      return {
        success: true,
      };
    } catch (error: any) {
      logger.error("Reset page error:", error);
      return {
        success: false,
        message: error.message || "Failed to reset page",
      };
    }
  });

  /**
   * Get a single button with product/category details
   */
  ipcMain.handle("quickSell:getButton", async (_event, buttonId: string) => {
    try {
      const db = await getDatabase();
      const button = await db.quickSell.getButtonWithDetails(buttonId);

      if (!button) {
        return {
          success: false,
          message: "Button not found",
        };
      }

      return {
        success: true,
        button,
      };
    } catch (error: any) {
      logger.error("Get button error:", error);
      return {
        success: false,
        message: error.message || "Failed to get button",
      };
    }
  });
}
