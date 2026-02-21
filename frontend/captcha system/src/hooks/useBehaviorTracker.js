import { useRef, useEffect, useCallback } from 'react'

/**
 * useBehaviorTracker
 * ==================
 * Silently collects all behavioral biometric features required
 * by the ML model, attached to a specific form container ref.
 *
 * Collected features:
 *   sessionDuration, avgTypingSpeed, typingVariance, mouseMoveCount,
 *   clickIntervalAvg, mousePathLength, backspaceCount, focusChanges,
 *   idleTimeRatio, keyHoldTimeMean, keyFlightTimeVariance,
 *   correctionDelayMean, pasteUsageCount, mouseAccelerationMean,
 *   mouseDirectionChanges, clickRandomnessScore, requestsPerMinute,
 *   sessionRequestCount, burstScore, honeypotTriggered
 */
export function useBehaviorTracker() {
  const containerRef = useRef(null)
  const state = useRef({
    // Session timing
    startTime:          Date.now(),
    lastActiveTime:     Date.now(),
    idleDuration:       0,

    // Typing
    keyPressTimestamps: [],   // { key, downAt, upAt }
    keyDownMap:         {},   // key → downAt (in-progress holds)
    charCount:          0,
    backspaceCount:     0,
    pasteUsageCount:    0,
    correctionTimes:    [],   // ms between backspace and next key

    // Mouse
    mouseMoveCount:     0,
    mousePositions:     [],   // { x, y, t }
    lastMousePos:       null,
    pathLength:         0,
    directionChanges:   0,
    lastDirection:      null,
    accelerations:      [],

    // Clicks
    clickTimestamps:    [],
    clickPositions:     [],   // { x, y }
    lastBackspaceTime:  null,

    // Focus
    focusChanges:       0,
    lastFocusTarget:    null,

    // Requests (simulated from page navigations/fetches)
    requestTimestamps:  [],
    sessionRequestCount: 1,   // start at 1 (the login page load itself)

    // Honeypot
    honeypotTriggered:  0,
  })

  // ── Helpers ──────────────────────────────────────────────
  const getDirection = (dx, dy) => {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI)
    if (angle >= -22.5 && angle < 22.5)   return 'E'
    if (angle >= 22.5  && angle < 67.5)   return 'SE'
    if (angle >= 67.5  && angle < 112.5)  return 'S'
    if (angle >= 112.5 && angle < 157.5)  return 'SW'
    if (angle >= 157.5 || angle < -157.5) return 'W'
    if (angle >= -157.5 && angle < -112.5) return 'NW'
    if (angle >= -112.5 && angle < -67.5) return 'N'
    return 'NE'
  }

  const mean    = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
  const variance = arr => {
    if (arr.length < 2) return 0
    const m = mean(arr)
    return mean(arr.map(x => (x - m) ** 2))
  }

  // ── Event Handlers ────────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    const s = state.current
    const now = Date.now()
    s.lastActiveTime = now
    s.keyDownMap[e.key] = now

    if (e.key === 'Backspace') {
      s.backspaceCount++
      s.lastBackspaceTime = now
    }
  }, [])

  const handleKeyUp = useCallback((e) => {
    const s = state.current
    const now = Date.now()
    const downAt = s.keyDownMap[e.key]
    if (!downAt) return

    const holdTime = now - downAt
    delete s.keyDownMap[e.key]

    // Record key press
    s.keyPressTimestamps.push({ key: e.key, downAt, upAt: now, holdTime })

    // Count printable chars
    if (e.key.length === 1) s.charCount++

    // Correction delay: time from backspace to next non-backspace key
    if (e.key !== 'Backspace' && s.lastBackspaceTime) {
      s.correctionTimes.push(now - s.lastBackspaceTime)
      s.lastBackspaceTime = null
    }
  }, [])

  const handlePaste = useCallback(() => {
    state.current.pasteUsageCount++
    state.current.lastActiveTime = Date.now()
  }, [])

  const handleMouseMove = useCallback((e) => {
    const s = state.current
    const now = Date.now()
    s.lastActiveTime = now
    s.mouseMoveCount++

    const { clientX: x, clientY: y } = e
    const pos = { x, y, t: now }
    s.mousePositions.push(pos)

    if (s.lastMousePos) {
      const dx = x - s.lastMousePos.x
      const dy = y - s.lastMousePos.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const dt   = now - s.lastMousePos.t || 1

      s.pathLength += dist

      // Direction changes
      if (dist > 5) {
        const dir = getDirection(dx, dy)
        if (s.lastDirection && dir !== s.lastDirection) s.directionChanges++
        s.lastDirection = dir
      }

      // Acceleration (px/ms²)
      const speed = dist / dt
      if (s.mousePositions.length > 1) {
        const prev = s.mousePositions[s.mousePositions.length - 2]
        const prevDist = Math.sqrt(
          (prev.x - s.lastMousePos.x) ** 2 + (prev.y - s.lastMousePos.y) ** 2
        )
        const prevSpeed = prevDist / (s.lastMousePos.t - prev.t || 1)
        s.accelerations.push(Math.abs(speed - prevSpeed))
      }
    }

    s.lastMousePos = pos
  }, [])

  const handleClick = useCallback((e) => {
    const s = state.current
    const now = Date.now()
    s.lastActiveTime = now
    s.clickTimestamps.push(now)
    s.clickPositions.push({ x: e.clientX, y: e.clientY })
    s.sessionRequestCount++
  }, [])

  const handleFocus = useCallback((e) => {
    const s = state.current
    if (s.lastFocusTarget && s.lastFocusTarget !== e.target) s.focusChanges++
    s.lastFocusTarget = e.target
  }, [])

  const handleVisibilityChange = useCallback(() => {
    // Approximate idle when tab is hidden
    if (document.hidden) {
      state.current._tabHideTime = Date.now()
    } else if (state.current._tabHideTime) {
      state.current.idleDuration += Date.now() - state.current._tabHideTime
      state.current._tabHideTime = null
    }
  }, [])

  // ── Mount / Unmount ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current || window
    el.addEventListener('keydown',  handleKeyDown,  true)
    el.addEventListener('keyup',    handleKeyUp,    true)
    el.addEventListener('paste',    handlePaste,    true)
    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('click',    handleClick)
    el.addEventListener('focusin',  handleFocus,    true)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      el.removeEventListener('keydown',  handleKeyDown,  true)
      el.removeEventListener('keyup',    handleKeyUp,    true)
      el.removeEventListener('paste',    handlePaste,    true)
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('click',    handleClick)
      el.removeEventListener('focusin',  handleFocus,    true)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [handleKeyDown, handleKeyUp, handlePaste, handleMouseMove, handleClick,
      handleFocus, handleVisibilityChange])

  // ── Feature Extraction ────────────────────────────────────
  const extractFeatures = useCallback((userId = 'anonymous') => {
    const s   = state.current
    const now = Date.now()

    // Session duration (ms)
    const sessionDuration = now - s.startTime

    // Idle time ratio
    // Also add time since last activity if > 3s
    let idleMs = s.idleDuration
    const sinceActive = now - s.lastActiveTime
    if (sinceActive > 3000) idleMs += sinceActive
    const idleTimeRatio = Math.min(0.99, idleMs / sessionDuration)

    // Typing speed (chars/sec averaged per minute window)
    const sessionMinutes = sessionDuration / 60000 || 1/60
    const avgTypingSpeed = s.charCount / sessionMinutes / 60 // chars per second

    // Typing variance & key hold times
    const holdTimes  = s.keyPressTimestamps.map(k => k.holdTime)
    const keyHoldTimeMean       = mean(holdTimes)
    const keyFlightTimeVariance = variance(holdTimes)

    // Inter-key intervals (flight times)
    const sorted = [...s.keyPressTimestamps].sort((a, b) => a.downAt - b.downAt)
    const flightTimes = []
    for (let i = 1; i < sorted.length; i++) {
      flightTimes.push(sorted[i].downAt - sorted[i - 1].upAt)
    }
    const typingVariance = variance(flightTimes)

    // Correction delay
    const correctionDelayMean = mean(s.correctionTimes)

    // Click interval
    const clickIntervals = []
    for (let i = 1; i < s.clickTimestamps.length; i++) {
      clickIntervals.push(s.clickTimestamps[i] - s.clickTimestamps[i - 1])
    }
    const clickIntervalAvg = mean(clickIntervals)

    // Click randomness score: std deviation of click positions normalized to screen
    const xs = s.clickPositions.map(p => p.x / window.innerWidth)
    const ys = s.clickPositions.map(p => p.y / window.innerHeight)
    const clickRandomnessScore = Math.min(1, (Math.sqrt(variance(xs)) + Math.sqrt(variance(ys))) / 2 * 2)

    // Requests per minute & burst
    const windowMs   = 60000
    const recentReqs = s.requestTimestamps.filter(t => now - t < windowMs)
    const requestsPerMinute = recentReqs.length

    // Burst score: ratio of requests in last 10s vs last 60s
    const recentBurst = s.requestTimestamps.filter(t => now - t < 10000)
    const burstScore  = recentReqs.length > 0
      ? Math.min(1, (recentBurst.length / 10) / (recentReqs.length / 60))
      : 0.1

    return {
      user_id:               userId,
      sessionDuration:       Math.round(sessionDuration),
      avgTypingSpeed:        parseFloat(avgTypingSpeed.toFixed(3)),
      typingVariance:        parseFloat(typingVariance.toFixed(4)),
      mouseMoveCount:        s.mouseMoveCount,
      clickIntervalAvg:      parseFloat(clickIntervalAvg.toFixed(2)),
      mousePathLength:       parseFloat(s.pathLength.toFixed(2)),
      backspaceCount:        s.backspaceCount,
      focusChanges:          s.focusChanges,
      idleTimeRatio:         parseFloat(idleTimeRatio.toFixed(4)),
      keyHoldTimeMean:       parseFloat(keyHoldTimeMean.toFixed(3)),
      keyFlightTimeVariance: parseFloat(keyFlightTimeVariance.toFixed(4)),
      correctionDelayMean:   parseFloat(correctionDelayMean.toFixed(2)),
      pasteUsageCount:       s.pasteUsageCount,
      mouseAccelerationMean: parseFloat(mean(s.accelerations).toFixed(4)),
      mouseDirectionChanges: s.directionChanges,
      clickRandomnessScore:  parseFloat(clickRandomnessScore.toFixed(4)),
      requestsPerMinute:     parseFloat(requestsPerMinute.toFixed(2)),
      sessionRequestCount:   s.sessionRequestCount,
      burstScore:            parseFloat(burstScore.toFixed(4)),
      honeypotTriggered:     s.honeypotTriggered,
    }
  }, [])

  // Called when user triggers honeypot field
  const triggerHoneypot = useCallback(() => {
    state.current.honeypotTriggered = 1
  }, [])

  // Track a request (call this on any fetch/API call)
  const trackRequest = useCallback(() => {
    state.current.requestTimestamps.push(Date.now())
    state.current.sessionRequestCount++
  }, [])

  return { containerRef, extractFeatures, triggerHoneypot, trackRequest }
}