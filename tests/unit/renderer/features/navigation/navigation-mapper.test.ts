import { describe, expect, it } from "vitest";
import { mapActionToView } from "@/features/navigation/utils/navigation-mapper";
import { SALES_ROUTES } from "@/features/sales/config/navigation";
import { STAFF_ROUTES } from "@/features/staff/config/navigation";
import { INVENTORY_ROUTES } from "@/features/inventory/config/navigation";

describe("mapActionToView", () => {
  it("maps advanced-reporting-analytics actions to supported routes", () => {
    expect(
      mapActionToView("advanced-reporting-analytics", "sales-reports"),
    ).toBe(SALES_ROUTES.SALES_REPORTS);
    expect(
      mapActionToView("advanced-reporting-analytics", "staff-reports"),
    ).toBe(STAFF_ROUTES.TIME_REPORTS);
  });

  it("maps management-actions inventory navigation to canonical inventory routes", () => {
    expect(
      mapActionToView("management-actions", "manage-inventory"),
    ).toBe(INVENTORY_ROUTES.PRODUCT_MANAGEMENT);
  });

  it("keeps unsupported advanced-reporting-analytics actions unmapped", () => {
    expect(
      mapActionToView("advanced-reporting-analytics", "inventory-reports"),
    ).toBeUndefined();
    expect(
      mapActionToView("advanced-reporting-analytics", "business-intelligence"),
    ).toBeUndefined();
  });
});
