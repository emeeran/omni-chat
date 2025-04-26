import { useState, useEffect, useMemo } from 'react';
import { X, Save, Monitor, Moon, Sun, Palette } from 'lucide-react';
import { Provider, Model, Persona, getProviders, getModels, getPersonas } from '@/lib/api';
import { useTheme } from '@/hooks/useTheme';

type SettingsPanelProps = {
  onClose: () => void;
};

// Define the structure for default settings
interface DefaultSettings {
  provider: string;
  model: string;
  persona: string;
  maxTokens: number;
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [mode, setMode] = useState('chat');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('groq');
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>('default');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(2000);
  const [saveAsDefaults, setSaveAsDefaults] = useState<boolean>(false);
  const [defaultsSaved, setDefaultsSaved] = useState<boolean>(false);
  
  // Theme context from the simplified useTheme hook
  const { theme, setTheme, colorTheme, setColorTheme } = useTheme();

  // Load any saved defaults on mount
  useEffect(() => {
    const loadSavedDefaults = () => {
      try {
        const savedDefaults = localStorage.getItem('omniChatDefaults');
        if (savedDefaults) {
          const defaults: DefaultSettings = JSON.parse(savedDefaults);
          // We'll apply these defaults if the provider and model exist in our loaded data
          if (defaults.provider) {
            setSelectedProvider(defaults.provider);
          }
          if (defaults.persona) {
            setSelectedPersona(defaults.persona);
          }
          if (defaults.maxTokens) {
            setMaxTokens(defaults.maxTokens);
          }
          // Model will be set after models are loaded for the provider
          return defaults;
        }
      } catch (error) {
        console.error('Error loading saved defaults:', error);
      }
      return null;
    };

    const defaults = loadSavedDefaults();
    return () => {
      // Remember the model from defaults for when provider models load
      if (defaults?.model) {
        const rememberedModel = defaults.model;
        // We'll use this in the provider models useEffect
      }
    };
  }, []);

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providersData = await getProviders();
        setProviders(providersData);

