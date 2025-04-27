import { useState, useEffect } from 'react';
import { X, Loader2, ChevronDown } from 'lucide-react';
import { Provider, Model, getProviders, getModels } from '@/lib/api';

interface RetryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry: (provider: string, model: string) => void;
  currentProvider: string;
  currentModel: string;
}

export default function RetryDialog({
  isOpen,
  onClose,
  onRetry,
  currentProvider,
  currentModel
}: RetryDialogProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedProvider, setSelectedProvider] = useState(currentProvider);
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [loading, setLoading] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const providersData = await getProviders();
        setProviders(providersData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching providers:', error);
        setProviders([]);
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchProviders();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchModels = async () => {
      if (!selectedProvider) return;
      
      try {
        setLoadingModels(true);
        const modelsData = await getModels(selectedProvider);
        setModels(modelsData);
        
        // If the current model doesn't belong to the selected provider,
        // choose the default model or the first one
        const modelBelongsToProvider = modelsData.some(m => m.id === selectedModel);
        if (!modelBelongsToProvider) {
          const defaultModel = modelsData.find(m => m.default);
          setSelectedModel(defaultModel?.id || modelsData[0]?.id || '');
        }
        
        setLoadingModels(false);
      } catch (error) {
        console.error('Error fetching models:', error);
        setModels([]);
        setLoadingModels(false);
      }
    };

    fetchModels();
  }, [selectedProvider, selectedModel]);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProvider(e.target.value);
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
  };

  const handleSubmit = () => {
    onRetry(selectedProvider, selectedModel);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Retry With Different Model</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">Provider</label>
              <div className="relative">
                <select
                  value={selectedProvider}
                  onChange={handleProviderChange}
                  className="w-full pl-3.5 pr-8 py-2.5 border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:outline-none appearance-none shadow-sm"
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Model</label>
                {loadingModels && (
                  <Loader2 className="animate-spin h-4 w-4 text-blue-500" />
                )}
              </div>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={handleModelChange}
                  className={`w-full pl-3.5 pr-8 py-2.5 border border-gray-200 dark:border-gray-700 bg-white/90 dark:bg-gray-800/90 rounded-xl text-sm font-medium text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-400 focus:outline-none appearance-none shadow-sm ${loadingModels ? 'opacity-70' : ''}`}
                  disabled={loadingModels}
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              </div>
            </div>

            <div className="flex justify-end mt-6 space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 