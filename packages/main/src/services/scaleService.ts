/**
 * Scale Hardware Service for Electron Main Process
 * Handles scale hardware communication (USB HID, Serial, TCP/IP)
 * Supports automatic weight reading, stability detection, and tare functionality
 */

import { ipcMain, BrowserWindow } from "electron";
import { getLogger } from "../utils/logger.js";

const logger = getLogger("ScaleService");

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface ScaleDevice {
  id: string;
  type: "HID" | "SERIAL" | "TCP_IP";
  path?: string;
  vendorId?: number;
  productId?: number;
  manufacturer?: string;
  product?: string;
  serialNumber?: string;
  baudRate?: number;
  address?: string;
  port?: number;
}

export interface ScaleReading {
  weight: number; // in kg
  stable: boolean;
  unit: "g" | "kg" | "lb" | "oz";
  timestamp: string;
  rawReadings?: number[]; // Last few readings for stability calculation
}

export interface ScaleStatus {
  connected: boolean;
  deviceType: string;
  connectionType: "HID" | "SERIAL" | "TCP_IP" | "none";
  deviceId?: string;
  lastReading?: ScaleReading;
  error?: string;
  isReading: boolean;
}

export interface ScaleConfig {
  device: ScaleDevice;
  tareWeight?: number; // Container weight to subtract
  minWeight?: number; // Minimum weight threshold
  maxWeight?: number; // Maximum weight capacity
  stabilityThreshold?: number; // Weight change threshold for stability (in grams)
  stabilityReadings?: number; // Number of consistent readings needed
  unit?: "g" | "kg" | "lb" | "oz";
  simulated?: boolean; // For development/testing
}

// =============================================================================
// SCALE DRIVER INTERFACE
// =============================================================================

export interface IScaleDriver {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  startReading(callback: (weight: number, stable: boolean) => void): void;
  stopReading(): void;
  tare(): Promise<void>;
  getStatus(): { connected: boolean; error?: string };
}

// =============================================================================
// SCALE SERVICE
// =============================================================================

