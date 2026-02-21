import { useState } from 'react'

/**
 * SoftCaptcha — Emoji Grid + Phrase Confirmation
 * ================================================
 * Medium-difficulty challenge for SOFT_CAPTCHA decisions.
 * Select matching emoji squares, then type a confirmation phrase.
 */

const CHALLENGES = [
  {
    instruction: 'Select all squares with a SHIELD',
    emoji: '🛡️',
    grid: ['🛡️','🔑','🛡️','🔒','🔑','🛡️','🔒','🔑','🛡️'],
    correct: [0, 2, 5, 8],
  },
  {
    instruction: 'Select all squares with a LOCK',
    emoji: '🔒',
    grid: ['🔑','🔒','🛡️','🔒','🛡️','🔑','🔒','🛡️','🔑'],
    correct: [1, 3, 6],
  },
  {
    instruction: 'Select all squares with a KEY',
    emoji: '🔑',
    grid: ['🛡️','🔑','🔒','🔑','🛡️','🔑','🔒','🛡️','🔑'],
    correct: [1, 3, 5, 8],
  },
]

const TARGET_PHRASE = 'I am human'

export function SoftCaptcha({ onVerify, onDismiss }) {
  const [challenge]  = useState(() => CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)])
  const [selected,   setSelected]   = useState(new Set())
  const [phase,      setPhase]      = useState('grid')   // grid | phrase | done | error
  const [phrase,     setPhrase]     = useState('')
  const [attempts,   setAttempts]   = useState(0)
  const [gridError,  setGridError]  = useState(false)
  const [phraseError,setPhraseError]= useState(false)

  const toggleCell = (i) => {
    setGridError(false)
    setSelected(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleGridSubmit = () => {
    const correct = challenge.correct
    const ok = correct.length === selected.size && correct.every(i => selected.has(i))
    if (ok) {
      setPhase('phrase')
    } else {
      const next = attempts + 1
      setAttempts(next)
      setSelected(new Set())
      setGridError(true)
      if (next >= 3) setPhase('error')
    }
  }

  const handlePhraseSubmit = () => {
    if (phrase.trim().toLowerCase() === TARGET_PHRASE.toLowerCase()) {
      setPhase('done')
      setTimeout(() => onVerify(), 700)
    } else {
      setPhraseError(true)
      setPhrase('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm mx-4 bg-terminal-surface border border-terminal-amber/40 rounded-2xl overflow-hidden shadow-2xl"
        style={{ boxShadow: '0 0 40px rgba(245,158,11,0.12)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-2">
            <span className="text-terminal-amber text-lg"></span>
            <span className="font-mono text-sm font-bold text-terminal-amber tracking-wide">IDENTITY VERIFICATION</span>
          </div>
          <button onClick={onDismiss} className="text-terminal-dim hover:text-terminal-text transition-colors font-mono text-xs">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <p className="font-sans text-sm text-terminal-dim">
            Unusual session detected. Complete the check to continue.
          </p>

          {/* Grid phase */}
          {phase === 'grid' && (
            <>
              <div className="text-center space-y-1">
                <p className="font-mono text-xs text-terminal-dim tracking-widest uppercase">Select all matching squares</p>
                <p className="font-sans text-sm font-medium text-terminal-text">{challenge.instruction}</p>
                {gridError && (
                  <p className="font-mono text-xs text-terminal-red animate-fade-in">
                    ✕ Wrong selection — {3 - attempts} attempt{3 - attempts !== 1 ? 's' : ''} left
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {challenge.grid.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => toggleCell(i)}
                    className={`relative aspect-square rounded-xl text-2xl flex items-center justify-center border-2 transition-all duration-150 select-none
                      ${selected.has(i)
                        ? 'border-terminal-amber bg-terminal-amber/15 scale-95'
                        : 'border-terminal-border bg-terminal-bg hover:border-terminal-muted'}`}
                  >
                    {emoji}
                    {selected.has(i) && (
                      <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-terminal-amber text-[9px] text-terminal-bg font-bold flex items-center justify-center">✓</span>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGridSubmit}
                disabled={selected.size === 0}
                className="w-full py-3 rounded-lg font-mono text-sm font-medium tracking-widest uppercase transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0d0f12' }}
              >
                Verify Selection
              </button>
            </>
          )}

          {/* Phrase phase */}
          {phase === 'phrase' && (
            <div className="space-y-4 animate-slide-up">
              <div className="text-center space-y-1">
                <p className="font-mono text-xs text-terminal-dim tracking-widest uppercase">Final Step</p>
                <p className="font-sans text-sm text-terminal-text">Type this phrase exactly:</p>
              </div>
              <div className="bg-terminal-bg border border-terminal-amber/30 rounded-xl p-4 text-center">
                <p className="font-mono text-lg text-terminal-amber font-bold">{TARGET_PHRASE}</p>
              </div>
              <input
                type="text"
                value={phrase}
                onChange={e => { setPhrase(e.target.value); setPhraseError(false) }}
                onKeyDown={e => e.key === 'Enter' && handlePhraseSubmit()}
                placeholder="Type here..."
                className={`w-full bg-terminal-bg border rounded-lg px-4 py-3 font-mono text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none transition-all
                  ${phraseError ? 'border-terminal-red' : 'border-terminal-border focus:border-terminal-amber/60'}`}
              />
              {phraseError && <p className="font-mono text-xs text-terminal-red">✕ Incorrect. Try again.</p>}
              <button
                onClick={handlePhraseSubmit}
                disabled={!phrase}
                className="w-full py-3 rounded-lg font-mono text-sm font-medium tracking-widest uppercase transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0d0f12' }}
              >
                Confirm
              </button>
            </div>
          )}

          {/* Done */}
          {phase === 'done' && (
            <div className="bg-terminal-green/10 border border-terminal-green/40 rounded-xl p-4 text-center animate-fade-in">
              <p className="font-mono text-sm font-bold text-terminal-green">✓ Verification complete</p>
            </div>
          )}

          {/* Too many failures */}
          {phase === 'error' && (
            <div className="space-y-4 text-center animate-fade-in">
              <p className="font-mono text-sm text-terminal-red font-bold">Too many failed attempts</p>
              <p className="font-sans text-xs text-terminal-dim">Session flagged. Please try again later.</p>
              <button onClick={onDismiss}
                className="w-full py-3 rounded-lg font-mono text-sm tracking-widest uppercase border border-terminal-red/40 text-terminal-red hover:bg-terminal-red/5 transition-all">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}