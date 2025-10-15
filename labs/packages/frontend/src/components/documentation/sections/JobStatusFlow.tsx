import React from 'react';
import { ContentSectionItem } from '@/types/documentation';
import { DynamicIcon } from '../DynamicIcon';

interface JobStatusFlowProps {
  section: ContentSectionItem;
}

export function JobStatusFlow({ section }: JobStatusFlowProps) {
  if (!section.statusFlow) return null;

  const { states, transitions } = section.statusFlow;

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'gray':
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-300',
          icon: 'text-gray-600',
          text: 'text-gray-900'
        };
      case 'blue':
        return {
          bg: 'bg-blue-100',
          border: 'border-blue-300',
          icon: 'text-blue-600',
          text: 'text-blue-900'
        };
      case 'green':
        return {
          bg: 'bg-green-100',
          border: 'border-green-300',
          icon: 'text-green-600',
          text: 'text-green-900'
        };
      case 'red':
        return {
          bg: 'bg-red-100',
          border: 'border-red-300',
          icon: 'text-red-600',
          text: 'text-red-900'
        };
      case 'orange':
        return {
          bg: 'bg-orange-100',
          border: 'border-orange-300',
          icon: 'text-orange-600',
          text: 'text-orange-900'
        };
      default:
        return {
          bg: 'bg-gray-100',
          border: 'border-gray-300',
          icon: 'text-gray-600',
          text: 'text-gray-900'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Status States */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {states.map((state, index) => {
          const colors = getColorClasses(state.color);
          
          return (
            <div
              key={index}
              className={`p-4 rounded-lg border ${colors.border} ${colors.bg} text-center`}
            >
              <div className="flex justify-center mb-3">
                <DynamicIcon 
                  name={state.icon} 
                  className={`w-8 h-8 ${colors.icon}`} 
                />
              </div>
              <h4 className={`font-semibold text-sm ${colors.text} mb-2 capitalize`}>
                {state.name}
              </h4>
              <p className={`text-xs ${colors.text} opacity-80`}>
                {state.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Transitions Flow */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          Status Transitions
        </h4>
        <div className="space-y-3">
          {transitions.map((transition, index) => (
            <div key={index} className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-700 font-medium min-w-[80px] text-center">
                {transition.from}
              </span>
              <div className="flex items-center gap-1 text-gray-500">
                <DynamicIcon name="arrow-right" className="w-4 h-4" />
                {transition.action && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {transition.action}
                  </span>
                )}
              </div>
              <span className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-700 font-medium min-w-[80px] text-center">
                {transition.to}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 