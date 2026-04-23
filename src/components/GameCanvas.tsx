import { useEffect, useRef } from 'react';
import { GameState, PlayerCar, TrafficCar, Particle, Vector3D, Difficulty } from '../types';

interface GameCanvasProps {
  onGameOver: (score: number) => void;
  gameState: GameState;
  score: number;
  setScore: (score: number | ((s: number) => number)) => void;
  difficulty: Difficulty;
  onTurboChange: (level: number) => void;
}

export default function GameCanvas({ onGameOver, gameState, score, setScore, difficulty, onTurboChange }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Game state refs
  const playerRef = useRef<PlayerCar>({
    id: 'player',
    position: { x: 0, y: 0, z: 0 },
    width: 2,
    height: 1,
    color: '#22d3ee',
    speed: 0,
    lane: 1,
    targetX: 0,
    rotation: 0,
    turbo: 1,
    isTurboActive: false,
    acceleration: 0
  });
  
  const trafficRef = useRef<TrafficCar[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const roadOffset = useRef(0);
  const roadCurve = useRef(0);
  const targetCurve = useRef(0);
  const sceneryRef = useRef<{ id: string, x: number; z: number; color: string; height: number }[]>([]);
  const lastSpawnTime = useRef(0);
  const lastFrameTime = useRef(0);
  const animationFrameId = useRef(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const framesSinceLastHudUpdate = useRef(0);

  const LANES = 4;
  const LANE_WIDTH = 6;
  const ROAD_VISIBLE_DISTANCE = 600;
  const PERSPECTIVE = 3;

  const configs = {
    EASY: { baseSpeed: 20, maxSpeed: 45, spawnInterval: 1200, trafficMaxSpeed: 10, turboGain: 0.001, turboCost: 0.005 },
    MEDIUM: { baseSpeed: 35, maxSpeed: 70, spawnInterval: 800, trafficMaxSpeed: 18, turboGain: 0.0008, turboCost: 0.008 },
    HARD: { baseSpeed: 55, maxSpeed: 100, spawnInterval: 500, trafficMaxSpeed: 30, turboGain: 0.0005, turboCost: 0.012 }
  };

  const config = configs[difficulty];

  const initGame = () => {
    if (!canvasRef.current) return;
    playerRef.current = {
      ...playerRef.current,
      position: { x: 0, y: 0, z: 0 },
      targetX: 0,
      lane: 1,
      speed: config.baseSpeed,
      rotation: 0,
      turbo: 1,
      isTurboActive: false,
      acceleration: 0
    };
    trafficRef.current = [];
    particlesRef.current = [];
    sceneryRef.current = [];
    roadOffset.current = 0;
    roadCurve.current = 0;
    targetCurve.current = 0;
    lastSpawnTime.current = performance.now();
    lastFrameTime.current = performance.now();
    setScore(0);
    onTurboChange(1);
  };

  const spawnScenery = (z: number) => {
    const side = Math.random() > 0.5 ? 1 : -1;
    const isTree = Math.random() > 0.3;
    sceneryRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      x: side * (LANE_WIDTH * 2.8 + 5 + Math.random() * 15),
      z: z,
      color: isTree ? '#166534' : '#78350f', // Tree green or trunk brown
      height: isTree ? 4 + Math.random() * 4 : 2 + Math.random() * 2
    });
  };

  const spawnTraffic = () => {
    const lane = Math.floor(Math.random() * LANES);
    const x = (lane - 1.5) * LANE_WIDTH;
    const colors = ['#f87171', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa'];
    
    trafficRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      position: { x, y: 0, z: ROAD_VISIBLE_DISTANCE },
      width: 2.2,
      height: 0.9,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * config.trafficMaxSpeed,
      type: 'sedan'
    });
  };

  const spawnParticles = (pos: Vector3D, color: string, count: number = 20) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        position: { ...pos },
        velocity: { 
          x: (Math.random() - 0.5) * 12, 
          y: (Math.random() - 0.5) * 12, 
          z: (Math.random() - 0.5) * 12 
        },
        radius: 0.12 + Math.random() * 0.4,
        color,
        life: 1,
        decay: 0.015 + Math.random() * 0.02
      });
    }
  };

  const project = (v: Vector3D, width: number, height: number, zCurveOffset: number = 0) => {
    const scale = PERSPECTIVE / (PERSPECTIVE + v.z);
    const x = width / 2 + (v.x + zCurveOffset) * scale * (width / 24);
    const y = height / 1.6 + (v.y + 2.8) * scale * (height / 8.5); // Adjusted for better horizon view
    return { x, y, scale };
  };

  const update = (time: number) => {
    if (gameState !== GameState.PLAYING) {
      lastFrameTime.current = time;
      return;
    }
    
    const deltaTime = Math.min((time - lastFrameTime.current) / 16.67, 2); // Normalize to ~60fps
    lastFrameTime.current = time;
    
    const p = playerRef.current;
    
    // Turbo Logic
    const isTurboRequested = keysPressed.current['ArrowUp'] || keysPressed.current['w'];
    if (isTurboRequested && p.turbo > 0.01) {
      p.isTurboActive = true;
      p.turbo = Math.max(0, p.turbo - config.turboCost * deltaTime);
      p.speed += (config.maxSpeed * 1.5 - p.speed) * 0.07 * deltaTime;
    } else {
      p.isTurboActive = false;
      p.turbo = Math.min(1, p.turbo + config.turboGain * deltaTime);
      p.speed += (config.baseSpeed - p.speed) * 0.04 * deltaTime;
    }

    // Optimization: Update HUD every 3 frames instead of every frame
    framesSinceLastHudUpdate.current++;
    if (framesSinceLastHudUpdate.current >= 3) {
      onTurboChange(p.turbo);
      framesSinceLastHudUpdate.current = 0;
    }

    // Lane Switching
    if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) {
      if (p.lane > 0 && !keysPressed.current['_latched_L']) { p.lane--; keysPressed.current['_latched_L'] = true; }
    } else { keysPressed.current['_latched_L'] = false; }

    if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) {
      if (p.lane < LANES - 1 && !keysPressed.current['_latched_R']) { p.lane++; keysPressed.current['_latched_R'] = true; }
    } else { keysPressed.current['_latched_R'] = false; }

    p.targetX = (p.lane - 1.5) * LANE_WIDTH;
    const diff = p.targetX - p.position.x;
    p.position.x += diff * 0.15 * deltaTime;
    p.rotation = diff * 0.1 * deltaTime;

    // Road Curvature Logic
    if (Math.random() < 0.008 * deltaTime) {
      targetCurve.current = (Math.random() - 0.5) * 12;
    }
    roadCurve.current += (targetCurve.current - roadCurve.current) * 0.01 * deltaTime;

    // Movement
    const stepMove = p.speed * 0.016 * deltaTime;
    roadOffset.current = (roadOffset.current + stepMove) % 40;

    // Scenery Logic
    if (sceneryRef.current.length < 35) {
      spawnScenery(ROAD_VISIBLE_DISTANCE);
    }
    sceneryRef.current = sceneryRef.current.filter(obj => {
      obj.z -= stepMove;
      return obj.z > -PERSPECTIVE;
    });

    // Traffic Logic
    if (time - lastSpawnTime.current > config.spawnInterval) {
      spawnTraffic();
      lastSpawnTime.current = time;
    }

    trafficRef.current = trafficRef.current.filter(car => {
      car.position.z -= (p.speed - car.speed) * 0.016 * deltaTime;
      
      // Precise Collision Detection in Z-space
      if (car.position.z < 6 && car.position.z > 0) {
        if (Math.abs(car.position.x - p.position.x) < 2.0) {
          spawnParticles(p.position, '#f43f5e', 40);
          onGameOver(score);
          return false;
        }
      }
      return car.position.z > -10;
    });

    // Particles Logic
    particlesRef.current = particlesRef.current.filter(part => {
      part.position.x += part.velocity.x * 0.05 * deltaTime;
      part.position.y += part.velocity.y * 0.05 * deltaTime;
      part.position.z += part.velocity.z * 0.05 * deltaTime - stepMove;
      part.life -= part.decay * deltaTime;
      return part.life > 0 && part.position.z > -PERSPECTIVE;
    });

    setScore(s => s + Math.floor(p.speed / 50 * deltaTime));
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    const p = playerRef.current;

    // Camera Shake
    ctx.save();
    if (p.isTurboActive) {
      const shake = (Math.random() - 0.5) * 5;
      ctx.translate(shake, shake);
    }

    // Sky with sunset feel
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height / 1.6);
    skyGrad.addColorStop(0, '#f97316');
    skyGrad.addColorStop(0.5, '#fbbf24');
    skyGrad.addColorStop(1, '#ea580c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height / 1.6);

    // Ground
    ctx.fillStyle = '#92400e';
    ctx.fillRect(0, height / 1.6, width, height);

    // Road Projection Calculation
    const roadPoints = [];
    for (let z = 0; z <= ROAD_VISIBLE_DISTANCE; z += 10) {
      const zEff = z;
      const progress = zEff / ROAD_VISIBLE_DISTANCE;
      const curveX = (zEff / 100) ** 2 * roadCurve.current;
      
      const left = project({ x: -LANE_WIDTH * 2, y: 0, z: zEff }, width, height, curveX);
      const right = project({ x: LANE_WIDTH * 2, y: 0, z: zEff }, width, height, curveX);
      roadPoints.push({ left, right, z: zEff, curveX });
    }

    // Draw Road Segments (Back to Front)
    for (let i = roadPoints.length - 2; i >= 0; i--) {
      const curr = roadPoints[i];
      const next = roadPoints[i + 1];

      // Fixed: Adjust Z relative to offset for segment coloring/lines
      const zForColor = (curr.z + roadOffset.current) % 40;

      // Road Surface
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(curr.left.x, curr.left.y);
      ctx.lineTo(curr.right.x, curr.right.y);
      ctx.lineTo(next.right.x, next.right.y);
      ctx.lineTo(next.left.x, next.left.y);
      ctx.fill();

      // Guardrails
      const railH = 1.2;
      const rLeft1 = project({ x: -LANE_WIDTH * 2.1, y: -railH, z: curr.z }, width, height, curr.curveX);
      const rLeft2 = project({ x: -LANE_WIDTH * 2.1, y: -railH, z: next.z }, width, height, next.curveX);
      const rRight1 = project({ x: LANE_WIDTH * 2.1, y: -railH, z: curr.z }, width, height, curr.curveX);
      const rRight2 = project({ x: LANE_WIDTH * 2.1, y: -railH, z: next.z }, width, height, next.curveX);

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4 * curr.left.scale;
      ctx.beginPath();
      ctx.moveTo(rLeft1.x, rLeft1.y); ctx.lineTo(rLeft2.x, rLeft2.y);
      ctx.moveTo(rRight1.x, rRight1.y); ctx.lineTo(rRight2.x, rRight2.y);
      ctx.stroke();

      // White solid lines at edges
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2 * curr.left.scale;
      ctx.beginPath();
      ctx.moveTo(curr.left.x, curr.left.y); ctx.lineTo(next.left.x, next.left.y);
      ctx.moveTo(curr.right.x, curr.right.y); ctx.lineTo(next.right.x, next.right.y);
      ctx.stroke();

      // White dashed center line
      if (zForColor < 20) {
        const mid = project({ x: 0, y: 0, z: curr.z }, width, height, curr.curveX);
        const midNext = project({ x: 0, y: 0, z: next.z }, width, height, next.curveX);
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y); ctx.lineTo(midNext.x, midNext.y);
        ctx.stroke();
      }
    }

    // Scenery Logic (Trees)
    sceneryRef.current.forEach(obj => {
      const curveAtZ = roadCurve.current * (obj.z / 100) ** 2;
      const proj = project(obj, width, height, curveAtZ);
      if (proj.scale <= 0) return;

      const size = obj.height * 15 * proj.scale;
      ctx.fillStyle = obj.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y - size, size, 0, Math.PI * 2);
      ctx.fill();
      // Trunk
      ctx.fillStyle = '#451a03';
      ctx.fillRect(proj.x - size / 4, proj.y - size, size / 2, size);
    });

    // Traffic Cars
    const sortedTraffic = [...trafficRef.current].sort((a, b) => b.position.z - a.position.z);
    sortedTraffic.forEach(car => {
      const curveAtZ = roadCurve.current * (car.position.z / 100) ** 2;
      const proj = project(car.position, width, height, curveAtZ);
      if (proj.scale <= 0) return;
      
      const carW = 70 * car.width * proj.scale;
      const carH = 50 * car.height * proj.scale;
      
      ctx.save();
      ctx.translate(proj.x, proj.y - carH);
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(0, carH + 2, carW/2, carH/5, 0, 0, Math.PI*2);
      ctx.fill();

      // Body
      ctx.fillStyle = car.color;
      ctx.shadowBlur = 10 * proj.scale;
      ctx.shadowColor = car.color;
      
      // Car chassis
      ctx.beginPath();
      ctx.roundRect(-carW/2, 0, carW, carH, 6 * proj.scale);
      ctx.fill();
      
      // Windshield
      ctx.fillStyle = 'rgba(10, 15, 20, 0.9)';
      ctx.fillRect(-carW/3, carH/6, carW/1.5, carH/3);
      
      // Tail lights
      ctx.fillStyle = '#ff1e1e';
      ctx.shadowBlur = 15 * proj.scale;
      ctx.shadowColor = '#ff1e1e';
      ctx.fillRect(-carW/2 + 2, carH - 12 * proj.scale, 12 * proj.scale, 6 * proj.scale);
      ctx.fillRect(carW/2 - 14 * proj.scale, carH - 12 * proj.scale, 12 * proj.scale, 6 * proj.scale);
      
      ctx.restore();
    });

    // Particles
    particlesRef.current.forEach(pt => {
      const proj = project(pt.position, width, height, roadCurve.current * (pt.position.z / 100) ** 2);
      if (proj.scale <= 0) return;
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, pt.radius * proj.scale * 30, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Player Car (Yellow Hatchback)
    const playerProj = project({ x: p.position.x, y: 0, z: 6 }, width, height);
    const pW = 180 * playerProj.scale;
    const pH = 100 * playerProj.scale;

    ctx.save();
    ctx.translate(playerProj.x, playerProj.y - pH);
    ctx.rotate(p.rotation);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, pH + 12, pW / 2, pH / 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (Yellow)
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(-pW / 2, 10, pW, pH - 15, 15);
    ctx.fill();
    ctx.strokeStyle = '#854d0e';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rear Window
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-pW / 2.5, 20, pW / 1.25, pH / 2.5, 5);
    ctx.fill();

    // License Plate (MR RACER)
    ctx.fillStyle = 'white';
    ctx.fillRect(-25, pH - 35, 50, 15);
    ctx.fillStyle = 'black';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MR RACER', 0, pH - 24);

    // Lights
    ctx.fillStyle = '#dc2626'; // Tail lights
    ctx.beginPath();
    ctx.arc(-pW / 2 + 15, pH - 30, 8, 0, Math.PI * 2);
    ctx.arc(pW / 2 - 15, pH - 30, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.restore();
    ctx.shadowBlur = 0;
  };

  const loop = (time: number) => {
    update(time);
    draw();
    animationFrameId.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        if (gameState === GameState.START) initGame();
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current[e.key] = true;
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current[e.key] = false;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    animationFrameId.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameState, difficulty]);

  useEffect(() => {
    if (gameState === GameState.PLAYING) initGame();
  }, [gameState]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#050608] overflow-hidden relative touch-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
