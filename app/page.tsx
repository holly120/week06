"use client";

import { useState, useEffect, useRef, FormEvent } from "react";

interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  date: string;
}

// Particle class for explosion effects
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  decay: number;
  size: number;

  constructor(x: number, y: number, color: string) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6;
    this.color = color;
    this.alpha = 1;
    this.decay = Math.random() * 0.02 + 0.015;
    this.size = Math.random() * 3 + 2;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.restore();
  }
}

// Star class for parallax space background
class Star {
  x: number;
  y: number;
  size: number;
  speed: number;

  constructor(width: number, height: number, randomizeY = true) {
    this.x = Math.random() * width;
    this.y = randomizeY ? Math.random() * height : 0;
    this.size = Math.random() * 2 + 0.5;
    this.speed = Math.random() * 1.5 + 0.5;
  }

  update(height: number) {
    this.y += this.speed;
    if (this.y > height) {
      this.y = 0;
      this.x = Math.random() * 600; // Reset X
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "rgba(255, 255, 255, " + (0.3 + this.speed / 2.5) + ")";
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

export default function GamePage() {
  // Game states
  const [gameState, setGameState] = useState<"START" | "PLAYING" | "GAMEOVER">("START");
  const gameStateRef = useRef<"START" | "PLAYING" | "GAMEOVER">("START");
  const [score, setScore] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [wave, setWave] = useState<number>(1);
  const [highScores, setHighScores] = useState<ScoreEntry[]>([]);

  // Form states (Game Over Screen)
  const [playerName, setPlayerName] = useState<string>("");
  const [playerScoreInput, setPlayerScoreInput] = useState<string>("0");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<string>("");

  // Sound Audio Context
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Canvas Reference
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Key tracking
  const keysRef = useRef<{ [key: string]: boolean }>({});

  // Game Engine mutable objects
  const playerRef = useRef({ x: 280, y: 440, width: 40, height: 30, speed: 7, lastShot: 0 });
  const lasersRef = useRef<{ x: number; y: number; width: number; height: number; speed: number }[]>([]);
  const enemiesRef = useRef<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: "red" | "yellow" | "cyan";
    points: number;
  }[]>([]);
  const enemyLasersRef = useRef<{ x: number; y: number; width: number; height: number; speed: number }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);

  // Movement properties for enemy swarm
  const enemyDirectionRef = useRef<number>(1); // 1 = right, -1 = left
  const enemyMoveDownTimerRef = useRef<number>(0);
  const enemySpeedRef = useRef<number>(1.2);

  // Synchronized refs for game-loop access to current values
  const scoreValRef = useRef<number>(0);
  const livesValRef = useRef<number>(3);
  const waveValRef = useRef<number>(1);

  // Sync ref values to state
  const updateScore = (val: number) => {
    scoreValRef.current = val;
    setScore(val);
  };

  const updateLives = (val: number) => {
    livesValRef.current = val;
    setLives(val);
  };

  const updateWave = (val: number) => {
    waveValRef.current = val;
    setWave(val);
  };

  // Fetch leaderboard high scores
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch("/api/scores");
      if (response.ok) {
        const data = await response.json();
        setHighScores(data);
      }
    } catch (err) {
      console.error("Failed to fetch high scores:", err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetKeys = ["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD", " "];
      if (targetKeys.includes(e.code) || targetKeys.includes(e.key)) {
        if (e.key === " ") {
          e.preventDefault(); // Stop page scrolling
        }
      }
      keysRef.current[e.key.toLowerCase()] = true;
      keysRef.current[e.code.toLowerCase()] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
      keysRef.current[e.code.toLowerCase()] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Web Audio Synthesizer sound effects
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  const playLaserSound = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.12);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  };

  const playEnemyLaserSound = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(300, ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  };

