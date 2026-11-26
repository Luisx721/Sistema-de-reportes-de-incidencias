namespace Incidencias.Application;

public sealed record CategoryAdminDto(int Id, string Name, string? Description, int AreaId, string AreaName, bool Active);
public sealed record CategoryInputDto(string Name, int AreaId, string? Description, bool? Active = null);

public sealed record LocationAdminDto(int Id, string Name, string? Type, int BuildingId, string BuildingName, bool Active);
public sealed record LocationInputDto(string Name, int BuildingId, string? Type, bool? Active = null);

public sealed record BuildingAdminDto(int Id, string Name, bool Active);
public sealed record BuildingInputDto(string Name, bool? Active = null);

public sealed record AreaAdminDto(int Id, string Name, string? Type, bool Responsible, bool Active);
public sealed record AreaInputDto(string Name, string? Type, bool? Responsible = null, bool? Active = null);

public sealed record RoleOptionDto(int Id, string Name);

/// <summary>Mantiene categorías, ubicaciones, edificios y áreas con desactivación lógica (RF-23).</summary>
public interface ICatalogStore
{
    Task<IReadOnlyList<CategoryAdminDto>> GetCategoriesAsync(bool includeInactive, CancellationToken ct);
    Task<CategoryAdminDto> CreateCategoryAsync(CategoryInputDto input, CancellationToken ct);
    Task<CategoryAdminDto?> UpdateCategoryAsync(int id, CategoryInputDto input, CancellationToken ct);
    Task<bool> SetCategoryActiveAsync(int id, bool active, CancellationToken ct);

    Task<IReadOnlyList<LocationAdminDto>> GetLocationsAsync(bool includeInactive, CancellationToken ct);
    Task<LocationAdminDto> CreateLocationAsync(LocationInputDto input, CancellationToken ct);
    Task<LocationAdminDto?> UpdateLocationAsync(int id, LocationInputDto input, CancellationToken ct);
    Task<bool> SetLocationActiveAsync(int id, bool active, CancellationToken ct);

    Task<IReadOnlyList<BuildingAdminDto>> GetBuildingsAsync(bool includeInactive, CancellationToken ct);
    Task<BuildingAdminDto> CreateBuildingAsync(BuildingInputDto input, CancellationToken ct);
    Task<BuildingAdminDto?> UpdateBuildingAsync(int id, BuildingInputDto input, CancellationToken ct);
    Task<bool> SetBuildingActiveAsync(int id, bool active, CancellationToken ct);

    Task<IReadOnlyList<AreaAdminDto>> GetAreasAsync(bool includeInactive, CancellationToken ct);
    Task<AreaAdminDto> CreateAreaAsync(AreaInputDto input, CancellationToken ct);
    Task<AreaAdminDto?> UpdateAreaAsync(int id, AreaInputDto input, CancellationToken ct);
    Task<bool> SetAreaActiveAsync(int id, bool active, CancellationToken ct);

    Task<IReadOnlyList<RoleOptionDto>> GetRolesAsync(CancellationToken ct);
}
