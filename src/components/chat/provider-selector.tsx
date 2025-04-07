'use client';

import { useState } from 'react';
import { PROVIDERS, Provider } from '@/lib/utils';
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

interface ProviderSelectorProps {
    currentProvider: Provider;
    onProviderChange: (provider: Provider) => void;
    disabled?: boolean;
}

export function ProviderSelector({
    currentProvider,
    onProviderChange,
    disabled = false
}: ProviderSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleDropdown = () => {
        if (!disabled) {
            setIsOpen(!isOpen);
        }
    };

    const handleProviderSelect = (provider: Provider) => {
        onProviderChange(provider);
        setIsOpen(false);
    };

    const currentProviderLabel = PROVIDERS.find(p => p.id === currentProvider)?.label || 'Select Provider';

    return (
        <div className="relative">
            <button
                onClick={toggleDropdown}
                className={`flex items-center justify-between w-full px-4 py-2 text-sm font-medium bg-muted/60 rounded-lg ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'
                    }`}
                disabled={disabled}
            >
                <span>{currentProviderLabel}</span>
                <ChevronDownIcon className="h-4 w-4 ml-2" />
            </button>

            {isOpen && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-background shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="py-1 max-h-60 overflow-auto">
                        {PROVIDERS.map((provider) => (
                            <button
                                key={provider.id}
                                onClick={() => handleProviderSelect(provider.id as Provider)}
                                className="flex items-center justify-between w-full px-4 py-2 text-sm hover:bg-muted/70"
                            >
                                <span>{provider.label}</span>
                                {currentProvider === provider.id && (
                                    <CheckIcon className="h-4 w-4 text-primary" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}