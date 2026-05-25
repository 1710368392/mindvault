// ========== Supabase 认证相关类型 ==========

/** 云端用户信息 */
export interface CloudUser {
  id: string;           // Supabase auth.uid
  email: string;
  nickname: string;
  avatar: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}

/** 认证状态 */
export interface AuthState {
  user: CloudUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
