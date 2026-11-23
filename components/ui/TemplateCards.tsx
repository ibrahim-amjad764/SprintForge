// components/ui/TemplateCards.tsx
"use client";

import { useState } from 'react';
import { Check, Zap, Shield, Users, Kanban, Layout, GitBranch } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  compliance?: string[];
  color: string;
}

const templates: Template[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start from scratch with full customization freedom',
    icon: <Layout className="w-6 h-6" />,
    features: ['Custom workflows', 'Flexible structure', 'No pre-sets'],
    color: 'bg-muted border-border',
  },
  {
    id: 'kanban',
    name: 'Agile Core',
    description: 'Kanban boards for continuous delivery teams',
    icon: <Kanban className="w-6 h-6" />,
    features: ['Kanban boards', 'Sprint tracking', 'Agile metrics'],
    compliance: ['Scrum ready', 'Agile compliant'],
    color: 'bg-blue-100 dark:bg-blue-500/15 border-blue-300 dark:border-blue-500/40',
  },
  {
    id: 'scrum',
    name: 'DevOps Center',
    description: 'Scrum sprints with CI/CD integration',
    icon: <GitBranch className="w-6 h-6" />,
    features: ['Sprint planning', 'Release tracking', 'CI/CD hooks'],
    compliance: ['DevOps ready', 'Release management'],
    color: 'bg-green-100 dark:bg-green-500/15 border-green-300 dark:border-green-500/40',
  },
  {
    id: 'bug-tracker',
    name: 'Compliance Engine',
    description: 'Bug tracking with audit trails and compliance',
    icon: <Shield className="w-6 h-6" />,
    features: ['Bug tracking', 'Audit logs', 'Compliance reporting'],
    compliance: ['SOC2 ready', 'HIPAA compliant', 'GDPR ready'],
    color: 'bg-purple-100 dark:bg-purple-500/15 border-purple-300 dark:border-purple-500/40',
  },
];

interface TemplateCardsProps {
  selectedTemplate: string;
  onTemplateSelect: (templateId: string) => void;
}

export function TemplateCards({ selectedTemplate, onTemplateSelect }: TemplateCardsProps) {
  const [hoveredTemplate, setHoveredTemplate] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">Choose a Template</label>
      <div className="grid grid-cols-2 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`
              relative p-4 rounded-lg border-2 cursor-pointer transition-all
              ${selectedTemplate === template.id 
                ? `${template.color} border-current ring-2 ring-offset-2 ring-blue-500` 
                : 'bg-card border-border hover:border-border hover:shadow-md'
              }
            `}
            onClick={() => onTemplateSelect(template.id)}
            onMouseEnter={() => setHoveredTemplate(template.id)}
            onMouseLeave={() => setHoveredTemplate(null)}
          >
            {selectedTemplate === template.id && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${template.color.split(' ')[0]}`}>
                {template.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm">{template.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
              </div>
            </div>

            {/* Feature tooltip on hover */}
            {hoveredTemplate === template.id && (
              <div className="absolute bottom-full left-0 right-0 mb-2 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
                <div className="font-medium mb-2">Features:</div>
                <ul className="space-y-1">
                  {template.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {template.compliance && template.compliance.length > 0 && (
                  <>
                    <div className="font-medium mt-2 mb-1">Compliance:</div>
                    <div className="flex flex-wrap gap-1">
                      {template.compliance.map((comp, idx) => (
                        <span key={idx} className="bg-green-600 px-2 py-0.5 rounded text-xs">
                          {comp}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
