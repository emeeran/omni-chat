import { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Settings, MessageSquare, Plus, ChevronDown, ChevronLeft,
  Search, Bot, Sliders, Mic, Loader2,
  Redo, Save, Upload, Trash2, Download, X,
  Sun, Moon, FileText, Sparkles, Menu, Users, Bookmark,
  ChevronRight,
} from 'lucide-react';
import { ChatSummary, getProviders, getModels, getPersonas, Provider, Model, getAllModels } from '@/lib/api';
import { SidebarHeader } from './SidebarHeader';
import { saveAs } from 'file-saver';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import SettingsTab from './SettingsTab';
import DocsTab from './DocsTab';
import ChatsTab from './ChatsTab';
import ButtonGrid from './ButtonGrid';
import Modal from './Modal';

// Add styles at the top of the file
const globalStyles = `
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInRight {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes pulse {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-in-out;
}

.animate-slideInRight {
  animation: slideInRight 0.3s ease-out;
}

.animate-pulse {
  animation: pulse 2s infinite ease-in-out;
}
`;

// Define the structure for default settings
interface DefaultSettings {
  provider: string;
  model: string;
  persona: string;
  maxTokens: number;
  [key: string]: any;
}

type SidebarProps = {
  chats: ChatSummary[];
  currentChatId: string;
  selectedModel: string;
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onSaveChat: (chatId: string) => void;
  onExportChat: (chatId: string, format: 'md' | 'pdf' | 'json') => void;
  onRetryChat: (chatId: string) => void;
  onAudioResponseChange?: (enabled: boolean) => void;
};

// Custom hook for local storage with proper typing for function updates
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prevState: T) => T)) => void] {
  // State to store our value
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    
    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none, return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error("Error reading from localStorage:", error);
      return initialValue;
    }
  });
  
  // Function to update stored value and localStorage
  const setValue = useCallback((value: T | ((prevState: T) => T)) => {
    try {
      // Allow value to be a function
      const valueToStore = typeof value === 'function'
        ? (value as ((prevState: T) => T))(storedValue)
        : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to local storage
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  }, [key, storedValue]);
  
  return [storedValue, setValue];
}

// Custom hook for API data fetching
function useApiData() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allModels, setAllModels] = useState<{[key: string]: Model[]}>({});
  
  // Optimized: Only fetch if not cached, otherwise return cached and fetch in background for freshness
  const fetchModelsForProvider = useCallback(async (providerId: string) => {
    if (allModels[providerId]) {
      setModels(allModels[providerId]);
      // Optionally, fetch in background for freshness
      (async () => {
        try {
          const response = await fetch(`/api/models?provider=${providerId}`);
          if (response.ok) {
            const data = await response.json();
            setAllModels(prev => ({ ...prev, [providerId]: data }));
            setModels(data);
          }
        } catch {}
      })();
      return allModels[providerId];
    }
    setLoadingModels(true);
    try {
      const response = await fetch(`/api/models?provider=${providerId}`);
      if (!response.ok) throw new Error(`Error fetching models: ${response.statusText}`);
      const data = await response.json();
      setAllModels(prev => ({ ...prev, [providerId]: data }));
      setModels(data);
      return data;
    } catch (err) {
      setError(`Failed to fetch models: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    } finally {
      setLoadingModels(false);
    }
  }, [allModels]);
  
  // Memoized switchToProvider
  const switchToProvider = useCallback((providerId: string): Model[] => {
    if (!providerId) return [];
    if (allModels[providerId]) {
      setModels(allModels[providerId]);
      return allModels[providerId];
    }
    fetchModelsForProvider(providerId);
    return [];
  }, [allModels, fetchModelsForProvider]);
  
  // Define fetchInitialData function to fetch providers, models, and personas
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch providers using the API library function
      const providersData = await getProviders();
      setProviders(providersData);
      
      // Find default provider
      const defaultProvider = providersData.find((p: Provider) => p.default) || providersData[0];
      if (defaultProvider) {
        setLoadingModels(true);
        // Fetch models for default provider using the API library function
        const modelsData = await getModels(defaultProvider.id);
        setModels(modelsData);
        
        // Store in cache
        setAllModels(prev => ({
          ...prev,
          [defaultProvider.id]: modelsData
        }));
        setLoadingModels(false);
      }
      
      // Fetch personas using the API library function
      const personasData = await getPersonas();
      setPersonas(personasData);
      
      setLoading(false);
    } catch (err) {
      setError(`Failed to fetch initial data: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
      setLoadingModels(false);
    }
  }, []);
  
  // Initial data load
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);
  
  return {
    providers,
    models,
    allModels,
    personas,
    loading,
    loadingModels,
    error,
    fetchModelsForProvider,
    switchToProvider
  };
}

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

