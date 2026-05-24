import type { UserProfile } from '../types';

/**
 * Construye el bloque "PERFIL DEL USUARIO" para el prompt de IA.
 * Devuelve '' (string vacío) si todos los campos están vacíos —
 * así el prompt no se contamina con "no especificado" repetido cinco veces.
 *
 * Mudado desde utils/workoutPlanner.ts en el Lote Coach-A para que viva
 * con el resto de los builders de prompts (src/ai/).
 */
export function buildUserProfileBlock(profile: UserProfile | undefined): string {
  if (!profile) return '';

  const hasAny =
    profile.sex !== undefined ||
    profile.edad !== undefined ||
    profile.peso !== undefined ||
    profile.estatura !== undefined ||
    profile.activity !== undefined;

  if (!hasAny) return '';

  return `\nPERFIL DEL USUARIO:
- Sexo: ${profile.sex ?? 'no especificado'}
- Edad: ${profile.edad !== undefined ? `${profile.edad} años` : 'no especificado'}
- Peso: ${profile.peso !== undefined ? `${profile.peso} kg` : 'no especificado'}
- Estatura: ${profile.estatura !== undefined ? `${profile.estatura} cm` : 'no especificado'}
- Nivel de actividad habitual: ${profile.activity ?? 'no especificado'}
`;
}
