// NOUVEAU : on importe provideHttpClient, qui "active" HttpClient
// (le service d'Angular qui envoie des requêtes HTTP au serveur).
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// La configuration globale de l'appli, lue au démarrage par main.ts.
// "providers" = la liste des fonctionnalités qu'Angular doit mettre à disposition.
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),   // (déjà là) affiche dans la console les erreurs non gérées
    provideRouter(routes),                   // (déjà là) le routeur, créé par ng new : on le garde
    provideHttpClient(),                     // NOUVEAU : sans lui, inject(HttpClient) dans todo-store.ts plante
  ],
};
