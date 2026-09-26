import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
// Le FAUX HttpClient + sa télécommande (HttpTestingController).
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TodoStore } from './todo-store';
import { TodoList } from './todo';

// Des fausses données, réutilisées par plusieurs tests.
// (On les écrit une fois ici plutôt que dans chaque test.)
const LISTS: TodoList[] = [
  {
    id: 1,
    name: 'Courses',
    tasks: [
      { id: 1, title: 'Pain', done: true },
      { id: 2, title: 'Lait', done: false },
    ],
  },
  { id: 2, name: 'Bonus', tasks: [] },
];

// describe = un groupe de tests : ici, tout ce qui concerne TodoStore.
describe('TodoStore', () => {
  // Déclarées ici, remplies dans beforeEach, utilisées dans chaque test.
  let store: TodoStore;
  let http: HttpTestingController;

  // beforeEach = exécuté AVANT CHAQUE test : chaque test repart d'un Angular tout neuf.
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);   // la télécommande
    store = TestBed.inject(TodoStore);              // ⚠️ le constructeur tourne → load() → GET /api/lists part
  });

  // afterEach = exécuté APRÈS CHAQUE test.
  // verify() = "vérifie qu'il ne reste AUCUNE requête à laquelle on n'a pas répondu".
  // Si le code envoie une requête en trop (ou pas la bonne), le test échoue ici.
  afterEach(() => http.verify());

  // Petit raccourci : répondre à la requête de démarrage avec nos fausses listes.
  function loadWith(lists: TodoList[]): void {
    http.expectOne('/api/lists').flush(lists);
  }

  // ---------- load() ----------

  it('charge les listes au démarrage', () => {
    // Avant la réponse : on est en train de charger.
    expect(store.loading()).toBe(true);

    loadWith(LISTS);   // le faux serveur répond

    // Après la réponse : les listes sont là, le chargement est fini, pas d'erreur.
    expect(store.lists()).toEqual(LISTS);   // toEqual = "même contenu"
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('affiche un message si le serveur ne répond pas', () => {
    // On fait taire console.error pendant ce test (showError y écrit, ça polluerait l'affichage).
    // vi.spyOn = "espionne cette fonction" ; mockImplementation = "et remplace-la par : ne rien faire".
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // On simule un serveur Java éteint : le proxy répond 502, avec un simple texte (pas de {"error": ...}).
    http.expectOne('/api/lists').flush('Proxy error', { status: 502, statusText: 'Bad Gateway' });

    expect(store.error()).toBe('Impossible de joindre le serveur. Est-il bien lancé ?');
    expect(store.loading()).toBe(false);   // le piège de l'étape 09 : loading doit repasser à false AUSSI en cas d'erreur
    expect(store.lists()).toEqual([]);     // rien n'a été chargé
  });

  // ---------- les listes ----------

  it('crée une liste', () => {
    loadWith(LISTS);

    store.createList('Week-end');

    // On attrape la requête partie vers /api/lists…
    const req = http.expectOne('/api/lists');
    expect(req.request.method).toBe('POST');                 // …on vérifie que c'est bien un POST…
    expect(req.request.body).toEqual({ name: 'Week-end' });  // …avec le bon corps…
    req.flush({ id: 3, name: 'Week-end', tasks: [] });       // …et le serveur répond la liste créée (id 3).

    // La nouvelle liste est ajoutée à la fin, avec l'id donné par le serveur.
    expect(store.lists().map((list) => list.name)).toEqual(['Courses', 'Bonus', 'Week-end']);
  });

  it('supprime une liste', () => {
    loadWith(LISTS);

    store.deleteList(LISTS[1]);   // on supprime "Bonus" (id 2)

    const req = http.expectOne('/api/lists/2');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });   // 204 = "c'est fait", réponse vide

    expect(store.lists().map((list) => list.id)).toEqual([1]);   // il ne reste que Courses
  });

  // ---------- les tâches ----------

  it('ajoute une tâche à la bonne liste', () => {
    loadWith(LISTS);

    store.addTask(LISTS[0], 'Beurre');

    const req = http.expectOne('/api/lists/1/tasks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Beurre' });
    req.flush({ id: 10, title: 'Beurre', done: false });

    // La tâche est dans Courses, à la fin…
    expect(store.lists()[0].tasks.map((task) => task.title)).toEqual(['Pain', 'Lait', 'Beurre']);
    // …et Bonus n'a pas bougé.
    expect(store.lists()[1].tasks).toEqual([]);
  });

  it('coche une tâche', () => {
    loadWith(LISTS);

    const lait = LISTS[0].tasks[1];   // "Lait", pas encore faite
    store.toggleTask(LISTS[0], lait);

    const req = http.expectOne('/api/tasks/2');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ done: true });   // on envoie bien l'INVERSE de false
    req.flush({ ...lait, done: true });                 // le serveur renvoie la tâche modifiée

    expect(store.lists()[0].tasks[1].done).toBe(true);
  });

  it('supprime une tâche', () => {
    loadWith(LISTS);

    store.deleteTask(LISTS[0], LISTS[0].tasks[0]);   // on supprime "Pain" (id 1)

    const req = http.expectOne('/api/tasks/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(store.lists()[0].tasks.map((task) => task.title)).toEqual(['Lait']);
  });

  // ---------- les erreurs ----------

  it('affiche le message du serveur quand il refuse une requête', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loadWith(LISTS);

    store.deleteTask(LISTS[0], LISTS[0].tasks[0]);

    // Cette fois le serveur répond, mais refuse (404), avec une explication en JSON.
    http
      .expectOne('/api/tasks/1')
      .flush({ error: "La tâche 1 n'existe pas." }, { status: 404, statusText: 'Not Found' });

    expect(store.error()).toBe("La tâche 1 n'existe pas.");   // c'est SON message qui s'affiche
    expect(store.lists()[0].tasks).toHaveLength(2);            // et rien n'a été supprimé à l'écran
  });

  it("efface le message d'erreur", () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    http.expectOne('/api/lists').flush('Proxy error', { status: 502, statusText: 'Bad Gateway' });
    expect(store.error()).not.toBeNull();   // il y a bien une erreur…

    store.clearError();

    expect(store.error()).toBeNull();       // …et le ✕ l'a effacée
  });
    // it.each = LE MÊME test, lancé une fois par ligne du tableau.
  // Chaque ligne = [un nom lisible, l'action à faire, l'adresse attendue].
  // %s dans le titre est remplacé par le 1er élément de la ligne ("createList"...).
  it.each([
    ['createList', (s: TodoStore) => s.createList('X'), '/api/lists'],
    ['deleteList', (s: TodoStore) => s.deleteList(LISTS[0]), '/api/lists/1'],
    ['addTask', (s: TodoStore) => s.addTask(LISTS[0], 'X'), '/api/lists/1/tasks'],
    ['toggleTask', (s: TodoStore) => s.toggleTask(LISTS[0], LISTS[0].tasks[0]), '/api/tasks/1'],
  ] as const)('%s affiche une erreur si le serveur refuse', (_name, action, url) => {
    // _name : le nom sert juste au titre ; le _ devant dit "je ne m'en sers pas ici".
    vi.spyOn(console, 'error').mockImplementation(() => {});
    loadWith(LISTS);

    action(store);   // on lance l'action de la ligne (createList, deleteList...)

    // Le serveur refuse, avec une explication.
    http.expectOne(url).flush({ error: 'Refusé.' }, { status: 400, statusText: 'Bad Request' });

    expect(store.error()).toBe('Refusé.');   // le message du serveur est bien affiché
    expect(store.lists()).toEqual(LISTS);    // et rien n'a changé à l'écran
  });
});
