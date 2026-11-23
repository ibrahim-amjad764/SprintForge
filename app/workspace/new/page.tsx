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
import UpgradePrompt from "@/components/billing/UpgradePrompt";
import { OAuthSimulator } from "@/components/ui/OAuthSimulator";
import { useDebounceSlugValidation } from "@/hooks/useDebounceSlugValidation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { Sparkles, Users, Zap, Shield, Globe, Calendar,  X, AlertCircle, ArrowLeft, Check, Edit } from "lucide-react";
import { FaGithub, FaGitlab } from "react-icons/fa";

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
  integrationConfig: {
    github: {
      repoTarget: 'new' | 'existing';
      existingRepo?: string;
    };
    gitlab: {
      repoTarget: 'new' | 'existing';
      existingRepo?: string;
    };
    slack: {
      scopes: string[];
    };
    teams: {
      scopes: string[];
    };
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
  integrationConfig: {
    github: {
      repoTarget: 'new',
      existingRepo: '',
    },
    gitlab: {
      repoTarget: 'new',
      existingRepo: '',
    },
    slack: {
      scopes: [],
    },
    teams: {
      scopes: [],
    },
  },
  settings: {
    enableTour: false,
    autoCreateRepository: false,
    idpGroupMapping: false,
  },
};

export default function NewWorkspacePage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<"basic" | "security" | "integrations" | "review">("basic");
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [loading, setLoading] = useState(false);
  const isOnline = useOnlineStatus();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showDraftAlert, setShowDraftAlert] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [oauthSimulator, setOAuthSimulator] = useState<{ isOpen: boolean; provider: 'GitHub' | 'Slack' | 'GitLab' | 'Microsoft Teams' }>({ isOpen: false, provider: 'GitHub' });
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [checkoutNotice, setCheckoutNotice] = useState<'success' | 'cancelled' | null>(null);
  const isSubmittingRef = useRef(false);

  // Returning from Stripe Checkout — the workspace draft auto-restores
  // from localStorage so the user can resubmit without re-entering data.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    if (checkout === 'success' || checkout === 'cancelled') {
      params.delete('checkout');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
      const notice = checkout;
      const id = requestAnimationFrame(() => setCheckoutNotice(notice));
      return () => cancelAnimationFrame(id);
    }
  }, []);

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

  // Update slug when name changes
  const slugifiedName = formData.name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  const [prevSlugifiedName, setPrevSlugifiedName] = useState(slugifiedName);
  if (slugifiedName !== prevSlugifiedName) {
    setPrevSlugifiedName(slugifiedName);
    setSlug(slugifiedName);
    setFormData(prev => ({ ...prev, slug: slugifiedName }));
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

  // Integration toggle handler with OAuth simulator
  const handleIntegrationToggle = (key: keyof typeof formData.integrations, provider: 'GitHub' | 'Slack' | 'GitLab' | 'Microsoft Teams') => {
    const newValue = !formData.integrations[key];
    
    setFormData(prev => ({
      ...prev,
      integrations: { ...prev.integrations, [key]: newValue },
    }));

    // Trigger OAuth simulator for OAuth providers when enabling
    if (newValue && (key === 'github' || key === 'gitlab' || key === 'slack' || key === 'teams')) {
      setOAuthSimulator({ isOpen: true, provider });
    }
  };

  const handleOAuthComplete = () => {
    setOAuthSimulator({ isOpen: false, provider: 'GitHub' });
  };

  // Step validation guardrails
  const canProceedToStep = (step: string): boolean => {
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
        }),
      });

      if (response.success) {
        // Clear draft before routing
        localStorage.removeItem('workspaceDraft');
        router.push(`/workspace/${response.data._id}`);
      } else {
        setErrors({ general: response.message || "Failed to create workspace" });
      }
    } catch (err) {
      const apiErr = err as { status?: number; code?: string };
      if (apiErr.code === 'WORKSPACE_LIMIT_REACHED' || apiErr.status === 403) {
        setShowUpgrade(true);
      } else {
        setErrors({ general: "An error occurred while creating workspace" });
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const steps = [
    { id: "basic", label: "Basic Profile", icon: Globe },
    { id: "security", label: "Security & Domain", icon: Shield },
    { id: "integrations", label: "VCS & Chat", icon: Zap },
    { id: "review", label: "Review", icon: Users },
  ] as const;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sprintforge.com';

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Create New Workspace</h1>
              <p className="text-sm text-muted-foreground">Set up your collaborative workspace in minutes</p>
            </div>
          </div>

          {/* Draft Alert */}
          {showDraftAlert && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/40 rounded-lg mt-4">
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
          <div className="flex items-center justify-between mt-6">
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
      </div>

      {/* Checkout return notice */}
      {checkoutNotice && (
        <div className={`mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8 ${checkoutNotice === 'success' ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300' : 'rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground'}`}>
          {checkoutNotice === 'success'
            ? 'Pro activated — your workspace draft is ready. Review and create your workspace below.'
            : 'Checkout cancelled — no charge was made. You can try again anytime.'}
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-card rounded-xl shadow-sm border p-6 space-y-6">
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
                        { key: 'slack', label: 'Slack', icon: Zap, provider: 'Slack' as const },
                        { key: 'teams', label: 'Microsoft Teams', icon: Users, provider: 'Microsoft Teams' as const },
                        { key: 'googleCalendar', label: 'Google Calendar', icon: Calendar, provider: null },
                        { key: 'outlookCalendar', label: 'Outlook Calendar', icon: Calendar, provider: null },
                      ].map((integration) => (
                        <div key={integration.key} className="relative">
                          <div className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                            formData.integrations[integration.key as keyof typeof formData.integrations] ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10' : ''
                          }`}>
                            <div className="flex items-center gap-3">
                              <integration.icon className="w-5 h-5 text-muted-foreground" />
                              <span className="font-medium">{integration.label}</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.integrations[integration.key as keyof typeof formData.integrations]}
                                onChange={(e) => integration.provider ? handleIntegrationToggle(integration.key as any, integration.provider) : setFormData(prev => ({
                                  ...prev,
                                  integrations: { ...prev.integrations, [integration.key]: e.target.checked }
                                }))}
                                className="sr-only peer"
                                disabled={loading}
                              />
                              <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:ring-blue-500/40 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-card after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 disabled:opacity-50" />
                            </label>
                          </div>

                          {/* Floating Notification Badge */}
                          {formData.integrations[integration.key as keyof typeof formData.integrations] && (
                            <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-md animate-pulse">
                              <Check className="w-3 h-3" />
                              {integration.key === 'slack' || integration.key === 'teams' ? 'Connected' : 'Active'}
                            </div>
                          )}

                          {/* Webhook Notification Scopes for Slack/Teams */}
                          {(integration.key === 'slack' || integration.key === 'teams') && formData.integrations[integration.key] && (
                            <div className="mt-3 p-4 bg-muted rounded-lg border border-border space-y-3">
                              <h4 className="text-sm font-medium text-foreground">Notification Scopes</h4>
                              <div className="grid grid-cols-1 gap-2">
                                {[
                                  { label: 'Notify on Task Completed', value: 'task-completed' },
                                  { label: 'Notify on Sprint Status Changed', value: 'sprint-status' },
                                  { label: 'Notify on Deployment Status Alerts', value: 'deployment-alerts' },
                                ].map((scope) => (
                                  <label key={scope.value} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={formData.integrationConfig?.[integration.key === 'slack' ? 'slack' : 'teams']?.scopes?.includes(scope.value) || false}
                                      onChange={(e) => {
                                        const configKey = integration.key === 'slack' ? 'slack' : 'teams';
                                        const currentScopes = formData.integrationConfig?.[configKey]?.scopes || [];
                                        const newScopes = e.target.checked
                                          ? [...currentScopes, scope.value]
                                          : currentScopes.filter(s => s !== scope.value);
                                        setFormData(prev => ({
                                          ...prev,
                                          integrationConfig: {
                                            ...prev.integrationConfig,
                                            [configKey]: { scopes: newScopes },
                                          },
                                        }));
                                      }}
                                      className="w-4 h-4 rounded border-border text-blue-600 dark:text-blue-300 focus:ring-blue-500"
                                      disabled={loading}
                                    />
                                    <span className="text-sm text-muted-foreground">{scope.label}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </PanelErrorBoundary>

                  <h3 className="font-medium mt-6">Version Control</h3>
                  
                  <PanelErrorBoundary panelName="VCS Integrations">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { key: 'github', label: 'GitHub', icon: FaGithub, provider: 'GitHub' as const },
                        { key: 'gitlab', label: 'GitLab', icon: FaGitlab, provider: 'GitLab' as const },
                      ].map((integration) => (
                        <div key={integration.key} className="relative">
                          <div className={`flex items-center justify-between p-4 border rounded-lg transition-all ${
                            formData.integrations[integration.key as keyof typeof formData.integrations] ? 'border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10' : ''
                          }`}>
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
                                  handleIntegrationToggle(integration.key as any, integration.provider);
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

                          {/* Floating Notification Badge */}
                          {formData.integrations[integration.key as keyof typeof formData.integrations] && (
                            <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-md animate-pulse">
                              <Check className="w-3 h-3" />
                              Repo auto-provisioning enabled
                            </div>
                          )}

                          {/* Repository Target Configuration Dropdown */}
                          {formData.integrations[integration.key as keyof typeof formData.integrations] && (
                            <div className="mt-3 p-4 bg-muted rounded-lg border border-border space-y-3">
                              <h4 className="text-sm font-medium text-foreground">Repository Target</h4>
                              <select
                                value={formData.integrationConfig?.[integration.key === 'github' ? 'github' : 'gitlab']?.repoTarget || 'new'}
                                onChange={(e) => {
                                  const configKey = integration.key === 'github' ? 'github' : 'gitlab';
                                  setFormData(prev => ({
                                    ...prev,
                                    integrationConfig: {
                                      ...prev.integrationConfig,
                                      [configKey]: { 
                                        ...prev.integrationConfig?.[configKey],
                                        repoTarget: e.target.value as 'new' | 'existing',
                                      },
                                    },
                                  }));
                                }}
                                className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                disabled={loading}
                              >
                                <option value="new">Create New Private Repository</option>
                                <option value="existing">Link Existing Organization Repository</option>
                              </select>

                              {formData.integrationConfig?.[integration.key === 'github' ? 'github' : 'gitlab']?.repoTarget === 'existing' && (
                                <div>
                                  <label className="block text-xs text-muted-foreground mb-1">Search Repository</label>
                                  <input
                                    type="text"
                                    value={formData.integrationConfig?.[integration.key === 'github' ? 'github' : 'gitlab']?.existingRepo || ''}
                                    onChange={(e) => {
                                      const configKey = integration.key === 'github' ? 'github' : 'gitlab';
                                      setFormData(prev => ({
                                        ...prev,
                                        integrationConfig: {
                                          ...prev.integrationConfig,
                                          [configKey]: { 
                                            ...prev.integrationConfig?.[configKey],
                                            existingRepo: e.target.value,
                                          },
                                        },
                                      }));
                                    }}
                                    placeholder="Search organization repositories..."
                                    className="w-full rounded-md border border-border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    disabled={loading}
                                  />
                                </div>
                              )}
                            </div>
                          )}
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
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">Workspace Summary</h3>
                        <button
                          type="button"
                          onClick={() => setCurrentStep("basic")}
                          className="text-sm text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:text-blue-300 flex items-center gap-1"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                      </div>
                      
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
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Allowed Domains</span>
                            <button
                              type="button"
                              onClick={() => setCurrentStep("security")}
                              className="text-xs text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:text-blue-300 flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" />
                              Edit
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {formData.allowedDomains.map(d => (
                              <span key={d} className="text-xs bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 px-2 py-1 rounded">@{d}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {Object.values(formData.integrations).some(v => v) && (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Integrations</span>
                            <button
                              type="button"
                              onClick={() => setCurrentStep("integrations")}
                              className="text-xs text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:text-blue-300 flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" />
                              Edit
                            </button>
                          </div>
                          <div className="space-y-2 mt-2">
                            {Object.entries(formData.integrations).map(([key, enabled]) => 
                              enabled ? (
                                <div key={key} className="text-xs bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/40 px-3 py-2 rounded">
                                  <span className="font-medium text-green-800 dark:text-green-300 capitalize">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                  </span>
                                  
                                  {/* GitHub/GitLab Repository Details */}
                                  {(key === 'github' || key === 'gitlab') && formData.integrationConfig?.[key]?.repoTarget && (
                                    <div className="mt-1 text-green-700 dark:text-green-300">
                                      Target: {formData.integrationConfig[key].repoTarget === 'new' 
                                        ? 'Create New Private Repository' 
                                        : `Link Existing: ${formData.integrationConfig[key].existingRepo || 'Search repository...'}`
                                      }
                                    </div>
                                  )}

                                  {/* Slack/Teams Notification Scopes */}
                                  {(key === 'slack' || key === 'teams') && formData.integrationConfig?.[key]?.scopes?.length > 0 && (
                                    <div className="mt-1 text-green-700 dark:text-green-300">
                                      Notifying on: {formData.integrationConfig[key].scopes
                                        .map(s => s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
                                        .join(', ')}
                                    </div>
                                  )}
                                </div>
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
                      className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={loading}
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
                
                {currentStep === "review" ? (
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={!isOnline || loading}
                  >
                    {loading && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    )}
                    {loading ? "Creating Workspace..." : "Create Workspace"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!canProceedToStep(currentStep === "basic" ? "security" : currentStep === "security" ? "integrations" : "review") || loading}
                  >
                    Next
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right Column - Hero Banner */}
          <div className="hidden lg:block">
            <WorkspaceHeroBanner />
          </div>
        </div>
      </div>

      {/* OAuth Simulator Overlay */}
      <OAuthSimulator
        isOpen={oauthSimulator.isOpen}
        provider={oauthSimulator.provider}
        onComplete={handleOAuthComplete}
      />

      {/* Plan-limit upgrade prompt */}
      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        returnTo="/workspace/new"
      />
    </div>
  );
} 