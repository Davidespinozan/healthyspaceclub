// i18n de contenido (enfoque A) — overlay EN del banco de ejercicios.
// A2a: name (solo fuerza/cardio; yoga mantiene su nombre inglés/sánscrito
// del banco base) + desc + tip. A2b sumará steps + variantes.
// Se mergea sobre `exercises` cuando locale==='en' (ver getExercises).
// Criterio: nombres funcionales se traducen (Squat/Deadlift); culturales
// no aplican acá. IDs/muscleGroup/equipment NO se tocan.

export interface ExerciseOverlay {
  name?: string;
  desc?: string;
  tip?: string;
}

export const exercisesEn: Record<string, ExerciseOverlay> = {
  // ── PECHO ──
  'press-horizontal': { name: 'Horizontal Press', desc: 'Chest push on a flat bench — the foundational pattern for mid-chest mass.', tip: 'Keep your shoulder blades retracted for the whole set to protect your shoulders and maximize chest activation.' },
  'press-inclinado': { name: 'Incline Press', desc: 'Press on a 30–45° bench — emphasizes the upper (clavicular) chest.', tip: "Don't set the angle too high — past 45° it becomes an overhead press and you lose the chest." },
  'press-declinado': { name: 'Decline Press', desc: 'Press on a declined bench — emphasizes the lower chest and triceps.', tip: "If you've never gone decline, start with a conservative weight — the range is shorter and feels different." },
  'aperturas': { name: 'Chest Flyes', desc: 'Arms extended sweeping across the front — deep stretch and chest isolation.', tip: "Your elbows NEVER change angle — if they bend more on the way up you're pressing, not flying." },
  'fondos-paralelas': { name: 'Parallel Bar Dips', desc: 'Pushing down with the body suspended — chest, triceps and shoulders.', tip: 'For more triceps, stay upright. For more chest, lean forward.' },
  'flexiones-diamante': { name: 'Diamond Push-ups', desc: 'Push-up with hands together forming a diamond — triceps and inner chest.', tip: 'If your wrists hurt, open your hands slightly — the diamond shape itself is not the point.' },
  'flexiones-archer': { name: 'Archer Push-ups', desc: 'Single-arm push-up with the other arm extended — an advanced step toward the one-arm push-up.', tip: "If you can't keep the extended arm straight, you're not ready yet — train decline diamond push-ups first." },
  'pec-deck': { name: 'Pec Deck', desc: 'Arms closing in to contract the chest — pure isolation on a machine.', tip: 'Great for drop sets and safe failure — no risk of dropping weight on yourself.' },
  // ── ESPALDA ──
  'traccion-vertical-pesada': { name: 'Pull-up', desc: 'Pulling your body up to the bar from above — the king of back patterns.', tip: "If you can't do 5 clean pull-ups, start with assistance (band or machine) or negatives." },
  'traccion-vertical-polea': { name: 'Lat Pulldown', desc: 'Pulling weight down from above on a cable — a progressive alternative to pull-ups.', tip: "Don't swing your torso — if you need to, the weight is too heavy." },
  'remo-horizontal-pesado': { name: 'Bent-Over Row', desc: 'Pulling weight toward your abdomen — mass and thickness for the whole back.', tip: 'If your lower back rounds you’ve lost the pattern — drop the weight until you can keep a neutral spine.' },
  'remo-unilateral': { name: 'Single-Arm Row', desc: 'Pulling weight one side at a time toward the hip — corrects asymmetries and deep recruitment.', tip: 'Don’t rotate your torso to "help" — if you do, the weight is too heavy or you’re fatigued.' },
  'remo-invertido': { name: 'Inverted Row', desc: 'Row with the body suspended — the bodyweight equivalent of the bent-over row.', tip: 'More horizontal = harder. Start with a high bar and lower it as you progress.' },
  'pullover': { name: 'Pullover', desc: 'Arms extended moving weight from behind your head to the front — connects chest and lats.', tip: 'Elbows slightly bent and FIXED — they don’t extend or bend more during the movement.' },
  'hiperextensiones': { name: 'Back Extensions', desc: 'Lower-back extension — strengthens the posterior chain and prevents low-back pain.', tip: 'Don’t "hyperextend" despite the name — come up only to a straight line to protect your lower back.' },
  'face-pull': { name: 'Face Pull', desc: 'Pulling a rope toward your face — shoulder health and posture.', tip: 'Ideal for postural health — add 2–3 sets at the end of every push workout.' },
  'shrugs': { name: 'Shrugs', desc: 'Trap elevation — upper trapezius development.', tip: 'Do NOT roll your shoulders — the movement is strictly vertical, up and down.' },
  // ── HOMBRO ──
  'press-vertical': { name: 'Overhead Press', desc: 'Pressing from the shoulders straight up — the king of delt patterns.', tip: 'Your face passes under the bar as you press — if you arch your back a lot, drop the weight.' },
  'elevacion-lateral': { name: 'Lateral Raise', desc: 'Straight arm raising out to the side — side-delt isolation.', tip: 'Imagine pouring out a pitcher of water with each hand — pinky up isolates the side delt better.' },
  'elevacion-frontal': { name: 'Front Raise', desc: 'Straight arm raising to the front — front-delt isolation.', tip: 'Don’t swing — if you need to push with your hips to lift, drop the weight.' },
  'vuelo-posterior': { name: 'Rear Delt Fly', desc: 'Arms opening to the back — rear-delt isolation, key for posture.', tip: 'Imagine opening closet doors — hands away from your body, not behind it.' },
  'upright-row': { name: 'Upright Row', desc: 'Pulling weight close to the body up to the chin — upper traps and side delts.', tip: 'Don’t go above shoulder height — protect the rotator cuff.' },
  // ── BRAZO (bíceps) ──
  'curl-pie': { name: 'Standing Curl', desc: 'Elbow flexion with palms up — the classic biceps pattern.', tip: 'Your elbows are hinges — if they drift forward on the way up, you’re cheating with the shoulder.' },
  'curl-martillo': { name: 'Hammer Curl', desc: 'Curl with neutral palms — biceps and brachialis (thickens the arm).', tip: 'If you want to thicken the arm (not just the biceps peak), prioritize this one.' },
  'curl-predicador': { name: 'Preacher Curl', desc: 'Curl with the arm supported — maximum biceps focus without shoulder cheating.', tip: 'Don’t fully extend the elbow at the bottom — keep a slight bend to protect the tendon.' },
  'curl-concentrado': { name: 'Concentration Curl', desc: 'Curl with the elbow braced on the thigh — total biceps isolation.', tip: 'Ideal to finish a biceps workout — chase the mind-muscle connection.' },
  // ── BRAZO (tríceps) ──
  'press-frances': { name: 'Lying Triceps Extension', desc: 'Elbow extension lying down — the base pattern for triceps mass.', tip: 'The elbows do NOT flare — point them at the ceiling the whole way to protect the joint.' },
  'extensiones-sobre-cabeza': { name: 'Overhead Triceps Extension', desc: 'Extension with arms overhead — maximum stretch of the long head of the triceps.', tip: 'The long head only stretches when the arm is overhead — include this pattern every week.' },
  'triceps-push-down': { name: 'Triceps Pushdown', desc: 'Pushing down from above with fixed elbows — a classic for triceps definition.', tip: 'Your elbows are fixed pivots — if they drift from your body, you’re helping with the shoulder.' },
  'patada-triceps': { name: 'Triceps Kickback', desc: 'Extension with the arm parallel to the torso — pure triceps isolation.', tip: 'Low weight, high control — chase the mind-muscle connection, not heavy loads.' },
  'fondos-triceps': { name: 'Triceps Dips', desc: 'Pushing down with an upright torso — the dominant triceps pattern.', tip: 'For triceps, stay upright. If you lean forward, you turn this into chest dips.' },
  'press-cerrado': { name: 'Close-Grip Press', desc: 'Press with hands close together — triceps-dominant with chest assistance.', tip: 'Do NOT bring hands closer than ~25cm — it hurts the wrists. Torso width is enough.' },
  // ── PIERNA (cuádriceps) ──
  'sentadilla-bilateral': { name: 'Squat', desc: 'Bending both knees with load at once — the king of lower-body patterns.', tip: 'Knees track over your toes — don’t let them collapse inward.' },
  'sentadilla-unilateral': { name: 'Single-Leg Squat', desc: 'Bending over one leg — corrects asymmetries and builds hip stability.', tip: 'The front knee shouldn’t collapse inward — keep it in line with your second toe.' },
  'zancada': { name: 'Lunge', desc: 'A long step bending both legs — unilateral quad and glute development.', tip: 'The back knee drops straight toward the floor — if it goes forward, your step was too short.' },
  'prensa-piernas': { name: 'Leg Press', desc: 'Horizontal/incline leg push — maximum load without axial demand.', tip: 'Do NOT lock your knees at the top — keep continuous tension and protect the joints.' },
  'step-up': { name: 'Step-up', desc: 'Stepping onto a platform with one leg — functional unilateral strength.', tip: 'Don’t push off with the back leg — the leg that steps up does ALL the work.' },
  'extension-cuadriceps': { name: 'Leg Extension', desc: 'Isolated knee extension — pure quad isolation.', tip: 'Don’t lock or hyperextend the knees at the top — protect the joint.' },
  'sissy-squat': { name: 'Sissy Squat', desc: 'Leaning back with knees forward — an extreme quad stretch.', tip: 'Advanced movement — if you’ve never done it, start with support (a power-rack bar).' },
  'sentadilla-pliometrica': { name: 'Jump Squat', desc: 'Explosive from the squat — power and fast-twitch fiber recruitment.', tip: 'A power move — quality over quantity. Low explosive reps, not many tired ones.' },
  // ── PIERNA (cadena posterior) ──
  'peso-muerto-convencional': { name: 'Conventional Deadlift', desc: 'Vertical pull from the floor — the king of posterior-chain patterns.', tip: 'If your lower back rounds you’re in the red zone — stop immediately and drop the weight.' },
  'peso-muerto-rumano': { name: 'Romanian Deadlift (RDL)', desc: 'Hip hinge with nearly fixed knees — maximum hamstring stretch.', tip: 'The movement is in the hips, NOT the spine — the lower back stays neutral the whole range.' },
  'peso-muerto-sumo': { name: 'Sumo Deadlift', desc: 'Deadlift with a wide stance — emphasizes the glute medius and adductors.', tip: 'In sumo, the adductors and glute medius do a lot of work — useful if your lower back limits the conventional.' },
  'peso-muerto-unilateral': { name: 'Single-Leg Deadlift', desc: 'Hip hinge on one leg — balance, stability and symmetry.', tip: 'If you wobble, lightly tap the floor with your free toe — it’s not cheating, it’s a smart regression.' },
  'hip-thrust': { name: 'Hip Thrust', desc: 'Horizontal hip extension — the king of glute patterns.', tip: 'The movement is hip EXTENSION — it’s not a horizontal squat. The glute contraction is what matters.' },
  'curl-femoral': { name: 'Hamstring Curl', desc: 'Isolated knee flexion — mass for the hamstrings.', tip: 'To feel the hamstring better, point your toes toward you during the curl.' },
  'good-morning': { name: 'Good Morning', desc: 'Hip hinge with a bar on the shoulders — posterior-chain strength.', tip: 'Start with VERY light weight — the forward torso looks easy but the leverage is brutal.' },
  'patada-gluteo': { name: 'Glute Kickback', desc: 'Unilateral hip extension on all fours — pure glute isolation.', tip: 'Don’t arch your back — the movement is only at the hip, the spine stays neutral.' },
  'abduccion-cadera': { name: 'Hip Abduction', desc: 'Moving the leg away from the center — glute medius isolation.', tip: 'Lean your torso slightly forward to target the glute medius more than the TFL.' },
  'caminata-lateral-monstruo': { name: 'Lateral Walk / Monster Walk', desc: 'Side steps under band tension — glute medius activation.', tip: 'Great before leg or lower-body training — wakes up the glute medius to stabilize the hip.' },
  // ── CORE ──
  'anti-extension-isometrica': { name: 'Isometric Anti-Extension', desc: 'Holding the body in a straight line resisting lumbar extension — the base of core stability.', tip: 'If you only hold 15 seconds with perfect form, that beats 60 with a sagging hip.' },
  'anti-lateral': { name: 'Anti-Lateral', desc: 'Holding posture while resisting lateral torso flexion — oblique stability.', tip: 'The hip tends to sag toward the floor — push it up as if wearing a tight belt.' },
  'anti-rotacion': { name: 'Anti-Rotation', desc: 'Resisting torso rotation against a lateral load — deep functional strength.', tip: 'The core works MORE resisting movement than creating it — this is the test.' },
  'flexion-espinal-pesada': { name: 'Weighted Spinal Flexion', desc: 'Curling the torso toward the hips with resistance — classic rectus abdominis hypertrophy.', tip: 'The movement is spinal flexion — the hips stay fixed, you’re not doing a full sit-up from the hip.' },
  'levantamiento-piernas': { name: 'Leg Raise', desc: 'Hip flexion with the legs — lower abs and hip flexors.', tip: 'Don’t swing — if you need momentum to lift, go back to knee raises until you own the range.' },
  'rotacion-con-peso': { name: 'Weighted Rotation', desc: 'Torso rotation against resistance — dynamic obliques.', tip: 'Rotate from the navel, NOT the shoulders — the arms just follow the torso.' },
  'anti-flexion-rollouts': { name: 'Anti-Flexion (Rollouts)', desc: 'Controlled torso extension resisting flexion — maximum rectus abdominis strength.', tip: 'If your lower back arches, you rolled out too far — the abs gave out and the spine pays the price.' },
  'core-dinamico': { name: 'Dynamic Core', desc: 'Explosive core movements — endurance, coordination and metabolic demand.', tip: 'Don’t trade form for speed — 15 slow, precise reps beat 40 fast ones with no control.' },
  // ── CARDIO ──
  'burpee-sprawl': { name: 'Burpee / Sprawl', desc: 'Drop to the floor and back up — the classic full-body pattern.', tip: 'Move the hips first, not the knees — it looks more efficient and protects the joints.' },
  'saltos-basicos': { name: 'Basic Jumps', desc: 'Jumps coordinating arms and legs — the foundation of equipment-free cardio.', tip: 'Great for a warm-up — raises your heart rate without demanding complex technique.' },
  'running-drills': { name: 'Running Drills', desc: 'Running in place with a specific focus — coordination and endurance.', tip: 'Great for HIIT or a lower-body warm-up — heats up hamstrings and quads in minutes.' },
  'skater-jumps': { name: 'Skater Jumps', desc: 'Explosive lateral jump mimicking skating — lateral power and stability.', tip: 'The movement starts at the hip, not the knee — protect your ligaments on landing.' },
  'box-jumps': { name: 'Box Jumps', desc: 'Vertical jump onto a platform — explosive lower-body power.', tip: 'Quality over quantity — 5 explosive jumps beat 15 tired ones with ugly form.' },
  'mountain-climbers': { name: 'Mountain Climbers', desc: 'Alternating knees to chest in a plank — cardio + dynamic core.', tip: 'Don’t pike your hips up — if you do you’ve lost the pattern. Slow down and fix your form.' },
  'kettlebell-swings': { name: 'Kettlebell Swings', desc: 'Explosive hip hinge with momentum — posterior-chain power and endurance.', tip: 'The swing is NOT a squat — it’s a hip hinge. If the knees bend a lot you’ve lost the pattern.' },
  'battle-ropes': { name: 'Battle Ropes', desc: 'Waves with a thick rope — explosive cardio with an upper-body emphasis.', tip: 'The power comes from shoulder rotation, not the arms — relax the shoulders and work from the lats.' },
  'carries': { name: 'Loaded Carries', desc: 'Walking with heavy weight — global functional strength, grip and core.', tip: 'If your posture breaks down you’re fatigued — stop and rest, don’t finish ugly.' },
  'cardio-maquina': { name: 'Machine Cardio', desc: 'Sustained cardio on gym equipment — intervals or steady state.', tip: 'If you do intervals, recover well between rounds — real HIIT needs full rest, not half-catching your breath.' },
  // ── YOGA (nombre se mantiene; solo desc + tip) ──
  'sun-salutation-a': { desc: 'A basic yoga flow — full-body mobility.', tip: 'Sync each movement with a breath.' },
  'sun-salutation-b': { desc: 'An intermediate flow with Warrior I and Chair Pose — more intense than A.', tip: 'More demanding than A — fires up the legs and core.' },
  'warrior-i': { desc: 'Strength and hip opening — a foundational pose.', tip: 'Hips facing forward — don’t let them rotate to one side.' },
  'warrior-ii': { desc: 'Hip opening and strength — an open stance.', tip: 'The front knee should align with the ankle, never past it.' },
  'reverse-warrior': { desc: 'A lateral opening from Warrior II.', tip: 'Don’t collapse backward — keep your chest open.' },
  'warrior-iii': { desc: 'Balance on one leg — strength and focus.', tip: 'If you lose your balance, slightly bend the standing knee.' },
  'triangle-pose': { desc: 'A deep lateral opening with extended legs.', tip: 'Think about lengthening sideways, not about touching the floor.' },
  'chair-pose': { desc: 'A yoga squat — leg and core strength.', tip: 'For more intensity, separate the knees and engage the glute medius.' },
  'downward-dog': { desc: 'A full posterior stretch — fundamental.', tip: 'Better to bend the knees than to round the back.' },
  'pigeon-pose': { desc: 'A deep hip and glute opening.', tip: 'If the front hip doesn’t reach the floor, use a block or blanket.' },
  'cat-cow': { desc: 'Spinal mobility — a basic warm-up.', tip: 'Perfect to start the day or before any workout.' },
  'lizard-lunge': { desc: 'A deep hip opening — flexors.', tip: 'One of the most effective hip openers — respect your range.' },
  'low-lunge': { desc: 'Hip-flexor opening — back knee down.', tip: 'Put a blanket under the back knee if it’s uncomfortable.' },
  'cobra-pose': { desc: 'Spinal extension — chest opening.', tip: 'The work comes from the lower back, not the arms.' },
  'bridge-pose': { desc: 'Chest and hip opening — strengthens the lower back.', tip: 'Squeeze your glutes at the top — don’t let the back do all the work.' },
  'puppy-pose': { desc: 'Shoulder and upper-back opening.', tip: 'Excellent for anyone who spends hours at a keyboard.' },
  'seated-forward-fold': { desc: 'A deep hamstring and back stretch.', tip: 'Better to slightly bend the knees than to round the back.' },
  'standing-forward-fold': { desc: 'A posterior leg stretch from standing.', tip: 'Better with bent knees and a long back than straight legs and a curved back.' },
  'wide-leg-forward-fold': { desc: 'Adductor and hamstring opening — a deep stretch.', tip: 'The wider your feet, the less intense the hamstring stretch.' },
  'happy-baby': { desc: 'Hip and lower-back opening — relaxing.', tip: 'Keep your lower back pressed to the floor throughout.' },
  'supine-twist': { desc: 'Spinal rotation — lumbar release.', tip: 'Feel the rotation in the spine, don’t force it with your hand.' },
  'child-pose': { desc: 'A resting pose — nervous-system reset.', tip: 'Use it when you need active rest between intense poses.' },
  'savasana': { desc: 'Final rest — nervous-system integration.', tip: 'Never skip Savasana — it’s where all the work integrates.' },
  'chaturanga': { desc: 'A low push-up — the key link between poses in the vinyasa.', tip: 'If it’s too much, drop your knees to the floor. Quality over quantity.' },
  'upward-dog': { desc: 'Chest opening from chaturanga — the third part of the vinyasa.', tip: 'Different from cobra: in upward dog the thighs don’t touch the floor.' },
  'high-plank-yoga': { desc: 'High plank — the strength base for vinyasa transitions.', tip: 'Squeeze quads and glutes to protect the lower back.' },
  'crescent-lunge': { desc: 'A high lunge with arms to the sky — a deep hip-flexor opening.', tip: 'Squeeze the back glute to protect the lower back.' },
  'half-moon': { desc: 'A lateral balancing pose that demands full focus.', tip: 'If you can’t reach the floor, use a block. Stability > depth.' },
  'side-plank-yoga': { desc: 'Side plank — oblique strength and shoulder stability.', tip: 'To modify, drop the bottom knee to the floor.' },
  'crow-pose': { desc: 'An arm-balance pose — core strength and focus.', tip: 'Start one foot at a time. An intimidating pose, but about strength, not flexibility.' },
  'camel-pose': { desc: 'A deep backbend — full chest and hip-flexor opening.', tip: 'If it’s too much, keep your hands on your lower back. Never force the neck.' },
  'boat-pose': { desc: 'A seated pose that fires the deep core and hip flexors.', tip: 'You can stay with bent knees until you build more strength.' },
  'seated-twist': { desc: 'A seated twist — deep organ massage and spinal mobility.', tip: 'Grow taller on each inhale, twist on each exhale.' },
  'wheel-pose': { desc: 'A full backbend — maximum chest, shoulder and hip opening.', tip: 'Bridge pose is the prep. Only try wheel if your bridge feels free.' },
  'revolved-chair': { desc: 'Chair with a twist — leg strength + spinal detox.', tip: 'Grow from the crown, twist from the navel. Not from the shoulders.' },
};
