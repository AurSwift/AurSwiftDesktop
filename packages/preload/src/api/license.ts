import { ipcRenderer } from "electron";

/**
 * License API for renderer process
 *
 * Provides methods for license activation, validation, and status checking.
 */
export const licenseAPI = {
  /**
   * Get current license activation status
   */
  getStatus: () => ipcRenderer.invoke("license:getStatus"),

  /**
   * Activate a license key
   * @param licenseKey - The license key to activate
   * @param terminalName - Optional name for this terminal
   */
  activate: (licenseKey: string, terminalName?: string) =>
    ipcRenderer.invoke("license:activate", licenseKey, terminalName),

  /**
   * Validate the current license (online check)
   */
  validate: () => ipcRenderer.invoke("license:validate"),

  /**
   * Deactivate the current license
   */
  deactivate: () => ipcRenderer.invoke("license:deactivate"),

  /**
   * Get machine info for display
   */
  getMachineInfo: () => ipcRenderer.invoke("license:getMachineInfo"),

  /**
   * Check if a feature is enabled for the current plan
   * @param featureName - Name of the feature to check
   */
  hasFeature: (featureName: string) =>
    ipcRenderer.invoke("license:hasFeature", featureName),

  /**
   * Send a manual heartbeat to the license server
   */
  sendHeartbeat: () => ipcRenderer.invoke("license:sendHeartbeat"),

  /**
   * Retry connection to license server (manual reconnect attempt)
   * Useful when app is in offline mode and user wants to try reconnecting
   */
  retryConnection: () => ipcRenderer.invoke("license:retryConnection"),

  /**
   * Initialize the license system (called on app start)
   */
  initialize: () => ipcRenderer.invoke("license:initialize"),

  /**
   * Listen for license events (disabled, reactivated, etc.)
   * @param callback - Function to call when license events occur
   * @returns Cleanup function to remove the listener
   */
  onLicenseEvent: (
    callback: (event: string, data: any) => void
  ): (() => void) => {
    const channels = [
      "license:disabled",
      "license:reactivated",
      "license:planChanged",
      "license:cancelScheduled",
      "license:sseConnected",
    ];

    const handlers = channels.map((channel) => {
      const handler = (_event: Electron.IpcRendererEvent, data: any) => {
        callback(channel, data);
      };
      ipcRenderer.on(channel, handler);
      return { channel, handler };
    });

    // Return cleanup function
    return () => {
      handlers.forEach(({ channel, handler }) => {
        ipcRenderer.removeListener(channel, handler);
      });
    };
  },
};
