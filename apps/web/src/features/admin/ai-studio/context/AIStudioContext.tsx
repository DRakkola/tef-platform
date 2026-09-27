import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type {
  BenchmarkSample,
  AIPromptTemplate,
  SpeakingExaminerConfigItem,
} from "../types";

interface AIStudioContextType {
  isSimulation: boolean;
  setIsSimulation: (value: boolean) => void;
  apiKeyOverride: string;
  setApiKeyOverride: (value: string) => void;
  benchmarks: BenchmarkSample[];
  templates: AIPromptTemplate[];
  speakingConfigs: SpeakingExaminerConfigItem[];
  isLoadingGlobal: boolean;
  refreshTemplates: () => Promise<void>;
  refreshSpeakingConfigs: () => Promise<void>;
  getAuthHeaders: (includeJsonContentType?: boolean) => Record<string, string>;
}

const AIStudioContext = createContext<AIStudioContextType | undefined>(undefined);

export const AIStudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSimulation, setIsSimulationState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("tef_ai_studio_simulation");
      return stored !== null ? stored === "true" : false;
    }
    return false;
  });

  const [apiKeyOverride, setApiKeyOverride] = useState<string>("");
  const [benchmarks, setBenchmarks] = useState<BenchmarkSample[]>([]);
  const [templates, setTemplates] = useState<AIPromptTemplate[]>([]);
  const [speakingConfigs, setSpeakingConfigs] = useState<SpeakingExaminerConfigItem[]>([]);
  const [isLoadingGlobal, setIsLoadingGlobal] = useState<boolean>(false);

  const setIsSimulation = (val: boolean) => {
    setIsSimulationState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("tef_ai_studio_simulation", String(val));
    }
  };

  const getCsrfToken = (): string | null => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  const getAuthHeaders = useCallback(
    (includeJsonContentType = true): Record<string, string> => {
      const headers: Record<string, string> = {};
      if (includeJsonContentType) {
        headers["Content-Type"] = "application/json";
      }
      if (typeof window !== "undefined") {
        const token = localStorage.getItem("auth_token");
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const csrf = getCsrfToken();
        if (csrf) {
          headers["X-CSRF-Token"] = csrf;
        }
      }
      return headers;
    },
    []
  );

  const fetchBenchmarks = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/ai-sandbox/benchmarks", {
        headers: getAuthHeaders(false),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setBenchmarks(data.samples || []);
      }
    } catch (err) {
      console.error("Failed to fetch benchmarks:", err);
    }
  }, [getAuthHeaders]);

  const refreshTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/ai-sandbox/templates", {
        headers: getAuthHeaders(false),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    }
  }, [getAuthHeaders]);

  const refreshSpeakingConfigs = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/admin/ai-sandbox/speaking/config", {
        headers: getAuthHeaders(false),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setSpeakingConfigs(data || []);
      }
    } catch (err) {
      console.error("Failed to fetch speaking configs:", err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    const init = async () => {
      setIsLoadingGlobal(true);
      await Promise.allSettled([
        fetchBenchmarks(),
        refreshTemplates(),
        refreshSpeakingConfigs(),
      ]);
      setIsLoadingGlobal(false);
    };
    init();
  }, [fetchBenchmarks, refreshTemplates, refreshSpeakingConfigs]);

  return (
    <AIStudioContext.Provider
      value={{
        isSimulation,
        setIsSimulation,
        apiKeyOverride,
        setApiKeyOverride,
        benchmarks,
        templates,
        speakingConfigs,
        isLoadingGlobal,
        refreshTemplates,
        refreshSpeakingConfigs,
        getAuthHeaders,
      }}
    >
      {children}
    </AIStudioContext.Provider>
  );
};

export const useAIStudio = (): AIStudioContextType => {
  const context = useContext(AIStudioContext);
  if (!context) {
    throw new Error("useAIStudio must be used within an AIStudioProvider");
  }
  return context;
};
