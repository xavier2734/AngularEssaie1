import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App } from './app';
import { authInterceptor } from './auth-interceptor';
import { TodoList } from './todo';

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
});
