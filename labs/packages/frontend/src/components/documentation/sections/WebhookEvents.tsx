import React from 'react';
import { ContentSectionItem } from '../../../types/documentation';

interface WebhookEvent {
  name: string;
  description: string;
}

interface EventCategory {
  name: string;
  color: string;
  events: WebhookEvent[];
}

interface WebhookEventsProps {
  section: ContentSectionItem;
}

export function WebhookEvents({ section }: WebhookEventsProps) {
  const { title, eventCategories } = section;

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          titleText: 'text-blue-900',
          listText: 'text-blue-700'
        };
      case 'green':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          titleText: 'text-green-900',
          listText: 'text-green-700'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          titleText: 'text-gray-900',
          listText: 'text-gray-700'
        };
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h3 className="text-base font-semibold text-blue-900 mb-3">{title}</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          {eventCategories?.map((category: EventCategory, index: number) => {
            const colors = getColorClasses(category.color);
            return (
              <div key={index}>
                <div className={`font-medium ${colors.titleText} mb-2`}>
                  {category.name}
                </div>
                <ul className={`space-y-1 ${colors.listText}`}>
                  {category.events.map((event, eventIndex) => (
                    <li key={eventIndex}>
                      • <code className="text-xs bg-white px-1 rounded">{event.name}</code>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 