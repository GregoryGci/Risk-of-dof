// Browser adapter used only by the local practice page's authoritative simulation.
export const randomUUID = (): `${string}-${string}-${string}-${string}-${string}` => crypto.randomUUID();
