import { Pipe, PipeTransform } from '@angular/core';

// @Pipe = "cette classe est un pipe". name = le nom qu'on écrit dans le HTML après le | .
@Pipe({ name: 'taskCount' })
export class TaskCountPipe implements PipeTransform {
  // transform reçoit le nombre de tâches, et renvoie le texte à afficher.
  transform(count: number): string {
    if (count === 0) {
      return 'Aucune tâche';
    }
    if (count === 1) {
      return '1 tâche';
    }
    return `${count} tâches`;
  }
}
