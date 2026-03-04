import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PdfService } from '../../../../core/services/pdf/pdf.service';
import { PdfSummary } from '../../../../core/models/pdfs-model';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent {
  private pdfService = inject(PdfService);
  private router = inject(Router);

  public pdfs = signal<PdfSummary[]>([]);
  public isLoading = signal<boolean>(false);
  public isUploading = signal<boolean>(false);
  public deletingId = signal<string | null>(null);

  public selectedFile: File | null = null;
  public newPdfTitle: string = '';

  constructor() {
    this.loadPdfs();
  }

  loadPdfs() {
    this.isLoading.set(true);
    this.pdfService.getMyPdfs().subscribe({
      next: (data) => {
        this.pdfs.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar PDFs', err);
        this.isLoading.set(false);
      }
    });
  }

  openPdf(id: string) {
    this.router.navigate(['/shelf/viewer', id]);
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.newPdfTitle = file.name.replace('.pdf', '');
    }
  }

  upload() {
    if (!this.selectedFile || !this.newPdfTitle) return;

    this.isUploading.set(true);

    this.pdfService.uploadPdf(this.selectedFile, this.newPdfTitle).subscribe({
      next: () => {
        this.isUploading.set(false);
        this.selectedFile = null;
        this.newPdfTitle = '';
        this.loadPdfs();
      },
      error: (err) => {
        console.error('Erro no upload', err);
        this.isUploading.set(false);
        alert('Falha no upload. Verifique o console.');
      }
    });
  }

  deletePdf(event: MouseEvent, id: string) {
    // Impede que o clique no botão de delete abra o viewer
    event.stopPropagation();

    if (!confirm('Tem certeza que deseja excluir este PDF?')) return;

    this.deletingId.set(id);

    this.pdfService.deletePdf(id).subscribe({
      next: () => {
        // Remove da lista sem precisar recarregar
        this.pdfs.update(list => list.filter(p => p.id !== id));
        this.deletingId.set(null);
      },
      error: (err) => {
        console.error('Erro ao deletar', err);
        this.deletingId.set(null);
        alert('Falha ao excluir o PDF.');
      }
    });
  }
}