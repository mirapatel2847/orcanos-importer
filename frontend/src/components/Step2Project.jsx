import { useState, useMemo } from 'react'
import SearchableSelect from './SearchableSelect'
import API_URL from '../api.js';

const toArray = (value) => {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function makeProjectVersionKey(projectId, versionLabel) {
  return `${projectId}|${versionLabel}`
}

function parseProjectVersionKey(key) {
  if (!key) return { projectId: '', versionLabel: '' }
  const separatorIndex = key.indexOf('|')
  if (separatorIndex === -1) return { projectId: '', versionLabel: '' }
  return {
    projectId: key.slice(0, separatorIndex),
    versionLabel: key.slice(separatorIndex + 1)
  }
}

function getInitialSelections(projectConfig, projectsList) {
  if (!projectConfig || !projectsList.length) {
    return { projectVersionKey: '', itemTypeCode: '' }
  }

  const projectId = String(projectConfig.project_id ?? projectConfig.projectId ?? '')
  const itemTypeCode = projectConfig.item_type ?? projectConfig.itemType ?? ''
  const major = projectConfig.major_version ?? projectConfig.majorVersion
  const minor = projectConfig.minor_version ?? projectConfig.minorVersion

  let projectVersionKey = ''
  const project = projectsList.find((p) => String(p.Id) === projectId)

  if (project && major != null && minor != null) {
    const match = toArray(project.Version).find((v) => {
      const parts = (v.Version_label || '').split('.')
      return (
        parseInt(parts[0], 10) === parseInt(major, 10) &&
        parseInt(parts[1], 10) === parseInt(minor, 10)
      )
    })
    if (match) {
      projectVersionKey = makeProjectVersionKey(project.Id, match.Version_label)
    }
  }

  return { projectVersionKey, itemTypeCode }
}

export default function Step2Project({ credentials, projectConfig, projectsList = [], onComplete, onBack }) {
  const initial = getInitialSelections(projectConfig, projectsList)
  const [selectedProjectVersionKey, setSelectedProjectVersionKey] = useState(initial.projectVersionKey)
  const [selectedItemTypeCode, setSelectedItemTypeCode] = useState(initial.itemTypeCode)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')



  const { projectId: selectedProjectId, versionLabel: selectedVersionLabel } = useMemo(
    () => parseProjectVersionKey(selectedProjectVersionKey),
    [selectedProjectVersionKey]
  )

  const selectedProject = useMemo(
    () => projectsList.find((p) => String(p.Id) === String(selectedProjectId)),
    [projectsList, selectedProjectId]
  )

  const itemTypes = useMemo(() => {
    const allItemTypes = toArray(selectedProject?.Item_type)
    return allItemTypes.filter(
      (item) =>
        item.Permission && (item.Permission.includes('U') || item.Permission.includes('A'))
    )
  }, [selectedProject])

  const projectVersionOptions = useMemo(() => {
    const pairs = []
    for (const project of projectsList) {
      for (const version of toArray(project.Version)) {
        pairs.push({
          value: makeProjectVersionKey(project.Id, version.Version_label),
          label: version.List_label,
          verId: version.Ver_id ?? null
        })
      }
    }
    return pairs
  }, [projectsList])

  const allProjectVersionPairs = projectVersionOptions



  const itemTypeOptions = useMemo(
    () =>
      itemTypes.map((itemType) => ({
        value: itemType.Code,
        label: itemType.Label
      })),
    [itemTypes]
  )

  const handleProjectVersionChange = (projectVersionKey) => {
    setSelectedProjectVersionKey(projectVersionKey)
    setSelectedItemTypeCode('')
    setError('')
  }

  const handleItemTypeChange = (itemTypeCode) => {
    setSelectedItemTypeCode(itemTypeCode)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedProjectVersionKey || !selectedItemTypeCode) {
      setError('Please select a project-version and item type')
      return
    }

    const selectedItemType = itemTypes.find((t) => t.Code === selectedItemTypeCode)
    if (!selectedProject || !selectedItemType) {
      setError('Invalid selection. Please try again.')
      return
    }

    const versionParts = selectedVersionLabel.split('.')
    if (versionParts.length < 2 || isNaN(parseInt(versionParts[0], 10)) || isNaN(parseInt(versionParts[1], 10))) {
      setError('Invalid version format')
      return
    }

    setLoading(true)
    setError('')

    const majorVersion = parseInt(versionParts[0], 10)
    const minorVersion = parseInt(versionParts[1], 10)
    const projectId = parseInt(selectedProject.Id, 10)

    try {
      const response = await fetch(`${API_URL}/api/get-item-fields`, {        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...credentials?.headers,
          'X-Orcanos-Domain': credentials?.domain
        },
        body: JSON.stringify({
          item_type: selectedItemType.Code,
          project_id: projectId,
          major_version: majorVersion,
          minor_version: minorVersion,
          domain: credentials?.domain,
          headers: credentials?.headers
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch project fields')
      }

      const data = await response.json()
      const orcanosFields = data.Data?.field || []
      const mandatoryFields = orcanosFields.filter((f) => f.is_mandatory === '1')

      const selectedVersionOption = allProjectVersionPairs.find((o) => o.value === selectedProjectVersionKey)
      const newProjectConfig = {
        project_name: selectedVersionOption?.label ?? '',
        raw_project_name: selectedProject?.Project_name ?? '',
        item_type: selectedItemType.Code,
        object_type_label: selectedItemType.Label,
        project_id: projectId,
        major_version: majorVersion,
        minor_version: minorVersion,
        ver_id: selectedVersionOption?.verId ?? null,
        itemType: selectedItemType.Code,
        projectId,
        majorVersion,
        minorVersion
      }

      onComplete(newProjectConfig, orcanosFields, mandatoryFields)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Project Connect</h2>
      <p className="text-gray-600 mb-6">Connect to an Orcanos project to retrieve fields.</p>

      {projectsList.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm mb-6">
          No projects available. Go back and reconnect to load your projects.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
          <SearchableSelect
            value={selectedProjectVersionKey}
            onChange={handleProjectVersionChange}
            options={projectVersionOptions}
            disabled={loading || projectsList.length === 0}
            placeholder="Select a project and version..."
            searchPlaceholder="Search projects..."
            className="border-gray-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Item Type</label>
          <SearchableSelect
            value={selectedItemTypeCode}
            onChange={handleItemTypeChange}
            options={itemTypeOptions}
            disabled={loading || !selectedProjectVersionKey}
            placeholder="Select an item type..."
            searchPlaceholder="Search item types..."
            className="border-gray-300"
          />
          {selectedItemTypeCode && (() => {
            const selectedLabel = itemTypeOptions.find(o => o.value === selectedItemTypeCode)?.label || ''
            if (selectedLabel.toLowerCase().includes('test case')) {
              return (
                <div className="mt-2 flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg px-3 py-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                  </svg>
                  <span>Test Case imports support a two-sheet Excel file — one sheet for test case fields and one for steps.</span>
                </div>
              )
            }
            return null
          })()}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-4 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={loading || projectsList.length === 0}
            className="flex-1 bg-[#7E3F98] hover:bg-[#682e82] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            Connect Project
          </button>
        </div>
      </form>
    </div>
  )
}
