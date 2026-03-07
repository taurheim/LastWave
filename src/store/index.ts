import { create } from 'zustand';
import type LoadingStage from '../core/models/LoadingStage';

export interface Toast {
  id: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  createdAt: number;
}

interface LastWaveState {
  // Logging
  logs: string[];
  log: (message: string) => void;

  // Toasts
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;

  // Options
  rendererOptions: Record<string, any>;
  dataSourceOptions: Record<string, any>;
  setRendererOption: (key: string, value: any) => void;
  setDataSourceOption: (key: string, value: any) => void;
  setRendererOptions: (options: Record<string, any>) => void;
  setDataSourceOptions: (options: Record<string, any>) => void;

  // UI State
  showOptions: boolean;
  showLoadingBar: boolean;
  showActions: boolean;
  showVisualization: boolean;
  setShowOptions: (show: boolean) => void;
  setShowLoadingBar: (show: boolean) => void;
  setShowActions: (show: boolean) => void;
  setShowVisualization: (show: boolean) => void;

  // Loading stages
  stages: LoadingStage[];
  currentStage: number;
  setStages: (stages: LoadingStage[]) => void;
  startNextStage: (segmentCount: number) => void;
  progressCurrentStage: () => void;

  // Reset to initial state (for "back to options")
  resetToOptions: () => void;
}

export const useLastWaveStore = create<LastWaveState>((set, get) => ({
  // Logging
  logs: [],
  log: (message: string) => set((state) => ({ logs: [...state.logs, message] })),

  // Toasts
  toasts: [],
  addToast: (message, type = 'error') =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, message, type, createdAt: Date.now() },
      ],
    })),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  // Options
  rendererOptions: {},
  dataSourceOptions: { username: 'Taurheim' },
  setRendererOption: (key, value) =>
    set((state) => ({ rendererOptions: { ...state.rendererOptions, [key]: value } })),
  setDataSourceOption: (key, value) =>
    set((state) => ({ dataSourceOptions: { ...state.dataSourceOptions, [key]: value } })),
  setRendererOptions: (options) => set({ rendererOptions: options }),
  setDataSourceOptions: (options) => set({ dataSourceOptions: options }),

  // UI State
  showOptions: true,
  showLoadingBar: false,
  showActions: false,
  showVisualization: false,
  setShowOptions: (show) => set({ showOptions: show }),
  setShowLoadingBar: (show) => set({ showLoadingBar: show }),
  setShowActions: (show) => set({ showActions: show }),
  setShowVisualization: (show) => set({ showVisualization: show }),

  // Loading stages
  stages: [],
  currentStage: -1,
  setStages: (stages) => set({ stages, currentStage: -1 }),
  startNextStage: (segmentCount) =>
    set((state) => {
      const nextStage = state.currentStage + 1;
      const newStages = [...state.stages];
      if (newStages[nextStage]) {
        newStages[nextStage] = {
          ...newStages[nextStage],
          currentSegment: 0,
          stageSegments: segmentCount,
        };
      }
      return { currentStage: nextStage, stages: newStages };
    }),
  progressCurrentStage: () =>
    set((state) => {
      const newStages = [...state.stages];
      const current = newStages[state.currentStage];
      if (current) {
        newStages[state.currentStage] = {
          ...current,
          currentSegment: current.currentSegment + 1,
        };
      }
      return { stages: newStages };
    }),

  // Reset
  resetToOptions: () =>
    set({
      showOptions: true,
      showLoadingBar: false,
      showActions: false,
      showVisualization: false,
      stages: [],
      currentStage: -1,
    }),
}));
