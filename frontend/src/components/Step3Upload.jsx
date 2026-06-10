import { useState } from 'react'
import API_URL from '../api.js';

export default function Step3Upload({ fileData: initialFileData, onComplete, onBack }) {
  const [fileData, setFileData] = useState(initialFileData)
  const [fileName, setFileName] = useState(initialFileData ? 'Previously uploaded file' : '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [fileChanged, setFileChanged] = useState(false)

  const handleFileUpload = async (file) => {
    // Validate file type
    if (!file.name.endsWith('.xlsx')) {
      setError('Please upload a valid Excel (.xlsx) file')
      return
    }

    setError('')
    setLoading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Error uploading file')
        setLoading(false)
        return
      }

      setFileData(data)
      setFileName(file.name)
      setFileChanged(true)
      setError('')
    } catch (err) {
      setError('Error uploading file: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0])
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 sm:p-8">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">Upload File</h2>

      {!fileData ? (
        <div>
          {/* Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 sm:p-12 text-center transition ${
              dragActive ? 'border-[#7E3F98] bg-purple-50' : 'border-gray-300'
            }`}
          >
            <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-gray-700 font-medium mb-2 text-sm sm:text-base">Drag and drop your Excel file here</p>
            <p className="text-gray-500 text-xs sm:text-sm mb-4">or</p>
            <label className="bg-[#7E3F98] hover:bg-[#682e82] text-white font-medium py-2 px-4 sm:px-6 rounded-lg cursor-pointer inline-block transition text-sm sm:text-base">
              Choose File
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileInputChange}
                disabled={loading}
                className="hidden"
              />
            </label>
            <p className="text-gray-500 text-xs mt-4">Only .xlsx files are supported</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-xs sm:text-sm">{error}</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="mt-4 flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 text-[#7E3F98]" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="ml-2 text-gray-600 text-sm sm:text-base">Uploading...</span>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* File Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-xs sm:text-sm text-gray-600">
              <span className="font-medium">File:</span> {fileName}
            </p>
            <p className="text-xs sm:text-sm text-gray-600">
              <span className="font-medium">Total Rows:</span> {fileData.totalRows}
            </p>
          </div>

          {/* Preview Table */}
          {fileData.preview && fileData.preview.length > 0 && (
            <div className="mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Preview (First 5 Rows)</h3>
              <div className="overflow-x-auto border border-gray-300 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      {fileData.headers.map((header, idx) => (
                        <th key={idx} className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {fileData.preview.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-gray-50">
                        {fileData.headers.map((header, colIdx) => (
                          <td key={colIdx} className="px-3 sm:px-6 py-2 sm:py-3 text-gray-900 truncate">
                            {row[header] !== null && row[header] !== undefined ? String(row[header]) : '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Upload Another Option */}
          <button
            onClick={() => {
              setFileData(null)
              setFileName('')
              setError('')
            }}
            className="text-[#7E3F98] hover:text-[#682e82] text-xs sm:text-sm font-medium mb-6"
          >
            Upload different file
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <button
          onClick={onBack}
          className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
        >
          Back
        </button>
        <button
          onClick={() => onComplete(fileData, fileChanged)}
          disabled={!fileData}
          className="flex-1 bg-[#7E3F98] hover:bg-[#682e82] disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
        >
          Next
        </button>
      </div>
    </div>
  )
}
