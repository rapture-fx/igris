'use client'

import {
  Zap,
  Replace,
  Split,
  Binary,
  CalendarClock,
  KeyRound,
  Eye,
  Wand2,
  Copy,
  Target,
} from 'lucide-react'

const AddTransformationModal = ({ 
  isOpen, 
  onClose, 
  onAddStep,
  availableTransformations 
}: {
  isOpen: boolean, 
  onClose: () => void, 
  onAddStep: (type: string) => void,
  availableTransformations: any[] | null
}) => {
  if (!isOpen) return null;

  const getTransformationIcon = (type: string) => {
    const iconMap: Record<string, any> = {
      'replace': Replace,
      'split': Split,
      'format-date': CalendarClock,
      'convert-type': Binary,
      'remove-duplicates': Copy,
      'normalize': Wand2,
      'aggregate': Target,
      'filter': Eye
    }
    const IconComponent = iconMap[type] || Zap
    return <IconComponent className="w-6 h-6 text-blue-600" />
  }

  const transforms = availableTransformations || [
    { type: 'replace', title: 'Replace Text', description: 'Find and replace text in a column.' },
    { type: 'split', title: 'Split Column', description: 'Split a column into multiple columns.' },
    { type: 'format-date', title: 'Format Date', description: 'Change the format of a date column.' },
    { type: 'convert-type', title: 'Convert Data Type', description: 'Change a column\'s data type.' },
    { type: 'remove-duplicates', title: 'Remove Duplicates', description: 'Remove duplicate rows.' },
    { type: 'normalize', title: 'Normalize Data', description: 'Scale numerical data to a standard range.' },
    { type: 'aggregate', title: 'Aggregate Data', description: 'Summarize data with functions like SUM or AVG.' },
    { type: 'filter', title: 'Filter Rows', description: 'Keep rows that match specific criteria.' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-800">Add Transformation Step</h2>
          <p className="text-sm text-gray-500 mt-1">Select a transformation to add to your pipeline.</p>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {transforms.map((transform) => (
              <button
                key={transform.type}
                onClick={() => onAddStep(transform.type)}
                className="flex items-start text-left p-4 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg transition-all duration-200"
              >
                <div className="mr-4 mt-1">
                  {getTransformationIcon(transform.type)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{transform.title}</h3>
                  <p className="text-sm text-gray-600">{transform.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 bg-gray-50 border-t rounded-b-xl">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default AddTransformationModal; 