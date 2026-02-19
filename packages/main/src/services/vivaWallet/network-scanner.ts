/**
 * Network Scanner for Viva Wallet Terminal Discovery
 * Scans local network for Viva Wallet terminals using IP range scanning
 */

import { getLogger } from "../../utils/logger.js";
import type { Terminal, TerminalStatusResponse } from "./types.js";

const logger = getLogger("NetworkScanner");

// =============================================================================
// TYPES
// =============================================================================

export interface ScanProgress {
  scanned: number;
  total: number;
  percentage: number;
  terminalsFound: number;
}

// =============================================================================
// NETWORK SCANNER
// =============================================================================

export class NetworkScanner {
  private readonly SCAN_TIMEOUT = 5000; // 5 seconds per IP
  private readonly MAX_CONCURRENT = 10; // Scan 10 IPs at a time
  private readonly DEFAULT_PORTS = [8080, 8081, 3000]; // Common Viva Wallet ports

  /**
   * Scan IP range for Viva Wallet terminals
   */
  async scanIPRange(
    ipRange: string,
    ports: number[] = this.DEFAULT_PORTS,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<Terminal[]> {
    const terminals: Terminal[] = [];
    const ipAddresses = this.parseIPRange(ipRange);
    const totalIPs = ipAddresses.length;
    let scannedCount = 0;

    logger.info(`Starting network scan: ${ipRange} (${totalIPs} IPs)`);

    // Process IPs in batches
    for (let i = 0; i < ipAddresses.length; i += this.MAX_CONCURRENT) {
      const batch = ipAddresses.slice(i, i + this.MAX_CONCURRENT);

      const batchResults = await Promise.allSettled(
        batch.map((ip) => this.scanIP(ip, ports))
      );

      for (const result of batchResults) {
        scannedCount++;

        if (result.status === "fulfilled" && result.value) {
          terminals.push(result.value);
          logger.debug(
            `Terminal found at ${result.value.ipAddress}:${result.value.port}`
          );
        }

        // Report progress
        if (onProgress) {
          onProgress({
            scanned: scannedCount,
            total: totalIPs,
            percentage: (scannedCount / totalIPs) * 100,
            terminalsFound: terminals.length,
          });
        }
      }
    }

    logger.info(`Network scan complete. Found ${terminals.length} terminal(s)`);
    return terminals;
  }

  /**
   * Scan a single IP address for terminals on multiple ports
   */
  private async scanIP(ip: string, ports: number[]): Promise<Terminal | null> {
    for (const port of ports) {
      try {
        const terminal = await this.checkTerminal(ip, port);
        if (terminal) {
          return terminal;
        }
      } catch (error) {
        // Continue to next port
      }
    }
    return null;
  }

  /**
   * Check if a terminal exists at the given IP and port
   */
  private async checkTerminal(
    ip: string,
    port: number
  ): Promise<Terminal | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.SCAN_TIMEOUT);

