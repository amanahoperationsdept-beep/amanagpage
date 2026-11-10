(() => {
    // SUPABASE CONFIGURATION
    const SUPABASE_URL = "https://bmtikgyesxutrrupudph.supabase.co/rest/v1/";
    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_IDm_YKqPXQjIMXu-k5eqWA_LXMpdTvV";

    // Check whether Supabase library is loaded
    if (!window.supabase || !window.supabase.createClient) {
        console.error("Supabase library not loaded!");
        return;
    }

    // Prevent duplicate initialization
    if (window.supabaseClient) {
        console.log("Supabase client already initialized.");
        return;
    }

    // Create one shared client
    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

    console.log("Supabase connected successfully!");
})();
