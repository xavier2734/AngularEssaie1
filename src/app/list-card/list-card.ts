import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Task, TodoList } from '../todo';   // ../ = on remonte d'un dossier (on est dans list-card/)

@Component({
  selector: 'app-list-card',        // la balise <app-list-card> utilisée dans app.html
  imports: [FormsModule],           // la carte a son propre formulaire → besoin de ngModel
  templateUrl: './list-card.html',
  styleUrl: './list-card.css',
})
export class ListCard {
  // ENTRÉE : la liste à afficher, donnée par App avec [list]="...".
  readonly list = input.required<TodoList>();

  // Étape 06 : la liste est terminée s'il y a au moins une tâche ET qu'elles sont toutes faites.
  // computed se recalcule tout seul quand list change.
  protected readonly completed = computed(() => {
    const tasks = this.list().tasks;
    return tasks.length > 0 && tasks.every((task) => task.done);
  });

  // Étape 06 : combien de tâches faites (pour "2 / 3"). filter garde les faites, length les compte.
  protected readonly doneCount = computed(
    () => this.list().tasks.filter((task) => task.done).length,
  );

  // SORTIES : ce que la carte envoie à App.
  readonly addTask = output<string>();     // envoie le titre tapé
  readonly toggleTask = output<Task>();    // envoie la tâche cliquée
  readonly deleteTask = output<Task>();    // envoie la tâche à supprimer
  readonly deleteList = output<void>();    // n'envoie rien, dit juste "clic"

  // Ce qu'on tape dans le champ "Nouvelle tâche" de CETTE carte (chaque carte a le sien).
  protected readonly newTaskTitle = signal('');

  /** Petit formulaire de la carte envoyé. */
  protected submitTask(): void {
    const title = this.newTaskTitle().trim();
    if (!title) {
      return;
    }
    this.addTask.emit(title);    // la carte n'ajoute rien elle-même : elle prévient App
    this.newTaskTitle.set('');   // et vide son champ
  }
}
