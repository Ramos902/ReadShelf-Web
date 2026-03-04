using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PDFShelf.Api.Data;
using PDFShelf.Api.DTOs;
using PDFShelf.Api.Models;
using System.Security.Claims;

namespace PDFShelf.Api.Endpoints
{
    public static class AnnotationEndpoints
    {
        public static void MapAnnotationEndpoints(this WebApplication app)
        {
            var group = app.MapGroup("/api/pdfs/{pdfId:guid}/annotations")
                           .WithTags("Annotations")
                           .RequireAuthorization();

            // GET /api/pdfs/{pdfId}/annotations
            // Lista todas as anotações do usuário para um PDF
            group.MapGet("/", async (
                Guid pdfId,
                AppDbContext db,
                ClaimsPrincipal user) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                    return Results.Unauthorized();

                // Verifica que o PDF pertence ao usuário
                var pdfExists = await db.Pdfs
                    .AnyAsync(p => p.Id == pdfId && p.UserId == userId && !p.IsDeleted);

                if (!pdfExists)
                    return Results.NotFound("PDF não encontrado.");

                var annotations = await db.PdfAnnotations
                    .AsNoTracking()
                    .Where(a => a.PdfId == pdfId && a.UserId == userId)
                    .OrderBy(a => a.PageNumber)
                    .ThenBy(a => a.CreatedAt)
                    .Select(a => new AnnotationDto
                    {
                        Id           = a.Id,
                        SelectedText = a.SelectedText,
                        Content      = a.Content,
                        HighlightColor = a.HighlightColor,
                        PageNumber   = a.PageNumber,
                        CreatedAt    = a.CreatedAt,
                        PdfId        = a.PdfId
                    })
                    .ToListAsync();

                return Results.Ok(annotations);
            })
            .WithSummary("Lista anotações de um PDF")
            .WithDescription("Retorna todas as anotações do usuário autenticado para o PDF especificado.");


            // POST /api/pdfs/{pdfId}/annotations
            // Cria uma nova anotação
            group.MapPost("/", async (
                Guid pdfId,
                [FromBody] CreateAnnotationDto dto,
                AppDbContext db,
                ClaimsPrincipal user) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                    return Results.Unauthorized();

                // Verifica plano — CanAnnotate
                var userWithPlan = await db.Users
                    .Include(u => u.Plan)
                    .FirstOrDefaultAsync(u => u.Id == userId);

                if (userWithPlan?.Plan == null)
                    return Results.BadRequest("Usuário ou plano não encontrado.");

                if (!userWithPlan.Plan.CanAnnotate)
                    return Results.Forbid();

                // Verifica que o PDF pertence ao usuário
                var pdfExists = await db.Pdfs
                    .AnyAsync(p => p.Id == pdfId && p.UserId == userId && !p.IsDeleted);

                if (!pdfExists)
                    return Results.NotFound("PDF não encontrado.");

                var annotation = new PdfAnnotation
                {
                    Id             = Guid.NewGuid(),
                    SelectedText   = dto.SelectedText,
                    Content        = dto.Content,
                    HighlightColor = dto.HighlightColor,
                    PageNumber     = dto.PageNumber,
                    PdfId          = pdfId,
                    UserId         = userId
                };

                db.PdfAnnotations.Add(annotation);
                await db.SaveChangesAsync();

                var result = new AnnotationDto
                {
                    Id             = annotation.Id,
                    SelectedText   = annotation.SelectedText,
                    Content        = annotation.Content,
                    HighlightColor = annotation.HighlightColor,
                    PageNumber     = annotation.PageNumber,
                    CreatedAt      = annotation.CreatedAt,
                    PdfId          = annotation.PdfId
                };

                return Results.Created($"/api/pdfs/{pdfId}/annotations/{annotation.Id}", result);
            })
            .WithSummary("Cria uma anotação")
            .WithDescription("Cria uma nova anotação para o PDF. Requer plano com CanAnnotate = true.");


            // PUT /api/pdfs/{pdfId}/annotations/{id}
            // Edita nota ou cor de uma anotação existente
            group.MapPut("/{id:guid}", async (
                Guid pdfId,
                Guid id,
                [FromBody] UpdateAnnotationDto dto,
                AppDbContext db,
                ClaimsPrincipal user) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                    return Results.Unauthorized();

                var annotation = await db.PdfAnnotations
                    .FirstOrDefaultAsync(a => a.Id == id && a.PdfId == pdfId && a.UserId == userId);

                if (annotation == null)
                    return Results.NotFound();

                if (dto.Content != null)
                    annotation.Content = dto.Content;

                if (dto.HighlightColor != null)
                    annotation.HighlightColor = dto.HighlightColor;

                await db.SaveChangesAsync();

                return Results.NoContent();
            })
            .WithSummary("Edita uma anotação")
            .WithDescription("Atualiza o conteúdo ou a cor de highlight de uma anotação existente.");


            // DELETE /api/pdfs/{pdfId}/annotations/{id}
            // Remove uma anotação
            group.MapDelete("/{id:guid}", async (
                Guid pdfId,
                Guid id,
                AppDbContext db,
                ClaimsPrincipal user) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                    return Results.Unauthorized();

                var annotation = await db.PdfAnnotations
                    .FirstOrDefaultAsync(a => a.Id == id && a.PdfId == pdfId && a.UserId == userId);

                if (annotation == null)
                    return Results.NotFound();

                db.PdfAnnotations.Remove(annotation);
                await db.SaveChangesAsync();

                return Results.NoContent();
            })
            .WithSummary("Remove uma anotação")
            .WithDescription("Deleta permanentemente uma anotação.");
        }

        private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
        {
            var idClaim = user.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (idClaim == null || !Guid.TryParse(idClaim.Value, out userId))
            {
                userId = Guid.Empty;
                return false;
            }
            return true;
        }
    }
}