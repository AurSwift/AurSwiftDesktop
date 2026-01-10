/**
 * Machine Fingerprint Utility (v2)
 *
 * Generates a unique, STABLE machine identifier for license activation.
 * Uses multiple system identifiers combined into a single hash for:
 * - Uniqueness: Low collision probability across different machines
 * - Stability: Doesn't change with minor hardware/software changes
 * - Privacy: Raw identifiers are hashed, never stored in plain text
 *
 * STABLE Identifiers used:
 * - Platform + architecture (very stable)
 * - CPU model (stable - only changes with CPU upgrade)
 * - Windows Product ID (very stable - tied to Windows installation)
 * - Primary disk serial number (very stable)
 * - Sorted MAC addresses (more stable than first-found)
 *
 * @version 2.0.0
 */

import { createHash } from "crypto";
import {
  hostname,
  platform,
  arch,
  cpus,
  networkInterfaces,
  totalmem,
} from "os";
import { execSync } from "child_process";
import { getLogger } from "./logger.js";

const logger = getLogger("machineFingerprint");

// Current fingerprint version
const FINGERPRINT_VERSION = "MF2";

/**
 * Get Windows Product ID (very stable identifier)
 * Only changes if Windows is reinstalled
 */
function getWindowsProductId(): string | null {
  if (platform() !== "win32") return null;

  try {
    const result = execSync(
      'reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion" /v ProductId 2>nul',
      { encoding: "utf-8", timeout: 10000 }
    );
    const match = result.match(/ProductId\s+REG_SZ\s+(.+)/);
    return match ? match[1].trim() : null;
  } catch (error) {
    logger.debug("Could not retrieve Windows Product ID:", error);
    return null;
  }
}

/**
 * Get primary disk serial number (very stable identifier)
 * Only changes if the boot drive is replaced
 */
function getDiskSerial(): string | null {
  try {
    if (platform() === "win32") {
      // Windows: Get boot drive serial
      const result = execSync(
        "wmic diskdrive where index=0 get serialnumber 2>nul",
        { encoding: "utf-8", timeout: 10000 }
      );
      const lines = result.trim().split("\n").filter(Boolean);
      const serial = lines[1]?.trim();
      return serial && serial !== "" ? serial : null;
    } else if (platform() === "darwin") {
      // macOS: Get hardware UUID
      const result = execSync(
        "ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID",
        { encoding: "utf-8", timeout: 10000 }
      );
      const match = result.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      return match ? match[1] : null;
    } else {
      // Linux: Get machine-id
      const result = execSync(
        "cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null",
        {
          encoding: "utf-8",
          timeout: 10000,
        }
      );
      return result.trim() || null;
    }
  } catch (error) {
    logger.debug("Could not retrieve disk serial:", error);
    return null;
  }
}

/**
 * Get sorted, stable MAC addresses
 * Uses alphabetical sorting to ensure consistent order regardless of
 * network adapter enumeration order. Filters out virtual adapters.
 */
