"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { PanelErrorBoundary } from "@/components/ui/ErrorBoundary";
import { LogoUploader } from "@/components/ui/LogoUploader";
import { DomainTagInput } from "@/components/ui/DomainTagInput";
import { TemplateCards } from "@/components/ui/TemplateCards";
import { MemberInviteCard } from "@/components/ui/MemberInviteCard";
import { PrivacyRadioCards } from "@/components/ui/PrivacyRadioCards";
import { IndustryTags } from "@/components/ui/IndustryTags";
import { WorkspaceHeroBanner } from "@/components/ui/WorkspaceHeroBanner";
import { useDebounceSlugValidation } from "@/hooks/useDebounceSlugValidation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Sparkles, Users, Zap, Shield, Globe, Calendar, X, AlertCircle } from "lucide-react";
import { SiGithub, SiGitlab } from 'react-icons/si';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId?: string;
  userQuota?: { used: number; max: number };
}

type Step = "basic" | "security" | "integrations" | "review";

interface FormData {
  name: string;
  slug: string;
  description: string;
  logo?: string;
  allowedDomains: string[];
  defaultRole: "VIEWER" | "COMMENTER" | "EDITOR" | "ADMIN";
  members: Array<{ email: string; role: "ADMIN" | "EDITOR" | "VIEWER" }>;
  template: "kanban" | "scrum" | "bug-tracker" | "blank";
  visibility: "private" | "organization";
  industryTags: string[];
  teamSize: "1" | "2-10" | "11-50" | "50+";
  integrations: {
    slack: boolean;
    teams: boolean;
    googleCalendar: boolean;
    outlookCalendar: boolean;
    github: boolean;
    gitlab: boolean;
  };
  settings: {
    enableTour: boolean;
    autoCreateRepository: boolean;
    idpGroupMapping: boolean;
  };
}

const defaultFormData: FormData = {
  name: "",
  slug: "",
  description: "",
  logo: "",
  allowedDomains: [],
  defaultRole: "EDITOR",
  members: [],
  template: "blank",
  visibility: "private",
  industryTags: [],
  teamSize: "2-10",
  integrations: {
    slack: false,
    teams: false,
    googleCalendar: false,
    outlookCalendar: false,
    github: false,
    gitlab: false,
  },
  settings: {
    enableTour: false,
    autoCreateRepository: false,
    idpGroupMapping: false,
  },
};

