import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { TodoList } from './todo';

const LISTS: TodoList[] = [
  { id: 1, name: 'Courses', tasks: [{ id: 1, title: 'Pain', done: false }] },
  { id: 2, name: 'Bonus', tasks: [] },
];

describe('App', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  // Après chaque test : aucune requête oubliée.
  afterEach(() => http.verify());

  // Fabrique App. (Au passage, TodoStore est créé → son constructeur envoie GET /api/lists.)
  function render() {
    const fixture = TestBed.createComponent(App);
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  // Le faux serveur répond aux listes, puis on attend que l'écran suive.
  async function answerLists(fixture: { whenStable(): Promise<unknown> }, lists: TodoList[]) {
    http.expectOne('/api/lists').flush(lists);
    await fixture.whenStable();
  }

  // Le faux serveur "est éteint" : le proxy répond 502.
  async function serverDown(fixture: { whenStable(): Promise<unknown> }) {
    vi.spyOn(console, 'error').mockImplementation(() => {});   // on fait taire console.error
    http.expectOne('/api/lists').flush('Proxy error', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
  }

  // ---------- vos 2 tests de départ ----------

  it('crée le composant', () => {
    const { fixture } = render();
    expect(fixture.componentInstance).toBeTruthy();
    http.expectOne('/api/lists').flush([]);   // on répond quand même, sinon verify() râle
  });

  it('affiche le titre', async () => {
    const { fixture, el } = render();
    await answerLists(fixture, []);
    expect(el.querySelector('h1')?.textContent).toContain('Mes listes de tâches');
  });

  // ---------- chargement ----------

  it('affiche "Chargement…" tant que le serveur n\'a pas répondu', async () => {
    const { fixture, el } = render();
    await fixture.whenStable();                             // on dessine SANS avoir répondu
    expect(el.textContent).toContain('Chargement des listes');

    await answerLists(fixture, LISTS);                      // le serveur répond…
    expect(el.textContent).not.toContain('Chargement des listes');   // …le message disparaît
  });

  it('affiche une carte par liste', async () => {
    const { fixture, el } = render();
    await answerLists(fixture, LISTS);
    // app-list-card = la balise de ListCard : une par liste.
    expect(el.querySelectorAll('app-list-card').length).toBe(2);
  });

  it('affiche "Aucune liste" quand le serveur renvoie un tableau vide', async () => {
    const { fixture, el } = render();
    await answerLists(fixture, []);
    expect(el.textContent).toContain('Aucune liste pour l');
  });

  // ---------- erreurs ----------

  it("affiche le bandeau d'erreur et cache \"Aucune liste\" si le serveur est éteint", async () => {
    const { fixture, el } = render();
    await serverDown(fixture);

    // [role=alert] = le bandeau rouge (on le trouve grâce à son attribut role).
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Impossible de joindre le serveur');
    // Le piège de l'étape 09 : on ne doit PAS dire "Aucune liste" (ce serait faux).
    expect(el.textContent).not.toContain('Aucune liste pour l');
  });

  it('recharge les listes avec le bouton du bandeau', async () => {
    const { fixture, el } = render();
    await serverDown(fixture);

    // Le bouton bleu DANS le bandeau = "Recharger les listes".
    el.querySelector<HTMLButtonElement>('[role=alert] .button')!.click();
    await answerLists(fixture, LISTS);   // une NOUVELLE requête GET est partie : on y répond

    expect(el.querySelector('[role=alert]')).toBeNull();                 // le bandeau a disparu
    expect(el.querySelectorAll('app-list-card').length).toBe(2);         // et les listes sont là
  });

  it('ferme le bandeau avec le ✕', async () => {
    const { fixture, el } = render();
    await serverDown(fixture);

    el.querySelector<HTMLButtonElement>('[role=alert] .close')!.click();
    await fixture.whenStable();

    expect(el.querySelector('[role=alert]')).toBeNull();
  });

  // ---------- créer une liste (createList d'App) ----------

  it('crée une liste avec le formulaire, puis vide le champ', async () => {
    const { fixture, el } = render();
    await answerLists(fixture, LISTS);

    // On tape dans le champ "Nom de la nouvelle liste"…
    const input = el.querySelector<HTMLInputElement>('.new-list input')!;
    input.value = '  Week-end  ';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    // …et on envoie le formulaire (= Entrée).
    el.querySelector('.new-list')!.dispatchEvent(new Event('submit'));

    // App a nettoyé le nom (trim) et l'a donné au service, qui a envoyé le POST.
    const req = http.expectOne('/api/lists');
    expect(req.request.body).toEqual({ name: 'Week-end' });
    req.flush({ id: 3, name: 'Week-end', tasks: [] });
    await fixture.whenStable();

    expect(el.querySelectorAll('app-list-card').length).toBe(3);                          // une carte de plus
    expect(el.querySelector<HTMLButtonElement>('.new-list .button')!.disabled).toBe(true); // champ vidé → bouton grisé
  });

  it("n'envoie rien si le nom est vide", async () => {
    const { fixture, el } = render();
    await answerLists(fixture, LISTS);

    el.querySelector('.new-list')!.dispatchEvent(new Event('submit'));   // Entrée sur un champ vide
    await fixture.whenStable();
    // Aucun expectOne ici : si un POST était parti, http.verify() (dans afterEach) ferait échouer le test.
  });

  // ---------- supprimer une liste (deleteList d'App, avec confirm) ----------

  it('supprime une liste si on confirme', async () => {
    // On remplace la vraie fenêtre confirm par une fausse qui répond toujours "OK" (true).
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { fixture, el } = render();
    await answerLists(fixture, LISTS);

    // Le ✕ de l'en-tête de la 1re carte (Courses).
    el.querySelector<HTMLButtonElement>('app-list-card .card-header .delete')!.click();

    const req = http.expectOne('/api/lists/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(el.querySelectorAll('app-list-card').length).toBe(1);   // il ne reste que Bonus
  });

  it('ne supprime rien si on annule', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);   // cette fois, "Annuler"
    const { fixture, el } = render();
    await answerLists(fixture, LISTS);

    el.querySelector<HTMLButtonElement>('app-list-card .card-header .delete')!.click();
    await fixture.whenStable();

    // Aucune requête DELETE (verify() le vérifie) et les 2 cartes sont toujours là.
    expect(el.querySelectorAll('app-list-card').length).toBe(2);
  });
    it('coche une tâche depuis une carte', async () => {
    const { fixture, el } = render();
    await answerLists(fixture, LISTS);

    // La case de "Pain", dans la 1re carte.
    el.querySelector<HTMLInputElement>('app-list-card input[type=checkbox]')!.click();

    // Le clic a traversé : carte → (toggleTask) dans app.html → store.toggleTask → PATCH.
    const req = http.expectOne('/api/tasks/1');
    expect(req.request.body).toEqual({ done: true });
    req.flush({ id: 1, title: 'Pain', done: true });
    await fixture.whenStable();

    expect(el.querySelector<HTMLInputElement>('app-list-card input[type=checkbox]')!.checked).toBe(true);
  });
    it('ajoute une tâche depuis le formulaire d\'une carte', async () => {
    const { fixture, el } = render();
    await answerLists(fixture, LISTS);

    // 1. On tape dans le champ "Nouvelle tâche" de la 1re carte (Courses).
    const input = el.querySelector<HTMLInputElement>('app-list-card .new-task input')!;
    input.value = 'Beurre';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    // 2. On appuie sur Entrée = on envoie le formulaire de la carte.
    el.querySelector('app-list-card .new-task')!.dispatchEvent(new Event('submit'));

    // 3. Le message a traversé : carte (addTask.emit) → app.html (addTask) → store.addTask → POST.
    const req = http.expectOne('/api/lists/1/tasks');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Beurre' });
    req.flush({ id: 10, title: 'Beurre', done: false });
    await fixture.whenStable();

    // La carte Courses a maintenant 2 tâches (Pain + Beurre).
    expect(el.querySelector('app-list-card')!.querySelectorAll('li').length).toBe(2);
  });

  it('supprime une tâche avec son ✕', async () => {
    const { fixture, el } = render();
    await answerLists(fixture, LISTS);

    // Le ✕ d'une TÂCHE (dans un <li>), pas celui de la liste (dans .card-header).
    el.querySelector<HTMLButtonElement>('app-list-card li .delete')!.click();

    // carte (deleteTask.emit) → app.html (deleteTask) → store.deleteTask → DELETE.
    const req = http.expectOne('/api/tasks/1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    // Courses n'a plus de tâche → son message "Aucune tâche" apparaît.
    expect(el.querySelector('app-list-card')!.textContent).toContain('Aucune tâche pour l');
  });
});
