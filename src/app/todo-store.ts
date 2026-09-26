// NOUVEAU : HttpErrorResponse = le type de l'objet qu'on reçoit quand une requête ÉCHOUE.
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Task, TodoList } from './todo';

@Injectable({ providedIn: 'root' })
export class TodoStore {
  private readonly http = inject(HttpClient);

  // L'état du service = 3 signaux. Pour chacun : une version privée MODIFIABLE (writableXxx),
  // et une version publique en LECTURE SEULE pour les composants.

  // 1. Les listes (comme avant).
  private readonly writableLists = signal<TodoList[]>([]);
  readonly lists = this.writableLists.asReadonly();

  // 2. NOUVEAU : "est-ce qu'on est en train de charger ?" → App affichera "Chargement…".
  private readonly writableLoading = signal(false);
  readonly loading = this.writableLoading.asReadonly();

  // 3. NOUVEAU : le message d'erreur à afficher, ou null quand tout va bien.
  //    <string | null> = "un texte OU null".
  private readonly writableError = signal<string | null>(null);
  readonly error = this.writableError.asReadonly();

  constructor() {
    this.load();
  }

  /*
   * NOUVEAU : subscribe reçoit maintenant un OBJET { } avec 2 fonctions :
   *   .subscribe({
   *     next:  (réponse) => { ... },   // appelée si ça a MARCHÉ
   *     error: (erreur)  => { ... },   // appelée si ça a ÉCHOUÉ (à la place de next)
   *   });
   * Une seule des deux est appelée, jamais les deux.
   */

  /** Charge toutes les listes. */
  load(): void {
    this.writableLoading.set(true);   // on commence → "Chargement…" s'affiche
    this.writableError.set(null);     // on efface une ancienne erreur (utile pour le bouton "Recharger")
    this.http.get<TodoList[]>('/api/lists').subscribe({
      next: (lists) => {
        this.writableLists.set(lists);
        this.writableLoading.set(false);   // fini
      },
      error: (error: HttpErrorResponse) => {
        this.showError(error);             // on range un message lisible dans error
        this.writableLoading.set(false);   // fini AUSSI ! Sinon "Chargement…" resterait pour toujours
      },
    });
  }

  // Pour toutes les autres méthodes, même recette :
  //   next  = ce qu'on faisait avant dans le subscribe (mettre à jour le signal) ;
  //   error = showError(error).
  // "next: (list) => ..." sur une seule ligne : pas besoin d'accolades, la fonction fait juste ça.

  /** Crée une liste. */
  createList(name: string): void {
    this.http.post<TodoList>('/api/lists', { name: name }).subscribe({
      next: (list) => this.writableLists.update((lists) => [...lists, list]),
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  /** Supprime une liste. */
  deleteList(list: TodoList): void {
    this.http.delete(`/api/lists/${list.id}`).subscribe({
      next: () =>
        this.writableLists.update((lists) => lists.filter((current) => current.id !== list.id)),
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  /** Ajoute une tâche. */
  addTask(list: TodoList, title: string): void {
    this.http.post<Task>(`/api/lists/${list.id}/tasks`, { title: title }).subscribe({
      next: (task) => this.updateTasks(list, (tasks) => [...tasks, task]),
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  /** Coche / décoche une tâche. */
  toggleTask(list: TodoList, task: Task): void {
    this.http.patch<Task>(`/api/tasks/${task.id}`, { done: !task.done }).subscribe({
      next: (changed) =>
        this.updateTasks(list, (tasks) =>
          tasks.map((current) => (current.id === changed.id ? changed : current)),
        ),
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  /** Supprime une tâche. */
  deleteTask(list: TodoList, task: Task): void {
    this.http.delete(`/api/tasks/${task.id}`).subscribe({
      next: () =>
        this.updateTasks(list, (tasks) => tasks.filter((current) => current.id !== task.id)),
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  /** NOUVEAU : le ✕ du bandeau rouge → on efface le message. */
  clearError(): void {
    this.writableError.set(null);
  }

  /** NOUVEAU : transforme une erreur technique en phrase lisible pour l'utilisateur. */
  private showError(error: HttpErrorResponse): void {
    // error.error = le CORPS de la réponse d'erreur.
    // Quand le serveur Java refuse une requête, il répond par exemple {"error": "La tâche 3 n'existe pas."}
    // → le message est donc dans error.error.error. (Oui, trois fois "error", c'est moche mais c'est ça.)
    // ?. = "si error.error est vide (null), n'essaie pas de lire .error dedans : renvoie undefined au lieu de planter".
    const serverMessage = error.error?.error;
    if (typeof serverMessage === 'string') {
      // Le serveur a donné une explication → on l'affiche telle quelle.
      this.writableError.set(serverMessage);
    } else {
      // Pas d'explication → le serveur n'a pas répondu du tout (il est arrêté).
      this.writableError.set('Impossible de joindre le serveur. Est-il bien lancé ?');
    }
    // Le détail technique va dans la console (F12) : utile au développeur, pas à l'utilisateur.
    console.error(error);
  }

  // Inchangée.
  private updateTasks(list: TodoList, change: (tasks: Task[]) => Task[]): void {
    this.writableLists.update((lists) =>
      lists.map((current) =>
        current.id === list.id ? { ...current, tasks: change(current.tasks) } : current,
      ),
    );
  }
}
