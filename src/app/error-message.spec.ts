import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './error-message';

// Le test le plus simple : une fonction ordinaire. On l'appelle, on vérifie ce qu'elle renvoie.
describe('errorMessage', () => {
  it("reprend l'explication envoyée par le serveur", () => {
    const error = new HttpErrorResponse({ status: 404, error: { error: "La liste 3 n'existe pas." } });

    expect(errorMessage(error)).toBe("La liste 3 n'existe pas.");
  });

  it("dit que le serveur est injoignable quand il n'y a pas d'explication", () => {
    const error = new HttpErrorResponse({ status: 502, error: null });   // serveur arrêté

    expect(errorMessage(error)).toBe('Impossible de joindre le serveur. Est-il bien lancé ?');
  });
});
