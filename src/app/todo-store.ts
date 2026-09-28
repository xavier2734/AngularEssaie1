import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Task, TodoList } from './todo';
import { AuthStore } from './auth-store';
import { errorMessage } from './error-message';

@Injectable({ providedIn: 'root' })
export class TodoStore {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthStore);   // pour oublier une session refusée (erreur 401)

  // Les listes (lecture seule pour les composants).
  private readonly writableLists = signal<TodoList[]>([]);
  readonly lists = this.writableLists.asReadonly();

  // true pendant le chargement → "Chargement…"
  private readonly writableLoading = signal(false);
  readonly loading = this.writableLoading.asReadonly();

  // NOUVEAU : true pendant l'envoi → "Envoi des listes au serveur…"
  private readonly writableSaving = signal(false);
  readonly saving = this.writableSaving.asReadonly();

  // Le message d'erreur, ou null.
  private readonly writableError = signal<string | null>(null);
  readonly error = this.writableError.asReadonly();

  // NOUVEAU : 3 simples variables internes (pas des signaux : jamais affichées).
  private loaded = false;               // les listes ont-elles été reçues ? (avant : on n'envoie RIEN)
  private sending = false;              // un envoi est-il en route ?
  private changedWhileSending = false;  // les listes ont-elles changé pendant cet envoi ?

  constructor() {
    this.load();
  }

  /** Lire toutes les listes : GET /api/sync. */
  load(): void {
    this.loaded = false;
    this.changedWhileSending = false;
    this.writableLoading.set(true);
    this.writableError.set(null);
    this.http.get<TodoList[]>('/api/sync').subscribe({
      next: (lists) => {
        this.writableLists.set(lists);
        this.loaded = true;                 // à partir de maintenant, on a le droit d'envoyer
        this.writableLoading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.showError(error);
        this.writableLoading.set(false);
      },
    });
  }

  /** NOUVEAU : bouton "Réessayer" → recharger si rien n'a été reçu, sinon renvoyer. */
  retry(): void {
    if (this.loaded) {
      this.sync();
    } else {
      this.load();
    }
  }

  // Les actions : 1. on modifie les listes ICI, tout de suite ; 2. on appelle sync().

  createList(name: string): void {
    const list: TodoList = { id: this.newId(), name: name, tasks: [] };
    this.writableLists.update((lists) => [...lists, list]);
    this.sync();
  }

  deleteList(list: TodoList): void {
    this.writableLists.update((lists) => lists.filter((current) => current.id !== list.id));
    this.sync();
  }

  addTask(list: TodoList, title: string): void {
    const task: Task = { id: this.newId(), title: title, done: false };
    this.updateTasks(list, (tasks) => [...tasks, task]);
    this.sync();
  }

  toggleTask(list: TodoList, task: Task): void {
    this.updateTasks(list, (tasks) =>
      tasks.map((current) =>
        current.id === task.id ? { ...current, done: !current.done } : current,
      ),
    );
    this.sync();
  }

  deleteTask(list: TodoList, task: Task): void {
    this.updateTasks(list, (tasks) => tasks.filter((current) => current.id !== task.id));
    this.sync();
  }

  clearError(): void {
    this.writableError.set(null);
  }

  /** NOUVEAU : envoie TOUTES les listes : PUT /api/sync. Un seul envoi à la fois. */
  sync(): void {
    if (!this.loaded) {
      return;                         // pas encore reçu → surtout ne pas envoyer un tableau vide
    }
    if (this.sending) {
      this.changedWhileSending = true; // un envoi est déjà en route → on note qu'il faudra renvoyer
      return;
    }
    this.sending = true;
    this.writableSaving.set(true);
    this.http.put('/api/sync', this.writableLists()).subscribe({
      next: () => {
        this.writableError.set(null);  // envoi réussi → l'ancienne erreur n'a plus lieu d'être
        this.sendFinished();
      },
      error: (error: HttpErrorResponse) => {
        this.showError(error);
        this.sendFinished();
      },
    });
  }

  /** NOUVEAU : fin d'un envoi → on renvoie si les listes ont changé entre-temps. */
  private sendFinished(): void {
    this.sending = false;
    if (this.changedWhileSending) {
      this.changedWhileSending = false;
      this.sync();                     // on renvoie l'état le plus récent
    } else {
      this.writableSaving.set(false);
    }
  }

  /** NOUVEAU : c'est le navigateur qui choisit les numéros : le plus grand + 1. */
  private newId(): number {
    // flatMap : un seul tableau avec l'id de chaque liste ET ceux de ses tâches.
    const ids = this.writableLists().flatMap((list) => [
      list.id,
      ...list.tasks.map((task) => task.id),
    ]);
    // Math.max(0, ...ids) : le plus grand, ou 0 s'il n'y a rien.
    return Math.max(0, ...ids) + 1;
  }

  private showError(error: HttpErrorResponse): void {
  // 401 = le serveur ne reconnaît plus notre jeton (session expirée…) → on l'oublie.
  if (error.status === 401) {
    this.auth.forget();
  }
  this.writableError.set(errorMessage(error));
  console.error(error);
}

  private updateTasks(list: TodoList, change: (tasks: Task[]) => Task[]): void {
    this.writableLists.update((lists) =>
      lists.map((current) =>
        current.id === list.id ? { ...current, tasks: change(current.tasks) } : current,
      ),
    );
  }
}
