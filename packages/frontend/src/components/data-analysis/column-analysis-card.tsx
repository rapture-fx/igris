'use client'

import { cn } from "@/lib/utils";
import { 
    Hash, 
    Calendar, 
    Type, 
    ChevronDown, 
    KeyRound, 
    CheckCircle, 
    Unlink, 
    CalendarClock, 
    User, 
    Replace, 
    Split, 
    MapPin, 
    PackageSearch, 
    BarChartHorizontalBig, 
    Binary 
} from "lucide-react";
import { useState } from "react";

export const ColumnAnalysisCard = ({ 
    columnName, 
    columnData, 
    defaultOpen = false 
  }: { 
    columnName: string, 
    columnData: any, 
    defaultOpen?: boolean 
  }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
  
    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'number': return <Hash className="w-4 h-4 text-blue-600" />
        case 'date': return <Calendar className="w-4 h-4 text-green-600" />
        case 'email': return <Type className="w-4 h-4 text-purple-600" />
        case 'phone': return <Type className="w-4 h-4 text-orange-600" />
        default: return <Type className="w-4 h-4 text-gray-600" />
      }
    }
  
    const getTypeColor = (type: string) => {
      switch (type) {
        case 'number': return 'bg-blue-100 text-blue-800'
        case 'date': return 'bg-green-100 text-green-800'
        case 'email': return 'bg-purple-100 text-purple-800'
        case 'phone': return 'bg-orange-100 text-orange-800'
        case 'string': return 'bg-gray-100 text-gray-800'
        default: return 'bg-gray-100 text-gray-800'
      }
    }
  
    const getSuggestionIcon = (suggestion: string) => {
      const iconProps = { className: "w-3.5 h-3.5 mr-1.5" };
      switch (suggestion) {
        case 'Use as primary key': return <KeyRound {...iconProps} />;
        case 'Validate format': return <CheckCircle {...iconProps} />;
        case 'Extract domain': return <Unlink {...iconProps} />;
        case 'Parse to datetime': return <CalendarClock {...iconProps} />;
        case 'Calculate age': return <User {...iconProps} />;
        case 'Standardize format': return <Replace {...iconProps} />;
        case 'Split into components': return <Split {...iconProps} />;
        case 'Geocode': return <MapPin {...iconProps} />;
        case 'Lookup product details': return <PackageSearch {...iconProps} />;
        case 'Handle outliers': return <BarChartHorizontalBig {...iconProps} />;
        case 'Convert to float': return <Binary {...iconProps} />;
        default: return null;
      }
    };
  
    return (
      <div className="border border-gray-100 rounded-lg transition-all duration-300">
        <div 
          className="p-4 cursor-pointer flex items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center space-x-3">
            {getTypeIcon(columnData.type)}
            <h4 className="font-semibold text-gray-800">{columnName}</h4>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(columnData.type)}`}>
              {columnData.type}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {columnData.confidence}% confidence
            </span>
            <ChevronDown className={cn('w-5 h-5 text-gray-400 transform transition-transform duration-300', isOpen && 'rotate-180')} />
          </div>
        </div>
        {isOpen && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4 text-sm">
              <div>
                <p className="text-gray-500">Null Values</p>
                <p className="font-semibold text-gray-800">{columnData.null_count.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Unique Values</p>
                <p className="font-semibold text-gray-800">{columnData.unique_count.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500">Sample Values</p>
                <p className="font-mono text-xs text-gray-600 truncate">{columnData.sample_values.join(', ')}</p>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Suggested Transformations:</p>
              <div className="flex flex-wrap gap-2">
                {columnData.suggested_transformations.map((suggestion: string, idx: number) => (
                  <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    {getSuggestionIcon(suggestion)}
                    {suggestion}
                  </span>
                ))}
                {columnData.suggested_transformations.length === 0 && (
                  <span className="text-sm text-gray-500">None</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  } 