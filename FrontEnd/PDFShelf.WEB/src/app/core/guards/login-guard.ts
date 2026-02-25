import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth';

export const loginGuard: CanActivateFn = (route, state) => {

  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  // Se JÁ ESTIVER logado, redireciona para a prateleira (/shelf)
  // Isso evita que o usuário logado veja a tela de login de novo
  router.navigate(['/shelf']);
  return false; // Bloqueia o acesso à tela de login
};