export class ScaleService {
  private currentDriver: IScaleDriver | null = null;
  private currentConfig: ScaleConfig | null = null;
  private isReading: boolean = false;
  private currentWeight: number = 0;
  private isStable: boolean = false;
  private readingHistory: number[] = [];
  private stabilityThreshold: number = 2; // 2g default
  private stabilityReadings: number = 3; // 3 consistent readings
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.setupIpcHandlers();
  }

  /**
   * Setup IPC handlers for renderer communication
   */
  private setupIpcHandlers(): void {
    // Discover available scales
    ipcMain.handle("scale:discover", async () => {
      try {
        logger.info("Discovering scales...");
        const devices = await this.discoverScales();
        logger.info(`Found ${devices.length} scale(s)`);
        return { success: true, devices };
      } catch (error) {
        logger.error("Scale discovery failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Discovery failed",
          devices: [],
        };
      }
    });

    // Connect to scale
    ipcMain.handle("scale:connect", async (event, config: ScaleConfig) => {
      try {
        logger.info("Connecting to scale...", config);
        const success = await this.connectToScale(config);
        if (success) {
          this.mainWindow = BrowserWindow.fromWebContents(event.sender);
          return { success: true };
        }
        return { success: false, error: "Failed to connect to scale" };
      } catch (error) {
        logger.error("Scale connection failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Connection failed",
        };
      }
    });

    // Disconnect from scale
    ipcMain.handle("scale:disconnect", async () => {
      try {
        await this.disconnectScale();
        return { success: true };
      } catch (error) {
        logger.error("Scale disconnection failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Disconnection failed",
        };
      }
    });

    // Get scale status
    ipcMain.handle("scale:status", async () => {
      return this.getStatus();
    });

    // Tare scale (reset to zero)
    ipcMain.handle("scale:tare", async () => {
      try {
        await this.tareScale();
        return { success: true };
      } catch (error) {
        logger.error("Scale tare failed:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Tare failed",
        };
      }
    });

    // Start reading
    ipcMain.on("scale:start-reading", () => {
      this.startReading();
    });

    // Stop reading
    ipcMain.on("scale:stop-reading", () => {
      this.stopReading();
    });
  }

  /**
   * Discover available scale devices
   */
  private async discoverScales(): Promise<ScaleDevice[]> {
    const discoveredScales: ScaleDevice[] = [];

    try {
      // Try to discover HID scales
      const hidScales = await this.discoverHIDScales();
      discoveredScales.push(...hidScales);

      // Try to discover Serial scales
      const serialScales = await this.discoverSerialScales();
      discoveredScales.push(...serialScales);
    } catch (error) {
      logger.error("Error during scale discovery:", error);
    }

    return discoveredScales;
  }

  /**
   * Discover USB HID scales
   */
  private async discoverHIDScales(): Promise<ScaleDevice[]> {
    const scales: ScaleDevice[] = [];

    try {
      // Dynamic import to handle missing dependency gracefully
      const HID = await import("node-hid").catch(() => null);
      if (!HID) {
        logger.warn("node-hid not available, skipping HID scale discovery");
        return scales;
      }

      const devices = HID.devices();
      const scaleVendors = [
        0x0922, // Mettler Toledo
        0x1a86, // QinHeng Electronics (common in cheap scales)
        0x04d8, // Microchip
        0x1c4f, // SIGMA
      ];

      devices.forEach((device) => {
        const isScale =
          scaleVendors.includes(device.vendorId) ||
          device.product?.toLowerCase().includes("scale") ||
          device.manufacturer?.toLowerCase().includes("scale") ||
          device.product?.toLowerCase().includes("balance");

        if (isScale && device.path) {
          scales.push({
            id: `hid-${device.vendorId}-${device.productId}`,
            type: "HID",
            path: device.path,
            vendorId: device.vendorId,
            productId: device.productId,
            manufacturer: device.manufacturer,
            product: device.product,
          });
        }
      });
    } catch (error) {
      logger.error("HID scale discovery error:", error);
    }

    return scales;
  }

  /**
   * Discover Serial port scales
   */
  private async discoverSerialScales(): Promise<ScaleDevice[]> {
    const scales: ScaleDevice[] = [];

    try {
      // Dynamic import to handle missing dependency gracefully
      const { SerialPort } = await import("serialport").catch(() => ({ SerialPort: null }));
      if (!SerialPort) {
        logger.warn("serialport not available, skipping serial scale discovery");
        return scales;
      }

      const ports = await SerialPort.list();
      const scaleManufacturers = ["metter", "sartorius", "ohaus", "scale", "balance"];

      ports.forEach((port) => {
        const isScale = scaleManufacturers.some((manufacturer) =>
          port.manufacturer?.toLowerCase().includes(manufacturer)
        );

        if (isScale) {
          scales.push({
            id: `serial-${port.path}`,
            type: "SERIAL",
            path: port.path,
            manufacturer: port.manufacturer,
            serialNumber: port.serialNumber,
            baudRate: 9600, // Default baud rate
          });
        }
      });
    } catch (error) {
      logger.error("Serial scale discovery error:", error);
    }

    return scales;
  }

  /**
   * Connect to a scale device
   */
  private async connectToScale(config: ScaleConfig): Promise<boolean> {
    try {
      // Disconnect existing connection
      if (this.currentDriver) {
        await this.disconnectScale();
      }

      this.currentConfig = config;
      this.stabilityThreshold = config.stabilityThreshold || 2; // 2g default
      this.stabilityReadings = config.stabilityReadings || 3;

      // Create appropriate driver
      if (config.simulated) {
        this.currentDriver = new SimulatedScaleDriver();
      } else if (config.device.type === "HID") {
        this.currentDriver = new HIDScaleDriver(config.device);
      } else if (config.device.type === "SERIAL") {
        this.currentDriver = new SerialScaleDriver(config.device);
      } else {
        throw new Error(`Unsupported scale type: ${config.device.type}`);
      }

      // Connect driver
      const connected = await this.currentDriver.connect();
      if (connected) {
        logger.info("Scale connected successfully");
        // Start reading automatically
        this.startReading();
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Failed to connect to scale:", error);
      throw error;
    }
  }

  /**
   * Disconnect from scale
   */
  private async disconnectScale(): Promise<void> {
    this.stopReading();

    if (this.currentDriver) {
      await this.currentDriver.disconnect();
      this.currentDriver = null;
    }

    this.currentConfig = null;
    this.currentWeight = 0;
    this.isStable = false;
    this.readingHistory = [];

    logger.info("Scale disconnected");
  }

  /**
   * Get current scale status
   */
  private getStatus(): ScaleStatus {
    const connected = this.currentDriver?.getStatus().connected || false;

    return {
      connected,
      deviceType: this.currentConfig?.device.type || "none",
      connectionType: this.currentConfig?.device.type || "none",
      deviceId: this.currentConfig?.device.id,
      lastReading: this.currentWeight > 0
        ? {
            weight: this.currentWeight,
            stable: this.isStable,
            unit: this.currentConfig?.unit || "kg",
            timestamp: new Date().toISOString(),
            rawReadings: [...this.readingHistory],
          }
        : undefined,
      isReading: this.isReading,
    };
  }

  /**
   * Tare scale (reset to zero)
   */
  private async tareScale(): Promise<void> {
    if (this.currentDriver) {
      await this.currentDriver.tare();
      this.currentWeight = 0;
      this.isStable = false;
      this.readingHistory = [];
      logger.info("Scale tared");
    }
  }

  /**
   * Start continuous weight reading
   */
  private startReading(): void {
    if (!this.currentDriver || this.isReading) {
      return;
    }

    this.isReading = true;
    this.readingHistory = [];

    this.currentDriver.startReading((weight, _stable) => {
      this.processWeightReading(weight);
    });

    logger.info("Started scale reading");
  }

  /**
   * Stop weight reading
   */
  private stopReading(): void {
    if (this.currentDriver && this.isReading) {
      this.currentDriver.stopReading();
      this.isReading = false;
      logger.info("Stopped scale reading");
    }
  }

  /**
   * Process weight reading from driver
   */
  private processWeightReading(weight: number): void {
    // Apply tare weight if configured
    if (this.currentConfig?.tareWeight) {
      weight = Math.max(0, weight - this.currentConfig.tareWeight);
    }

    // Check min/max weight limits
    if (this.currentConfig?.minWeight && weight < this.currentConfig.minWeight) {
      weight = 0;
    }
    if (this.currentConfig?.maxWeight && weight > this.currentConfig.maxWeight) {
      logger.warn(`Weight ${weight}kg exceeds maximum ${this.currentConfig.maxWeight}kg`);
    }

    // Update reading history for stability calculation
    this.readingHistory.push(weight);
    if (this.readingHistory.length > 10) {
      this.readingHistory.shift(); // Keep last 10 readings
    }

    // Calculate stability based on recent readings
    const stable = this.calculateStability(weight);

    this.currentWeight = weight;
    this.isStable = stable;

    // Send reading to renderer
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const reading: ScaleReading = {
        weight,
        stable,
        unit: this.currentConfig?.unit || "kg",
        timestamp: new Date().toISOString(),
        rawReadings: [...this.readingHistory.slice(-5)], // Last 5 readings
      };

      this.mainWindow.webContents.send("scale:reading", reading);
    }
  }

  /**
   * Calculate if weight is stable based on recent readings
   */
  private calculateStability(currentWeight: number): boolean {
    if (this.readingHistory.length < this.stabilityReadings) {
      return false;
    }

    const recent = this.readingHistory.slice(-this.stabilityReadings);
    const average = recent.reduce((a, b) => a + b, 0) / recent.length;
    const threshold = this.stabilityThreshold / 1000; // Convert grams to kg

    // Check if all recent readings are within threshold
    const allStable = recent.every((reading) => Math.abs(reading - average) <= threshold);

    return allStable && currentWeight > 0;
  }
}

