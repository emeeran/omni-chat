"use client";

import { useContext } from 'react';
import { ApplicationThemeContext } from '@/components/ApplicationThemeProvider';

export function useApplicationTheme() {
  const context = useContext(ApplicationThemeContext);
  
  if (context === undefined) {
    throw new Error('useApplicationTheme must be used within an ApplicationThemeProvider');
  }
  
  return context;
} 