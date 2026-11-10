console.log("Main JavaScript loaded!");

if (window.supabaseClient) {
    console.log("Supabase client:", window.supabaseClient);
} else {
    console.error("Supabase client is not initialized!");
}
