import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { HouseholdEvent } from "../../shared/types.ts";

/**
 * Écoute le flux temps réel du foyer et rafraîchit les données concernées.
 * EventSource se reconnecte tout seul après une coupure (réseau mobile, mise en veille).
 */
export function useHouseholdEvents() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onmessage = (message) => {
      const event = JSON.parse(message.data as string) as HouseholdEvent;
      if (event.topic === "list" && event.id) void queryClient.invalidateQueries({ queryKey: ["list", event.id] });
      if (event.topic === "lists") void queryClient.invalidateQueries({ queryKey: ["lists"] });
      if (event.topic === "products") {
        void queryClient.invalidateQueries({ queryKey: ["products"] });
        void queryClient.invalidateQueries({ queryKey: ["list"] });
      }
    };
    // Au retour de connexion, on resynchronise tout ce qui a pu changer entre-temps
    source.onopen = () => void queryClient.invalidateQueries({ queryKey: ["list"] });
    return () => source.close();
  }, [queryClient]);
}