export default function EnterpriseWorkspaceModal({ isOpen, onClose, organizationId, userQuota }: CreateWorkspaceModalProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("basic");
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [loading, setLoading] = useState(false);
  const isOnline = useOnlineStatus();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDraftAlert, setShowDraftAlert] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const isSubmittingRef = useRef(false);

  const { slug, setSlug, validation, isValidating, selectAlternative } = useDebounceSlugValidation(formData.slug);

  // Local draft auto-save with crash recovery
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const savedDraft = localStorage.getItem('workspaceDraft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setFormData(parsed);
          setIsDirty(true);
          setShowDraftAlert(true);
        } catch (e) {
          console.error('Failed to parse draft:', e);
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (isDirty) {
      localStorage.setItem('workspaceDraft', JSON.stringify(formData));
    }
  }, [formData, isDirty]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem('workspaceDraft');
    setFormData(defaultFormData);
    setIsDirty(false);
    setShowDraftAlert(false);
  }, []);

  const restoreDraft = useCallback(() => {
    const savedDraft = localStorage.getItem('workspaceDraft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed);
        setShowDraftAlert(false);
      } catch (e) {
        console.error('Failed to restore draft:', e);
      }
    }
  }, []);

  // Update slug when name changes
  const slugifiedName = formData.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  const [prevSlugifiedName, setPrevSlugifiedName] =
    useState(slugifiedName);
  if (slugifiedName !== prevSlugifiedName) {
    setPrevSlugifiedName(slugifiedName);
    setSlug(slugifiedName);
    setFormData((prev) => ({ ...prev, slug: slugifiedName }));
    setIsDirty(formData.name.length > 0);
  }

  // AI Description Generation
  const handleGenerateDescription = async () => {
    if (!formData.name) return;
    
    setGeneratingDescription(true);
    try {
      const response = await apiRequest('/api/ai/generate-description', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          template: formData.template,
        }),
      });

      if (response.success) {
        setFormData(prev => ({ ...prev, description: response.data.description }));
      }
    } catch (error) {
      console.error('Failed to generate description:', error);
    } finally {
      setGeneratingDescription(false);
    }
  };

  // Step validation guardrails
  const canProceedToStep = (step: Step): boolean => {
    switch (step) {
      case "security":
        return formData.name.trim().length > 0 && validation.isValid;
      case "integrations":
        return true;
      case "review":
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (currentStep === "basic" && canProceedToStep("security")) setCurrentStep("security");
    else if (currentStep === "security" && canProceedToStep("integrations")) setCurrentStep("integrations");
    else if (currentStep === "integrations") setCurrentStep("review");
  };

  const prevStep = () => {
    if (currentStep === "security") setCurrentStep("basic");
    else if (currentStep === "integrations") setCurrentStep("security");
    else if (currentStep === "review") setCurrentStep("integrations");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setLoading(true);
    setErrors({});

    if (!formData.name.trim()) {
      setErrors({ name: "Workspace name is required" });
      setLoading(false);
      isSubmittingRef.current = false;
      return;
    }

    try {
      const response = await apiRequest("/api/workspace", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          members: formData.members.map(m => m.email),
          organization: organizationId,
        }),
      });

      if (response.success) {
        clearDraft();
        onClose();
        router.push(`/workspace/${response.data._id}`);
      } else {
        setErrors({ general: response.message || "Failed to create workspace" });
      }
    } catch (err) {
      setErrors({ general: "An error occurred while creating workspace" });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  if (!isOpen) return null;

  const steps = [
    { id: "basic", label: "Basic Profile", icon: Globe },
    { id: "security", label: "Security & Domain", icon: Shield },
    { id: "integrations", label: "VCS & Chat", icon: Zap },
    { id: "review", label: "Review", icon: Users },
  ] as const;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sprintforge.com';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-6xl rounded-lg bg-card shadow-xl max-h-[95vh] overflow-hidden">
        <div className="grid lg:grid-cols-3 h-full">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-card border-b px-6 py-4 z-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Create Enterprise Workspace</h2>
                <button onClick={onClose} className="rounded p-1 hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {/* Draft Alert */}
              {showDraftAlert && (
                <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/40 rounded-lg mb-4">
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-300" />
                  <span className="text-sm text-yellow-800 dark:text-yellow-300">Draft recovered from previous session</span>
                  <button
                    onClick={clearDraft}
                    className="ml-auto text-xs text-yellow-700 dark:text-yellow-300 underline hover:text-yellow-900 dark:text-yellow-300"
                  >
                    Clear
                  </button>
                </div>
              )}
              
              {/* Stepper */}
              <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = currentStep === step.id;
                  const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
                  const canAccess = index === 0 || canProceedToStep(step.id);
                  
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isActive ? 'bg-blue-600 text-white' : isCompleted ? 'bg-green-600 text-white' : canAccess ? 'bg-muted text-muted-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {isCompleted ? '✓' : <Icon className="w-5 h-5" />}
                        </div>
                        <span className={`text-xs mt-1 ${isActive ? 'text-blue-600 dark:text-blue-300 font-medium' : canAccess ? 'text-muted-foreground' : 'text-gray-300'}`}>
                          {step.label}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div className={`flex-1 h-1 mx-2 ${isCompleted ? 'bg-green-600' : canAccess ? 'bg-muted' : 'bg-muted'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Workspace Quota Display */}
              {userQuota && (
                <PanelErrorBoundary panelName="Quota Display">
                  <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-300">Workspace Quota</span>
                      <span className="text-sm text-blue-700 dark:text-blue-300">{userQuota.used} / {userQuota.max} used</span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-500/20 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${userQuota.used >= userQuota.max ? 'bg-red-500' : 'bg-blue-600'}`}
                        style={{ width: `${Math.min((userQuota.used / userQuota.max) * 100, 100)}%` }}
                      />
                    </div>
                    {userQuota.used >= userQuota.max && (
                      <p className="text-xs text-red-600 dark:text-red-300 mt-2">Workspace limit reached. Upgrade your plan to create more workspaces.</p>
                    )}
                  </div>
                </PanelErrorBoundary>
              )}

              {/* Basic Profile Step */}
              {currentStep === "basic" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    {/* Logo Uploader */}
                    <PanelErrorBoundary panelName="Logo Uploader">
                      <LogoUploader
                        logoUrl={formData.logo}
                        onLogoChange={(url) => setFormData(prev => ({ ...prev, logo: url }))}
                        workspaceName={formData.name}
                        disabled={!isOnline || loading}
                      />
                    </PanelErrorBoundary>

                    {/* Workspace Name */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Workspace Name</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full rounded-md border border-border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g., Project Alpha"
                        required
                        disabled={!isOnline || loading}
                        maxLength={100}
                      />
                      {errors.name && <p className="text-sm text-red-600 dark:text-red-300">{errors.name}</p>}
                    </div>
                  </div>

                  {/* Slug Preview with Validation */}
                  <PanelErrorBoundary panelName="Slug Validation">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">Workspace URL</label>
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
                        <span className="text-sm text-muted-foreground">{appUrl}/workspace/</span>
                        <span className={`font-medium ${validation.isAvailable ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                          {slug || 'your-slug'}
                        </span>
                        {isValidating && (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                      {!validation.isAvailable && validation.alternatives && (
                        <div className="space-y-1">
                          <p className="text-sm text-red-600 dark:text-red-300">{validation.message}</p>
                          <p className="text-xs text-muted-foreground">Suggested alternatives:</p>
                          <div className="flex flex-wrap gap-2">
                            {validation.alternatives.map((alt) => (
                              <button
                                key={alt}
                                type="button"
                                onClick={() => selectAlternative(alt)}
                                className="text-xs text-blue-600 dark:text-blue-300 underline hover:text-blue-800 dark:text-blue-300"
                              >
                                {alt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </PanelErrorBoundary>

                  {/* Description with AI Generation */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Workspace Purpose / Description</label>
                    <div className="flex gap-2">
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className="flex-1 rounded-md border border-border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Describe your workspace's purpose and goals..."
                        rows={4}
                        disabled={!isOnline || loading}
                        maxLength={500}
                      />
                      <button
                        type="button"
                        onClick={handleGenerateDescription}
                        disabled={!formData.name || generatingDescription || !isOnline}
                        className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 self-start"
                      >
                        <Sparkles className="w-4 h-4" />
                        {generatingDescription ? 'Generating...' : 'AI Generate'}
                      </button>
                    </div>
                  </div>

                  {/* Template Cards */}
                  <PanelErrorBoundary panelName="Template Selection">
                    <TemplateCards
                      selectedTemplate={formData.template}
                      onTemplateSelect={(template) => setFormData(prev => ({ ...prev, template: template as any }))}
                    />
                  </PanelErrorBoundary>

                  {/* Industry Tags */}
                  <PanelErrorBoundary panelName="Industry Tags">
                    <IndustryTags
                      selectedTags={formData.industryTags}
                      onTagsChange={(tags) => setFormData(prev => ({ ...prev, industryTags: tags }))}
                      disabled={!isOnline || loading}
                    />
                  </PanelErrorBoundary>

                  {/* Team Size Selector */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Estimated Team Size</label>
                    <div className="flex gap-2">
                      {[
                        { value: "1", label: "Just me" },
                        { value: "2-10", label: "2-10 members" },
                        { value: "11-50", label: "11-50 members" },
                        { value: "50+", label: "Enterprise (50+)" },
                      ].map((size) => (
                        <button
                          key={size.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, teamSize: size.value as any }))}
                          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                            formData.teamSize === size.value
                              ? 'bg-blue-600 text-white'
                              : 'bg-muted text-foreground hover:bg-muted'
                          }`}
                          disabled={loading}
                        >
                          {size.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Security & Domain Step */}
              {currentStep === "security" && (
                <div className="space-y-6">
                  {/* Privacy Radio Cards */}
                  <PanelErrorBoundary panelName="Privacy Settings">
                    <PrivacyRadioCards
                      visibility={formData.visibility}
                      onVisibilityChange={(visibility) => setFormData(prev => ({ ...prev, visibility }))}
                      disabled={!isOnline || loading}
                    />
                  </PanelErrorBoundary>

                  {/* Domain Restrictions */}
                  <PanelErrorBoundary panelName="Domain Restrictions">
                    <DomainTagInput
                      domains={formData.allowedDomains}
                      onDomainsChange={(domains) => setFormData(prev => ({ ...prev, allowedDomains: domains }))}
                      placeholder="Enter domain (e.g., company.com)"
                      disabled={!isOnline || loading}
                    />
                  </PanelErrorBoundary>

                  {/* Default Role */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Default Role for Invited Members</label>
                    <select
                      value={formData.defaultRole}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultRole: e.target.value as any }))}
                      className="w-full rounded-md border border-border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      disabled={loading}
                    >
                      <option value="VIEWER">Viewer - Can only view</option>
                      <option value="COMMENTER">Commenter - Can view and comment</option>
                      <option value="EDITOR">Editor - Can edit tasks and projects</option>
                      <option value="ADMIN">Admin - Full access except billing</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Integrations Step */}
              {currentStep === "integrations" && (
                <div className="space-y-6">
                  <h3 className="font-medium">Communication & Calendar</h3>
                  
                  <PanelErrorBoundary panelName="Communication Integrations">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'slack', label: 'Slack', icon: Zap },
                        { key: 'teams', label: 'Microsoft Teams', icon: Users },
                        { key: 'googleCalendar', label: 'Google Calendar', icon: Calendar },
                        { key: 'outlookCalendar', label: 'Outlook Calendar', icon: Calendar },
                      ].map((integration) => (
                        <div key={integration.key} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <integration.icon className="w-5 h-5 text-muted-foreground" />
                            <span className="font-medium">{integration.label}</span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.integrations[integration.key as keyof typeof formData.integrations]}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                integrations: { ...prev.integrations, [integration.key]: e.target.checked }
                              }))}
                              className="sr-only peer"
                              disabled={loading}
                            />
                            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:ring-blue-500/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50" />
                          </label>
                        </div>
                      ))}
                    </div>
                  </PanelErrorBoundary>

                  <h3 className="font-medium mt-6">Version Control</h3>
                  
                  <PanelErrorBoundary panelName="VCS Integrations">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'github', label: 'GitHub',  icon: SiGithub},
                        { key: 'gitlab', label: 'GitLab',  icon: SiGitlab},
                      ].map((integration) => (
                        <div key={integration.key} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <integration.icon className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <span className="font-medium">{integration.label}</span>
                              <p className="text-xs text-muted-foreground">Auto-create repository</p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.integrations[integration.key as keyof typeof formData.integrations]}
                              onChange={(e) => {
                                setFormData(prev => ({
                                  ...prev,
                                  integrations: { ...prev.integrations, [integration.key]: e.target.checked },
                                  settings: { ...prev.settings, autoCreateRepository: e.target.checked }
                                }));
                              }}
                              className="sr-only peer"
                              disabled={loading}
                            />
                            <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:ring-blue-500/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50" />
                          </label>
                        </div>
                      ))}
                    </div>
                  </PanelErrorBoundary>
                </div>
              )}

              {/* Review Step */}
              {currentStep === "review" && (
                <div className="space-y-6">
                  <PanelErrorBoundary panelName="Review Summary">
                    <div className="bg-muted rounded-lg p-6 space-y-4">
                      <h3 className="font-semibold text-lg">Workspace Summary</h3>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-muted-foreground">Name</span>
                          <p className="font-medium">{formData.name}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Template</span>
                          <p className="font-medium capitalize">{formData.template.replace('-', ' ')}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Visibility</span>
                          <p className="font-medium capitalize">{formData.visibility}</p>
                        </div>
                        <div>
                          <span className="text-sm text-muted-foreground">Team Size</span>
                          <p className="font-medium">{formData.teamSize}</p>
                        </div>
                      </div>

                      {formData.description && (
                        <div>
                          <span className="text-sm text-muted-foreground">Description</span>
                          <p className="font-medium">{formData.description}</p>
                        </div>
                      )}

                      {formData.industryTags.length > 0 && (
                        <div>
                          <span className="text-sm text-muted-foreground">Industry</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {formData.industryTags.map(tag => (
                              <span key={tag} className="text-xs bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {formData.allowedDomains.length > 0 && (
                        <div>
                          <span className="text-sm text-muted-foreground">Allowed Domains</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {formData.allowedDomains.map(d => (
                              <span key={d} className="text-xs bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">@{d}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.values(formData.integrations).some(v => v) && (
                        <div>
                          <span className="text-sm text-muted-foreground">Integrations</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(formData.integrations).map(([key, enabled]) => 
                              enabled ? (
                                <span key={key} className="text-xs bg-green-100 dark:bg-green-500/15 text-green-800 dark:text-green-300 px-2 py-1 rounded capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </span>
                              ) : null
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </PanelErrorBoundary>

                  {/* Onboarding Tour Toggle */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-medium">Show Onboarding Tour</h3>
                      <p className="text-sm text-muted-foreground">Display a guided tour when you first visit the workspace</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.settings.enableTour}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          settings: { ...prev.settings, enableTour: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:ring-blue-500/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>
                </div>
              )}

              {/* Network Offline Alert */}
              {!isOnline && (
                <div className="rounded-md bg-yellow-50 dark:bg-yellow-500/10 p-3 text-sm text-yellow-800 dark:text-yellow-300">
                  ⚠️ Internet disconnected. Please check your connection.
                </div>
              )}

              {errors.general && (
                <div className="rounded-md bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-300">
                  {errors.general}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-3">
                  {currentStep !== "basic" && (
                    <button
                      type="button"
                      onClick={prevStep}
                      className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                      disabled={loading}
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
                
                {currentStep === "review" ? (
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    disabled={!isOnline || loading || (userQuota && userQuota.used >= userQuota.max)}
                  >
                    {loading && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    )}
                    {loading ? "Creating..." : "Create Workspace"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={!canProceedToStep(currentStep === "basic" ? "security" : currentStep === "security" ? "integrations" : "review") || loading}
                  >
                    Next
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right Column - Hero Banner */}
          <div className="hidden lg:block bg-muted p-6 border-l">
            <WorkspaceHeroBanner />
          </div>
        </div>
      </div>
    </div>
  );
}
