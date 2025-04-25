import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { 
  Settings, MessageSquare, Plus, ChevronDown, ChevronUp,
  FileText, Search, Bot, Sliders, Mic,
  Redo, Save, Upload, Trash2, Download, X
} from 'lucide-react';
import { ChatSummary, getProviders, getModels, getPersonas, Provider, Model } from '@/lib/api';
import SettingsPanel from './SettingsPanel';

type SidebarProps = {
  chats: ChatSummary[];
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
};

export default function Sidebar({ chats, onNewChat, onChatSelect }: SidebarProps) {
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
  
  // API data states
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [personas, setPersonas] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  
  // Fetch providers, models, and personas when component mounts
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const providersData = await getProviders();
        setProviders(providersData);
        
        // Set default provider if available
        if (providersData.length > 0) {
          const defaultProvider = providersData.find(p => p.id === 'openai') || providersData[0];
          setProvider(defaultProvider.id);
          
          // Fetch models for the selected provider
          const modelsData = await getModels(defaultProvider.id);
          setModels(modelsData);
          
          // Set default model if available
          if (modelsData.length > 0) {
            setModel(modelsData[0].id);
          }
        }
        
        // Fetch personas
        const personasData = await getPersonas();
        const personaNames = personasData.map(p => typeof p === 'string' ? p : p.name);
        setPersonas(personaNames);
        
        // Set default persona if available
        if (personaNames.length > 0) {
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
      
      try {
        const modelsData = await getModels(provider);
        setModels(modelsData);
        
        // Set default model if available
        if (modelsData.length > 0) {
          setModel(modelsData[0].id);
        }
      } catch (error) {
        console.error(`Error fetching models for ${provider}:`, error);
      }
    }
    
    fetchModelsForProvider();
  }, [provider]);
  
  // Get the currently selected provider name
  const selectedProviderName = providers.find(p => p.id === provider)?.name || '';
  
  // Get the currently selected model name
  const selectedModelName = models.find(m => m.id === model)?.name || '';
  
  return (
    <div className="relative">
      {/* Settings drawer */}
      {drawerOpen && !collapsed && (
        <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setDrawerOpen(false)}>
          <div 
            className="absolute left-72 top-0 w-80 h-full bg-white dark:bg-dark-800 shadow-xl p-4 overflow-y-auto"
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
                      onChange={(e) => setProvider(e.target.value)}
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
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Model</label>
                  <div className="relative">
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 rounded-md text-sm focus:ring-1 focus:ring-primary-500 appearance-none"
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.isPreview && "(Preview)"}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                  </div>
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
                    <span className="text-sm text-gray-500">{maxTokens}</span>
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
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          !audioResponse ? 'bg-gray-200 dark:bg-gray-600' : 'bg-white dark:bg-dark-700'
                        }`}
                      >
                        <span className="text-sm">Off</span>
                      </button>
                      <button
                        onClick={() => setAudioResponse(true)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          audioResponse ? 'bg-gray-200 dark:bg-gray-600' : 'bg-white dark:bg-dark-700'
                        }`}
                      >
                        <span className="text-sm">On</span>
                      </button>
                    </div>
                  </div>
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
      
      <div className={`h-screen flex flex-col border-r border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-900 relative transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-72'
      }`}>
        {/* Toggle button for mobile/collapsible sidebar */}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-full p-1 shadow-md z-10 hover:bg-gray-50 dark:hover:bg-dark-700"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </button>

        {/* Header - Persona */}
        <div className="p-4 border-b border-gray-200 dark:border-dark-700 flex justify-center items-center">
          {!collapsed && (
            <h1 className="text-lg font-medium text-gray-700 dark:text-gray-300">Persona</h1>
          )}
          {collapsed && (
            <Bot className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          )}
        </div>
        
        {/* Main sidebar content with scroll */}
        <div className="flex-1 overflow-y-auto">
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
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {selectedProviderName} | {selectedModelName}
                  {models.find(m => m.id === model)?.isPreview && (
                    <span className="ml-1 px-1.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs rounded-full">Preview</span>
                  )}
                </p>
              </div>
              
              {/* Action buttons - first row */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <button className="py-2 px-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center justify-center">
                  <Redo className="w-4 h-4 mr-1" />
                  <span>Retry</span>
                </button>
                <button 
                  onClick={onNewChat}
                  className="py-2 px-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  <span>New</span>
                </button>
                <button className="py-2 px-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center justify-center">
                  <Save className="w-4 h-4 mr-1" />
                  <span>Save</span>
                </button>
              </div>
              
              {/* Action buttons - second row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button className="py-2 px-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center justify-center">
                  <Upload className="w-4 h-4 mr-1" />
                  <span>Load</span>
                </button>
                <button className="py-2 px-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center justify-center">
                  <Trash2 className="w-4 h-4 mr-1" />
                  <span>Delete</span>
                </button>
                <button className="py-2 px-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md flex items-center justify-center">
                  <Download className="w-4 h-4 mr-1" />
                  <span>Export</span>
                </button>
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
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md">
                <Sliders className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-md">
                <Mic className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          )}
        </div>
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