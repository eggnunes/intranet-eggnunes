import { useState, useEffect } from 'react';

export interface ProcessingHistoryItem {
  id: string;
  timestamp: number;
  fileCount: number;
  processingTime: number; // em segundos
  documentCount: number;
  mergedAll: boolean;
}

const STORAGE_KEY = 'docuprocess-history';
const MAX_HISTORY_ITEMS = 20;

export const useProcessingHistory = () => {
  const [history, setHistory] = useState<ProcessingHistoryItem[]>([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setHistory(parsed);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const addToHistory = (item: Omit<ProcessingHistoryItem, 'id' | 'timestamp'>) => {
    const newItem: ProcessingHistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    const updatedHistory = [newItem, ...history].slice(0, MAX_HISTORY_ITEMS);
    setHistory(updatedHistory);
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
    }
  };

  return { history, addToHistory, clearHistory };
};
