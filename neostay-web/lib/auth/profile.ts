export type UserRole = "super_admin" | "hotel_admin";

export type AuthProfile = {
  role: UserRole;
  hotelId: string | null;
  hotelSlug: string | null;
};
