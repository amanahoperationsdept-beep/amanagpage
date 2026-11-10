import { createClient } from
  'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://bmtikgyesxutrrupudph.supabase.co/rest/v1/'

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IDm_YKqPXQjIMXu-k5eqWA_LXMpdTvV'

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
)

console.log('Supabase initialized!')
