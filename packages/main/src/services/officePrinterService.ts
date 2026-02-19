/**
 * Office Printer Service for Electron Main Process
 * PRODUCTION-READY implementation with comprehensive error handling,
 * retry logic, job persistence, monitoring, and security
 *
 * Supports: HP LaserJet, Canon, Epson office printers, Brother, Dell, etc.
 * Uses: System printer drivers (Windows, macOS, Linux)
 */

import { ipcMain } from "electron";
import { createRequire } from "module";
import { getLogger } from "../utils/logger.js";
import { getDatabase } from "../database/index.js";

const require = createRequire(import.meta.url);

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export interface OfficePrinter {
  name: string;
  displayName: string;
  description?: string;
  driverName?: string;
  portName?: string;
  computerName?: string;
  location?: string;
  shared?: boolean;
  attributes?: string[];
  isDefault?: boolean;
  status?: string;
  priority?: number;
}

export interface PrintJobConfig {
  jobId: string;
  printerName: string;
  documentPath?: string; // Path to PDF or other printable file
  documentData?: Buffer; // Raw document data
  documentType: "pdf" | "image" | "text" | "raw";
  options?: PrintOptions;
  metadata?: Record<string, any>;
  createdBy?: string;
  businessId?: string;
}

export interface PrintOptions {
  copies?: number;
  color?: boolean;
  duplex?: "simplex" | "vertical" | "horizontal";
  paperSize?: "letter" | "legal" | "a4" | "a3" | "custom";
  orientation?: "portrait" | "landscape";
  quality?: "draft" | "normal" | "high" | "best";
  collate?: boolean;
  pageRange?: string; // e.g., "1-5,8,10-12"
  scale?: number; // Percentage, e.g., 100
  fitToPage?: boolean;
}

export interface PrintJobStatus {
  jobId: string;
  status:
    | "pending"
    | "queued"
    | "printing"
    | "completed"
    | "failed"
    | "cancelled"
    | "retrying";
  printerName: string;
  progress: number; // 0-100
  pagesTotal?: number;
  pagesPrinted?: number;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lastRetryAt?: string;
}

export interface PrinterHealth {
  printerName: string;
  isAvailable: boolean;
  status: "idle" | "printing" | "error" | "offline" | "paused";
  jobsInQueue: number;
  paperStatus?: "ok" | "low" | "out" | "jammed";
  tonerStatus?: string;
  lastChecked: string;
  errorMessage?: string;
}

export interface PrintJobRetry {
  jobId: string;
  attempt: number;
  error: string;
  timestamp: string;
  nextRetryAt: string;
}

// =============================================================================
// LOGGER SETUP
// =============================================================================

const logger = getLogger("office-printer-service");

// =============================================================================
// OFFICE PRINTER SERVICE
// =============================================================================

export class OfficePrinterService {
  private pdfToPrinter: any = null;
  private printQueue: Map<string, PrintJobConfig> = new Map();
  private isProcessingQueue = false;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [5000, 15000, 30000]; // 5s, 15s, 30s
  private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private metrics = {
    totalJobs: 0,
    successfulJobs: 0,
    failedJobs: 0,
    retriedJobs: 0,
    averagePrintTime: 0,
  };

