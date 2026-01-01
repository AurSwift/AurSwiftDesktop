/**
 * Type declarations for jsdom
 * Temporary declaration until @types/jsdom is installed
 */

declare module "jsdom" {
  export interface JSDOMOptions {
    url?: string;
    referrer?: string;
    contentType?: string;
    includeNodeLocations?: boolean;
    storageQuota?: number;
    runScripts?: "outside-only" | "dangerously";
    resources?: "usable" | "usable-strict";
    virtualConsole?: any;
    cookieJar?: any;
    beforeParse?: (window: Window) => void;
    pretendToBeVisual?: boolean;
    windowOptions?: any;
  }

  export class JSDOM {
    constructor(html?: string | Buffer, options?: JSDOMOptions);
    readonly window: Window & typeof globalThis;
    readonly virtualConsole: any;
    readonly cookieJar: any;
    serialize(): string;
    nodeLocation(node: Node): any;
    getInternalVMContext(): any;
    reconfigure(settings: { windowTop?: Window; url?: string }): void;
  }

  export interface DOMWindow extends Window {}
}





