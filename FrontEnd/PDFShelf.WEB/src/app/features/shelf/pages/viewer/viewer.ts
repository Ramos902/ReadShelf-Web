import {
  Component, inject, signal, OnInit, OnDestroy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { PdfService } from '../../../../core/services/pdf/pdf.service';
import { PdfDetail, Annotation, CreateAnnotationDto } from '../../../../core/models/pdfs-model';

export type ColorFilter = 'normal' | 'night' | 'sepia' | 'focus';

export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Amarelo', hex: '#FDE68A' },
  { id: 'green',  label: 'Verde',   hex: '#A7F3D0' },
  { id: 'pink',   label: 'Rosa',    hex: '#FBCFE8' },
  { id: 'blue',   label: 'Azul',    hex: '#BFDBFE' },
  { id: 'orange', label: 'Laranja', hex: '#FED7AA' },
];

@Component({
  selector: 'app-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule, PdfViewerModule],
  templateUrl: './viewer.html',
  styleUrls: ['./viewer.scss']
})
export class ViewerComponent implements OnInit, OnDestroy {
  private route      = inject(ActivatedRoute);
  private router     = inject(Router);
  private pdfService = inject(PdfService);
  private cdr        = inject(ChangeDetectorRef);

  // ── Documento ─────────────────────────────────────
  public pdf        = signal<PdfDetail | null>(null);
  public isLoading  = signal<boolean>(true);
  public hasError   = signal<boolean>(false);
  public pdfId      = '';
  public pdfSrc: Uint8Array | null = null;

  // ── Navegação e zoom ──────────────────────────────
  public currentPage = signal<number>(1);
  public totalPages  = signal<number>(0);
  public zoom        = signal<number>(1.0);

  // ── Filtros de cor ────────────────────────────────
  public colorFilter = signal<ColorFilter>('normal');
  public readonly filters: { id: ColorFilter; label: string; icon: string }[] = [
    { id: 'normal', label: 'Normal',  icon: '☀️' },
    { id: 'night',  label: 'Noturno', icon: '🌙' },
    { id: 'sepia',  label: 'Sépia',   icon: '📜' },
    { id: 'focus',  label: 'Foco',    icon: '🎯' },
  ];

  // ── Anotações ─────────────────────────────────────
  public annotations          = signal<Annotation[]>([]);
  public showAnnotationsPanel = signal<boolean>(false);
  public highlightColors      = HIGHLIGHT_COLORS;

  // Popup
  public showAnnotationPopup = signal<boolean>(false);
  public popupX              = signal<number>(0);
  public popupY              = signal<number>(0);
  public selectedText        = '';
  public selectedPage        = 1;
  public newAnnotationColor  = 'yellow';
  public newAnnotationNote   = '';
  public isSavingAnnotation  = signal<boolean>(false);

  // ── Progresso ─────────────────────────────────────
  private progressKey        = '';
  private saveProgressTimer: any = null;

  ngOnInit(): void {
    this.pdfId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.pdfId) { this.router.navigate(['/shelf']); return; }

    this.progressKey = `pdfshelf_progress_${this.pdfId}`;
    this.loadPdfMetadata();
    this.loadAnnotations();
    this.loadPdfFile();

