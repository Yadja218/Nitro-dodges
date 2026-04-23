/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GameState, Difficulty } from './types';
import GameCanvas from './components/GameCanvas';
import { Trophy, Play, RotateCcw, Crosshair, Terminal, Gauge, Activity, Cpu } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [score, setScore] = useState(0);
  const [turboLevel, setTurboLevel] = useState(1);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('neon_racer_highscore');
    return saved ? JSON.parse(saved) : { EASY: 0, MEDIUM: 0, HARD: 0 };
  });

  const startGame = (diff: Difficulty) => {
    setDifficulty(diff);
    setTurboLevel(1);
    setGameState(GameState.PLAYING);
  };

  const handleGameOver = (finalScore: number) => {
    if (gameState !== GameState.PLAYING) return;
    setGameState(GameState.GAMEOVER);
    const newHighScores = { ...highScore };
    if (finalScore > newHighScores[difficulty]) {
      newHighScores[difficulty] = finalScore;
      setHighScore(newHighScores);
      localStorage.setItem('neon_racer_highscore', JSON.stringify(newHighScores));
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050608] text-slate-300 font-sans selection:bg-yellow-500/30 overflow-hidden select-none">
      <GameCanvas 
        onGameOver={handleGameOver} 
        gameState={gameState} 
        score={score}
        setScore={setScore}
        difficulty={difficulty}
        onTurboChange={setTurboLevel}
      />

      {/* HUD: Playing State */}
      {gameState === GameState.PLAYING && (
        <div className="absolute inset-0 pointer-events-none p-4 md:p-6 flex flex-col justify-between z-20">
          {/* Top Bar */}
          <div className="flex justify-between items-start">
            {/* SCORE BOX */}
            <div className="bg-[#facc15] px-6 py-2 border-b-4 border-[#ca8a04]">
              <div className="text-[10px] font-black text-black/60 uppercase tracking-tighter">SCORE</div>
              <div className="text-3xl font-black text-black leading-none tabular-nums">{score}</div>
            </div>

            {/* PROGRESS BAR (Center) */}
            <div className="hidden md:flex flex-col items-center flex-1 max-w-md mt-2">
              <div className="text-[10px] font-black text-white uppercase mb-1 drop-shadow-md">
                Challenge: Reach distance in time
              </div>
              <div className="w-full h-8 bg-black/40 backdrop-blur-sm border-2 border-white/20 relative flex items-center px-1">
                 <div className="absolute left-[10%] w-px h-full bg-white/20" />
                 <div className="absolute left-[33%] w-px h-full bg-white/20" />
                 <div className="absolute left-[66%] w-px h-full bg-white/20" />
                 {/* Progress Car Icon */}
                 <div 
                  className="w-4 h-4 bg-white rounded-sm absolute transition-all" 
                  style={{ left: `${Math.min(95, (score / 10000) * 100)}%` }}
                 />
                 <div className="absolute right-2 top-0 bottom-0 flex items-center">
                   <div className="w-3 h-3 bg-yellow-400 rotate-45" title="Finish" />
                 </div>
              </div>
            </div>

            {/* GEAR/KPH BOX */}
            <div className="bg-[#facc15] px-6 py-2 border-b-4 border-[#ca8a04] flex gap-8">
              <div className="text-right">
                <div className="text-[10px] font-black text-black/60 uppercase tracking-tighter">GEAR</div>
                <div className="text-3xl font-black text-black leading-none">{difficulty === 'HARD' ? '6' : difficulty === 'MEDIUM' ? '4' : '2'}/6</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black text-black/60 uppercase tracking-tighter">KPH</div>
                <div className="text-3xl font-black text-black leading-none tabular-nums">{Math.floor(score / 100 + 40)}</div>
              </div>
            </div>
          </div>

          {/* Bottom Controls Overlay (UI Visual Only) */}
          <div className="flex justify-between items-end">
            {/* Steering Arrows (Left) */}
            <div className="flex gap-4 opacity-40">
              <div className="w-16 h-16 border-2 border-white rounded-lg flex items-center justify-center">
                <div className="w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-12 border-r-white" />
              </div>
              <div className="w-16 h-16 border-2 border-white rounded-lg flex items-center justify-center">
                <div className="w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-12 border-l-white" />
              </div>
            </div>

            {/* Stats (Right) */}
            <div className="flex flex-col items-end gap-2">
              <div className="bg-black/60 px-4 py-2 border-r-4 border-yellow-500 w-48">
                <div className="flex justify-between text-[10px] font-black text-white italic">
                  <span>DISTANCE</span>
                  <span className="text-yellow-400">{(score/1000).toFixed(1)} KM</span>
                </div>
              </div>
              <div className="bg-black/60 px-4 py-2 border-r-4 border-yellow-500 w-48">
                <div className="flex justify-between text-[10px] font-black text-white italic">
                  <span>OVERTAKE</span>
                  <span className="text-yellow-400">0</span>
                </div>
              </div>
              <div className="bg-black/60 px-4 py-2 border-r-4 border-yellow-500 w-24 text-right">
                <div className="text-lg font-black text-white italic tabular-nums">36.39</div>
              </div>

              {/* Pedals (Right) */}
              <div className="flex gap-4 mt-4 opacity-40">
                <div className="w-14 h-20 bg-white/20 rounded-xl border-2 border-white/30 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-4 border-white/50" />
                </div>
                <div className="w-14 h-24 bg-white/30 rounded-xl border-2 border-white/50" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screens */}
      <AnimatePresence>
        {gameState === GameState.START && (
          <motion.div 
            key="start-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md p-6 text-center"
          >
             <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#facc15] p-10 border-b-8 border-[#ca8a04] w-full max-w-xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-white/30" />
              <h1 className="text-7xl font-black text-black italic tracking-tighter mb-1 uppercase">
                MR RACER
              </h1>
              <p className="text-black/60 font-black uppercase tracking-widest text-[10px] mb-8">
                DAYTIME HIGHWAY SIMULATION
              </p>
              
              <div className="grid gap-4 mb-8">
                <div className="bg-black text-[#facc15] p-3 text-sm font-black italic uppercase">
                  Select Sync Protocol
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => startGame(level)}
                      className="bg-black text-[10px] font-black text-white py-3 hover:bg-black/80 transition-all border-b-4 border-yellow-800"
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-black/5 p-4 border border-black/10 text-left mb-8">
                <div className="text-[10px] font-black text-black uppercase mb-2">Controls</div>
                <div className="grid grid-cols-2 gap-y-2 text-[10px] font-bold text-black/70">
                  <div className="flex items-center gap-2">
                    <span className="bg-black text-yellow-400 px-1.5 py-0.5 rounded">A/D</span> <span>STEERING</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-black text-yellow-400 px-1.5 py-0.5 rounded">W/UP</span> <span>TURBO</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => startGame('MEDIUM')}
                className="w-full bg-black text-[#facc15] py-5 font-black italic text-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
              >
                ENTER SIMULATION
              </button>
            </motion.div>
          </motion.div>
        )}

        {gameState === GameState.DIFFICULTY_SELECT && (
          <motion.div 
            key="diff-select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-[#050608]/95 p-6"
          >
            <div className="text-cyan-400/50 uppercase tracking-[0.4em] text-xs font-bold mb-12">Select Sync Protocol</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
              {(['EASY', 'MEDIUM', 'HARD'] as Difficulty[]).map((level) => (
                <button
                  key={level}
                  onClick={() => startGame(level)}
                  className={`group relative p-10 border transition-all text-left overflow-hidden ${
                    level === 'HARD' ? 'border-rose-500/30 hover:border-rose-500 bg-rose-500/5' : 
                    level === 'MEDIUM' ? 'border-orange-400/30 hover:border-orange-400 bg-orange-400/5' : 
                    'border-cyan-400/30 hover:border-cyan-400 bg-cyan-400/5'
                  }`}
                >
                  <div className={`text-[10px] uppercase font-black tracking-widest mb-2 ${
                    level === 'HARD' ? 'text-rose-500' : 
                    level === 'MEDIUM' ? 'text-orange-400' : 'text-cyan-400'
                  }`}>{level} PROTOCOL</div>
                  <h3 className="text-2xl font-bold text-white mb-6 uppercase italic tracking-tighter">
                    {level === 'EASY' ? 'Cruiser Mode' : level === 'MEDIUM' ? 'Sector Sprint' : 'Lethal Drift'}
                  </h3>
                  <div className="text-xs text-slate-500 font-mono space-y-1">
                    <div>{">"} VELOCITY: {level === 'EASY' ? 'LOW' : level === 'MEDIUM' ? 'MED' : 'MAX'}</div>
                    <div>{">"} TRAFFIC: {level === 'EASY' ? 'SPARSE' : level === 'MEDIUM' ? 'DENSE' : 'EXTREME'}</div>
                    <div>{">"} HI-SCORE: {highScore[level]}</div>
                  </div>
                  <div className={`absolute bottom-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity ${
                    level === 'HARD' ? 'text-rose-500' : 
                    level === 'MEDIUM' ? 'text-orange-400' : 'text-cyan-400'
                  }`}>
                    <Play size={24} fill="currentColor" />
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {gameState === GameState.GAMEOVER && (
          <motion.div 
            key="gameover-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center"
          >
            <motion.div
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#facc15] p-10 border-b-8 border-[#ca8a04] w-full max-w-md"
            >
              <h2 className="text-6xl font-black text-black italic tracking-tighter mb-4 uppercase text-center">
                CRASHED!
              </h2>
              <div className="bg-black text-[#facc15] p-8 mb-8 flex flex-col items-center">
                  <div className="text-[10px] uppercase tracking-widest font-black opacity-60 mb-2">Final Distance</div>
                  <div className="text-6xl font-black italic">{(score/1000).toFixed(1)} <span className="text-sm">KM</span></div>
              </div>

              <div className="space-y-2 text-left mb-8">
                <div className="flex justify-between border-b border-black/10 pb-1">
                  <span className="text-[10px] font-black uppercase text-black/60">BEST ({difficulty})</span>
                  <span className="text-sm font-black text-black">{(highScore[difficulty]/1000).toFixed(1)} KM</span>
                </div>
              </div>

              <div className="grid gap-3">
                <button
                  onClick={() => startGame(difficulty)}
                  className="w-full bg-black text-[#facc15] py-4 font-black italic text-lg hover:bg-black/90 transition-all shadow-lg"
                >
                  RETRY
                </button>
                <button
                  onClick={() => setGameState(GameState.START)}
                  className="w-full bg-black/10 text-black py-3 font-black text-[10px] uppercase tracking-widest hover:bg-black/20 transition-all"
                >
                  RETURN TO MENU
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-6 left-8 flex items-center gap-8 pointer-events-none opacity-20">
         <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span className="text-[9px] font-bold uppercase tracking-[0.3em]">NAV_SYNC: OK</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-600" />
            <span className="text-[9px] font-bold uppercase tracking-[0.3em]">PROX_WARN: READY</span>
         </div>
         <div className="text-[9px] font-bold uppercase tracking-[0.3em]">OPERATOR_OVRD: ACTIVE // ID: {localStorage.getItem('neon_racer_id') || '0XF4E2'}</div>
      </div>
    </div>
  );
}
