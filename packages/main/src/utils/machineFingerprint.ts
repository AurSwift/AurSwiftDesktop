/**
 * Machine Fingerprint Utility
 *
 * Generates a unique, stable machine identifier for license activation.
 * Uses multiple system identifiers combined into a single hash for:
 * - Uniqueness: Low collision probability across different machines
 * - Stability: Doesn't change unless major hardware is replaced
 * - Privacy: Raw identifiers are hashed, never stored in plain text
 *
 * Identifiers used:
 * - OS hostname
 * - Platform + architecture
 * - CPU model
 * - Total memory
 * - MAC address (primary network interface)
 * - Home directory path
 *
 * Note: We avoid CPU serial/motherboard serial as they require elevated
 * permissions on many systems and can fail silently.
 */

import { createHash } from "crypto";
import { hostname, platform, arch, cpus, totalmem, networkInterfaces, homedir } from "os";
import { getLogger } from "./logger.js";

const logger = getLogger("machineFingerprint");

/**
 * Get primary MAC address (first non-internal, non-loopback interface)
 */
function getPrimaryMacAddress(): string | null {
  try {
    const interfaces = networkInterfaces();

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;

      for (const addr of addrs) {
        // Skip internal and loopback addresses
        if (addr.internal) continue;
        if (addr.mac === "00:00:00:00:00:00") continue;

        // Return first valid MAC address
        return addr.mac;
      }
    }

    return null;
  } catch (error) {
    logger.warn("Failed to get MAC address:", error);
    return null;
  }
}

/**
 * Get CPU model string
 */
function getCpuModel(): string {
  try {
    const cpuInfo = cpus();
    if (cpuInfo && cpuInfo.length > 0) {
      return cpuInfo[0].model;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Collect all machine identifiers
 */
interface MachineIdentifiers {
  hostname: string;
  platform: string;
  arch: string;
  cpuModel: string;
  totalMemory: string;
  macAddress: string | null;
  homeDir: string;
}

function collectIdentifiers(): MachineIdentifiers {
  return {
    hostname: hostname(),
    platform: platform(),
    arch: arch(),
    cpuModel: getCpuModel(),
    totalMemory: totalmem().toString(),
    macAddress: getPrimaryMacAddress(),
    homeDir: homedir(),
  };
}

/**
 * Generate machine fingerprint hash
 *
 * Returns a stable, unique identifier for this machine.
 * The hash is deterministic - same machine always produces same hash.
 */
export function generateMachineFingerprint(): string {
  try {
    const identifiers = collectIdentifiers();

    // Build composite string from identifiers
    const components = [
      identifiers.hostname,
      identifiers.platform,
      identifiers.arch,
      identifiers.cpuModel,
      identifiers.totalMemory,
      identifiers.macAddress || "no-mac",
      identifiers.homeDir,
    ];

    const composite = components.join("|");

    // Create SHA-256 hash
    const hash = createHash("sha256").update(composite).digest("hex");

    // Add version prefix for future compatibility
    const fingerprint = `MF1-${hash}`;

    logger.debug("Generated machine fingerprint", {
      hostname: identifiers.hostname,
      platform: identifiers.platform,
      arch: identifiers.arch,
      hasMAC: !!identifiers.macAddress,
    });

    return fingerprint;
  } catch (error) {
    logger.error("Failed to generate machine fingerprint:", error);
    throw new Error("Failed to generate machine fingerprint");
  }
}

/**
 * Validate machine fingerprint format
 */
export function validateMachineFingerprintFormat(fingerprint: string): boolean {
  // Format: MF1-{64 hex chars}
  const pattern = /^MF1-[a-f0-9]{64}$/;
  return pattern.test(fingerprint);
}

/**
 * Get machine identifiers (for display in settings/diagnostics)
 * Returns sanitized info safe for display
 */
export function getMachineInfo(): {
  hostname: string;
  platform: string;
  arch: string;
  cpuModel: string;
  totalMemoryGB: number;
  hasNetworkInterface: boolean;
} {
  const identifiers = collectIdentifiers();

  return {
    hostname: identifiers.hostname,
    platform: identifiers.platform,
    arch: identifiers.arch,
    cpuModel: identifiers.cpuModel,
    totalMemoryGB: Math.round(parseInt(identifiers.totalMemory) / (1024 * 1024 * 1024)),
    hasNetworkInterface: !!identifiers.macAddress,
  };
}

/**
 * Compare two fingerprints with tolerance for minor changes
 *
 * This allows for some hardware changes without requiring reactivation.
 * Currently just does exact match - future enhancement could allow
 * partial matches if certain components change.
 */
export function compareMachineFingerprints(
  stored: string,
  current: string
): { match: boolean; reason?: string } {
  if (stored === current) {
    return { match: true };
  }

  // Future: Could implement fuzzy matching here
  // e.g., if only hostname changed, allow it

  return {
    match: false,
    reason: "Machine fingerprint has changed. This may indicate hardware changes.",
  };
}
