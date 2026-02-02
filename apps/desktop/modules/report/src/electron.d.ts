/**
 * Electron API 타입 정의
 */

export interface PrinterInfo {
  name: string;
  displayName: string;
  description?: string;
  status?: number;
  isDefault?: boolean;
  options?: Record<string, any>;
}

export interface GetPrintersResponse {
  success: boolean;
  printers: PrinterInfo[];
  error?: string;
}

export interface GetDefaultPrinterResponse {
  success: boolean;
  printer: {
    name: string;
    displayName: string;
  } | null;
  error?: string;
}

export interface PrintPDFResponse {
  success: boolean;
  message?: string;
  printer?: string;
  error?: string;
  details?: string;
}

export interface NotionFetchResponse {
  error: boolean;
  status?: number;
  data?: any;
  message?: string;
}

export interface ElectronAPI {
  getPrinters: () => Promise<GetPrintersResponse>;
  getDefaultPrinter: () => Promise<GetDefaultPrinterResponse>;
  printPDF: (pdfUrl: string, printerName?: string) => Promise<PrintPDFResponse>;
  notionFetch: (endpoint: string, options: any) => Promise<NotionFetchResponse>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
