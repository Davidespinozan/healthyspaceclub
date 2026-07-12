// Prompt del HÍBRIDO de nutrición: la IA SELECCIONA los platillos de la semana
// (variedad, antojo, tiempos); el código ajusta porciones y valida alergias.
import type { BancoDish } from '../../data/banco';

export function buildWeeklyPlanSelectPrompt(p: {
  target: { kcal: number; protG: number; fatG: number; carbG: number };
  craving: string;
  bank: Record<'Desayuno' | 'Comida' | 'Cena' | 'Snack', BancoDish[]>;
}): string {
  const list = (dishes: BancoDish[]) =>
    dishes.map((d) => {
      const princ = d.ings.filter((i) => i.rol === 'principal').slice(0, 3).map((i) => i.nv).join(', ');
      return `- ${d.nombre}${princ ? ` (${princ})` : ''}`;
    }).join('\n');
  const craving = p.craving.trim();

  return `Eres un nutriólogo experto. Arma un plan de comidas de 7 días ELIGIENDO platillos del banco de abajo. Las porciones/gramos se ajustan después automáticamente — tú SOLO decides QUÉ platillo va en cada tiempo de cada día.

META DIARIA (referencia — NO calcules gramos): ${p.target.kcal} kcal · ${p.target.protG} g proteína · ${p.target.fatG} g grasa · ${p.target.carbG} g carbohidratos.
${craving
  ? `ANTOJO DEL USUARIO: "${craving}". Inclúyelo 1-2 veces en la semana (NUNCA más), en el tiempo que corresponda. Si ningún platillo del banco encaja con el antojo, ignóralo.`
  : 'El usuario no pidió antojos específicos.'}

REGLAS (críticas):
- Cada día lleva EXACTAMENTE: 1 desayuno, 1 comida, 1 cena, y 2 snacks (uno de mañana, uno de tarde).
- Elige SOLO platillos de las listas de abajo, con su nombre EXACTO. NO inventes, NO cambies ni traduzcas nombres.
- Cada tiempo se elige de SU lista (el desayuno de DESAYUNOS, la comida de COMIDAS, etc.).
- VARIEDAD OBLIGATORIA: los 7 desayunos TODOS distintos entre sí; las 7 comidas TODAS distintas; las 7 cenas TODAS distintas. Snacks lo más variados posible (no repitas el mismo más de 2 veces en la semana).
- Piensa como coach: equilibra proteína, varía ingredientes y estilos día a día, evita monotonía (no pongas atún o pollo todos los días si puedes rotar).

DESAYUNOS:
${list(p.bank.Desayuno)}

COMIDAS:
${list(p.bank.Comida)}

CENAS:
${list(p.bank.Cena)}

SNACKS:
${list(p.bank.Snack)}

Responde SOLO este JSON (sin markdown), con los 7 días en orden:
{ "dias": [
  { "desayuno": "nombre exacto", "comida": "nombre exacto", "cena": "nombre exacto", "snacks": ["nombre exacto", "nombre exacto"] }
] }`;
}
