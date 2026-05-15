import type { LegalSection } from './terms';

export const PRIVACY_LAST_UPDATED = '14 de mayo de 2026';

export const PRIVACY_INTRO = 'Tu privacidad importa. Esta política explica qué datos recogemos, cómo los usamos y qué derechos tenés.';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Datos que recogemos',
    paragraphs: [
      'Recogemos solo los datos necesarios para que HSC funcione y te entregue un servicio personalizado:',
    ],
    bullets: [
      'Identidad: nombre, correo electrónico, contraseña (encriptada por Supabase Auth).',
      'Datos del onboarding: sexo, edad, peso, estatura, nivel de actividad, objetivo de salud.',
      'Registros de uso: workout logs, food logs, respuestas HSM, racha, hábitos.',
      'Datos de pago: cuando los pagos vía Stripe estén activos, Stripe gestiona los datos de tarjeta. Nosotros solo guardamos identificadores de suscripción.',
      'Datos técnicos: tipo de dispositivo, idioma, errores de la app (para diagnóstico).',
    ],
  },
  {
    heading: '2. Para qué usamos tus datos',
    bullets: [
      'Personalizar planes de nutrición y entrenamiento adaptados a tu perfil real.',
      'Generar acompañamiento del coach IA con contexto de tus datos.',
      'Mostrar tu progreso, racha, logros y reflexiones HSM acumuladas.',
      'Procesar pagos y enviar comunicaciones esenciales del servicio.',
      'Mejorar el servicio (análisis agregados, nunca exposición individual).',
    ],
  },
  {
    heading: '3. Sub-procesadores',
    paragraphs: [
      'Para operar HSC contratamos a los siguientes proveedores. Cada uno tiene sus propios estándares de seguridad y políticas de privacidad:',
    ],
    bullets: [
      'Supabase: base de datos, autenticación y almacenamiento.',
      'Anthropic (Claude): procesamiento de IA para el coach y generadores de planes. Los prompts incluyen tu perfil resumido; no se usa para entrenar modelos.',
      'Netlify: hosting de la aplicación.',
      'Stripe: procesamiento de pagos (cuando esté activo).',
    ],
  },
  {
    heading: '4. Retención de datos',
    paragraphs: [
      'Conservamos tus datos mientras tu cuenta esté activa. Si eliminás tu cuenta, los datos se borran o anonimizan en un plazo máximo de 30 días, salvo obligaciones legales que requieran conservación adicional (facturación, fraude).',
    ],
  },
  {
    heading: '5. Tus derechos',
    paragraphs: [
      'Bajo el RGPD (UE/EEA) y leyes equivalentes (LFPDPPP en México, LGPD en Brasil, CCPA en California, etc.) tenés derecho a:',
    ],
    bullets: [
      'Acceso: obtener una copia de tus datos.',
      'Rectificación: corregir datos inexactos.',
      'Supresión: eliminar tu cuenta y todos tus datos.',
      'Portabilidad: recibir tus datos en formato estándar.',
      'Oposición: dejar de procesar tus datos para fines específicos.',
      'Retiro de consentimiento: cuando el tratamiento se base en tu consentimiento.',
    ],
  },
  {
    heading: '6. Cómo ejercer tus derechos',
    paragraphs: [
      'Podés ejercer cualquiera de estos derechos hablando con el coach IA en la app (te guiará al proceso) o escribiendo a soporte@stryvstudio.com. Respondemos en un plazo máximo de 30 días.',
    ],
  },
  {
    heading: '7. Seguridad',
    paragraphs: [
      'Aplicamos medidas técnicas y organizativas razonables: cifrado en tránsito (HTTPS/TLS), autenticación JWT, control de acceso por usuario en la base de datos, y revisiones periódicas. Ningún sistema es 100% inviolable; te notificaremos si ocurriera una brecha con impacto en tus datos.',
    ],
  },
  {
    heading: '8. Cookies y almacenamiento local',
    paragraphs: [
      'Usamos solo lo esencial:',
    ],
    bullets: [
      'localStorage para mantener tu sesión y datos del onboarding mientras la app corre.',
      'Cookie de sesión de Supabase para mantenerte logueado.',
      'No usamos cookies publicitarias ni de tracking de terceros.',
    ],
  },
  {
    heading: '9. Menores de edad',
    paragraphs: [
      'HSC no está dirigido a menores de 18 años. Si descubrimos que se ha creado una cuenta de un menor, la eliminaremos.',
    ],
  },
  {
    heading: '10. Cambios en esta política',
    paragraphs: [
      'Podemos actualizar esta política. Te notificaremos cambios sustanciales con al menos 15 días de antelación. La fecha de última actualización aparece al pie de este documento.',
    ],
  },
  {
    heading: '11. Contacto',
    paragraphs: [
      'STRYV Studio · Valencia, España · soporte@stryvstudio.com. Para asuntos de privacidad específicamente, indicá "Privacidad" en el asunto del correo.',
    ],
  },
];

export const PRIVACY_DISCLAIMER = 'Esta política es una versión inicial. Una revisión legal profesional y un Delegado de Protección de Datos (DPO) formal están previstos antes del lanzamiento público.';
