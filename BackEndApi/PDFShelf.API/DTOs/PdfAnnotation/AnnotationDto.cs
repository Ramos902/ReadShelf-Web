namespace PDFShelf.Api.DTOs
{
    /// <summary>
    /// Retornado ao listar/criar anotações
    /// </summary>
    public class AnnotationDto
    {
        public Guid Id { get; set; }
        public string SelectedText { get; set; } = string.Empty;
        public string? Content { get; set; }
        public string HighlightColor { get; set; } = "yellow";
        public int PageNumber { get; set; }
        public DateTime CreatedAt { get; set; }
        public Guid PdfId { get; set; }
    }

    /// <summary>
    /// Usado no POST para criar uma nova anotação
    /// </summary>
    public class CreateAnnotationDto
    {
        public string SelectedText { get; set; } = string.Empty;
        public string? Content { get; set; }
        public string HighlightColor { get; set; } = "yellow";
        public int PageNumber { get; set; }
    }

    /// <summary>
    /// Usado no PUT para editar nota ou cor de uma anotação
    /// </summary>
    public class UpdateAnnotationDto
    {
        public string? Content { get; set; }
        public string? HighlightColor { get; set; }
    }
}