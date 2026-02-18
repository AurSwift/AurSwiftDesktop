/**
 * Auth UI color utilities for the dark-themed login screen.
 * Colors are hex strings used in inline styles (not Tailwind classes)
 * to work with the dark atmospheric design.
 */

const ROLE_COLORS: Record<string, string> = {
  admin: "#5BA4D9",
  manager: "#4CAF96",
  cashier: "#7B68EE",
};

const CASHIER_COLORS = ["#7B68EE", "#E8884A", "#E06B8A", "#4ABFE8"];

export const getUserColor = (role: string, index: number): string => {
  if (role === "cashier") {
    return CASHIER_COLORS[index % CASHIER_COLORS.length];
  }
  return ROLE_COLORS[role] || "#6B7280";
};

/**
 * Get initials from a user's first and last name.
 */
export const getInitials = (firstName: string, lastName: string): string => {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase();
};