// ModelPreview component to show visual preview of models
const ModelPreview = memo(({ 
  models, 
  allModels,
  provider, 
  selectedModel, 
  onModelSelect, 
  isLoading,
  showAllProviders = false
}: { 
  models: Model[], 
  allModels?: {[providerId: string]: Model[]},
  provider: string, 
  selectedModel: string, 
  onModelSelect: (modelId: string) => void,
  isLoading: boolean,
  showAllProviders?: boolean
}) => {
  // Determine which models to display
  const displayModels = useMemo(() => {
    if (showAllProviders && allModels) {
      // Flatten all models from all providers
      let allProviderModels: Model[] = [];
      Object.values(allModels).forEach(providerModels => {
        allProviderModels = [...allProviderModels, ...providerModels];
      });
      return allProviderModels;
    } else {
      // Just show models for the current provider
      return models;
    }
  }, [models, allModels, showAllProviders]);

  // Group models by main capabilities for visual organization - using useMemo for performance
  const modelGroups = useMemo(() => {
    // First group by provider if showing all providers
    if (showAllProviders && allModels) {
      const groupedByProvider: {[providerId: string]: Model[]} = {};
      
      displayModels.forEach(model => {
        if (!groupedByProvider[model.provider]) {
          groupedByProvider[model.provider] = [];
        }
        groupedByProvider[model.provider].push(model);
      });
      
      return groupedByProvider;
    }
    
    // Otherwise group by capability
    return {
      vision: displayModels.filter(m => m.capabilities.includes('vision')),
      chat: displayModels.filter(m => !m.capabilities.includes('vision') && m.capabilities.includes('chat')),
      other: displayModels.filter(m => !m.capabilities.includes('vision') && !m.capabilities.includes('chat'))
    };
  }, [displayModels, showAllProviders, allModels]);

  // Get selected model details - using useMemo to avoid recalculation on every render
  const selectedModelDetails = useMemo(() => 
    displayModels.find(m => m.id === selectedModel), 
    [displayModels, selectedModel]
  );
  
  // Group all model data for the dropdown in one memo
  const { dropdownOptions, hasModels } = useMemo(() => {
    if (showAllProviders && typeof modelGroups !== 'function' && !Array.isArray(modelGroups)) {
      // For provider-grouped models
      const providerKeys = Object.keys(modelGroups);
      
      return {
        hasModels: displayModels.length > 0,
        dropdownOptions: (
          <>
            {providerKeys.map(providerId => (
              <optgroup key={providerId} label={providerId.charAt(0).toUpperCase() + providerId.slice(1)}>
                {modelGroups[providerId].map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.economical ? '(Economical)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </>
        )
      };
    } else {
      // Original capability-grouped models
      const capabilityGroups = modelGroups as {
        vision: Model[],
        chat: Model[],
        other: Model[]
      };
      
      const hasVision = capabilityGroups.vision.length > 0;
      const hasChat = capabilityGroups.chat.length > 0;
      const hasOther = capabilityGroups.other.length > 0;
      
      return {
        hasModels: displayModels.length > 0,
        dropdownOptions: (
          <>
            {hasVision && (
              <optgroup label="Vision Models">
                {capabilityGroups.vision.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.economical ? '(Economical)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
            
            {hasChat && (
              <optgroup label="Chat Models">
                {capabilityGroups.chat.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.economical ? '(Economical)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
            
            {hasOther && (
              <optgroup label="Other Models">
                {capabilityGroups.other.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.economical ? '(Economical)' : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </>
        )
      };
    }
  }, [modelGroups, displayModels.length, showAllProviders]);

  // Model selection handler for dropdown
  const handleModelSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onModelSelect(e.target.value);
  }, [onModelSelect]);
  
  if (isLoading) {
    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Model Selection</label>
          <Loader2 className="animate-spin h-4 w-4 text-blue-500" />
        </div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-10 rounded-xl w-full"></div>
      </div>
    );
  }

  if (!hasModels) {
    return (
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Model Selection</label>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/60">
          No models available for this provider
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1.5">
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Model Selection</label>
        {selectedModelDetails?.capabilities?.includes('vision') && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            </svg>
            Vision
          </span>
        )}
      </div>
      <div className="relative">
        <select
          value={selectedModel}
          onChange={handleModelSelectChange}
          className="w-full pl-3.5 pr-8 py-2.5 border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:outline-none appearance-none shadow-sm transition-all duration-300"
        >
          {dropdownOptions}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
      </div>
      
      {/* Model Capabilities Preview with transition animation */}
      {selectedModelDetails && (
        <div className="mt-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg p-3 transition-all duration-300 animate-fadeIn">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm text-gray-700 dark:text-gray-300">
              {selectedModelDetails.name || 'Selected Model'}
            </span>
            {selectedModelDetails.economical && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Economical
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedModelDetails.capabilities.map(capability => (
              <span 
                key={capability} 
                className={`px-2 py-1 border text-xs rounded-md ${
                  capability === 'vision' 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                    : capability === 'chat'
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 text-purple-700 dark:text-purple-300'
                }`}
              >
                {capability === 'vision' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                  </svg>
                )}
                {capability === 'chat' && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                )}
                {capability}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

ModelPreview.displayName = 'ModelPreview';

SettingsControl.displayName = 'SettingsControl';

export default function Sidebar({ chats, currentChatId, selectedModel, onNewChat, onChatSelect, onDeleteChat, onSaveChat, onExportChat, onRetryChat, onAudioResponseChange }: SidebarProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chats' | 'settings' | 'docs'>('chats');
  
  // Add state for advanced settings
  const [contextWindow, setContextWindow] = useState(5);
  const [pluginsEnabled, setPluginsEnabled] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [codeInterpreterEnabled, setCodeInterpreterEnabled] = useState(true);
  const [imageGeneratorEnabled, setImageGeneratorEnabled] = useState(true);
  const [fileAnalysisEnabled, setFileAnalysisEnabled] = useState(true);
  
  // Add state for API key management
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyProvider, setApiKeyProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeys, setApiKeys] = useLocalStorage<{[key: string]: string}>('apiKeys', {
    'openai': '***************',
    'anthropic': '***************',
    'mistral': '***************',
    'google': '***************',
    'cohere': '***************'
  });
  
  // Use the local storage hook for all settings
  const [settings, setSettings] = useLocalStorage<DefaultSettings>('omniChatDefaults', {
    provider: 'openai',
    model: 'gpt-4o',
    persona: 'Friendly Assistant',
    maxTokens: 4000
  });
  
  // Add global styles effect here, inside the component
  useEffect(() => {
    // Only add once
    if (document.getElementById('omni-chat-global-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'omni-chat-global-styles';
    styleEl.innerHTML = globalStyles;
    document.head.appendChild(styleEl);
    
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);
  
  // Destructure settings for easier access
  const { provider, model, persona, maxTokens } = settings;
  
  // Settings state that doesn't need to be persisted
  const [mode, setMode] = useState('Chat');
  const [temperature, setTemperature] = useState(50);
  const [audioResponse, setAudioResponse] = useState(false);
  
  // Use the API data hook
  const { 
    providers, 
    models, 
    allModels, 
    personas, 
    loading, 
    loadingModels,
    error: apiError, 
    fetchModelsForProvider,
    switchToProvider
  } = useApiData();
  
  // Modal states
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [loadSearch, setLoadSearch] = useState('');
  const [deleteSearch, setDeleteSearch] = useState('');
  
  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const providerChangingRef = useRef(false);
  
  const router = useRouter();

  // Theme handling - use the correct type for theme
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>('theme', 
    typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light'
  );

  // Apply theme to document
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }, [theme]);

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

  // Ensure chats is always an array
  const chatsArray = useMemo(() => Array.isArray(chats) ? chats : [], [chats]);

  // Get provider/model names - memoized
  const selectedProviderName = useMemo(() => 
    providers.find(p => p.id === provider)?.name || '',
    [providers, provider]
  );

  const selectedModelName = useMemo(() => 
    models.find(m => m.id === model)?.name || '',
    [models, model]
  );

  // Filtered chats based on search query - memoized
  const filteredChats = useMemo(() => 
    searchQuery
      ? chatsArray.filter(chat => chat.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : chatsArray,
    [chatsArray, searchQuery]
  );
  
  // Filtered chats for load/delete modals - memoized
  const filteredLoadChats = useMemo(() => 
    loadSearch
    ? chats.filter(chat => chat.title.toLowerCase().includes(loadSearch.toLowerCase()))
      : chats,
    [chats, loadSearch]
  );
  
  const filteredDeleteChats = useMemo(() => 
    deleteSearch
    ? chats.filter(chat => chat.title.toLowerCase().includes(deleteSearch.toLowerCase()))
      : chats,
    [chats, deleteSearch]
  );

  // Helper function to update a single setting
  const updateSetting = useCallback(<K extends keyof DefaultSettings>(key: K, value: DefaultSettings[K]) => {
    setSettings((prev) => {
      const updated = { ...prev };
      updated[key] = value;
      return updated;
    });
  }, [setSettings]);

  // Update models when provider changes
  useEffect(() => {
    // Skip if provider is changing
    if (providerChangingRef.current) return;
    
    // This effect is now simplified since we handle model switching in handleProviderChange
    // The main purpose now is just to update the model selection if needed
    const currentModelData = models.find(m => m.id === model);
    
    // If the model exists in the current provider's models, we're good
    if (currentModelData) return;
    
    // If the model doesn't exist, select a default or first model from the current provider
    if (models.length > 0) {
      const defaultModel = models.find(m => m.default);
      updateSetting('model', defaultModel?.id || models[0].id);
    }
  }, [provider, model, models, updateSetting]);

  // Handle provider change
  const handleProviderChange = useCallback((newProvider: string) => {
    updateSetting('provider', newProvider);
    
    // Use cached models if available, otherwise fetch them
    const providerModels = switchToProvider(newProvider);
    
    // If we have models for this provider, ensure the model is compatible
    if (providerModels && providerModels.length > 0) {
      const currentModelCompatible = providerModels.some(m => m.id === model);
      if (!currentModelCompatible) {
        // Find a default model or use the first one
        const defaultModel = providerModels.find(m => m.default);
        updateSetting('model', defaultModel?.id || providerModels[0].id);
      }
    }
  }, [updateSetting, switchToProvider, model]);
  
  // Handle model change
  const handleModelChange = useCallback((newModel: string) => {
    updateSetting('model', newModel);
  }, [updateSetting]);
  
  // Handle persona change
  const handlePersonaChange = useCallback((newPersona: string) => {
    updateSetting('persona', newPersona);
  }, [updateSetting]);
  
  // Handle max tokens change
  const handleMaxTokensChange = useCallback((newMaxTokens: number) => {
    updateSetting('maxTokens', newMaxTokens);
  }, [updateSetting]);

  // Handle voice input
  const handleVoiceInput = useCallback(() => {
    alert('Voice input functionality will be implemented here');
  }, []);

  // Handle sliders click
  const handleSlidersClick = useCallback(() => {
    if (collapsed) {
      setCollapsed(false);
      setTimeout(() => setActiveTab('settings'), 300);
    } else {
      setActiveTab('settings');
    }
  }, [collapsed]);

  // Handle new chat with defaults
  const handleNewChatWithDefaults = useCallback(() => {
    onNewChat();
  }, [onNewChat]);

  // Toggle sidebar collapse
  const toggleCollapse = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed]);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, [setTheme]);

  // Action handlers
  const handleRetryClick = useCallback(() => {
    if (currentChatId) onRetryChat(currentChatId);
  }, [currentChatId, onRetryChat]);
  
  const handleNewClick = useCallback(() => {
    onNewChat();
  }, [onNewChat]);
  
  const handleSaveClick = useCallback(() => {
    if (currentChatId) onSaveChat(currentChatId);
  }, [currentChatId, onSaveChat]);
  
  const handleLoadClick = useCallback(() => {
    setShowLoadModal(true);
  }, []);
  
  const handleDeleteClick = useCallback(() => {
    setShowDeleteModal(true);
  }, []);
  
  const handleExportClick = useCallback(() => {
    setShowExportModal(true);
  }, []);
  
  const handleExportFormat = useCallback((format: 'md' | 'pdf' | 'json') => {
    if (currentChatId) onExportChat(currentChatId, format);
    setShowExportModal(false);
  }, [currentChatId, onExportChat]);

  // Fix handleSaveDefaults to use the correct typing
  const handleSaveDefaults = useCallback(() => {
    const calculatedTokens = Math.round(1000 + (maxTokens / 100) * 15000);
    setSettings(prev => ({
      ...prev,
      provider,
      model,
      persona,
      maxTokens: calculatedTokens
    }));
    toast.success("Settings saved as defaults");
  }, [provider, model, persona, maxTokens, setSettings, toast]);

  // Add renderTab function inside the component
  const renderTab = useCallback(() => {
    switch (activeTab) {
      case 'settings':
        return (
          <SettingsTab
            loading={loading}
            providers={providers}
            models={models}
            allModels={allModels}
            personas={personas}
            provider={provider}
            model={model}
            persona={persona}
            mode={mode}
            maxTokens={maxTokens}
            temperature={temperature}
            audioResponse={audioResponse}
            loadingModels={loadingModels}
            theme={theme}
            toggleTheme={toggleTheme}
            handleProviderChange={handleProviderChange}
            setMode={setMode}
            setModel={handleModelChange}
            setPersona={handlePersonaChange}
            setMaxTokens={handleMaxTokensChange}
            setTemperature={setTemperature}
            setAudioResponse={setAudioResponse}
            handleSaveDefaults={handleSaveDefaults}
            selectedProviderName={selectedProviderName}
            pluginsEnabled={pluginsEnabled}
            setPluginsEnabled={setPluginsEnabled}
            webSearchEnabled={webSearchEnabled}
            setWebSearchEnabled={setWebSearchEnabled}
            codeInterpreterEnabled={codeInterpreterEnabled}
            setCodeInterpreterEnabled={setCodeInterpreterEnabled}
            imageGeneratorEnabled={imageGeneratorEnabled}
            setImageGeneratorEnabled={setImageGeneratorEnabled}
            fileAnalysisEnabled={fileAnalysisEnabled}
            setFileAnalysisEnabled={setFileAnalysisEnabled}
            apiKeys={apiKeys}
            setApiKeys={setApiKeys}
            setShowApiKeyModal={setShowApiKeyModal}
            setApiKeyProvider={setApiKeyProvider}
            setApiKey={setApiKey}
          />
        );
      case 'docs':
        return <DocsTab />;
      case 'chats':
      default:
        return (
          <ChatsTab
            filteredChats={filteredChats}
            currentChatId={currentChatId}
            onChatSelect={onChatSelect}
            onDeleteChat={onDeleteChat}
          />
        );
    }
  }, [
    activeTab, 
    loading,  // Ensure only defined variables are used
    providers,
    models,
    personas,
    provider,
    model,
    persona,
    mode,
    maxTokens,
    temperature,
    audioResponse,
    theme,
    toggleTheme,
    handleProviderChange,
    setMode,
    handleModelChange,
    handlePersonaChange,
    handleMaxTokensChange,
    setTemperature,
    setAudioResponse,
    handleSaveDefaults,
    selectedProviderName,
    pluginsEnabled,
    setPluginsEnabled,
    webSearchEnabled,
    setWebSearchEnabled,
    codeInterpreterEnabled,
    setCodeInterpreterEnabled,
    imageGeneratorEnabled,
    setImageGeneratorEnabled,
    fileAnalysisEnabled,
    setFileAnalysisEnabled,
    apiKeys,
    setApiKeys,
    setShowApiKeyModal,
    setApiKeyProvider,
    setApiKey,
    filteredChats,
    currentChatId,
    onChatSelect,
    onDeleteChat
  ]);

  // Add effect to notify parent component when audioResponse changes
  useEffect(() => {
    if (onAudioResponseChange) {
      onAudioResponseChange(audioResponse);
    }
  }, [audioResponse, onAudioResponseChange]);

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
                        {contextWindow} messages
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={contextWindow}
                      onChange={(e) => setContextWindow(parseInt(e.target.value))}
                      className="w-full h-2 bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Short Memory</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Long Memory</span>
                    </div>
                  </div>
                  
                  {/* AI Plugins Section */}
                  <div className="mb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300">AI Plugins</h3>
                      <div className="relative inline-block w-10 align-middle select-none">
                        <input
                          type="checkbox"
                          name="drawer-toggle"
                          id="drawer-toggle"
                          className="sr-only"
                          checked={pluginsEnabled}
                          onChange={() => setPluginsEnabled(!pluginsEnabled)}
                        />
                        <label
                          htmlFor="drawer-toggle"
                          className="block h-6 rounded-full overflow-hidden cursor-pointer bg-gray-300 dark:bg-gray-700 transition-colors duration-200"
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transform ${pluginsEnabled ? 'translate-x-4' : 'translate-x-0'} transition-transform duration-200 ease-in-out dark:bg-blue-500`}
                          ></span>
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="flex items-center space-x-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white/60 dark:bg-gray-800/60">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-500" 
                          checked={webSearchEnabled}
                          onChange={() => setWebSearchEnabled(!webSearchEnabled)}
                          disabled={!pluginsEnabled}
                        />
                        <span className="text-xs">Web Search</span>
                      </div>
                      <div className="flex items-center space-x-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white/60 dark:bg-gray-800/60">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-500" 
                          checked={codeInterpreterEnabled}
                          onChange={() => setCodeInterpreterEnabled(!codeInterpreterEnabled)}
                          disabled={!pluginsEnabled}
                        />
                        <span className="text-xs">Code Interpreter</span>
                      </div>
                      <div className="flex items-center space-x-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white/60 dark:bg-gray-800/60">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-500" 
                          checked={imageGeneratorEnabled}
                          onChange={() => setImageGeneratorEnabled(!imageGeneratorEnabled)}
                          disabled={!pluginsEnabled}
                        />
                        <span className="text-xs">Image Generator</span>
                      </div>
                      <div className="flex items-center space-x-2 border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-white/60 dark:bg-gray-800/60">
                        <input 
                          type="checkbox" 
                          className="rounded text-blue-500" 
                          checked={fileAnalysisEnabled}
                          onChange={() => setFileAnalysisEnabled(!fileAnalysisEnabled)}
                          disabled={!pluginsEnabled}
                        />
                        <span className="text-xs">File Analysis</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* API Keys Management */}
                  <div className="mb-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">API Keys</h3>
                    <div className="space-y-2">
                      {Object.entries(apiKeys).map(([provider, key]) => (
                        <div key={provider} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white/60 dark:bg-gray-800/60">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            <span className="text-xs">{provider.charAt(0).toUpperCase() + provider.slice(1)}</span>
                        </div>
                          <div className="flex items-center space-x-2">
                            <button 
                              className="text-xs text-blue-600 dark:text-blue-400"
                              onClick={() => {
                                setApiKeyProvider(provider);
                                setApiKey(key === '***************' ? '' : key);
                                setShowApiKeyModal(true);
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              className="text-xs text-red-600 dark:text-red-400"
                              onClick={() => {
                                const newApiKeys = {...apiKeys};
                                delete newApiKeys[provider];
                                setApiKeys(newApiKeys);
                              }}
                            >
                              Remove
                            </button>
                      </div>
                        </div>
                      ))}
                      <button 
                        className="w-full mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        onClick={() => {
                          setApiKeyProvider('');
                          setApiKey('');
                          setShowApiKeyModal(true);
                        }}
                      >
                        + Add API key
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
          onClick={toggleCollapse}
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
            
            {/* Button grid */}
            <ButtonGrid
              currentChatId={currentChatId}
              chats={chatsArray}
              onRetry={handleRetryClick}
              onNew={handleNewClick}
              onSave={handleSaveClick}
              onLoad={handleLoadClick}
              onDelete={handleDeleteClick}
              onExport={handleExportClick}
            />
            
            {/* Provider | Model display at the very bottom */}
            <div className="mb-3 mt-2 px-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center">
              <span className="truncate max-w-[90px]" title={selectedProviderName}>{selectedProviderName}</span>
              <span className="mx-1">|</span>
              <span className="truncate max-w-[90px]" title={selectedModelName}>{selectedModelName}</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Load Modal */}
      {showLoadModal && (
        <Modal title="Load Conversation" onClose={() => setShowLoadModal(false)}>
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
        </Modal>
      )}
      
      {/* Delete Modal */}
      {showDeleteModal && (
        <Modal title="Delete Conversation" onClose={() => setShowDeleteModal(false)}>
            <input
              className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded mb-4 bg-white dark:bg-gray-800"
              placeholder="Search conversations..."
              value={deleteSearch}
              onChange={e => setDeleteSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-700">
              {filteredDeleteChats.length === 0 ? (
                <div className="text-gray-400 text-sm italic py-4 text-center">No conversations found.</div>
              ) : (
                filteredDeleteChats.map(chat => (
                  <div
                    key={chat.chat_id}
                    className="py-2 px-2 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                    onClick={() => { onDeleteChat(chat.chat_id); setShowDeleteModal(false); }}
                  >
                    <span className="font-medium text-gray-800 dark:text-gray-100">{chat.title || 'Untitled Chat'}</span>
                  </div>
                ))
              )}
            </div>
        </Modal>
      )}
      
      {/* Export Modal */}
      {showExportModal && (
        <Modal title="Export Conversation" onClose={() => setShowExportModal(false)}>
            <div className="flex flex-col space-y-2">
              <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                onClick={() => handleExportFormat('md')}
              >
                Export as Markdown
              </button>
              <button
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                onClick={() => handleExportFormat('pdf')}
              >
                Export as PDF
              </button>
              <button
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                onClick={() => handleExportFormat('json')}
              >
                Export as JSON
              </button>
            </div>
        </Modal>
      )}

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 backdrop-blur-sm transition-all duration-300 flex items-center justify-center" onClick={() => setShowApiKeyModal(false)}>
          <div
            className="bg-white/90 dark:bg-gray-900/90 shadow-2xl rounded-2xl p-4 w-96 backdrop-blur-xl border border-gray-200 dark:border-gray-700 transition-all duration-300 transform animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {apiKeyProvider ? `Edit ${apiKeyProvider} API Key` : 'Add New API Key'}
              </h2>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Provider selection */}
              {!apiKeyProvider && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                    Provider
                  </label>
                  <select
                    value={apiKeyProvider}
                    onChange={(e) => setApiKeyProvider(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:outline-none shadow-sm"
                  >
                    <option value="" disabled>Select a provider</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="mistral">Mistral AI</option>
                    <option value="google">Google AI</option>
                    <option value="cohere">Cohere</option>
                  </select>
                </div>
              )}
              {/* Custom provider name */}
              {apiKeyProvider === 'custom' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                    Custom Provider Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter provider name"
                    className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 rounded-xl text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:outline-none shadow-sm"
                    onChange={(e) => setApiKeyProvider(e.target.value)}
                  />
                </div>
              )}
              {/* API Key input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
                  API Key
                </label>
                <input
                  type="password"
                  placeholder="Enter API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 rounded-xl text-sm text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:outline-none shadow-sm"
                />
              </div>
              {/* Action buttons */}
              <div className="flex justify-end space-x-2 mt-6">
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (apiKeyProvider && apiKey) {
                      setApiKeys({
                        ...apiKeys,
                        [apiKeyProvider]: apiKey
                      });
                      setShowApiKeyModal(false);
                    }
                  }}
                  disabled={!apiKeyProvider || !apiKey}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    apiKeyProvider && apiKey 
                      ? 'bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}