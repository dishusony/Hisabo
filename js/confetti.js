/**
 * confetti.js - Lightweight Canvas Confetti Micro-Engine
 * High-performance, zero-dependency celebration particles for Hisabo.
 */

export function fireConfetti(options = {}) {
  // Check if reduced motion is preferred
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const {
    particleCount = 55,
    spread = 60,
    origin = { x: 0.5, y: 0.6 },
    colors = ['#10b981', '#34d399', '#6366f1', '#818cf8', '#f59e0b', '#ec4899', '#38bdf8']
  } = options;

  let canvas = document.getElementById('hisabo-confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'hisabo-confetti-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    document.body.appendChild(canvas);
  }

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const particles = [];
  const startX = origin.x * width;
  const startY = origin.y * height;
  const radSpread = (spread * Math.PI) / 180;

  for (let i = 0; i < particleCount; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * radSpread;
    const velocity = 5 + Math.random() * 8;
    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * velocity + (Math.random() - 0.5) * 2,
      vy: Math.sin(angle) * velocity - Math.random() * 3,
      size: 5 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      vRot: (Math.random() - 0.5) * 12,
      scaleX: 1,
      vScale: 0.08 + Math.random() * 0.05,
      alpha: 1,
      gravity: 0.22 + Math.random() * 0.08,
      drag: 0.965
    });
  }

  let animationFrameId;
  const startTime = performance.now();
  const maxDuration = 2400; // 2.4 seconds

  function render(time) {
    const elapsed = time - startTime;
    ctx.clearRect(0, 0, width, height);

    let activeParticles = 0;

    for (let p of particles) {
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;

      p.rotation += p.vRot;
      p.scaleX = Math.cos(elapsed * 0.008 + p.rotation);

      // Fade out smoothly in the second half of duration
      if (elapsed > 1000) {
        p.alpha = Math.max(0, 1 - (elapsed - 1000) / (maxDuration - 1000));
      }

      if (p.alpha > 0.01 && p.y < height + 20) {
        activeParticles++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.scale(p.scaleX, 1);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        // Draw small rounded confetti rectangle or circle
        ctx.beginPath();
        ctx.roundRect(-p.size / 2, -p.size / 4, p.size, p.size / 2, 2);
        ctx.fill();
        ctx.restore();
      }
    }

    if (activeParticles > 0 && elapsed < maxDuration) {
      animationFrameId = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, width, height);
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
    }
  }

  animationFrameId = requestAnimationFrame(render);
}
