import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' }
})

/**
 * Submit behavioral session data for risk analysis
 * @param {Object} features - All 19 behavioral features + user_id
 * @returns {Object} { final_risk_score, decision, attack_intensity, user_trust, ... }
 */
export async function analyzeSession(features) {
  const response = await api.post('/api/session/analyze', features)
  return response.data
}