    // Listener global de seleção de texto
    document.addEventListener('mouseup', this.handleTextSelection);
  }

  ngOnDestroy(): void {
    if (this.saveProgressTimer) clearTimeout(this.saveProgressTimer);
    this.saveProgress();
    document.removeEventListener('mouseup', this.handleTextSelection);
  }

  // ── Metadados ─────────────────────────────────────
  private loadPdfMetadata(): void {
    this.pdfService.getPdfById(this.pdfId).subscribe({
      next: (detail) => this.pdf.set(detail),
      error: () => {}
    });
  }

  // ── Carrega PDF como Uint8Array ───────────────────
  private loadPdfFile(): void {
    this.pdfService.downloadPdf(this.pdfId).subscribe({
      next: async (blob) => {
        try {
          const buffer    = await blob.arrayBuffer();
          this.pdfSrc     = new Uint8Array(buffer);
          this.isLoading.set(false);
          this.cdr.detectChanges();
        } catch {
          this.hasError.set(true);
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  // ── Callbacks do ng2-pdf-viewer ───────────────────
  onPdfLoaded(pdf: any): void {
    this.totalPages.set(pdf.numPages);

    const saved     = localStorage.getItem(this.progressKey);
    const startPage = saved ? Math.min(parseInt(saved), pdf.numPages) : 1;
    this.currentPage.set(startPage);
  }

  onPageRendered(): void {
    this.scheduleSaveProgress(this.currentPage());
  }

  onError(error: any): void {
    console.error('PDF error:', error);
    this.hasError.set(true);
  }

  // ── Navegação ─────────────────────────────────────
  prevPage(): void {
    if (this.currentPage() > 1) this.currentPage.update(p => p - 1);
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1);
  }

  // ── Zoom ──────────────────────────────────────────
  zoomIn(): void  { if (this.zoom() < 3)   this.zoom.update(z => Math.round((z + 0.2) * 10) / 10); }
  zoomOut(): void { if (this.zoom() > 0.4) this.zoom.update(z => Math.round((z - 0.2) * 10) / 10); }

  // ── Filtro ────────────────────────────────────────
  setFilter(filter: ColorFilter): void { this.colorFilter.set(filter); }

  // ── Seleção de texto ──────────────────────────────
  // Arrow function para manter o contexto do 'this'
  private handleTextSelection = (e: MouseEvent): void => {
    // Ignora cliques dentro do popup
    const popup = document.querySelector('.annotation-popup');
    if (popup?.contains(e.target as Node)) return;

    const selection = window.getSelection();
    const text      = selection?.toString().trim();

    if (!text || text.length < 3) {
      if (this.showAnnotationPopup()) {
        this.showAnnotationPopup.set(false);
        this.cdr.detectChanges();
      }
      return;
    }

    // Verifica se a seleção está dentro do viewer de PDF
    const pdfViewer = document.querySelector('pdf-viewer');
    if (!pdfViewer) return;

    const range = selection?.getRangeAt(0);
    if (!range || !pdfViewer.contains(range.commonAncestorContainer)) return;

    this.selectedText       = text;
    this.selectedPage       = this.currentPage();
    this.newAnnotationNote  = '';
    this.newAnnotationColor = 'yellow';

    // Posição do popup relativa ao pdf-area
    const pdfArea = document.querySelector('.pdf-area') as HTMLElement;
    const rect    = pdfArea?.getBoundingClientRect();

    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.popupX.set(Math.max(10, Math.min(x - 135, rect.width - 290)));
      this.popupY.set(Math.max(10, y + 10));
    }

    this.showAnnotationPopup.set(true);
    this.cdr.detectChanges();
  };

  closePopup(): void {
    this.showAnnotationPopup.set(false);
    window.getSelection()?.removeAllRanges();
    this.cdr.detectChanges();
  }

  // ── Salva anotação ────────────────────────────────
  saveAnnotation(): void {
    if (!this.selectedText || this.isSavingAnnotation()) return;
    this.isSavingAnnotation.set(true);

    const dto: CreateAnnotationDto = {
      selectedText:   this.selectedText,
      content:        this.newAnnotationNote || undefined,
      highlightColor: this.newAnnotationColor,
      pageNumber:     this.selectedPage,
    };

    this.pdfService.createAnnotation(this.pdfId, dto).subscribe({
      next: (annotation) => {
        this.annotations.update(list => [...list, annotation]);
        this.isSavingAnnotation.set(false);
        this.closePopup();
      },
      error: () => {
        this.isSavingAnnotation.set(false);
        alert('Erro ao salvar anotação.');
      }
    });
  }

  // ── Remove anotação ───────────────────────────────
  deleteAnnotation(annotation: Annotation): void {
    this.pdfService.deleteAnnotation(this.pdfId, annotation.id).subscribe({
      next: () => this.annotations.update(list => list.filter(a => a.id !== annotation.id))
    });
  }

  // ── Navega para página da anotação ────────────────
  goToAnnotationPage(annotation: Annotation): void {
    this.currentPage.set(annotation.pageNumber);
    this.showAnnotationsPanel.set(false);
  }

  // ── Carrega anotações ─────────────────────────────
  private loadAnnotations(): void {
    this.pdfService.getAnnotations(this.pdfId).subscribe({
      next: (list) => this.annotations.set(list),
      error: () => {}
    });
  }

  // ── Progresso ─────────────────────────────────────
  private scheduleSaveProgress(page: number): void {
    if (this.saveProgressTimer) clearTimeout(this.saveProgressTimer);
    this.saveProgressTimer = setTimeout(() => this.saveProgress(page), 1500);
  }

  private saveProgress(page?: number): void {
    const p = page ?? this.currentPage();
    if (this.progressKey && p > 0) localStorage.setItem(this.progressKey, p.toString());
  }

  get readingProgress(): number {
    if (!this.totalPages()) return 0;
    return Math.round((this.currentPage() / this.totalPages()) * 100);
  }

  getColorHex(colorId: string): string {
    return HIGHLIGHT_COLORS.find(c => c.id === colorId)?.hex ?? '#FDE68A';
  }

  // ── Download ──────────────────────────────────────
  downloadFile(): void {
    this.pdfService.downloadPdf(this.pdfId).subscribe({
      next: (blob) => {
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = this.pdf()?.originalFileName ?? 'documento.pdf';
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  goBack(): void { this.router.navigate(['/shelf']); }
}