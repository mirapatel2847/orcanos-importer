import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import SearchableSelect from './SearchableSelect'

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

const DROPDOWN_ESTIMATED_HEIGHT = 246

function getVisibleBounds(element) {
  let visibleTop = 0
  let visibleBottom = window.innerHeight

  let el = element?.parentElement
  while (el) {
    const { overflowY, overflowX } = window.getComputedStyle(el)
    const isScrollContainer =
      ['auto', 'scroll', 'hidden'].includes(overflowY) ||
      ['auto', 'scroll', 'hidden'].includes(overflowX)

    if (isScrollContainer) {
      const rect = el.getBoundingClientRect()
      visibleTop = Math.max(visibleTop, rect.top)
      visibleBottom = Math.min(visibleBottom, rect.bottom)
    }
    el = el.parentElement
  }

  return { visibleTop, visibleBottom }
}

function shouldOpenUpward(triggerRect, container) {
  const { visibleBottom } = getVisibleBounds(container)
  const spaceBelow = visibleBottom - triggerRect.bottom
  return spaceBelow < DROPDOWN_ESTIMATED_HEIGHT
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

  const [searchText, setSearchText] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, bottom: 0 })

  const containerRef = useRef(null)
  const dropdownRef = useRef(null)
  const searchRef = useRef(null)

  const closeDropdown = () => {
    setDropdownOpen(false)
    setSearchText('')
  }

  const openDropdown = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const upward = shouldOpenUpward(rect, containerRef.current)
      setOpenUpward(upward)
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + 4
      })
    } else {
      setOpenUpward(false)
    }
    setDropdownOpen(true)
  }

  useEffect(() => {
    if (!dropdownOpen) return

    const handleClickOutside = (e) => {
      if (
        !containerRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) {
        closeDropdown()
      }
    }

    const handleScroll = (e) => {
      if (dropdownRef.current?.contains(e.target)) return
      closeDropdown()
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [dropdownOpen])

  useEffect(() => {
    if (dropdownOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [dropdownOpen])

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
          label: version.List_label
        })
      }
    }
    return pairs
  }, [projectsList])

  const allProjectVersionPairs = projectVersionOptions

  const filteredOptions = allProjectVersionPairs.filter(option =>
    option.label.toLowerCase().includes(searchText.toLowerCase())
  )

  const selectedOption = allProjectVersionPairs.find((o) => o.value === selectedProjectVersionKey)
  const displayLabel = selectedOption?.label || (selectedProjectVersionKey ? selectedProjectVersionKey : "Select a project and version...")

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
      const response = await fetch('/api/get-item-fields', {
        method: 'POST',
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

      const newProjectConfig = {
        item_type: selectedItemType.Code,
        object_type_label: selectedItemType.Label,
        project_id: projectId,
        major_version: majorVersion,
        minor_version: minorVersion,
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
          <div ref={containerRef} className="relative">
            <button
              type="button"
              onClick={() => !(loading || projectsList.length === 0) && (dropdownOpen ? closeDropdown() : openDropdown())}
              disabled={loading || projectsList.length === 0}
              className={`w-full px-3 py-2 border rounded-lg text-left text-sm focus:outline-none focus:ring-2 focus:ring-[#7E3F98] transition-colors flex items-center justify-between gap-2 ${
                loading || projectsList.length === 0 ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
              } border-gray-300`}
            >
              <span className="truncate">{displayLabel}</span>
              <svg
                className={`w-4 h-4 shrink-0 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {dropdownOpen && createPortal(
              <div
                ref={dropdownRef}
                style={openUpward
                  ? { position: 'fixed', left: position.left, width: position.width, bottom: position.bottom }
                  : { position: 'fixed', left: position.left, width: position.width, top: position.top }
                }
                className="z-50 bg-white border border-gray-300 rounded-lg shadow-lg overscroll-contain"
                onWheel={(e) => e.stopPropagation()}
              >
                <div className="p-2 border-b border-gray-200">
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7E3F98]"
                  />
                </div>
                <ul className="max-h-48 overflow-y-auto overscroll-contain py-1">
                  {filteredOptions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-gray-500">No matching fields</li>
                  ) : (
                    filteredOptions.map((option) => (
                      <li key={option.value}>
                        <button
                          type="button"
                          onClick={() => {
                            handleProjectVersionChange(option.value)
                            closeDropdown()
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            option.value === selectedProjectVersionKey
                              ? 'bg-purple-50 text-[#7E3F98]'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {option.label}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>,
              document.body
            )}
          </div>
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
