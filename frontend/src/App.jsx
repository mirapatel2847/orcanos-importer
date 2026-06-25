import { useState, useEffect } from 'react'
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

  const handleResetToStep2 = () => {
    if (importInProgress) return
    setShowResetConfirm(true)
  }

  const handleStepClick = (stepNumber) => {
    if (importInProgress || stepNumber >= state.currentStep) return;
    
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
    setFadeIn(false)
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        projectConfig,
        orcanosFields,
        mandatoryFields,
        currentStep: 3
      }))
      setFadeIn(true)
    }, 300)
  }

  const handleBackStep3 = () => {
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
    <div className="min-h-screen bg-[#FAF9FC]">
      {/* Header with Reset Button */}
      <div className="bg-white border-b border-purple-100 shadow-sm">
        <div className="max-w-4xl mx-auto py-4 px-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Orcanos Logo" className="h-9 w-auto" />
            <span className="text-[#9CA3AF] font-semibold text-xs tracking-widest border-l border-gray-200 pl-3">IMPORTER</span>
          </div>
          <button
            onClick={handleResetFromHeader}
            className="bg-gray-100 hover:bg-purple-100 hover:text-[#7E3F98] text-gray-700 font-medium py-2 px-3 sm:px-4 rounded-lg transition text-sm sm:text-base"
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
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
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
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition text-sm sm:text-base"
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
