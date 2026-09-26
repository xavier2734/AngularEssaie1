import { TestBed } from '@angular/core/testing';
import { ListCard } from './list-card';
import { Task, TodoList } from '../todo';   // ../ = on remonte d'un dossier

// Une fausse liste : 2 tâches, une faite, une pas faite.
const COURSES: TodoList = {
  id: 1,
  name: 'Courses',
  tasks: [
    { id: 1, title: 'Pain', done: true },
    { id: 2, title: 'Lait', done: false },
  ],
};

describe('ListCard', () => {
  // Fabrique une carte avec la liste donnée, attend l'affichage, et renvoie ce dont les tests ont besoin.
  async function render(list: TodoList) {
    const fixture = TestBed.createComponent(ListCard);   // fabrique le composant (pas besoin de providers ici)
    fixture.componentRef.setInput('list', list);          // = ce que fait App avec [list]="list"
    await fixture.whenStable();                           // attend que le HTML soit dessiné
    return {
      fixture,
      card: fixture.componentInstance,                    // la classe ListCard (pour écouter ses sorties)
      el: fixture.nativeElement as HTMLElement,           // le HTML rendu (pour lire et cliquer)
    };
  }

  // ---------- l'affichage ----------

  it('affiche le nom, les tâches et le compteur', async () => {
    const { el } = await render(COURSES);

    expect(el.querySelector('h2')?.textContent).toContain('Courses');
    // querySelectorAll('li') = toutes les lignes de tâche ; length = combien il y en a.
    expect(el.querySelectorAll('li').length).toBe(2);
    // Le compteur "1 / 2" (1 faite sur 2). trim() enlève les espaces autour.
    expect(el.querySelector('.count')?.textContent?.trim()).toBe('1 / 2');
  });

  it("ne barre pas le nom tant qu'une tâche n'est pas faite", async () => {
    const { el } = await render(COURSES);
    // classList.contains('done') = "la balise a-t-elle la classe CSS done ?"
    expect(el.querySelector('h2')?.classList.contains('done')).toBe(false);
  });

  it('barre le nom quand toutes les tâches sont faites', async () => {
    // { ...COURSES, tasks: [...] } = une COPIE de Courses, avec d'autres tâches (toutes faites).
    const allDone: TodoList = {
      ...COURSES,
      tasks: COURSES.tasks.map((task) => ({ ...task, done: true })),
    };
    const { el } = await render(allDone);

    expect(el.querySelector('h2')?.classList.contains('done')).toBe(true);
    expect(el.querySelector('.count')?.textContent?.trim()).toBe('2 / 2');
  });

  it('affiche "Aucune tâche" et pas de compteur pour une liste vide', async () => {
    const { el } = await render({ id: 2, name: 'Bonus', tasks: [] });

    expect(el.textContent).toContain('Aucune tâche pour l');   // le message du @empty
    expect(el.querySelector('.count')).toBeNull();             // le @if a caché le compteur
    expect(el.querySelector('h2')?.classList.contains('done')).toBe(false);   // liste vide = PAS barrée
  });

  // ---------- les sorties (ce que la carte ÉMET) ----------

  it('émet toggleTask quand on clique sur une case', async () => {
    const { card, el } = await render(COURSES);
    // On "écoute" la sortie, comme App avec (toggleTask)="...". Chaque tâche émise est rangée dans ce tableau.
    const emitted: Task[] = [];
    card.toggleTask.subscribe((task) => emitted.push(task));

    // querySelectorAll(...)[1] = la 2e case = celle de "Lait". ! = "je suis sûr qu'elle existe".
    el.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1]!.click();

    expect(emitted).toEqual([COURSES.tasks[1]]);   // la carte a bien envoyé "Lait"
  });

  it('émet deleteTask quand on clique sur le ✕ d\'une tâche', async () => {
    const { card, el } = await render(COURSES);
    const emitted: Task[] = [];
    card.deleteTask.subscribe((task) => emitted.push(task));

    // 'li .delete' = les boutons ✕ DANS une ligne de tâche ; [0] = celui de "Pain".
    el.querySelectorAll<HTMLButtonElement>('li .delete')[0]!.click();

    expect(emitted).toEqual([COURSES.tasks[0]]);
  });

  it('émet deleteList quand on clique sur le ✕ de la liste', async () => {
    const { card, el } = await render(COURSES);
    let clicked = 0;                                   // deleteList n'envoie rien (void) : on compte juste les clics
    card.deleteList.subscribe(() => clicked++);

    // '.card-header .delete' = le ✕ dans l'en-tête de la carte (pas ceux des tâches).
    el.querySelector<HTMLButtonElement>('.card-header .delete')!.click();

    expect(clicked).toBe(1);
  });

  // ---------- le formulaire "Nouvelle tâche" ----------

  // Petit outil : "tape ce texte dans le champ Nouvelle tâche".
  async function type(el: HTMLElement, fixture: { whenStable(): Promise<unknown> }, text: string) {
    const input = el.querySelector<HTMLInputElement>('.new-task input')!;
    input.value = text;                          // on écrit dans le champ…
    input.dispatchEvent(new Event('input'));     // …et on prévient Angular "on a tapé" (c'est ce qu'écoute ngModel)
    await fixture.whenStable();                  // on attend que l'écran suive
  }

  const addButton = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.new-task button')!;

  it('grise le bouton Ajouter tant que le champ est vide', async () => {
    const { fixture, el } = await render(COURSES);
    expect(addButton(el).disabled).toBe(true);   // vide au départ → grisé

    await type(el, fixture, '   ');              // que des espaces…
    expect(addButton(el).disabled).toBe(true);   // …toujours grisé (grâce au trim())

    await type(el, fixture, 'Beurre');
    expect(addButton(el).disabled).toBe(false);  // un vrai texte → cliquable
  });

  it('émet addTask avec le titre tapé, puis vide le champ', async () => {
    const { fixture, card, el } = await render(COURSES);
    const emitted: string[] = [];
    card.addTask.subscribe((title) => emitted.push(title));

    await type(el, fixture, '  Beurre  ');
    // On "envoie" le formulaire, comme la touche Entrée. ngSubmit écoute cet événement "submit".
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual(['Beurre']);          // le titre est envoyé, SANS les espaces (trim)
    expect(addButton(el).disabled).toBe(true);    // le champ a été vidé → le bouton est re-grisé
  });
    it("n'émet rien si on envoie le formulaire avec seulement des espaces", async () => {
    const { fixture, card, el } = await render(COURSES);
    const emitted: string[] = [];
    card.addTask.subscribe((title) => emitted.push(title));

    await type(el, fixture, '   ');                                   // que des espaces
    el.querySelector('form')!.dispatchEvent(new Event('submit'));    // = touche Entrée (le bouton, lui, est grisé)
    await fixture.whenStable();

    expect(emitted).toEqual([]);   // rien n'a été envoyé à App : le "return" de la ligne 40 a fait son travail
  });
});
