using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PDFShelf.Api.Data;
using PDFShelf.Api.DTOs;
using PDFShelf.Api.Models;
using PDFShelf.Api.Services; // <-- Importa o serviço de armazenamento
using System.Security.Claims;

namespace PDFShelf.Api.Endpoints
{
    public static class PdfEndpoints
    {
        public static void MapPdfEndpoints(this WebApplication app)
        {
            // Agrupa todas as rotas de PDF e exige autenticação
            var group = app.MapGroup("/api/pdfs")
                             .WithTags("PDFs")
                             .RequireAuthorization(); // <-- Protege todos os endpoints de PDF

            // GET /api/pdfs
            // Retorna a "prateleira" (lista de PDFs) do usuário logado.
            group.MapGet("/", async ([FromServices] AppDbContext db, ClaimsPrincipal user) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                {
                    return Results.Unauthorized();
                }

                // Busca no banco, filtra por usuário E por "não deletado"
                var pdfs = await db.Pdfs
                    .Where(p => p.UserId == userId && !p.IsDeleted)
                    .Select(p => new PdfsSummaryDto // CORREÇÃO: PdfSummaryDto (singular)
                    {
                        Id = p.Id,
                        Title = p.Title,
                        ThumbnailUrl = p.ThumbnailUrl,
                        PageCount = p.PageCount,
                        FileSizeMB = p.FileSizeMB,
                        UploadedAt = p.UploadedAt
                    })
                    .ToListAsync();

                return Results.Ok(pdfs);
            })
            .WithSummary("Lista todos os PDFs do usuário")
            .WithDescription("Retorna uma lista (PdfSummaryDto) de todos os PDFs não deletados pertencentes ao usuário autenticado.");


            // GET /api/pdfs/{id}
            // Retorna os detalhes de um PDF específico
            group.MapGet("/{id:guid}", async (Guid id, [FromServices] AppDbContext db, ClaimsPrincipal user) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                {
                    return Results.Unauthorized();
                }

                var pdf = await db.Pdfs
                    .AsNoTracking() // Mais rápido para leitura
                    .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

                if (pdf == null)
                {
                    return Results.NotFound();
                }

                // IMPORTANTE: Verificação de segurança
                if (pdf.UserId != userId)
                {
                    return Results.NotFound();
                }

                // Mapeia para o DTO de detalhes
                var pdfDto = new PdfsDetailDto // CORREÇÃO: PdfDetailDto (singular)
                {
                    Id = pdf.Id,
                    Title = pdf.Title,
                    OriginalFileName = pdf.OriginalFileName,
                    PageCount = pdf.PageCount,
                    FileSizeMB = pdf.FileSizeMB,
                    UploadedAt = pdf.UploadedAt,
                    LastModifiedAt = pdf.LastModifiedAt
                };

                return Results.Ok(pdfDto);
            })
            .WithSummary("Busca um PDF específico")
            .WithDescription("Retorna os detalhes (PdfDetailDto) de um PDF específico, se o usuário for o dono.");


