import { HttpErrorResponse } from '@angular/common/http';

// Transforme une erreur HTTP en phrase lisible. Avant, c'était dans TodoStore ;
// on la sort dans son propre fichier car le panneau du compte en a besoin aussi.
export function errorMessage(error: HttpErrorResponse): string {
  const serverMessage = error.error?.error;       // le message du serveur Java, s'il y en a un
  if (typeof serverMessage === 'string') {
    return serverMessage;
  }
  return 'Impossible de joindre le serveur. Est-il bien lancé ?';
}
