export const TERMS_LAST_UPDATED = '14 de mayo de 2026';

export interface LegalSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: '1. Aceptación de los términos',
    paragraphs: [
      'Al crear una cuenta o utilizar Healthy Space Club ("HSC", "la app", "el servicio"), aceptás estos Términos de Servicio. Si no estás de acuerdo, no uses el servicio.',
    ],
  },
  {
    heading: '2. Descripción del servicio',
    paragraphs: [
      'HSC es una aplicación de bienestar integral que utiliza inteligencia artificial para personalizar planes de nutrición, entrenamiento y acompañamiento emocional basados en el Healthy Space Method.',
    ],
    bullets: [
      'No somos un servicio médico ni reemplazamos atención profesional de salud.',
      'Las recomendaciones de IA son informativas y deben usarse con criterio personal.',
      'Si tenés condiciones médicas, consultá a un profesional antes de seguir cualquier plan.',
    ],
  },
  {
    heading: '3. Tu cuenta',
    paragraphs: [
      'Sos responsable de mantener la confidencialidad de tu contraseña y de toda actividad en tu cuenta. Notificá inmediatamente cualquier uso no autorizado.',
    ],
    bullets: [
      'Una cuenta por persona.',
      'Edad mínima: 18 años (o mayoría de edad en tu jurisdicción).',
      'Los datos que ingreses deben ser verídicos y actualizados.',
    ],
  },
  {
    heading: '4. Pagos y suscripciones',
    paragraphs: [
      'HSC ofrece planes de suscripción mensual y anual. Cuando los pagos estén activos vía Stripe, aplicarán las siguientes reglas:',
    ],
    bullets: [
      'El primer cobro ocurre al finalizar el periodo de prueba gratuita (3 días) salvo que canceles antes.',
      'Las suscripciones se renuevan automáticamente hasta que cancelés.',
      'Podés cancelar desde Ajustes en cualquier momento; conservás acceso hasta el final del periodo pagado.',
      'No emitimos reembolsos por periodos parciales salvo que la ley aplicable lo exija.',
    ],
  },
  {
    heading: '5. Uso aceptable',
    paragraphs: [
      'No podés usar HSC para fines ilegales, dañar a otras personas o el servicio, ni intentar acceder a partes restringidas del sistema.',
    ],
    bullets: [
      'No publicar contenido que infrinja derechos de terceros.',
      'No usar la IA para generar contenido dañino o engañoso.',
      'No revender ni redistribuir el servicio sin autorización.',
    ],
  },
  {
    heading: '6. Propiedad intelectual',
    paragraphs: [
      'Todo el contenido de HSC (código, diseño, copy, planes, metodología HSM) es propiedad de STRYV Studio. Tus datos personales y las reflexiones que escribís son tuyos; vos nos concedés una licencia para procesarlos y mejorar el servicio.',
    ],
  },
  {
    heading: '7. Limitación de responsabilidad',
    paragraphs: [
      'HSC se ofrece "tal cual". No garantizamos resultados específicos en peso, salud o bienestar. La app es una herramienta de apoyo, no un sustituto del juicio profesional.',
    ],
    bullets: [
      'No somos responsables por decisiones de salud que tomés basándote únicamente en sugerencias de la IA.',
      'No somos responsables por interrupciones del servicio fuera de nuestro control razonable.',
      'Nuestra responsabilidad total queda limitada al monto que hayas pagado en los últimos 12 meses.',
    ],
  },
  {
    heading: '8. Cambios en los términos',
    paragraphs: [
      'Podemos actualizar estos términos. Te notificaremos cambios importantes antes de aplicarlos. El uso continuado después de la notificación implica aceptación de los nuevos términos.',
    ],
  },
  {
    heading: '9. Ley aplicable y jurisdicción',
    paragraphs: [
      'Estos términos se rigen por las leyes de España. Cualquier disputa se resolverá ante los tribunales competentes de Valencia, salvo derechos imperativos del consumidor que la ley aplicable de tu residencia te conceda.',
    ],
  },
  {
    heading: '10. Contacto',
    paragraphs: [
      'Para cualquier consulta sobre estos términos, podés hablar con el coach IA en la app o escribir a soporte@stryvstudio.com.',
    ],
  },
];

export const TERMS_INTRO = 'Estos términos rigen tu uso de Healthy Space Club. Léelos con atención.';

export const TERMS_DISCLAIMER = 'Estos términos son una versión inicial. Una revisión legal profesional está prevista antes del lanzamiento público; podemos actualizarlos y te notificaremos antes de aplicar cambios sustanciales.';