// =============================================================================
// SCALE DRIVERS
// =============================================================================

/**
 * Simulated Scale Driver for development/testing
 */
class SimulatedScaleDriver implements IScaleDriver {
  private isConnected = false;
  private isReading = false;
  private currentWeight = 0;
  private readingCallback: ((weight: number, stable: boolean) => void) | null = null;
  private intervalId: NodeJS.Timeout | null = null;

  async connect(): Promise<boolean> {
    this.isConnected = true;
    logger.info("Simulated scale connected");
    return true;
  }

  async disconnect(): Promise<void> {
    this.stopReading();
    this.isConnected = false;
    logger.info("Simulated scale disconnected");
  }

  startReading(callback: (weight: number, stable: boolean) => void): void {
    if (this.isReading) return;

    this.readingCallback = callback;
    this.isReading = true;

    // Simulate weight readings
    this.intervalId = setInterval(() => {
      if (this.readingCallback) {
        // Simulate small fluctuations
        const fluctuation = (Math.random() * 0.02 - 0.01) * (this.currentWeight > 0 ? 1 : 0.1);
        this.currentWeight = Math.max(0, this.currentWeight + fluctuation);

        // Randomly become stable after weight is set
        const stable = this.currentWeight > 0 && Math.random() > 0.3;

        this.readingCallback(this.currentWeight, stable);
      }
    }, 500);
  }

