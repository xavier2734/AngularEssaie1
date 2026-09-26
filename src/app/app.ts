// "inject" en plus : c'est avec lui qu'on récupère le service.
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ListCard } from './list-card/list-card';
import { TodoList } from './todo';
import { TodoStore } from './todo-store';

@Component({
  selector: 'app-root',
  imports: [FormsModule, ListCard],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // "Angular, donne-moi LE TodoStore." On ne fait jamais new TodoStore() :
  // Angular le crée la 1re fois qu'on le demande, puis donne toujours le même.
  // C'est ça, "l'injection de dépendances".
  // protected : le HTML s'en sert directement (store.lists(), store.addTask(...)).
  protected readonly store = inject(TodoStore);

  protected readonly title = 'Mes listes de tâches';

  // Le texte en cours de saisie RESTE ici : c'est un détail d'affichage, pas une donnée à partager.
  protected readonly newListName = signal('');

  /** Formulaire "nouvelle liste" envoyé. */
  protected createList(): void {
    const name = this.newListName().trim();
    if (!name) {
      return;
    }
    this.store.createList(name);   // les DONNÉES : c'est le service qui s'en occupe
    this.newListName.set('');       // le CHAMP : c'est App qui vide le sien
  }

  /** ✕ d'une liste : App pose la question, le service supprime. */
  protected deleteList(list: TodoList): void {
    if (confirm(`Supprimer la liste « ${list.name} » et toutes ses tâches ?`)) {
      this.store.deleteList(list);
    }
  }

  // Et c'est tout ! Plus de lists, nextId, addTask, toggleTask, deleteTask, updateTasks :
  // ils sont tous partis dans le service.
}
