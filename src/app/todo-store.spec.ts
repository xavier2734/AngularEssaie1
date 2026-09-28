import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth-interceptor';
import { TodoList } from './todo';
import { TodoStore } from './todo-store';

describe('TodoStore', () => {
  let store: TodoStore;
  let server: HttpTestingController;

  // Ce que le faux serveur renvoie au chargement.
  const lists: TodoList[] = [
    { id: 1, name: 'Courses', tasks: [{ id: 2, title: 'Pain', done: false }] },
  ];

  beforeEach(() => {
    localStorage.clear();   // pas de session : mode test
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    store = TestBed.inject(TodoStore);   // son constructeur envoie aussitôt GET /api/sync
    server = TestBed.inject(HttpTestingController);
  });

  afterEach(() => server.verify());

  it('charge les listes au démarrage', () => {
    expect(store.loading()).toBe(true);

    server.expectOne('/api/sync').flush(lists);

    expect(store.loading()).toBe(false);
    expect(store.lists()).toEqual(lists);
  });

  it('modifie les listes tout de suite, puis les envoie toutes au serveur', () => {
    server.expectOne('/api/sync').flush(lists);

    store.toggleTask(store.lists()[0], store.lists()[0].tasks[0]);

    expect(store.lists()[0].tasks[0].done).toBe(true);              // l'écran n'attend pas le serveur
    const request = server.expectOne({ method: 'PUT', url: '/api/sync' });
    expect(request.request.body[0].tasks[0].done).toBe(true);        // toutes les listes partent
    expect(store.saving()).toBe(true);

    request.flush(null);

    expect(store.saving()).toBe(false);
  });

  it("n'envoie qu'une requête à la fois, puis renvoie le dernier état", () => {
    server.expectOne('/api/sync').flush(lists);

    store.createList('A');
    store.createList('B');
    store.createList('C');

    // Une seule requête part, avec l'état du moment : Courses et A.
    const first = server.expectOne({ method: 'PUT', url: '/api/sync' });
    expect(first.request.body.length).toBe(2);
    first.flush(null);

    // À son retour, une seconde part avec l'état le plus récent.
    const second = server.expectOne({ method: 'PUT', url: '/api/sync' });
    expect(second.request.body.map((list: TodoList) => list.name)).toEqual(['Courses', 'A', 'B', 'C']);
    second.flush(null);
  });

  it("n'envoie rien tant que les listes n'ont pas été reçues", () => {
    store.createList('Trop tôt');

    server.expectNone({ method: 'PUT', url: '/api/sync' });   // expectNone = "AUCUNE requête de ce genre"
    server.expectOne('/api/sync').flush(lists);
  });

  it('donne aux nouveautés des numéros encore jamais utilisés', () => {
    server.expectOne('/api/sync').flush(lists);   // numéros déjà pris : 1 et 2

    store.createList('Week-end');
    const weekEnd = store.lists()[1];
    store.addTask(weekEnd, 'Faire le plein');

    expect(weekEnd.id).toBe(3);
    expect(store.lists()[1].tasks[0].id).toBe(4);
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);
  });

  it('affiche un message quand le serveur ne répond pas', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    server.expectOne('/api/sync').flush(null, { status: 502, statusText: 'Bad Gateway' });

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Impossible de joindre le serveur. Est-il bien lancé ?');
  });
    it('supprime une tâche puis une liste, et envoie à chaque fois', () => {
    server.expectOne('/api/sync').flush(lists);

    store.deleteTask(store.lists()[0], store.lists()[0].tasks[0]);
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);
    expect(store.lists()[0].tasks).toEqual([]);

    store.deleteList(store.lists()[0]);
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);
    expect(store.lists()).toEqual([]);
  });

  it("réessaie le CHARGEMENT si les listes n'ont jamais été reçues", () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.expectOne('/api/sync').flush(null, { status: 502, statusText: 'Bad Gateway' });

    store.retry();                                   // rien reçu → on recharge (GET)
    server.expectOne('/api/sync').flush(lists);

    expect(store.lists()).toEqual(lists);
  });

  it("réessaie l'ENVOI si c'est l'envoi qui a échoué", () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    server.expectOne('/api/sync').flush(lists);

    store.createList('A');
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null, { status: 502, statusText: 'Bad Gateway' });
    expect(store.error()).not.toBeNull();            // l'envoi a échoué
    expect(store.saving()).toBe(false);

    store.retry();                                   // déjà reçu → on renvoie (PUT)
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);
    expect(store.error()).toBeNull();                // l'envoi a réussi → l'erreur disparaît
  });

  it('oublie la session si le serveur refuse le jeton (401)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('todolist-session', JSON.stringify({ token: 'vieux', username: 'alice' }));

    server
      .expectOne('/api/sync')
      .flush({ error: 'Session inconnue ou expirée : reconnectez-vous.' }, { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('todolist-session')).toBeNull();   // la session a été oubliée
    expect(store.error()).toBe('Session inconnue ou expirée : reconnectez-vous.');
  });
    it("en cochant une tâche, ne touche pas aux autres tâches de la liste", () => {
    // Cette fois, une liste avec DEUX tâches.
    server.expectOne('/api/sync').flush([
      { id: 1, name: 'Courses', tasks: [{ id: 2, title: 'Pain', done: false }, { id: 3, title: 'Lait', done: false }] },
    ]);

    store.toggleTask(store.lists()[0], store.lists()[0].tasks[0]);   // on coche "Pain"
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);

    expect(store.lists()[0].tasks[0].done).toBe(true);    // Pain : cochée
    expect(store.lists()[0].tasks[1].done).toBe(false);   // Lait : pas touchée (le "sinon" du ? :)
  });
});