  stopReading(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isReading = false;
    this.readingCallback = null;
  }

  async tare(): Promise<void> {
    this.currentWeight = 0;
  }

  getStatus(): { connected: boolean; error?: string } {
    return { connected: this.isConnected };
  }

  // Method to simulate item placement (for testing)
  simulateItemPlacement(weight: number): void {
    this.currentWeight = weight;
  }
}

/**
 * USB HID Scale Driver
 */
class HIDScaleDriver implements IScaleDriver {
  private device: any = null;
  private isConnected = false;
  private isReading = false;
  private readingCallback: ((weight: number, stable: boolean) => void) | null = null;

  constructor(private deviceConfig: ScaleDevice) {}

  async connect(): Promise<boolean> {
    try {
      const HID = await import("node-hid").catch(() => null);
      if (!HID) {
        throw new Error("node-hid not available");
      }

      if (!this.deviceConfig.path) {
        throw new Error("Device path not provided");
      }

      this.device = new HID.HID(this.deviceConfig.path);

      this.device.on("data", (data: Buffer) => {
        this.parseHIDData(data);
      });

      this.device.on("error", (error: Error) => {
        logger.error("HID scale error:", error);
        this.disconnect();
      });

      this.isConnected = true;
      logger.info("HID scale connected");
      return true;
    } catch (error) {
      logger.error("Failed to connect HID scale:", error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopReading();
    if (this.device) {
      try {
        this.device.close();
      } catch (error) {
        logger.error("Error closing HID device:", error);
      }
      this.device = null;
    }
    this.isConnected = false;
    logger.info("HID scale disconnected");
  }

  startReading(callback: (weight: number, stable: boolean) => void): void {
    if (this.isReading) return;
    this.readingCallback = callback;
    this.isReading = true;
    // HID scales send data automatically via 'data' event
  }

  stopReading(): void {
    this.isReading = false;
    this.readingCallback = null;
  }

  async tare(): Promise<void> {
    // Most HID scales don't support software tare
    // Physical tare button on scale should be used
    logger.info("HID scale tare requested (may require physical button)");
  }

  getStatus(): { connected: boolean; error?: string } {
    return { connected: this.isConnected };
  }

  private parseHIDData(data: Buffer): void {
    if (!this.readingCallback || !this.isReading) return;

    try {
      // Common HID scale data format: 6-8 bytes
      // Byte structure varies by manufacturer
      let weight = 0;
      let stable = false;

      if (data.length >= 6) {
        // Common format: bytes 1-2 contain weight in grams (little-endian)
        weight = data.readUInt16LE(1);

        // Byte 4 or 5: Status (0x04 = stable, 0x05 = unstable)
        if (data.length >= 5) {
          stable = data[4] === 0x04;
        }

        // Convert grams to kg
        weight = weight / 1000;
      }

      if (weight >= 0) {
        this.readingCallback(weight, stable);
      }
    } catch (error) {
      logger.error("Error parsing HID data:", error);
    }
  }
}

/**
 * Serial Port Scale Driver
 */
class SerialScaleDriver implements IScaleDriver {
  private port: any = null;
  private parser: any = null;
  private isConnected = false;
  private isReading = false;
  private readingCallback: ((weight: number, stable: boolean) => void) | null = null;

  constructor(private deviceConfig: ScaleDevice) {}

  async connect(): Promise<boolean> {
    try {
      const { SerialPort } = await import("serialport").catch(() => ({ SerialPort: null }));
      if (!SerialPort) {
        throw new Error("serialport not available");
      }

      const { ReadlineParser } = await import("@serialport/parser-readline").catch(() => ({ ReadlineParser: null }));
      if (!ReadlineParser) {
        throw new Error("@serialport/parser-readline not available");
      }

      if (!this.deviceConfig.path) {
        throw new Error("Device path not provided");
      }

      this.port = new SerialPort({
        path: this.deviceConfig.path,
        baudRate: this.deviceConfig.baudRate || 9600,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

      this.parser.on("data", (data: string) => {
        this.parseSerialData(data);
      });

      this.port.on("error", (error: Error) => {
        logger.error("Serial scale error:", error);
      });

      this.isConnected = true;
      logger.info("Serial scale connected");
      return true;
    } catch (error) {
      logger.error("Failed to connect serial scale:", error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.stopReading();
    if (this.parser) {
      this.parser.destroy();
      this.parser = null;
    }
    if (this.port) {
      return new Promise((resolve) => {
        this.port.close((error: Error | null) => {
          if (error) {
            logger.error("Error closing serial port:", error);
          }
          this.port = null;
          this.isConnected = false;
          resolve();
        });
      });
    }
    this.isConnected = false;
    logger.info("Serial scale disconnected");
  }

  startReading(callback: (weight: number, stable: boolean) => void): void {
    if (this.isReading) return;
    this.readingCallback = callback;
    this.isReading = true;
    // Serial scales send data automatically via parser
  }

  stopReading(): void {
    this.isReading = false;
    this.readingCallback = null;
  }

  async tare(): Promise<void> {
    // Send tare command to scale (format varies by manufacturer)
    if (this.port && this.isConnected) {
      // Common tare commands: "T" or "Z" or "\x1BT"
      this.port.write("T\r\n");
    }
  }

  getStatus(): { connected: boolean; error?: string } {
    return { connected: this.isConnected };
  }

  private parseSerialData(data: string): void {
    if (!this.readingCallback || !this.isReading) return;

    try {
      // Common serial scale formats:
      // "S   1.234 kg" - Sartorius
      // "NT  0.567 kg" - Mettler Toledo (NT = not stable)
      // "+    1234 g" - Ohaus
      // "ST,+001.234,kg" - Some scales

      const match = data.match(/([+-]?)\s*(\d+\.?\d*)\s*([k]?g)/i);
      if (match) {
        let weight = parseFloat(match[2]);
        const unit = match[3].toLowerCase();

        // Convert to kg
        if (unit === "g") {
          weight = weight / 1000;
        }

        // Check stability (S = stable, NT = not stable, ? = unstable)
        const stable = !data.includes("?") && !data.includes("NT") && data.includes("S");

        if (weight >= 0) {
          this.readingCallback(weight, stable);
        }
      }
    } catch (error) {
      logger.error("Error parsing serial data:", error);
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let scaleServiceInstance: ScaleService | null = null;

export function getScaleService(): ScaleService {
  if (!scaleServiceInstance) {
    scaleServiceInstance = new ScaleService();
  }
  return scaleServiceInstance;
}

// Auto-initialize on import
getScaleService();