      try {
        const response = await fetch(`http://${ip}:${port}/api/status`, {
          method: "GET",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        clearTimeout(timeoutId);

        // Accept 200 (OK) or 401 (Unauthorized - means terminal found but auth required)
        if (response.status === 200 || response.status === 401) {
          let statusData: TerminalStatusResponse | null = null;

          if (response.status === 200) {
            statusData = await response.json();
          }

          return this.createTerminalFromResponse(ip, port, statusData);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        // Network error - terminal not found at this IP/port
        if (error instanceof Error && error.name !== "AbortError") {
          // Log unexpected errors
          logger.debug(`Check failed for ${ip}:${port}: ${error.message}`);
        }
      }
    } catch (error) {
      // Terminal not found at this IP/port
    }

    return null;
  }

  /**
   * Create Terminal object from API response
   */
  private createTerminalFromResponse(
    ip: string,
    port: number,
    statusData: TerminalStatusResponse | null
  ): Terminal {
    const terminalId = statusData?.terminalId || `${ip}:${port}`;

    return {
      id: terminalId,
      name: statusData?.terminalId || `Terminal ${ip}:${port}`,
      ipAddress: ip,
      port: port,
      status: statusData?.status === "ready" ? "online" : "offline",
      firmwareVersion: statusData?.firmwareVersion,
      capabilities: statusData?.capabilities || [],
      lastSeen: new Date(),
      connectionType: "wifi",
      terminalType:
        statusData?.deviceType === "mobile" ? "device-based" : "dedicated",
      deviceInfo: statusData?.platform
        ? {
            platform: this.detectPlatform(statusData.platform),
          }
        : undefined,
      paymentCapabilities: {
        supportsNFC: statusData?.nfcEnabled || false,
        supportsCardReader: statusData?.hasCardReader || false,
        supportsChip: statusData?.capabilities?.includes("chip") || false,
        supportsSwipe: statusData?.capabilities?.includes("swipe") || false,
        supportsTap:
          statusData?.capabilities?.includes("tap") ||
          statusData?.nfcEnabled ||
          false,
      },
    };
  }

  /**
   * Detect platform from platform string
   */
  private detectPlatform(platform: string): "android" | "ios" | "paydroid" {
    const platformLower = platform.toLowerCase();
    if (platformLower.includes("paydroid")) {
      return "paydroid";
    }
    if (platformLower.includes("ios")) {
      return "ios";
    }
    return "android"; // Default to android for Android devices
  }

  /**
   * Parse IP range (CIDR notation or simple range)
   * Examples: "192.168.1.0/24", "192.168.1.1-192.168.1.254"
   */
  private parseIPRange(ipRange: string): string[] {
    // Check if it's CIDR notation
    if (ipRange.includes("/")) {
      return this.parseCIDR(ipRange);
    }

    // Check if it's a range
    if (ipRange.includes("-")) {
      return this.parseIPRangeNotation(ipRange);
    }

    // Single IP
    if (this.isValidIP(ipRange)) {
      return [ipRange];
    }

    logger.warn(`Invalid IP range format: ${ipRange}`);
    return [];
  }

  /**
   * Parse CIDR notation (e.g., "192.168.1.0/24")
   */
  private parseCIDR(cidr: string): string[] {
    const [network, prefixLength] = cidr.split("/");
    const prefix = parseInt(prefixLength, 10);

    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      logger.warn(`Invalid CIDR prefix length: ${prefixLength}`);
      return [];
    }

    if (!this.isValidIP(network)) {
      logger.warn(`Invalid network address: ${network}`);
      return [];
    }

    const ips: string[] = [];
    const networkParts = network.split(".").map(Number);
    const hostBits = 32 - prefix;
    const numHosts = Math.pow(2, hostBits);

    // Calculate network address
    const networkNumber =
      (networkParts[0] << 24) |
      (networkParts[1] << 16) |
      (networkParts[2] << 8) |
      networkParts[3];
    const mask = (0xffffffff << hostBits) >>> 0;
    const networkAddr = (networkNumber & mask) >>> 0;

    // Generate IPs (skip network and broadcast addresses for /24 and smaller)
    for (let i = 1; i < numHosts - 1 && i < 256; i++) {
      const ipNumber = networkAddr + i;
      const ip =
        ((ipNumber >>> 24) & 0xff) +
        "." +
        ((ipNumber >>> 16) & 0xff) +
        "." +
        ((ipNumber >>> 8) & 0xff) +
        "." +
        (ipNumber & 0xff);
      ips.push(ip);
    }

    return ips;
  }

  /**
   * Parse IP range notation (e.g., "192.168.1.1-192.168.1.254")
   */
  private parseIPRangeNotation(range: string): string[] {
    const [start, end] = range.split("-").map((s) => s.trim());

    if (!this.isValidIP(start) || !this.isValidIP(end)) {
      logger.warn(`Invalid IP range: ${range}`);
      return [];
    }

    const ips: string[] = [];
    const startParts = start.split(".").map(Number);
    const endParts = end.split(".").map(Number);

    const startNum =
      (startParts[0] << 24) |
      (startParts[1] << 16) |
      (startParts[2] << 8) |
      startParts[3];
    const endNum =
      (endParts[0] << 24) |
      (endParts[1] << 16) |
      (endParts[2] << 8) |
      endParts[3];

    for (
      let ipNum = startNum;
      ipNum <= endNum && ipNum <= startNum + 255;
      ipNum++
    ) {
      const ip =
        ((ipNum >>> 24) & 0xff) +
        "." +
        ((ipNum >>> 16) & 0xff) +
        "." +
        ((ipNum >>> 8) & 0xff) +
        "." +
        (ipNum & 0xff);
      ips.push(ip);
    }

    return ips;
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Get local network IP range automatically
   */
  async getLocalNetworkRange(): Promise<string | null> {
    try {
      const os = await import("os");
      const interfaces = os.networkInterfaces();

      for (const name of Object.keys(interfaces)) {
        const iface = interfaces[name];
        if (!iface) continue;

        for (const addr of iface) {
          // Look for IPv4 addresses that are not loopback
          if (addr.family === "IPv4" && !addr.internal) {
            // Create /24 CIDR for the network
            const parts = addr.address.split(".").map(Number);
            return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
          }
        }
      }
    } catch (error) {
      logger.error("Failed to get local network range:", error);
    }

    return null;
  }
}
