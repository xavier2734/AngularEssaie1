import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../auth-store';
import { errorMessage } from '../error-message';
import { TodoStore } from '../todo-store';

// Le panneau du compte, dans l'en-tête : formulaire de connexion, ou barre "Connecté".
@Component({
  selector: 'app-account-panel',
  imports: [FormsModule],
  templateUrl: './account-panel.html',
  styleUrl: './account-panel.css',
})
export class AccountPanel {
  protected readonly auth = inject(AuthStore);
  private readonly todos = inject(TodoStore);

  protected readonly username = signal('');                  // ce qu'on tape dans "Identifiant"
  protected readonly password = signal('');                  // ce qu'on tape dans "Mot de passe"
  protected readonly message = signal<string | null>(null);  // message d'erreur du panneau
  protected readonly busy = signal(false);                   // true pendant une requête (boutons grisés)

  /** Se connecter, puis charger les listes du compte. */
  protected login(): void {
    this.busy.set(true);
    this.message.set(null);
    this.auth.login(this.username(), this.password()).subscribe({
      next: () => {
        this.busy.set(false);
        this.password.set('');
        this.todos.load();          // on remplace les listes affichées par celles du compte
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.message.set(errorMessage(error));
      },
    });
  }

  /** Créer un compte, puis y enregistrer les listes affichées. */
  protected register(): void {
    this.busy.set(true);
    this.message.set(null);
    this.auth.register(this.username(), this.password()).subscribe({
      next: () => {
        this.busy.set(false);
        this.password.set('');
        this.todos.sync();          // compte neuf : on y enregistre ce qu'on a fait en mode test
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        this.message.set(errorMessage(error));
      },
    });
  }

  /** Se déconnecter, puis revenir aux listes de départ. */
  protected logout(): void {
    this.auth.logout();
    this.todos.load();
  }

  /** Supprimer son compte, après confirmation. */
  protected deleteAccount(): void {
    if (!confirm(`Supprimer le compte « ${this.auth.username()} » et toutes ses listes ?`)) {
      return;
    }
    this.message.set(null);
    this.auth.deleteAccount().subscribe({
      next: () => this.todos.load(),
      error: (error: HttpErrorResponse) => this.message.set(errorMessage(error)),
    });
  }
}