        // Set default provider if available or use saved default
        const savedDefaults = localStorage.getItem('omniChatDefaults');
        if (savedDefaults) {
          const defaults: DefaultSettings = JSON.parse(savedDefaults);
          const providerExists = providersData.some(p => p.id === defaults.provider);
          if (providerExists) {
            setSelectedProvider(defaults.provider);
          } else {
            const defaultProvider = providersData.find(p => p.default);
            if (defaultProvider) {
              setSelectedProvider(defaultProvider.id);
            }
          }
        } else {
          const defaultProvider = providersData.find(p => p.default);
          if (defaultProvider) {
            setSelectedProvider(defaultProvider.id);
          }
        }
      } catch (error) {
        console.error('Error loading providers:', error);
      }
    };

    loadProviders();
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      if (!selectedProvider) return;

      try {
        const modelsData = await getModels(selectedProvider);
        setModels(modelsData);

        // Check for saved defaults
        const savedDefaults = localStorage.getItem('omniChatDefaults');
        if (savedDefaults) {
          const defaults: DefaultSettings = JSON.parse(savedDefaults);
          // Only apply the default model if it belongs to the selected provider
          const modelExists = modelsData.some(m => m.id === defaults.model && m.provider === selectedProvider);

          if (modelExists) {
            setSelectedModel(defaults.model);
          } else {
            // Fall back to provider default
            const defaultModel = modelsData.find(m => m.default);
            if (defaultModel) {
              setSelectedModel(defaultModel.id);
            } else if (modelsData.length > 0) {
              setSelectedModel(modelsData[0].id);
            }
          }
        } else {
          // No saved defaults, use normal behavior
          const defaultModel = modelsData.find(m => m.default);
          if (defaultModel) {
            setSelectedModel(defaultModel.id);
          } else if (modelsData.length > 0) {
            setSelectedModel(modelsData[0].id);
          }
        }
      } catch (error) {
        console.error('Error loading models:', error);
      }
    };

    loadModels();
  }, [selectedProvider]);

  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const personasData = await getPersonas();
        setPersonas(personasData);

        // Check for saved defaults
        const savedDefaults = localStorage.getItem('omniChatDefaults');
        if (savedDefaults) {
          const defaults: DefaultSettings = JSON.parse(savedDefaults);
          const personaExists = personasData.some(p => p.id === defaults.persona);

          if (personaExists) {
            setSelectedPersona(defaults.persona);
          }
        }
      } catch (error) {
        console.error('Error loading personas:', error);
      }
    };

    loadPersonas();
  }, []);

  // Update custom prompt when persona changes
  useEffect(() => {
    if (selectedPersona === 'custom') return;

    const persona = personas.find(p => p.id === selectedPersona);
    if (persona) {
      setCustomPrompt(persona.prompt);
    }
  }, [selectedPersona, personas]);

  // Filter models based on selected mode and provider
  const filteredModels = useMemo(() => {
    if (!models.length) return [];

    return models.filter(model => {
      // Only show models that belong to the selected provider
      if (model.provider !== selectedProvider) return false;

      // For image mode, only show models with vision capability
      if (mode === 'image' && !model.capabilities.includes('vision')) return false;

      // For RAG mode, only show models with chat capability
      if (mode === 'rag' && !model.capabilities.includes('chat')) return false;

      // For audio mode, only show models with audio capability
      if (mode === 'audio' && !model.capabilities.includes('audio')) return false;

      return true;
    });
  }, [models, selectedProvider, mode]);

  // Handle provider change
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedModel(''); // Reset model when provider changes
  };

  // Handle mode change
  const handleModeChange = (newMode: string) => {
    setMode(newMode);

    // Reset selected model if it doesn't support the new mode
    const currentModel = models.find(m => m.id === selectedModel);
    if (currentModel) {
      const supportsMode =
        (newMode === 'image' && currentModel.capabilities.includes('vision')) ||
        (newMode === 'rag' && currentModel.capabilities.includes('chat')) ||
        (newMode === 'audio' && currentModel.capabilities.includes('audio')) ||
        (newMode === 'chat');

      if (!supportsMode) {
        // Find a suitable default model for this mode and provider
        const suitableModel = models.find(m =>
          m.provider === selectedProvider &&
          ((newMode === 'image' && m.capabilities.includes('vision')) ||
            (newMode === 'rag' && m.capabilities.includes('chat')) ||
            (newMode === 'audio' && m.capabilities.includes('audio')) ||
            (newMode === 'chat'))
        );

        if (suitableModel) {
          setSelectedModel(suitableModel.id);
        } else {
          setSelectedModel('');
        }
      }
    }
  };

  // Handle saving settings as defaults
  const saveDefaults = () => {
    try {
      const defaults: DefaultSettings = {
        provider: selectedProvider,
        model: selectedModel,
        persona: selectedPersona,
        maxTokens: maxTokens,
      };

      localStorage.setItem('omniChatDefaults', JSON.stringify(defaults));
      setDefaultsSaved(true);

      // Show success message briefly
      setTimeout(() => {
        setDefaultsSaved(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving defaults:', error);
    }
  };

  // Handle applying settings
  const applySettings = () => {
    // Apply the current settings
    
    // Also save as defaults if that option is checked
    if (saveAsDefaults) {
      saveDefaults();
    }

    onClose();
  };

  return (
    <div className="w-full bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 z-10 max-h-[80vh] overflow-y-auto">
      <div className="sticky top-0 p-4 border-b border-gray-200 dark:border-dark-700 flex justify-between items-center bg-white dark:bg-dark-800">
        <h2 className="text-lg font-semibold">Settings</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-dark-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Theme Settings */}
        <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold mb-3">Theme Settings</h3>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Mode</label>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center p-2 rounded-md ${
                  theme === "light" 
                    ? "bg-primary-100 text-primary-700 border-2 border-primary-400" 
                    : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-600"
                }`}
                title="Light Mode"
              >
                <Sun className="w-5 h-5 mr-2" />
                <span>Light</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center p-2 rounded-md ${
                  theme === "dark" 
                    ? "bg-primary-100 text-primary-700 border-2 border-primary-400" 
                    : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-600"
                }`}
                title="Dark Mode"
              >
                <Moon className="w-5 h-5 mr-2" />
                <span>Dark</span>
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`flex items-center justify-center p-2 rounded-md ${
                  theme === "system" 
                    ? "bg-primary-100 text-primary-700 border-2 border-primary-400" 
                    : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-600"
                }`}
                title="System Mode"
              >
                <Monitor className="w-5 h-5 mr-2" />
                <span>System</span>
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Color Theme</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button
                onClick={() => setColorTheme("blue")}
                className={`flex flex-col items-center justify-center p-3 rounded-md ${
                  colorTheme === "blue" 
                    ? "bg-primary-100 text-primary-700 border-2 border-primary-400" 
                    : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-600"
                }`}
              >
                <div className="w-full h-8 mb-2 rounded-md bg-gradient-to-r from-blue-400 to-blue-600"></div>
                <span className="text-xs">Blue</span>
              </button>
              <button
                onClick={() => setColorTheme("teal")}
                className={`flex flex-col items-center justify-center p-3 rounded-md ${
                  colorTheme === "teal" 
                    ? "bg-primary-100 text-primary-700 border-2 border-primary-400" 
                    : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-600"
                }`}
              >
                <div className="w-full h-8 mb-2 rounded-md bg-gradient-to-r from-teal-400 to-teal-600"></div>
                <span className="text-xs">Teal</span>
              </button>
              <button
                onClick={() => setColorTheme("purple")}
                className={`flex flex-col items-center justify-center p-3 rounded-md ${
                  colorTheme === "purple" 
                    ? "bg-primary-100 text-primary-700 border-2 border-primary-400" 
                    : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-600"
                }`}
              >
                <div className="w-full h-8 mb-2 rounded-md bg-gradient-to-r from-purple-400 to-purple-600"></div>
                <span className="text-xs">Purple</span>
              </button>
              <button
                onClick={() => setColorTheme("gray")}
                className={`flex flex-col items-center justify-center p-3 rounded-md ${
                  colorTheme === "gray" 
                    ? "bg-primary-100 text-primary-700 border-2 border-primary-400" 
                    : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-dark-600"
                }`}
              >
                <div className="w-full h-8 mb-2 rounded-md bg-gradient-to-r from-gray-400 to-gray-600"></div>
                <span className="text-xs">Gray</span>
              </button>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Mode</label>
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 py-2 px-3 text-sm"
          >
            <option value="chat">Chat Mode</option>
            <option value="rag">RAG Mode</option>
            <option value="image">Image Mode</option>
            <option value="audio">Audio Mode</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Provider</label>
          <select
            value={selectedProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 py-2 px-3 text-sm"
          >
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 py-2 px-3 text-sm"
          >
            {filteredModels.length === 0 ? (
              <option value="">No compatible models available</option>
            ) : (
              filteredModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.economical ? '(Economical)' : ''}
                </option>
              ))
            )}
          </select>
          {filteredModels.length === 0 && models.length > 0 && (
            <p className="text-xs text-orange-500 mt-1">
              No models available for this provider that support {mode} mode.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Persona</label>
          <select
            value={selectedPersona}
            onChange={(e) => setSelectedPersona(e.target.value)}
            className="w-full rounded-md border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 py-2 px-3 text-sm"
          >
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>
        </div>

        {selectedPersona === 'custom' && (
          <div>
            <label className="block text-sm font-medium mb-1">Custom Prompt</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 py-2 px-3 text-sm"
              placeholder="Enter your custom system prompt here..."
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">
            Temperature: {temperature.toFixed(1)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-dark-600 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Max Tokens: {maxTokens}
          </label>
          <input
            type="range"
            min="500"
            max="8000"
            step="100"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-dark-600 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Shorter</span>
            <span>Longer</span>
          </div>
        </div>

        {/* Fixed value for Max Tokens option (5000) */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setMaxTokens(5000)}
            className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800/40"
          >
            Set 5000 tokens
          </button>
          <span className="text-xs text-gray-500">
            Quick setting for recommended token limit
          </span>
        </div>

        {/* Save as Defaults Option */}
        <div className="flex items-center mt-4 py-2 border-t border-gray-200 dark:border-dark-700">
          <input
            type="checkbox"
            id="saveDefaults"
            checked={saveAsDefaults}
            onChange={(e) => setSaveAsDefaults(e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="saveDefaults" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Save these settings as defaults for new chats
          </label>
        </div>

        {/* Save Defaults Button */}
        <div className="flex items-center justify-between">
          <button
            onClick={saveDefaults}
            className="flex items-center text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            <Save className="w-4 h-4 mr-1" />
            Save current settings as defaults
          </button>

          {defaultsSaved && (
            <span className="text-xs text-green-600 dark:text-green-400 animate-fadeOut">
              ✓ Defaults saved!
            </span>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 p-4 border-t border-gray-200 dark:border-dark-700 grid grid-cols-2 gap-3 bg-white dark:bg-dark-800">
        <button
          onClick={onClose}
          className="py-2 px-4 rounded-md border border-gray-300 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={applySettings}
          className="py-2 px-4 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm"
        >
          Apply Settings
        </button>
      </div>
    </div>
  );
}