// components/ui/OAuthSimulator.tsx
"use client";

import { useState, useEffect } from 'react';
import { Lock, Shield, CheckCircle } from 'lucide-react';

interface OAuthSimulatorProps {
  isOpen: boolean;
  provider: 'GitHub' | 'Slack' | 'GitLab' | 'Microsoft Teams';
  onComplete: () => void;
}

export function OAuthSimulator({ isOpen, provider, onComplete }: OAuthSimulatorProps) {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState('');

  // Reset progress state when the simulator closes
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setStep(0);
      setDots('');
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const steps = [
      { duration: 1500, text: 'Connecting SprintForge Secure Token Gate...' },
      { duration: 1500, text: 'Verifying OAuth credentials...' },
      { duration: 1000, text: 'Establishing secure session...' },
      { duration: 800, text: 'Granting permissions...' },
    ];

    let currentStep = 0;
    let dotInterval: NodeJS.Timeout;

    const runStep = async () => {
      if (currentStep >= steps.length) {
        onComplete();
        return;
      }

      setStep(currentStep);
      
      // Animate dots
      dotInterval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 300);

      await new Promise(resolve => setTimeout(resolve, steps[currentStep].duration));
      clearInterval(dotInterval);
      currentStep++;
      runStep();
    };

    runStep();

    return () => clearInterval(dotInterval);
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  const messages = [
    'Connecting SprintForge Secure Token Gate...',
    'Verifying OAuth credentials...',
    'Establishing secure session...',
    'Granting permissions...',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Connecting to {provider}</h3>
            <p className="text-sm text-gray-500">Secure OAuth authentication</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="space-y-3 mb-6">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                index < step
                  ? 'bg-green-50 border border-green-200'
                  : index === step
                  ? 'bg-blue-50 border border-blue-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              {index < step ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              ) : index === step ? (
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 border-2 border-gray-300 rounded-full flex-shrink-0" />
              )}
              <span
                className={`text-sm ${
                  index < step
                    ? 'text-green-700'
                    : index === step
                    ? 'text-blue-700 font-medium'
                    : 'text-gray-400'
                }`}
              >
                {msg}{index === step && dots}
              </span>
            </div>
          ))}
        </div>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 p-3 bg-gray-50 rounded-lg">
          <Shield className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-500">
            End-to-end encrypted connection • SOC2 compliant
          </span>
        </div>
      </div>
    </div>
  );
}
