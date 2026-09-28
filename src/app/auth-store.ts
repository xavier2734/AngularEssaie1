import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

// Ce que le serveur renvoie à la connexion : le jeton (le badge) et l'identifiant.
export interface Session {
  token: string;
  username: string;
}

// Le nom de la case du localStorage où on range la session (pour rester connecté après F5).
const STORAGE_KEY = 'todolist-session';

// Le service du COMPTE : se connecter, créer un compte, se déconnecter, supprimer le compte.
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);

  // La session en cours, ou null si pas connecté. Au démarrage, on la relit dans le navigateur.
  private readonly session = signal<Session | null>(readStoredSession());

  // L'identifiant et le jeton, ou null. ?? = "sinon, si c'est absent".
  readonly username = computed(() => this.session()?.username ?? null);
  readonly token = computed(() => this.session()?.token ?? null);

  // login / register / deleteAccount RENVOIENT la requête (un Observable) :
  // c'est le composant qui fera subscribe, pour savoir quand c'est fini ou si ça a échoué.
  // pipe(tap(...)) = "au passage, quand la réponse arrive, fais ceci" (ici : retenir la session).

  /** Se connecter : POST /api/sessions. */
  login(username: string, password: string): Observable<Session> {
    return this.http
      .post<Session>('/api/sessions', { username: username, password: password })
      .pipe(tap((session) => this.remember(session)));
  }

  /** Créer un compte : POST /api/accounts (le serveur connecte aussitôt). */
  register(username: string, password: string): Observable<Session> {
    return this.http
      .post<Session>('/api/accounts', { username: username, password: password })
      .pipe(tap((session) => this.remember(session)));
  }

  /** Supprimer son compte : DELETE /api/accounts/me, puis oublier la session. */
  deleteAccount(): Observable<unknown> {
    return this.http.delete('/api/accounts/me').pipe(tap(() => this.forget()));
  }

  /** Se déconnecter : on oublie la session tout de suite, puis on prévient le serveur. */
  logout(): void {
    const token = this.token();
    this.forget();
    if (token !== null) {
      // La session est oubliée → l'intercepteur ne mettra plus le jeton : on le met nous-mêmes.
      this.http
        .delete('/api/sessions/current', { headers: { Authorization: `Bearer ${token}` } })
        .subscribe({ error: () => {} });   // si le serveur ne répond pas, tant pis
    }
  }

  /** Oublier la session (signal + navigateur). */
  forget(): void {
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Retenir la session (signal + navigateur, en texte JSON). */
  private remember(session: Session): void {
    this.session.set(session);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

// Relit la session rangée dans le navigateur (null s'il n'y en a pas ou si elle est illisible).
function readStoredSession(): Session | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text === null ? null : JSON.parse(text);
  } catch {
    return null;
  }
}
