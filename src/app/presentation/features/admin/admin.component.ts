import { BackupService } from '../../../application/services/backup.service';
import { ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminCatalogItem, AdminService } from '../../../application/services/admin.service';
import { ToastService } from '../../../application/services/toast.service';
import { Account } from '../../../domain/models/incident.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent implements OnInit {
  private changeDetector = inject(ChangeDetectorRef);

  backup = inject(BackupService);
  backupBusy = false;
  backupStatus = '';
  backupFile: File | null = null;
  adminService = inject(AdminService);
  private toastService = inject(ToastService);

  activeTab: 'cuentas' | 'catalogos' | 'respaldo' = 'cuentas';
  catalogSubtab: 'categories' | 'locations' = 'categories';

  accountSearch = '';
  accountFilterRole = '';
  accountFilterStatus = '';

  showModalAccount = false;
  editingAccount: Account | null = null;
  accountForm = { name: '', username: '', password: '', role: '', area: '' };
  accountErrors = { name: '', username: '', password: '', role: '', area: '' };
  accountPendingDeactivation: Account | null = null;

  showModalCatalog = false;
  editingCatalogItem: AdminCatalogItem | null = null;
  catalogFormName = '';
  catalogFormParentId = 0;
  catalogError = '';
  catalogPendingDeactivation: AdminCatalogItem | null = null;

  showModalRestore = false;

  async ngOnInit(): Promise<void> {
    try {
      await this.adminService.loadAll();
    } catch {
      this.toastService.show('No se pudieron cargar los datos administrativos desde la API.');
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showModalAccount) this.showModalAccount = false;
    if (this.accountPendingDeactivation) this.accountPendingDeactivation = null;
    if (this.showModalCatalog) this.showModalCatalog = false;
    if (this.catalogPendingDeactivation) this.catalogPendingDeactivation = null;
    if (this.showModalRestore) this.showModalRestore = false;
    this.changeDetector.markForCheck();
  }

  get filteredAccounts(): Account[] {
    const s = this.accountSearch.trim().toLowerCase();
    const role = this.accountFilterRole;
    const status = this.accountFilterStatus;

    return this.adminService.accounts().filter((acc) => {
      const matchSearch =
        !s || acc.name.toLowerCase().includes(s) || acc.username.toLowerCase().includes(s);
      const matchRole = !role || acc.role === role;
      const matchStatus =
        !status || (status === 'activa' && acc.active) || (status === 'desactivada' && !acc.active);
      return matchSearch && matchRole && matchStatus;
    });
  }

  get activeCatalogList(): AdminCatalogItem[] {
    return this.catalogSubtab === 'categories'
      ? this.adminService.categories()
      : this.adminService.locations();
  }

  clearAccountFilters(): void {
    this.accountSearch = '';
    this.accountFilterRole = '';
    this.accountFilterStatus = '';
  }

  openNewAccountModal(): void {
    this.editingAccount = null;
    this.accountForm = { name: '', username: '', password: '', role: '', area: '' };
    this.accountErrors = { name: '', username: '', password: '', role: '', area: '' };
    this.showModalAccount = true;
  }

  openEditAccountModal(acc: Account): void {
    this.editingAccount = acc;
    this.accountForm = {
      name: acc.name,
      username: acc.username,
      password: '',
      role: acc.role,
      area: acc.area,
    };
    this.accountErrors = { name: '', username: '', password: '', role: '', area: '' };
    this.showModalAccount = true;
  }

  async saveAccountForm(): Promise<void> {
    try {
      const name = this.accountForm.name.trim();
      const username = this.accountForm.username.trim();
      const password = this.accountForm.password.trim();
      const role = this.accountForm.role;
      const area = this.accountForm.area.trim();

      this.accountErrors = {
        name: !name ? 'Ingresa el nombre completo.' : '',
        username: !username ? 'Ingresa el nombre de usuario.' : '',
        password: !this.editingAccount && !this.adminService.demoMode && !password
          ? 'Ingresa una contraseña para la cuenta.'
          : '',
        role: !role ? 'Selecciona el perfil de usuario.' : '',
        area: !area ? 'Ingresa el área de trabajo.' : '',
      };

      if (username) {
        const duplicate = this.adminService
          .accounts()
          .some(
            (a) =>
              a.username.toLowerCase() === username.toLowerCase() &&
              a.id !== this.editingAccount?.id,
          );
        if (duplicate) {
          this.accountErrors.username = 'Este usuario ya se encuentra registrado.';
        }
      }

      if (
        this.accountErrors.name ||
        this.accountErrors.username ||
        this.accountErrors.password ||
        this.accountErrors.role ||
        this.accountErrors.area
      ) {
        return;
      }

      await this.adminService.saveAccount({
        id: this.editingAccount?.id,
        name,
        username,
        password: password || undefined,
        role,
        area,
      });

      this.showModalAccount = false;
      this.toastService.show(
        this.editingAccount
          ? 'Cuenta actualizada correctamente.'
          : 'Nueva cuenta creada exitosamente.',
      );
    } catch (error: any) {
      this.toastService.show(
        error?.error?.error || (error instanceof Error ? error.message : 'No se pudo guardar el cambio'),
      );
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  openDeactivateAccountModal(acc: Account): void {
    this.accountPendingDeactivation = acc;
  }

  async confirmDeactivateAccount(): Promise<void> {
    try {
      if (this.accountPendingDeactivation) {
        await this.adminService.setAccountActive(this.accountPendingDeactivation.id, false);
        this.toastService.show(
          `Cuenta de "${this.accountPendingDeactivation.name}" desactivada. Su historial se mantiene intacto.`,
        );
        this.accountPendingDeactivation = null;
      }
    } catch (error: any) {
      this.toastService.show(
        error?.error?.error || (error instanceof Error ? error.message : 'No se pudo guardar el cambio'),
      );
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  async reactivateAccount(acc: Account): Promise<void> {
    try {
      await this.adminService.setAccountActive(acc.id, true);
      this.toastService.show(`Cuenta de "${acc.name}" reactivada correctamente.`);
    } catch (error: any) {
      this.toastService.show(
        error?.error?.error || (error instanceof Error ? error.message : 'No se pudo guardar el cambio'),
      );
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  openNewCatalogModal(): void {
    this.editingCatalogItem = null;
    this.catalogFormName = '';
    this.catalogFormParentId =
      this.catalogSubtab === 'categories'
        ? (this.adminService.areas()[0]?.id ?? 1)
        : (this.adminService.buildings()[0]?.id ?? 1);
    this.catalogError = '';
    this.showModalCatalog = true;
  }

  openEditCatalogModal(item: AdminCatalogItem): void {
    this.editingCatalogItem = item;
    this.catalogFormName = item.name;
    this.catalogFormParentId =
      this.catalogSubtab === 'categories'
        ? (item.areaId ?? this.adminService.areas()[0]?.id ?? 1)
        : (item.buildingId ?? this.adminService.buildings()[0]?.id ?? 1);
    this.catalogError = '';
    this.showModalCatalog = true;
  }

  async saveCatalogForm(): Promise<void> {
    try {
      const name = this.catalogFormName.trim();
      const typeLabel = this.catalogSubtab === 'categories' ? 'categoría' : 'ubicación';

      if (!name) {
        this.catalogError = 'El nombre no puede estar vacío.';
        return;
      }

      const duplicate = this.activeCatalogList.some(
        (item) =>
          item.name.toLowerCase() === name.toLowerCase() && item.id !== this.editingCatalogItem?.id,
      );

      if (duplicate) {
        this.catalogError = `Ya existe una ${typeLabel} con este nombre.`;
        return;
      }

      await this.adminService.saveCatalogItem(this.catalogSubtab, {
        id: this.editingCatalogItem?.id,
        name,
        areaId: this.catalogSubtab === 'categories' ? Number(this.catalogFormParentId) : undefined,
        buildingId: this.catalogSubtab === 'locations' ? Number(this.catalogFormParentId) : undefined,
      });

      this.showModalCatalog = false;
      this.toastService.show(
        this.editingCatalogItem
          ? 'Registro actualizado correctamente.'
          : `Nueva ${typeLabel} agregada correctamente.`,
      );
    } catch (error: any) {
      this.toastService.show(
        error?.error?.error || (error instanceof Error ? error.message : 'No se pudo guardar el cambio'),
      );
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  openDeactivateCatalogModal(item: AdminCatalogItem): void {
    this.catalogPendingDeactivation = item;
  }

  async confirmDeactivateCatalogItem(): Promise<void> {
    try {
      if (this.catalogPendingDeactivation) {
        await this.adminService.setCatalogItemActive(
          this.catalogSubtab,
          this.catalogPendingDeactivation.id,
          false,
        );
        this.toastService.show(
          `Elemento "${this.catalogPendingDeactivation.name}" desactivado. El historial previo se mantiene intacto.`,
        );
        this.catalogPendingDeactivation = null;
      }
    } catch (error: any) {
      this.toastService.show(
        error?.error?.error || (error instanceof Error ? error.message : 'No se pudo guardar el cambio'),
      );
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  async reactivateCatalogItem(item: AdminCatalogItem): Promise<void> {
    try {
      await this.adminService.setCatalogItemActive(this.catalogSubtab, item.id, true);
      this.toastService.show(`Elemento "${item.name}" reactivado correctamente.`);
    } catch (error: any) {
      this.toastService.show(
        error?.error?.error || (error instanceof Error ? error.message : 'No se pudo guardar el cambio'),
      );
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  async generateBackup(): Promise<void> {
    try {
      this.backupBusy = true;
      try {
        await this.backup.download();
        this.backupStatus = 'Respaldo completo descargado';
      } catch {
        this.backupStatus = 'No se pudo exportar el respaldo';
      } finally {
        this.backupBusy = false;
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  async restoreBackup(): Promise<void> {
    try {
      if (!this.backupFile || this.backupBusy) return;
      this.backupBusy = true;
      try {
        await this.backup.restore(this.backupFile);
        location.assign('/login');
      } catch (error) {
        this.backupStatus = error instanceof Error ? error.message : 'No se pudo restaurar';
      } finally {
        this.backupBusy = false;
      }
    } finally {
      this.changeDetector.markForCheck();
    }
  }

  confirmRestoreDefaults(): void {
    try {
      this.adminService.restoreDefaults();
      this.showModalRestore = false;
      this.toastService.show('Datos restaurados satisfactoriamente a los valores de ejemplo.');
    } catch (error) {
      this.toastService.show(
        error instanceof Error ? error.message : 'No se pudo guardar el cambio',
      );
    }
  }
}