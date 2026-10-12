export interface HealthResponse {
  status: "ok";
  database: "ok" | "erro";
  timestamp: string;
}

export const UserRole = {
  ADMIN: "ADMIN",
  ASSOCIATE: "ASSOCIATE",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
