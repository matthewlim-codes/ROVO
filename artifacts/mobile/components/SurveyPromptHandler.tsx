import React, { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

import { apiFetch } from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { PendingSurvey, RideSurveyModal } from "@/components/RideSurveyModal";

export function SurveyPromptHandler() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingSurvey[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<PendingSurvey | null>(null);

  const refreshPending = useCallback(async () => {
    if (!user?.id) {
      setPending([]);
      return;
    }
    try {
      const rows = await apiFetch<PendingSurvey[]>("/surveys/pending");
      setPending(rows);
      setActiveSurvey((current) => {
        if (current) return current;
        return rows[0] ?? null;
      });
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setPending([]);
      setActiveSurvey(null);
      return;
    }
    refreshPending();
    const interval = setInterval(refreshPending, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshPending();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [user?.id, refreshPending]);

  const handleClose = () => {
    setActiveSurvey(null);
  };

  const handleSubmitted = () => {
    setPending((prev) => prev.filter((p) => p.matchEventId !== activeSurvey?.matchEventId));
    setActiveSurvey(null);
    setTimeout(refreshPending, 500);
  };

  useEffect(() => {
    if (!activeSurvey && pending.length > 0) {
      setActiveSurvey(pending[0]);
    }
  }, [activeSurvey, pending]);

  return (
    <RideSurveyModal
      survey={activeSurvey}
      onClose={handleClose}
      onSubmitted={handleSubmitted}
    />
  );
}
