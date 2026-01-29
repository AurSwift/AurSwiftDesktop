/**
 * Thermal Printer Service for Electron Main Process
 * Handles communication with thermal receipt printers (ESC/POS).
 *
 * This service is the main-process implementation behind `window.printerAPI`
 * (exposed from preload). It supports Windows COM port printers (USB-serial),
 * as well as other `node-thermal-printer` interface strings (tcp://, printer:).
 */

import { ipcMain } from "electron";
import { getLogger } from "../utils/logger.js";
import { getDatabase } from "../database/index.js";
import {
  buildEscposReceiptLatin1,
  estimateCharactersPerLine,
  stripEscposToPlainText,
} from "@app/shared";
import bwipjs from "bwip-js";

const logger = getLogger("thermalPrinterService");

type ThermalPrinterModule = {
  ThermalPrinter: new (opts: any) => ThermalPrinterInstance;
  PrinterTypes?: Record<string, any>;
  CharacterSet?: Record<string, any>;
};

type ThermalPrinterInstance = {
  clear: () => void;
  execute: () => Promise<boolean>;
  // node-thermal-printer v4
  isPrinterConnected?: () => Promise<boolean>;
  // older / fallback
  isConnected?: () => Promise<boolean>;

  // Prefer raw to preserve ESC/POS bytes exactly
  raw?: (data: Buffer) => Promise<void> | void;

  // Used for test prints / fallback
  alignCenter?: () => void;
  alignLeft?: () => void;
  setTextSize?: (width: number, height: number) => void;
  println?: (text: string) => void;
  newLine?: () => void;
  drawLine?: () => void;
  cut?: () => void;
};

export interface PrinterConfig {
  type: string; // 'epson', 'star', 'generic'
  interface: string; // 'COM3', '\\\\.\\COM3', 'tcp://ip:9100', 'printer:Name'
  width?: number; // paper width in mm (58/80)
  options?: {
    timeout?: number;
    characterSet?: string;
    removeSpecialCharacters?: boolean;
  };
}

export interface PrinterStatus {
  connected: boolean;
  interface: string;
  type: string;
  lastPrint?: string;
  error?: string;
}

export interface PrintRequest {
  data: Buffer;
  jobId: string;
  timeout?: number;
}

export interface PrintResponse {
  success: boolean;
  jobId: string;
  error?: string;
  timestamp: string;
}

type QueueItem = {
  request: PrintRequest;
  attempts: number;
  resolve: (res: PrintResponse) => void;
};

type TransactionDataLike = {
  id: string;
  receiptNumber: string;
  timestamp?: string | Date;
  cashierId?: string;
  cashierName?: string;
  businessId?: string;
  businessName?: string;
  subtotal?: number;
  tax?: number;
  total: number;
  amountPaid?: number;
  change?: number;
  paymentMethods?: Array<{ type: string; amount: number }>;
  items: Array<{
    productName?: string;
    itemName?: string;
    quantity?: number;
    unitPrice?: number;
    totalPrice?: number;
    weight?: number;
    unitOfMeasure?: string;
    itemType?: string;
    productId?: string;
  }>;
};

export class ThermalPrinterService {
  private printer: ThermalPrinterInstance | null = null;
  private thermalLib: ThermalPrinterModule | null = null;
  private currentConfig: PrinterConfig | null = null;
  private isInitialized = false;
  private printQueue: QueueItem[] = [];
  private isProcessingQueue = false;
  private cancelRequested = false;
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAYS_MS = [500, 1500];

  constructor() {
    this.setupIpcHandlers();
  }

