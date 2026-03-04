using Microsoft.EntityFrameworkCore;
using PDFShelf.Api.Models;

namespace PDFShelf.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<Pdfs> Pdfs => Set<Pdfs>();
    public DbSet<PdfAnnotation> PdfAnnotations => Set<PdfAnnotation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // --- Seeds de Planos ---
        modelBuilder.Entity<Plan>().HasData(
            new Plan { Id = 1, Name = "Free", StorageLimitMB = 30, CanAnnotate = true, CanShare = false, MonthlyPrice = null, IsActive = true },
            new Plan { Id = 2, Name = "Basic", StorageLimitMB = 200, CanAnnotate = true, CanShare = true, MonthlyPrice = 19.90, IsActive = true },
            new Plan { Id = 3, Name = "Premium", StorageLimitMB = 1000, CanAnnotate = true, CanShare = true, MonthlyPrice = 39.90, IsActive = true }
        );

        // --- Índice único no e-mail ---
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        // --- Relacionamentos de PdfAnnotation ---
        modelBuilder.Entity<PdfAnnotation>()
            .HasOne(a => a.Pdf)
            .WithMany()
            .HasForeignKey(a => a.PdfId)
            .OnDelete(DeleteBehavior.Cascade); // Deletar PDF apaga as anotações

        modelBuilder.Entity<PdfAnnotation>()
            .HasOne(a => a.User)
            .WithMany()
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}