            // PUT /api/pdfs/{id}
            // Atualiza (renomeia) um PDF
            group.MapPut("/{id:guid}", async (Guid id, [FromServices] AppDbContext db, ClaimsPrincipal user, [FromBody] PdfUpdateDto updateDto) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                {
                    return Results.Unauthorized();
                }

                var pdf = await db.Pdfs
                    .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

                if (pdf == null)
                {
                    return Results.NotFound();
                }

                // Verificação de segurança
                if (pdf.UserId != userId)
                {
                    return Results.NotFound();
                }

                // Aplica as mudanças
                pdf.Title = updateDto.Title;
                pdf.LastModifiedAt = DateTime.UtcNow;

                await db.SaveChangesAsync();

                return Results.NoContent();
            })
            .WithSummary("Atualiza (renomeia) um PDF")
            .WithDescription("Atualiza o título de um PDF. O usuário deve ser o dono.");


            // DELETE /api/pdfs/{id}
            // Manda um PDF para a lixeira (Soft Delete)
            group.MapDelete("/{id:guid}", async (Guid id, [FromServices] AppDbContext db, ClaimsPrincipal user) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                {
                    return Results.Unauthorized();
                }

                var pdf = await db.Pdfs
                    .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

                if (pdf == null)
                {
                    return Results.NotFound();
                }

                // Verificação de segurança
                if (pdf.UserId != userId)
                {
                    return Results.NotFound();
                }

                // Soft Delete: Apenas marca como deletado
                pdf.IsDeleted = true;
                pdf.DeletedAt = DateTime.UtcNow;
                pdf.LastModifiedAt = DateTime.UtcNow; // Atualiza a data de modificação

                await db.SaveChangesAsync();

                return Results.NoContent();
            })
            .WithSummary("Deleta (Soft Delete) um PDF")
            .WithDescription("Marca um PDF como 'deletado'. O usuário deve ser o dono.");


            // --- ENDPOINT DE UPLOAD (POST) ---

            // POST /api/pdfs
            // Faz o upload de um novo PDF
            group.MapPost("/", async (
                // CORREÇÃO: "Empacotamos" os inputs do formulário em um único DTO.
                // Isso resolve o bug do Swashbuckle.
                [FromForm] PdfUploadRequest request,
                [FromServices] AppDbContext db,
                ClaimsPrincipal user,
                [FromServices] IFileStorageService storageService) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                {
                    return Results.Unauthorized();
                }

                // Agora, pegamos o 'file' e o 'title' de dentro do 'request'
                var file = request.File;
                var title = request.Title;

                // 1. Verificar o plano do usuário e o limite de armazenamento
                var userWithPlan = await db.Users
                                           .Include(u => u.Plan) // Carrega o plano do usuário
                                           .FirstOrDefaultAsync(u => u.Id == userId);

                if (userWithPlan?.Plan == null)
                {
                    return Results.BadRequest("Usuário ou plano não encontrado.");
                }

                double fileSizeMB = (double)file.Length / 1024 / 1024; // Converte bytes para MB
                if (userWithPlan.UsedStorageMB + fileSizeMB > userWithPlan.Plan.StorageLimitMB)
                {
                    return Results.Conflict("Limite de armazenamento excedido. Faça upgrade do seu plano.");
                }

                // 2. Extrair metadados (simples por agora)
                // TODO: Adicionar lógica real para PageCount e Thumbnail
                int pageCount = 1; // Placeholder
                string thumbnailUrl = "https://placehold.co/150x200/eee/ccc?text=PDF"; // Placeholder

                // TODO: Adicionar lógica real para FileHash (SHA256)
                string fileHash = Guid.NewGuid().ToString(); // Placeholder

                // 3. Salvar o arquivo (usando o Serviço de Armazenamento)
                // Cria um nome de arquivo único e seguro
                string fileExtension = Path.GetExtension(file.FileName);
                string uniqueFileName = $"{Guid.NewGuid()}{fileExtension}";
                string storagePath = Path.Combine(userId.ToString(), uniqueFileName); // Ex: "userid/guid.pdf"

                string savedPath = await storageService.SaveFileAsync(file, storagePath);

                // 4. Criar a entidade Pdf para o banco
                var newPdf = new Pdfs
                {
                    Id = Guid.NewGuid(), // Gera o novo Guid para o PDF
                    Title = title, // <-- Pega o título do 'request'
                    OriginalFileName = file.FileName, // <-- Pega o nome do 'file'
                    FilePath = savedPath,
                    FileHash = fileHash, // Placeholder
                    FileSizeMB = fileSizeMB,
                    PageCount = pageCount, // Placeholder
                    ThumbnailUrl = thumbnailUrl, // Placeholder
                    UserId = userId
                    // UploadedAt, LastModifiedAt, IsDeleted, etc. já têm valores padrão
                };

                // 5. Salvar no banco e atualizar o uso do usuário
                db.Pdfs.Add(newPdf);
                userWithPlan.UsedStorageMB += fileSizeMB;

                await db.SaveChangesAsync();

                // 6. Mapear para DTO de retorno
                var pdfDto = new PdfsDetailDto
                {
                    Id = newPdf.Id,
                    Title = newPdf.Title,
                    OriginalFileName = newPdf.OriginalFileName,
                    PageCount = newPdf.PageCount,
                    FileSizeMB = newPdf.FileSizeMB,
                    UploadedAt = newPdf.UploadedAt,
                    LastModifiedAt = newPdf.LastModifiedAt
                };

                // Retorna 201 Created com a localização e o objeto
                return Results.Created($"/api/pdfs/{pdfDto.Id}", pdfDto);

            })
            .WithSummary("Faz upload de um novo PDF")
            .WithDescription("Recebe um formulário com um arquivo (File) e um título (Title). Verifica o plano do usuário, salva o arquivo e cria a entrada no banco.")
            // O .Accepts<PdfUploadRequest> ainda é necessário e agora
            // bate 100% com a assinatura do método.
            .Accepts<PdfUploadRequest>("multipart/form-data")
            .DisableAntiforgery(); // Necessário para testes com Swagger/Postman

            group.MapGet("/{id:guid}/download", async (
                Guid id,
                AppDbContext db,
                ClaimsPrincipal user,
                IWebHostEnvironment env) =>
            {
                if (!TryGetUserId(user, out Guid userId))
                    return Results.Unauthorized();

                // Busca o PDF no banco
                var pdf = await db.Pdfs
                    .AsNoTracking()
                    .FirstOrDefaultAsync(p => p.Id == id && !p.IsDeleted);

                if (pdf == null)
                    return Results.NotFound();

                // Segurança: só o dono pode baixar
                if (pdf.UserId != userId)
                    return Results.Forbid();

                // Monta o caminho físico do arquivo
                var uploadsDir = Path.Combine(env.WebRootPath ?? "wwwroot", "uploads");
                var fullPath = Path.Combine(uploadsDir, pdf.FilePath);

                if (!File.Exists(fullPath))
                    return Results.NotFound("Arquivo não encontrado no servidor.");

                // Retorna o arquivo como stream (inline = abre no browser, não força download)
                var stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read);
                return Results.File(
                    fileStream: stream,
                    contentType: "application/pdf",
                    fileDownloadName: pdf.OriginalFileName,
                    enableRangeProcessing: true // Permite navegação por páginas no iframe
                );
            })
            .WithSummary("Faz o download/stream de um PDF")
            .WithDescription("Retorna o arquivo PDF como stream. Usado pelo visualizador no frontend.");
        }



        /// <summary>
        /// Função helper privada para extrair o Guid do UserId do token (ClaimsPrincipal)
        /// </summary>
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