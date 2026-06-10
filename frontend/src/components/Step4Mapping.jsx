import { useState, useEffect } from 'react'
import SearchableSelect from './SearchableSelect'

export default function Step4Mapping({ fileData, existingMapping, orcanosFields = [], mandatoryFields = [], onComplete, onBack }) {
  const [mapping, setMapping] = useState(existingMapping || {})
  const [error, setError] = useState('')
  const fieldsWithParent = orcanosFields.some(f => f.ws_add_col_name === 'Parent_ID')
    ? orcanosFields
    : [...orcanosFields, { 
        name: 'Parent_ID', 
        ws_add_col_name: 'Parent_ID', 
        title: 'Parent ID', 
        is_mandatory: '0' 
      }]
  // Auto-map on component mount only if no mapping provided
  useEffect(() => {
    if (existingMapping) {
      // Use existing mapping
      setMapping(existingMapping)
    } else {
      // Auto-map if coming from Step 2
      const autoMapping = {}
      if (fileData && fileData.headers) {
        fileData.headers.forEach(header => {
          const normalizedHeader = header.trim().toLowerCase().replace(/[\s_-]+/g, '')
          const matchedField = fieldsWithParent.find(f => {
            const cleanName = (f.name || '').toLowerCase().replace(/[\s_-]+/g, '')
            const cleanTitle = (f.title || '').toLowerCase().replace(/[\s_-]+/g, '')
            return cleanName === normalizedHeader || cleanTitle === normalizedHeader
          })
          const wsName = matchedField?.ws_add_col_name || ''
          autoMapping[header] = matchedField ? (/^CS\d+_Name$/.test(wsName) ? wsName.replace('_Name', '_value') : wsName) : '-- Skip this field --' })
      }
      setMapping(autoMapping)
    }
  }, [fileData, existingMapping, orcanosFields])

  const handleMappingChange = (excelHeader, orcanosField) => {
    setMapping(prev => ({
      ...prev,
      [excelHeader]: orcanosField
    }))
    setError('')
  }

  const validateMapping = () => {
    console.log('mapping values:', Object.values(mapping))
    console.log('mandatoryFields ws_add_col_name:', mandatoryFields.map(f => f.ws_add_col_name))
    const unmappedMandatory = mandatoryFields.filter(field => {
      const wsName = field.ws_add_col_name || ''
      const checkName = /^CS\d+_Name$/.test(wsName) ? wsName.replace('_Name', '_value') : wsName
      return !Object.values(mapping).includes(checkName)
    })

    if (unmappedMandatory.length > 0) {
      const titles = unmappedMandatory.map(f => f.title || f.name).join(', ')
      setError(`Please map all mandatory fields: ${titles}`)
      return false
    }
    return true
  }

  const handleLoadPreviousMapping = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result)
        if (data.mapping) {
          setMapping(data.mapping)
          setError('')
        } else {
          setError('Invalid mapping file format')
        }
      } catch (err) {
        setError('Error reading mapping file: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const handleSaveMapping = () => {
    const mappingData = {
      mapping: mapping
    }
    const dataStr = JSON.stringify(mappingData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'field-mapping.json'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleSaveAndImport = () => {
    if (!validateMapping()) return
    onComplete(mapping)
  }

  if (!fileData || !fileData.headers) {
    return (
      <div className="bg-white rounded-lg shadow p-8">
        <p className="text-gray-600">No file data available</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Map Fields</h2>

      {/* Load Previous Mapping Button */}
      <div className="mb-6">
        <label className="bg-[#7E3F98] hover:bg-[#682e82] text-white font-medium py-2 px-4 rounded-lg cursor-pointer inline-block transition text-sm sm:text-base">
          Load Previous Mapping
          <input
            type="file"
            accept=".json"
            onChange={handleLoadPreviousMapping}
            className="hidden"
          />
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Mapping Table */}
      <div className="mb-8 overflow-x-auto border border-gray-300 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Excel Column
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                Orcanos Field
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {fileData.headers.map((header, idx) => {
              const currentValue = mapping[header] || '-- Skip this field --';
              const needsMapping = currentValue === '-- Skip this field --';
              
              // Get all values mapped to OTHER headers
              const otherMappedValues = Object.entries(mapping)
                .filter(([key, val]) => key !== header && val !== '-- Skip this field --')
                .map(([_, val]) => val);
              
              return (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {header}
                  </td>
                  <td className="px-6 py-3 text-sm relative overflow-visible">
                    <SearchableSelect
                      value={currentValue}
                      onChange={(val) => handleMappingChange(header, val)}
                      className={needsMapping ? 'border-red-400 bg-red-50' : 'border-gray-300'}
                      options={[
                        { value: '-- Skip this field --', label: '-- Skip this field --' },
                        ...fieldsWithParent.map((field) => {
                          const fieldValue = /^CS\d+_Name$/.test(field.ws_add_col_name)
                            ? field.ws_add_col_name.replace('_Name', '_value')
                            : field.ws_add_col_name
                          const isMappedElsewhere = otherMappedValues.includes(fieldValue)
                          const isMandatory = field.is_mandatory === '1'
                          return {
                            value: fieldValue,
                            label: `${field.title || field.name}${isMandatory ? ' *' : ''}`,
                            disabled: isMappedElsewhere,
                            bold: isMandatory
                          }
                        })
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mandatory Fields Info */}
      {mandatoryFields.length > 0 && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-[#7E3F98] font-semibold mb-2">Mandatory Fields (must be mapped):</p>
          <p className="text-purple-800 text-sm">
            {mandatoryFields.map(f => f.title || f.name).join(', ')}
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={onBack}
          className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
        >
          Back
        </button>
        <button
          onClick={handleSaveMapping}
          className="flex-1 border border-[#7E3F98] text-[#7E3F98] hover:bg-purple-50 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
        >
          Save
        </button>
        <button
          onClick={handleSaveAndImport}
          className="flex-1 bg-[#7E3F98] hover:bg-[#682e82] text-white font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
        >
          Save & Import
        </button>
      </div>
    </div>
  )
}
