export const ROLES = ["captain", "keeper"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return ROLES.includes(value as Role);
}

export const ROLE_INFO: Record<Role, { title: string; description: string }> = {
  captain: {
    title: "Le Capitaine",
    description: "À la barre du navire, perdu dans la brume. Voit les étoiles, pas la carte.",
  },
  keeper: {
    title: "Le Gardien du Phare",
    description: "Au sommet de la tour, avec la carte et le projecteur. Ne voit pas le bateau.",
  },
};
