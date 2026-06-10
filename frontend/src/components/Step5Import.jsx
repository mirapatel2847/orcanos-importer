import { useState, useEffect } from 'react'
import { saveAs } from 'file-saver'
import * as XLSX from 'xlsx'
import API_URL from '../api.js';

export default function Step5Import({ fileData, mapping, credentials, projectConfig, orcanosFields = [], mandatoryFields = [], onStartOver, onBack, setImportInProgress }) {
  // Validation state
  const [validating, setValidating] = useState(true)
  const [validation, setValidation] = useState(null)
  const [validationError, setValidationError] = useState('')

  // Import state
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentRow, setCurrentRow] = useState(0)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [showBackConfirm, setShowBackConfirm] = useState(false)

  // Bubble up importing state to parent
  useEffect(() => {
    if (setImportInProgress) {
      setImportInProgress(importing)
    }
  }, [importing, setImportInProgress])

  // Run validation automatically when Step 4 loads
  useEffect(() => {
    if (fileData && mapping) {
      runValidation()
    }
  }, [])

  const runValidation = async () => {
    setValidating(true)
    setValidationError('')
    setValidation(null)

    try {
      const response = await fetch(`${API_URL}/api/validate-import`, {        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: fileData.data,
          mapping: mapping,
          mandatory_fields: mandatoryFields.map(f => {
            const wsName = f.ws_add_col_name || f.name || f
            return /^CS\d+_Name$/.test(wsName) ? wsName.replace('_Name', '_value') : wsName
          }),
          projectConfig: projectConfig,
          orcanosFields: orcanosFields
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        setValidationError(errorData.error || 'Validation failed')
        setValidating(false)
        return
      }

      const data = await response.json()
      setValidation(data)
    } catch (err) {
      setValidationError('Error during validation: ' + err.message)
    } finally {
      setValidating(false)
    }
  }
  const handleStartImport = async () => {
    if (!validation || !fileData || !fileData.data) return

    if (fileData.data.length === 0) return

    setImporting(true)
    setProgress(0)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: fileData.data,
          mapping: mapping,
          domain: credentials.domain,
          headers: credentials.headers,
          mandatory_fields: mandatoryFields.map(f => {
            const wsName = f.ws_add_col_name || f.name || f
            return /^CS\d+_Name$/.test(wsName) ? wsName.replace('_Name', '_value') : wsName
          }),        
          projectConfig: projectConfig,
          orcanosFields: orcanosFields
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.error || 'Error during import')
        setImporting(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          if (line.trim()) {
            const data = JSON.parse(line)

            if (data.type === 'progress') {
              setCurrentRow(data.row)
              setProgress((data.row / data.total) * 100)
            } else if (data.type === 'done') {
              setResults(data)
              setImporting(false)
            }
          }
        }
      }
    } catch (err) {
      setError('Error during import: ' + err.message)
      setImporting(false)
    }
  }

  const handleBackClick = () => {
    if (results) {
      setShowBackConfirm(true)
    } else {
      onBack()
    }
  }

  const handleConfirmBack = () => {
    setShowBackConfirm(false)
    onBack()
  }

  const handleExportResults = () => {
    if (!results || !results.results) return;
    
    const headers = ['Row', 'Object Name', 'Object Type', 
                     'Status', 'Object ID', 'Error Message'];
    
    const rows = results.results.map(r => [
      r.row,
      r.objectName || '',
      r.objectType || '',
      r.status,
      r.objectId || '',
      r.error || ''
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => 
        JSON.stringify(cell ?? '')).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], 
      { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'orcanos_results.csv');
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!fileData || !mapping || !credentials) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <p className="text-gray-600">Missing required data</p>
      </div>
    )
  }

  // ─── Phase 1: Validating (spinner) ───
  if (validating) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Validating Data</h2>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#7E3F98] border-t-transparent mb-4"></div>
          <p className="text-gray-600 text-lg">Validating your data before import…</p>
          <p className="text-gray-400 text-sm mt-2">Checking {fileData.totalRows} rows</p>
        </div>
      </div>
    )
  }

  // ─── Validation error state ───
  if (validationError) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Validation Error</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{validationError}</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 px-4 rounded-lg transition"
          >
            Back
          </button>
          <button
            onClick={runValidation}
            className="flex-1 bg-[#7E3F98] hover:bg-[#682e82] text-white font-medium py-2 px-4 rounded-lg transition"
          >
            Retry Validation
          </button>
        </div>
      </div>
    )
  }

  // ─── Phase 2: Validation complete, show results + start import ───
  if (validation && !results) {
    const allInvalid = validation.validRows === 0
    const allValid = validation.invalidRows === 0

    return (
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Import Data</h2>

        {/* Validation Summary Cards */}
        {!importing && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-purple-800 text-sm font-medium">Total Rows</p>
              <p className="text-2xl font-bold text-[#7E3F98]">{validation.totalRows}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 text-sm font-medium">Valid</p>
              <p className="text-2xl font-bold text-green-900">{validation.validRows}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-medium">Invalid</p>
              <p className="text-2xl font-bold text-red-900">{validation.invalidRows}</p>
            </div>
          </div>
        )}

        {/* Status Messages */}
        {!importing && allValid && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold flex items-center gap-2">
              <span className="text-lg">✓</span>
              All rows are valid. Ready to import!
            </p>
          </div>
        )}

        {!importing && allInvalid && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800 font-semibold flex items-center gap-2">
              <span className="text-lg">✗</span>
              No valid rows to import. Please fix your Excel file and try again.
            </p>
          </div>
        )}

        {!importing && !allValid && !allInvalid && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-yellow-800 font-semibold">
              {validation.validRows} rows valid and ready to import
            </p>
            <p className="text-yellow-700 text-sm mt-1">
              {validation.invalidRows} rows have issues and will be skipped
            </p>
          </div>
        )}

        {/* Progress Section */}
        {importing && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-700 font-medium">
                Processing row {currentRow} of {fileData.totalRows}
              </p>
              <p className="text-gray-700 font-medium">
                {Math.round(progress)}%
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-[#7E3F98] h-3 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Validation Table */}
        {!importing && (
          <div className="mb-6 overflow-x-auto border border-gray-300 rounded-lg max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Row
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Object Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Object Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Issues
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {validation.rows.map((row, idx) => (
                  <tr key={idx} className={row.valid ? 'bg-green-50' : 'bg-red-50'}>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.row}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.objectName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{row.objectType}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.valid ? (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-200 text-green-800">
                          Ready
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-200 text-red-800">
                          Will be skipped
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                      {row.reasons && row.reasons.length > 0 ? (
                        <ul className="list-disc list-inside text-red-600 text-xs space-y-0.5">
                          {row.reasons.map((reason, rIdx) => (
                            <li key={rIdx}>{reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-green-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleBackClick}
            disabled={importing}
            className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base order-2 sm:order-1"
          >
            Back
          </button>
          {!importing && (
            <button
              onClick={handleStartImport}
              className="flex-1 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base order-1 sm:order-2 bg-[#7E3F98] hover:bg-[#682e82] text-white"
            >
              Start Import ({fileData.totalRows} rows)
            </button>
          )}
        </div>
      </div>
    )
  }

  // ─── Phase 3: Import complete — show results ───
  if (results) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Import Results</h2>

        {/* Results Table */}
        <div className="mb-6 overflow-x-auto border border-gray-300 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Row
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Object Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Object Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Object ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Error Message
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {results.results.map((result, idx) => (
                <tr key={idx} className={
                  result.status === 'success' ? 'bg-green-50' :
                  result.status === 'failed' ? 'bg-red-50' :
                  'bg-gray-50'
                }>
                  <td className="px-4 py-3 text-sm text-gray-900">{result.row}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{result.objectName}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{result.objectType}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      result.status === 'success' ? 'bg-green-200 text-green-800' :
                      result.status === 'failed' ? 'bg-red-200 text-red-800' :
                      'bg-gray-200 text-gray-800'
                    }`}>
                      {result.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{result.objectId}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                    {result.error}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-purple-800 text-sm font-medium">Total</p>
            <p className="text-2xl font-bold text-[#7E3F98]">{results.summary.total}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-800 text-sm font-medium">Successful</p>
            <p className="text-2xl font-bold text-green-900">{results.summary.success}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm font-medium">Failed</p>
            <p className="text-2xl font-bold text-red-900">{results.summary.failed}</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-gray-800 text-sm font-medium">Skipped</p>
            <p className="text-2xl font-bold text-gray-900">{results.summary.skipped}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleBackClick}
            disabled={importing}
            className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base order-2 sm:order-1"
          >
            Back
          </button>
          <button
            onClick={handleExportResults}
            className="flex-1 border border-[#7E3F98] text-[#7E3F98] hover:bg-purple-50 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base order-3 sm:order-2"
          >
            Export Results
          </button>
          <button
            onClick={onStartOver}
            className="flex-1 bg-[#7E3F98] hover:bg-[#682e82] text-white font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base order-1 sm:order-3"
          >
            Start Over
          </button>
        </div>

        {/* Back Confirmation Modal */}
        {showBackConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Going Back?</h3>
              <p className="text-gray-600 mb-6">
                Going back will clear your import results. Are you sure?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowBackConfirm(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 px-4 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBack}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Fallback — should not normally be reached
  return null
}
