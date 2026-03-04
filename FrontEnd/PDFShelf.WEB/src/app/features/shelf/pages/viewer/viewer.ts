import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { PdfService } from '../../../../core/services/pdf/pdf.service';
import { PdfDetail } from '../../../../core/models/pdfs-model';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './viewer.html',
  styleUrls: ['./viewer.scss']
})
export class ViewerComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pdfService = inject(PdfService);
  private sanitizer = inject(DomSanitizer);

  public pdf = signal<PdfDetail | null>(null);
  public isLoading = signal<boolean>(true);
  public hasError = signal<boolean>(false);
  public pdfUrl = signal<SafeResourceUrl | null>(null);
  public objectUrl: string | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/shelf']);
      return;
    }
    this.loadPdf(id);
  }

  ngOnDestroy(): void {
    // Libera memória do blob URL
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
  }

  loadPdf(id: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    // Carrega metadados
    this.pdfService.getPdfById(id).subscribe({
      next: (detail) => {
        this.pdf.set(detail);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });

    // Carrega o arquivo PDF como blob
    this.pdfService.downloadPdf(id).subscribe({
      next: (blob) => {
        this.objectUrl = URL.createObjectURL(blob);
        this.pdfUrl.set(
          this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl)
        );
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/shelf']);
  }

  downloadFile(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.pdfService.downloadPdf(id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.pdf()?.originalFileName ?? 'documento.pdf';
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }
}