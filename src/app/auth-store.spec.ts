import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth-interceptor';
import { AuthStore } from './auth-store';

// Chaque test fait lui-même TestBed.inject(AuthStore) : ça permet de préparer le localStorage
// AVANT la création du service (qui le lit au démarrage).
describe('AuthStore et authInterceptor', () => {
  const session = { token: 'jeton-123', username: 'alice' };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('garde la session reçue à la connexion, jusque dans le localStorage', () => {
    const auth = TestBed.inject(AuthStore);
    const server = TestBed.inject(HttpTestingController);

    auth.login('alice', 'motdepasse').subscribe();
    const request = server.expectOne({ method: 'POST', url: '/api/sessions' });
    expect(request.request.body).toEqual({ username: 'alice', password: 'motdepasse' });
    request.flush(session);

    expect(auth.username()).toBe('alice');
    expect(JSON.parse(localStorage.getItem('todolist-session')!)).toEqual(session);
  });

  it('relit la session au démarrage, comme après un rechargement de la page', () => {
    localStorage.setItem('todolist-session', JSON.stringify(session));

    const auth = TestBed.inject(AuthStore);

    expect(auth.username()).toBe('alice');
  });

  it("n'ajoute le jeton aux requêtes qu'une fois connecté", () => {
    const auth = TestBed.inject(AuthStore);
    const server = TestBed.inject(HttpTestingController);
    const http = TestBed.inject(HttpClient);

    http.get('/api/sync').subscribe();
    expect(server.expectOne('/api/sync').request.headers.has('Authorization')).toBe(false);

    auth.login('alice', 'motdepasse').subscribe();
    server.expectOne('/api/sessions').flush(session);

    http.get('/api/sync').subscribe();
    expect(server.expectOne('/api/sync').request.headers.get('Authorization')).toBe('Bearer jeton-123');
  });

  it('oublie la session à la déconnexion, et prévient le serveur', () => {
    localStorage.setItem('todolist-session', JSON.stringify(session));
    const auth = TestBed.inject(AuthStore);
    const server = TestBed.inject(HttpTestingController);

    auth.logout();

    expect(auth.username()).toBeNull();
    expect(localStorage.getItem('todolist-session')).toBeNull();
    const request = server.expectOne({ method: 'DELETE', url: '/api/sessions/current' });
    expect(request.request.headers.get('Authorization')).toBe('Bearer jeton-123');
    request.flush(null);
  });

  it('ne garde rien si la connexion est refusée', () => {
    const auth = TestBed.inject(AuthStore);
    const server = TestBed.inject(HttpTestingController);
    let refused = false;

    auth.login('alice', 'mauvais').subscribe({ error: () => (refused = true) });
    server
      .expectOne('/api/sessions')
      .flush({ error: 'Identifiant ou mot de passe incorrect.' }, { status: 401, statusText: 'Unauthorized' });

    expect(refused).toBe(true);
    expect(auth.username()).toBeNull();
  });
    it('supprime le compte, puis oublie la session', () => {
    localStorage.setItem('todolist-session', JSON.stringify(session));
    const auth = TestBed.inject(AuthStore);
    const server = TestBed.inject(HttpTestingController);

    auth.deleteAccount().subscribe();
    server.expectOne({ method: 'DELETE', url: '/api/accounts/me' }).flush(null);

    expect(auth.username()).toBeNull();
  });

  it('ignore une session illisible dans le localStorage', () => {
    localStorage.setItem('todolist-session', '{pas du json');   // du texte cassé

    const auth = TestBed.inject(AuthStore);

    expect(auth.username()).toBeNull();                       // pas de plantage : pas connecté
  });
    it("ne prévient pas le serveur si on se déconnecte sans être connecté", () => {
    const auth = TestBed.inject(AuthStore);

    auth.logout();                                        // pas de session → pas de jeton

    expect(auth.username()).toBeNull();
    // Pas d'expectOne : si un DELETE partait, verify() (dans afterEach) ferait échouer le test.
  });
});
