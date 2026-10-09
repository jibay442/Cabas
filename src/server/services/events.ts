// Diffusion temps réel par foyer, en mémoire : suffisant pour un conteneur unique.

import type { HouseholdEvent } from "../../shared/types.ts";

type Send = (event: HouseholdEvent) => void;

const subscribers = new Map<string, Set<Send>>();

export function publish(householdId: string, event: HouseholdEvent) {
  for (const send of subscribers.get(householdId) ?? []) send(event);
}

/** Abonne un client aux évènements du foyer ; renvoie la fonction de désabonnement. */
export function subscribe(householdId: string, send: Send): () => void {
  const set = subscribers.get(householdId) ?? new Set<Send>();
  set.add(send);
  subscribers.set(householdId, set);
  return () => {
    set.delete(send);
    if (!set.size) subscribers.delete(householdId);
  };
}