  /**
   * Setup IPC handlers for renderer communication
   */
  private setupIpcHandlers(): void {
    // ==========================================================
    // Canonical IPC channels used by preload `window.printerAPI`
    // ==========================================================

    ipcMain.handle("printer:getStatus", async () => {
      return await this.getPrinterStatus();
    });

    ipcMain.handle("printer:connect", async (_event, config: PrinterConfig) => {
      return await this.initializePrinter(config);
    });

    ipcMain.handle(
      "printer:printReceipt",
      async (_event, transactionData: any) => {
        const jobId = `receipt_${Date.now()}`;
        try {
          const buffer = await this.buildReceiptBuffer(transactionData);
          const result = await this.enqueuePrint(buffer, jobId, 15000);
          return result.success
            ? { success: true }
            : { success: false, error: result.error || "Print failed" };
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Print failed";
          return { success: false, error: message };
        }
      },
    );

    ipcMain.handle(
      "printer:previewReceipt",
      async (_event, transactionData: any) => {
        try {
          const receiptLatin1 = await this.buildReceiptLatin1(transactionData);
          const receiptNumber = String(
            (transactionData as any)?.receiptNumber || "",
          ).trim();
          let barcodePngBase64: string | undefined;

          // For UI preview we return a PNG barcode (same approach as email receipts).
          // The actual thermal printer uses ESC/POS barcode commands, not PNG.
          if (receiptNumber) {
            try {
              const barcodePngBuffer = await bwipjs.toBuffer({
                bcid: "code128",
                text: receiptNumber,
                scale: 3,
                height: 12,
                includetext: false,
                backgroundcolor: "ffffff",
              });
              barcodePngBase64 = barcodePngBuffer.toString("base64");
            } catch (error) {
              logger.warn("Failed to generate barcode PNG for preview:", error);
            }
          }

          return {
            success: true,
            text: stripEscposToPlainText(receiptLatin1),
            barcodePngBase64,
          };
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to generate preview";
          return { success: false, error: message };
        }
      },
    );

    ipcMain.handle("printer:cancelPrint", async () => {
      this.cancelPrint("Cancelled by user");
    });

    ipcMain.handle("printer:getAvailableInterfaces", async () => {
      const { interfaces } = await this.getAvailableInterfaces();
      return interfaces;
    });

    // Initialize printer
    ipcMain.handle(
      "printer:initialize",
      async (event, config: PrinterConfig) => {
        return await this.initializePrinter(config);
      },
    );

    // Print receipt
    ipcMain.handle(
      "printer:print",
      async (event, printData: Buffer, jobId: string) => {
        return await this.enqueuePrint(printData, jobId, 15000);
      },
    );

    // Get printer status
    ipcMain.handle("printer:status", async () => {
      return await this.getPrinterStatus();
    });

    // Test printer connection
    ipcMain.handle("printer:test", async () => {
      return await this.testPrinter();
    });

    // Disconnect printer
    ipcMain.handle("printer:disconnect", async () => {
      return await this.disconnect();
    });

    // Get available interfaces
    ipcMain.handle("printer:interfaces", async () => {
      const { interfaces } = await this.getAvailableInterfaces();
      return { success: true, interfaces };
    });
  }

  private async loadThermalLib(): Promise<ThermalPrinterModule> {
    if (this.thermalLib) return this.thermalLib;
    try {
      const mod =
        (await import("node-thermal-printer")) as unknown as ThermalPrinterModule;
      this.thermalLib = mod;
      return mod;
    } catch (error) {
      logger.error("Failed to import node-thermal-printer", error);
      throw new Error(
        "Thermal printer library not available. Please ensure node-thermal-printer is installed.",
      );
    }
  }

  private normalizeInterface(raw: string): string {
    const trimmed = (raw || "").trim();
    if (!trimmed) return trimmed;

    // Windows COM ports should be passed as \\\\.\\COMx
    const comMatch = trimmed.match(/^COM(\d+)$/i);
    if (comMatch) return `\\\\.\\COM${comMatch[1]}`;
    if (/^\\\\\.\\COM\d+$/i.test(trimmed)) return trimmed;

    return trimmed;
  }

  private mapPrinterType(
    type: string,
    printerTypes?: Record<string, any>,
  ): any {
    const t = (type || "epson").toLowerCase();
    if (!printerTypes) return type;
    if (t.includes("star"))
      return printerTypes.STAR || printerTypes.star || type;
    if (t.includes("generic"))
      return printerTypes.EPSON || printerTypes.epson || type;
    return printerTypes.EPSON || printerTypes.epson || type;
  }

