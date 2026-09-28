import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountPanel } from './account-panel/account-panel';
import { AuthStore } from './auth-store';
import { ListCard } from './list-card/list-card';
import { TodoList } from './todo';
import { TodoStore } from './todo-store';

@Component({
  selector: 'app-root',
  imports: [FormsModule, AccountPanel, ListCard],   // NOUVEAU : AccountPanel
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly store = inject(TodoStore);
  protected readonly auth = inject(AuthStore);      // NOUVEAU : pour dire où vont les listes
  protected readonly title = 'Mes listes de tâches';
  protected readonly newListName = signal('');

  protected createList(): void {
    const name = this.newListName().trim();
    if (!name) {
      return;
    }
    this.store.createList(name);
    this.newListName.set('');
  }

  protected deleteList(list: TodoList): void {
    if (confirm(`Supprimer la liste « ${list.name} » et toutes ses tâches ?`)) {
      this.store.deleteList(list);
    }
  }
}
