import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Settings, MessageSquare, Plus, ChevronDown, ChevronLeft,
  Search, Bot, Sliders, Mic, Loader2,
  Redo, Save, Upload, Trash2, Download, X,
  Sun, Moon, FileText, Sparkles, Menu, Users, Bookmark,
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
  return (
    <div className="space-y-2 py-2">
      {chats.map((chat) => (
        <div
          key={chat.chat_id}
          className={`group flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${currentChatId === chat.chat_id
            ? 'bg-gradient-to-r from-blue-500/10 to-indigo-500/10 shadow-sm text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
            : 'hover:bg-white/80 dark:hover:bg-gray-800/70 text-gray-700 dark:text-gray-300'
            }`}
          onClick={() => onChatSelect(chat.chat_id)}
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            {currentChatId === chat.chat_id ?
              <Sparkles className="flex-shrink-0 w-5 h-5 text-blue-500" /> :
              <MessageSquare className="flex-shrink-0 w-5 h-5 text-gray-400 dark:text-gray-500" />
            }
            <div className="flex flex-col">
              <span className="truncate text-sm font-medium">{chat.title || 'New Chat'}</span>
            </div>
          </div>
          <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Are you sure you want to delete this chat?')) {
                  onDeleteChat(chat.chat_id);
                }
              }}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-full transition-colors duration-200"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-full transition-colors duration-200"
            >
              <Bookmark className="w-4 h-4" />
            </button>
          </div>
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
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1.5">
      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">{label}</label>
      {isLoading && (
        <Loader2 className="animate-spin h-4 w-4 text-blue-500" />
      )}
    </div>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full pl-3.5 pr-8 py-2.5 border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:outline-none appearance-none shadow-sm ${isLoading ? 'opacity-70' : ''}`}
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
  const [activeTab, setActiveTab] = useState<'chats' | 'settings' | 'docs'>('chats');
  const [mode, setMode] = useState('Chat');
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [persona, setPersona] = useState('Friendly Assistant');
  const [maxTokens, setMaxTokens] = useState(50);
  const [temperature, setTemperature] = useState(50);
  const [audioResponse, setAudioResponse] = useState(false);
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Theme toggle state
  const [theme, setTheme] = useState('light');

  // Sync theme with localStorage and document class
  useEffect(() => {
    // On mount, set theme from localStorage or system preference
    const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    let initialTheme = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

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

  // Focus search input when pressing Ctrl+K/Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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
      chat.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : chatsArray;

  // Get the currently selected provider name
  const selectedProviderName = providers.find(p => p.id === provider)?.name || '';

  // Get the currently selected model name
  const selectedModelName = models.find(m => m.id === model)?.name || '';

  // Handle provider change
  const handleProviderChange = useCallback((newProviderId: string) => {
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
      setTimeout(() => setActiveTab('settings'), 300);
    } else {
      setActiveTab('settings');
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

  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadSearch, setLoadSearch] = useState('');

  // Filtered chats for load modal
  const filteredLoadChats = loadSearch
    ? chats.filter(chat => chat.title.toLowerCase().includes(loadSearch.toLowerCase()))
    : chats;

  const renderTab = useCallback(() => {
    if (activeTab === 'settings') {
      return (
        <div className="p-4 space-y-4 max-h-full overflow-y-auto scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Settings</h2>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors duration-300"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Moon className="w-5 h-5 text-yellow-500" /> : <Sun className="w-5 h-5 text-yellow-500" />}
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-blue-500 border-r-transparent border-b-blue-300 border-l-transparent"></div>
            </div>
          ) : (
            <>
              {/* Mode */}
              <SettingsControl
                loading={loading}
                label="Chat Mode"
                value={mode}
                options={['Chat', 'RAG', 'Image']}
                onChange={setMode}
              />

              {/* Provider */}
              <SettingsControl
                loading={loading}
                label="AI Provider"
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

              {/* Persona */}
              <SettingsControl
                loading={loading}
                label="Persona"
                value={persona}
                options={personas}
                onChange={setPersona}
              />

              {/* Max Tokens */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Max Tokens</label>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                    {Math.floor((maxTokens / 100) * 8000)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full h-2 bg-gradient-to-r from-blue-100 to-blue-300 dark:from-blue-900/30 dark:to-blue-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Short</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Long</span>
                </div>
              </div>

              {/* Quick Token Presets */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setMaxTokens(Math.floor((2000 / 8000) * 100))}
                  className="px-2.5 py-1.5 text-xs bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all duration-150"
                >
                  2000
                </button>
                <button
                  onClick={() => setMaxTokens(Math.floor((4000 / 8000) * 100))}
                  className="px-2.5 py-1.5 text-xs bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm transition-all duration-150"
                >
                  4000
                </button>
                <button
                  onClick={() => setMaxTokens(Math.floor((8000 / 8000) * 100))}
                  className="px-2.5 py-1.5 text-xs bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-900/30 dark:to-indigo-800/30 text-indigo-700 dark:text-indigo-300 rounded-lg border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-sm transition-all duration-150"
                >
                  8000
                </button>
              </div>

              {/* Temperature */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Creativity</label>
                  <span className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                    {temperature / 100}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={temperature}
                  onChange={(e) => setTemperature(parseInt(e.target.value))}
                  className="w-full h-2 bg-gradient-to-r from-gray-200 to-purple-300 dark:from-gray-700 dark:to-purple-600 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between mt-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Precise</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Creative</span>
                </div>
              </div>

              {/* Audio Response */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Voice Response</label>
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button
                      onClick={() => setAudioResponse(false)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors duration-200 ${!audioResponse
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-gray-200'
                        : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                      Off
                    </button>
                    <button
                      onClick={() => setAudioResponse(true)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors duration-200 ${audioResponse
                        ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-gray-200'
                        : 'text-gray-500 dark:text-gray-400'
                        }`}
                    >
                      On
                    </button>
                  </div>
                </div>
              </div>

              {/* Model Capabilities */}
              {(() => {
                const selectedModel = models.find(m => m.id === model);
                return selectedModel && Array.isArray(selectedModel.capabilities) && selectedModel.capabilities.length > 0;
              })() && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Model Capabilities</h3>
                    <div className="flex flex-wrap gap-2">
                      {models.find(m => m.id === model)?.capabilities.map(capability => (
                        <span key={capability} className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs rounded-lg shadow-sm">
                          {capability}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Save as Defaults Button */}
              <div className="mb-4 pt-2">
                <button
                  onClick={handleSaveDefaults}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl hover:shadow-md text-sm flex items-center justify-center transition-all duration-200"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save as Default Settings
                </button>
              </div>

              {/* Provider Link */}
              {providers.find(p => p.id === provider)?.website && (
                <div className="mt-5 mb-3 text-center">
                  <a
                    href={providers.find(p => p.id === provider)?.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center justify-center"
                  >
                    View {selectedProviderName} provider details
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      );
    } else if (activeTab === 'docs') {
      return (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">Documents</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400 bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm rounded-xl border border-gray-100 dark:border-gray-700">
            <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p>No documents uploaded yet</p>
            <button className="mt-4 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg flex items-center text-sm hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-colors duration-200">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </button>
          </div>
        </div>
      );
    } else {
      // Chats tab
      return (
        <div className="p-4">
          <div className="overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-thin scrollbar-thumb-blue-200 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent pr-1">
            <ChatList
              chats={filteredChats}
              currentChatId={currentChatId}
              onChatSelect={onChatSelect}
              onDeleteChat={onDeleteChat}
            />

            {filteredChats.length === 0 && searchQuery && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>No chats matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        </div>
      );
    }
  }, [
    activeTab, loading, mode, provider, providers, model, models, persona,
    personas, maxTokens, temperature, audioResponse, searchQuery, filteredChats,
    currentChatId, theme, toggleTheme, handleProviderChange, handleNewChatWithDefaults,
    handleSaveDefaults, loadingModels, onChatSelect, onDeleteChat, selectedProviderName
  ]);

  return (
    <>
      {/* Settings drawer for larger screens */}
      {drawerOpen && !collapsed && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 backdrop-blur-sm transition-all duration-300" onClick={() => setDrawerOpen(false)}>
          <div
            className="absolute left-80 top-0 w-80 h-full bg-white/90 dark:bg-gray-900/90 shadow-2xl rounded-2xl p-4 overflow-y-auto backdrop-blur-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 transform animate-slideInRight"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Advanced Settings</h2>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-blue-500 border-r-transparent border-b-blue-300 border-l-transparent"></div>
                </div>
              ) : (
                <>
                  {/* System Prompt */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">System Prompt</label>
                    <textarea
                      className="w-full p-3 border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 rounded-xl text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:outline-none shadow-sm min-h-[100px]"
                      placeholder="Enter system instructions for the AI..."
                      rows={4}
                    ></textarea>
                  </div>
                  {/* Context Window */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Context Window</label>
                      <span className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        5 messages
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value="5"
                      className="w-full h-2 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Short Memory</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Long Memory</span>
                    </div>
                  </div>
                  {/* Plugin Support */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">AI Plugins</label>
                      <div className="relative inline-block w-10 align-middle select-none">
                        <input
                          type="checkbox"
                          name="toggle"
                          id="toggle"
                          className="sr-only"
                          defaultChecked
                        />
                        <label
                          htmlFor="toggle"
                          className="block h-6 rounded-full overflow-hidden cursor-pointer bg-gray-300 dark:bg-gray-700 transition-colors duration-200"
                        >
                          <span
                            className="block h-6 w-6 rounded-full bg-white shadow transform translate-x-0 transition-transform duration-200 ease-in-out dark:bg-blue-500"
                          ></span>
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="flex items-center space-x-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white/60 dark:bg-gray-800/60">
                        <input type="checkbox" className="rounded text-blue-500" defaultChecked />
                        <span className="text-xs">Web Search</span>
                      </div>
                      <div className="flex items-center space-x-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white/60 dark:bg-gray-800/60">
                        <input type="checkbox" className="rounded text-blue-500" defaultChecked />
                        <span className="text-xs">Code Interpreter</span>
                      </div>
                      <div className="flex items-center space-x-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white/60 dark:bg-gray-800/60">
                        <input type="checkbox" className="rounded text-blue-500" />
                        <span className="text-xs">Image Generator</span>
                      </div>
                      <div className="flex items-center space-x-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white/60 dark:bg-gray-800/60">
                        <input type="checkbox" className="rounded text-blue-500" />
                        <span className="text-xs">File Analysis</span>
                      </div>
                    </div>
                  </div>
                  {/* API Keys Management */}
                  <div className="mb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">API Keys</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white/60 dark:bg-gray-800/60">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                          <span className="text-xs">OpenAI</span>
                        </div>
                        <button className="text-xs text-blue-600 dark:text-blue-400">Edit</button>
                      </div>
                      <div className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white/60 dark:bg-gray-800/60">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                          <span className="text-xs">Anthropic</span>
                        </div>
                        <button className="text-xs text-blue-600 dark:text-blue-400">Add</button>
                      </div>
                      <button className="w-full mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                        + Add more providers
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <div className={`h-screen flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/80 backdrop-blur-lg shadow-xl overflow-hidden transition-all duration-300 ${collapsed ? 'w-16' : 'w-80'}`}>
        {/* Toggle button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1.5 shadow-lg z-10 hover:scale-110 transition-transform duration-200"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        {/* Header */}
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-4 border-b border-gray-200 dark:border-gray-700`}>
          {collapsed ? (
            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
              <Bot className="w-5 h-5" />
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                  <Bot className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">OmniChat</h1>
              </div>
              <button
                onClick={() => setDrawerOpen(true)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <Sliders className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
        {/* Bottom tabs navigation */}
        <div className="mt-auto border-t border-gray-200 dark:border-gray-700 p-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
          <div className={`flex ${collapsed ? 'flex-col space-y-4' : 'justify-around'} items-center`}>
            <button
              onClick={() => setActiveTab('chats')}
              className={`p-2 rounded-lg flex flex-col items-center ${activeTab === 'chats'
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                } transition-colors duration-200`}
              aria-label="Chats"
            >
              <MessageSquare className="w-5 h-5" />
              {!collapsed && <span className="text-xs mt-1">Chats</span>}
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`p-2 rounded-lg flex flex-col items-center ${activeTab === 'docs'
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                } transition-colors duration-200`}
              aria-label="Documents"
            >
              <FileText className="w-5 h-5" />
              {!collapsed && <span className="text-xs mt-1">Docs</span>}
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`p-2 rounded-lg flex flex-col items-center ${activeTab === 'settings'
                ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                } transition-colors duration-200`}
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
              {!collapsed && <span className="text-xs mt-1">Settings</span>}
            </button>
          </div>
        </div>
        {/* Main content area */}
        {!collapsed && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {renderTab()}
            {/* Button grid below chat list */}
            <div className="px-4 py-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
                  onClick={handleRetry}
                >
                  Retry
                </button>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
                  onClick={onNewChat}
                >
                  New
                </button>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
                  onClick={handleSave}
                >
                  Save
                </button>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
                  onClick={() => setShowLoadModal(true)}
                >
                  Load
                </button>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
                  onClick={handleDelete}
                >
                  Delete
                </button>
                <button
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
                  onClick={handleExport}
                >
                  Export
                </button>
              </div>
            </div>
            {/* Provider | Model display at the very bottom */}
            <div className="mb-3 mt-2 px-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center">
              <span className="truncate max-w-[90px]" title={selectedProviderName}>{selectedProviderName}</span>
              <span className="mx-1">|</span>
              <span className="truncate max-w-[90px]" title={selectedModelName}>{selectedModelName}</span>
            </div>
          </div>
        )}
        {/* Load Modal */}
        {showLoadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md">
              <h2 className="text-lg font-bold mb-2">Load Conversation</h2>
              <input
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded mb-4 bg-white dark:bg-gray-800"
                placeholder="Search conversations..."
                value={loadSearch}
                onChange={e => setLoadSearch(e.target.value)}
              />
              <div className="max-h-64 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
                {filteredLoadChats.length === 0 ? (
                  <div className="text-gray-400 text-sm italic py-4 text-center">No conversations found.</div>
                ) : (
                  filteredLoadChats.map(chat => (
                    <div
                      key={chat.chat_id}
                      className="py-2 px-2 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors"
                      onClick={() => { onChatSelect(chat.chat_id); setShowLoadModal(false); }}
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-100">{chat.title || 'Untitled Chat'}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  onClick={() => setShowLoadModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}