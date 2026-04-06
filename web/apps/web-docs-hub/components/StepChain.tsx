interface Step {
  label: string;
  description?: string;
}

interface StepChainProps {
  steps: Step[];
}

export function StepChain({ steps }: StepChainProps) {
  return (
    <div className="my-6 pl-1">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-4">
          {/* Track */}
          <div className="flex flex-col items-center flex-shrink-0 w-2">
            <div className="mt-[0.3rem] w-1.5 h-1.5 rounded-full flex-shrink-0 bg-gray-700 dark:bg-[#c8c8b8]" />
            {i < steps.length - 1 && (
              <div className="w-px flex-1 min-h-6 bg-gray-200 dark:bg-[#f6f6f4]/20 mt-1" style={{ width: '1px' }} />
            )}
          </div>

          {/* Content — use div not p to avoid .prose p margin */}
          <div className={i < steps.length - 1 ? 'pb-5' : ''}>
            <div className="text-[0.8125rem] font-semibold text-gray-900 dark:text-[#f6f6f4] leading-tight m-0">
              {step.label}
            </div>
            {step.description && (
              <div className="text-[0.75rem] text-gray-500 dark:text-[#a8a89a] mt-0.5 leading-relaxed m-0">
                {step.description}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
