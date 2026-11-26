namespace Incidencias.Application;

public sealed record AccountDto(int Id, string Name, string Username, string Role, string Area, bool Active);

public sealed record AccountInputDto(
    string Name,
    string Username,
    string? Password,
    string Role,
    string Area,
    bool? Active = null);

/// <summary>Administración de cuentas con desactivación lógica y contraseñas con hash+salt (RF-22).</summary>
public interface IAccountStore
{
    Task<IReadOnlyList<AccountDto>> GetAccountsAsync(CancellationToken ct);
    Task<AccountDto> CreateAccountAsync(AccountInputDto input, CancellationToken ct);
    Task<AccountDto?> UpdateAccountAsync(int id, AccountInputDto input, CancellationToken ct);
    Task<bool> SetAccountActiveAsync(int id, bool active, CancellationToken ct);
}
