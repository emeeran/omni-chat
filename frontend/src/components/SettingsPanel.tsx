import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Provider, Model, Persona, getProviders, getModels, getPersonas } from '@/lib/api';

type SettingsPanelProps = {
  onClose: () => void;
};

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

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providersData = await getProviders();
        setProviders(providersData);
        
        // Set default provider if available
        const defaultProvider = providersData.find(p => p.default);
        if (defaultProvider) {
          setSelectedProvider(defaultProvider.id);
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
        
        // Set default model if available
        const defaultModel = modelsData.find(m => m.default);
        if (defaultModel) {
          setSelectedModel(defaultModel.id);
        } else if (modelsData.length > 0) {
          setSelectedModel(modelsData[0].id);
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

  // Handle provider change
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedModel(''); // Reset model when provider changes
  };

  // Handle mode change
  const handleModeChange = (newMode: string) => {
    setMode(newMode);
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
            {models.length === 0 ? (
              <option value="">Loading models...</option>
            ) : (
              models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))
            )}
          </select>
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
            max="4000"
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
      </div>
      
      <div className="sticky bottom-0 p-4 border-t border-gray-200 dark:border-dark-700 grid grid-cols-2 gap-3 bg-white dark:bg-dark-800">
        <button
          onClick={onClose}
          className="py-2 px-4 rounded-md border border-gray-300 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onClose}
          className="py-2 px-4 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-sm"
        >
          Apply Settings
        </button>
      </div>
    </div>
  );
} 