// Versión de la landing pública (pantalla 'landing' de App). Único punto de
// selección: no hay query, flag de entorno ni ruta pública para la otra versión.
//
// Volver a V1: cambiar a 'v1' y desplegar de nuevo. Las dos pantallas siguen en el
// código con sus propios recursos (LandingScreen.tsx = V1, LandingScreenV2.tsx = V2)
// y comparten login, registro, pagos y onboarding del store.
export type LandingVersion = 'v1' | 'v2';

export const LANDING_VERSION: LandingVersion = 'v2';