  const playExplosionSound = () => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.25);
    
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  };

  const playMelody = (notes: number[], durations: number[]) => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    let time = ctx.currentTime;
    notes.forEach((freq, idx) => {
      if (freq === 0) {
        time += durations[idx];
        return;
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, time);
      
      gain.gain.setValueAtTime(0.04, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + durations[idx] - 0.02);
      
      osc.start(time);
      osc.stop(time + durations[idx]);
      
      time += durations[idx];
    });
  };

  const playChimeStart = () => {
    // Upward retro arcade melody: C5 (523), E5 (659), G5 (784), C6 (1046)
    playMelody([523.25, 659.25, 783.99, 1046.5], [0.08, 0.08, 0.08, 0.22]);
  };

  const playChimeGameOver = () => {
    // Downward sad retro melody: G4 (392), F4 (349), Eb4 (311), C4 (261)
    playMelody([392.0, 349.23, 311.13, 261.63], [0.15, 0.15, 0.15, 0.45]);
  };

  // Initialize and spawn an enemy wave
  const spawnEnemySwarm = (waveNum: number) => {
    const rows = 4;
    const cols = 8;
    const enemyWidth = 32;
    const enemyHeight = 24;
    const spacingX = 16;
    const spacingY = 16;
    const offsetX = 80;
    const offsetY = 50;

    const list = [];
    const types: ("red" | "yellow" | "cyan")[] = ["red", "yellow", "cyan", "yellow"];
    const pointsMap = { red: 10, yellow: 10, cyan: 10 };

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const type = types[r] || "cyan";
        list.push({
          id: `${r}-${c}`,
          x: offsetX + c * (enemyWidth + spacingX),
          y: offsetY + r * (enemyHeight + spacingY),
          width: enemyWidth,
          height: enemyHeight,
          type,
          points: pointsMap[type] || 10,
        });
      }
    }

    enemiesRef.current = list;
    enemyDirectionRef.current = 1;
    enemySpeedRef.current = 0.8 + waveNum * 0.4;
  };

  // Trigger game start
  const handleStartGame = () => {
    initAudio();
    playChimeStart();

    // Reset statistics
    updateScore(0);
    updateLives(3);
    updateWave(1);
    setGameState("PLAYING");
    gameStateRef.current = "PLAYING";

    // Setup entities
    playerRef.current = { x: 280, y: 440, width: 40, height: 30, speed: 6, lastShot: 0 };
    lasersRef.current = [];
    enemyLasersRef.current = [];
    particlesRef.current = [];

    // Pre-populate stars
    const stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push(new Star(600, 500, true));
    }
    starsRef.current = stars;

    spawnEnemySwarm(1);
  };

  // Submit new score to leaderboard
  const handleSubmitScore = async (e: FormEvent) => {
    e.preventDefault();
    const finalName = playerName.trim() || "PLAYER_1";
    const finalScore = parseInt(playerScoreInput, 10);

    if (isNaN(finalScore) || finalScore < 0) {
      setSubmitMessage("❌ 分數必須是有效的正整數");
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: finalName, score: finalScore }),
      });

      if (res.ok) {
        setSubmitMessage("🚀 分數成功登錄排行榜！");
        setPlayerName("");
        fetchLeaderboard();
      } else {
        setSubmitMessage("❌ 送出失敗，請重試");
      }
    } catch (err) {
      setSubmitMessage("❌ 伺服器連接錯誤");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Main game animation loop
  useEffect(() => {
    if (gameState !== "PLAYING") {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let localFrame = 0;

    const gameLoop = () => {
      localFrame++;
      
      if (gameStateRef.current !== "PLAYING") {
        return;
      }

      // 1. UPDATE STATE & CONTROLS
      const keys = keysRef.current;
      const player = playerRef.current;

      // Player Movement
      if (keys["arrowleft"] || keys["a"] || keys["keya"]) {
        player.x -= player.speed;
        if (player.x < 0) player.x = 0;
      }
      if (keys["arrowright"] || keys["d"] || keys["keyd"]) {
        player.x += player.speed;
        if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;
      }

      // Player shooting: press Space (cooldown 260ms)
      if ((keys["space"] || keys[" "] || keys["arrowup"] || keys["w"]) && Date.now() - player.lastShot > 260) {
        lasersRef.current.push({
          x: player.x + player.width / 2 - 2,
          y: player.y - 12,
          width: 4,
          height: 12,
          speed: 8,
        });
        player.lastShot = Date.now();
        playLaserSound();
      }

      // Update Player Lasers
      const lasers = lasersRef.current;
      for (let i = lasers.length - 1; i >= 0; i--) {
        lasers[i].y -= lasers[i].speed;
        if (lasers[i].y < 0) {
          lasers.splice(i, 1);
        }
      }

      // Update Enemy Swarm Movement
      const enemies = enemiesRef.current;
      let shouldShiftDown = false;
      const currentSpeed = enemySpeedRef.current;

      // Find boundaries of the pack to reverse direction
      enemies.forEach((enemy) => {
        enemy.x += enemyDirectionRef.current * currentSpeed;
        if (enemy.x <= 10 || enemy.x >= canvas.width - enemy.width - 10) {
          shouldShiftDown = true;
        }
      });

      if (shouldShiftDown) {
        enemyDirectionRef.current *= -1;
        enemies.forEach((enemy) => {
          enemy.y += 18; // Move swarm down
          enemy.x += enemyDirectionRef.current * currentSpeed; // instantly push back in new direction
        });

        // Check if any alien reached the player's level
        const lowestEnemy = Math.max(...enemies.map(e => e.y + e.height));
        if (lowestEnemy >= player.y - 5) {
          // Instantly game over!
          playChimeGameOver();
          setGameState("GAMEOVER");
          gameStateRef.current = "GAMEOVER";
          setPlayerScoreInput(scoreValRef.current.toString());
          return;
        }
      }

      // Spawn random enemy lasers (rate scales aggressively with waves!)
      const fireThreshold = 0.006 + waveValRef.current * 0.0045;
      if (enemies.length > 0 && Math.random() < fireThreshold) {
        // Pick a random alien from the swarm
        const shooter = enemies[Math.floor(Math.random() * enemies.length)];
        
        // In Wave 3 or higher, enemies have a 35% chance to trigger a dangerous DOUBLE laser burst!
        const isDoubleShot = waveValRef.current >= 3 && Math.random() < 0.35;
        const laserSpeed = 4.5 + waveValRef.current * 0.6; // Speed scales faster with level!

        if (isDoubleShot) {
          // Double parallel lasers from both wings!
          enemyLasersRef.current.push({
            x: shooter.x,
            y: shooter.y + shooter.height,
            width: 3,
            height: 12,
            speed: laserSpeed,
          });
          enemyLasersRef.current.push({
            x: shooter.x + shooter.width - 3,
            y: shooter.y + shooter.height,
            width: 3,
            height: 12,
            speed: laserSpeed,
          });
        } else {
          // Standard single laser from center
          enemyLasersRef.current.push({
            x: shooter.x + shooter.width / 2 - 2,
            y: shooter.y + shooter.height,
            width: 4,
            height: 12,
            speed: laserSpeed,
          });
        }
        playEnemyLaserSound();
      }

      // Update Enemy Lasers
      const enemyLasers = enemyLasersRef.current;
      for (let i = enemyLasers.length - 1; i >= 0; i--) {
        enemyLasers[i].y += enemyLasers[i].speed;

        // Player hurt collision check
        const laser = enemyLasers[i];
        if (
          laser.x < player.x + player.width &&
          laser.x + laser.width > player.x &&
          laser.y < player.y + player.height &&
          laser.y + laser.height > player.y
        ) {
          // Remove laser and deduct life
          enemyLasers.splice(i, 1);
          const nextLives = livesValRef.current - 1;
          updateLives(nextLives);
          playExplosionSound();

          // Create sparks at player cruiser
          for (let p = 0; p < 15; p++) {
            particlesRef.current.push(new Particle(player.x + player.width / 2, player.y + player.height / 2, "#39ff14"));
          }

          if (nextLives <= 0) {
            playChimeGameOver();
            setGameState("GAMEOVER");
            gameStateRef.current = "GAMEOVER";
            setPlayerScoreInput(scoreValRef.current.toString());
            return;
          }
          continue;
        }

        // Remove if off screen
        if (enemyLasers[i].y > canvas.height) {
          enemyLasers.splice(i, 1);
        }
      }

      // Laser to Alien Collision Detection
      for (let l = lasers.length - 1; l >= 0; l--) {
        let hit = false;
        for (let e = enemies.length - 1; e >= 0; e--) {
          const laser = lasers[l];
          const alien = enemies[e];

          if (
            laser.x < alien.x + alien.width &&
            laser.x + laser.width > alien.x &&
            laser.y < alien.y + alien.height &&
            laser.y + laser.height > alien.y
          ) {
            // Register Hit
            playExplosionSound();
            
            // Create debris particles
            const colors = { red: "#ff007f", yellow: "#fffb00", cyan: "#00f3ff" };
            const debrisColor = colors[alien.type] || "#ffffff";
            for (let p = 0; p < 8; p++) {
              particlesRef.current.push(new Particle(alien.x + alien.width / 2, alien.y + alien.height / 2, debrisColor));
            }

            // Award points
            const nextScore = scoreValRef.current + alien.points;
            updateScore(nextScore);

            // Clean up elements
            enemies.splice(e, 1);
            lasers.splice(l, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      }

      // Check if all aliens are killed
      if (enemies.length === 0) {
        // Advance Wave!
        const nextWave = waveValRef.current + 1;
        updateWave(nextWave);
        spawnEnemySwarm(nextWave);
        // Play wave start chime
        playChimeStart();
      }

      // Update background space stars
      starsRef.current.forEach((star) => star.update(canvas.height));

      // Update particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      // 2. DRAW GRAPHICS
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Starfield Background
      starsRef.current.forEach((star) => star.draw(ctx));

      // Particles
      particlesRef.current.forEach((p) => p.draw(ctx));

      // Player Spaceship (drawn with custom cyberpunk neon polygons)
      ctx.save();
      ctx.shadowBlur = 12;
      ctx.shadowColor = "#39ff14";
      ctx.fillStyle = "#39ff14";
      
      // Draw fighter cabin nose
      ctx.beginPath();
      ctx.moveTo(player.x + player.width / 2, player.y);
      ctx.lineTo(player.x + player.width, player.y + player.height);
      ctx.lineTo(player.x + player.width - 6, player.y + player.height - 4);
      ctx.lineTo(player.x + 6, player.y + player.height - 4);
      ctx.lineTo(player.x, player.y + player.height);
      ctx.closePath();
      ctx.fill();

      // Wing Cannons
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(player.x + 2, player.y + player.height - 18, 4, 12);
      ctx.fillRect(player.x + player.width - 6, player.y + player.height - 18, 4, 12);

      // Thruster Flame
      if (localFrame % 2 === 0) {
        ctx.fillStyle = "#ffaa00";
        ctx.shadowColor = "#ff007f";
        ctx.beginPath();
        ctx.moveTo(player.x + player.width / 2 - 4, player.y + player.height - 2);
        ctx.lineTo(player.x + player.width / 2, player.y + player.height + 8);
        ctx.lineTo(player.x + player.width / 2 + 4, player.y + player.height - 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      // Draw Player Lasers (Glowing cyan cylinders)
      lasersRef.current.forEach((laser) => {
        ctx.save();
        ctx.fillStyle = "#00f3ff";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#00f3ff";
        ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
        ctx.restore();
      });

      // Draw Enemy Lasers (Glowing magenta thin lines)
      enemyLasersRef.current.forEach((laser) => {
        ctx.save();
        ctx.fillStyle = "#ff007f";
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ff007f";
        ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
        ctx.restore();
      });

      // Draw Enemy Aliens (Invaders) with a flapping wings animation
      const isWingFlap = Math.sin(localFrame * 0.15) > 0;
      enemiesRef.current.forEach((enemy) => {
        ctx.save();
        const colors = { red: "#ff007f", yellow: "#fffb00", cyan: "#00f3ff" };
        const shadowColor = colors[enemy.type] || "#ffffff";
        ctx.fillStyle = shadowColor;
        ctx.shadowBlur = 10;
        ctx.shadowColor = shadowColor;

        // Draw alien head
        ctx.fillRect(enemy.x + 8, enemy.y, enemy.width - 16, 4);

        // Core shell
        ctx.fillRect(enemy.x + 4, enemy.y + 4, enemy.width - 8, 12);
        
        // Red glowing eyes
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(enemy.x + 10, enemy.y + 6, 2, 2);
        ctx.fillRect(enemy.x + enemy.width - 12, enemy.y + 6, 2, 2);

        // Retarget alien body color
        ctx.fillStyle = shadowColor;

        // Tail/mandibles
        ctx.fillRect(enemy.x + 8, enemy.y + 16, 4, 6);
        ctx.fillRect(enemy.x + enemy.width - 12, enemy.y + 16, 4, 6);

        // Flapping wings
        if (isWingFlap) {
          // Outstretched wings
          ctx.fillRect(enemy.x, enemy.y + 2, 4, 10);
          ctx.fillRect(enemy.x + enemy.width - 4, enemy.y + 2, 4, 10);
        } else {
          // Folded/down wings
          ctx.fillRect(enemy.x, enemy.y + 6, 4, 12);
          ctx.fillRect(enemy.x + enemy.width - 4, enemy.y + 6, 4, 12);
        }

        ctx.restore();
      });

      animationFrameIdRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameIdRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [gameState]);

  return (
    <div className="game-container">
      {/* Dynamic SEO Heading */}
      <header className="game-header">
        <h1 className="game-title select-none">
          太空小蜜蜂 <span className="text-neon-magenta font-black">Galactica</span>
        </h1>
        <p className="press-start-text text-neon-cyan game-subtitle select-none" style={{ fontSize: "0.65rem" }}>
          - 經典復古大型機台射擊遊戲 -
        </p>
      </header>

      {/* Main Grid Wrapper */}
      <main className="game-layout">
        
        {/* Left Side: Arcade Cabinet */}
        <section className="arcade-column">
          <div className="arcade-cabinet">
            
            {/* Screen border & scanlines overlay */}
            <div className="crt-container crt-screen-wrapper">
              
              {/* Start Screen */}
              {gameState === "START" && (
                <div className="screen-overlay">
                  <div className="text-neon-magenta text-4xl mb-4 font-extrabold tracking-widest animate-pulse font-orbitron">
                    READY PLAYER ONE
                  </div>
                  
                  <div className="press-start-text text-neon-cyan max-w-md mb-8 leading-loose border border-rgba(0, 243, 255, 0.3) p-4 rounded bg-black/60" style={{ fontSize: "0.6rem" }}>
                    <p className="font-bold text-neon-green text-[0.7rem] mb-2">【 駕駛操作指南 】</p>
                    <p>移動戰機：← / → 鍵 或 A / D 鍵</p>
                    <p>發射雷射：[空白鍵] 或 W 鍵</p>
                    <p className="mt-4 text-[#fffb00]">消滅所有外星侵略者，捍衛星系！</p>
                  </div>

                  <button 
                    onClick={handleStartGame}
                    className="cyber-btn cyan font-bold py-3 px-8 text-lg"
                    id="start-game-btn"
                  >
                    🚀 啟動引擎 START GAME
                  </button>
                </div>
              )}

              {/* Game Over Screen */}
              {gameState === "GAMEOVER" && (
                <div className="screen-overlay gameover">
                  <div className="text-neon-magenta text-3xl font-black tracking-widest mb-2 font-orbitron">
                    GAME OVER
                  </div>
                  <p className="press-start-text text-neon-cyan mb-6" style={{ fontSize: "0.7rem" }}>
                    戰機被擊毀或星系失守！
                  </p>

                  <div className="gameover-form-panel">
                    <div className="text-center mb-4">
                      <span className="press-start-text text-[#fffb00]" style={{ fontSize: "0.65rem" }}>本次戰役得分</span>
                      <h2 className="text-3xl font-extrabold text-neon-green mt-1">{score}</h2>
                    </div>

                    <form onSubmit={handleSubmitScore}>
                      <div className="form-group">
                        <label className="block press-start-text text-neon-cyan mb-2" style={{ fontSize: "0.55rem" }}>
                          請輸入指揮官代號 (Name)
                        </label>
                        <input 
                          type="text" 
                          placeholder="例如: PILOT_A"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                          maxLength={15}
                          className="cyber-input text-center"
                          id="player-name-input"
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="block press-start-text text-neon-cyan mb-2" style={{ fontSize: "0.55rem" }}>
                          驗證 / 輸入戰績分數 (Score)
                        </label>
                        <input 
                          type="number" 
                          value={playerScoreInput}
                          readOnly
                          className="cyber-input text-center text-neon-green font-bold"
                          style={{ cursor: "not-allowed", opacity: 0.85 }}
                          id="player-score-input"
                          required
                        />
                      </div>

                      <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className="cyber-btn magenta full-width mt-2"
                        id="submit-score-btn"
                      >
                        {isSubmitting ? "傳送中..." : "📡 登錄星際排行榜"}
                      </button>
                    </form>

                    {submitMessage && (
                      <p className="mt-3 text-center press-start-text text-neon-cyan animate-bounce" style={{ fontSize: "0.55rem" }}>
                        {submitMessage}
                      </p>
                    )}
                  </div>

                  <button 
                    onClick={handleStartGame}
                    className="cyber-btn cyan text-xs mt-4"
                    id="restart-game-btn"
                  >
                    🔄 再戰一局 REPLAY
                  </button>
                </div>
              )}

              {/* Game Active Canvas */}
              <canvas
                ref={canvasRef}
                width={600}
                height={500}
                className="w-full h-full block"
                style={{ backgroundColor: "#000" }}
              />
            </div>

            {/* Arcade HUD Panel */}
            <div className="hud-panel">
              <div className="hud-group">
                <span className="press-start-text text-neon-cyan" style={{ fontSize: "0.55rem" }}>SCORE</span>
                <span className="hud-value text-neon-green font-black">{score}</span>
              </div>
              <div className="hud-group center">
                <span className="press-start-text text-neon-cyan" style={{ fontSize: "0.55rem" }}>WAVE</span>
                <span className="hud-value text-neon-yellow font-black">#{wave}</span>
              </div>
              <div className="hud-group end">
                <span className="press-start-text text-neon-cyan" style={{ fontSize: "0.55rem" }}>LIVES</span>
                <div className="hud-lives-container">
                  {gameState === "PLAYING" && lives > 0 ? (
                    Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                      <svg key={i} className="hud-life-icon" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2L4 21h16L12 2zm0 4.8l5.2 11.2H6.8L12 6.8z" />
                      </svg>
                    ))
                  ) : (
                    <span className="press-start-text text-neon-magenta" style={{ fontSize: "0.55rem" }}>DEAD</span>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* Quick instructions in footer */}
          <div className="help-box">
            <span className="press-start-text text-[#8b8ba8]" style={{ fontSize: "0.55rem" }}>
              💡 射擊防禦提示：當小蜜蜂群發動水平反彈時會往下壓。小蜜蜂會隨機發射粉色雷射。將其全數擊滅可進入下一波次！
            </span>
          </div>
        </section>

        {/* Right Side: Leaderboard Panel */}
        <section className="leaderboard-column">
          <div className="arcade-panel magenta font-orbitron" style={{ minHeight: "500px", display: "flex", flexDirection: "column" }}>
            <h2 className="text-xl font-extrabold tracking-widest text-center text-neon-magenta mb-4 uppercase border-b border-rgba(255, 0, 127, 0.2) pb-2">
              🏆 星際排行榜
            </h2>

            <div className="flex-1 leaderboard-list pr-1">
              {highScores.length === 0 ? (
                <div className="leaderboard-loading press-start-text text-neon-cyan" style={{ fontSize: "0.55rem" }}>
                  🛰️ 排行榜資料載入中...
                </div>
              ) : (
                <table className="arcade-table">
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>RANK</th>
                      <th style={{ width: "45%" }}>NAME</th>
                      <th style={{ width: "35%" }}>SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highScores.map((entry, idx) => {
                      const rank = idx + 1;
                      const isTop3 = rank <= 3;
                      const rankText = rank < 10 ? `0${rank}` : `${rank}`;
                      return (
                        <tr 
                          key={entry.id} 
                          className={isTop3 ? "top-row" : ""}
                        >
                          <td className="press-start-text text-[0.58rem] font-bold">
                            {isTop3 ? (
                              <span className="text-[#fffb00] drop-shadow-[0_0_6px_#fffb00]">
                                #{rankText}
                              </span>
                            ) : (
                              <span className="text-neon-cyan">
                                #{rankText}
                              </span>
                            )}
                          </td>
                          <td className="font-extrabold text-sm truncate max-w-[120px]">
                            {isTop3 ? (
                              <span className="text-neon-magenta">{entry.name}</span>
                            ) : (
                              <span className="text-white">{entry.name}</span>
                            )}
                          </td>
                          <td className="press-start-text text-[0.62rem] text-right font-black text-neon-green">
                            {entry.score.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-rgba(255, 0, 127, 0.2) text-center">
              <span className="press-start-text text-[#8b8ba8]" style={{ fontSize: "0.5rem" }}>
                🌌 排行榜即時連線中，將自動由高至低排序。
              </span>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
