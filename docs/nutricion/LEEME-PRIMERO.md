# 📦 CALCULADORA DE ALIMENTOS — HSC · Paquete para David

Hola David. Este paquete es el módulo de nutrición de HSC que armé con la ayuda de
Claude. Está todo diseñado, con la lógica científica definida y un prototipo
funcional. Aquí te explico qué es cada archivo y qué habría que hacer.

---

## 🎯 QUÉ ES ESTO

Una calculadora de alimentos + plan nutricional para HSC, con dos partes:
1. **Onboarding** que calcula la meta del usuario (calorías + macros) con lógica
   científica y validaciones de seguridad.
2. **Calculadora** donde el usuario registra lo que come por comidas (desayuno,
   comida, cena, snacks), agrega alimentos o arma platillos.

Incluye una **base de datos nueva de 2,870 alimentos** (más completa que la que HSC
usa hoy) y una **auditoría completa** del cálculo nutricional actual de HSC con
correcciones basadas en evidencia.

---

## 📂 LOS ARCHIVOS

### 1. `PROTOTIPO-calculadora.html`
Ábrelo en el navegador. Es el prototipo funcional — muestra exactamente cómo debe
verse y funcionar (diseño, flujo, cálculos). Ya usa el sistema de diseño real de HSC
(colores, Montserrat, etc.). Es la referencia visual y de comportamiento.

### 2. `LOGICA-NUTRICIONAL-HSC.md` ⭐ EL MÁS IMPORTANTE
La especificación completa del sistema nutricional, con 12 puntos, cada uno con su
fundamento científico, fuente y año. Incluye una sección al inicio ("Cómo se
implementa esto") que explica qué cambios van en el código. Este documento es la
guía para dejar el cálculo de HSC científicamente correcto y seguro.

### 3. `foods.csv` + `food_measures.csv`
La base de datos nueva: 2,870 alimentos (5ª edición del sistema de equivalentes) +
sus medidas caseras. Yo (Magaly) los cargo a Supabase. Reemplazan la base 4ª edición
que HSC tiene hardcodeada.

### 4. `schema_completo.sql`
El SQL para crear las tablas en Supabase (foods, food_measures, platillos, registro,
perfil). Se corre una vez en el proyecto de Supabase.

### 5. `NUTRICION-HSC.md`
La auditoría que sacó Claude Code del código actual de HSC (cómo calcula hoy). Sirve
para comparar el "antes" con lo que propone el documento de lógica. Contexto útil.

### 6. `DISENO-HSC.md`
El sistema de diseño de HSC (colores, tipografía) que ya se aplicó al prototipo.
Referencia por si se necesita.

---

## ✅ QUÉ HAY QUE HACER (resumen)

### Yo (Magaly):
- Cargar `foods.csv` y `food_measures.csv` a Supabase (definir contigo en qué
  proyecto va).

### Tú (David) / Claude Code, siguiendo `LOGICA-NUTRICIONAL-HSC.md`:
1. Reemplazar la base 4ª edición hardcodeada → leer alimentos desde Supabase (5ª ed).
2. Corregir el cálculo de calorías/macros según el documento:
   - Agregar piso calórico de seguridad (hoy no existe — riesgo).
   - Cambiar déficit fijo −500 → déficit porcentual (20%).
   - Agregar capa de macros (proteína, grasa, carbos, fibra — hoy no se prescriben).
   - Agregar protección de menores/embarazo.
   - Agregar validaciones (datos imposibles, peso meta, bajo peso).
   - Agregar el factor "Atleta" (existe en código pero no es elegible).
3. Agregar preguntas al onboarding (embarazo/lactancia; opcional % grasa y meta).

### Regla clave para Claude Code:
- Seguir el documento sin inventar valores (todo está especificado con su fuente).
- En la app NUNCA mencionar la fuente de los datos. Solo la marca HSC.

---

## 📌 LO QUE AÚN FALTA (no está en este paquete)

Esto lo seguiré trabajando con Claude antes de que se integre del todo:
- **Modo Plan del día** (el sistema arma la semana con un banco de platillos).
- **Banco de platillos** (mi trabajo de nutrióloga: crear los desayunos, comidas...).
- **Tips de nutrióloga** (notificaciones).

Por ahora, lo de este paquete (calculadora + lógica + base de datos) ya es lo que se
puede empezar a integrar. Cuando tenga listo el resto, te lo paso.

---

## 💡 CÓMO EMPEZAR

Sugerencia: abre primero el `PROTOTIPO-calculadora.html` para ver cómo funciona todo,
y luego lee `LOGICA-NUTRICIONAL-HSC.md`. Con esos dos entiendes el 90%. Cuando le
pases esto a Claude Code, dale el documento de lógica + el prototipo juntos, y dile
que implemente siguiendo el documento sin inventar valores.

Cualquier duda me dices. 💚
