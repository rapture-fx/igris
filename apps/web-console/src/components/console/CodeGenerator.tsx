'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Code2, Terminal } from 'lucide-react';

interface CodeGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  requestConfig: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
}

type CodeLanguage = 'curl' | 'javascript' | 'python';

const CodeGenerator: React.FC<CodeGeneratorProps> = ({ isOpen, onClose, requestConfig }) => {
  const [selectedLanguage, setSelectedLanguage] = useState<CodeLanguage>('curl');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateCode = () => {
    const { method, url, headers, body } = requestConfig;

    switch (selectedLanguage) {
      case 'curl':
        let curlCmd = `curl -X ${method.toUpperCase()} "${url}"`;
        
        Object.entries(headers).forEach(([key, value]) => {
          curlCmd += ` \\\n  -H "${key}: ${value}"`;
        });
        
        if (body && method !== 'GET') {
          curlCmd += ` \\\n  -d '${body}'`;
        }
        
        return curlCmd;

      case 'javascript':
        const jsHeaders = Object.entries(headers)
          .map(([key, value]) => `    '${key}': '${value}'`)
          .join(',\n');

        return `fetch('${url}', {
  method: '${method.toUpperCase()}',
  headers: {
${jsHeaders}
  }${body && method !== 'GET' ? `,\n  body: '${body}'` : ''}
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`;

      case 'python':
        const pythonHeaders = Object.entries(headers)
          .map(([key, value]) => `    '${key}': '${value}'`)
          .join(',\n');

        return `import requests

url = '${url}'
headers = {
${pythonHeaders}
}

${body && method !== 'GET' ? `data = '${body}'\n\n` : ''}response = requests.${method.toLowerCase()}(url, headers=headers${body && method !== 'GET' ? ', data=data' : ''})
print(response.json())`;

      default:
        return '';
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateCode());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const languageOptions = [
    { id: 'curl', label: 'cURL', icon: Terminal },
    { id: 'javascript', label: 'JavaScript (fetch)', icon: Code2 },
    { id: 'python', label: 'Python (requests)', icon: Code2 }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Generate Code</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              {languageOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelectedLanguage(option.id as CodeLanguage)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      selectedLanguage === option.id
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-auto">
            <div className="relative">
              <button
                onClick={handleCopy}
                className="absolute top-3 right-3 p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              <pre className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 pr-12 overflow-x-auto text-sm font-mono text-gray-800 dark:text-gray-200">
                {generateCode()}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { CodeGenerator };