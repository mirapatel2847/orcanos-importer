import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

// Search input + max-h-48 options list (approximate height for flip detection)
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

export default function SearchableSelect({
  value,
  onChange,
  options,
  className = '',
  disabled = false,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...'
}) {
  const [open, setOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, bottom: 0 })
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const containerRef = useRef(null)
  const dropdownRef = useRef(null)
  const searchRef = useRef(null)
  const triggerRef = useRef(null)
  const activeOptionRef = useRef(null)

  const selectedOption = options.find((o) => o.value === value)
  const displayLabel = selectedOption?.label || (value ? value : placeholder)

  const filteredOptions = search.trim() === ''
    ? options
    : options.filter((option) =>
        String(option.label ?? '').toLowerCase().includes(search.trim().toLowerCase())
      )

  const close = () => {
    setOpen(false)
  }

  const openDropdown = () => {
    setSearch('')
    setHighlightedIndex(0)
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
    setOpen(true)
  }

  // Focus return to trigger on close
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) {
      triggerRef.current?.focus()
    }
    wasOpen.current = open
  }, [open])

  // Reset highlightedIndex on search change
  useEffect(() => {
    setHighlightedIndex(0)
  }, [search])

  // Scroll active option into view
  useEffect(() => {
    if (open && activeOptionRef.current) {
      activeOptionRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, open])

  // Auto-focus search input
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus()
    }
  }, [open])

  // Click outside handling
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e) => {
      if (
        !containerRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) {
        close()
      }
    }

    const handleScroll = (e) => {
      if (dropdownRef.current?.contains(e.target)) return
      close()
    }

    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  const handleSelect = (option) => {
    if (option.disabled) return
    onChange(option.value)
    close()
  }

  const handleTriggerKeyDown = (e) => {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDropdown()
    }
  }

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length)
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredOptions.length > 0 && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const opt = filteredOptions[highlightedIndex]
        if (!opt.disabled) {
          handleSelect(opt)
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  const dropdownStyle = openUpward
    ? { position: 'fixed', left: position.left, width: position.width, bottom: position.bottom }
    : { position: 'fixed', left: position.left, width: position.width, top: position.top }

  const dropdown = open && (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="z-50 bg-white border border-gray-300 rounded-lg shadow-lg overscroll-contain"
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="p-2 border-b border-gray-200">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={searchPlaceholder}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="options-listbox"
          aria-activedescendant={open && filteredOptions.length > 0 ? `option-${highlightedIndex}` : undefined}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7E3F98]"
        />
      </div>
      <ul
        id="options-listbox"
        role="listbox"
        className="max-h-48 overflow-y-auto overscroll-contain py-1"
      >
        {filteredOptions.length === 0 ? (
          <li className="px-3 py-2 text-sm text-gray-500">No matching fields</li>
        ) : (
          filteredOptions.map((option, index) => (
            <li key={`${option.value}-${index}`}>
              <button
                id={`option-${index}`}
                role="option"
                aria-selected={option.value === value}
                ref={index === highlightedIndex ? activeOptionRef : null}
                type="button"
                disabled={option.disabled}
                onClick={() => handleSelect(option)}
                tabIndex={-1}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  option.disabled
                    ? 'text-gray-400 cursor-not-allowed'
                    : index === highlightedIndex
                      ? 'bg-purple-100 text-[#7E3F98]'
                      : option.value === value
                        ? 'bg-purple-50 text-[#7E3F98]'
                        : 'text-gray-700 hover:bg-gray-100'
                } ${option.bold ? 'font-semibold' : ''}`}
              >
                {option.label}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  )

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && (open ? close() : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full px-3 py-2 border rounded-lg text-left text-sm focus:outline-none focus:ring-2 focus:ring-[#7E3F98] transition-colors flex items-center justify-between gap-2 ${
          disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
        } ${className}`}
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          className={`w-4 h-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}
