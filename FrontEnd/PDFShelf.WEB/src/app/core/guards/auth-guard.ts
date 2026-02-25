import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth'; // Importa o seu serviço de autenticação

export const authGuard: CanActivateFn = (route, state) => {
  
  const authService = inject(AuthService);
  const router = inject(Router);

    if (authService.isAuthenticated()) {
    return true;
  }

  // Se NÃO estiver logado, redireciona para a página de login
  router.navigate(['/auth/login']);
  return false; // Bloqueia o acesso
};