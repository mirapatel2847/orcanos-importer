export default function StepIndicator({ currentStep, onStepClick, importInProgress }) {
  const steps = [
    { number: 1, label: 'Authorization' },
    { number: 2, label: 'Project Connect' },
    { number: 3, label: 'Upload File' },
    { number: 4, label: 'Map Fields' },
    { number: 5, label: 'Import' }
  ]

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isCompleted = step.number < currentStep;
        const isCurrent = step.number === currentStep;
        const isFuture = step.number > currentStep;

        const isClickable = isCompleted && !importInProgress;
        
        const getContainerClasses = () => {
          let classes = "flex flex-col items-center ";
          if (importInProgress) {
            classes += "cursor-not-allowed ";
          } else if (isClickable) {
            classes += "cursor-pointer group ";
          } else if (isFuture) {
            classes += "cursor-not-allowed ";
          }
          return classes;
        };

        const handleClick = () => {
          if (isClickable && onStepClick) {
            onStepClick(step.number);
          }
        };

        return (
          <div key={step.number} className="flex items-center flex-1">
            <div 
              className={getContainerClasses()}
              onClick={handleClick}
              title={importInProgress ? "Cannot navigate during import" : ""}
            >
              {isCompleted ? (
                <div className={`flex items-center justify-center w-10 h-10 bg-[#7E3F98] rounded-full transition-colors ${isClickable ? 'group-hover:bg-[#682e82]' : ''}`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : isCurrent ? (
                <div className="flex items-center justify-center w-10 h-10 bg-[#7E3F98] rounded-full">
                  <span className="text-white font-bold">{step.number}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center w-10 h-10 bg-gray-300 rounded-full">
                  <span className="text-gray-600 font-bold">{step.number}</span>
                </div>
              )}
              <span className={`mt-2 text-sm font-medium ${
                step.number <= currentStep ? 'text-gray-900' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-4 ${
                step.number < currentStep ? 'bg-[#7E3F98]' : 'bg-gray-300'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  )
}
