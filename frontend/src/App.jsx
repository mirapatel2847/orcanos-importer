import { useState, useEffect, useRef } from 'react'
import logo from './logo.png'
import StepIndicator from './components/StepIndicator'
import Step1Auth from './components/Step1Auth'
import Step2Project from './components/Step2Project'
import Step3Upload from './components/Step3Upload'
import Step4Mapping from './components/Step4Mapping'
import Step5Import from './components/Step5Import'

function loadFromSession() {
  try {
    const saved = sessionStorage.getItem('orcanosImporterState')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        credentials: parsed.credentials || null,
        projectConfig: parsed.projectConfig || null,
        orcanosFields: parsed.orcanosFields || [],
        mandatoryFields: parsed.mandatoryFields || [],
        projectsList: parsed.projectsList || []
      }
    }
  } catch (e) {}
  return null
}

export default function App() {
  const savedSession = loadFromSession()
  const [state, setState] = useState({
    currentStep: 1,
    credentials: savedSession?.credentials || null,
    projectConfig: savedSession?.projectConfig || null,
    orcanosFields: savedSession?.orcanosFields || [],
    mandatoryFields: savedSession?.mandatoryFields || [],
    fileData: null,
    mapping: null,
    stepsMapping: null,
    testCaseLinkColumn: null,
    stepsLinkColumn: null,
    results: null,
    projectsList: savedSession?.projectsList || []
  })
  useEffect(() => {
    try {
      sessionStorage.setItem('orcanosImporterState', JSON.stringify({
        credentials: state.credentials,
        projectConfig: state.projectConfig,
        orcanosFields: state.orcanosFields,
        mandatoryFields: state.mandatoryFields,
        projectsList: state.projectsList
      }))
    } catch (e) {}
  }, [state.credentials, state.projectConfig, state.orcanosFields, state.mandatoryFields, state.projectsList])
  
  const [fadeIn, setFadeIn] = useState(true)
  const [importInProgress, setImportInProgress] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Snapshot of project+itemType taken when the user enters Step 2 from a later step.
  // Used to decide whether downstream state should be cleared on Step 2 confirm.
  const step2EntrySnapshot = useRef(null)

  const captureStep2Snapshot = () => {
    step2EntrySnapshot.current = state.projectConfig
      ? { project_id: state.projectConfig.project_id, item_type: state.projectConfig.item_type }
      : null
  }

  const handleResetToStep2 = () => {
    if (importInProgress) return
    setShowResetConfirm(true)
  }

  const handleStepClick = (stepNumber) => {
    if (importInProgress || stepNumber >= state.currentStep) return;

    // When jumping back to Step 2, snapshot the current project/item-type so
    // handleStep2Complete can decide whether downstream state needs to be cleared.
    if (stepNumber === 2) captureStep2Snapshot()

    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentStep: stepNumber
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleStep1Complete = (credentials, projectsList) => {
    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        credentials,
        projectsList,
        currentStep: 2
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleBackStep2 = () => {
    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentStep: 1
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleStep2Complete = (projectConfig, orcanosFields, mandatoryFields) => {
    // Compare new selection against the snapshot taken when entering Step 2.
    // If project or item type changed, wipe all downstream state.
    const snap = step2EntrySnapshot.current
    const selectionChanged = !snap ||
      String(projectConfig.project_id) !== String(snap.project_id) ||
      projectConfig.item_type !== snap.item_type

    step2EntrySnapshot.current = null  // consume snapshot

    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        projectConfig,
        orcanosFields,
        mandatoryFields,
        // Only clear downstream state when the project/item-type actually changed
        ...(selectionChanged ? {
          fileData: null,
          mapping: null,
          stepsMapping: null,
          testCaseLinkColumn: null,
          stepsLinkColumn: null,
          results: null
        } : {}),
        currentStep: 3
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleBackStep3 = () => {
    // Snapshot before going back so handleStep2Complete can compare on confirm
    captureStep2Snapshot()
    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentStep: 2
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleStep3Complete = (fileData, fileChanged = true) => {
    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        fileData,
        mapping: fileChanged ? null : prev.mapping,
        results: null,
        currentStep: 4
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleBackStep4 = () => {
    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        currentStep: 3
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleStep4Complete = ({ mapping, stepsMapping, testCaseLinkColumn, stepsLinkColumn }) => {
    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        mapping,
        stepsMapping: stepsMapping || null,
        testCaseLinkColumn: testCaseLinkColumn || null,
        stepsLinkColumn: stepsLinkColumn || null,
        results: null,
        currentStep: 5
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleBackStep5 = () => {
    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        results: null,
        currentStep: 4
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleStep5StartOver = () => {
    sessionStorage.removeItem('orcanosImporterState')
    setFadeIn(false)
    setTimeout(() => {
      setState({
        currentStep: 1,
        credentials: null,
        projectConfig: null,
        orcanosFields: [],
        mandatoryFields: [],
        fileData: null,
        mapping: null,
        stepsMapping: null,
        testCaseLinkColumn: null,
        stepsLinkColumn: null,
        results: null
      })
      setFadeIn(true)
    }, 300)
  }

  const handleResetFromHeader = () => {
    sessionStorage.removeItem('orcanosImporterState')
    setFadeIn(false)
    setTimeout(() => {
      setState({
        currentStep: 1,
        credentials: null,
        projectConfig: null,
        orcanosFields: [],
        mandatoryFields: [],
        fileData: null,
        mapping: null,
        stepsMapping: null,
        testCaseLinkColumn: null,
        stepsLinkColumn: null,
        results: null
      })
      setFadeIn(true)
    }, 300)
  }

  return (
    <div className="min-h-screen bg-orca-bg1">
      {/* Header with Reset Button */}
      <div className="bg-white border-b border-orca-subtle shadow-sm">
        <div className="max-w-4xl mx-auto py-3 px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Orcanos Logo" className="h-8 w-auto" />
            <span className="text-[#7A7A7A] font-medium text-b3 tracking-widest border-l border-orca-subtle pl-3 uppercase">Importer</span>
          </div>
          <button
            onClick={handleResetFromHeader}
            className="btn-secondary text-b3 px-3 py-1 h-auto"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <StepIndicator 
          currentStep={state.currentStep} 
          importInProgress={importInProgress}
          onStepClick={handleStepClick}
        />
        
        <div className={`mt-8 transition-opacity duration-300 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
          {state.currentStep === 1 && (
            <Step1Auth credentials={state.credentials} onComplete={handleStep1Complete} />
          )}
          {state.currentStep === 2 && (
            <Step2Project credentials={state.credentials} projectConfig={state.projectConfig}   projectsList={state.projectsList} onComplete={handleStep2Complete} onBack={handleBackStep2} />
          )}
          {state.currentStep === 3 && (
            <Step3Upload fileData={state.fileData} projectConfig={state.projectConfig} onComplete={handleStep3Complete} onBack={handleBackStep3} onResetToStep2={handleResetToStep2} />
          )}
          {state.currentStep === 4 && (
            <Step4Mapping
              fileData={state.fileData}
              existingMapping={state.mapping}
              existingStepsMapping={state.stepsMapping}
              existingTestCaseLinkColumn={state.testCaseLinkColumn}
              existingStepsLinkColumn={state.stepsLinkColumn}
              projectConfig={state.projectConfig}
              orcanosFields={state.orcanosFields}
              mandatoryFields={state.mandatoryFields}
              onComplete={handleStep4Complete}
              onBack={handleBackStep4}
              onResetToStep2={handleResetToStep2}
            />
          )}
          {state.currentStep === 5 && (
            <Step5Import fileData={state.fileData} mapping={state.mapping} stepsMapping={state.stepsMapping} testCaseLinkColumn={state.testCaseLinkColumn} stepsLinkColumn={state.stepsLinkColumn} credentials={state.credentials} projectConfig={state.projectConfig} orcanosFields={state.orcanosFields} mandatoryFields={state.mandatoryFields} onStartOver={handleStep5StartOver} onBack={handleBackStep5} setImportInProgress={setImportInProgress} onResetToStep2={handleResetToStep2} />          )}
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Change Project & Item Type?</h3>
            <p className="text-gray-600 mb-6">
              This will reset your uploaded file, field mappings, and any import progress. You'll be taken back to Step 2 to reselect.
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 bg-white border border-[#2F80ED] text-[#2F80ED] hover:border-[#205EB1] hover:text-[#205EB1] font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false)
                  setState(prev => ({
                    ...prev,
                    fileData: null,
                    mapping: null,
                    stepsMapping: null,
                    testCaseLinkColumn: null,
                    stepsLinkColumn: null,
                    results: null,
                    currentStep: 2
                  }))
                }}
                className="flex-1 bg-[#EA4747] hover:bg-[#d13d3d] text-white font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
              >
                Yes, go back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
