import { useState, useRef, useCallback } from 'react'

/**
 * HardCaptcha — Drag & Drop Image Puzzle
 * ========================================
 * High-difficulty challenge for HARD_CAPTCHA decisions.
 * Scrambles a 2×2 image into 4 pieces — user must drag them
 * back into correct order within 5 attempts.
 *
 * Images: place puzz_1.jpg … puzz_62.jpg inside:
 *   frontend/public/images/
 * They are referenced as /images/puzz_N.jpg
 *
 * Piece positions map:
 *   [1]=top-left  [2]=top-right
 *   [3]=bot-left  [4]=bot-right
 * bg-position for 300×300 image split into 4×150px tiles:
 *   1 → 0    0      2 → -150  0
 *   3 → 0   -150    4 → -150 -150
 */

const TOTAL_IMAGES = 62

const BG_POSITIONS = {
  1: '0px 0px',
  2: '-150px 0px',
  3: '0px -150px',
  4: '-150px -150px',
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildPuzzle() {
  const imgIndex   = Math.floor(Math.random() * TOTAL_IMAGES) + 1
  const imageUrl   = `/images/puzz_${imgIndex}.jpg`
  const shuffled   = shuffleArray([1, 2, 3, 4])
  // Each piece: { id: slotIndex(1-4), position: correctPieceValue(1-4), bgPos }
  return {
    imageUrl,
    pieces: [1, 2, 3, 4].map((slot, i) => ({
      slot,                           // which grid cell this occupies
      position: shuffled[i],          // which piece of the image is showing
      bgPos: BG_POSITIONS[shuffled[i]],
    }))
  }
}

export function HardCaptcha({ onVerify, onDismiss }) {
  const [puzzle,   setPuzzle]   = useState(() => buildPuzzle())
  const [phase,    setPhase]    = useState('playing')  // playing | done | blocked
  const [attempts, setAttempts] = useState(0)
  const [message,  setMessage]  = useState('')
  const [dragFrom, setDragFrom] = useState(null)       // slot index being dragged
  const [imgError, setImgError] = useState(false)

  const MAX_ATTEMPTS = 5

  // ── Drag handlers ─────────────────────────────────────────
  const handleDragStart = useCallback((slot) => {
    setDragFrom(slot)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback((targetSlot) => {
    if (dragFrom === null || dragFrom === targetSlot) {
      setDragFrom(null)
      return
    }
    setPuzzle(prev => {
      const pieces = prev.pieces.map(p => ({ ...p }))
      const fromIdx = pieces.findIndex(p => p.slot === dragFrom)
      const toIdx   = pieces.findIndex(p => p.slot === targetSlot)
      // Swap bgPos and position between the two slots
      const tempPos  = pieces[fromIdx].position
      const tempBg   = pieces[fromIdx].bgPos
      pieces[fromIdx].position = pieces[toIdx].position
      pieces[fromIdx].bgPos    = pieces[toIdx].bgPos
      pieces[toIdx].position   = tempPos
      pieces[toIdx].bgPos      = tempBg
      return { ...prev, pieces }
    })
    setMessage('')
    setDragFrom(null)
  }, [dragFrom])

  // ── Touch drag support ────────────────────────────────────
  const touchFrom = useRef(null)

  const handleTouchStart = useCallback((slot) => {
    touchFrom.current = slot
  }, [])

  const handleTouchEnd = useCallback((e, targetSlot) => {
    e.preventDefault()
    if (touchFrom.current !== null && touchFrom.current !== targetSlot) {
      handleDrop(targetSlot)   // reuse same swap logic
    }
    touchFrom.current = null
  }, [handleDrop])

  // ── Verify ────────────────────────────────────────────────
  const handleVerify = () => {
    const correct = puzzle.pieces.every(p => p.position === p.slot)
    if (correct) {
      setPhase('done')
      setMessage('Verified')
      setTimeout(() => onVerify(), 800)
    } else {
      const next = attempts + 1
      setAttempts(next)
      setMessage('Incorrect — try rearranging the pieces')
      if (next >= MAX_ATTEMPTS) {
        setPhase('blocked')
      }
    }
  }

  // ── Refresh ───────────────────────────────────────────────
  const handleRefresh = () => {
    setPuzzle(buildPuzzle())
    setMessage('')
    setImgError(false)
    // Don't reset attempts — keep pressure on
  }

  const sortedPieces = [...puzzle.pieces].sort((a, b) => a.slot - b.slot)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-sm mx-4 bg-terminal-surface border border-orange-400/40 rounded-2xl overflow-hidden shadow-2xl"
        style={{ boxShadow: '0 0 40px rgba(249,115,22,0.12)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <span className="text-orange-400 text-lg"></span>
            <span className="font-mono text-sm font-bold text-orange-400 tracking-wide">CHALLENGE REQUIRED</span>
          </div>
          <button onClick={onDismiss} className="text-terminal-dim hover:text-terminal-text transition-colors font-mono text-xs">✕</button>
        </div>

        <div className="p-5 space-y-4">

          {/* Blocked state */}
          {phase === 'blocked' && (
            <div className="text-center space-y-4 animate-fade-in py-4">
              <div className="text-5xl">🚫</div>
              <p className="font-mono text-sm text-terminal-red font-bold">Too many failed attempts</p>
              <p className="font-sans text-xs text-terminal-dim">Your session has been flagged. Please try again later.</p>
              <button onClick={onDismiss}
                className="w-full py-3 rounded-lg font-mono text-sm tracking-widest uppercase border border-terminal-red/40 text-terminal-red hover:bg-terminal-red/5 transition-all">
                Close
              </button>
            </div>
          )}

          {/* Playing / done state */}
          {phase !== 'blocked' && (
            <>
              <div className="text-center space-y-0.5">
                <p className="font-sans text-sm font-medium text-terminal-text">
                  Complete the puzzle to verify you're human
                </p>
                <p className="font-mono text-xs text-terminal-dim">
                  Drag pieces into the correct order · {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} remaining
                </p>
              </div>

              {/* Puzzle grid */}
              {imgError ? (
                <div className="bg-terminal-bg border border-terminal-border rounded-xl p-6 text-center space-y-2">
                  <p className="font-mono text-xs text-terminal-red">⚠ Image not found</p>
                  <p className="font-mono text-[10px] text-terminal-dim">
                    Place images in: <span className="text-terminal-amber">frontend/public/images/</span>
                  </p>
                  <button onClick={handleRefresh}
                    className="mt-2 font-mono text-xs text-terminal-dim underline hover:text-terminal-text">
                    Try another
                  </button>
                </div>
              ) : (
                <div
                  className="grid gap-1.5 mx-auto"
                  style={{ gridTemplateColumns: 'repeat(2, 150px)', gridTemplateRows: 'repeat(2, 150px)', width: '305px' }}
                >
                  {sortedPieces.map((piece) => (
                    <div
                      key={piece.slot}
                      draggable={phase === 'playing'}
                      onDragStart={() => handleDragStart(piece.slot)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(piece.slot)}
                      onTouchStart={() => handleTouchStart(piece.slot)}
                      onTouchEnd={(e) => handleTouchEnd(e, piece.slot)}
                      className={`w-[150px] h-[150px] rounded-lg cursor-move select-none border-2 transition-all duration-150
                        ${dragFrom === piece.slot
                          ? 'opacity-50 border-orange-400 scale-95'
                          : 'border-terminal-border hover:border-orange-400/50'}`}
                      style={{
                        backgroundImage:    `url(${puzzle.imageUrl})`,
                        backgroundSize:     '300px 300px',
                        backgroundPosition: piece.bgPos,
                        backgroundRepeat:   'no-repeat',
                      }}
                    >
                      {/* Fallback: detect image load error via an invisible img tag */}
                      {piece.slot === 1 && (
                        <img
                          src={puzzle.imageUrl}
                          alt=""
                          className="hidden"
                          onError={() => setImgError(true)}
                          onLoad={() => setImgError(false)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Message */}
              {message && (
                <p className={`text-center font-mono text-sm font-bold animate-fade-in
                  ${phase === 'done' ? 'text-terminal-green' : 'text-terminal-red'}`}>
                  {phase === 'done' ? '✓ ' : '✕ '}{message}
                </p>
              )}

              {/* Controls */}
              <div className="flex gap-3">
                <button
                  onClick={handleRefresh}
                  disabled={phase === 'done'}
                  className="flex-1 py-2.5 rounded-lg font-mono text-xs font-medium tracking-widest uppercase transition-all disabled:opacity-40 border border-terminal-red/50 text-terminal-red hover:bg-terminal-red/5"
                >
                  ↺ Refresh
                </button>
                <button
                  onClick={handleVerify}
                  disabled={phase === 'done' || imgError}
                  className="flex-1 py-2.5 rounded-lg font-mono text-xs font-medium tracking-widest uppercase transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#0d0f12' }}
                >
                  Verify
                </button>
              </div>

              {/* Attempt indicator dots */}
              <div className="flex justify-center gap-1.5">
                {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i < attempts ? 'bg-terminal-red' : 'bg-terminal-muted'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}