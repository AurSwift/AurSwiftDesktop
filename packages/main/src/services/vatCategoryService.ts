import { ipcMain } from "electron";
import { getDatabase } from "../database/index.js";

export function registerVatCategoryIpc() {
  ipcMain.handle(
    "categories:getVatCategories",
    async (_event, businessId: string) => {
      try {
        const db = await getDatabase();
        // Get all VAT categories for the business
        const vatCategories = await db.vatCategories.getVatCategoriesByBusiness(
          businessId
        );
        return { success: true, vatCategories };
      } catch (error: any) {
        return { success: false, message: error.message };
      }
    }
  );
}