  /**
   * Initialize printer with given configuration
   */
  async initializePrinter(
    config: PrinterConfig,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const thermalPrinterLib = await this.loadThermalLib();
      const { ThermalPrinter, PrinterTypes } = thermalPrinterLib;

      const normalizedInterface = this.normalizeInterface(config.interface);
      const printerType = this.mapPrinterType(config.type, PrinterTypes);

      this.printer = new ThermalPrinter({
        type: printerType,
        interface: normalizedInterface,
        options: {
          timeout: config.options?.timeout || 5000,
          characterSet: config.options?.characterSet || "CP437",
          removeSpecialCharacters:
            config.options?.removeSpecialCharacters || false,
        },
      });

      this.currentConfig = {
        ...config,
        interface: config.interface || normalizedInterface,
      };
      this.isInitialized = true;
      this.cancelRequested = false;

      // Validate the printer is actually reachable before reporting success.
      // (Avoids false-positive "connected" UX when the port/device is missing.)
      const connected = await this.isPrinterConnectedSafe();
      if (!connected) {
        this.isInitialized = false;
        // Keep currentConfig for status/debugging, but drop the instance.
        this.printer = null;
        return {
          success: false,
          error: "Printer not connected",
        };
      }

      return { success: true };
    } catch (error) {
      this.isInitialized = false;
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown initialization error",
      };
    }
  }

  /**
   * Enqueue raw ESC/POS bytes for printing and await completion.
   */
  async enqueuePrint(
    data: Buffer,
    jobId: string = `job_${Date.now()}`,
    timeoutMs: number = 15000,
  ): Promise<PrintResponse> {
    if (!this.printer || !this.isInitialized) {
      return {
        success: false,
        jobId,
        error: "Printer not initialized. Please connect the printer first.",
        timestamp: new Date().toISOString(),
      };
    }

    if (this.cancelRequested) {
      return {
        success: false,
        jobId,
        error: "Print cancelled",
        timestamp: new Date().toISOString(),
      };
    }

    const request: PrintRequest = { data, jobId, timeout: timeoutMs };

    return await new Promise<PrintResponse>((resolve) => {
      this.printQueue.push({ request, attempts: 0, resolve });
      void this.processQueue();
    });
  }

  /**
   * Process print queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    if (this.printQueue.length === 0) return;
    this.isProcessingQueue = true;

    try {
      while (this.printQueue.length > 0) {
        if (this.cancelRequested) {
          // Drain remaining jobs as cancelled
          const cancelledAt = new Date().toISOString();
          while (this.printQueue.length > 0) {
            const item = this.printQueue.shift();
            if (!item) continue;
            item.resolve({
              success: false,
              jobId: item.request.jobId,
              error: "Print cancelled",
              timestamp: cancelledAt,
            });
          }
          // Allow future prints without requiring reconnect
          this.cancelRequested = false;
          return;
        }

        const item = this.printQueue.shift();
        if (!item) continue;

        const { request } = item;

        try {
          await this.executePrintJob(request);
          item.resolve({
            success: true,
            jobId: request.jobId,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Print failed";
          const attempts = item.attempts + 1;

          if (attempts <= this.MAX_RETRIES && !this.cancelRequested) {
            const delay =
              this.RETRY_DELAYS_MS[
                Math.min(attempts - 1, this.RETRY_DELAYS_MS.length - 1)
              ] || 1500;
            logger.warn(
              `Print failed, retrying (${attempts}/${this.MAX_RETRIES})`,
              {
                jobId: request.jobId,
                error: message,
                delayMs: delay,
              },
            );
            await new Promise((r) => setTimeout(r, delay));
            this.printQueue.unshift({
              request,
              attempts,
              resolve: item.resolve,
            });
            continue;
          }

          item.resolve({
            success: false,
            jobId: request.jobId,
            error: message,
            timestamp: new Date().toISOString(),
          });
        }

        // Small delay between jobs
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute individual print job
   */
  private async executePrintJob(request: PrintRequest): Promise<void> {
    if (!this.printer) {
      throw new Error("Printer not available");
    }

    // Verify connection if supported by the library
    const isConnected = await this.isPrinterConnectedSafe();
    if (!isConnected) {
      throw new Error("Printer is not connected");
    }

    this.printer.clear();

    // Prefer raw() to preserve ESC/POS bytes exactly.
    if (typeof this.printer.raw === "function") {
      await this.printer.raw(request.data);
    } else if (typeof this.printer.println === "function") {
      // Fallback: interpret data as latin1 string and print line-by-line
      const printData = request.data.toString("latin1");
      printData.split("\n").forEach((line) => this.printer!.println!(line));
    } else {
      throw new Error("Printer driver does not support raw or println output");
    }

    // Execute print job with timeout
    const printPromise = this.printer.execute();
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(
        () => reject(new Error("Print timeout")),
        request.timeout || 10000,
      );
    });

    const success = await Promise.race([printPromise, timeoutPromise]);

    if (!success) {
      throw new Error("Printer execution failed");
    }
  }

  private async isPrinterConnectedSafe(): Promise<boolean> {
    if (!this.printer || !this.isInitialized) return false;
    try {
      if (typeof this.printer.isPrinterConnected === "function") {
        return await this.printer.isPrinterConnected();
      }
      if (typeof this.printer.isConnected === "function") {
        return await this.printer.isConnected();
      }
      // If the driver doesn’t expose a connection check, assume initialized = connected
      return true;
    } catch (error) {
      logger.warn("Printer connection check failed", error);
      return false;
    }
  }

  /**
   * Get current printer status
   */
  async getPrinterStatus(): Promise<PrinterStatus> {
    const status: PrinterStatus = {
      connected: false,
      interface: this.currentConfig?.interface || "none",
      type: this.currentConfig?.type || "none",
    };

    if (this.printer && this.isInitialized) {
      try {
        status.connected = await this.isPrinterConnectedSafe();
      } catch (error) {
        status.connected = false;
        status.error =
          error instanceof Error ? error.message : "Connection check failed";
      }
    }

    return status;
  }

  /**
   * Test printer with a simple test print
   */
  async testPrinter(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.printer || !this.isInitialized) {
        return { success: false, error: "Printer not initialized" };
      }

      const isConnected = await this.isPrinterConnectedSafe();
      if (!isConnected) {
        return { success: false, error: "Printer not connected" };
      }

      this.printer.clear();

      // Prefer raw ESC/POS test (avoids relying on helper methods)
      if (typeof this.printer.raw === "function") {
        const width = this.getLineWidth();
        const sep = this.repeat("=", width);
        const test =
          "\x1B\x40" + // init
          "\x1B\x61\x01" + // center
          "\x1B\x45\x01" + // bold on
          this.centerText("PRINTER TEST", width) +
          "\n" +
          "\x1B\x45\x00" + // bold off
          sep +
          "\n" +
          "\x1B\x61\x00" + // left
          `Date: ${new Date().toLocaleString("en-GB")}\n` +
          "Status: Connected\n\n" +
          "\x1B\x61\x01" +
          this.centerText("Test Successful!", width) +
          "\n" +
          "\x1B\x61\x00" +
          "\x1B\x64\x03" +
          "\x1D\x56\x42";
        await this.printer.raw(Buffer.from(test, "latin1"));
      } else if (typeof this.printer.println === "function") {
        // Fallback to library helpers if available
        this.printer.alignCenter?.();
        this.printer.setTextSize?.(1, 1);
        this.printer.println("PRINTER TEST");
        this.printer.println("=============");
        this.printer.alignLeft?.();
        this.printer.println("Date: " + new Date().toLocaleString("en-GB"));
        this.printer.println("Status: Connected");
        this.printer.newLine?.();
        this.printer.alignCenter?.();
        this.printer.println("Test Successful!");
        this.printer.newLine?.();
        this.printer.cut?.();
      } else {
        return { success: false, error: "Printer driver unsupported" };
      }

      const success = await this.printer.execute();

      if (success) {
        return { success: true };
      } else {
        return { success: false, error: "Test print execution failed" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown test error",
      };
    }
  }

  /**
   * Disconnect from printer
   */
  async disconnect(): Promise<{ success: boolean }> {
    try {
      this.cancelPrint("Disconnected");
      this.printer = null;
      this.currentConfig = null;
      this.isInitialized = false;
      this.isProcessingQueue = false;

      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }

  private cancelPrint(reason: string): void {
    this.cancelRequested = true;
    const cancelledAt = new Date().toISOString();
    while (this.printQueue.length > 0) {
      const item = this.printQueue.shift();
      if (!item) continue;
      item.resolve({
        success: false,
        jobId: item.request.jobId,
        error: reason,
        timestamp: cancelledAt,
      });
    }
    // If we are not currently processing, this cancellation is complete.
    // If we are processing, `processQueue()` will reset the flag after it drains.
    if (!this.isProcessingQueue) {
      this.cancelRequested = false;
    }
  }

  /**
   * Get available printer interfaces (COM ports, Bluetooth devices)
   * Filters out virtual/debug ports on macOS that aren't actual printers
   */
  async getAvailableInterfaces(): Promise<{
    interfaces: Array<{
      type: "usb" | "bluetooth";
      name: string;
      address: string;
    }>;
  }> {
    try {
      const interfaces: Array<{
        type: "usb" | "bluetooth";
        name: string;
        address: string;
      }> = [];

      // Patterns for macOS virtual/debug ports to exclude
      const macOSVirtualPortPatterns = [
        /debug/i,
        /wlan/i,
        /Bluetooth-Incoming/i,
        /\.SOC$/i, // System-on-chip debug
        /MALS$/i, // Mobile Asset Lock
        /BLTH$/i, // Bluetooth debug
      ];

      // Check if a port looks like a real thermal printer port
      const isLikelyRealPrinter = (port: any): boolean => {
        const path = (port.path || port.comName || "").toLowerCase();

        // On macOS, filter out virtual/debug ports
        if (process.platform === "darwin") {
          // Exclude ports matching debug patterns
          for (const pattern of macOSVirtualPortPatterns) {
            if (pattern.test(path)) return false;
          }

          // USB serial adapters typically have "usb" in the path
          // or have vendorId/productId
          if (path.includes("usbserial") || path.includes("usbmodem"))
            return true;
          if (port.vendorId && port.productId) return true;

          // cu.* ports are callout devices, tty.* are dial-in
          // For printers, cu.* is typically used
          if (path.includes("/dev/cu.")) return true;

          // Exclude generic tty.* that aren't USB
          if (path.includes("/dev/tty.") && !path.includes("usb")) return false;
        }

        // On Windows, all COM ports are potentially valid
        if (process.platform === "win32") return true;

        // On Linux, look for USB serial
        if (process.platform === "linux") {
          if (path.includes("ttyusb") || path.includes("ttyacm")) return true;
          // Also allow serial ports with vendor info
          if (port.vendorId && port.productId) return true;
        }

        return true; // Default: include
      };

      // Prefer real OS-reported serial ports
      const { SerialPort } = await import("serialport").catch(() => ({
        SerialPort: null as any,
      }));
      if (SerialPort?.list) {
        const ports = await SerialPort.list();
        ports.forEach((port: any) => {
          const path = port.path || port.comName;
          if (!path) return;

          // Filter out virtual/debug ports
          if (!isLikelyRealPrinter(port)) {
            logger.debug(`Filtered out virtual port: ${path}`);
            return;
          }

          const parts = [
            port.manufacturer,
            port.vendorId,
            port.productId,
            port.serialNumber,
          ]
            .filter(Boolean)
            .join(" ");
          interfaces.push({
            type: "usb",
            name: parts ? `${path} (${parts})` : `${path}`,
            address: path,
          });
        });
      }

      // Fallback: provide common COM ports on Windows (helps first-time setup)
      if (interfaces.length === 0 && process.platform === "win32") {
        for (let i = 1; i <= 20; i++) {
          interfaces.push({ type: "usb", name: `COM${i}`, address: `COM${i}` });
        }
      }

      // If no ports found, provide helpful message
      if (interfaces.length === 0) {
        logger.info(
          "No thermal printer ports detected. Make sure the printer is connected via USB.",
        );
      }

      return { interfaces };
    } catch (error) {
      logger.error("Failed to list printer interfaces", error);
      return { interfaces: [] };
    }
  }

  // ==========================================================
  // Receipt formatting (ESC/POS) - minimal baseline
  // ==========================================================

  private getLineWidth(): number {
    const width = this.currentConfig?.width;
    if (width && width >= 80) return 48;
    if (width && width <= 58) return 32;
    // Default to 80mm printers (Metapace T-3)
    return 48;
  }

  private repeat(char: string, count: number): string {
    return Array.from({ length: count }).fill(char).join("");
  }

  private centerText(text: string, width: number): string {
    const t = (text || "").trim();
    if (t.length >= width) return t.slice(0, width);
    const pad = Math.floor((width - t.length) / 2);
    return this.repeat(" ", pad) + t;
  }

  private wrapText(text: string, width: number): string[] {
    const t = (text || "").trim();
    if (!t) return [""];
    const words = t.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (candidate.length <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (w.length > width) {
        lines.push(w.slice(0, width));
        line = w.slice(width);
      } else {
        line = w;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  private formatLine(left: string, right: string, width: number): string {
    const l = left ?? "";
    const r = right ?? "";
    const space = Math.max(1, width - l.length - r.length);
    if (l.length + r.length >= width) {
      return `${l.slice(0, Math.max(0, width - r.length - 1))} ${r}`.slice(
        0,
        width,
      );
    }
    return `${l}${this.repeat(" ", space)}${r}`;
  }

  private async buildReceiptLatin1(transactionData: any): Promise<string> {
    const tx = transactionData as TransactionDataLike;
    if (!tx?.id || !tx?.receiptNumber) {
      throw new Error("Invalid transaction data for receipt printing");
    }

    // Best-effort business details
    let storeName = "Business";
    let storeAddress = "";
    let storePhone = "";
    let vatNumber: string | undefined;
    let headerLines: string[] | undefined;
    let dbTransaction: any | null = null;

    try {
      const db = await getDatabase();

      // Load persisted transaction (includes Viva Wallet slip fields for reprints)
      try {
        if (db.transactions?.getTransactionById) {
          dbTransaction = await db.transactions.getTransactionById(tx.id);
        }
      } catch (error) {
        logger.warn("Failed to fetch transaction record for receipt", error);
      }

      const businessIdForReceipt =
        (dbTransaction as any)?.businessId ?? tx.businessId ?? null;

      if (businessIdForReceipt) {
        const business: any =
          db.businesses?.getBusinessById?.(businessIdForReceipt);
        if (business) {
          storeName =
            business.businessName || tx.businessName || storeName || "Business";

          // Address: support multi-line address by splitting into header lines
          const rawAddress = String(business.address || "").trim();
          const addressParts = rawAddress
            ? rawAddress
                .split(/\r?\n/)
                .map((l: string) => l.trim())
                .filter(Boolean)
            : [];
          storeAddress = addressParts[0] || "";

          const extraHeaderLines: string[] = [];
          if (addressParts.length > 1)
            extraHeaderLines.push(...addressParts.slice(1));

          const cityPostal = [business.city, business.postalCode]
            .map((v: any) => String(v || "").trim())
            .filter(Boolean)
            .join(" ");
          if (cityPostal) extraHeaderLines.push(cityPostal);

          if (business.website) {
            const website = String(business.website || "").trim();
            if (website) extraHeaderLines.push(website);
          }

          headerLines = extraHeaderLines.length ? extraHeaderLines : undefined;

          storePhone = String(business.phone || "").trim();
          vatNumber = String(business.vatNumber || "").trim() || undefined;
        }
      }
    } catch (error) {
      logger.warn("Failed to fetch business details for receipt", error);
    }

    const effectiveTimestamp =
      (dbTransaction as any)?.timestamp ??
      tx.timestamp ??
      new Date().toISOString();
    const dateObj = new Date(effectiveTimestamp);
    const date = dateObj.toLocaleDateString("en-GB");
    const time = dateObj.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const paperWidthMm = this.currentConfig?.width ?? 80;
    const charactersPerLine = estimateCharactersPerLine(paperWidthMm);

    const subtotal =
      (dbTransaction as any)?.subtotal ??
      tx.subtotal ??
      Math.max(0, (tx.total ?? 0) - (tx.tax ?? 0));
    const tax = (dbTransaction as any)?.tax ?? tx.tax ?? 0;
    const total = (dbTransaction as any)?.total ?? tx.total ?? 0;

    const paymentMethod =
      (dbTransaction as any)?.paymentMethod ??
      tx.paymentMethods?.[0]?.type ??
      "cash";

    const paymentMethodUpper = (paymentMethod || "").toLowerCase();

    const computeVatSummary = () => {
      const items: Array<{ totalPrice?: number; taxAmount?: number }> =
        ((dbTransaction as any)?.items as any[]) ?? (tx.items as any[]) ?? [];

      const groups = new Map<number, { sales: number; vat: number }>();
      for (const item of items) {
        const gross = typeof item.totalPrice === "number" ? item.totalPrice : 0;
        const vat = typeof item.taxAmount === "number" ? item.taxAmount : 0;
        const net = gross - vat;
        const rate =
          net > 0 ? Math.round((vat / net) * 100) : vat > 0 ? 100 : 0;
        const current = groups.get(rate) || { sales: 0, vat: 0 };
        current.sales += Math.max(0, net);
        current.vat += Math.max(0, vat);
        groups.set(rate, current);
      }

      const rows = Array.from(groups.entries())
        .map(([ratePercent, sums]) => ({
          ratePercent,
          sales: sums.sales,
          vat: sums.vat,
        }))
        .sort((a, b) => a.ratePercent - b.ratePercent);

      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
      return rows.map((r, idx) => ({
        code: letters[idx] || "X",
        ratePercent: r.ratePercent,
        sales: r.sales,
        vat: r.vat,
      }));
    };

    const vatSummary = computeVatSummary();

    const cardSlip =
      paymentMethodUpper === "viva_wallet"
        ? {
            provider: "VIVA WALLET",
            brand: (dbTransaction as any)?.vivaWalletCardBrand ?? undefined,
            last4: (dbTransaction as any)?.vivaWalletCardLast4 ?? undefined,
            type: (dbTransaction as any)?.vivaWalletCardType ?? undefined,
            authCode: (dbTransaction as any)?.vivaWalletAuthCode ?? undefined,
            terminalId:
              (dbTransaction as any)?.vivaWalletTerminalId ?? undefined,
            terminalTransactionId:
              (dbTransaction as any)?.vivaWalletTransactionId ?? undefined,
          }
        : undefined;

    const receiptLatin1 = buildEscposReceiptLatin1({
      paperWidthMm,
      charactersPerLine,
      storeName,
      storeAddress,
      storePhone,
      vatNumber,
      headerLines,
      receiptNumber: (dbTransaction as any)?.receiptNumber ?? tx.receiptNumber,
      transactionId: tx.id,
      date,
      time,
      dateTimeIso: dateObj.toISOString(),
      cashierName: tx.cashierName,
      items: (tx.items || []).map((item) => {
        const name = item.productName || item.itemName || "Item";
        const quantity = item.quantity ?? 1;
        const unitPrice = item.unitPrice ?? 0;
        const totalPrice = item.totalPrice ?? quantity * unitPrice;
        const weight =
          item.itemType === "WEIGHT" && typeof item.weight === "number"
            ? item.weight
            : undefined;
        const unit =
          item.itemType === "WEIGHT" && item.unitOfMeasure
            ? item.unitOfMeasure
            : undefined;
        return {
          name,
          quantity,
          unitPrice,
          totalPrice,
          weight,
          unit,
        };
      }),
      subtotal,
      tax,
      total,
      paymentMethod,
      cashAmount: paymentMethodUpper === "cash" ? tx.amountPaid : undefined,
      cardAmount:
        paymentMethodUpper !== "cash"
          ? (tx.paymentMethods?.[0]?.amount ?? total)
          : undefined,
      change: paymentMethodUpper === "cash" ? tx.change : undefined,
      customerCopyLine: "*CUSTOMER COPY* - PLEASE RETAIN RECEIPT",
      cardSlip,
      vatSummary,
      barcodeValue: (dbTransaction as any)?.receiptNumber ?? tx.receiptNumber,
    });

    return receiptLatin1;
  }

  private async buildReceiptBuffer(transactionData: any): Promise<Buffer> {
    const receiptLatin1 = await this.buildReceiptLatin1(transactionData);
    return Buffer.from(receiptLatin1, "latin1");
  }
}

// Export singleton instance
export const thermalPrinterService = new ThermalPrinterService();
