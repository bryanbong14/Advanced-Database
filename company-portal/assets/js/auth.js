const loginForm = document.querySelector("form");

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.querySelector("input[type='email']").value;
    const password = document.querySelector("input[type='password']").value;

    // STEP 1: LOGIN USING SUPABASE AUTH
    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        alert("Login Failed: " + error.message);
        return;
    }

    const user = data.user;

    // STEP 2: GET USER ROLE FROM YOUR DATABASE TABLE
    const { data: profile, error: profileError } = await supabaseClient
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

    if (profileError) {
        alert("Profile error: " + profileError.message);
        return;
    }

    // STEP 3: STORE SESSION DATA
    localStorage.setItem("userRole", profile.role);
    localStorage.setItem("userName", profile.full_name);

    // STEP 4: REDIRECT BY ROLE
    if (profile.role === "admin") {
        window.location.href = "dashboard.html";
    }

    else if (profile.role === "finance") {
        window.location.href = "dashboard.html";
    }

    else if (profile.role === "sales") {
        window.location.href = "dashboard.html";
    }

    else if (profile.role === "warehouse") {
        window.location.href = "dashboard.html";
    }

    else {
        alert("Invalid role");
    }
});