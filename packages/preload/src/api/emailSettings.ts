import { ipcRenderer } from "electron";

export const emailSettingsAPI = {
  get: (sessionToken: string, businessId: string) =>
    ipcRenderer.invoke("emailSettings:get", sessionToken, businessId),
  set: (
    sessionToken: string,
    businessId: string,
    payload: { gmailUser: string; gmailAppPassword: string }
  ) => ipcRenderer.invoke("emailSettings:set", sessionToken, businessId, payload),
  clear: (sessionToken: string, businessId: string) =>
    ipcRenderer.invoke("emailSettings:clear", sessionToken, businessId),
  testConnection: (sessionToken: string, businessId: string) =>
    ipcRenderer.invoke("emailSettings:testConnection", sessionToken, businessId),
};

