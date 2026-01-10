import type { DrizzleDB } from "../drizzle.js";
import { eq, and, like, desc, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../schema.js";
import type { User } from "../schema.js";

import { getLogger } from "../../utils/logger.js";
const logger = getLogger("userManager");

import {
  registerSchema,
  pinLoginSchema,
  validateInput,
} from "../validation/authSchemas.js";
import { getDatabase } from "../index.js";
import { shiftRequirementResolver } from "../../utils/shiftRequirementResolver.js";
import { scheduleValidator } from "../../utils/scheduleValidator.js";

export interface AuthResponse {
  success: boolean;
  message: string;
  code?: string; // ✅ NEW: Error code (e.g., "NO_SCHEDULED_SHIFT")
  user?: schema.User;
  users?: schema.User[];
  token?: string;
  errors?: string[];
  clockEvent?: any; // Clock event created on login
  shift?: any; // Active time shift
  requiresClockIn?: boolean; // Flag if clock-in is required
  isClockedIn?: boolean; // Flag if user is clocked in (on logout)
  activeShift?: any; // Active shift (on logout)
  mode?: "admin" | "cashier"; // NEW: Sales mode (admin or cashier)
  requiresShift?: boolean; // NEW: Whether shift is required for this user
  warning?: string; // Warning message (e.g., clock-in failure)
  clockInError?: string; // Error message if clock-in failed
}

export class UserManager {
  private db: DrizzleDB;
  private bcrypt: any;
  private uuid: any;
  private sessionManager: any;
  private timeTrackingManager: any;
  private scheduleManager: any;

  constructor(
    drizzle: DrizzleDB,
    bcrypt: any,
    uuid: any,
    sessionManager?: any,
    timeTrackingManager?: any,
    scheduleManager?: any
  ) {
    this.db = drizzle;
    this.bcrypt = bcrypt;
    this.uuid = uuid;
    this.sessionManager = sessionManager;
    this.timeTrackingManager = timeTrackingManager;
    this.scheduleManager = scheduleManager;
  }

  setSessionManager(sessionManager: any): void {
    this.sessionManager = sessionManager;
  }

  setTimeTrackingManager(timeTrackingManager: any): void {
    this.timeTrackingManager = timeTrackingManager;
  }

  setScheduleManager(scheduleManager: any): void {
    this.scheduleManager = scheduleManager;
  }

  getUserByEmail(email: string): User | null {
    const [user] = this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        passwordHash: schema.users.passwordHash,
        pinHash: schema.users.pinHash,
        salt: schema.users.salt,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        businessId: schema.users.businessId,
        businessName: schema.users.businessName,
        primaryRoleId: schema.users.primaryRoleId,
        shiftRequired: schema.users.shiftRequired,
        activeRoleContext: schema.users.activeRoleContext,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
        isActive: schema.users.isActive,
        address: schema.users.address,
        roleName: schema.roles.name,
      })
      .from(schema.users)
      .leftJoin(schema.roles, eq(schema.users.primaryRoleId, schema.roles.id))
      .where(
        and(eq(schema.users.email, email), eq(schema.users.isActive, true))
      )
      .limit(1)
      .all();

    if (!user) return null;

    return {
      ...user,
      activeRoleContext: user.activeRoleContext ?? null,
    } as User;
  }

  getUserById(id: string): User | null {
    const [user] = this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        passwordHash: schema.users.passwordHash,
        pinHash: schema.users.pinHash,
        salt: schema.users.salt,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        businessId: schema.users.businessId,
        businessName: schema.users.businessName,
        primaryRoleId: schema.users.primaryRoleId,
        shiftRequired: schema.users.shiftRequired,
        activeRoleContext: schema.users.activeRoleContext,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
        isActive: schema.users.isActive,
        address: schema.users.address,
        roleName: schema.roles.name,
      })
      .from(schema.users)
      .leftJoin(schema.roles, eq(schema.users.primaryRoleId, schema.roles.id))
      .where(and(eq(schema.users.id, id), eq(schema.users.isActive, true)))
      .limit(1)
      .all();

    if (!user) return null;

    // If roleName is null/undefined, try to get it from userRoles table
    // This handles cases where primaryRoleId exists but the role join failed,
    // or where primaryRoleId is null but user has roles in userRoles table
    if (!user.roleName && user.id) {
      try {
        // Get first active role for this user
        const userRoleRecords = this.db
          .select({
            roleId: schema.userRoles.roleId,
            roleName: schema.roles.name,
          })
          .from(schema.userRoles)
          .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
          .where(
            and(
              eq(schema.userRoles.userId, user.id),
              eq(schema.userRoles.isActive, true)
            )
          )
          .limit(1)
          .all();

        if (userRoleRecords.length > 0) {
          user.roleName = userRoleRecords[0].roleName;
          // Also update primaryRoleId if it's null
          if (!user.primaryRoleId) {
            user.primaryRoleId = userRoleRecords[0].roleId;
            // Update the database to fix this user
            this.updateUser(user.id, {
              primaryRoleId: userRoleRecords[0].roleId,
            });
            logger.info(
              `[getUserById] Fixed missing primaryRoleId for user ${user.id}`
            );
          } else if (user.primaryRoleId !== userRoleRecords[0].roleId) {
            // primaryRoleId exists but doesn't match the active role
            // Log a warning but don't change it automatically
            logger.warn(
              `[getUserById] User ${user.id} has primaryRoleId ${user.primaryRoleId} but active role is ${userRoleRecords[0].roleId}`
            );
          }
        }
      } catch (error) {
        logger.warn(
          `[getUserById] Failed to lookup role for user ${user.id}:`,
          error
        );
      }
    }

    return {
      ...user,
      activeRoleContext: user.activeRoleContext ?? null,
    } as User;
  }

  getUserWithBusiness(userId: string) {
    const result = this.db
      .select({
        user: schema.users,
        business: schema.businesses,
      })
      .from(schema.users)
      .innerJoin(
        schema.businesses,
        eq(schema.users.businessId, schema.businesses.id)
      )
      .where(and(eq(schema.users.id, userId), eq(schema.users.isActive, true)))
      .limit(1)
      .all();

    if (!result[0]) return null;

    return {
      ...result[0].user,
      business: result[0].business,
    };
  }

  getUserByUsername(username: string): User | null {
    logger.info(
      `[getUserByUsername] Looking up user with username: "${username}"`
    );

    const [user] = this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        passwordHash: schema.users.passwordHash,
        pinHash: schema.users.pinHash,
        salt: schema.users.salt,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        businessId: schema.users.businessId,
        businessName: schema.users.businessName,
        primaryRoleId: schema.users.primaryRoleId,
        shiftRequired: schema.users.shiftRequired,
        activeRoleContext: schema.users.activeRoleContext,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
        isActive: schema.users.isActive,
        address: schema.users.address,
        roleName: schema.roles.name,
      })
      .from(schema.users)
      .leftJoin(schema.roles, eq(schema.users.primaryRoleId, schema.roles.id))
      .where(
        and(
          eq(schema.users.username, username),
          eq(schema.users.isActive, true)
        )
      )
      .limit(1)
      .all();

    if (!user) {
      logger.warn(
        `[getUserByUsername] No active user found with username: "${username}"`
      );
      // Try case-insensitive lookup for debugging
      const allUsers = this.db
        .select({
          username: schema.users.username,
          isActive: schema.users.isActive,
        })
        .from(schema.users)
        .all();
      logger.info(
        `[getUserByUsername] Available usernames: ${allUsers
          .map((u) => `${u.username} (active: ${u.isActive})`)
          .join(", ")}`
      );
      return null;
    }

    // If roleName is null/undefined, try to get it from userRoles table
    // This handles cases where primaryRoleId exists but the role join failed,
    // or where primaryRoleId is null but user has roles in userRoles table
    if (!user.roleName && user.id) {
      try {
        // Get first active role for this user
        const userRoleRecords = this.db
          .select({
            roleId: schema.userRoles.roleId,
            roleName: schema.roles.name,
          })
          .from(schema.userRoles)
          .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
          .where(
            and(
              eq(schema.userRoles.userId, user.id),
              eq(schema.userRoles.isActive, true)
            )
          )
          .limit(1)
          .all();

        if (userRoleRecords.length > 0) {
          user.roleName = userRoleRecords[0].roleName;
          // Also update primaryRoleId if it's null
          if (!user.primaryRoleId) {
            user.primaryRoleId = userRoleRecords[0].roleId;
            // Update the database to fix this user
            this.updateUser(user.id, {
              primaryRoleId: userRoleRecords[0].roleId,
            });
            logger.info(
              `[getUserByUsername] Fixed missing primaryRoleId for user ${user.id}`
            );
          } else if (user.primaryRoleId !== userRoleRecords[0].roleId) {
            // primaryRoleId exists but doesn't match the active role
            // Log a warning but don't change it automatically
            logger.warn(
              `[getUserByUsername] User ${user.id} has primaryRoleId ${user.primaryRoleId} but active role is ${userRoleRecords[0].roleId}`
            );
          }
        }
      } catch (error) {
        logger.warn(
          `[getUserByUsername] Failed to lookup role for user ${user.id}:`,
          error
        );
      }
    }

    logger.info(
      `[getUserByUsername] Found user: ${user.id} (${user.firstName} ${
        user.lastName
      }), primaryRoleId: ${user.primaryRoleId || "null"}, role: ${
        user.roleName || "none"
      }`
    );
    return {
      ...user,
      activeRoleContext: user.activeRoleContext ?? null,
    } as User;
  }

  async authenticateUserByUsernamePin(
    username: string,
    pin: string
  ): Promise<User | null> {
    logger.info(
      `[authenticateUserByUsernamePin] Attempting login for username: ${username}`
    );

    const user = this.getUserByUsername(username);
    if (!user) {
      logger.warn(
        `[authenticateUserByUsernamePin] User not found for username: ${username}`
      );
      return null;
    }

    logger.info(
      `[authenticateUserByUsernamePin] User found: ${user.id} (${
        user.firstName
      } ${user.lastName}), isActive: ${
        user.isActive
      }, hasPinHash: ${!!user.pinHash}`
    );

    if (!user.pinHash) {
      logger.error(
        `[authenticateUserByUsernamePin] User ${user.id} has no PIN hash`
      );
      return null;
    }

    // Ensure PIN is a string and trim whitespace
    const cleanPin = String(pin).trim();

    logger.info(
      `[authenticateUserByUsernamePin] Comparing PIN (length: ${cleanPin.length}, value: "${cleanPin}") for user ${user.id}`
    );

    // Validate PIN hash format
    if (user.pinHash && !user.pinHash.startsWith("$2")) {
      logger.error(
        `[authenticateUserByUsernamePin] PIN hash format appears invalid (should start with $2): ${user.pinHash.substring(
          0,
          20
        )}...`
      );
      return null;
    }

    const isValidPin = await this.bcrypt.compare(cleanPin, user.pinHash);
    if (!isValidPin) {
      logger.warn(
        `[authenticateUserByUsernamePin] Invalid PIN for user ${user.id} (username: ${username}, PIN length: ${cleanPin.length})`
      );
      // Try to provide helpful debugging info
      logger.info(
        `[authenticateUserByUsernamePin] PIN hash exists: ${!!user.pinHash}, hash length: ${
          user.pinHash?.length || 0
        }, hash prefix: ${user.pinHash?.substring(0, 10) || "none"}`
      );
      return null;
    }

    logger.info(
      `[authenticateUserByUsernamePin] ✅ Authentication successful for user ${user.id}`
    );

    // Return user without passwordHash, pinHash, and salt
    const {
      passwordHash: _,
      pinHash: __,
      salt: ___,
      ...userWithoutSecrets
    } = user;
    return userWithoutSecrets as User;
  }

  getUsersByBusiness(businessId: string): any[] {
    // Get users with their primary role from RBAC system
    const usersWithRoles = this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        businessId: schema.users.businessId,
        businessName: schema.users.businessName,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
        isActive: schema.users.isActive,
        address: schema.users.address,
        primaryRoleId: schema.users.primaryRoleId,
        roleName: schema.roles.name,
      })
      .from(schema.users)
      .leftJoin(schema.roles, eq(schema.users.primaryRoleId, schema.roles.id))
      .where(
        and(
          eq(schema.users.businessId, businessId),
          eq(schema.users.isActive, true)
        )
      )
      .orderBy(desc(schema.users.createdAt))
      .all();

    // Return users with primary role information from RBAC system
    // No longer includes deprecated 'role' field - use primaryRole.name instead
    return usersWithRoles;
  }

  //CRUD
  async createUser(userData: {
    username: string;
    email?: string;
    pin: string;
    firstName: string;
    lastName: string;
    businessName: string;
    role: "cashier" | "manager" | "admin";
    businessId?: string;
  }): Promise<User> {
    const userId = this.uuid.v4();
    const businessId = userData.businessId || this.uuid.v4();
    const salt = await this.bcrypt.genSalt(10);
    const hashedPin = await this.bcrypt.hash(userData.pin, salt);
    const now = new Date();

    // If businessId is provided, check that it exists
    if (userData.businessId) {
      const [businessExists] = this.db
        .select({ id: schema.businesses.id })
        .from(schema.businesses)
        .where(eq(schema.businesses.id, userData.businessId))
        .limit(1)
        .all();
      if (!businessExists) {
        throw new Error("Business does not exist for provided businessId");
      }
    }

    // Use Drizzle transaction
    this.db.transaction((tx) => {
      // 1. Create business if not provided
      if (!userData.businessId) {
        // Split businessName into firstName and lastName for the business
        const businessNameParts = (userData.businessName || "Business").split(
          " "
        );
        const businessFirstName = businessNameParts[0] || "Business";
        const businessLastName = businessNameParts.slice(1).join(" ") || "Name";

        tx.insert(schema.businesses)
          .values({
            id: businessId,
            firstName: businessFirstName,
            lastName: businessLastName,
            businessName: userData.businessName,
            ownerId: userId,
            email: "",
            phone: "",
            website: "",
            address: "",
            country: "",
            city: "",
            postalCode: "",
            vatNumber: "",
            businessType: "retail",
            currency: "USD",
            timezone: "UTC",
            isActive: true,
          })
          .run();
      }

      // 2. Find role first (needed for primaryRoleId)
      const [roleRecord] = tx
        .select()
        .from(schema.roles)
        .where(
          and(
            eq(schema.roles.name, userData.role),
            eq(schema.roles.businessId, businessId)
          )
        )
        .limit(1)
        .all();

      if (!roleRecord) {
        throw new Error(
          `Role '${userData.role}' not found for business ${businessId}`
        );
      }

      // 3. Create user (using RBAC system) with primaryRoleId set
      tx.insert(schema.users)
        .values({
          id: userId,
          username: userData.username,
          email: userData.email || null,
          passwordHash: null,
          pinHash: hashedPin,
          salt: salt,
          firstName: userData.firstName,
          lastName: userData.lastName,
          businessName: userData.businessName,
          businessId,
          primaryRoleId: roleRecord.id, // Set primary role ID
          isActive: true,
          address: "",
        })
        .run();

      // 4. Assign role via RBAC userRoles table
      tx.insert(schema.userRoles)
        .values({
          id: this.uuid.v4(),
          userId: userId,
          roleId: roleRecord.id,
          assignedBy: null, // System assignment
          assignedAt: now,
          isActive: true,
        })
        .run();
    });

    const user = this.getUserById(userId);
    if (!user) {
      throw new Error("User not found after creation");
    }
    return user;
  }
  updateUser(
    id: string,
    updates: Partial<{
      firstName: string;
      lastName: string;
      businessName: string;
      role: "cashier" | "supervisor" | "manager" | "admin" | "owner";
      primaryRoleId: string;
      isActive: boolean;
      address: string;
      pinHash?: string;
      salt?: string;
    }>
  ): { changes: number } {
    const result = this.db
      .update(schema.users)
      .set({ ...updates })
      .where(eq(schema.users.id, id))
      .run();

    return result;
  }

  /**
   * Update user PIN (hashes the PIN before storing)
   */
  async updateUserPin(
    userId: string,
    newPin: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = this.getUserById(userId);
      if (!user) {
        return { success: false, message: "User not found" };
      }

      // Generate new salt and hash the PIN
      const salt = await this.bcrypt.genSalt(10);
      const pinHash = await this.bcrypt.hash(newPin, salt);

      // Update user with new PIN hash and salt
      this.updateUser(userId, { pinHash, salt });

      logger.info(`[updateUserPin] PIN updated for user ${userId}`);
      return { success: true, message: "PIN updated successfully" };
    } catch (error) {
      logger.error(
        `[updateUserPin] Error updating PIN for user ${userId}:`,
        error
      );
      return { success: false, message: "Failed to update PIN" };
    }
  }

  deleteUser(id: string): { changes: number } {
    const result = this.db
      .update(schema.users)
      .set({
        isActive: false,
      })
      .where(eq(schema.users.id, id))
      .run();

    return result;
  }

  deleteUserSessions(userId: string): void {
    this.db
      .delete(schema.sessions)
      .where(eq(schema.sessions.userId, userId))
      .run();
  }

  getAllActiveUsers(): any[] {
    // Get all active users with their primary role from RBAC system
    // Use a more complex query to handle cases where primaryRoleId is null
    // by falling back to the first active role from userRoles table
    const usersWithRoles = this.db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        businessId: schema.users.businessId,
        businessName: schema.users.businessName,
        createdAt: schema.users.createdAt,
        updatedAt: schema.users.updatedAt,
        isActive: schema.users.isActive,
        pin: schema.users.pinHash,
        address: schema.users.address,
        primaryRoleId: schema.users.primaryRoleId,
        roleName: schema.roles.name,
      })
      .from(schema.users)
      .leftJoin(schema.roles, eq(schema.users.primaryRoleId, schema.roles.id))
      .where(eq(schema.users.isActive, true))
      .orderBy(schema.users.firstName)
      .all();

    // Post-process to fill in missing roleName for users with null primaryRoleId
    // by looking up their first active role from userRoles table
    const processedUsers = usersWithRoles.map((user: any) => {
      // If roleName is null/undefined, try to get it from userRoles table
      if (!user.roleName && user.id) {
        try {
          // Get first active role for this user
          const userRoleRecords = this.db
            .select({
              roleId: schema.userRoles.roleId,
              roleName: schema.roles.name,
            })
            .from(schema.userRoles)
            .innerJoin(
              schema.roles,
              eq(schema.userRoles.roleId, schema.roles.id)
            )
            .where(
              and(
                eq(schema.userRoles.userId, user.id),
                eq(schema.userRoles.isActive, true)
              )
            )
            .limit(1)
            .all();

          if (userRoleRecords.length > 0) {
            user.roleName = userRoleRecords[0].roleName;
            // Also update primaryRoleId if it's null
            if (!user.primaryRoleId) {
              user.primaryRoleId = userRoleRecords[0].roleId;
              // Update the database to fix this user
              this.updateUser(user.id, {
                primaryRoleId: userRoleRecords[0].roleId,
              });
              logger.info(
                `[getAllActiveUsers] Fixed missing primaryRoleId for user ${user.id}`
              );
            }
          }
        } catch (error) {
          logger.warn(
            `[getAllActiveUsers] Failed to lookup role for user ${user.id}:`,
            error
          );
        }
      }
      return user;
    });

    // Return users with primary role information from RBAC system
    // No longer includes deprecated 'role' field - use primaryRole.name instead
    return processedUsers;
  }

  async searchUsers(businessId: string, searchTerm: string): Promise<User[]> {
    const searchPattern = `%${searchTerm}%`;

    const users = this.db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.businessId, businessId),
          eq(schema.users.isActive, true),
          drizzleSql`(
            ${schema.users.email} LIKE ${searchPattern} OR 
            ${schema.users.firstName} LIKE ${searchPattern} OR 
            ${schema.users.lastName} LIKE ${searchPattern}
          )`
        )
      )
      .orderBy(desc(schema.users.createdAt))
      .all();

    return users as User[];
  }

  // Business Logic Methods (moved from appApi.ts)

  async register(data: {
    email?: string;
    pin: string;
    firstName: string;
    lastName: string;
    businessName: string;
    role: "cashier" | "manager" | "admin";
    username: string;
  }): Promise<AuthResponse> {
    try {
      // Validate input data using Zod schema
      const validation = validateInput(registerSchema, data);

      if (!validation.success) {
        return {
          success: false,
          message: "Validation failed",
          errors: validation.errors,
        };
      }

      const validatedData = validation.data;

      // Check if username already exists
      if (!validatedData.username) {
        return {
          success: false,
          message: "Username is required",
        };
      }
      const existingUser = this.getUserByUsername(validatedData.username);
      if (existingUser) {
        return {
          success: false,
          message: "Username already exists",
        };
      }

      // Check if email already exists (if provided)
      if (validatedData.email) {
        const existingEmailUser = this.getUserByEmail(validatedData.email);
        if (existingEmailUser) {
          return {
            success: false,
            message: "User with this email already exists",
          };
        }
      }

      // Ensure required fields are present
      const userData = {
        ...validatedData,
        username: validatedData.username || `user_${Date.now()}`,
        pin: validatedData.pin,
      };

      // Create user with validated data
      const user = await this.createUser(userData);

      // Create session using the session manager
      if (!this.sessionManager) {
        throw new Error("Session manager not initialized");
      }
      const session = this.sessionManager.createSession(user.id);

      // Return user without sensitive fields
      const {
        passwordHash: _,
        pinHash: __,
        salt: ___,
        ...userWithoutSecrets
      } = user;

      return {
        success: true,
        message: "User registered successfully",
        user: userWithoutSecrets as User,
        token: session.token,
      };
    } catch (error) {
      logger.error("Registration error:", error);
      return {
        success: false,
        message: "Registration failed due to server error",
      };
    }
  }

  async login(data: {
    username: string;
    pin: string;
    rememberMe?: boolean;
    terminalId?: string;
    ipAddress?: string;
  }): Promise<AuthResponse> {
    try {
      let user: User | null = null;
      let rememberMe = data.rememberMe || false;

      // PIN-based login (username + PIN)
      if (data.username && data.pin) {
        // Validate PIN login
        const validation = validateInput(pinLoginSchema, {
          username: data.username,
          pin: data.pin,
          rememberMe: data.rememberMe,
        });

        if (!validation.success) {
          return {
            success: false,
            message: "Validation failed",
            errors: validation.errors,
          };
        }

        // Authenticate with username and PIN
        user = await this.authenticateUserByUsernamePin(
          data.username,
          data.pin
        );

        if (!user) {
          return {
            success: false,
            message: "Invalid PIN",
          };
        }
      } else {
        return {
          success: false,
          message: "Please provide username and PIN",
        };
      }

      // Create session with appropriate duration for desktop EPOS system
      if (!this.sessionManager) {
        throw new Error("Session manager not initialized");
      }

      // Auto clock-in for cashiers and managers (if enabled)
      let clockEvent = null;
      let timeShift = null;
      let mode: "admin" | "cashier" = "admin";
      let sessionExpiryHours: number;

      // Resolve mode if time tracking is available
      if (this.timeTrackingManager) {
        const db = await getDatabase();
        const shiftRequirement = await shiftRequirementResolver.resolve(
          user,
          db
        );
        mode = shiftRequirement.mode;

        logger.info(
          `[login] Shift requirement resolved: requiresShift=${shiftRequirement.requiresShift}, mode=${mode}`
        );

        // Auto clock-in if shift is required (cashier/manager mode)
        if (shiftRequirement.requiresShift) {
          // Get business ID first (needed for validation)
          const userWithBusiness = this.getUserWithBusiness(user.id);
          if (!userWithBusiness?.businessId) {
            logger.error(`[login] User ${user.id} has no business ID`);
            return {
              success: false,
              message: "User business not found. Please contact administrator.",
              code: "BUSINESS_NOT_FOUND",
              requiresShift: true,
            };
          }

          // Validate schedule using scheduleValidator (includes timing validation)
          const scheduleValidation = await scheduleValidator.validateClockIn(
            user.id,
            userWithBusiness.businessId,
            db
          );

          // Audit log schedule validation
          try {
            await db.audit.createAuditLog({
              action: scheduleValidation.canClockIn
                ? "schedule_validation_passed"
                : "schedule_validation_failed",
              entityType: "user",
              entityId: user.id,
              userId: user.id,
              details: {
                canClockIn: scheduleValidation.canClockIn,
                requiresApproval: scheduleValidation.requiresApproval,
                reason: scheduleValidation.reason,
                warnings: scheduleValidation.warnings,
                scheduleId: scheduleValidation.schedule?.id,
              },
              ipAddress: data.ipAddress,
              terminalId: data.terminalId,
            });
          } catch (error) {
            logger.error(
              "[login] Failed to audit log schedule validation:",
              error
            );
          }

          if (!scheduleValidation.canClockIn) {
            // If requires approval, we can still proceed but log warning
            if (scheduleValidation.requiresApproval) {
              logger.warn(
                `[login] Schedule validation warnings for user ${
                  user.id
                }: ${scheduleValidation.warnings.join(", ")}`
              );
              // Continue but user should be aware of the warnings
            } else {
              // Critical issue - block login
              logger.warn(
                `[login] Schedule validation failed for user ${user.id}: ${scheduleValidation.reason}`
              );
              return {
                success: false,
                message:
                  scheduleValidation.reason ||
                  "Cannot clock in: Schedule validation failed. Please contact your manager.",
                code: "SCHEDULE_VALIDATION_FAILED",
                requiresShift: true,
                warning: scheduleValidation.warnings.join(", "),
              };
            }
          }

          const schedule = scheduleValidation.schedule;
          if (!schedule) {
            return {
              success: false,
              message:
                "No scheduled shift found. You cannot clock in at this time. Please contact your manager to create a schedule.",
              code: "NO_SCHEDULED_SHIFT",
              requiresShift: true,
            };
          }

          // Check for existing active shift
          const activeShift = this.timeTrackingManager.getActiveShift(user.id);

          if (!activeShift) {
            try {
              // Create clock-in event linked to schedule (with audit logging)
              const dbInstance = await getDatabase();
              // Use terminalId if provided, otherwise let createClockEvent handle it
              // (it will find/create a default terminal for the business)
              clockEvent = await this.timeTrackingManager.createClockEvent({
                userId: user.id,
                businessId: userWithBusiness.businessId, // ✅ REQUIRED
                terminalId:
                  data.terminalId || `default-${userWithBusiness.businessId}`,
                scheduleId: schedule.id, // ✅ Link to schedule
                type: "in",
                method: "login",
                ipAddress: data.ipAddress,
                auditManager: dbInstance.audit, // Pass audit manager for logging
              });

              // Create time shift linked to schedule
              timeShift = await this.timeTrackingManager.createShift({
                userId: user.id,
                businessId: userWithBusiness.businessId,
                scheduleId: schedule.id, // ✅ Link to schedule
                clockInId: clockEvent.id,
              });

              // Update schedule status to "active"
              this.scheduleManager.updateScheduleStatus(schedule.id, "active");

              logger.info(
                `[login] Auto clock-in successful for scheduled shift ${schedule.id}`
              );
            } catch (error) {
              logger.error(
                `[login] Auto clock-in failed for user ${user.id}:`,
                error
              );
              // CRITICAL: Fail login if clock-in fails (user cannot work without shift)
              return {
                success: false,
                message:
                  error instanceof Error
                    ? `Failed to clock in: ${error.message}`
                    : "Failed to clock in. Please try again or contact your manager.",
                code: "CLOCK_IN_FAILED",
                requiresShift: true,
                clockInError:
                  error instanceof Error ? error.message : "Unknown error",
              };
            }
          } else {
            // User already has active shift
            timeShift = activeShift;
            logger.info(
              `[login] User ${user.id} already has active shift ${activeShift.id}`
            );
          }
        }
      }

      // Set session expiry based on mode
      if (mode === "cashier") {
        // Shift-based users: 12 hours covers full shift, 48 hours for rememberMe
        sessionExpiryHours = rememberMe ? 48 : 12;
      } else {
        // Admin users: 8 hours default, 30 days with rememberMe
        sessionExpiryHours = rememberMe ? 30 * 24 : 8;
      }

      // Create session (Desktop EPOS: single long-lived token with secure storage)
      const session = this.sessionManager.createSession(
        user.id,
        sessionExpiryHours / 24 // Convert hours to days
      );

      // Return user without sensitive fields
      const {
        passwordHash: _,
        pinHash: __,
        salt: ___,
        ...userWithoutSecrets
      } = user;

      return {
        success: true,
        message: "Login successful",
        user: userWithoutSecrets as schema.User,
        token: session.token,
        mode, // Indicate mode (admin or cashier)
        requiresShift: mode === "cashier", // Explicit shift requirement flag
        clockEvent: clockEvent as any,
        shift: timeShift as any,
      };
    } catch (error) {
      logger.error("Login error:", error);
      return {
        success: false,
        message: "Login failed due to server error",
      };
    }
  }

  validateSession(token: string): AuthResponse {
    try {
      if (!this.sessionManager) {
        throw new Error("Session manager not initialized");
      }

      const session = this.sessionManager.getSessionByToken(token);
      if (!session) {
        return {
          success: false,
          message: "Invalid or expired session",
        };
      }

      const user = this.getUserById(session.userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Return user without sensitive fields
      const {
        passwordHash: _,
        pinHash: __,
        salt: ___,
        ...userWithoutSecrets
      } = user;

      return {
        success: true,
        message: "Session valid",
        user: userWithoutSecrets as User,
      };
    } catch (error) {
      logger.error("Session validation error:", error);
      return {
        success: false,
        message: "Session validation failed",
      };
    }
  }

  async logout(
    token: string,
    options?: {
      terminalId?: string;
      ipAddress?: string;
    }
  ): Promise<AuthResponse> {
    try {
      if (!this.sessionManager) {
        throw new Error("Session manager not initialized");
      }

      // Get user from session before deleting
      const session = this.sessionManager.getSessionByToken(token);
      if (!session) {
        return {
          success: false,
          message: "Session not found",
        };
      }

      const user = this.getUserById(session.userId);

      // Auto clock-out if user has active shift
      if (this.timeTrackingManager && user) {
        const activeShift = this.timeTrackingManager.getActiveShift(user.id);

        if (activeShift) {
          try {
            // End any active breaks
            const activeBreak = this.timeTrackingManager.getActiveBreak(
              activeShift.id
            );
            if (activeBreak) {
              await this.timeTrackingManager.endBreak(activeBreak.id);
              logger.info(
                `[logout] Ended active break ${activeBreak.id} for user ${user.id}`
              );
            }

            // Get business ID for clock-out event
            const userWithBusiness = this.getUserWithBusiness(user.id);
            if (!userWithBusiness?.businessId) {
              throw new Error("User business not found");
            }

            // Create clock-out event linked to schedule (if shift has one)
            const dbInstance = await getDatabase();
            const clockOutEvent =
              await this.timeTrackingManager.createClockEvent({
                userId: user.id,
                businessId: userWithBusiness.businessId, // ✅ REQUIRED
                terminalId: options?.terminalId || "unknown",
                scheduleId: activeShift.scheduleId ?? undefined, // ✅ Link to schedule
                type: "out",
                method: "logout",
                ipAddress: options?.ipAddress,
                auditManager: dbInstance.audit, // Pass audit manager for logging
              });

            // Complete shift
            await this.timeTrackingManager.completeShift(
              activeShift.id,
              clockOutEvent.id
            );

            // Update schedule status to "completed" if linked
            if (activeShift.scheduleId) {
              try {
                this.scheduleManager?.updateScheduleStatus(
                  activeShift.scheduleId,
                  "completed"
                );
                logger.info(
                  `[logout] Updated schedule ${activeShift.scheduleId} status to completed`
                );
              } catch (error) {
                logger.warn(
                  `[logout] Failed to update schedule status: ${error}`
                );
                // Don't fail logout if schedule update fails
              }
            }

            logger.info(
              `[logout] Auto clock-out successful for user ${user.id}: TimeShift ${activeShift.id} completed`
            );
          } catch (error) {
            logger.error("Auto clock-out failed:", error);
            // Don't fail logout if clock-out fails
          }
        }
      }

      // Delete session
      const deleted = this.sessionManager.deleteSession(token);

      return {
        success: deleted,
        message: deleted ? "Logged out successfully" : "Session not found",
      };
    } catch (error) {
      logger.error("Logout error:", error);
      return {
        success: false,
        message: "Logout failed",
      };
    }
  }

  getUserByIdWithResponse(userId: string): AuthResponse {
    try {
      const user = this.getUserById(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Return user without sensitive fields
      const {
        passwordHash: _,
        pinHash: __,
        salt: ___,
        ...userWithoutSecrets
      } = user;

      return {
        success: true,
        message: "User found",
        user: userWithoutSecrets as User,
      };
    } catch (error) {
      logger.error("Get user error:", error);
      return {
        success: false,
        message: "Failed to get user",
      };
    }
  }

  updateUserWithResponse(
    userId: string,
    updates: Partial<{
      firstName: string;
      lastName: string;
      businessName: string;
      role: "cashier" | "manager" | "admin";
      isActive: boolean;
      address: string;
    }>
  ): AuthResponse {
    try {
      const result = this.updateUser(userId, updates);
      if (result.changes === 0) {
        return {
          success: false,
          message: "User not found or update failed",
        };
      }

      const user = this.getUserById(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found after update",
        };
      }

      // Return user without sensitive fields
      const {
        passwordHash: _,
        pinHash: __,
        salt: ___,
        ...userWithoutSecrets
      } = user;

      return {
        success: true,
        message: "User updated successfully",
        user: userWithoutSecrets as User,
      };
    } catch (error) {
      logger.error("Update user error:", error);
      return {
        success: false,
        message: "Update failed due to server error",
      };
    }
  }

  deleteUserWithResponse(userId: string): AuthResponse {
    try {
      // Check if user exists first
      const user = this.getUserById(userId);
      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      const result = this.deleteUser(userId);
      if (result.changes === 0) {
        return {
          success: false,
          message: "Failed to delete user",
        };
      }

      return {
        success: true,
        message: "User deleted successfully",
      };
    } catch (error) {
      logger.error("Delete user error:", error);
      return {
        success: false,
        message: "Delete failed due to server error",
      };
    }
  }

  getUsersByBusinessWithResponse(businessId: string): AuthResponse {
    try {
      const users = this.getUsersByBusiness(businessId);

      return {
        success: true,
        message: "Users retrieved successfully",
        users,
      };
    } catch (error: any) {
      logger.error("Get users by business error:", error);
      return {
        success: false,
        message: error.message || "Failed to get users",
      };
    }
  }

  async createUserForBusiness(userData: {
    businessId: string;
    email?: string;
    pin: string;
    username: string;
    firstName: string;
    lastName: string;
    role: "cashier" | "manager";
  }): Promise<AuthResponse> {
    try {
      // Get business to retrieve business name
      const [business] = this.db
        .select()
        .from(schema.businesses)
        .where(eq(schema.businesses.id, userData.businessId))
        .limit(1)
        .all();

      if (!business) {
        return {
          success: false,
          message: "Business not found",
        };
      }

      const user = await this.createUser({
        ...userData,
        businessName: business.businessName,
      });

      // Return user without sensitive fields
      const {
        passwordHash: _,
        pinHash: __,
        salt: ___,
        ...userWithoutSecrets
      } = user;

      return {
        success: true,
        message: "User created successfully",
        user: userWithoutSecrets as User,
      };
    } catch (error: any) {
      logger.error("Create user error:", error);
      return {
        success: false,
        message: error.message || "Failed to create user",
      };
    }
  }

  /**
   * Helper to check if a user has admin-level roles (admin/owner)
   * Used to determine if clock-in/out is required
   */
  private isAdminUser(user: User): boolean {
    // Check if user has admin or owner role via RBAC
    const userRoles = this.db
      .select({ name: schema.roles.name })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
      .where(
        and(
          eq(schema.userRoles.userId, user.id),
          eq(schema.userRoles.isActive, true)
        )
      )
      .all();

    return userRoles.some((ur) => ur.name === "admin" || ur.name === "owner");
  }
}
