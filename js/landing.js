// js/landing.js

document.addEventListener("DOMContentLoaded", () => {
    // Track if user is currently logged in
    let isUserLoggedIn = false;

    // Track if we are in "Forgot Password" mode inside the login modal
    let isForgotPasswordMode = false;

    function updateLandingUI(session) {
        const navLoginLink = document.querySelector('a[href="#login"]') || document.querySelector('a[href="dashboard.html"]');
        const profileBtn = document.getElementById('user-profile-btn');
        
        if (session) {
            isUserLoggedIn = true;
            if (navLoginLink) {
                navLoginLink.textContent = "Tanuló Felület";
                navLoginLink.href = "dashboard.html";
            }
            if (profileBtn) {
                const username = session.user?.user_metadata?.username || session.user?.email?.split('@')[0] || "Felhasználó";
                profileBtn.textContent = `Szia, ${username}!`;
                profileBtn.style.display = "inline-block";
            }
        } else {
            // Check for active guest
            const guestProgress = localStorage.getItem("neolix_guest_progress");
            const isGuestLoggedOut = localStorage.getItem("guest_logged_out") === "true";
            
            if (guestProgress && !isGuestLoggedOut) {
                isUserLoggedIn = true; // Functionally logged in for UI
                if (navLoginLink) {
                    navLoginLink.textContent = "Tanuló Felület";
                    navLoginLink.href = "dashboard.html";
                }
                if (profileBtn) {
                    profileBtn.textContent = `Szia, Vendég!`;
                    profileBtn.style.display = "inline-block";
                }
            } else {
                isUserLoggedIn = false;
                if (navLoginLink) {
                    navLoginLink.textContent = "Bejelentkezés / Regisztráció";
                    navLoginLink.href = "#login";
                }
                if (profileBtn) {
                    profileBtn.style.display = "none";
                }
            }
        }
    }

    // Check PHP session on page load
    async function checkSession() {
        try {
            const res = await fetch(`${API_URL}?action=get_session`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.session) {
                    updateLandingUI(data.session);
                } else {
                    updateLandingUI(null);
                }
            } else {
                updateLandingUI(null);
            }
        } catch (err) {
            console.warn("Session check failed, falling back to guest mode:", err);
            updateLandingUI(null);
        }
    }

    checkSession();

    // Global state to hold the level chosen before showing modal
    let pendingGuestLevel = "A1";

    // Setup Level Card Redirection for Guests
    const levelButtons = document.querySelectorAll(".landing-level-btn");
    levelButtons.forEach(button => {
        button.addEventListener("click", (event) => {
            event.preventDefault();
            const pickedLevel = button.getAttribute("data-level");

            if (pickedLevel === "A1") {
                if (isUserLoggedIn) {
                    // Logged in users bypass the auth modal check
                    localStorage.setItem("selectedLevel", pickedLevel);
                    window.location.href = "dashboard.html";
                } else {
                    // Guests get intercepted to choose their login method
                    pendingGuestLevel = pickedLevel;
                    openLoginModal();
                }
            } else if (pickedLevel === "A2" || pickedLevel === "B1" || pickedLevel === "B2") {
                openWipModal();
            }
        });
    });

    // Setup General WIP Modal Listeners
    const wipModal = document.getElementById("wip-modal");
    const closeWipBtn = document.getElementById("close-wip-btn");

    if (closeWipBtn && wipModal) {
        closeWipBtn.addEventListener("click", closeWipModal);
    }

    function openWipModal() {
        wipModal.classList.add("is-active");
        wipModal.setAttribute("aria-hidden", "false");
    }

    function closeWipModal() {
        wipModal.classList.remove("is-active");
        wipModal.setAttribute("aria-hidden", "true");
    }

    // Setup Verify Email Modal Listeners (Keep as fallback display helper)
    const closeVerifyEmailBtn = document.getElementById("close-verify-email-btn");
    if (closeVerifyEmailBtn) {
        closeVerifyEmailBtn.addEventListener("click", () => {
            const verifyModal = document.getElementById("verify-email-modal");
            if (verifyModal) {
                verifyModal.classList.remove("is-active");
                verifyModal.setAttribute("aria-hidden", "true");
            }
        });
    }

    // Setup Authentication Modal Controls
    const loginModal = document.getElementById("login-modal");
    const closeLoginBtn = document.getElementById("close-login-btn");
    const navLoginLink = document.querySelector('a[href="#login"]');

    if (navLoginLink && loginModal) {
        navLoginLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (navLoginLink.textContent === "Tanuló Felület") {
                window.location.href = "dashboard.html";
            } else {
                openLoginModal();
            }
        });
    }

    if (closeLoginBtn && loginModal) {
        closeLoginBtn.addEventListener("click", closeLoginModal);
    }

    function openLoginModal() {
        loginModal.classList.add("is-active");
        loginModal.setAttribute("aria-hidden", "false");
        document.getElementById("auth-error").textContent = "";
        resetForgotPasswordMode();
    }

    function closeLoginModal() {
        loginModal.classList.remove("is-active");
        loginModal.setAttribute("aria-hidden", "true");
    }

    // Setup Guest Login Action
    const guestLoginBtn = document.getElementById("guest-login-btn");
    if (guestLoginBtn) {
        guestLoginBtn.addEventListener("click", () => {
            // Save the intercepted level and boot them into the dashboard
            localStorage.setItem("selectedLevel", pendingGuestLevel);
            // Clear any previous visual logout state for guests
            localStorage.removeItem("guest_logged_out");
            window.location.href = "dashboard.html";
        });
    }

    // Auto-open Register Modal if redirected from Guest Profile
    if (localStorage.getItem("forceRegisterModal") === "true") {
        localStorage.removeItem("forceRegisterModal");
        openLoginModal();
        
        // Wait a small tick for the DOM to be ready to click the register tab
        setTimeout(() => {
            const tabRegister = document.getElementById("tab-register");
            if (tabRegister) tabRegister.click();
        }, 50);
    }

    // Setup Login / Register Tab Switching
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const groupUsername = document.getElementById("group-username");
    const groupAge = document.getElementById("group-age");
    const btnSubmitAuth = document.getElementById("btn-submit-auth");
    
    let isRegisterMode = false;

    if (tabLogin && tabRegister) {
        tabLogin.addEventListener("click", () => {
            if (isForgotPasswordMode) return;
            isRegisterMode = false;
            tabLogin.classList.add("active");
            tabRegister.classList.remove("active");
            tabLogin.style.color = "var(--color-text-main)";
            tabRegister.style.color = "var(--color-text-muted)";
            
            groupUsername.style.display = "none";
            groupAge.style.display = "none";
            btnSubmitAuth.textContent = "Bejelentkezés";
            document.getElementById("auth-error").textContent = "";
        });

        tabRegister.addEventListener("click", () => {
            if (isForgotPasswordMode) return;
            isRegisterMode = true;
            tabRegister.classList.add("active");
            tabLogin.classList.remove("active");
            tabRegister.style.color = "var(--color-text-main)";
            tabLogin.style.color = "var(--color-text-muted)";
            
            groupUsername.style.display = "flex";
            groupAge.style.display = "flex";
            btnSubmitAuth.textContent = "Regisztráció";
            document.getElementById("auth-error").textContent = "";
        });
    }

    // --- Forgot Password Toggle Logic ---
    const forgotPasswordLink = document.getElementById("forgot-password-link");
    const forgotPasswordBackLink = document.getElementById("forgot-password-back-link");
    const forgotPasswordBackContainer = document.getElementById("forgot-password-back-container");
    const groupPassword = document.getElementById("group-password");
    const emailLabel = document.querySelector('label[for="auth-email"]');
    const emailInput = document.getElementById("auth-email");
    const tabsContainer = document.querySelector(".auth-tabs");

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener("click", (e) => {
            e.preventDefault();
            enableForgotPasswordMode();
        });
    }

    if (forgotPasswordBackLink) {
        forgotPasswordBackLink.addEventListener("click", (e) => {
            e.preventDefault();
            resetForgotPasswordMode();
        });
    }

    function enableForgotPasswordMode() {
        isForgotPasswordMode = true;
        if (tabsContainer) tabsContainer.style.display = "none";
        if (groupUsername) groupUsername.style.display = "none";
        if (groupAge) groupAge.style.display = "none";
        if (groupPassword) groupPassword.style.display = "none";
        if (guestLoginBtn) guestLoginBtn.style.display = "none";
        if (forgotPasswordBackContainer) forgotPasswordBackContainer.style.display = "block";
        
        if (emailLabel) emailLabel.textContent = "Kérjük, add meg a regisztrált e-mail címed:";
        if (emailInput) {
            emailInput.required = true;
            emailInput.placeholder = "email@domain.com";
        }
        if (btnSubmitAuth) btnSubmitAuth.textContent = "Visszaállítási link küldése";
        document.getElementById("auth-error").textContent = "";
    }

    function resetForgotPasswordMode() {
        isForgotPasswordMode = false;
        if (tabsContainer) tabsContainer.style.display = "flex";
        if (guestLoginBtn) guestLoginBtn.style.display = "block";
        if (forgotPasswordBackContainer) forgotPasswordBackContainer.style.display = "none";
        if (emailLabel) emailLabel.textContent = "E-mail cím";
        
        if (groupPassword) groupPassword.style.display = "flex";
        
        if (isRegisterMode) {
            if (groupUsername) groupUsername.style.display = "flex";
            if (groupAge) groupAge.style.display = "flex";
            if (btnSubmitAuth) btnSubmitAuth.textContent = "Regisztráció";
        } else {
            if (groupUsername) groupUsername.style.display = "none";
            if (groupAge) groupAge.style.display = "none";
            if (btnSubmitAuth) btnSubmitAuth.textContent = "Bejelentkezés";
        }
        
        document.getElementById("auth-error").textContent = "";
    }

    // Handle Auth Form Submission
    const authForm = document.getElementById("auth-form");
    if (authForm) {
        authForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("auth-email").value.trim();
            const password = document.getElementById("auth-password").value;
            const username = document.getElementById("auth-username").value.trim();
            const ageRange = document.getElementById("auth-age").value;
            const errorEl = document.getElementById("auth-error");

            errorEl.textContent = "";

            try {
                if (isForgotPasswordMode) {
                    // Forgot Password request
                    const res = await fetch(`${API_URL}?action=forgot_password`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email })
                    });
                    
                    const data = await res.json();
                    if (data.error) {
                        errorEl.style.color = "var(--color-error)";
                        errorEl.textContent = data.error;
                    } else {
                        errorEl.style.color = "var(--color-success)";
                        errorEl.textContent = data.message || "A visszaállítási linket elküldtük az e-mail címedre!";
                        // Clear email field
                        document.getElementById("auth-email").value = "";
                    }
                } else if (isRegisterMode) {
                    // Sign-up flow (Direct sign-up)
                    if (!username) {
                        errorEl.textContent = "Kérjük, adj meg egy felhasználónevet!";
                        return;
                    }
                    if (!ageRange) {
                        errorEl.textContent = "Kérjük, válaszd ki az életkorodat!";
                        return;
                    }

                    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,16}$/;
                    if (!passwordRegex.test(password)) {
                        errorEl.textContent = "A jelszónak 8-16 karakter hosszúnak kell lennie, és tartalmaznia kell kisbetűt, nagybetűt, számot és speciális karaktert.";
                        return;
                    }

                    // Check for existing guest data to migrate
                    const guestKey = "neolix_guest_progress";
                    const guestDataRaw = localStorage.getItem(guestKey);
                    let initialPoints = 0;
                    let initialCompleted = {};
                    let initialScores = {};

                    if (guestDataRaw) {
                        try {
                            const guestData = JSON.parse(guestDataRaw);
                            initialPoints = guestData.points || 0;
                            initialCompleted = guestData.completed || {};
                            initialScores = guestData.scores || {};
                        } catch(e) {
                            console.warn("Hiba a vendég adatok beolvasásakor", e);
                        }
                    }

                    const res = await fetch(`${API_URL}?action=signup`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            email,
                            password,
                            username,
                            age_range: ageRange,
                            guest_migration: {
                                points: initialPoints,
                                completed: initialCompleted,
                                scores: initialScores
                            }
                        })
                    });

                    const data = await res.json();

                    if (data.error) {
                        errorEl.style.color = "var(--color-error)";
                        errorEl.textContent = data.error;
                        return;
                    }

                    if (data.success) {
                        localStorage.setItem("selectedLevel", "A1");
                        window.location.href = "dashboard.html";
                    }
                } else {
                    // Sign-in flow
                    const res = await fetch(`${API_URL}?action=login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, password })
                    });

                    const data = await res.json();

                    if (data.error) {
                        errorEl.style.color = "var(--color-error)";
                        errorEl.textContent = data.error;
                        return;
                    }

                    if (data.success) {
                        localStorage.setItem("selectedLevel", "A1");
                        window.location.href = "dashboard.html";
                    }
                }
            } catch (err) {
                console.error("Auth hiba:", err);
                errorEl.style.color = "var(--color-error)";
                errorEl.textContent = "Hiba történt az azonosítás során.";
            }
        });
    }

    // --- Password Reset Parsing & Modal controls ---
    const urlParams = new URLSearchParams(window.location.search);
    const actionParam = urlParams.get('action');
    const tokenParam = urlParams.get('token');

    if (actionParam === 'reset_password' && tokenParam) {
        // Open the reset password modal
        const resetModal = document.getElementById("reset-password-modal");
        if (resetModal) {
            resetModal.classList.add("is-active");
            resetModal.setAttribute("aria-hidden", "false");
            document.getElementById("reset-token-hidden").value = tokenParam;
        }
        // Clean URL params so they are not kept in history
        window.history.replaceState(null, null, window.location.pathname);
    }

    // Reset password form submit handler
    const resetForm = document.getElementById("reset-password-form");
    if (resetForm) {
        resetForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const password = document.getElementById("reset-password").value;
            const passwordConfirm = document.getElementById("reset-password-confirm").value;
            const token = document.getElementById("reset-token-hidden").value;
            const errorEl = document.getElementById("reset-error");

            errorEl.textContent = "";

            if (password !== passwordConfirm) {
                errorEl.textContent = "A két jelszó nem egyezik meg!";
                return;
            }

            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,16}$/;
            if (!passwordRegex.test(password)) {
                errorEl.textContent = "A jelszónak 8-16 karakter hosszúnak kell lennie, és tartalmaznia kell kisbetűt, nagybetűt, számot és speciális karaktert.";
                return;
            }

            try {
                const res = await fetch(`${API_URL}?action=reset_password`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, password })
                });

                const data = await res.json();
                if (data.error) {
                    errorEl.style.color = "var(--color-error)";
                    errorEl.textContent = data.error;
                } else {
                    errorEl.style.color = "var(--color-success)";
                    errorEl.textContent = data.message || "A jelszó sikeresen megváltoztatva!";
                    
                    // Direct redirect to login modal after a short delay
                    setTimeout(() => {
                        const resetModal = document.getElementById("reset-password-modal");
                        if (resetModal) {
                            resetModal.classList.remove("is-active");
                            resetModal.setAttribute("aria-hidden", "true");
                        }
                        openLoginModal();
                    }, 1800);
                }
            } catch (err) {
                console.error("Password reset error:", err);
                errorEl.style.color = "var(--color-error)";
                errorEl.textContent = "Hiba történt a jelszó visszaállítása során.";
            }
        });
    }

    // Close reset modal button
    const closeResetModalBtn = document.getElementById("close-reset-modal-btn");
    if (closeResetModalBtn) {
        closeResetModalBtn.addEventListener("click", () => {
            const resetModal = document.getElementById("reset-password-modal");
            if (resetModal) {
                resetModal.classList.remove("is-active");
                resetModal.setAttribute("aria-hidden", "true");
            }
        });
    }
});
