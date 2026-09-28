import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from './auth-store';

// Un INTERCEPTEUR voit passer TOUTES les requêtes, juste avant leur départ.
// Celui-ci colle le badge (le jeton) dessus quand on est connecté.
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthStore).token();
  if (token === null) {
    return next(request);    // pas connecté : la requête part telle quelle (mode test)
  }
  // Une requête ne se modifie pas : clone() en fabrique une copie avec l'en-tête en plus.
  return next(request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
