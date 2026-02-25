import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PdfService } from '../../../../core/services/pdf/pdf.service';
import { PdfSummary } from '../../../../core/models/pdfs-model';
import { FormsModule } from '@angular/forms'; // Para o input de título se quiser

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent {
  private pdfService = inject(PdfService);

  // Signals para gerenciar o estado da tela
  public pdfs = signal<PdfSummary[]>([]);
  public isLoading = signal<boolean>(false);
  public isUploading = signal<boolean>(false);

  // Controle do input de arquivo
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

  // Chamado quando o usuário seleciona um arquivo no input
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      // Pré-preenche o título com o nome do arquivo (sem extensão)
      this.newPdfTitle = file.name.replace('.pdf', '');
    }
  }

  // Chamado ao clicar em "Enviar"
  upload() {
    if (!this.selectedFile || !this.newPdfTitle) return;

    this.isUploading.set(true);

    this.pdfService.uploadPdf(this.selectedFile, this.newPdfTitle).subscribe({
      next: (response) => {
        console.log('Upload sucesso!', response);
        this.isUploading.set(false);
        this.selectedFile = null; // Limpa seleção
        this.newPdfTitle = '';
        
        // Recarrega a lista para mostrar o novo PDF
        this.loadPdfs();
      },
      error: (err) => {
        console.error('Erro no upload', err);
        this.isUploading.set(false);
        alert('Falha no upload. Verifique o console.');
      }
    });
  }
}