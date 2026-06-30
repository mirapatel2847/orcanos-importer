import { useState, useEffect } from 'react'
import API_URL from '../api.js';

export default function Step1Auth({ credentials, onComplete }) {
  const [activeTab, setActiveTab] = useState(credentials?.authType === 'apikey' ? 'apikey' : 'basic')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [authError, setAuthError] = useState('')

  // Basic Auth state
  const [basicAuth, setBasicAuth] = useState({
    domain: credentials?.domain && credentials.authType === 'basic' ? credentials.domain : '',
    username: credentials?.authType === 'basic' && credentials.username ? credentials.username : '',
    password: credentials?.authType === 'basic' && credentials.password ? credentials.password : ''
  })

  // API Key state
  const [apiKey, setApiKey] = useState({
    domain: credentials?.domain && credentials.authType === 'apikey' ? credentials.domain : '',
    apiKey: credentials?.authType === 'apikey' && credentials.apiKey ? credentials.apiKey : ''
  })
  const encodeBase64 = (str) => {
    return btoa(str)
  }

  const validateBasicAuth = () => {
    const newErrors = {}
    if (!basicAuth.domain.trim()) newErrors.domain = 'Domain is required'
    if (!basicAuth.username.trim()) newErrors.username = 'Username is required'
    if (!basicAuth.password.trim()) newErrors.password = 'Password is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateApiKey = () => {
    const newErrors = {}
    if (!apiKey.domain.trim()) newErrors.domain = 'Domain is required'
    if (!apiKey.apiKey.trim()) newErrors.apiKey = 'API Key is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBasicAuthConnect = async () => {
    if (!validateBasicAuth()) return

    setLoading(true)
    try {
      const encodedAuth = encodeBase64(`${basicAuth.username}:${basicAuth.password}`)
      const credentials = {
        domain: basicAuth.domain,
        authType: 'basic',
        username: basicAuth.username,
        password: basicAuth.password,
        headers: {
          'Authorization': `Basic ${encodedAuth}`,
          'Content-Type': 'application/json'
        }
      }

      const res = await fetch(`${API_URL}/api/verify-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: basicAuth.domain, headers: credentials.headers })
      })
      const data = await res.json()

      if (data.valid) {
        const projectsList = data.projectsList || []
        onComplete(credentials, projectsList)
      } else {
        setAuthError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      setAuthError('Cannot connect to backend server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  const handleApiKeyConnect = async () => {
    if (!validateApiKey()) return

    setLoading(true)
    try {
      const credentials = {
        domain: apiKey.domain,
        authType: 'apikey',
        apiKey: apiKey.apiKey,
        headers: {
          'OrcanosAPIKey': apiKey.apiKey,
          'Content-Type': 'application/json'
        }
      }

      const res = await fetch(`${API_URL}/api/verify-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: apiKey.domain, headers: credentials.headers })
      })
      const data = await res.json()

      if (data.valid) {
        const projectsList = data.projectsList || []
        onComplete(credentials, projectsList)
      } else {
        setAuthError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      setAuthError('Cannot connect to backend server. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Authorization</h2>

      {/* Tab buttons */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => {
            setActiveTab('basic')
            setErrors({})
            setAuthError('')
          }}
          className={`pb-3 px-3 sm:px-4 font-medium border-b-2 transition text-sm sm:text-base ${activeTab === 'basic'
              ? 'border-[#652AA5] text-[#652AA5]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
        >
          Basic Auth
        </button>
        <button
          onClick={() => {
            setActiveTab('apikey')
            setErrors({})
            setAuthError('')
          }}
          className={`pb-3 px-3 sm:px-4 font-medium border-b-2 transition text-sm sm:text-base ${activeTab === 'apikey'
              ? 'border-[#652AA5] text-[#652AA5]'
              : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
        >
          API Key
        </button>
      </div>

      {/* Basic Auth Tab */}
      {activeTab === 'basic' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orcanos Domain
            </label>
            <input
              type="text"
              placeholder="app.orcanos.com/your company"
              value={basicAuth.domain}
              autoComplete="off"
              onChange={(e) => {
                setBasicAuth(prev => ({ ...prev, domain: e.target.value }))
                if (errors.domain) setErrors(prev => ({ ...prev, domain: '' }))
                if (authError) setAuthError('')
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#762FC4] text-sm sm:text-base ${errors.domain ? 'border-red-500' : 'border-gray-300'
                }`}
            />
            {errors.domain && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.domain}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              placeholder="Enter your username"
              value={basicAuth.username}
              onChange={(e) => {
                setBasicAuth(prev => ({ ...prev, username: e.target.value }))
                if (errors.username) setErrors(prev => ({ ...prev, username: '' }))
                if (authError) setAuthError('')
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#762FC4] text-sm sm:text-base ${errors.username ? 'border-red-500' : 'border-gray-300'
                }`}
            />
            {errors.username && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.username}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              value={basicAuth.password}
              onChange={(e) => {
                setBasicAuth(prev => ({ ...prev, password: e.target.value }))
                if (errors.password) setErrors(prev => ({ ...prev, password: '' }))
                if (authError) setAuthError('')
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#762FC4] text-sm sm:text-base ${errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
            />
            {errors.password && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.password}</p>}
          </div>

          <button
            onClick={handleBasicAuthConnect}
            disabled={loading}
            className="w-full bg-[#2F80ED] hover:bg-[#205EB1] disabled:bg-[#2F80ED]/32 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {loading && (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            Connect
          </button>

          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <p className="text-red-700 text-sm font-medium">⚠️ {authError}</p>
            </div>
          )}
        </div>
      )}

      {/* API Key Tab */}
      {activeTab === 'apikey' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orcanos Domain
            </label>
            <input
              type="text"
              placeholder="app.orcanos.com/your company"
              value={apiKey.domain}
              onChange={(e) => {
                setApiKey(prev => ({ ...prev, domain: e.target.value }))
                if (errors.domain) setErrors(prev => ({ ...prev, domain: '' }))
                if (authError) setAuthError('')
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#762FC4] text-sm sm:text-base ${errors.domain ? 'border-red-500' : 'border-gray-300'
                }`}
            />
            {errors.domain && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.domain}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Orcanos API Key
            </label>
            <input
              type="text"
              placeholder="Enter your API key"
              value={apiKey.apiKey}
              onChange={(e) => {
                setApiKey(prev => ({ ...prev, apiKey: e.target.value }))
                if (errors.apiKey) setErrors(prev => ({ ...prev, apiKey: '' }))
                if (authError) setAuthError('')
              }}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#762FC4] text-sm sm:text-base ${errors.apiKey ? 'border-red-500' : 'border-gray-300'
                }`}
            />
            {errors.apiKey && <p className="text-red-500 text-xs sm:text-sm mt-1">{errors.apiKey}</p>}
          </div>

          <button
            onClick={handleApiKeyConnect}
            disabled={loading}
            className="w-full bg-[#2F80ED] hover:bg-[#205EB1] disabled:bg-[#2F80ED]/32 text-white font-medium py-2 px-4 rounded-lg transition flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {loading && (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            Connect
          </button>

          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
              <p className="text-red-700 text-sm font-medium">⚠️ {authError}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
