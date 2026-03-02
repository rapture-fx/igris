'use client';

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
          {/* Vertical track: dot + line */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div className="mt-[0.2rem] w-2 h-2 rounded-full bg-gray-800 dark:bg-[#c8c8b8] ring-2 ring-offset-2 ring-gray-200 dark:ring-[#f6f6f4]/15 dark:ring-offset-[#25231e]" />
            {i < steps.length - 1 && (
              <div className="w-px flex-1 min-h-[1.75rem] bg-gray-200 dark:bg-[#f6f6f4]/15 mt-1.5 mb-0.5" />
            )}
          </div>

          {/* Content */}
          <div className={i < steps.length - 1 ? 'pb-5' : ''}>
            <p className="text-[0.8125rem] font-semibold text-gray-900 dark:text-[#f6f6f4] leading-tight">
              {step.label}
            </p>
            {step.description && (
              <p className="text-[0.75rem] text-gray-500 dark:text-[#a8a89a] mt-0.5 leading-relaxed">
                {step.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
