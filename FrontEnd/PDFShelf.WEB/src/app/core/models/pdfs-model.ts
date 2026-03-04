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

export interface Annotation {
  id: string;
  selectedText: string;
  content?: string;
  highlightColor: string;
  pageNumber: number;
  createdAt: string;
  pdfId: string;
}

export interface CreateAnnotationDto {
  selectedText: string;
  content?: string;
  highlightColor: string;
  pageNumber: number;
}

export interface UpdateAnnotationDto {
  content?: string;
  highlightColor?: string;
}