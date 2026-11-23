import { BackupService } from '../../../application/services/backup.service';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../application/services/admin.service';
import { ToastService } from '../../../application/services/toast.service';
import { Account, CatalogItem } from '../../../domain/models/incident.model';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.component.html',
})
export class AdminComponent {
  // Dependencias y estado de la vista

  private changeDetector = inject(ChangeDetectorRef);

  backup = inject(BackupService);
  backupBusy = false;
  backupStatus = '';
  backupFile: File | null = null;
  adminService = inject(AdminService);
  private toastService = inject(ToastService);

  activeTab: 'cuentas' | 'catalogos' | 'respaldo' = 'cuentas';
  catalogSubtab: 'categories' | 'locations' = 'categories';

  // Filtros de cuentas
  accountSearch = '';
  accountFilterRole = '';
  accountFilterStatus = '';

  // Estado de los formularios y confirmaciones
  showModalAccount = false;
  editingAccount: Account | null = null;
  accountForm = { name: '', username: '', role: '', area: '' };
  accountErrors = { name: '', username: '', role: '', area: '' };
  accountPendingDeactivation: Account | null = null;

  showModalCatalog = false;
  editingCatalogItem: CatalogItem | null = null;
  catalogFormName = '';
  catalogError = '';
  catalogPendingDeactivation: CatalogItem | null = null;

  showModalRestore = false;

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

  get activeCatalogList(): CatalogItem[] {
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
    this.accountForm = { name: '', username: '', role: '', area: '' };
    this.accountErrors = { name: '', username: '', role: '', area: '' };
    this.showModalAccount = true;
  }

  openEditAccountModal(acc: Account): void {
    this.editingAccount = acc;
    this.accountForm = {
      name: acc.name,
      username: acc.username,
      role: acc.role,
      area: acc.area,
    };
    this.accountErrors = { name: '', username: '', role: '', area: '' };
    this.showModalAccount = true;
  }

  saveAccountForm(): void {
    try {
      const name = this.accountForm.name.trim();
      const username = this.accountForm.username.trim();
      const role = this.accountForm.role;
      const area = this.accountForm.area.trim();

      this.accountErrors = {
        name: !name ? 'Ingresa el nombre completo.' : '',
        username: !username ? 'Ingresa el nombre de usuario.' : '',
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
        this.accountErrors.role ||
        this.accountErrors.area
      ) {
        return;
      }

      this.adminService.saveAccount({
        id: this.editingAccount?.id,
        name,
        username,
        role,
        area,
      });

      this.showModalAccount = false;
      this.toastService.show(
        this.editingAccount
          ? 'Cuenta actualizada correctamente.'
          : 'Nueva cuenta creada exitosamente.',
      );
    } catch (error) {
      this.toastService.show(
        error instanceof Error ? error.message : 'No se pudo guardar el cambio',
      );
    }
  }

  openDeactivateAccountModal(acc: Account): void {
    this.accountPendingDeactivation = acc;
  }

  confirmDeactivateAccount(): void {
    try {
      if (this.accountPendingDeactivation) {
        this.adminService.setAccountActive(this.accountPendingDeactivation.id, false);
        this.toastService.show(
          `Cuenta de "${this.accountPendingDeactivation.name}" desactivada. Su historial se mantiene intacto.`,
        );
        this.accountPendingDeactivation = null;
      }
    } catch (error) {
      this.toastService.show(
        error instanceof Error ? error.message : 'No se pudo guardar el cambio',
      );
    }
  }

  reactivateAccount(acc: Account): void {
    try {
      this.adminService.setAccountActive(acc.id, true);
      this.toastService.show(`Cuenta de "${acc.name}" reactivada correctamente.`);
    } catch (error) {
      this.toastService.show(
        error instanceof Error ? error.message : 'No se pudo guardar el cambio',
      );
    }
  }

  // Validaciones y operaciones de catalogos
  openNewCatalogModal(): void {
    this.editingCatalogItem = null;
    this.catalogFormName = '';
    this.catalogError = '';
    this.showModalCatalog = true;
  }

  openEditCatalogModal(item: CatalogItem): void {
    this.editingCatalogItem = item;
    this.catalogFormName = item.name;
    this.catalogError = '';
    this.showModalCatalog = true;
  }

  saveCatalogForm(): void {
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

      this.adminService.saveCatalogItem(this.catalogSubtab, {
        id: this.editingCatalogItem?.id,
        name,
      });

      this.showModalCatalog = false;
      this.toastService.show(
        this.editingCatalogItem
          ? 'Registro actualizado correctamente.'
          : `Nueva ${typeLabel} agregada correctamente.`,
      );
    } catch (error) {
      this.toastService.show(
        error instanceof Error ? error.message : 'No se pudo guardar el cambio',
      );
    }
  }

  openDeactivateCatalogModal(item: CatalogItem): void {
    this.catalogPendingDeactivation = item;
  }

  confirmDeactivateCatalogItem(): void {
    try {
      if (this.catalogPendingDeactivation) {
        this.adminService.setCatalogItemActive(
          this.catalogSubtab,
          this.catalogPendingDeactivation.id,
          false,
        );
        this.toastService.show(
          `Elemento "${this.catalogPendingDeactivation.name}" desactivado. El historial previo se mantiene intacto.`,
        );
        this.catalogPendingDeactivation = null;
      }
    } catch (error) {
      this.toastService.show(
        error instanceof Error ? error.message : 'No se pudo guardar el cambio',
      );
    }
  }

  reactivateCatalogItem(item: CatalogItem): void {
    try {
      this.adminService.setCatalogItemActive(this.catalogSubtab, item.id, true);
      this.toastService.show(`Elemento "${item.name}" reactivado correctamente.`);
    } catch (error) {
      this.toastService.show(
        error instanceof Error ? error.message : 'No se pudo guardar el cambio',
      );
    }
  }

  // Procesos de respaldo y restauracion
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
