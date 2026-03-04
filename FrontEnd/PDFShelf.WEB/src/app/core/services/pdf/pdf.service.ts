import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PdfSummary, PdfDetail, Annotation, CreateAnnotationDto, UpdateAnnotationDto } from '../../models/pdfs-model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PdfService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/pdfs`;

  // ── PDFs ──────────────────────────────────────────

  getMyPdfs(): Observable<PdfSummary[]> {
    return this.http.get<PdfSummary[]>(this.apiUrl);
  }

  getPdfById(id: string): Observable<PdfDetail> {
    return this.http.get<PdfDetail>(`${this.apiUrl}/${id}`);
  }

  downloadPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/download`, {
      responseType: 'blob'
    });
  }

  uploadPdf(file: File, title: string): Observable<unknown> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    return this.http.post(this.apiUrl, formData);
  }

  deletePdf(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  renamePdf(id: string, title: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, { title });
  }

  // ── ANOTAÇÕES ─────────────────────────────────────

  getAnnotations(pdfId: string): Observable<Annotation[]> {
    return this.http.get<Annotation[]>(`${this.apiUrl}/${pdfId}/annotations`);
  }

  createAnnotation(pdfId: string, dto: CreateAnnotationDto): Observable<Annotation> {
    return this.http.post<Annotation>(`${this.apiUrl}/${pdfId}/annotations`, dto);
  }

  updateAnnotation(pdfId: string, annotationId: string, dto: UpdateAnnotationDto): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${pdfId}/annotations/${annotationId}`, dto);
  }

  deleteAnnotation(pdfId: string, annotationId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${pdfId}/annotations/${annotationId}`);
  }
}