/*
 * Le « modèle » de l'application : la forme des données qu'on manipule.
 *
 * Une interface TypeScript décrit un objet : le nom et le type de chacune de ses propriétés.
 * Elle sert pendant l'écriture du code : l'éditeur signale les fautes de frappe et propose
 * la complétion. Elle ne produit aucun code dans le navigateur.
 *
 * « export » rend l'interface utilisable dans les autres fichiers (avec import).
 */

/** Une tâche à réaliser. */
export interface Task {
  /** Numéro unique de la tâche. */
  id: number;
  /** Ce qu'il y a à faire, par exemple « Acheter du pain ». */
  title: string;
  /** true quand la tâche est réalisée, false sinon. */
  done: boolean;
}

/** Une liste de tâches, avec son nom. */
export interface TodoList {
  /** Numéro unique de la liste. */
  id: number;
  /** Nom choisi à la création, par exemple « Courses ». */
  name: string;
  /** Les tâches de la liste, dans l'ordre d'ajout. Task[] signifie « un tableau de Task ». */
  tasks: Task[];
}
