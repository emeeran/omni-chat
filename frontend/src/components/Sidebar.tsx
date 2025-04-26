import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Settings, MessageSquare, Plus, ChevronDown,
  Search, Bot, Sliders, Mic, Loader2,
  Redo, Save, Upload, Trash2, Download, X
} from 'lucide-react';
import { ChatSummary, getProviders, getModels, getPersonas, Provider, Model } from '@/lib/api';
import { SidebarHeader } from './SidebarHeader';

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

// Extract ChatList to a separate memoized component to prevent re-renders
const ChatList = memo(({
  chats,
  currentChatId,
  onChatSelect,
  onDeleteChat
}: {
  chats: ChatSummary[];
  currentChatId: string;
  onChatSelect: (id: string) => void;
  onDeleteChat: (id: string) => void;
}) => {
  if (chats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No chats yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-2">
      {chats.map((chat) => (
        <div
          key={chat.chat_id}
          className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${currentChatId === chat.chat_id
            ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200'
            : 'hover:bg-gray-100 dark:hover:bg-dark-800 text-gray-700 dark:text-gray-300'
            }`}
          onClick={() => onChatSelect(chat.chat_id)}
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            <MessageSquare className="flex-shrink-0 w-5 h-5" />
            <span className="truncate text-sm font-medium">{chat.title || 'New Chat'}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Are you sure you want to delete this chat?')) {
                onDeleteChat(chat.chat_id);
              }
            }}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-dark-700 rounded-full"
          >
            <Trash2 className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      ))}
    </div>
  );
});

ChatList.displayName = 'ChatList';

// Extract SettingsControl to a separate component
const SettingsControl = memo(({
  loading,
  label,
  value,
  options,
  onChange,
  isLoading = false
}: {
  loading: boolean;
  label: string;
  value: string;
  options: Array<{ id?: string; name?: string } | string>;
  onChange: (value: string) => void;
  isLoading?: boolean;
}) => (
  <div className="mb-3">
    <div className="flex justify-between items-center mb-1">
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">{label}</label>
      {isLoading && (
        <Loader2 className="animate-spin h-4 w-4 text-primary-500" />
      )}
    </div>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pl-3 pr-8 py-2 border border-gray-400 dark:border-gray-600 bg-white/90 dark:bg-dark-700/90 rounded-md text-base font-semibold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 appearance-none shadow ${isLoading ? 'opacity-70' : ''}`}
        disabled={loading || isLoading}
      >
        {options.length > 0 ? (
          options.map((option) => {
            const id = typeof option === 'string' ? option : option.id || '';
            const name = typeof option === 'string' ? option : option.name || '';
            return (
              <option key={id} value={id}>{name}</option>
            );
          })
        ) : (
          <option value="" disabled>No options available</option>
        )}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
    </div>
  </div>
));

SettingsControl.displayName = 'SettingsControl';

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

  // Ensure chats is always an array
  const chatsArray = Array.isArray(chats) ? chats : [];

  // API data states
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [personas, setPersonas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);

  const pathname = usePathname();

  // Extract the current chat ID from the path - memoize this
  const currentChatId = pathname.startsWith('/chat/')
    ? pathname.split('/').pop() || ''
    : '';

  // Close drawer when collapsed
  useEffect(() => {
    if (collapsed) {
      setDrawerOpen(false);
    }
  }, [collapsed]);

  // Load saved defaults - memoize with useCallback
  const loadSavedDefaults = useCallback(() => {
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

  // Load saved defaults on mount
  useEffect(() => {
    loadSavedDefaults();
  }, [loadSavedDefaults]);

  // Fetch providers, models, and personas when component mounts
  useEffect(() => {
    const fetchData = async () => {
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
    };

    fetchData();
  }, [provider]);

  // Fetch models when provider changes - memoize with useCallback
  const fetchModelsForProvider = useCallback(async () => {
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
  }, [provider, model]);

  // Update models when provider changes
  useEffect(() => {
    fetchModelsForProvider();
  }, [fetchModelsForProvider]);

  // Filtered chats based on search query - memoize this
  const filteredChats = searchQuery
    ? chatsArray.filter(chat =>
      chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.last_message && chat.last_message.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    : chatsArray;

  // Get the currently selected provider name
  const selectedProviderName = providers.find(p => p.id === provider)?.name || '';

  // Get the currently selected model name
  const selectedModelName = models.find(m => m.id === model)?.name || '';

  // Handle provider change
  const handleProviderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProviderId = e.target.value;
    setProvider(newProviderId);
    // The model will be updated automatically by the useEffect
  }, []);

  // Handle retry button click - resubmit the last message
  const handleRetry = useCallback(() => {
    if (currentChatId) onRetryChat(currentChatId);
  }, [currentChatId, onRetryChat]);

  // Handle save button click
  const handleSave = useCallback(() => {
    if (currentChatId) onSaveChat(currentChatId);
  }, [currentChatId, onSaveChat]);

  // Handle load button click
  const handleLoad = useCallback(() => {
    // This could open a modal or dialog to select a chat to load
    alert('Load chat functionality will be implemented here');
  }, []);

  // Handle delete button click
  const handleDelete = useCallback(() => {
    if (currentChatId && confirm('Are you sure you want to delete this chat?')) {
      onDeleteChat(currentChatId);
    }
  }, [currentChatId, onDeleteChat]);

  // Handle export button click
  const handleExport = useCallback(() => {
    if (currentChatId) onExportChat(currentChatId);
  }, [currentChatId, onExportChat]);

  // Handle voice input button click
  const handleVoiceInput = useCallback(() => {
    // Voice input functionality
    alert('Voice input functionality will be implemented here');
  }, []);

  // Handle sliders button click for quick settings access
  const handleSlidersClick = useCallback(() => {
    // Toggle settings drawer when in collapsed mode
    if (collapsed) {
      setCollapsed(false);
      setTimeout(() => setDrawerOpen(true), 300);
    } else {
      setDrawerOpen(true);
    }
  }, [collapsed]);

  // Handle new chat with defaults
  const handleNewChatWithDefaults = useCallback(() => {
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
  }, [onNewChat]);

  // Handle saving current settings as defaults
  const handleSaveDefaults = useCallback(() => {
    // Save current settings as defaults
    const defaults: DefaultSettings = {
      provider,
      model,
      persona,
      maxTokens: Math.floor((maxTokens / 100) * 8000) // Convert to actual token count
    };
    localStorage.setItem('omniChatDefaults', JSON.stringify(defaults));
    alert('Settings saved as defaults for new chats');
  }, [provider, model, persona, maxTokens]);

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

            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                </div>
              ) : (
                <>
                  {/* Mode */}
                  <SettingsControl
                    loading={loading}
                    label="Mode"
                    value={mode}
                    options={['Chat', 'RAG', 'Image']}
                    onChange={setMode}
                  />

                  {/* Provider */}
                  <SettingsControl
                    loading={loading}
                    label="Provider"
                    value={provider}
                    options={providers}
                    onChange={handleProviderChange}
                  />

                  {/* Model */}
                  <SettingsControl
                    loading={loading}
                    label="Model"
                    value={model}
                    options={models}
                    onChange={setModel}
                    isLoading={loadingModels}
                  />

                  {/* Omni-Chat */}
                  <SettingsControl
                    loading={loading}
                    label="Persona"
                    value={persona}
                    options={personas}
                    onChange={setPersona}
                  />

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
                      onClick={() => setMaxTokens(100)}
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
                      onClick={handleSaveDefaults}
                      className="w-full py-2 bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 rounded-md hover:bg-primary-200 dark:hover:bg-primary-800/30 text-sm flex items-center justify-center"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save as Default Settings
                    </button>
                  </div>

                  {/* Model Capabilities */}
                  {(() => {
                    const selectedModel = models.find(m => m.id === model);
                    return selectedModel && Array.isArray(selectedModel.capabilities) && selectedModel.capabilities.length > 0;
                  })() && (
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

        {/* Header - Omni-Chat */}
        <SidebarHeader collapsed={collapsed} />

        {/* Main sidebar content with scroll */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-dark-700 scrollbar-track-transparent">
          {!collapsed && (
            <div className="p-4 pt-3">
              <h2 className="font-bold text-gray-700 dark:text-gray-300 mb-3">Settings:</h2>

              {/* Open settings drawer button */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="w-full mb-3 py-2 border border-gray-400 dark:border-gray-600 rounded-md flex items-center justify-center bg-white/90 dark:bg-dark-700/90 text-base font-semibold text-gray-800 dark:text-gray-100 shadow hover:bg-gray-100 dark:hover:bg-dark-600 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                <Settings className="w-5 h-5 mr-2 text-primary-600 dark:text-primary-400" />
                <span>Open Settings</span>
                <ChevronRight className="w-5 h-5 ml-2 text-gray-500 dark:text-gray-400" />
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
                  </p>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-dark-600 rounded-md leading-5 bg-white dark:bg-dark-800 placeholder-gray-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                  placeholder="Search chats..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <h2 className="font-bold text-gray-700 dark:text-gray-300 mb-2">Chats:</h2>

              {/* Chat List */}
              <ChatList
                chats={filteredChats}
                currentChatId={currentChatId}
                onChatSelect={onChatSelect}
                onDeleteChat={onDeleteChat}
              />
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
                className="py-2 px-1 bg-gradient-to-br from-blue-400 via-green-400 to-cyan-400 hover:from-blue-500 hover:to-cyan-500 text-white text-sm rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                onClick={handleNewChatWithDefaults}
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
              <button
                className="py-2 px-1 bg-gradient-to-br from-cyan-400 via-blue-400 to-purple-400 hover:from-cyan-500 hover:to-purple-500 text-white text-sm rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                onClick={handleLoad}
              >
                <Upload className="w-4 h-4 mr-1" />
                <span>Load</span>
              </button>
            </div>

            {/* Action buttons - second row */}
            <div className="grid grid-cols-3 gap-2">
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
              <button
                className="py-2 px-1 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:to-pink-600 text-white text-sm rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-150"
                onClick={handleRetry}
              >
                <Redo className="w-4 h-4 mr-1" />
                <span>Retry</span>
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

// Convert to simpler SVG component for better performance
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