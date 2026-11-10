const SUPABASE_URL = 'https://bmtikgyesxutrrupudph.supabase.co/rest/v1/';

const SUPABASE_KEY = 'sb_publishable_IDm_YKqPXQjIMXu-k5eqWA_LXMpdTvV';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

window.supabaseClient = supabaseClient;

console.log('Supabase connected!');
