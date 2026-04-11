// Supabase クライアントのファクトリー
// Workers 環境変数（service_role キー）でクライアントを生成する。
// service_role を使うため RLS はバイパスされ、サーバー側で権限チェックを行う前提。

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../types';

export type DB = SupabaseClient;

export function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
