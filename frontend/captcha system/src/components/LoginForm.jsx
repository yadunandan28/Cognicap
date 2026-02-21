import { useState, useId } from 'react'
import { useBehaviorTracker } from '../hooks/useBehaviorTracker'
import { analyzeSession } from '../services/api'
import { SoftCaptcha } from './SoftCaptcha'
import { HardCaptcha } from './HardCaptcha'

const DECISION_CONFIG = {
  ALLOW:        { label: 'Access Granted',     color: 'text-terminal-green', border: 'border-terminal-green', bg: 'bg-terminal-green/10', icon: '✓' },
  SOFT_CAPTCHA: { label: 'Verify Identity',    color: 'text-terminal-amber', border: 'border-terminal-amber', bg: 'bg-terminal-amber/10', icon: '⚠' },
  HARD_CAPTCHA: { label: 'Challenge Required', color: 'text-orange-400',     border: 'border-orange-400',     bg: 'bg-orange-400/10',     icon: '⚡' },
  BLOCK:        { label: 'Access Denied',      color: 'text-terminal-red',   border: 'border-terminal-red',   bg: 'bg-terminal-red/10',   icon: '✕' },
}

function RiskMeter({ score }) {
  const color = score < 30 ? '#10b981' : score < 62 ? '#f59e0b' : score < 80 ? '#f97316' : '#ef4444'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-terminal-dim tracking-widest uppercase">Risk Score</span>
        <span className="font-mono text-sm font-bold" style={{ color }}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-terminal-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${score}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}80` }}
        />
      </div>
    </div>
  )
}

function TrustIndicator({ trust }) {
  const clamped = Math.max(-50, Math.min(50, trust))
  const pct     = ((clamped + 50) / 100) * 100
  const color   = clamped > 10 ? '#10b981' : clamped < -10 ? '#ef4444' : '#f59e0b'
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="font-mono text-xs text-terminal-dim tracking-widest uppercase">User Trust</span>
        <span className="font-mono text-sm font-bold" style={{ color }}>
          {clamped > 0 ? '+' : ''}{clamped}
        </span>
      </div>
      <div className="relative h-1.5 bg-terminal-muted rounded-full overflow-hidden">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-terminal-border z-10" />
        <div
          className="absolute top-0 bottom-0 rounded-full transition-all duration-700"
          style={{
            left:            clamped >= 0 ? '50%' : `${pct}%`,
            width:           `${Math.abs(clamped)}%`,
            backgroundColor: color,
            boxShadow:       `0 0 6px ${color}80`,
          }}
        />
      </div>
      <p className="font-mono text-[10px] text-terminal-dim text-right">
        range −50 → +50 · builds with each session
      </p>
    </div>
  )
}

function MetricRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-terminal-border/40">
      <span className="font-mono text-xs text-terminal-dim">{label}</span>
      <span className="font-mono text-xs text-terminal-text">{value}</span>
    </div>
  )
}

export function LoginForm() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)
  const [showDebug,        setShowDebug]        = useState(false)
  const [capturedFeatures, setCapturedFeatures] = useState(null)
  const [captchaMode,      setCaptchaMode]      = useState(null)  // null | 'soft' | 'hard'

  const { containerRef, extractFeatures, triggerHoneypot, trackRequest } = useBehaviorTracker()
  const formId = useId()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    setCaptchaMode(null)

    trackRequest()
    const features = extractFeatures(email || 'anonymous')
    setCapturedFeatures(features)

    try {
      const data = await analyzeSession(features)
      setResult(data)
      if (data.decision === 'SOFT_CAPTCHA') setCaptchaMode('soft')
      if (data.decision === 'HARD_CAPTCHA') setCaptchaMode('hard')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  const handleCaptchaVerify = () => {
    setCaptchaMode(null)
    setResult(prev => prev ? { ...prev, decision: 'ALLOW', _captchaPassed: true } : prev)
  }

  const decision = result ? DECISION_CONFIG[result.decision] : null

  return (
    <>
      {captchaMode === 'soft' && <SoftCaptcha onVerify={handleCaptchaVerify} onDismiss={() => setCaptchaMode(null)} />}
      {captchaMode === 'hard' && <HardCaptcha onVerify={handleCaptchaVerify} onDismiss={() => setCaptchaMode(null)} />}

      <div ref={containerRef} className="min-h-screen bg-terminal-bg flex items-center justify-center p-4 relative overflow-hidden">

        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-5 blur-3xl"
          style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }} />

        <div className="w-full max-w-md animate-slide-up">

          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl border border-terminal-amber/30 bg-terminal-amber/5 mb-4">
              <svg className="w-6 h-6 text-terminal-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.955 11.955 0 003 10c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <h1 className="font-mono text-xl font-bold text-terminal-text tracking-tight">
              LOGIN<span className="text-terminal-amber text-glow-amber">FORM</span>
            </h1>
            <p className="mt-1 text-terminal-dim text-xs font-mono tracking-widest uppercase"></p>
          </div>

          {/* Card */}
          <div className="bg-terminal-surface border border-terminal-border rounded-2xl overflow-hidden">

            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-terminal-border bg-terminal-bg/50">
              <span className="w-2.5 h-2.5 rounded-full bg-terminal-red/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-terminal-amber/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-terminal-green/70" />
              <span className="ml-2 font-mono text-xs text-terminal-dim tracking-widest">session://authenticate</span>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">

              <div className="space-y-1.5">
                <label htmlFor={`${formId}-email`} className="block font-mono text-xs text-terminal-dim tracking-widest uppercase">EmailID</label>
                <input
                  id={`${formId}-email`}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@domain.com"
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 font-mono text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:border-terminal-amber/60 focus:ring-1 focus:ring-terminal-amber/20 transition-all duration-200"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={`${formId}-password`} className="block font-mono text-xs text-terminal-dim tracking-widest uppercase">Password</label>
                <input
                  id={`${formId}-password`}
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-terminal-bg border border-terminal-border rounded-lg px-4 py-3 font-mono text-sm text-terminal-text placeholder:text-terminal-muted focus:outline-none focus:border-terminal-amber/60 focus:ring-1 focus:ring-terminal-amber/20 transition-all duration-200"
                />
              </div>

              {/* Honeypot — off-screen, invisible to humans */}
              <div aria-hidden="true" style={{ position:'absolute', left:'-9999px', opacity:0, pointerEvents:'none' }}>
                <input id={`${formId}-website`} type="text" name="website" autoComplete="off" tabIndex={-1} onChange={triggerHoneypot} />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg font-mono text-sm font-medium tracking-widest uppercase transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: loading ? 'transparent' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                  color:  loading ? '#f59e0b' : '#0d0f12',
                  border: loading ? '1px solid #f59e0b40' : 'none',
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Analysing session...
                  </span>
                ) : 'Authenticate'}
              </button>
            </form>

            {/* Result panel */}
            {result && decision && (
              <div className={`mx-6 mb-6 rounded-xl border ${decision.border} ${decision.bg} p-4 space-y-4 animate-fade-in`}>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-lg ${decision.color}`}>{decision.icon}</span>
                    <span className={`font-mono text-sm font-bold ${decision.color}`}>
                      {result._captchaPassed ? 'Access Granted (verified)' : decision.label}
                    </span>
                  </div>
                  <span className={`font-mono text-xs px-2 py-1 rounded border ${decision.border} ${decision.color} tracking-widest`}>
                    {result._captchaPassed ? 'ALLOW' : result.decision}
                  </span>
                </div>

                <RiskMeter score={result.final_risk_score} />
                <TrustIndicator trust={result.user_trust} />

                <div className="space-y-0.5">
                  <MetricRow label="raw_bot_prob"     value={result.raw_bot_prob ?? '—'} />
                  <MetricRow label="remapped_prob"    value={result.remapped_prob ?? '—'} />
                  <MetricRow label="attack_intensity" value={result.attack_intensity ?? '—'} />
                </div>

                {/* Re-open captcha button */}
                {(result.decision === 'SOFT_CAPTCHA' || result.decision === 'HARD_CAPTCHA') && !result._captchaPassed && (
                  <button
                    onClick={() => setCaptchaMode(result.decision === 'SOFT_CAPTCHA' ? 'soft' : 'hard')}
                    className={`w-full py-2.5 rounded-lg font-mono text-xs tracking-widest uppercase border transition-all ${decision.border} ${decision.color} bg-transparent hover:opacity-80`}
                  >
                    Open Challenge Again
                  </button>
                )}

                {capturedFeatures && (
                  <div>
                    <button
                      onClick={() => setShowDebug(v => !v)}
                      className="font-mono text-xs text-terminal-dim hover:text-terminal-text transition-colors tracking-widest uppercase flex items-center gap-1"
                    >
                      <span className={`transition-transform duration-200 inline-block ${showDebug ? 'rotate-90' : ''}`}>▶</span>
                      {showDebug ? 'Hide' : 'Show'} captured features
                    </button>
                    {showDebug && (
                      <div className="mt-3 bg-terminal-bg rounded-lg p-3 overflow-auto max-h-48 border border-terminal-border">
                        <pre className="font-mono text-xs text-terminal-dim whitespace-pre-wrap leading-relaxed">
                          {JSON.stringify(capturedFeatures, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="mx-6 mb-6 rounded-xl border border-terminal-red/40 bg-terminal-red/5 p-4 animate-fade-in">
                <p className="font-mono text-xs text-terminal-red"><span className="font-bold">ERR</span> {error}</p>
                <p className="font-mono text-xs text-terminal-dim mt-1">Check that the Node API and ML service are both running.</p>
              </div>
            )}
          </div>

          <p className="mt-4 text-center font-mono text-xs text-terminal-muted">
        
          </p>
        </div>
      </div>
    </>
  )
}