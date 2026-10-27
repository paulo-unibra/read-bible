import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import authService from "../services/AuthService";
import {
  getMyCertificates,
  ReadingCertificate,
} from "../services/AchievementService";

export function useCertificates() {
  const [certificates, setCertificates] = useState<ReadingCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const owner = useRef<number | null>(null);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      await authService.init();
      const userId = authService.getUser()?.id ?? null;
      if (owner.current !== userId) setCertificates([]);
      owner.current = userId;
      const data = await getMyCertificates();
      if (generation.current === request) setCertificates(data);
    } catch (err) {
      console.error("[useCertificates] Falha ao carregar conquistas", err);
      if (generation.current === request)
        setError(
          err instanceof Error ? err.message : "Falha ao carregar conquistas.",
        );
    } finally {
      if (generation.current === request) setLoading(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      return () => {
        generation.current++;
      };
    }, [refresh]),
  );
  return { certificates, loading, error, refresh };
}
