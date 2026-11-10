(() => {
    // SUPABASE CONFIGURATION
    // Pass the project root URL to createClient(). Do not append /rest/v1;
    // supabase-js constructs the REST and Realtime endpoints itself.
    const SUPABASE_URL = "https://bmtikgyesxutrrupudph.supabase.co";
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

    // Create one shared client. Client creation does not by itself prove
    // that the project is reachable; verify actual requests in the app.
    window.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY,
        {
            auth: {
                persistSession: false
            }
        }
    );

    console.log("Supabase client initialized.");
})();
