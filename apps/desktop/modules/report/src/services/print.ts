/**
 * Electron 프린터 서비스
 * 로컬 네트워크의 프린터를 직접 사용합니다.
 */

import type { PrinterInfo, PrintPDFResponse } from '../electron';

/**
 * Electron API 사용 가능 여부 확인
 */
export const isElectronAvailable = (): boolean => {
  return typeof window !== 'undefined' && 'electronAPI' in window;
};

/**
 * 프린터 목록 조회
 */
export const getPrinters = async (): Promise<PrinterInfo[]> => {
  if (!isElectronAvailable()) {
    console.warn('Electron API not available');
    return [];
  }

  try {
    const response = await window.electronAPI!.getPrinters();

    if (!response.success) {
      console.error('Failed to get printers:', response.error);
      return [];
    }

    return response.printers;
  } catch (error) {
    console.error('Error getting printers:', error);
    return [];
  }
};

/**
 * 기본 프린터 조회
 */
export const getDefaultPrinter = async (): Promise<string | null> => {
  if (!isElectronAvailable()) {
    return null;
  }

  try {
    const response = await window.electronAPI!.getDefaultPrinter();

    if (!response.success || !response.printer) {
      return null;
    }

    return response.printer.name;
  } catch (error) {
    console.error('Error getting default printer:', error);
    return null;
  }
};

export interface PrintRequest {
  pdfUrl: string;
  examId?: string;
  printerName?: string;
}

/**
 * PDF 프린트
 */
export const printPDF = async (request: PrintRequest): Promise<PrintPDFResponse> => {
  if (!isElectronAvailable()) {
    return {
      success: false,
      error: 'Electron API를 사용할 수 없습니다',
      details: '브라우저에서는 프린트 기능을 사용할 수 없습니다. Electron 앱을 사용하세요.',
    };
  }

  if (!request.pdfUrl) {
    return {
      success: false,
      error: 'PDF URL이 필요합니다',
      details: 'pdfUrl 파라미터를 제공하세요.',
    };
  }

  try {
    console.log('[Print Service] Printing PDF:', request.pdfUrl);

    const response = await window.electronAPI!.printPDF(
      request.pdfUrl,
      request.printerName
    );

    if (response.success) {
      console.log('[Print Service] Print successful:', response.printer);
    } else {
      console.error('[Print Service] Print failed:', response.error);
    }

    return response;
  } catch (error: any) {
    console.error('[Print Service] Error:', error);

    return {
      success: false,
      error: '프린트 요청 실패',
      details: error.message || '알 수 없는 오류가 발생했습니다.',
    };
  }
};

/**
 * 프린터 사용 가능 여부 확인
 */
export const hasPrinters = async (): Promise<boolean> => {
  const printers = await getPrinters();
  return printers.length > 0;
};
