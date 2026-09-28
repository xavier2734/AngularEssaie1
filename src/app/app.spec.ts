import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { authInterceptor } from './auth-interceptor';
import { TodoList } from './todo';
import { AuthStore } from './auth-store';
import { TodoStore } from './todo-store';

// Toute la page, pour de vrai. Seul le serveur est faux.
describe('App', () => {
  const lists: TodoList[] = [
    { id: 1, name: 'Courses', tasks: [{ id: 2, title: 'Pain', done: false }] },
    { id: 3, name: 'Découvrir Angular', tasks: [{ id: 4, title: 'Créer le projet', done: true }] },
  ];

  let fixture: ComponentFixture<App>;
  let page: HTMLElement;
  let server: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    server = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(App);          // → TodoStore demande GET /api/sync
    server.expectOne('/api/sync').flush(lists);
    await fixture.whenStable();
    page = fixture.nativeElement;
  });

  afterEach(() => server.verify());

  it('affiche les listes reçues, et barre le nom de celles qui sont terminées', () => {
    const titles = Array.from(page.querySelectorAll('app-list-card h2'));

    expect(titles.map((title) => title.textContent?.trim())).toEqual(['Courses', 'Découvrir Angular']);
    expect(titles[0].classList.contains('done')).toBe(false);
    expect(titles[1].classList.contains('done')).toBe(true);
  });

  it("signale le mode test quand on n'est pas connecté", () => {
    expect(page.querySelector('.sync-status')!.textContent).toContain('Mode test');
    expect(page.querySelector('app-account-panel form')).not.toBeNull();
  });

  it('crée une liste avec le formulaire, et envoie toutes les listes au serveur', async () => {
    const field = page.querySelector<HTMLInputElement>('.new-list input')!;
    field.value = 'Week-end';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('.new-list button')!.click();
    await fixture.whenStable();

    expect(page.textContent).toContain('Week-end');
    const request = server.expectOne({ method: 'PUT', url: '/api/sync' });
    expect(request.request.body.map((list: TodoList) => list.name)).toEqual([
      'Courses',
      'Découvrir Angular',
      'Week-end',
    ]);
    request.flush(null);
  });
    it('coche une tâche, puis en supprime une, depuis les cartes', async () => {
    page.querySelector<HTMLInputElement>('app-list-card input[type=checkbox]')!.click();
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);
    await fixture.whenStable();

    page.querySelector<HTMLButtonElement>('app-list-card li .delete')!.click();
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);
    await fixture.whenStable();

    expect(page.querySelector('app-list-card')!.textContent).toContain('Aucune tâche');
  });

  it("supprime une liste seulement si on confirme", async () => {
    // 1er appel à confirm → "Annuler", 2e appel → "OK".
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const deleteButton = () => page.querySelector<HTMLButtonElement>('app-list-card .card-header .delete')!;

    deleteButton().click();                          // Annuler → rien ne part
    await fixture.whenStable();
    expect(page.querySelectorAll('app-list-card').length).toBe(2);

    deleteButton().click();                          // OK → la liste part
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);
    await fixture.whenStable();
    expect(page.querySelectorAll('app-list-card').length).toBe(1);
  });

  it("n'envoie rien si le nom de la nouvelle liste est vide", async () => {
    page.querySelector('.new-list')!.dispatchEvent(new Event('submit'));   // Entrée sur un champ vide
    await fixture.whenStable();
    // Pas d'expectOne : si un PUT partait, server.verify() ferait échouer le test.
  });

  it("affiche le bandeau d'erreur, le bouton Réessayer, et le ✕ qui le ferme", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = TestBed.inject(TodoStore);

    store.createList('A');
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null, { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    expect(page.querySelector('[role=alert]')).not.toBeNull();       // le bandeau est là

    page.querySelector<HTMLButtonElement>('[role=alert] .button')!.click();   // "Réessayer"
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);
    await fixture.whenStable();
    expect(page.querySelector('[role=alert]')).toBeNull();           // réussi → bandeau parti

    store.createList('B');
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null, { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    page.querySelector<HTMLButtonElement>('[role=alert] .close')!.click();    // le ✕
    await fixture.whenStable();
    expect(page.querySelector('[role=alert]')).toBeNull();
  });

  it('dit dans quel compte vont les listes quand on est connecté', async () => {
    TestBed.inject(AuthStore).login('alice', 'motdepasse').subscribe();
    server.expectOne('/api/sessions').flush({ token: 'jeton', username: 'alice' });
    await fixture.whenStable();

    expect(page.querySelector('.sync-status')!.textContent).toContain('enregistrées dans le compte « alice »');
  });

  it('affiche "Chargement…" pendant un rechargement, puis "Aucune liste" si c\'est vide', async () => {
    TestBed.inject(TodoStore).load();
    fixture.detectChanges();                        // on redessine SANS attendre la réponse
    expect(page.textContent).toContain('Chargement des listes');

    server.expectOne('/api/sync').flush([]);
    await fixture.whenStable();
    expect(page.textContent).toContain('Aucune liste pour l');
  });
    it('cache "Aucune liste" quand la liste est vide à cause d\'une erreur', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = TestBed.inject(TodoStore);

    store.load();                                         // 1er rechargement : le serveur renvoie… rien
    server.expectOne('/api/sync').flush([]);
    store.load();                                         // 2e rechargement : le serveur est en panne
    server.expectOne('/api/sync').flush(null, { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();

    expect(page.querySelector('[role=alert]')).not.toBeNull();    // le bandeau d'erreur est là
    expect(page.textContent).not.toContain('Aucune liste pour l'); // mais PAS le faux "Aucune liste"
  });
});