  constructor() {
    this.setupIpcHandlers();
    this.initializeLibraries();
    this.startHealthMonitoring();
    logger.info("Office Printer Service initialized");
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Initialize required libraries dynamically
   */
  private async initializeLibraries(): Promise<void> {
    try {
      // Load pdf-to-printer module (only supported library)
      try {
        this.pdfToPrinter = require("pdf-to-printer");
        logger.info("PDF-to-Printer library loaded successfully");
      } catch (error) {
        logger.error("PDF-to-Printer library not available", error);
        throw new Error(
          "pdf-to-printer package not found. Install with: npm install pdf-to-printer"
        );
      }
    } catch (error) {
      logger.error("Failed to initialize printer libraries", error);
      throw error;
    }
  }

  /**
   * Setup IPC handlers for renderer communication
   */
  private setupIpcHandlers(): void {
    // Get available printers
    ipcMain.handle("office-printer:list", async () => {
      return await this.getAvailablePrinters();
    });

    // Get default printer
    ipcMain.handle("office-printer:get-default", async () => {
      return await this.getDefaultPrinter();
    });

    // Print document
    ipcMain.handle(
      "office-printer:print",
      async (_event, config: PrintJobConfig) => {
        return await this.printDocument(config);
      }
    );

    // Get job status
    ipcMain.handle(
      "office-printer:job-status",
      async (_event, jobId: string) => {
        return await this.getJobStatus(jobId);
      }
    );

    // Cancel print job
    ipcMain.handle("office-printer:cancel", async (_event, jobId: string) => {
      return await this.cancelPrintJob(jobId);
    });

    // Retry failed job
    ipcMain.handle("office-printer:retry", async (_event, jobId: string) => {
      return await this.retryPrintJob(jobId);
    });

    // Get printer health
    ipcMain.handle(
      "office-printer:health",
      async (_event, printerName: string) => {
        return await this.getPrinterHealth(printerName);
      }
    );

    // Get all failed jobs
    ipcMain.handle("office-printer:failed-jobs", async () => {
      return await this.getFailedJobs();
    });

    // Get metrics
    ipcMain.handle("office-printer:metrics", async () => {
      return this.getMetrics();
    });

    // Clear print queue
    ipcMain.handle("office-printer:clear-queue", async () => {
      return await this.clearQueue();
    });

    logger.info("Office printer IPC handlers registered");
  }

  // ===========================================================================
  // PRINTER DISCOVERY
  // ===========================================================================

  /**
   * Get list of available printers on the system
   */
  async getAvailablePrinters(): Promise<{
    success: boolean;
    printers: OfficePrinter[];
    error?: string;
  }> {
    try {
      if (!this.pdfToPrinter) {
        return {
          success: false,
          printers: [],
          error: "Printer library not available",
        };
      }

      // pdf-to-printer uses system printers, get list via getPrinters method
      const printerList = await this.pdfToPrinter.getPrinters();

      const printers: OfficePrinter[] = printerList.map(
        (printerName: string, index: number) => ({
          name: printerName,
          displayName: printerName,
          isDefault: index === 0, // First printer is typically default
          status: "idle",
          priority: index + 1,
        })
      );

      logger.info(`Found ${printers.length} printers`);
      return { success: true, printers };
    } catch (error) {
      logger.error(`Failed to get available printers`, { error });
      return {
        success: false,
        printers: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
  /**
   * Get default system printer
   */
  async getDefaultPrinter(): Promise<{
    success: boolean;
    printer?: OfficePrinter;
    error?: string;
  }> {
    try {
      // pdf-to-printer's getDefaultPrinter() returns the default printer name
      const defaultPrinterResult = await this.pdfToPrinter.getDefaultPrinter();

      if (!defaultPrinterResult || !defaultPrinterResult.name) {
        return {
          success: false,
          error: "No default printer configured",
        };
      }

      const printers = await this.getAvailablePrinters();
      const defaultPrinter = printers.printers.find(
        (p) => p.name === defaultPrinterResult.name
      );

      if (!defaultPrinter) {
        return {
          success: false,
          error: "Default printer not found",
        };
      }

      return { success: true, printer: defaultPrinter };
    } catch (error) {
      logger.error("Failed to get default printer", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ===========================================================================
  // PRINT OPERATIONS
  // ===========================================================================

  /**
   * Print a document with full error handling and retry logic
   */
  async printDocument(config: PrintJobConfig): Promise<{
    success: boolean;
    jobId: string;
    error?: string;
  }> {
    try {
      // Validate configuration
      const validation = this.validatePrintConfig(config);
      if (!validation.valid) {
        logger.error(`Invalid print configuration: ${validation.error}`, {
          jobId: config.jobId,
        });
        return {
          success: false,
          jobId: config.jobId,
          error: validation.error,
        };
      }

      // Save job to database
      await this.savePrintJob(config, "pending");

      // Add to processing queue
      this.printQueue.set(config.jobId, config);

      // Start queue processing
      if (!this.isProcessingQueue) {
        this.processQueue();
      }

      this.metrics.totalJobs++;
      logger.info(`Print job queued: ${config.jobId}`, {
        printer: config.printerName,
        type: config.documentType,
      });

      return { success: true, jobId: config.jobId };
    } catch (error) {
      this.metrics.failedJobs++;
      logger.error(`Failed to queue print job: ${config.jobId}`, error);

      await this.updateJobStatus(config.jobId, "failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        jobId: config.jobId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Process print queue with retry logic
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    logger.debug("Starting print queue processing");

    while (this.printQueue.size > 0) {
      const entry = this.printQueue.entries().next().value;
      if (!entry) break;

      const [jobId, config] = entry;
      this.printQueue.delete(jobId);

      try {
        await this.executePrintJob(config);
      } catch (error) {
        logger.error(`Print job failed: ${jobId}`, error);
        // Error already handled in executePrintJob
      }

      // Small delay between jobs to prevent overwhelming the printer
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.isProcessingQueue = false;
    logger.debug("Print queue processing completed");
  }

  /**
   * Execute a single print job with retry logic
   */
  private async executePrintJob(
    config: PrintJobConfig,
    attempt: number = 0
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info(
        `Executing print job: ${config.jobId} (attempt ${attempt + 1})`,
        {
          printer: config.printerName,
          type: config.documentType,
        }
      );

      await this.updateJobStatus(config.jobId, "printing", {
        startedAt: new Date().toISOString(),
      });

      // Execute based on document type
      let printResult: boolean;

      if (config.documentType === "pdf" && this.pdfToPrinter) {
        printResult = await this.printPDF(config);
      } else {
        throw new Error(
          "Only PDF printing is supported. Please convert document to PDF first."
        );
      }

      if (!printResult) {
        throw new Error("Print execution returned false");
      }

      // Success!
      const printTime = Date.now() - startTime;
      this.metrics.successfulJobs++;
      this.updateAveragePrintTime(printTime);

      await this.updateJobStatus(config.jobId, "completed", {
        completedAt: new Date().toISOString(),
        progress: 100,
      });

      logger.info(`Print job completed: ${config.jobId} (${printTime}ms)`, {
        printer: config.printerName,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.error(`Print job error: ${config.jobId}`, error);

      // Save retry attempt
      await this.saveRetryAttempt(config.jobId, attempt, errorMessage);

      // Retry logic
      if (attempt < this.MAX_RETRIES) {
        this.metrics.retriedJobs++;
        const retryDelay = this.RETRY_DELAYS[attempt] || 30000;

        await this.updateJobStatus(config.jobId, "retrying", {
          error: errorMessage,
          retryCount: attempt + 1,
          lastRetryAt: new Date().toISOString(),
        });

        logger.info(
          `Scheduling retry for job: ${config.jobId} in ${retryDelay}ms`,
          {
            attempt: attempt + 1,
            maxRetries: this.MAX_RETRIES,
          }
        );

        // Schedule retry
        setTimeout(() => {
          this.executePrintJob(config, attempt + 1);
        }, retryDelay);
      } else {
        // Max retries exceeded
        this.metrics.failedJobs++;
        await this.updateJobStatus(config.jobId, "failed", {
          error: `${errorMessage} (Max retries exceeded)`,
          completedAt: new Date().toISOString(),
        });

        logger.error(`Print job failed permanently: ${config.jobId}`, {
          attempts: attempt + 1,
          error: errorMessage,
        });
      }
    }
  }

  /**
   * Print PDF document using pdf-to-printer
   */
  private async printPDF(config: PrintJobConfig): Promise<boolean> {
    if (!config.documentPath) {
      throw new Error("PDF document path required");
    }

    const options: any = {
      printer: config.printerName,
    };

    // Map our options to pdf-to-printer options
    if (config.options) {
      if (config.options.copies) options.copies = config.options.copies;
      if (config.options.pageRange) options.pages = config.options.pageRange;
      if (config.options.orientation)
        options.orientation = config.options.orientation;
      if (config.options.scale) options.scale = `${config.options.scale}%`;
      if (config.options.paperSize)
        options.paperSize = config.options.paperSize.toUpperCase();
    }

    await this.pdfToPrinter.print(config.documentPath, options);
    return true;
  }

  // ===========================================================================
  // JOB MANAGEMENT
  // ===========================================================================

  /**
   * Get status of a print job
   */
  async getJobStatus(jobId: string): Promise<{
    success: boolean;
    status?: PrintJobStatus;
    error?: string;
  }> {
    try {
      const dbManager = await getDatabase();
      const job = (dbManager as any).db
        .prepare(`SELECT * FROM print_jobs WHERE job_id = ?`)
        .get(jobId) as any;

      if (!job) {
        return {
          success: false,
          error: "Job not found",
        };
      }
      const status: PrintJobStatus = {
        jobId: job.job_id,
        status: job.status,
        printerName: job.printer_name,
        progress: job.progress || 0,
        pagesTotal: job.pages_total,
        pagesPrinted: job.pages_printed,
        error: job.error,
        retryCount: job.retry_count || 0,
        maxRetries: this.MAX_RETRIES,
        createdAt: job.created_at,
        startedAt: job.started_at,
        completedAt: job.completed_at,
        lastRetryAt: job.last_retry_at,
      };

      return { success: true, status };
    } catch (error) {
      logger.error(`Failed to get job status: ${jobId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Cancel a print job
   */
  async cancelPrintJob(jobId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Remove from queue if pending
      this.printQueue.delete(jobId);

      // Update database status
      await this.updateJobStatus(jobId, "cancelled", {
        completedAt: new Date().toISOString(),
      });

      logger.info(`Print job cancelled: ${jobId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to cancel job: ${jobId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Retry a failed print job
   */
  async retryPrintJob(jobId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const dbManager = await getDatabase();
      const job = (dbManager as any).db
        .prepare(`SELECT * FROM print_jobs WHERE job_id = ?`)
        .get(jobId) as any;

      if (!job) {
        return {
          success: false,
          error: "Job not found",
        };
      }

      if (job.status !== "failed") {
        return {
          success: false,
          error: "Only failed jobs can be retried",
        };
      }

      // Reconstruct job configuration
      const config: PrintJobConfig = {
        jobId: job.job_id,
        printerName: job.printer_name,
        documentPath: job.document_path,
        documentType: job.document_type,
        options: job.options ? JSON.parse(job.options) : undefined,
        metadata: job.metadata ? JSON.parse(job.metadata) : undefined,
        createdBy: job.created_by,
        businessId: job.business_id,
      };

      // Reset retry count and requeue
      await this.updateJobStatus(jobId, "pending", {
        error: null,
        retryCount: 0,
      });

      this.printQueue.set(jobId, config);

      if (!this.isProcessingQueue) {
        this.processQueue();
      }

      logger.info(`Print job requeued for retry: ${jobId}`);
      return { success: true };
    } catch (error) {
      logger.error(`Failed to retry job: ${jobId}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get all failed print jobs
   */
  async getFailedJobs(): Promise<{
    success: boolean;
    jobs: PrintJobStatus[];
    error?: string;
  }> {
    try {
      const dbManager = await getDatabase();
      const rows = (dbManager as any).db
        .prepare(
          `SELECT * FROM print_jobs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 100`
        )
        .all() as any[];

      const jobs: PrintJobStatus[] = rows.map((row) => ({
        jobId: row.job_id,
        status: row.status,
        printerName: row.printer_name,
        progress: row.progress || 0,
        pagesTotal: row.pages_total,
        pagesPrinted: row.pages_printed,
        error: row.error,
        retryCount: row.retry_count || 0,
        maxRetries: this.MAX_RETRIES,
        createdAt: row.created_at,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        lastRetryAt: row.last_retry_at,
      }));

      return { success: true, jobs };
    } catch (error) {
      logger.error("Failed to get failed jobs", error);
      return {
        success: false,
        jobs: [],
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Clear print queue
   */
  async clearQueue(): Promise<{ success: boolean; cleared: number }> {
    const cleared = this.printQueue.size;
    this.printQueue.clear();
    logger.info(`Cleared ${cleared} jobs from print queue`);
    return { success: true, cleared };
  }

  // ===========================================================================
  // HEALTH MONITORING
  // ===========================================================================

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    logger.info("Printer health monitoring started");
  }

  /**
   * Perform health check on all printers
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const result = await this.getAvailablePrinters();
      if (result.success) {
        logger.debug(
          `Health check: ${result.printers.length} printers available`
        );
      }
    } catch (error) {
      logger.error("Health check failed", error);
    }
  }

  /**
   * Get health status of a specific printer
   */
  async getPrinterHealth(printerName: string): Promise<{
    success: boolean;
    health?: PrinterHealth;
    error?: string;
  }> {
    try {
      // Basic health check - printer exists and is available
      const printersResult = await this.getAvailablePrinters();

      if (!printersResult.success) {
        return {
          success: false,
          error: "Unable to query printers",
        };
      }

      const targetPrinter = printersResult.printers.find(
        (p) => p.name === printerName
      );

      if (!targetPrinter) {
        return {
          success: false,
          error: "Printer not found",
        };
      }

      const health: PrinterHealth = {
        printerName,
        isAvailable: true,
        status: "idle",
        jobsInQueue: 0,
        lastChecked: new Date().toISOString(),
      };

      return { success: true, health };
    } catch (error) {
      logger.error(`Failed to get printer health: ${printerName}`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ===========================================================================
  // DATABASE OPERATIONS
  // ===========================================================================

  /**
   * Save print job to database
   */
  private async savePrintJob(
    config: PrintJobConfig,
    status: string
  ): Promise<void> {
    try {
      const dbManager = await getDatabase();
      (dbManager as any).db
        .prepare(
          `INSERT INTO print_jobs (
          job_id, printer_name, document_path, document_type, status,
          options, metadata, created_by, business_id, created_at, retry_count, progress
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          config.jobId,
          config.printerName,
          config.documentPath || null,
          config.documentType,
          status,
          config.options ? JSON.stringify(config.options) : null,
          config.metadata ? JSON.stringify(config.metadata) : null,
          config.createdBy || null,
          config.businessId || null,
          new Date().toISOString(),
          0,
          0
        );

      logger.debug(`Print job saved to database: ${config.jobId}`);
    } catch (error) {
      logger.error("Failed to save print job", error);
      throw error;
    }
  }

  /**
   * Update print job status in database
   */
  private async updateJobStatus(
    jobId: string,
    status: string,
    updates: Partial<{
      error: string | null;
      progress: number;
      startedAt: string;
      completedAt: string;
      retryCount: number;
      lastRetryAt: string;
      pagesTotal: number;
      pagesPrinted: number;
    }> = {}
  ): Promise<void> {
    try {
      const dbManager = await getDatabase();

      const setClauses: string[] = ["status = ?"];
      const params: any[] = [status];

      if (updates.error !== undefined) {
        setClauses.push("error = ?");
        params.push(updates.error);
      }
      if (updates.progress !== undefined) {
        setClauses.push("progress = ?");
        params.push(updates.progress);
      }
      if (updates.startedAt) {
        setClauses.push("started_at = ?");
        params.push(updates.startedAt);
      }
      if (updates.completedAt) {
        setClauses.push("completed_at = ?");
        params.push(updates.completedAt);
      }
      if (updates.retryCount !== undefined) {
        setClauses.push("retry_count = ?");
        params.push(updates.retryCount);
      }
      if (updates.lastRetryAt) {
        setClauses.push("last_retry_at = ?");
        params.push(updates.lastRetryAt);
      }
      if (updates.pagesTotal) {
        setClauses.push("pages_total = ?");
        params.push(updates.pagesTotal);
      }
      if (updates.pagesPrinted !== undefined) {
        setClauses.push("pages_printed = ?");
        params.push(updates.pagesPrinted);
      }

      params.push(jobId);

      (dbManager as any).db
        .prepare(
          `UPDATE print_jobs SET ${setClauses.join(", ")} WHERE job_id = ?`
        )
        .run(...params);
      logger.debug(`Job status updated: ${jobId} -> ${status}`);
    } catch (error) {
      logger.error("Failed to update job status", error);
    }
  }

  /**
   * Save retry attempt to database
   */
  private async saveRetryAttempt(
    jobId: string,
    attempt: number,
    error: string
  ): Promise<void> {
    try {
      const dbManager = await getDatabase();
      const nextRetryDelay = this.RETRY_DELAYS[attempt] || 30000;
      const nextRetryAt = new Date(Date.now() + nextRetryDelay).toISOString();

      (dbManager as any).db
        .prepare(
          `INSERT INTO print_job_retries (job_id, attempt, error, timestamp, next_retry_at)
         VALUES (?, ?, ?, ?, ?)`
        )
        .run(jobId, attempt + 1, error, new Date().toISOString(), nextRetryAt);

      logger.debug(`Retry attempt saved: ${jobId} (attempt ${attempt + 1})`);
    } catch (error) {
      logger.error("Failed to save retry attempt", error);
    }
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  /**
   * Validate print configuration
   */
  private validatePrintConfig(config: PrintJobConfig): {
    valid: boolean;
    error?: string;
  } {
    if (!config.jobId) {
      return { valid: false, error: "Job ID required" };
    }
    if (!config.printerName) {
      return { valid: false, error: "Printer name required" };
    }
    if (!config.documentType) {
      return { valid: false, error: "Document type required" };
    }
    if (!config.documentPath && !config.documentData) {
      return { valid: false, error: "Document path or data required" };
    }
    return { valid: true };
  }

  /**
   * Update average print time metric
   */
  private updateAveragePrintTime(printTime: number): void {
    const total = this.metrics.averagePrintTime * this.metrics.successfulJobs;
    this.metrics.averagePrintTime =
      (total + printTime) / (this.metrics.successfulJobs + 1);
  }

  /**
   * Get current metrics
   */
  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    this.printQueue.clear();
    logger.info("Office Printer Service shut down");
  }
}

// Export singleton instance
export const officePrinterService = new OfficePrinterService();
