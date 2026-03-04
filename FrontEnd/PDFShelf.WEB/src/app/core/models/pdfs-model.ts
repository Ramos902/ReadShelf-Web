export interface PdfSummary {
  id: string;
  title: string;
  thumbnailUrl: string;
  pageCount: number;
  fileSizeMB: number;
  uploadedAt: string;
}

export interface PdfDetail {
  id: string;
  title: string;
  originalFileName: string;
  pageCount: number;
  fileSizeMB: number;
  uploadedAt: string;
  lastModifiedAt: string;
}