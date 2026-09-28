import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { authInterceptor } from '../auth-interceptor';
import { AccountPanel } from './account-panel';

// Le panneau du compte, avec ses vrais services. Seul le serveur est faux.
describe('AccountPanel', () => {
  let fixture: ComponentFixture<AccountPanel>;
  let page: HTMLElement;
  let server: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    server = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(AccountPanel);   // le panneau injecte TodoStore → GET /api/sync
    server.expectOne('/api/sync').flush([]);
    await fixture.whenStable();
    page = fixture.nativeElement;
  });

  afterEach(() => server.verify());

  // Petit outil : taper l'identifiant et le mot de passe.
  async function fillForm(username: string, password: string): Promise<void> {
    for (const [name, value] of [['username', username], ['password', password]]) {
      const field = page.querySelector<HTMLInputElement>(`input[name=${name}]`)!;
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  }

  it('se connecte, puis charge les listes du compte', async () => {
    await fillForm('alice', 'motdepasse');

    page.querySelector('form')!.dispatchEvent(new Event('submit'));   // = "Se connecter"
    server.expectOne({ method: 'POST', url: '/api/sessions' }).flush({ token: 'jeton', username: 'alice' });
    server.expectOne('/api/sync').flush([]);                           // les listes du compte
    await fixture.whenStable();

    expect(page.textContent).toContain('Connecté');
    expect(page.textContent).toContain('alice');
  });

  it('affiche le message du serveur si la connexion est refusée', async () => {
    await fillForm('alice', 'mauvais1');

    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    server
      .expectOne('/api/sessions')
      .flush({ error: 'Identifiant ou mot de passe incorrect.' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();

    expect(page.querySelector('.message')!.textContent).toContain('Identifiant ou mot de passe incorrect.');
  });

  it('crée un compte, puis y enregistre les listes affichées', async () => {
    await fillForm('alice', 'motdepasse');

    page.querySelectorAll<HTMLButtonElement>('form button')[1].click();   // 2e bouton = "Créer un compte"
    server.expectOne({ method: 'POST', url: '/api/accounts' }).flush({ token: 'jeton', username: 'alice' });
    server.expectOne({ method: 'PUT', url: '/api/sync' }).flush(null);     // les listes sont enregistrées
    await fixture.whenStable();

    expect(page.textContent).toContain('Connecté');
  });

  it('se déconnecte, prévient le serveur, et revient aux listes de départ', async () => {
    await fillForm('alice', 'motdepasse');
    page.querySelector('form')!.dispatchEvent(new Event('submit'));
    server.expectOne('/api/sessions').flush({ token: 'jeton', username: 'alice' });
    server.expectOne('/api/sync').flush([]);
    await fixture.whenStable();

    page.querySelector<HTMLButtonElement>('.connected button')!.click();   // "Se déconnecter"
    server.expectOne({ method: 'DELETE', url: '/api/sessions/current' }).flush(null);
    server.expectOne('/api/sync').flush([]);
    await fixture.whenStable();

    expect(page.querySelector('form')).not.toBeNull();   // le formulaire de connexion est revenu
  });
});
