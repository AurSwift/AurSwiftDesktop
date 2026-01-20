import type { APIResponse } from "./common";

export type EmailSettingsGetData = {
  gmailUser: string | null;
  configured: boolean;
  encryptionAvailable: boolean;
  lastUpdatedAt?: string | null;
};

export type EmailSettingsSetData = {
  configured: boolean;
  degraded: boolean;
};

export interface EmailSettingsAPI {
  get: (sessionToken: string, businessId: string) => Promise<APIResponse<EmailSettingsGetData>>;
  set: (
    sessionToken: string,
    businessId: string,
    payload: {
    gmailUser: string;
    gmailAppPassword: string;
  }) => Promise<APIResponse<EmailSettingsSetData>>;
  clear: (sessionToken: string, businessId: string) => Promise<APIResponse<undefined>>;
  testConnection: (sessionToken: string, businessId: string) => Promise<APIResponse<undefined>>;
}

