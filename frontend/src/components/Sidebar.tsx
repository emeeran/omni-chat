import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Settings, MessageSquare, Plus, ChevronDown, ChevronUp,
  FileText, Search, Bot, Sliders, Mic, Loader2,
  Redo, Save, Upload, Trash2, Download, X
} from 'lucide-react';
import { ChatSummary, getProviders, getModels, getPersonas, Provider, Model } from '@/lib/api';
import SettingsPanel from './SettingsPanel';

// Define the structure for default settings
interface DefaultSettings {
  provider: string;
  model: string;
  persona: string;
  maxTokens: number;
}

type SidebarProps = {
  chats: ChatSummary[];
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onSaveChat: (chatId: string) => void;
  onExportChat: (chatId: string) => void;
  onRetryChat: (chatId: string) => void;
};

export default function Sidebar({ chats, onNewChat, onChatSelect, onDeleteChat, onSaveChat, onExportChat, onRetryChat }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState('Chat');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [persona, setPersona] = useState('Friendly Assistant');
  const [maxTokens, setMaxTokens] = useState(50);
  const [temperature, setTemperature] = useState(50);
  const [audioResponse, setAudioResponse] = useState(false);
  const router = useRouter();

  // API data states
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [personas, setPersonas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);

  const pathname = usePathname();

  // Extract the current chat ID from the path
  const currentChatId = pathname.startsWith('/chat/')
    ? pathname.split('/').pop()
    : '';

  // Close drawer when collapsed
  useEffect(() => {
    if (collapsed) {
      setDrawerOpen(false);
    }
  }, [collapsed]);

  // Load saved defaults
  useEffect(() => {
    try {
      const savedDefaults = localStorage.getItem('omniChatDefaults');
      if (savedDefaults) {
        const defaults: DefaultSettings = JSON.parse(savedDefaults);

        // Apply saved defaults if available
        if (defaults.provider) {
          setProvider(defaults.provider);
        }
        if (defaults.model) {
          setModel(defaults.model);
        }
        if (defaults.persona) {
          setPersona(defaults.persona);
        }
        if (defaults.maxTokens) {
          // Convert to scale of 0-100 for the UI slider
          const normalizedTokens = Math.min(100, Math.max(0, Math.floor((defaults.maxTokens / 8000) * 100)));
          setMaxTokens(normalizedTokens);
        }
      }
    } catch (error) {
      console.error('Error loading saved defaults:', error);
    }
  }, []);

  // Fetch providers, models, and personas when component mounts
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const providersData = await getProviders();
        setProviders(providersData);

        // Check for saved defaults first
        const savedDefaults = localStorage.getItem('omniChatDefaults');
        let defaultProviderId = 'openai'; // Default fallback

        if (savedDefaults) {
          const defaults: DefaultSettings = JSON.parse(savedDefaults);
          // Check if the saved provider exists in our loaded providers
          const providerExists = providersData.some(p => p.id === defaults.provider);
          if (providerExists) {
            defaultProviderId = defaults.provider;
            setProvider(defaults.provider);
          }
        }

        // If no saved defaults or provider not found, use API default
        if (!savedDefaults || !providersData.some(p => p.id === provider)) {
          // Set default provider if available
          const defaultProvider = providersData.find(p => p.default) || providersData[0];
          if (defaultProvider) {
            defaultProviderId = defaultProvider.id;
            setProvider(defaultProvider.id);
          }
        }

        // Fetch models for the selected provider
        const modelsData = await getModels(defaultProviderId);
        setModels(modelsData);

        // Check for saved default model
        if (savedDefaults) {
          const defaults: DefaultSettings = JSON.parse(savedDefaults);
          // Only use saved model if it belongs to the selected provider
          const modelExists = modelsData.some(m => m.id === defaults.model);
          if (modelExists) {
            setModel(defaults.model);
          } else if (modelsData.length > 0) {
            // Fallback to first available model
            setModel(modelsData[0].id);
          }
        } else if (modelsData.length > 0) {
          // No saved defaults, use first model
          setModel(modelsData[0].id);
        }

        // Fetch personas
        const personasData = await getPersonas();
        const personaNames = personasData.map(p => typeof p === 'string' ? p : p.name);
        setPersonas(personaNames);

        // Check for saved default persona
        if (savedDefaults) {
          const defaults: DefaultSettings = JSON.parse(savedDefaults);
          // Check if saved persona exists
          if (personaNames.includes(defaults.persona)) {
            setPersona(defaults.persona);
          } else if (personaNames.length > 0) {
            // Fallback to first persona
            setPersona(personaNames[0]);
          }
        } else if (personaNames.length > 0) {
          // No saved defaults, use first persona
          setPersona(personaNames[0]);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Fetch models when provider changes
  useEffect(() => {
    async function fetchModelsForProvider() {
      if (!provider) return;

      setLoadingModels(true);
      try {
        const modelsData = await getModels(provider);
        setModels(modelsData);

        // Try to keep the current model if it's compatible with new provider
        const currentModelCompatible = modelsData.some(m => m.id === model);

        if (!currentModelCompatible) {
          // Check for saved default
          const savedDefaults = localStorage.getItem('omniChatDefaults');
          if (savedDefaults) {
            const defaults: DefaultSettings = JSON.parse(savedDefaults);
            // Only use saved model if it belongs to the selected provider
            const savedModelCompatible = modelsData.some(m => m.id === defaults.model);

            if (savedModelCompatible) {
              setModel(defaults.model);
            } else if (modelsData.length > 0) {
              // Default to first model
              setModel(modelsData[0].id);
            }
          } else if (modelsData.length > 0) {
            // No saved defaults, use first model
            setModel(modelsData[0].id);
          }
        }
      } catch (error) {
        console.error(`Error fetching models for ${provider}:`, error);
      } finally {
        setLoadingModels(false);
      }
    }

    fetchModelsForProvider();
  }, [provider]);

  // Get the currently selected provider name
  const selectedProviderName = providers.find(p => p.id === provider)?.name || '';

  // Get the currently selected model name
  const selectedModelName = models.find(m => m.id === model)?.name || '';

  // Handle provider change
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProviderId = e.target.value;
    setProvider(newProviderId);
    // The model will be updated automatically by the useEffect
  };

  // Handle retry button click - resubmit the last message
  const handleRetry = () => {
    if (currentChatId) onRetryChat(currentChatId);
  };

  // Handle save button click
  const handleSave = () => {
    if (currentChatId) onSaveChat(currentChatId);
  };

  // Handle load button click
  const handleLoad = () => {
    // This could open a modal or dialog to select a chat to load
    alert('Load chat functionality will be implemented here');
  };

  // Handle delete button click
  const handleDelete = () => {
    if (currentChatId && confirm('Are you sure you want to delete this chat?')) onDeleteChat(currentChatId);
  };

  // Handle export button click
  const handleExport = () => {
    if (currentChatId) onExportChat(currentChatId);
  };

  // Handle voice input button click
  const handleVoiceInput = () => {
    // Voice input functionality
    alert('Voice input functionality will be implemented here');
  };

  // Handle sliders button click for quick settings access
  const handleSlidersClick = () => {
    // Toggle settings drawer when in collapsed mode
    if (collapsed) {
      setCollapsed(false);
      setTimeout(() => setDrawerOpen(true), 300);
    } else {
      setDrawerOpen(true);
    }
  };

  // Handle new chat with defaults
  const handleNewChatWithDefaults = () => {
    // Call the onNewChat function from props which should create a new chat
    onNewChat();

    // Apply default settings if available
    try {
      const savedDefaults = localStorage.getItem('omniChatDefaults');
      if (savedDefaults) {
        // In a real implementation, you would apply these defaults to the new chat
        console.log('Creating new chat with saved defaults:', JSON.parse(savedDefaults));
      }
    } catch (error) {
      console.error('Error applying defaults to new chat:', error);
    }
  };

  return (
    <div className="relative">
      {/* Settings drawer */}
      {drawerOpen && !collapsed && (
        <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-all duration-300" onClick={() => setDrawerOpen(false)}>
          <div
            className="absolute left-72 top-0 w-80 h-full bg-white/80 dark:bg-dark-800/80 shadow-2xl rounded-2xl p-4 overflow-y-auto backdrop-blur-lg border border-gray-200 dark:border-dark-700 transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Settings</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              <>
                {/* Mode */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Mode</label>
                  <div className="relative">
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 rounded-md text-sm focus:ring-1 focus:ring-primary-500 appearance-none"
                    >
                      <option value="Chat">Chat</option>
                      <option value="RAG">RAG</option>
                      <option value="Image">Image</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                </div>

                {/* Provider */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Provider</label>
                  <div className="relative">
                    <select
                      value={provider}
                      onChange={handleProviderChange}
                      className="w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 rounded-md text-sm focus:ring-1 focus:ring-primary-500 appearance-none"
                    >
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                </div>

                {/* Model */}
                <div className="mb-3">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Model</label>
                    {loadingModels && (
                      <Loader2 className="animate-spin h-4 w-4 text-primary-500" />
                    )}
                  </div>
                  <div className="relative">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className={`w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 rounded-md text-sm focus:ring-1 focus:ring-primary-500 appearance-none ${loadingModels ? 'opacity-70' : ''}`}
                      disabled={loadingModels}
                    >
                      {models.length > 0 ? (
                        models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.isPreview && "(Preview)"}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>No models available</option>
                      )}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                  {models.length === 0 && !loadingModels && (
                    <p className="mt-1 text-xs text-red-500">No models available for this provider</p>
                  )}
                </div>

                {/* Persona */}
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Persona</label>
                  <div className="relative">
                    <select
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 rounded-md text-sm focus:ring-1 focus:ring-primary-500 appearance-none"
                    >
                      {personas.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
                </div>

                {/* Max Tokens */}
                <div className="mb-3">
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Max.Tokens</label>
                    <span className="text-sm text-gray-500">{Math.floor((maxTokens / 100) * 8000)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-dark-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">Min</span>
                    <span className="text-xs text-gray-500">Max</span>
                  </div>
                </div>

                {/* Quick Token Presets */}
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setMaxTokens(Math.floor((2000 / 8000) * 100))}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-700 rounded-md hover:bg-gray-200 dark:hover:bg-dark-600"
                  >
                    2000
                  </button>
                  <button
                    onClick={() => setMaxTokens(Math.floor((5000 / 8000) * 100))}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800/40"
                  >
                    5000
                  </button>
                  <button
                    onClick={() => setMaxTokens(Math.floor((8000 / 8000) * 100))}
                    className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-700 rounded-md hover:bg-gray-200 dark:hover:bg-dark-600"
                  >
                    8000
                  </button>
                </div>

                {/* Temperature */}
                <div className="mb-4">
                  <div className="flex justify-between">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Temperature</label>
                    <span className="text-sm text-gray-500">{temperature / 100}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={temperature}
                    onChange={(e) => setTemperature(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-dark-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-gray-500">Precise</span>
                    <span className="text-xs text-gray-500">Creative</span>
                  </div>
                </div>

                {/* Audio Response */}
                <div className="mb-5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Audio Response</label>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setAudioResponse(false)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${!audioResponse ? 'bg-gray-200 dark:bg-gray-600' : 'bg-white dark:bg-dark-700'
                          }`}
                      >
                        <span className="text-sm">Off</span>
                      </button>
                      <button
                        onClick={() => setAudioResponse(true)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${audioResponse ? 'bg-gray-200 dark:bg-gray-600' : 'bg-white dark:bg-dark-700'
                          }`}
                      >
                        <span className="text-sm">On</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Save as Defaults */}
                <div className="mb-4 pt-2 border-t border-gray-200 dark:border-dark-700">
                  <button
                    onClick={() => {
                      // Save current settings as defaults
                      const defaults: DefaultSettings = {
                        provider,
                        model,
                        persona,
                        maxTokens: Math.floor((maxTokens / 100) * 8000) // Convert to actual token count
                      };
                      localStorage.setItem('omniChatDefaults', JSON.stringify(defaults));
                      alert('Settings saved as defaults for new chats');
                    }}
                    className="w-full py-2 bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-md hover:bg-primary-200 dark:hover:bg-primary-800/30 text-sm flex items-center justify-center"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save as Default Settings
                  </button>
                </div>

                {/* Model Capabilities */}
                {models.find(m => m.id === model)?.capabilities?.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Capabilities</h3>
                    <div className="flex flex-wrap gap-2">
                      {models.find(m => m.id === model)?.capabilities.map(capability => (
                        <span key={capability} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                          {capability}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Provider Link */}
                {providers.find(p => p.id === provider)?.website && (
                  <div className="mt-5 mb-3 text-center">
                    <a
                      href={providers.find(p => p.id === provider)?.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View provider details
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className={`h-screen flex flex-col border-r border-gray-200 dark:border-dark-700 bg-white/70 dark:bg-dark-900/80 backdrop-blur-lg shadow-xl rounded-r-3xl transition-all duration-300 ${collapsed ? 'w-16' : 'w-72'}`}>
        {/* Toggle button for mobile/collapsible sidebar */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 bg-gradient-to-br from-white/80 via-gray-100/80 to-gray-200/80 dark:from-dark-800 dark:to-dark-900 border border-gray-200 dark:border-dark-700 rounded-full p-1 shadow-lg z-10 hover:scale-110 transition-transform duration-200"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {/* Header - Persona */}
        <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex justify-center items-center bg-gradient-to-r from-blue-50/60 via-white/60 to-purple-50/60 dark:from-dark-900/60 dark:to-dark-800/60 rounded-t-3xl">
          {!collapsed && (
            <h1 className="text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100 font-sans">Persona</h1>
          )}
          {collapsed && (
            <Bot className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          )}
        </div>

        {/* Main sidebar content with scroll */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-dark-700 scrollbar-track-transparent">
          {!collapsed && (
            <div className="p-4 pt-3">
              <h2 className="font-bold text-gray-700 dark:text-gray-300 mb-3">Settings:</h2>

              {/* Open settings drawer button */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-full mb-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md flex items-center justify-center hover:bg-gray-50 dark:hover:bg-dark-700"
              >
                <Settings className="w-4 h-4 mr-2" />
                <span>Open Settings</span>
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>

              {/* Model info */}
              <div className="p-3 mb-4 border border-gray-200 dark:border-dark-600 rounded-md text-center">
                {loadingModels ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="animate-spin h-4 w-4 text-primary-500" />
                    <p className="text-sm text-gray-500">Loading models...</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedProviderName} | {selectedModelName}
                    {models.find(m => m.id === model)?.isPreview && (
                      <span className="ml-1 px-1.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs rounded-full">Preview</span>
                    )}
                  </p>
                )}
              </div>
            </div>
          )}

          {collapsed && (
            <div className="flex flex-col items-center py-4 space-y-4">
              <button
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md"
                onClick={() => {
                  setCollapsed(false);
                  setTimeout(() => setDrawerOpen(true), 300);
                }}
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md"
                onClick={handleSlidersClick}
              >
                <Sliders className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md"
                onClick={handleVoiceInput}
              >
                <Mic className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          )}
        </div>

        {/* Action buttons - moved to bottom */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-200 dark:border-dark-700 bg-gradient-to-t from-white/80 via-gray-50/80 to-blue-50/80 dark:from-dark-900/80 dark:to-dark-800/80 rounded-b-3xl shadow-lg">
            {/* Action buttons - first row */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button
                className="py-2 px-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:to-pink-600 text-white text-sm rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                onClick={handleRetry}
              >
                <Redo className="w-4 h-4 mr-1" />
                <span>Retry</span>
              </button>
              <button
                onClick={handleNewChatWithDefaults}
                className="py-2 px-1 bg-gradient-to-br from-green-400 via-blue-400 to-purple-400 hover:from-green-500 hover:to-purple-500 text-white text-sm rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
              >
                <Plus className="w-4 h-4 mr-1" />
                <span>New</span>
              </button>
              <button
                className="py-2 px-1 bg-gradient-to-br from-yellow-400 via-orange-400 to-pink-400 hover:from-yellow-500 hover:to-pink-500 text-white text-sm rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                onClick={handleSave}
              >
                <Save className="w-4 h-4 mr-1" />
                <span>Save</span>
              </button>
            </div>

            {/* Action buttons - second row */}
            <div className="grid grid-cols-3 gap-2">
              <button
                className="py-2 px-1 bg-gradient-to-br from-cyan-400 via-blue-400 to-purple-400 hover:from-cyan-500 hover:to-purple-500 text-white text-sm rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                onClick={handleLoad}
              >
                <Upload className="w-4 h-4 mr-1" />
                <span>Load</span>
              </button>
              <button
                className="py-2 px-1 bg-gradient-to-br from-red-400 via-pink-400 to-yellow-400 hover:from-red-500 hover:to-yellow-500 text-white text-sm rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                <span>Delete</span>
              </button>
              <button
                className="py-2 px-1 bg-gradient-to-br from-blue-400 via-green-400 to-yellow-400 hover:from-blue-500 hover:to-yellow-500 text-white text-sm rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-1" />
                <span>Export</span>
              </button>
            </div>
          </div>
        )}

        {/* Collapsed action buttons at bottom */}
        {collapsed && (
          <div className="flex flex-col items-center py-4 border-t border-gray-200 dark:border-dark-700 space-y-4">
            <button
              onClick={handleNewChatWithDefaults}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md"
            >
              <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </button>
            <button
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md"
              onClick={handleDelete}
            >
              <Trash2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}