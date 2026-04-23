// animate — deterministic particle + animation helpers.
// Pure where possible; DOM functions take host/doc explicitly for testability.

export const ANIM_DURATION_MS = {
  bounce:   520,
  eating:   1800,
  petting:  1800,
  sleeping: 0,      // persistent until cleared
  tilt:     520,
  evolving: 2200,
};

const PARTICLE_TEXT = {
  heart:  '♥',
  zzz:    'z',
  star:   '★',
  evolve: '✦',
};

export function particleText(kind) {
  return PARTICLE_TEXT[kind] ?? '·';
}

// Returns a deterministic fan of offsets for N particles.
// Used for heart burst / zzz float / star sparkle.
export function particleOffsets(count, spread = 40) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const dx = Math.round((t - 0.5) * spread * 2);
    out.push({ dx, index: i, delay: i * 80 });
  }
  return out;
}

// Burst pattern for evolve (8-direction).
export function burstOffsets(count = 8, radius = 60) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    out.push({
      dx: Math.round(Math.cos(angle) * radius),
      dy: Math.round(Math.sin(angle) * radius),
      index: i,
      delay: 0,
    });
  }
  return out;
}

// Spawn particles into a host element. Returns array of created nodes.
export function spawnParticles(host, kind, opts = {}) {
  if (!host) return [];
  const { count = 3, spread = 40, doc = host.ownerDocument } = opts;
  const offsets = kind === 'evolve' ? burstOffsets(count) : particleOffsets(count, spread);
  const nodes = [];
  for (const o of offsets) {
    const el = doc.createElement('span');
    el.className = 'particle';
    el.dataset.kind = kind;
    el.textContent = particleText(kind);
    el.style.setProperty('--dx', `${o.dx}px`);
    if (o.dy !== undefined) el.style.setProperty('--dy', `${o.dy}px`);
    el.style.animationDelay = `${o.delay}ms`;
    host.appendChild(el);
    nodes.push(el);
  }
  // Auto-cleanup after animation
  const lifespan = kind === 'evolve' ? 1800 : 1500;
  setTimeout(() => nodes.forEach(n => n.remove()), lifespan + offsets.length * 80);
  return nodes;
}

// Set one-shot animation on mascot element. Clears data-anim after duration.
export function playAnim(mascotEl, kind) {
  if (!mascotEl) return;
  mascotEl.dataset.anim = kind;
  const ms = ANIM_DURATION_MS[kind] ?? 500;
  if (ms > 0) {
    setTimeout(() => {
      if (mascotEl.dataset.anim === kind) mascotEl.dataset.anim = '';
    }, ms);
  }
}

// Decide which animation a reward triggers.
export function animForAction(kind, result) {
  switch (kind) {
    case 'tap':          return 'bounce';
    case 'feed':         return result?.error ? 'tilt' : 'eating';
    case 'pet':          return 'petting';
    case 'ball':         return 'bounce';
    case 'ball:correct': return 'bounce';
    case 'ball:wrong':   return 'tilt';
    case 'sleep':        return 'sleeping';
    case 'evolve':       return 'evolving';
    default:             return null;
  }
}

// Which particle, if any, should accompany the action.
export function particleForAction(kind) {
  switch (kind) {
    case 'pet':          return { kind: 'heart', count: 3, spread: 40 };
    case 'ball:correct': return { kind: 'heart', count: 2, spread: 30 };
    case 'sleep':        return { kind: 'zzz',   count: 3, spread: 20 };
    case 'evolve':       return { kind: 'evolve', count: 8 };
    case 'levelup':      return { kind: 'star',  count: 5, spread: 60 };
    default:             return null;
  }
}