function getStableMacAddresses(): string[] {
  try {
    const interfaces = networkInterfaces();
    const macs: string[] = [];

    // Virtual adapter name patterns to exclude
    const virtualPatterns = [
      /^veth/i, // Docker virtual ethernet
      /^docker/i, // Docker
      /^br-/i, // Docker bridge
      /^vmnet/i, // VMware
      /^vbox/i, // VirtualBox
      /^virbr/i, // libvirt
      /^ham/i, // Hamachi
      /^vEthernet/i, // Hyper-V
      /^Bluetooth/i, // Bluetooth adapters
      /^tun/i, // VPN tunnels (OpenVPN, etc.)
      /^tap/i, // VPN taps
      /^ppp/i, // Point-to-point (Dial-up/VPN)
      /^utun/i, // macOS VPN tunnels
      /^wg/i, // WireGuard
      /^ipsec/i, // IPSec
      /^forti/i, // Fortinet
      /^tailscale/i, // Tailscale
    ];

    for (const [name, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;

      // Skip virtual adapters
      const isVirtual = virtualPatterns.some((pattern) => pattern.test(name));
      if (isVirtual) continue;

      for (const addr of addrs) {
        // Skip internal and invalid MACs
        if (addr.internal) continue;
        if (addr.mac === "00:00:00:00:00:00") continue;
        if (!addr.mac) continue;

        // Normalize MAC format
        const normalizedMac = addr.mac.toLowerCase().replace(/-/g, ":");
        if (!macs.includes(normalizedMac)) {
          macs.push(normalizedMac);
        }
      }
    }

    // Sort alphabetically for consistent ordering
    return macs.sort();
  } catch (error) {
    logger.warn("Failed to get MAC addresses:", error);
    return [];
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
 * Stable Machine Identifiers
 * Only includes components that rarely change
 */
interface MachineIdentifiers {
  platform: string;
  arch: string;
  cpuModel: string;
  windowsProductId: string | null;
  diskSerial: string | null;
  macAddresses: string[]; // Sorted list of physical MAC addresses
}

/**
 * Collect stable machine identifiers
 * These components are chosen for maximum stability across normal usage
 */
function collectIdentifiers(): MachineIdentifiers {
  return {
    platform: platform(),
    arch: arch(),
    cpuModel: getCpuModel(),
    windowsProductId: getWindowsProductId(),
    diskSerial: getDiskSerial(),
    macAddresses: getStableMacAddresses(),
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

    // Build composite string from STABLE identifiers only
    // Priority order: most stable first
    const components: string[] = [
      // Tier 1: Very stable (hardware/OS installation)
      identifiers.diskSerial || "no-disk-serial",
      identifiers.windowsProductId || "no-product-id",

      // Tier 2: Stable (rarely changes)
      identifiers.platform,
      identifiers.arch,
      identifiers.cpuModel,

      // Tier 3: Moderately stable (sorted MAC addresses)
      // Use first 3 MACs or fewer if not available
      ...identifiers.macAddresses.slice(0, 3),
    ];

    // Ensure we have minimum components for uniqueness
    if (components.filter((c) => !c.includes("no-")).length < 3) {
      logger.warn(
        "Low stability fingerprint - few hardware identifiers available"
      );
    }

    const composite = components.join("|");

    // Create SHA-256 hash
    const hash = createHash("sha256").update(composite).digest("hex");

    // Add version prefix
    const fingerprint = `${FINGERPRINT_VERSION}-${hash}`;

    logger.debug("Generated machine fingerprint", {
      platform: identifiers.platform,
      arch: identifiers.arch,
      hasWindowsProductId: !!identifiers.windowsProductId,
      hasDiskSerial: !!identifiers.diskSerial,
      macCount: identifiers.macAddresses.length,
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
  // Format: MF2-{64 hex chars}
  const pattern = /^MF2-[a-f0-9]{64}$/;
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
  fingerprintVersion: string;
  stabilityScore: number;
} {
  const ids = collectIdentifiers();

  // Calculate stability score (0-100)
  let stabilityScore = 50; // Base score
  if (ids.diskSerial) stabilityScore += 20;
  if (ids.windowsProductId) stabilityScore += 15;
  if (ids.macAddresses.length > 0) stabilityScore += 10;
  if (ids.macAddresses.length > 1) stabilityScore += 5;

  return {
    hostname: hostname(),
    platform: ids.platform,
    arch: ids.arch,
    cpuModel: ids.cpuModel,
    totalMemoryGB: Math.round(totalmem() / (1024 * 1024 * 1024)),
    hasNetworkInterface: ids.macAddresses.length > 0,
    fingerprintVersion: FINGERPRINT_VERSION,
    stabilityScore: Math.min(100, stabilityScore),
  };
}

/**
 * Compare two fingerprints
 */
export function compareMachineFingerprints(
  stored: string,
  current: string
): { match: boolean; reason?: string } {
  // Exact match
  if (stored === current) {
    return { match: true };
  }

  return {
    match: false,
    reason:
      "Machine fingerprint has changed. This may indicate hardware changes or a different machine.",
  };
}
