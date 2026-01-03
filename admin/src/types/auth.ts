export interface User {
  id: number;
  email: string;
  fullName: string | null;
  roles: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  permissions: string[];
}

export interface LoginResponse {
  type: string;
  token: string;
  user: User;
}
