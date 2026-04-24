import { useEffect, useRef } from 'react';
import { GameState, PlayerCar, TrafficCar, Particle, Vector3D, Difficulty, GhostSnapshot } from '../types';
import { audio } from '../services/audioService';

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
  const bgOffset = useRef(0);
  const sceneryRef = useRef<{ id: string, x: number; z: number; color: string; height: number }[]>([]);
  const lastSpawnTime = useRef(0);
  const lastFrameTime = useRef(0);
  const animationFrameId = useRef(0);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const framesSinceLastHudUpdate = useRef(0);
  const distanceRef = useRef(0);
  const ghostDataRef = useRef<GhostSnapshot[]>([]);
  const currentRunHistoryRef = useRef<GhostSnapshot[]>([]);
  const lastRecordTime = useRef(0);
  const startTimeRef = useRef(0);
  const isCrashing = useRef(false);

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
      pitch: 0,
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
    startTimeRef.current = performance.now();
    lastRecordTime.current = 0;
    distanceRef.current = 0;
    currentRunHistoryRef.current = [];
    isCrashing.current = false;
    setScore(0);
    onTurboChange(1);
  };

  const spawnScenery = (z: number) => {
    const side = Math.random() > 0.5 ? 1 : -1;
    const isBuilding = Math.random() > 0.4;
    sceneryRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      x: side * (LANE_WIDTH * 2.8 + 10 + Math.random() * 40),
      z: z,
      color: isBuilding ? ['#0ea5e9', '#d946ef', '#f43f5e'][Math.floor(Math.random() * 3)] : '#1e293b',
      height: isBuilding ? 15 + Math.random() * 40 : 5 + Math.random() * 10
    });
  };

  const spawnTraffic = () => {
    const lane = Math.floor(Math.random() * LANES);
    const x = (lane - 1.5) * LANE_WIDTH;
    const types: ('sedan' | 'sport' | 'truck')[] = ['sedan', 'sport', 'truck'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    let width = 3.0; // Standard transporter width
    let height = 2.0; // Standard transporter height
    let speed = Math.random() * config.trafficMaxSpeed + config.baseSpeed * 0.4;
    let color = '#fff';

    if (type === 'truck') {
      // AEROPACK HEAVY
      width = 4.0;
      height = 3.0;
      speed = config.baseSpeed * 0.3 + Math.random() * 5;
      color = '#f97316';
    } else if (type === 'sedan') {
      // DHL EXPRESS
      width = 3.2;
      height = 2.2;
      speed = config.baseSpeed * 0.6 + Math.random() * 10;
      color = '#eab308';
    } else {
      // SWIFT LOGISTICS
      width = 3.0;
      height = 1.8;
      speed = config.baseSpeed * 0.8 + Math.random() * 20;
      color = '#0ea5e9';
    }

    trafficRef.current.push({
      id: Math.random().toString(36).substr(2, 9),
      position: { x, y: 0, z: ROAD_VISIBLE_DISTANCE },
      width,
      height,
      color,
      speed,
      type
    });
  };

  const spawnParticles = (pos: Vector3D, color: string, count: number = 20, type: 'dust' | 'explosion' = 'explosion') => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(36).substr(2, 9),
        position: { ...pos },
        velocity: { 
          x: type === 'dust' ? (Math.random() - 0.5) * 5 : (Math.random() - 0.5) * 12, 
          y: type === 'dust' ? (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 12, 
          z: type === 'dust' ? (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 12 
        },
        radius: type === 'dust' ? 0.02 + Math.random() * 0.08 : 0.12 + Math.random() * 0.4,
        color,
        life: 1,
        decay: type === 'dust' ? 0.002 + Math.random() * 0.005 : 0.015 + Math.random() * 0.02,
        type
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
    if (gameState !== GameState.PLAYING && gameState !== GameState.GAMEOVER) {
      lastFrameTime.current = time;
      return;
    }
    
    // Slow down processing during Game Over
    const timeScale = gameState === GameState.GAMEOVER ? 0.2 : 1.0;
    const deltaTime = Math.min((time - lastFrameTime.current) / 16.67, 2) * timeScale;
    lastFrameTime.current = time;
    
    const p = playerRef.current;
    
    // Turbo Logic
    if (!isCrashing.current) {
      const isTurboRequested = keysPressed.current['ArrowUp'] || keysPressed.current['w'];
      if (isTurboRequested && p.turbo > 0.01) {
        p.isTurboActive = true;
        p.turbo = Math.max(0, p.turbo - config.turboCost * deltaTime);
        p.speed += (config.maxSpeed * 2.2 - p.speed) * 0.12 * deltaTime; // Even more speed in turbo
        p.pitch = Math.max(-0.06, p.pitch - 0.01 * deltaTime); // Nose lifts
      } else {
        p.isTurboActive = false;
        p.turbo = Math.min(1, p.turbo + config.turboGain * deltaTime);
        p.speed += (config.baseSpeed - p.speed) * 0.04 * deltaTime;
        p.pitch = p.pitch * (1 - 0.1 * deltaTime); // Return to neutral
      }
    }

    audio.update(p.speed, p.isTurboActive);

    // Optimization: Update HUD every 3 frames instead of every frame
    framesSinceLastHudUpdate.current++;
    if (framesSinceLastHudUpdate.current >= 3) {
      onTurboChange(p.turbo);
      framesSinceLastHudUpdate.current = 0;
    }

    if (!isCrashing.current) {
      // Lane Switching
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['a']) {
        if (p.lane > 0 && !keysPressed.current['_latched_L']) { p.lane--; keysPressed.current['_latched_L'] = true; }
      } else { keysPressed.current['_latched_L'] = false; }

      if (keysPressed.current['ArrowRight'] || keysPressed.current['d']) {
        if (p.lane < LANES - 1 && !keysPressed.current['_latched_R']) { p.lane++; keysPressed.current['_latched_R'] = true; }
      } else { keysPressed.current['_latched_R'] = false; }
    }

    p.targetX = (p.lane - 1.5) * LANE_WIDTH;
    const diff = p.targetX - p.position.x;
    p.position.x += diff * 0.15 * deltaTime;
    p.rotation = diff * 0.1 * deltaTime;

    // Road Curvature Logic
    if (Math.random() < 0.005 * deltaTime) { // Slightly less frequent but more committed turns
      targetCurve.current = (Math.random() - 0.5) * 22; // Wider curves
    }
    roadCurve.current += (targetCurve.current - roadCurve.current) * 0.015 * deltaTime;
    
    // Background parallax shifting
    bgOffset.current += roadCurve.current * 0.03 * deltaTime;

    // Movement
    const stepMove = p.speed * 0.016 * deltaTime;
    roadOffset.current = (roadOffset.current + stepMove) % 40;

    // Centrifugal Force (Virages / Turns effect)
    // The curve pushes the player outwards. If roadCurve > 0 (curving right), push left.
    const centrifugalForce = (roadCurve.current * (p.speed / config.baseSpeed) * 0.015) * deltaTime;
    p.position.x -= centrifugalForce;
    
    // Add extra rotation tilt during sharp turns
    p.rotation += (roadCurve.current * 0.02 - p.rotation) * 0.1 * deltaTime;

    // Scenery Logic
    if (sceneryRef.current.length < 35) {
      spawnScenery(ROAD_VISIBLE_DISTANCE);
    }
    sceneryRef.current = sceneryRef.current.filter(obj => {
      obj.z -= stepMove;
      return obj.z > -PERSPECTIVE;
    });

    // Traffic Logic
    if (!isCrashing.current && time - lastSpawnTime.current > config.spawnInterval) {
      spawnTraffic();
      lastSpawnTime.current = time;
    }

    trafficRef.current = trafficRef.current.filter(car => {
      car.position.z -= (p.speed - car.speed) * 0.016 * deltaTime;
      
      // Precise Collision Detection in Z-space
      if (!isCrashing.current && car.position.z < 6 && car.position.z > 0) {
        if (Math.abs(car.position.x - p.position.x) < 2.0) {
          isCrashing.current = true;
          spawnParticles(p.position, '#f43f5e', 40, 'explosion');
          audio.playCollision();
          
          // Slow down everything for impact
          p.speed = p.speed * 0.1;
          
          // Brief delay before switching to Game Over screen for dramatic effect
          setTimeout(() => {
            if (gameState !== GameState.PLAYING) return;
            
            // Save Ghost Data if this is a new high score
            const finalScore = Math.floor(distanceRef.current);
            const savedGhost = localStorage.getItem(`ghost_${difficulty}`);
            let bestScore = 0;
            if (savedGhost) {
              try { bestScore = JSON.parse(savedGhost).score; } catch(e) {}
            }
            
            if (finalScore > bestScore) {
              localStorage.setItem(`ghost_${difficulty}`, JSON.stringify({
                difficulty,
                score: finalScore,
                snapshots: currentRunHistoryRef.current
              }));
            }

            audio.stop();
            onGameOver(finalScore);
          }, 1200);
          return false;
        }
      }
      return car.position.z > -10;
    });

    // Atmospheric Dust Spawning
    if (Math.random() < 0.4 * deltaTime) {
      spawnParticles(
        { x: (Math.random() - 0.5) * 60, y: (Math.random() - 0.5) * 10 - 2, z: ROAD_VISIBLE_DISTANCE },
        '#ffffff',
        1,
        'dust'
      );
    }

    // Particles Logic
    particlesRef.current = particlesRef.current.filter(part => {
      part.position.x += part.velocity.x * 0.05 * deltaTime;
      part.position.y += part.velocity.y * 0.05 * deltaTime;
      part.position.z += part.velocity.z * 0.05 * deltaTime - stepMove;
      part.life -= part.decay * deltaTime;
      return part.life > 0 && part.position.z > -PERSPECTIVE;
    });

    if (!isCrashing.current) {
      setScore(s => s + Math.floor(p.speed / 50 * deltaTime));
      distanceRef.current += (p.speed / 50 * deltaTime);

      // Recording Ghost Data
      const elapsed = time - startTimeRef.current;
      if (gameState === GameState.PLAYING && elapsed - lastRecordTime.current > 100) {
        currentRunHistoryRef.current.push({
          x: p.position.x,
          z: distanceRef.current,
          speed: p.speed
        });
        lastRecordTime.current = elapsed;
      }
    }
  };

  const draw = (time: number) => {
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

    // Sky (Full Void Night)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height / 1.6);
    skyGrad.addColorStop(0, '#000000'); 
    skyGrad.addColorStop(1, '#020617');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height / 1.6);

    // Faint Nebula (Atmospheric Purple/Blue Glow)
    const nebulaX = (width * 0.3 + bgOffset.current * 0.2) % width;
    const nebulaGrad = ctx.createRadialGradient(nebulaX, height * 0.2, 0, nebulaX, height * 0.2, width * 0.5);
    nebulaGrad.addColorStop(0, 'rgba(217, 70, 239, 0.05)');
    nebulaGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.02)');
    nebulaGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebulaGrad;
    ctx.fillRect(0, 0, width, height / 1.6);

    // Stars (Stable Twinkling)
    for (let i = 0; i < 80; i++) {
        // Deterministic positioning based on index + bgOffset for parallax
        const x = (((Math.sin(i * 123.456) * 543.21) % 1 + 1) % 1 * width + bgOffset.current * 0.5) % width;
        const y = ((Math.cos(i * 987.654) * 654.32) % 1 + 1) % 1 * (height / 1.6);
        const size = (i % 5 === 0) ? 1.5 : 0.8;
        const twinkle = Math.sin(time * 0.0015 + i) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + 0.5 * twinkle})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Distant Futuristic Planet
    const planetX = (width * 0.75 + bgOffset.current * 0.3) % width;
    const planetY = height * 0.22;
    const planetR = 30;
    
    // Outer glow for the planet
    const planetGlow = ctx.createRadialGradient(planetX, planetY, planetR, planetX, planetY, planetR * 3);
    planetGlow.addColorStop(0, 'rgba(14, 165, 233, 0.15)');
    planetGlow.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = planetGlow;
    ctx.beginPath();
    ctx.arc(planetX, planetY, planetR * 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Planet body (Dark shadowed disk)
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(planetX, planetY, planetR, 0, Math.PI * 2);
    ctx.fill();
    
    // Crescent rim-light
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(planetX, planetY, planetR, -0.5, 2.5);
    ctx.stroke();

    // Distant Neon City Lights (More intense and varied)
    for (let i = 0; i < 45; i++) {
        // Deterministic positioning and height to avoid flickering
        const x = ((Math.sin(i * 1.5) * 0.5 + 0.5) * width + bgOffset.current) % width;
        const h = (((Math.sin(i * 456.789) * 123.456) % 1 + 1) % 1) * 30 + 10;
        const color = i % 3 === 0 ? '#0ea5e9' : i % 4 === 0 ? '#d946ef' : '#f43f5e';
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.fillRect(x, height / 1.6 - h, 4, h);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Distant Mountains (Darker silhouettes with neon rim)
    const mtnOffset = bgOffset.current * 0.8;
    // Mountain 1 (Purple Rim)
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.moveTo(mtnOffset % width - width, height / 1.6);
    ctx.lineTo(mtnOffset % width - width + width * 0.25, height * 0.5);
    ctx.lineTo(mtnOffset % width - width + width * 0.45, height / 1.6);
    ctx.moveTo(mtnOffset % width, height / 1.6);
    ctx.lineTo(mtnOffset % width + width * 0.25, height * 0.5);
    ctx.lineTo(mtnOffset % width + width * 0.45, height / 1.6);
    ctx.fill();
    
    // Stroke peak only
    ctx.strokeStyle = 'rgba(217, 70, 239, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mtnOffset % width - width, height / 1.6);
    ctx.lineTo(mtnOffset % width - width + width * 0.25, height * 0.5);
    ctx.lineTo(mtnOffset % width - width + width * 0.45, height / 1.6);
    ctx.moveTo(mtnOffset % width, height / 1.6);
    ctx.lineTo(mtnOffset % width + width * 0.25, height * 0.5);
    ctx.lineTo(mtnOffset % width + width * 0.45, height / 1.6);
    ctx.stroke();

    // Mountain 2 (Blue Rim)
    const mtn2Offset = bgOffset.current * 0.75;
    ctx.fillStyle = '#010413';
    ctx.beginPath();
    ctx.moveTo(mtn2Offset % width - width + width * 0.4, height / 1.6);
    ctx.lineTo(mtn2Offset % width - width + width * 0.65, height * 0.45);
    ctx.lineTo(mtn2Offset % width - width + width * 0.9, height / 1.6);
    ctx.moveTo(mtn2Offset % width + width * 0.4, height / 1.6);
    ctx.lineTo(mtn2Offset % width + width * 0.65, height * 0.45);
    ctx.lineTo(mtn2Offset % width + width * 0.9, height / 1.6);
    ctx.fill();

    ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mtn2Offset % width - width + width * 0.4, height / 1.6);
    ctx.lineTo(mtn2Offset % width - width + width * 0.65, height * 0.45);
    ctx.lineTo(mtn2Offset % width - width + width * 0.9, height / 1.6);
    ctx.moveTo(mtn2Offset % width + width * 0.4, height / 1.6);
    ctx.lineTo(mtn2Offset % width + width * 0.65, height * 0.45);
    ctx.lineTo(mtn2Offset % width + width * 0.9, height / 1.6);
    ctx.stroke();

    // Ground (Deep Black/Purple)
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, height / 1.6, width, height);

    // Road Projection Calculation
    const roadPoints = [];
    for (let z = 0; z <= ROAD_VISIBLE_DISTANCE; z += 5) {
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

      const zForColor = (curr.z + roadOffset.current) % 40;

      // Neon Curbs
      const curbWidth = 1.0;
      const cL1 = project({ x: -LANE_WIDTH * 2 - curbWidth, y: 0, z: curr.z }, width, height, curr.curveX);
      const cL2 = project({ x: -LANE_WIDTH * 2 - curbWidth, y: 0, z: next.z }, width, height, next.curveX);
      const cR1 = project({ x: LANE_WIDTH * 2 + curbWidth, y: 0, z: curr.z }, width, height, curr.curveX);
      const cR2 = project({ x: LANE_WIDTH * 2 + curbWidth, y: 0, z: next.z }, width, height, next.curveX);

      ctx.shadowBlur = 15 * curr.left.scale;
      ctx.shadowColor = zForColor > 20 ? '#d946ef' : '#0ea5e9';
      ctx.fillStyle = zForColor > 20 ? '#d946ef' : '#0ea5e9';
      ctx.beginPath();
      ctx.moveTo(curr.left.x, curr.left.y); ctx.lineTo(cL1.x, cL1.y);
      ctx.lineTo(cL2.x, cL2.y); ctx.lineTo(next.left.x, next.left.y);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(curr.right.x, curr.right.y); ctx.lineTo(cR1.x, cR1.y);
      ctx.lineTo(cR2.x, cR2.y); ctx.lineTo(next.right.x, next.right.y);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Road Surface (Dynamic Illumination from Headlights)
      const lightIntense = Math.max(0, 1 - curr.z / 200); // Light falls off after 200 meters
      const roadColor = Math.floor(2 + lightIntense * 15); // Base of #020617 to something brighter
      ctx.fillStyle = `rgb(${roadColor}, ${roadColor + 2}, ${roadColor + 10})`;
      
      ctx.beginPath();
      ctx.moveTo(curr.left.x, curr.left.y);
      ctx.lineTo(curr.right.x, curr.right.y);
      ctx.lineTo(next.right.x, next.right.y);
      ctx.lineTo(next.left.x, next.left.y);
      ctx.fill();

      // Headlight "Spot" on the road (using composite to brighten)
      if (curr.z < 150) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const opacity = 0.3 * (1 - curr.z / 150);
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.beginPath();
          ctx.moveTo(curr.left.x, curr.left.y);
          ctx.lineTo(curr.right.x, curr.right.y);
          ctx.lineTo(next.right.x, next.right.y);
          ctx.lineTo(next.left.x, next.left.y);
          ctx.fill();
          ctx.restore();
      }

      // Track center line (Subtle Neon Dash - brighter when near)
      if (zForColor < 20) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 + 0.4 * lightIntense})`;
        ctx.lineWidth = 1 * curr.left.scale;
        const mid = project({ x: 0, y: 0, z: curr.z }, width, height, curr.curveX);
        const midNext = project({ x: 0, y: 0, z: next.z }, width, height, next.curveX);
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y); ctx.lineTo(midNext.x, midNext.y);
        ctx.stroke();
      }

      // AI racing lines (Subtle glowing trails)
      const aiLineZ = (curr.z + roadOffset.current * 0.5) % 80;
      if (aiLineZ < 40) {
        ctx.save();
        ctx.globalAlpha = 0.1 * lightIntense;
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2 * curr.left.scale;
        ctx.shadowBlur = 10 * curr.left.scale;
        ctx.shadowColor = '#22d3ee';
        
        // Dynamic racing line that curves slightly differently from the road
        const aiX = Math.sin(curr.z * 0.02 + time * 0.001) * LANE_WIDTH * 1.2;
        const aiNextX = Math.sin(next.z * 0.02 + time * 0.001) * LANE_WIDTH * 1.2;
        
        const pt1 = project({ x: aiX, y: 0, z: curr.z }, width, height, curr.curveX);
        const pt2 = project({ x: aiNextX, y: 0, z: next.z }, width, height, next.curveX);
        
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
        ctx.restore();
      }
    }

    // Scenery Logic (Vibrant Neon Geometric Buildings)
    sceneryRef.current.forEach(obj => {
      const curveAtZ = roadCurve.current * (obj.z / 100) ** 2;
      const proj = project(obj, width, height, curveAtZ);
      if (proj.scale <= 0) return;

      const w = 45 * proj.scale;
      const h = obj.height * 25 * proj.scale;
      
      const inHeadlightRange = obj.z < 250 && Math.abs(obj.x - p.position.x) < 40;
      const illum = inHeadlightRange ? (1 - obj.z / 250) * 0.6 : 0;
      
      ctx.save();
      ctx.globalAlpha = (0.9 + illum) * (1 - obj.z / ROAD_VISIBLE_DISTANCE);
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = (3 + illum * 5) * proj.scale; // Thicker lines for intensity
      ctx.shadowBlur = (30 + illum * 60) * proj.scale;
      ctx.shadowColor = obj.color;
      ctx.strokeRect(proj.x - w/2, proj.y - h, w, h);
      
      // Rectangular "Neon Windows" with individual glows
      ctx.lineWidth = 1.5 * proj.scale;
      for (let j = 1; j < 6; j++) {
          const winY = proj.y - h + (h/7)*j;
          ctx.beginPath();
          ctx.moveTo(proj.x - w/3, winY);
          ctx.lineTo(proj.x + w/3, winY);
          ctx.stroke();
          
          if (j % 2 === 0) {
              ctx.save();
              ctx.globalAlpha = 0.4;
              ctx.fillStyle = obj.color;
              ctx.fillRect(proj.x - w/4, winY - 2, w/2, 4);
              ctx.restore();
          }
      }
      ctx.restore();
    });

    // Traffic Cars Rendering
    const sortedTraffic = [...trafficRef.current].sort((a, b) => b.position.z - a.position.z);
    sortedTraffic.forEach(car => {
      const curveAtZ = roadCurve.current * (car.position.z / 100) ** 2;
      const proj = project(car.position, width, height, curveAtZ);
      if (proj.scale <= 0) return;
      
      const carW = car.width * 40 * proj.scale; 
      const carH = car.height * 40 * proj.scale; 
      
      ctx.save();
      ctx.translate(proj.x, proj.y - carH);
      
      const carInHeadlights = car.position.z < 150 && Math.abs(car.position.x - p.position.x) < 15;
      const reflection = carInHeadlights ? 1 - car.position.z / 150 : 0;
      const chassisBase = Math.floor(15 + reflection * 60);

      if (car.type === 'sport') {
        // SWIFT EXPRESS (Blue/White/Yellow)
        // Chassis (Boxier cargo hold)
        ctx.fillStyle = '#f8fafc'; // White base
        ctx.fillRect(-carW/2, 0, carW, carH);
        
        // Brand Stripe (Blue)
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath();
        ctx.moveTo(-carW/2, carH*0.2); ctx.lineTo(carW/2, carH*0.6);
        ctx.lineTo(carW/2, carH*0.8); ctx.lineTo(-carW/2, carH*0.4);
        ctx.fill();

        // Cockpit (Forward slanting)
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.moveTo(-carW/2.2, carH*0.1); ctx.lineTo(0, 0); ctx.lineTo(carW/2.2, carH*0.1);
        ctx.lineTo(carW/2, carH*0.3); ctx.lineTo(-carW/2, carH*0.3);
        ctx.fill();

        // Taillights
        ctx.shadowBlur = 20 * proj.scale;
        ctx.shadowColor = '#0ea5e9';
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(-carW/2.1, carH*0.7, 4 * proj.scale, carH*0.2);
        ctx.fillRect(carW/2.1 - 4 * proj.scale, carH*0.7, 4 * proj.scale, carH*0.2);
        ctx.shadowBlur = 0;
      } 
      else if (car.type === 'truck') {
        // AEROPACK (Black/Grey/Orange)
        // Chassis
        ctx.fillStyle = '#334155'; // Dark grey
        ctx.fillRect(-carW/2, 0, carW, carH);
        
        // Orange Accents
        ctx.fillStyle = '#f97316';
        ctx.fillRect(-carW/2, carH*0.1, carW, 4 * proj.scale);
        ctx.fillRect(-carW/2, carH*0.8, carW, 2 * proj.scale);

        // Forward Cabin
        ctx.fillStyle = '#f8fafc'; // White cabin front
        ctx.fillRect(-carW/2.2, 0, carW/1.1, carH*0.3);
        ctx.fillStyle = '#000';
        ctx.fillRect(-carW/3, carH*0.05, carW/1.5, carH*0.15);

        // Vertical Taillights
        ctx.shadowBlur = 25 * proj.scale;
        ctx.shadowColor = '#f97316';
        ctx.fillStyle = '#f97316';
        ctx.fillRect(-carW/2.2, carH*0.5, 3 * proj.scale, carH*0.4);
        ctx.fillRect(carW/2.2 - 3 * proj.scale, carH*0.5, 3 * proj.scale, carH*0.4);
        ctx.shadowBlur = 0;
      } 
      else {
        // DHL (Yellow/Red)
        // Chassis
        ctx.fillStyle = '#eab308'; // Yellow
        ctx.fillRect(-carW/2, 0, carW, carH);
        
        // Red Stripes
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-carW/2, carH*0.3, carW/2.5, carH*0.4);
        ctx.beginPath();
        ctx.moveTo(-carW/2, carH*0.2); ctx.lineTo(carW/2, carH*0.25);
        ctx.lineTo(carW/2, carH*0.3); ctx.lineTo(-carW/2, carH*0.25);
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-carW/2.5, carH*0.05, carW/1.25, carH*0.2);

        // Small Red Gills
        ctx.fillStyle = '#ef4444';
        for (let i=0; i<3; i++) {
          ctx.fillRect(carW/4, carH*0.5 + i*10*proj.scale, carW/5, 2);
        }

        ctx.shadowBlur = 20 * proj.scale;
        ctx.shadowColor = '#ef4444';
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-carW/2.2, carH*0.8, carW/4, 4 * proj.scale);
        ctx.fillRect(carW/2.2 - carW/4, carH*0.8, carW/4, 4 * proj.scale);
        ctx.shadowBlur = 0;
      }
      
      // UNIVERSAL HOVER ENGINES (Four nacelles at corners)
      const engineW = carW / 4;
      const engineH = carH / 2.5;
      const engX = carW / 2.1;
      
      [-1, 1].forEach(side => {
        // Front Nacelles
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.ellipse(side * engX, carH * 0.2, engineW/2, engineH/2, 0, 0, Math.PI*2);
        ctx.fill();
        // Glow
        ctx.fillStyle = '#7dd3fc';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(side * engX, carH * 0.2, engineW/4, engineH/4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Rear Nacelles
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.ellipse(side * engX, carH * 0.7, engineW/2, engineH/2, 0, 0, Math.PI*2);
        ctx.fill();
        // Glow
        ctx.fillStyle = '#7dd3fc';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.ellipse(side * engX, carH * 0.7, engineW/4, engineH/4, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });
      
      ctx.restore();
    });

    // Particles
    ctx.save();
    particlesRef.current.forEach(pt => {
      const proj = project(pt.position, width, height, roadCurve.current * (pt.position.z / 100) ** 2);
      if (proj.scale <= 0) return;
      
      let opacity = pt.life;
      let finalColor = pt.color;
      let blur = 0;

      if (pt.type === 'dust') {
        const relZ = pt.position.z - p.position.z;
        // Dust only visible in headlight beam
        if (relZ > 0 && relZ < 200) {
          const spread = (relZ / 200) * 15;
          const relX = pt.position.x - p.position.x;
          if (Math.abs(relX) < 2 + spread) {
            opacity = pt.life * (1 - relZ / 200) * 0.6;
            blur = 8 * proj.scale;
            finalColor = '#fff';
          } else {
            opacity = 0;
          }
        } else {
          opacity = 0;
        }
      }

      if (opacity <= 0) return;

      ctx.globalAlpha = opacity;
      ctx.fillStyle = finalColor;
      if (blur > 0) {
        ctx.shadowBlur = blur;
        ctx.shadowColor = '#fff';
      }
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, pt.radius * proj.scale * (pt.type === 'dust' ? 100 : 30), 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
    ctx.globalAlpha = 1;

    // Render Ghost Car (Blue shadow of past runs)
    const elapsed = time - startTimeRef.current;
    if (ghostDataRef.current.length > 0) {
      // Find snapshot by index based on time (approx 100ms per snapshot)
      const index = Math.floor(elapsed / 100);
      const snapshot = ghostDataRef.current[Math.min(index, ghostDataRef.current.length - 1)];
      
      if (snapshot) {
        const relZ = snapshot.z - distanceRef.current + 6;
        if (relZ > -5 && relZ < ROAD_VISIBLE_DISTANCE) {
          const curveAtZ = roadCurve.current * (relZ / 100) ** 2;
          const ghostProj = project({ x: snapshot.x, y: 0, z: relZ }, width, height, curveAtZ);
          
          if (ghostProj.scale > 0) {
            const gW = 160 * ghostProj.scale;
            const gH = 55 * ghostProj.scale;
            
            ctx.save();
            ctx.translate(ghostProj.x, ghostProj.y - gH);
            ctx.globalAlpha = 0.3 * (1 - relZ / ROAD_VISIBLE_DISTANCE);
            
            // Holographic effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#0ea5e9';
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 1;
            
            // Wireframe-ish car shape
            ctx.beginPath();
            ctx.moveTo(-gW/3.5, gH);
            ctx.lineTo(-gW/12, 0);
            ctx.lineTo(gW/12, 0);
            ctx.lineTo(gW/3.5, gH);
            ctx.closePath();
            ctx.stroke();
            
            // Neon core
            ctx.fillStyle = 'rgba(14, 165, 233, 0.2)';
            ctx.fill();
            
            // Floating label
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${10 * ghostProj.scale}px Inter`;
            ctx.textAlign = 'center';
            ctx.fillText("GHOST", 0, -10);
            
            ctx.restore();
          }
        }
      }
    }

    // Player Transporter (Military Dropship)
    const playerProj = project({ x: p.position.x, y: 0, z: 6 }, width, height);
    const pW = 180 * playerProj.scale;
    const pH = 70 * playerProj.scale;

    ctx.save();
    ctx.translate(playerProj.x, playerProj.y - pH);
    ctx.rotate(p.rotation);

    // Headlight Cones (Volumetric and Dynamic)
    const turboFlicker = p.isTurboActive ? Math.random() * 0.2 : 0;
    const baseOpacity = 0.4 + turboFlicker;
    
    const headlightGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 500);
    headlightGrad.addColorStop(0, `rgba(255, 255, 255, ${baseOpacity})`);
    headlightGrad.addColorStop(0.5, `rgba(200, 230, 255, ${baseOpacity * 0.5})`);
    headlightGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.translate(0, pH*0.8);
    // Steering sway and pitch for headlights
    ctx.rotate(Math.PI + p.rotation * 0.5); 
    ctx.translate(0, p.pitch * 500); // Shift light based on pitch
    
    // Primary Beam
    ctx.fillStyle = headlightGrad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-pW * 2, 500);
    ctx.lineTo(pW * 2, 500);
    ctx.closePath();
    ctx.fill();

    // God Rays (Atmospheric streaks)
    ctx.globalAlpha = 0.1 * baseOpacity;
    for (let i = 0; i < 6; i++) {
        const angle = (i / 5 - 0.5) * 0.4;
        const lH = 400 + Math.random() * 100;
        const lW = 10 + Math.random() * 20;
        ctx.save();
        ctx.rotate(angle);
        const rayGrad = ctx.createLinearGradient(0, 0, 0, lH);
        rayGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
        rayGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
        rayGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(-lW/2, 0);
        ctx.lineTo(lW/2, 0);
        ctx.lineTo(lW/2 + 20, lH);
        ctx.lineTo(-lW/2 - 20, lH);
        ctx.fill();
        ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Core Lens Flare beam
    ctx.fillStyle = `rgba(255, 255, 255, ${baseOpacity * 0.3})`;
    ctx.fillRect(-pW/10, 0, pW/5, 450);
    
    // Light Source Glare
    ctx.shadowBlur = 40;
    ctx.shadowColor = 'white';
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(-pW/4, 0, 5, 0, Math.PI * 2);
    ctx.arc(pW/4, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, pH + 5, pW / 1.5, pH / 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Player Dropship (Replica of the military transporter)
    const MILITARY_GREEN = '#3d441e';
    const DARK_GREEN = '#2d3316';
    const HIGHLIGHT_GREEN = '#4d5626';
    const METAL_GRAY = '#333333';

    // 1. Central Fuselage
    ctx.fillStyle = MILITARY_GREEN;
    ctx.beginPath();
    ctx.moveTo(-pW/10, 0); // Front nose top
    ctx.lineTo(pW/10, 0);
    ctx.lineTo(pW/7, pH*0.9); // Back base
    ctx.lineTo(-pW/7, pH*0.9);
    ctx.closePath();
    ctx.fill();

    // 2. Nose Section (Boxier look)
    ctx.fillStyle = DARK_GREEN;
    ctx.fillRect(-pW/14, 0, pW/7, pH*0.25);
    
    // 3. Cockpit (Slanted panels)
    ctx.fillStyle = '#1e293b'; 
    ctx.beginPath();
    ctx.moveTo(-pW/14, pH*0.08);
    ctx.lineTo(pW/14, pH*0.08);
    ctx.lineTo(pW/10, pH*0.35);
    ctx.lineTo(-pW/10, pH*0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = HIGHLIGHT_GREEN;
    ctx.lineWidth = 1;
    ctx.stroke();
    // Cockpit structure lines
    ctx.beginPath();
    ctx.moveTo(0, pH*0.08); ctx.lineTo(0, pH*0.35);
    ctx.moveTo(-pW/14, pH*0.2); ctx.lineTo(pW/14, pH*0.2);
    ctx.stroke();

    // 4. Side Engine Nacelles
    const engineX = pW/2.4;
    const engineW = pW/3.2;
    const engineH = pH*0.6;

    // Drawing Nacelle Struts first
    ctx.strokeStyle = METAL_GRAY;
    ctx.lineWidth = 6 * playerProj.scale;
    ctx.beginPath();
    ctx.moveTo(-pW/12, pH*0.5); ctx.lineTo(-engineX, pH*0.5);
    ctx.moveTo(pW/12, pH*0.5); ctx.lineTo(engineX, pH*0.5);
    ctx.stroke();

    // ENGINE NACELLES
    [-1, 1].forEach(side => {
        ctx.save();
        ctx.translate(engineX * side, pH * 0.5);
        
        ctx.fillStyle = MILITARY_GREEN;
        ctx.beginPath();
        ctx.ellipse(0, 0, engineW/2, engineH/2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = DARK_GREEN;
        ctx.stroke();

        ctx.fillStyle = METAL_GRAY;
        ctx.beginPath();
        ctx.ellipse(0, 0, engineW/2.5, engineH/2.5, 0, 0, Math.PI*2);
        ctx.fill();

        // Exhaust Glow
        if (!isCrashing.current) {
            ctx.shadowBlur = p.isTurboActive ? 25 : 10;
            ctx.shadowColor = p.isTurboActive ? '#38bdf8' : '#f97316';
            ctx.fillStyle = p.isTurboActive ? '#7dd3fc' : '#ea580c';
            ctx.beginPath();
            ctx.ellipse(0, 0, engineW/4, engineH/4, 0, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Fins on nacelles
        ctx.fillStyle = MILITARY_GREEN;
        ctx.beginPath();
        ctx.moveTo(0, -engineH/2); ctx.lineTo(side * engineW/2, -engineH); ctx.lineTo(0, 0);
        ctx.fill();

        ctx.restore();
    });

    // 5. Small forward and rear wings on fuselage
    ctx.fillStyle = MILITARY_GREEN;
    // Rear Horizontal Fins
    ctx.beginPath();
    ctx.moveTo(-pW/8, pH*0.8); ctx.lineTo(-pW/3, pH*1.1); ctx.lineTo(-pW/8, pH*1.1);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pW/8, pH*0.8); ctx.lineTo(pW/3, pH*1.1); ctx.lineTo(pW/8, pH*1.1);
    ctx.fill();

    // 6. Large Tail Fin
    ctx.fillStyle = DARK_GREEN;
    ctx.beginPath();
    ctx.moveTo(0, pH*0.6);
    ctx.lineTo(0, pH*1.3);
    ctx.lineTo(pW/20, pH*1.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = HIGHLIGHT_GREEN;
    ctx.stroke();

    // 7. Turbo Thrusters Atmospheric trails
    if (p.isTurboActive && !isCrashing.current) {
        ctx.save();
        ctx.globalAlpha = 0.4;
        const trailH = 120 * playerProj.scale;
        const trailGrad = ctx.createLinearGradient(0, pH, 0, pH + trailH);
        trailGrad.addColorStop(0, '#7dd3fc');
        trailGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = trailGrad;
        ctx.fillRect(-pW/6, pH, pW/3, trailH);
        ctx.restore();
    }

    // Speed Lines (Motion Blur effect)
    if (p.speed > config.baseSpeed * 1.5 || p.isTurboActive) {
      const lineCount = 15;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i < lineCount; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const len = 40 + Math.random() * 80;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len);
        ctx.stroke();
      }
    }

    ctx.restore();
    ctx.restore();
    ctx.shadowBlur = 0;
  };

  const loop = (time: number) => {
    update(time);
    draw(time);
    animationFrameId.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    // Load Ghost Data
    const saved = localStorage.getItem(`ghost_${difficulty}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        ghostDataRef.current = data.snapshots || [];
      } catch (e) {
        ghostDataRef.current = [];
      }
    } else {
      ghostDataRef.current = [];
    }
  }, [difficulty]);

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
    
    const handleKeyDown = (e: KeyboardEvent) => {
      audio.init();
      audio.resume();
      keysPressed.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };
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

  const prevGameStateRef = useRef<GameState>(gameState);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      if (prevGameStateRef.current !== GameState.PAUSED) {
        initGame();
      }
      audio.init();
      audio.resume();
    } else {
      audio.stop();
    }
    prevGameStateRef.current = gameState;
  }, [gameState]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#050608] overflow-hidden relative touch-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
