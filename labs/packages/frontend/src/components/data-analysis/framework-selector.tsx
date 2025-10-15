'use client'

export const FrameworkSelector = ({ 
    value, 
    onChange,
    frameworks 
  }: { 
    value: string, 
    onChange: (framework: string) => void,
    frameworks: Record<string, any> | null
  }) => {
    if (!frameworks) return null
  
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Target Framework</h3>
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
        >
          {Object.entries(frameworks).map(([key, framework]) => (
            <option key={key} value={key}>
              {framework.name} - {framework.description}
            </option>
          ))}
        </select>
      </div>
    )
  } 