using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PDFShelf.Api.Models
{
    public class PdfAnnotation
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; }

        /// <summary>
        /// Trecho do texto selecionado no PDF
        /// </summary>
        [Required]
        [MaxLength(2000)]
        public string SelectedText { get; set; } = string.Empty;

        /// <summary>
        /// Comentário/nota do usuário sobre o trecho (opcional)
        /// </summary>
        [MaxLength(1000)]
        public string? Content { get; set; }

        /// <summary>
        /// Cor do highlight: "yellow", "green", "pink", "blue", "orange"
        /// </summary>
        [MaxLength(30)]
        public string HighlightColor { get; set; } = "yellow";

        [Required]
        public int PageNumber { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // --- CHAVES ESTRANGEIRAS ---

        [Required]
        public Guid PdfId { get; set; }

        [ForeignKey("PdfId")]
        public Pdfs Pdf { get; set; } = null!;

        [Required]
        public Guid UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;
    }
}