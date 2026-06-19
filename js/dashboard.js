// js/dashboard.js

document.addEventListener("DOMContentLoaded", async () => {
    // Accordion listeners are now initialized dynamically inside renderSidebar()
    initTopNavbarListeners();
    // Initialize standard modal and profile listeners if they exist in external scripts or below
    if (typeof initModalListeners === "function") initModalListeners();
    if (typeof initProfileListeners === "function") initProfileListeners();
    initResumeCTAListener();
    
    // Initialize progression tracking for the logged-in user
    await initUserProgress();
    
    // Check user daily streak count on load
    if (typeof checkStreakOnLoad === "function") checkStreakOnLoad();
    initDailyQuests();
    
    // Initialize accessibility settings (volume, reduced motion)
    if (typeof initSettingsUI === "function") initSettingsUI();
    
    // Apply user's active custom visual theme if saved
    if (userProgress.scores && userProgress.scores.active_theme && userProgress.scores.active_theme !== 'default') {
        document.body.classList.add(`theme-${userProgress.scores.active_theme}`);
    }
    
    // Read what level was clicked on index.html (fallback to A1 if empty)
    const levelToLoad = localStorage.getItem("selectedLevel") || "A1";
    
    // Automatically launch the workspace with the correct level data context
    switchGlobalLevel(levelToLoad, true);
});

// Track the currently active module context
let currentLevel = "A1";
let currentSection = "ToBe";
let currentSubsection = "explanation";

// LocalStorage Persistence Layer specifically for Guests
const LocalSavingsService = {
    getKey: () => `neolix_guest_progress`,
    save: (data) => {
        localStorage.setItem(LocalSavingsService.getKey(), JSON.stringify(data));
    },
    load: () => {
        const saved = localStorage.getItem(LocalSavingsService.getKey());
        return saved ? JSON.parse(saved) : null;
    },
    clear: () => {
        localStorage.removeItem(LocalSavingsService.getKey());
    }
};

// Global Progress Tracking Object & Abstraction Layer
const ProgressManager = {
    isGuest: true,
    data: {
        username: "Vendég",
        points: 0,
        completed: {},
        scores: {},
        role: "user",
        subscription_tier: "free",
        daily_quests_date: null,
        active_quests: [],
        quest_progress: {},
        completed_quests_today: []
    },
    getGuestPayload: function() {
        return LocalSavingsService.load();
    },
    clearGuestData: function() {
        if (this.isGuest) {
            LocalSavingsService.clear();
            window.location.reload();
        }
    }
};

// Individual user progress state tracking alias
let userProgress = ProgressManager.data;

// Global cache for fetched vocabulary data to prevent redundant network hits
const vocabCache = {};

// Global API Client Endpoint for local WebSupport MariaDB backend
// Uses config.js API_URL constraint

// Stopwatch timer state
let stopwatchInterval = null;
let stopwatchSeconds = 0;

// Tracking correctness attempts map for the current active exercise view (maps question index -> boolean correctness)
let exerciseAttempts = {};

// ===========================================================================
//   GAMIFICATION & ACCESSABILITY FRAMEWORK (ADHD SOUND, XP, SHOP, STREAKS)
// ===========================================================================

// 1. Audio tone synthesizer for ADHD reward and warning chiming
const AudioSynth = {
    ctx: null,
    volume: 0.5,
    reducedMotion: false,
    
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    
    playTone(freq, type = 'sine', duration = 0.1) {
        if (this.reducedMotion) return; // csökkentett mozgás bypass
        try {
            this.init();
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            
            gain.gain.setValueAtTime(this.volume * 0.15, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn("AudioContext blocked or failed:", e);
        }
    },
    
    playCorrect() {
        this.playTone(523.25, 'sine', 0.15); // C5
        setTimeout(() => this.playTone(659.25, 'sine', 0.2), 100); // E5
    },
    
    playIncorrect() {
        this.playTone(220, 'triangle', 0.3); // A3
    },
    
    playComplete() {
        this.playTone(523.25, 'sine', 0.1);
        setTimeout(() => this.playTone(659.25, 'sine', 0.1), 80);
        setTimeout(() => this.playTone(783.99, 'sine', 0.1), 160);
        setTimeout(() => this.playTone(1046.50, 'sine', 0.3), 240); // C6 arpeggio
    }
};

// 2. Point Economy Capping & XP Capping System
const maxXpPerNode = {
    explanation: 10,
    words: 30,
    fillBlanks: 20,
    wordOrder: 20,
    trueFalse: 20,
    quiz: 25,
    mini_quiz: 15,
    exam: 50
};

// XP floating indicator popup
function triggerFloatPop(amount, element, label = null) {
    if (!element) return;
    const pop = document.createElement("div");
    pop.className = "floating-points-pop";
    pop.textContent = label || (amount >= 0 ? `+${amount} XP! 🎉` : `${amount} XP 💸`);
    pop.style.position = "absolute";
    pop.style.left = "50%";
    pop.style.top = "10px";
    pop.style.transform = "translateX(-50%)";
    pop.style.background = amount >= 0 ? "oklch(0.75 0.2 150)" : "oklch(0.6 0.15 20)";
    pop.style.color = "#000";
    pop.style.padding = "0.3rem 0.8rem";
    pop.style.borderRadius = "20px";
    pop.style.fontSize = "0.85rem";
    pop.style.fontWeight = "bold";
    pop.style.zIndex = "100";
    pop.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
    pop.style.animation = "floatUp 1.2s ease-out forwards";
    
    element.style.position = "relative";
    element.appendChild(pop);
    
    setTimeout(() => {
        pop.remove();
    }, 1200);
}

// Centralized XP rewarding mechanism with double-claim exploit guards
function addXP(amount, elementForFloatPop = null, stepName = null) {
    if (!userProgress.scores) userProgress.scores = {};
    if (!userProgress.scores.earned_xp_per_node) {
        userProgress.scores.earned_xp_per_node = {};
    }
    
    let actualAdd = amount;
    
    if (stepName && amount > 0) {
        const nodeKey = `${currentLevel}_${currentSection}_${stepName}`;
        const currentEarned = userProgress.scores.earned_xp_per_node[nodeKey] || 0;
        const maxAllowed = maxXpPerNode[stepName] || 0;
        
        if (currentEarned >= maxAllowed) {
            if (elementForFloatPop) triggerFloatPop(0, elementForFloatPop, "Max XP elérve!");
            return 0;
        }
        
        actualAdd = Math.min(amount, maxAllowed - currentEarned);
        if (actualAdd <= 0) return 0;
        
        userProgress.scores.earned_xp_per_node[nodeKey] = currentEarned + actualAdd;
    }
    
    userProgress.points = (userProgress.points || 0) + actualAdd;
    if (userProgress.points < 0) userProgress.points = 0;
    
    if (typeof updateQuestProgress === 'function' && actualAdd > 0) {
        updateQuestProgress('earn_xp', actualAdd);
    }
    
    if (elementForFloatPop && actualAdd !== 0) {
        triggerFloatPop(actualAdd, elementForFloatPop);
    }
    
    updateProgressUI();
    saveUserProgress();
    
    return actualAdd;
}

// Helper to compute maximum possible XP for a given level
function computeLevelMaxXP(level) {
    if (!learningContent[level]) return 0;
    
    let totalMaxXP = 0;
    for (const secKey in learningContent[level]) {
        if (secKey === 'level_exam' || secKey === 'final_exam') continue;
        
        const section = learningContent[level][secKey];
        if (!section.subsections) continue;
        
        for (const subKey in section.subsections) {
            const subData = section.subsections[subKey];
            if (subData.type === 'explanation') totalMaxXP += maxXpPerNode.explanation || 0;
            if (subData.type === 'words') totalMaxXP += maxXpPerNode.words || 0;
            if (subData.type === 'fill_blanks') totalMaxXP += maxXpPerNode.fillBlanks || 0;
            if (subData.type === 'word_order') totalMaxXP += maxXpPerNode.wordOrder || 0;
            if (subData.type === 'true_false') totalMaxXP += maxXpPerNode.trueFalse || 0;
            if (subData.type === 'section_exam') totalMaxXP += maxXpPerNode.exam || 0;
        }
    }
    return totalMaxXP;
}

// Helper to calculate XP earned specifically in this level
function getEarnedXPForLevel(level) {
    if (!userProgress.scores || !userProgress.scores.earned_xp_per_node) return 0;
    
    let earnedXP = 0;
    const prefix = `${level}_`;
    for (const key in userProgress.scores.earned_xp_per_node) {
        if (key.startsWith(prefix)) {
            earnedXP += userProgress.scores.earned_xp_per_node[key];
        }
    }
    return earnedXP;
}

// Level Exam gating logic based on 80% threshold
function isLevelExamUnlocked(level) {
    const maxXP = computeLevelMaxXP(level);
    if (maxXP === 0) return false;
    
    const earnedXP = getEarnedXPForLevel(level);
    const percentage = earnedXP / maxXP;
    
    return percentage >= 0.8;
}

// 3. User Level & XP bar progression calculations
function updateUserLevelState() {
    if (!userProgress.scores) userProgress.scores = {};
    const totalXP = userProgress.points || 0;
    
    const newLevel = Math.floor(totalXP / 100) + 1;
    const oldLevel = userProgress.scores.level || 1;
    
    userProgress.scores.level = newLevel;
    
    if (newLevel > oldLevel) {
        AudioSynth.playTone(880, 'sine', 0.2);
        setTimeout(() => AudioSynth.playTone(1320, 'sine', 0.4), 150);
        alert(`🎉 Szintet léptél! Új szinted: Level ${newLevel}! Gratulálunk!`);
    }
    
    const levelDisplay = document.getElementById("level-display");
    if (levelDisplay) levelDisplay.textContent = `Level ${newLevel}`;
    
    const xpDisplay = document.getElementById("xp-display");
    if (xpDisplay) xpDisplay.textContent = totalXP % 100;
    
    const xpFillBar = document.getElementById("xp-fill-bar");
    if (xpFillBar) xpFillBar.style.width = `${totalXP % 100}%`;
    
    const xpTierLabel = document.getElementById("xp-tier-label");
    if (xpTierLabel) {
        if (newLevel >= 5) xpTierLabel.textContent = "Angol Professzor";
        else if (newLevel >= 4) xpTierLabel.textContent = "Haladó Angolos";
        else if (newLevel >= 3) xpTierLabel.textContent = "Gyakorlott Beszélő";
        else if (newLevel >= 2) xpTierLabel.textContent = "Szorgalmas Tanuló";
        else xpTierLabel.textContent = "Kezdő nyelvtanuló";
    }
}

// 4. Streak protections and checking on load
function checkStreakOnLoad() {
    if (!userProgress.scores) userProgress.scores = {};
    const lastActive = userProgress.scores.last_active_date;
    const today = new Date().toISOString().split('T')[0];
    
    if (!userProgress.scores.streak_count) userProgress.scores.streak_count = 0;
    if (typeof userProgress.scores.streak_shields === 'undefined') userProgress.scores.streak_shields = 2;
    
    if (lastActive) {
        if (lastActive === today) {
            // Already active today
        } else {
            const lastActiveDate = new Date(lastActive);
            const todayDate = new Date(today);
            const diffTime = Math.abs(todayDate - lastActiveDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                userProgress.scores.streak_count++;
            } else if (diffDays > 1) {
                const shields = userProgress.scores.streak_shields || 0;
                if (shields > 0) {
                    userProgress.scores.streak_shields = shields - 1;
                    setTimeout(() => {
                        const alertEl = document.getElementById('streak-alert');
                        if (alertEl) {
                            alertEl.style.display = 'block';
                            alertEl.textContent = `Pajzs elhasználva! Napi szériád megvédve. Maradt: ${userProgress.scores.streak_shields} db.`;
                            AudioSynth.playTone(330, 'sine', 0.25);
                            setTimeout(() => { alertEl.style.display = 'none'; }, 5000);
                        }
                    }, 1000);
                } else {
                    userProgress.scores.streak_count = 1;
                }
            }
        }
    } else {
        userProgress.scores.streak_count = 1;
    }
    
    userProgress.scores.last_active_date = today;
    updateStreakUI();
}

function updateStreakUI() {
    if (!userProgress.scores) return;
    const streakCounter = document.getElementById("streak-counter");
    if (streakCounter) streakCounter.textContent = userProgress.scores.streak_count || 0;
    
    const shieldsCount = userProgress.scores.streak_shields || 0;
    for (let i = 1; i <= 3; i++) {
        const shield = document.getElementById(`shield-${i}`);
        if (shield) {
            if (i <= shieldsCount) {
                shield.style.color = "var(--color-accent-in)";
                shield.style.opacity = "1";
                shield.style.filter = "drop-shadow(0 0 3px var(--color-accent-in))";
            } else {
                shield.style.color = "var(--color-text-muted)";
                shield.style.opacity = "0.4";
                shield.style.filter = "none";
            }
        }
    }
}

window.simulateMissedDay = function() {
    if (!userProgress.scores) userProgress.scores = {};
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    userProgress.scores.last_active_date = threeDaysAgo.toISOString().split('T')[0];
    checkStreakOnLoad();
    saveUserProgress();
};

// 5. Jutalom Bolt cosmetic shop handlers


window.activateTheme = function(theme, btnEl) {
    document.body.className = '';
    if (theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }
    
    if (!userProgress.scores) userProgress.scores = {};
    userProgress.scores.active_theme = theme;
    saveUserProgress();
    
    syncShopButtonsUI();
};

function syncShopButtonsUI() {
    const unlocked = userProgress.unlocked_items || [];
    const activeTheme = userProgress.active_theme || 'default';
    
    // Update active theme CSS
    if (activeTheme !== 'default') {
        document.documentElement.setAttribute('data-theme', activeTheme);
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    
    // Update shop buttons globally (both in sidebar and modal)
    document.querySelectorAll('.shop-item button').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        
        if (onclick.includes("unlockShopItem('cyberpunk'")) {
            if (activeTheme === 'cyberpunk') {
                btn.textContent = 'Aktiválva';
                btn.disabled = true;
            } else if (unlocked.includes('cyberpunk')) {
                btn.textContent = 'Aktivál';
                btn.disabled = false;
            } else {
                btn.textContent = 'Feloldás';
                btn.disabled = false;
            }
        }
        else if (onclick.includes("unlockShopItem('nature'")) {
            if (activeTheme === 'nature') {
                btn.textContent = 'Aktiválva';
                btn.disabled = true;
            } else if (unlocked.includes('nature')) {
                btn.textContent = 'Aktivál';
                btn.disabled = false;
            } else {
                btn.textContent = 'Feloldás';
                btn.disabled = false;
            }
        }
    });
}
    
    
    const btnEmerald = document.getElementById("btn-unlock-emerald");
    if (btnEmerald) {
        if (unlocked.includes("emerald")) {
            if (activeTheme === "emerald") {
                btnEmerald.textContent = "Aktív ✓";
                btnEmerald.style.borderColor = "var(--color-accent-in)";
                btnEmerald.style.color = "var(--color-accent-in)";
                btnEmerald.onclick = null;
            } else {
                btnEmerald.textContent = "Aktivál";
                btnEmerald.style.borderColor = "var(--color-success)";
                btnEmerald.style.color = "var(--color-success)";
                btnEmerald.onclick = () => activateTheme("emerald", btnEmerald);
            }
        }
    }


// 6. Accessibility Settings sliders/toggles
window.updateVolume = function(val) {
    const volume = parseFloat(val);
    if(typeof AudioSynth !== 'undefined') {
        AudioSynth.volume = volume;
    }
    localStorage.setItem("adhd_volume", volume);
    document.cookie = `adhd_volume=${volume}; path=/; max-age=31536000`;
    
    // Update display if it exists
    const display = document.getElementById('sound-val-display');
    if (display) {
        display.textContent = Math.round(volume * 100) + "%";
    }
    
    // Play a small click to test the volume
    if(typeof AudioSynth !== 'undefined' && typeof AudioSynth.playTone === 'function') {
        AudioSynth.playTone(440, 'sine', 0.1);
    }
};

window.toggleReducedMotion = function(checked) {
    AudioSynth.reducedMotion = checked;
    localStorage.setItem("adhd_reduced_motion", checked ? "true" : "false");
    document.cookie = `adhd_reduced_motion=${checked ? 'true' : 'false'}; path=/; max-age=31536000`;
    
    if (checked) {
        document.body.classList.add("reduced-motion");
    } else {
        document.body.classList.remove("reduced-motion");
    }
};

function initSettingsUI() {
    const savedVolume = localStorage.getItem("adhd_volume");
    // ID is 'sound-slider' in our new HTML
    const volumeSlider = document.getElementById("sound-slider");
    const display = document.getElementById("sound-val-display");
    
    let vol = 0.5;
    if (savedVolume !== null) {
        vol = parseFloat(savedVolume);
    }
    
    if(typeof AudioSynth !== 'undefined') AudioSynth.volume = vol;
    if (volumeSlider) volumeSlider.value = vol;
    if (display) display.textContent = Math.round(vol * 100) + "%";
    
    const savedMotion = localStorage.getItem("adhd_reduced_motion");
    const motionToggle = document.getElementById("reduced-motion-toggle");
    if (savedMotion !== null) {
        const check = savedMotion === "true";
        AudioSynth.reducedMotion = check;
        if (motionToggle) motionToggle.checked = check;
        if (check) document.body.classList.add("reduced-motion");
    } else {
        AudioSynth.reducedMotion = false;
        if (motionToggle) motionToggle.checked = false;
    }
}

// 7. Mobile Drawer toggler
window.openMobileDrawer = function(type) {
    // 1. Close all first
    const leftSidebar = document.querySelector(".dashboard-left-sidebar");
    const rightSidebar = document.querySelector(".dashboard-right-sidebar");
    const profileModal = document.getElementById("profile-modal");
    const questsModal = document.getElementById("quests-modal-overlay");
    
    if (leftSidebar && type !== 'nav') leftSidebar.classList.remove("is-active");
    if (rightSidebar && type !== 'stats') rightSidebar.classList.remove("is-active");
    if (profileModal && type !== 'profile') profileModal.classList.remove("is-active");
    if (questsModal && type !== 'quests') questsModal.classList.remove("is-active");

    // 2. Open the requested one
    if (type === 'nav' && leftSidebar) {
        leftSidebar.classList.toggle("is-active");
    } else if (type === 'stats' && rightSidebar) {
        rightSidebar.classList.toggle("is-active");
    } else if (type === 'profile' && profileModal) {
        profileModal.classList.toggle("is-active");
    } else if (type === 'quests') {
        if(window.openQuestsModal) window.openQuestsModal();
    } else if (type === 'home') {
        if(window.closeWorkspace) window.closeWorkspace();
    }
}

// Keep old functions for backwards compatibility with closing buttons inside panels
window.toggleMobileStatsDrawer = function(open) {
    const sidebar = document.querySelector(".dashboard-right-sidebar");
    if (!sidebar) return;
    if (typeof open === 'undefined') sidebar.classList.toggle("is-active");
    else if (open) sidebar.classList.add("is-active");
    else sidebar.classList.remove("is-active");
}

window.toggleMobileNavDrawer = function(open) {
    const sidebar = document.querySelector(".dashboard-left-sidebar");
    if (!sidebar) return;
    if (typeof open === 'undefined') sidebar.classList.toggle("is-active");
    else if (open) sidebar.classList.add("is-active");
    else sidebar.classList.remove("is-active");
};

// 8. Desktop layout and Sidebar Roadmap Navigation handlers
function isDesktopLayout() {
    return window.innerWidth >= 992;
}

window.clickSidebarRoadmapNode = function(type) {
    if (!isDesktopLayout()) return;
    
    const nodeEl = document.getElementById(`sb-node-${type}`);
    if (!nodeEl || nodeEl.classList.contains("locked")) return;
    
    let subKey = type;
    if (type === 'quiz') {
        const keyFB = `${currentLevel}_${currentSection}_fillBlanks`;
        const keyWO = `${currentLevel}_${currentSection}_wordOrder`;
        
        if (!userProgress.completed[keyFB]) {
            subKey = 'fillBlanks';
        } else if (!userProgress.completed[keyWO]) {
            subKey = 'wordOrder';
        } else {
            subKey = 'trueFalse';
        }
    } else if (type === 'exam') {
        subKey = 'sectionExam';
    }
    
    currentSubsection = subKey;
    renderSubsection(currentLevel, currentSection, subKey);
    
    const links = document.querySelectorAll(".subsection-link");
    links.forEach(l => l.classList.remove("active"));
    const accordion = document.querySelector(`.course-accordion[data-level="${currentLevel}"][data-section="${currentSection}"]`);
    if (accordion) {
        const targetLink = accordion.querySelector(`.subsection-link[data-subsection="${subKey}"]`);
        if (targetLink) targetLink.classList.add("active");
    }
    
    syncSidebarRoadmapNodes();
};

function syncSidebarRoadmapNodes() { /* Deprecated */ }

// Global classification helpers to distinguish types cleanly
function isExplanation(subsectionData) {
    return subsectionData && subsectionData.type === "explanation";
}

function isVocabulary(subsectionData) {
    return subsectionData && subsectionData.type === "words";
}

function isExercise(subsectionData) {
    return subsectionData && ["fill_blanks", "word_order", "true_false"].includes(subsectionData.type);
}

function isExam(subsectionData) {
    return subsectionData && subsectionData.type === "section_exam";
}

// Gatekeeper logic for content access (Limits guests, respects RBAC/subscriptions)
function isContentAccessible(level, courseKey, subsectionType = null) {
    if (!ProgressManager.isGuest) {
        // Admin or Lifetime bypasses everything
        if (ProgressManager.data.role === "admin" || ProgressManager.data.subscription_tier === "lifetime") {
            return true;
        }

        // BETA GIFT: Currently giving all registered users full access
        return true; 
        
        // FUTURE IMPLEMENTATION:
        // Here we would check their subscription tier against the required tier for this level
        // if (level !== "A1" && ProgressManager.data.subscription_tier === "free") return false;
    }

    // Calculate total valid courses across all levels (excluding exams)
    let totalCourses = 0;
    const courseList = []; // Ordered list of course paths to determine index

    // Define predictable level order
    const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    
    for (const lvl of levels) {
        if (learningContent[lvl]) {
            for (const key in learningContent[lvl]) {
                // If the section is a global level exam, don't count it as a "course" for the 20% pool
                if (key !== "level_exam" && key !== "final_exam") {
                    totalCourses++;
                    courseList.push(`${lvl}_${key}`);
                }
            }
        }
    }

    const allowedCount = Math.ceil(totalCourses * 0.20);
    const targetPath = `${level}_${courseKey}`;
    const courseIndex = courseList.indexOf(targetPath);

    // 1. Is the course outside the 20% cap or an explicitly blocked global exam?
    if (courseIndex === -1 || courseIndex >= allowedCount || courseKey === "level_exam" || courseKey === "final_exam") {
        return false;
    }

    // 2. Even within allowed courses, block premium features like exams and explanations
    if (subsectionType) {
        if (subsectionType === "section_exam" || subsectionType === "sectionExam" || subsectionType === "final_exam" || subsectionType === "finalExam" || subsectionType === "explanation") {
            return false;
        }
    }

    return true;
}

// Stopwatch actions
function startStopwatch() {
    stopStopwatch();
    stopwatchSeconds = 0;
    updateStopwatchDisplay();
    
    stopwatchInterval = setInterval(() => {
        stopwatchSeconds++;
        updateStopwatchDisplay();
    }, 1000);
}

function stopStopwatch() {
    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
    }
}

function updateStopwatchDisplay() {
    const timerDisplay = document.getElementById("timer-display");
    if (timerDisplay) {
        const minutes = Math.floor(stopwatchSeconds / 60);
        const seconds = stopwatchSeconds % 60;
        const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        timerDisplay.textContent = formatted;
    }
}

// Dynamic success rate tracker
function updateSuccessRateDisplay(isActive) {
    const displayEl = document.getElementById("success-rate-display");
    if (!displayEl) return;
    
    if (!isActive) {
        displayEl.textContent = "-";
        return;
    }
    
    const attempted = Object.keys(exerciseAttempts).length;
    if (attempted === 0) {
        displayEl.textContent = "0%";
        return;
    }
    
    let correctCount = 0;
    for (let key in exerciseAttempts) {
        if (exerciseAttempts[key]) {
            correctCount++;
        }
    }
    const rate = Math.round((correctCount / attempted) * 100);
    displayEl.textContent = `${rate}%`;
}

// Global section exam locking checks
function isSectionExamLocked(level, section) {
    const moduleData = learningContent[level]?.[section];
    if (!moduleData || !moduleData.subsections) return false;
    
    for (const subKey in moduleData.subsections) {
        const subData = moduleData.subsections[subKey];
        if (isExam(subData)) {
            continue; // Skip the exam itself
        }
        const key = `${level}_${section}_${subKey}`;
        if (!userProgress.completed[key]) {
            return true; // Lock the exam because a preceding lesson is not completed
        }
    }
    return false; // All preceding lessons completed, unlocked!
}

// Calculates the next logical lesson step based on completion state across ALL sections
function getNextUncompletedLesson(level) {
    const sections = Object.keys(learningContent[level] || {});
    for (const secKey of sections) {
        const moduleData = learningContent[level][secKey];
        if (!moduleData || !moduleData.subsections) continue;
        
        // If the entire section is deemed complete (registered users pass the exam)
        if (userProgress.completed[`${level}_${secKey}_sectionExam`]) {
            continue; // Skip this entire section!
        }
        
        for (const subKey in moduleData.subsections) {
            // Check if the user is even allowed to access this subsection
            const isAccessible = isContentAccessible(level, secKey, subKey);
            if (!isAccessible) continue; // Skip asking them to complete inaccessible lessons!

            const key = `${level}_${secKey}_${subKey}`;
            if (!userProgress.completed[key]) {
                return {
                    section: secKey,
                    key: subKey,
                    title: moduleData.subsections[subKey].title || subKey,
                    isExam: isExam(moduleData.subsections[subKey])
                };
            }
        }
    }
    return null; // All sections in the level are completely finished
}

// Scans forward through the entire curriculum to find the next valid, accessible lesson
function findNextGuestAccessibleLesson(level, section) {
    const levels = ["A1", "A2", "B1", "B2", "C1", "C2"];
    let foundCurrentSec = false;
    
    for (const lvl of levels) {
        if (!learningContent[lvl]) continue;
        
        const sections = Object.keys(learningContent[lvl]);
        for (const secKey of sections) {
            // Fast-forward to current section
            if (!foundCurrentSec) {
                if (lvl === level && secKey === section) {
                    foundCurrentSec = true;
                } else {
                    continue; // Skip until we find the current section
                }
            }
            
            // Check the current or subsequent section
            const moduleData = learningContent[lvl][secKey];
            if (!moduleData || !moduleData.subsections) continue;
            
            for (const subKey in moduleData.subsections) {
                const subData = moduleData.subsections[subKey];
                const key = `${lvl}_${secKey}_${subKey}`;
                
                // Skip if completed
                if (userProgress.completed[key]) continue;
                
                // Check if accessible
                const isAccessible = isContentAccessible(lvl, secKey, subData.type || subKey);
                if (isAccessible) {
                    return {
                        level: lvl,
                        section: secKey,
                        key: subKey,
                        title: subData.title || subKey,
                        isExam: isExam(subData)
                    };
                }
            }
        }
    }
    
    // Completely exhausted 20% cap or all content
    return { endOfGuestContent: true };
}

// Extracts the logged-in user's name from the header welcome message dynamically
function getLoggedInUser() {
    const welcomeSpan = document.querySelector(".user-welcome");
    if (welcomeSpan) {
        const text = welcomeSpan.textContent;
        const match = text.match(/Szia,?\s+(.+)!/);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    return "Vendég";
}

// Loads progression from backend database or LocalStorage fallback
async function initUserProgress() {
    let loggedInUser = "Vendég";
    let userId = null;

    // Hook sign out to ALL logout buttons unconditionally at the START
    // This allows users to always log out, regardless of early returns or guest mode
    const logoutBtns = document.querySelectorAll(".btn-logout");
    logoutBtns.forEach(logoutBtn => {
        logoutBtn.textContent = "Kijelentkezés";
        const newLogoutBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
        newLogoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            try {
                await fetch(`${API_URL}?action=logout`);
            } catch (err) {
                console.warn("Logout API failed, proceeding with local wipe:", err);
            }
            // Force hard wipe of any leftover Supabase auth tokens in LocalStorage
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-') && key.includes('auth-token')) {
                    localStorage.removeItem(key);
                }
            });
            // Mark the guest as visibly logged out without deleting their progress
            localStorage.setItem("guest_logged_out", "true");
            window.location.href = "index.html";
        });
    });

    try {
        const res = await fetch(`${API_URL}?action=get_session`);
        if (res.ok) {
            const data = await res.json();
            if (data && data.session) {
                const session = data.session;
                const user = session.user;
                loggedInUser = user.user_metadata?.username || user.email.split('@')[0];
                userId = user.id;

                // Sync header username display
                const welcomeSpan = document.querySelector(".user-welcome");
                if (welcomeSpan) {
                    welcomeSpan.textContent = `Szia, ${loggedInUser}!`;
                }

                const progress = session.progress;
                const subscription = session.subscription;

                let completedObj = progress.completed;
                if (!completedObj || Array.isArray(completedObj)) {
                    completedObj = {};
                }
                let scoresObj = progress.scores;
                if (!scoresObj || Array.isArray(scoresObj)) {
                    scoresObj = {};
                }

                ProgressManager.isGuest = false;
                LocalSavingsService.clear(); // Ensure guest data is wiped when successfully logged in
                userProgress = {
                    username: loggedInUser,
                    email: user.email || "",
                    points: progress.points || 0,
                    completed: completedObj,
                    scores: scoresObj,
                    role: subscription?.role || "user",
                    subscription_tier: subscription?.subscription_tier || "free",
                    id: userId,
                    level: progress.level || 1,
                    streak_count: progress.streak_count || 0,
                    streak_shields: progress.streak_shields !== undefined ? progress.streak_shields : 2,
                    last_active_date: progress.last_active_date || null,
                    unlocked_items: Array.isArray(progress.unlocked_items) ? progress.unlocked_items : [],
                    active_theme: progress.active_theme || 'default',
                    earned_xp_per_node: progress.earned_xp_per_node || {},
                    daily_quests_date: progress.daily_quests_date || null,
                    active_quests: Array.isArray(progress.active_quests) ? progress.active_quests : [],
                    quest_progress: progress.quest_progress || {},
                    completed_quests_today: Array.isArray(progress.completed_quests_today) ? progress.completed_quests_today : []
                };
                ProgressManager.data = userProgress;

                // Set profile email field in the modal since it is available in the session
                const emailDisplay = document.getElementById("profile-email-display");
                if (emailDisplay) {
                    emailDisplay.textContent = user.email || "";
                }
                
                console.log("🔓 User Loaded:", ProgressManager.data);
                
                updateProgressUI();
                refreshProfileDOM(); // Wipe loading states
                return;
            }
        }
    } catch (authErr) {
        console.warn("Hiba a munkamenet lekérése során:", authErr);
    }

    // Fallback to ProgressManager for guest
    ProgressManager.isGuest = true;
    const localData = LocalSavingsService.load();
    if (localData) {
        userProgress = localData;
        userProgress.username = "Vendég";
        if (typeof userProgress.points === "undefined") userProgress.points = 0;
        if (!userProgress.scores) userProgress.scores = {};
    } else {
        userProgress = {
            username: "Vendég",
            points: 0,
            completed: {},
            scores: {}
        };
    }
    ProgressManager.data = userProgress;

    // Set profile email display for guest
    const emailDisplay = document.getElementById("profile-email-display");
    if (emailDisplay) {
        emailDisplay.textContent = "Nincs (Vendég)";
    }

    updateProgressUI();
    refreshProfileDOM(); // Ensure "Betöltés" states are wiped for guests too
}

// Explicit Profile DOM refresh to avoid "Betöltés" loading hangs
function refreshProfileDOM() {
    const usernameDisplay = document.getElementById("profile-username-display");
    const subDisplay = document.getElementById("profile-subscription-display");
    
    if (usernameDisplay && userProgress) {
        usernameDisplay.textContent = userProgress.username;
    }
    
    if (subDisplay && userProgress) {
        const tier = userProgress.subscription_tier || "free";
        const role = userProgress.role || "user";
        
        if (role === "admin") {
            subDisplay.textContent = "Örökös Prémium (Admin)";
            subDisplay.style.background = "oklch(0.65 0.2 25 / 0.15)";
            subDisplay.style.color = "var(--color-accent-in)";
            subDisplay.style.border = "1px solid var(--color-accent-in)";
        } else if (tier === "lifetime") {
            subDisplay.textContent = "Örökös Prémium";
            subDisplay.style.background = "oklch(0.65 0.2 25 / 0.15)";
            subDisplay.style.color = "var(--color-accent-in)";
            subDisplay.style.border = "1px solid var(--color-accent-in)";
        } else {
            subDisplay.textContent = "Ingyenes Béta";
            subDisplay.style.background = "oklch(0.6 0.05 250 / 0.15)";
            subDisplay.style.color = "var(--color-text-muted)";
            subDisplay.style.border = "1px solid oklch(0.6 0.05 250 / 0.3)";
        }
    }
}

// Saves progression to database or updates local cache fallback via abstraction
async function saveUserProgress() {
    if (ProgressManager.isGuest) {
        // Isolated guest traffic, purely client-side
        LocalSavingsService.save(userProgress);
    } else {
        if (userProgress.id) {
            try {
                const res = await fetch(`${API_URL}?action=save_progress`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        points: userProgress.points || 0,
                        completed: userProgress.completed || {},
                        scores: userProgress.scores || {},
                        level: userProgress.level || 1,
                        streak_count: userProgress.streak_count || 0,
                        streak_shields: userProgress.streak_shields !== undefined ? userProgress.streak_shields : 2,
                        last_active_date: userProgress.last_active_date || null,
                        unlocked_items: userProgress.unlocked_items || [],
                        active_theme: userProgress.active_theme || 'default',
                        earned_xp_per_node: userProgress.earned_xp_per_node || {},
                        daily_quests_date: userProgress.daily_quests_date || null,
                        active_quests: userProgress.active_quests || [],
                        quest_progress: userProgress.quest_progress || {},
                        completed_quests_today: userProgress.completed_quests_today || []
                    })
                });
                if (!res.ok) {
                    console.error("Sikertelen mentés a szerverre");
                } else {
                    const data = await res.json();
                    if (data.error) {
                        console.error("Sikertelen mentés:", data.error);
                    }
                }
            } catch (err) {
                console.warn("Hiba a mentés során:", err);
            }
        }
    }
    
    updateProgressUI();
}

// Debounced answer saver
let saveAnswerTimeout = null;
function saveExerciseAnswer(level, section, subsection, index, value) {
    const key = `${level}_${section}_${subsection}_answers`;
    if (!userProgress.completed[key]) {
        userProgress.completed[key] = {};
    }
    userProgress.completed[key][index] = value;
    
    if (saveAnswerTimeout) clearTimeout(saveAnswerTimeout);
    saveAnswerTimeout = setTimeout(() => {
        saveUserProgress();
    }, 500);
}

// Marks a specific section page as completed
function markSubsectionCompleted(level, section, subsection, score = null) {
    const key = `${level}_${section}_${subsection}`;
    userProgress.completed[key] = true;
    if (score !== null) {
        userProgress.scores[key] = score;
    }
    saveUserProgress();
}

// Generates the completion button HTML based on completion state
function getCompleteButtonHtml(level, section, subsection, requiresAttempt = false) {
    const key = `${level}_${section}_${subsection}`;
    const isCompleted = userProgress.completed[key];
    
    let disabledAttr = "";
    if (requiresAttempt && !isCompleted) {
        disabledAttr = "disabled";
    }

    if (isCompleted) {
        return `
            <div class="completion-button-container">
                <button class="btn-complete-section completed-badge" disabled>
                    Teljesítve ✓
                </button>
            </div>
        `;
    } else {
        return `
            <div class="completion-button-container">
                <button class="btn-complete-section" ${disabledAttr} onclick="completeSubsectionAction('${level}', '${section}', '${subsection}', this)">
                    <span>Teljesítettem (+5 pont)</span>
                </button>
            </div>
        `;
    }
}

// ==========================================================================
// MINI-QUIZ POPUP & CONFETTI (Phase 6)
// ==========================================================================
function runConfetti(amount) {
    for(let i=0; i<amount; i++) {
        const conf = document.createElement('div');
        conf.style.position = 'fixed';
        conf.style.width = '8px';
        conf.style.height = '8px';
        conf.style.backgroundColor = ['var(--color-accent-in)', 'var(--color-success)', 'var(--color-accent-at)'][Math.floor(Math.random() * 3)];
        conf.style.left = Math.random() * 100 + 'vw';
        conf.style.top = '-10px';
        conf.style.zIndex = 9999;
        conf.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        conf.style.pointerEvents = 'none';
        document.body.appendChild(conf);

        const dur = Math.random() * 2 + 1;
        conf.animate([
            { transform: 'translateY(0) rotate(0)' },
            { transform: `translateY(100vh) rotate(${Math.random() * 720}deg)` }
        ], { duration: dur * 1000, easing: 'linear' });

        setTimeout(() => conf.remove(), dur * 1000);
    }
}

function canTriggerMiniQuiz() {
    return Math.random() < 0.25; // 25% chance
}

let activeMiniQuizQuestion = null;

function triggerMiniQuiz(level, section, subsection) {
    // Gather all learned words from the current session's vocabCache
    let allWords = [];
    Object.values(vocabCache).forEach(fileItems => {
        if (Array.isArray(fileItems)) {
            fileItems.forEach(item => {
                if (item.en && item.hu && !item.sentence) { // Ensure it's a vocabulary word
                    allWords.push(item);
                }
            });
        }
    });
    
    // Fallback if no words loaded
    if (allWords.length < 4) {
        allWords = [
            { en: "teacher", hu: "tanár" },
            { en: "student", hu: "diák" },
            { en: "doctor", hu: "orvos" },
            { en: "driver", hu: "sofőr" }
        ];
    }
    
    // Pick a random correct word
    const correctWord = allWords[Math.floor(Math.random() * allWords.length)];
    
    // Pick 3 random wrong answers
    let wrongOptions = allWords.filter(w => w.hu !== correctWord.hu).map(w => w.hu);
    wrongOptions = wrongOptions.sort(() => 0.5 - Math.random()).slice(0, 3);
    
    // If not enough wrong options in cache, fallback
    while (wrongOptions.length < 3) {
        wrongOptions.push("rossz opció " + Math.random().toString().substring(2,4));
    }
    
    let opts = [...wrongOptions, correctWord.hu];
    opts = opts.sort(() => 0.5 - Math.random());
    const answerIdx = opts.indexOf(correctWord.hu);

    activeMiniQuizQuestion = {
        q: `Mit jelent a(z) "${correctWord.en}" szó?`,
        opts: opts,
        answer: answerIdx
    };
    
    const qEl = document.getElementById("mini-quiz-question");
    const oEl = document.getElementById("mini-quiz-options");
    const fEl = document.getElementById("mini-quiz-feedback");
    const bEl = document.getElementById("mini-quiz-continue-btn");
    
    if(!qEl || !oEl) return;
    
    qEl.innerHTML = activeMiniQuizQuestion.q;
    
    const optsHtml = activeMiniQuizQuestion.opts.map((opt, i) => `
        <button class="quiz-opt-btn" onclick="submitMiniQuizAnswer(this, ${i})" style="justify-content: center; font-weight: bold;">
            ${opt}
        </button>
    `).join('');
    
    oEl.innerHTML = optsHtml;
    fEl.style.display = "none";
    bEl.style.display = "none";
    
    const modal = document.getElementById("mini-quiz-overlay");
    modal.style.display = "flex";
}

window.submitMiniQuizAnswer = function(btnEl, chosenIdx) {
    const buttons = document.querySelectorAll('#mini-quiz-options button');
    buttons.forEach(btn => btn.disabled = true);
    
    const isCorrect = chosenIdx === activeMiniQuizQuestion.answer;
    const feedback = document.getElementById("mini-quiz-feedback");
    
    if (isCorrect) {
        btnEl.classList.add('correct');
        AudioSynth.playCorrect();
        runConfetti(50);
        addXP(5, document.querySelector("#mini-quiz-overlay .modal-content"));
        
        feedback.style.color = "var(--color-success)";
        feedback.textContent = "Helyes! +5 XP bónusz!";
    } else {
        btnEl.classList.add('incorrect');
        buttons[activeMiniQuizQuestion.answer].classList.add('correct');
        AudioSynth.playIncorrect();
        
        feedback.style.color = "var(--color-error)";
        feedback.textContent = "Sajnos nem! A helyes válasz a zölddel jelölt opció.";
    }
    
    feedback.style.display = "block";
    document.getElementById("mini-quiz-continue-btn").style.display = "block";
};

// Action handler for manual section completion
function completeSubsectionAction(level, section, subsection, buttonEl) {
    const key = `${level}_${section}_${subsection}`;
    
    // Prevent duplicate point claims
    if (userProgress.completed[key]) return;
    
    // Stop the timer
    stopStopwatch();

    // Reward points
    userProgress.points = (userProgress.points || 0) + 5;
    
    // Add to time spent & exercises count (saved within scores to avoid DB schema migrations)
    if (!userProgress.scores) userProgress.scores = {};
    userProgress.scores.totalTimeSpent = (userProgress.scores.totalTimeSpent || 0) + stopwatchSeconds;
    userProgress.scores.exercisesCompleted = (userProgress.scores.exercisesCompleted || 0) + 1;
    
    // Mark as completed
    userProgress.completed[key] = true;
    
    // Trigger floating +5 points pop animation
    const container = buttonEl.closest(".completion-button-container");
    if (container) {
        const pop = document.createElement("div");
        pop.className = "floating-points-pop";
        pop.textContent = "+5 XP! 🎉";
        container.appendChild(pop);
        
        // Remove pop element after animation completes
        setTimeout(() => {
            pop.remove();
        }, 1200);
    }
    
    // Transform button to completed state
    buttonEl.className = "btn-complete-section completed-badge";
    buttonEl.disabled = true;
    buttonEl.innerHTML = "Teljesítve ✓";
    
    // Save state and update UI
    saveUserProgress();
    
    // Update daily quests for completing a lesson
    if (typeof updateQuestProgress === 'function') {
        updateQuestProgress('complete_lesson', 1);
    }
    
    // Potentially trigger a miniquiz on completion
    if (canTriggerMiniQuiz()) {
        setTimeout(() => {
            triggerMiniQuiz(level, section, subsection);
        }, 500);
    }

    // Render convenient "Next Lesson" button right next to it so user doesn't have to scroll up
    if (container) {
        const nextLessonInfo = findNextGuestAccessibleLesson(level, section);
        if (nextLessonInfo) {
            container.style.display = "flex";
            container.style.gap = "1rem";
            container.style.justifyContent = "center";
            container.style.flexWrap = "wrap";
            
            const nextBtn = document.createElement("button");
            nextBtn.className = "btn-complete-section";
            nextBtn.style.background = "linear-gradient(135deg, var(--color-accent-in), var(--color-accent-on))";
            nextBtn.style.color = "#000";
            
            if (nextLessonInfo.endOfGuestContent) {
                nextBtn.innerHTML = `<span>Teljes Hozzáférés Feloldása</span>`;
                nextBtn.onclick = () => {
                    openPaywallModal();
                };
            } else {
                nextBtn.innerHTML = `<span>Tovább: ${nextLessonInfo.title}</span> <span style="font-size: 1.2rem;">→</span>`;
                nextBtn.onclick = () => {
                    const targetLevel = nextLessonInfo.level;
                    const targetSection = nextLessonInfo.section;
                    const targetKey = nextLessonInfo.key;
                    
                    const accordion = document.querySelector(`.course-accordion[data-level="${targetLevel}"][data-section="${targetSection}"]`);
                    if (accordion) accordion.open = true;

                    const links = document.querySelectorAll(".subsection-link");
                    links.forEach(l => l.classList.remove("active"));
                    
                    if (accordion) {
                        const targetLink = accordion.querySelector(`.subsection-link[data-subsection="${targetKey}"]`);
                        if (targetLink) targetLink.classList.add("active");
                    }
                    currentLevel = targetLevel;
                    currentSection = targetSection;
                    currentSubsection = targetKey;
                    renderSubsection(targetLevel, targetSection, targetKey);
                    updateProgressUI();
                    
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                };
            }
            container.appendChild(nextBtn);
        }
    }
}

// Scans the sidebar links to display completion checkmarks and update the level completion meter
async function updateProgressUI() {
    const links = document.querySelectorAll(".subsection-link");
    let totalItems = 0;
    let completedItems = 0;

    links.forEach(link => {
        const accordion = link.closest(".course-accordion");
        if (!accordion) return;

        const level = accordion.getAttribute("data-level");
        const section = accordion.getAttribute("data-section");
        const subsection = link.getAttribute("data-subsection");
        const key = `${level}_${section}_${subsection}`;
        const subData = learningContent[level]?.[section]?.subsections?.[subsection];

        // 1. Guest/Subscription Restrictions
        const isContentRestricted = !isContentAccessible(level, section, subsection);
        const iconSpan = link.querySelector(".subsection-icon");
        
        if (isContentRestricted) {
            link.classList.add("guest-locked");
            link.classList.remove("locked"); // Ensure it doesn't trigger standard exam lock
            if (iconSpan) iconSpan.textContent = "🔒";
        } else {
            link.classList.remove("guest-locked");
            // If it's an exam, we still need to check if it's progression-locked
            if (isExam(subData)) {
                const isProgressionLocked = isSectionExamLocked(level, section);
                if (isProgressionLocked) {
                    link.classList.add("locked");
                    if (iconSpan) iconSpan.textContent = "🔒";
                } else {
                    link.classList.remove("locked");
                    if (iconSpan) iconSpan.textContent = subData.icon || "🏆";
                }
            } else {
                link.classList.remove("locked");
                if (iconSpan) iconSpan.textContent = subData.icon || "📚";
            }
        }

        // Only count subsections belonging to the current visual level track, excluding exam
        if (level === currentLevel && !isExam(subData)) {
            totalItems++;
            if (userProgress.completed[key]) {
                completedItems++;
            }
        }

        // Render visual checkmark badge in sidebar if completed
        let badge = link.querySelector(".progress-badge-sidebar");
        if (userProgress.completed[key]) {
            if (!badge) {
                badge = document.createElement("span");
                badge.className = "progress-badge-sidebar done";
                badge.innerHTML = " ✓";
                badge.style.color = "var(--color-success)";
                badge.style.fontWeight = "bold";
                badge.style.marginLeft = "auto";
                link.appendChild(badge);
            }
        } else {
            if (badge) {
                badge.remove();
            }
        }
    });



    // Update global points counter
    const pointsEl = document.getElementById("points-counter");
    if (pointsEl) {
        pointsEl.textContent = userProgress.points || 0;
    }

    // Update gamification sidebar elements
    if (typeof updateUserLevelState === "function") updateUserLevelState();
    if (typeof updateStreakUI === "function") updateStreakUI();
    if (typeof syncShopButtonsUI === "function") syncShopButtonsUI();

    // UPDATE HERO CTA CARD DYNAMICALLY
    const nextLesson = getNextUncompletedLesson(currentLevel);
    const ctaCard = document.querySelector(".resume-cta-card");
    const ctaHeader = document.querySelector(".resume-cta-header");
    const ctaTitle = document.querySelector(".resume-cta-title");
    const ctaBtn = document.getElementById("btn-resume-lesson");
    
    if (ctaCard && ctaHeader && ctaTitle && ctaBtn) {
        if (!nextLesson) {
            // Course completely finished!
            // Retrieve exam score for the last section as a proxy, or total course points
            const lastSection = Object.keys(learningContent[currentLevel] || {}).pop() || "ToBe";
            const examKey = `${currentLevel}_${lastSection}_sectionExam`;
            const examData = learningContent[currentLevel]?.[lastSection]?.subsections?.sectionExam;
            
            let totalQuestions = (examData && examData.items) ? examData.items.length : 0;
            
            // If the exam data hasn't been lazy-loaded yet, fetch it just to calculate the true length
            if (totalQuestions === 0 && examData && examData.dataSource) {
                if (vocabCache[examData.dataSource]) {
                    totalQuestions = vocabCache[examData.dataSource].items ? vocabCache[examData.dataSource].items.length : 0;
                } else {
                    try {
                        const res = await fetch(examData.dataSource + "?v=1.0.7");
                        if (res.ok) {
                            const json = await res.json();
                            vocabCache[examData.dataSource] = json;
                            totalQuestions = json.items ? json.items.length : 0;
                        }
                    } catch(e) {
                        console.error("Could not fetch exam max score length", e);
                    }
                }
            }
            
            const bestScore = userProgress.scores[examKey] || 0;
            const percentage = totalQuestions > 0 ? Math.round((bestScore / totalQuestions) * 100) : 100;
            
            let grade = "";
            if (percentage >= 90) grade = "Kiváló! 🌟";
            else if (percentage >= 70) grade = "Jó munka! 👍";
            else if (percentage >= 50) grade = "Átmentél! 📚";
            
            ctaCard.innerHTML = `
                <div style="text-align: center; width: 100%;">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎊</div>
                    <div class="resume-cta-title" style="color: var(--color-accent-in); margin-bottom: 0.5rem;">Gratulálunk!</div>
                    <p style="color: var(--color-text-main); font-size: 1.1rem; line-height: 1.5; margin-bottom: 1rem;">
                        Az <strong>Első Lecke (A "Lenni" Ige)</strong> befejezve!<br>Hamarosan érkezik a következő modul.
                    </p>
                    <div class="exam-result-card passed" style="max-width: 300px; margin: 0 auto; background: var(--color-bg-surface); padding: 1rem; border-radius: 12px; border: 1px solid var(--color-success);">
                        <span class="exam-score" style="display: block; font-size: 2rem; font-weight: bold; color: var(--color-success);">${bestScore} / ${totalQuestions}</span>
                        <span class="exam-percentage" style="display: block; color: var(--color-success);">(${percentage}%)</span>
                        <p class="exam-grade" style="margin-top: 0.5rem;">${grade}</p>
                    </div>
                </div>
            `;
        } else {
            // Check if current view is completed
            const currentKey = `${currentLevel}_${currentSection}_${currentSubsection}`;
            const isCurrentCompleted = userProgress.completed[currentKey];
            
            ctaTitle.textContent = `${currentLevel} - ${nextLesson.title}`;
            
            if (isCurrentCompleted) {
                ctaHeader.textContent = "Következő lecke";
                ctaBtn.innerHTML = `<span>Folytatás</span> <span style="font-size: 1.2rem;">→</span>`;
                ctaBtn.style.opacity = "1";
                ctaBtn.style.pointerEvents = "auto";
                ctaBtn.style.background = "linear-gradient(135deg, var(--color-accent-in), var(--color-accent-on))";
                ctaBtn.style.border = "none";
                ctaBtn.style.color = "#000";
                ctaBtn.setAttribute("data-target", nextLesson.key);
            } else {
                ctaHeader.textContent = "Aktuális lecke";
                ctaBtn.innerHTML = `<span>Fejezd be az aktuális leckét!</span> <span style="font-size: 1.2rem;">🔒</span>`;
                ctaBtn.style.opacity = "0.7";
                ctaBtn.style.pointerEvents = "none";
                ctaBtn.style.background = "var(--color-bg-surface)";
                ctaBtn.style.border = "1px dashed var(--color-text-muted)";
                ctaBtn.style.color = "var(--color-text-muted)";
                ctaBtn.removeAttribute("data-target");
            }
        }
    }
}

// ==========================================================================
// DYNAMIC SIDEBAR RENDERER
// ==========================================================================

// ==========================================================================
// PHASE 8: CODDY-STYLE VERTICAL ROADMAP RENDERING
// ==========================================================================
function renderSidebar(levelName) {
    // We hijacked the old renderSidebar name so we don't break init() calls.
    renderRoadmap(levelName);
}

function renderRoadmap(levelName) {
    const container = document.getElementById("main-roadmap-container");
    if (!container) return;
    
    container.innerHTML = "";
    
    const levelData = learningContent[levelName];
    if (!levelData) return;
    
    // Generate the path dynamically
    Object.keys(levelData).forEach((sectionKey, sectionIndex) => {
        const sectionData = levelData[sectionKey];
        const title = sectionData.title_hu || sectionData.title || `Lecke: ${sectionKey}`;
        
        let nodesHtml = "";
        
        let subKeys = [];
        if (sectionData.subsections) {
            subKeys = Object.keys(sectionData.subsections);
        }
        
        const numNodes = subKeys.length || 1;
        
        subKeys.forEach((subKey, idx) => {
            const subData = sectionData.subsections[subKey];
            const isAccessible = isContentAccessible(levelName, sectionKey, subKey);
            const progressKey = `${levelName}_${sectionKey}_${subKey}`;
            const isCompleted = userProgress.completed[progressKey];
            const isContentAccess = true;
            const isLinearLocked = false;
            
            // In a viewBox of 300, center is 150.
            // Amplitude 60 means nodes go from 90 to 210 in viewBox units (30% to 70% of width)
            const xOffsetViewBox = Math.sin(idx * 0.8) * 60;
            const nodeLeftPercent = (xOffsetViewBox / 300) * 100;
            
            let statusClass = "locked";
            let lockHtml = `<div class="locked-icon" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 2rem; z-index: 10;">🔒</div>`;
            
            if (isAccessible) {
                if (isCompleted) {
                    statusClass = "completed";
                    lockHtml = "";
                } else {
                    statusClass = "active";
                    lockHtml = "";
                }
            }
            
            let iconHtml = subData.icon || "📝";
            if (isExam(subData)) iconHtml = "🏆";
            
            // 2. Build the incremental SVG connector to the NEXT node
            let connectorHtml = "";
            if (idx < subKeys.length - 1) {
                const nextXOffsetViewBox = Math.sin((idx + 1) * 0.8) * 60;
                
                // SVG coordinates in viewBox 0 0 300 120
                const startX = 150 + xOffsetViewBox;
                const startY = 60; // Bottom of current node (node is ~60px tall)
                const endX = 150 + nextXOffsetViewBox;
                const endY = 120; // Top of next node (padding-bottom 60px makes wrapper 120px tall)
                
                const controlY = startY + (endY - startY) / 2;
                const pathData = `M ${startX},${startY} C ${startX},${controlY} ${endX},${controlY} ${endX},${endY}`;
                
                connectorHtml = `
                    <svg class="roadmap-connector-svg" viewBox="0 0 300 120" preserveAspectRatio="none">
                        <path class="roadmap-connector-path" d="${pathData}" vector-effect="non-scaling-stroke" />
                    </svg>
                `;
            }
            
            // 3. Assemble the HTML for this node
            nodesHtml += `
                <div class="node-wrapper">
                    ${connectorHtml}
                    <div class="lesson-node ${statusClass}" style="left: ${nodeLeftPercent}%;" onclick="openRoadmapNode('${levelName}', '${sectionKey}', '${subKey}', ${isAccessible})">
                        <div class="lesson-node-circle">${iconHtml}</div>
                        ${lockHtml}
                    </div>
                </div>
            `;
        });
        
        const sectionHtml = `
            <div class="lesson-section-box">
                <h2 class="lesson-section-title">${title}</h2>
                <p class="lesson-section-subtitle">${sectionData.description || 'Teljesítsd az összes modult!'}</p>
                <div class="lesson-nodes-container-flex">
                    ${nodesHtml}
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML("beforeend", sectionHtml);
    });
    
    setupHeroCardAndScroll(levelName);
}

window.openRoadmapNode = function(level, section, subsection, isAccessible) {
    if (!isAccessible) {
        if (ProgressManager.isGuest && !isContentAccessible(level, section, subsection)) {
            openPaywallModal();
        } else {
            openLockedModal();
        }
        return;
    }
    
    // Fetch data for modal
    const sectionData = learningContent[level][section];
    const subData = sectionData.subsections[subsection];
    const title = subData.title || "Lecke";
    let iconHtml = subData.icon || "📝";
    if (isExam(subData)) iconHtml = "🏆";
    let desc = "Kattints az indításra a lecke megkezdéséhez!";
    if (subData.type === 'words') desc = "Tanuld meg a legújabb szavakat és kifejezéseket.";
    if (subData.type === 'fill_blanks' || subData.type === 'word_order' || subData.type === 'true_false') desc = "Tedd próbára a tudásod egy rövid gyakorló kvízzel!";
    if (isExam(subData)) desc = "Vizsgázz le a fejezetből, hogy feloldd a következő szintet!";
    if (subData.type === 'explanation') desc = "Olvasd el a nyelvvtani magyarázatot a fejezethez.";

    let overlay = document.getElementById("pre-lesson-modal");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "auth-modal-overlay";
        overlay.id = "pre-lesson-modal";
        overlay.style.display = "flex";
        if(typeof syncShopButtonsUI === "function") syncShopButtonsUI();
        overlay.style.zIndex = "10000";
        document.body.appendChild(overlay);
    } else {
        overlay.style.display = "flex";
        if(typeof syncShopButtonsUI === "function") syncShopButtonsUI();
    }
    
    overlay.innerHTML = `
        <div class="auth-modal-card proto-card" style="text-align: center; max-width: 400px; width: 90%; animation: popIn 0.3s ease-out;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">${iconHtml}</div>
            <h2 style="color: var(--color-accent-in); margin-bottom: 0.5rem; font-size: 1.8rem;">${title}</h2>
            <p style="margin-bottom: 2rem; color: var(--color-text-muted); font-size: 1.1rem;">${desc}</p>
            
            <button class="btn btn-primary" style="width: 100%; justify-content: center; font-size: 1.2rem; padding: 1rem;" onclick="startLessonDirectly('${level}', '${section}', '${subsection}')">Indítás</button>
            <button class="btn btn-secondary" style="width: 100%; justify-content: center; margin-top: 1rem; border: none; background: transparent; color: var(--color-text-muted);" onclick="this.closest('.auth-modal-overlay').style.display='none'">Mégse</button>
        </div>
    `;
};

window.startLessonDirectly = function(level, section, subsection) {
    const modal = document.getElementById("pre-lesson-modal");
    if (modal) modal.style.display = "none";
    
    // Set globals
    currentLevel = level;
    currentSection = section;
    currentSubsection = subsection;
    
    // Add sliding active class
    const slider = document.getElementById("main-slider");
    if (slider) slider.classList.add("step-active");
    
    // Render the workspace content
    renderSubsection(level, section, subsection);
    
    // Scroll to top
    window.scrollTo(0,0);
};

window.closeWorkspace = function() {
    const slider = document.getElementById("main-slider");
    if (slider) slider.classList.remove("step-active");
    
    // Reload roadmap to refresh completed colors
    renderRoadmap(currentLevel);
};

// 1. LISTEN TO SIDEBAR ACCORDION SUBSECTION LINKS
function initAccordionListeners() {
    const subsectionLinks = document.querySelectorAll(".subsection-link");

    subsectionLinks.forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault();

            if (link.classList.contains("guest-locked")) {
                openPaywallModal();
                return;
            }

            if (link.classList.contains("locked")) {
                openLockedModal();
                return;
            }

            const subsectionKey = link.getAttribute("data-subsection");
            if (!subsectionKey) return;

            // Clear previous active states from all subsection links
            subsectionLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            // Extract the correct level and section from the parent accordion
            const accordion = link.closest(".course-accordion");
            if (accordion) {
                currentLevel = accordion.getAttribute("data-level");
                currentSection = accordion.getAttribute("data-section");
            }

            // Update current subsection and render
            currentSubsection = subsectionKey;
            renderSubsection(currentLevel, currentSection, currentSubsection);

            // Close the parent accordion after clicking to keep UI clean on mobile
            if (accordion && !isDesktopLayout()) {
                accordion.open = false;
            }
        });
    });

    // Guard final exam link
    const finalExamLink = document.querySelector(".final-exam-link");
    if (finalExamLink) {
        finalExamLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (!isLevelExamUnlocked(currentLevel)) {
                openLockedModal("A szintzáró vizsga megkezdéséhez el kell érned a szinten elérhető maximális XP legalább 80%-át!");
                return;
            }
            alert("Szintzáró vizsga megnyitása... (Fejlesztés alatt)");
        });
    }
}

// 1.5. LISTEN TO HERO RESUME CTA BUTTON
function initResumeCTAListener() {
    // We use event delegation because the CTA card might be re-rendered or modified
    document.addEventListener("click", (e) => {
        const resumeBtn = e.target.closest("#btn-resume-lesson");
        if (!resumeBtn) return;
        
        e.preventDefault();
        
        const targetSubKey = resumeBtn.getAttribute("data-target");
        if (!targetSubKey) return; // Blocked state (current lesson not completed), do nothing
        
        const level = currentLevel;
        const section = currentSection;
        
        // Visual sync: open the correct accordion if closed
        const accordion = document.querySelector(`.course-accordion[data-level="${level}"][data-section="${section}"]`);
        if (accordion) accordion.open = true;

        // Update active state in sidebar
        const links = document.querySelectorAll(".subsection-link");
        links.forEach(l => l.classList.remove("active"));
        
        if (accordion) {
            const targetLink = accordion.querySelector(`.subsection-link[data-subsection="${targetSubKey}"]`);
            if (targetLink) targetLink.classList.add("active");
        }
        
        // Render subsection
        currentSubsection = targetSubKey;
        renderSubsection(level, section, targetSubKey);
        
        // Update UI to check locks and next steps immediately
        updateProgressUI();

        // Smooth scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// 2. LISTEN TO GLOBAL STATIC TOP NAVBAR LEVEL BUTTONS
function initTopNavbarListeners() {
    // Select our horizontal navbar element links
    const topNavLinks = {
        A1: document.getElementById("nav-a1"),
        A2: document.getElementById("nav-a2"),
        B1: document.getElementById("nav-b1"),
        B2: document.getElementById("nav-b2")
    };

    // Simple loop mapping events over keys
    Object.keys(topNavLinks).forEach(level => {
        const button = topNavLinks[level];
        if (!button) return;

        button.addEventListener("click", (event) => {
            event.preventDefault();

            // Check if the requested level's first course is accessible
            const accessible = isContentAccessible(level, "ToBe");

            if (!accessible) {
                if (ProgressManager.isGuest) {
                    openPaywallModal();
                } else {
                    // Authenticated users get the WIP modal if the content isn't built yet
                    openWipModal();
                }
                return;
            }

            if (level === "A1" || ProgressManager.data.role === "admin") {
                // Trigger live context layout switch without page refreshes
                // Admins can bypass WIP and see the empty layouts for testing
                switchGlobalLevel(level, true); // Start empty when switching levels
            } else if (level === "A2" || level === "B1" || level === "B2") {
                // Since they are allowed, but the content is currently empty, show WIP
                openWipModal();
            }
        });
    });
}

// 3. SEAMLESSLY SWITCH LEVEL DOMAIN WINDOW
function switchGlobalLevel(levelName, startEmpty = false) {
    if(typeof window.closeWorkspace === "function") window.closeWorkspace();
    currentLevel = levelName;
    
    // SMART RESUME LOGIC
    const nextUncompleted = getNextUncompletedLesson(levelName);
    if (nextUncompleted) {
        currentSection = nextUncompleted.section;
        if (!startEmpty) {
            currentSubsection = nextUncompleted.key;
        }
    } else {
        // Fallback to first section if entirely completed
        currentSection = Object.keys(learningContent[levelName] || {})[0] || "ToBe";
        if (!startEmpty) {
            currentSubsection = "explanation";
        }
    }

    // Update active visual status anchors across top header links
    const navbarLinks = document.querySelectorAll(".site-header .nav-link");
    navbarLinks.forEach(link => link.classList.remove("active"));
    
    const targetHeaderLink = document.getElementById(`nav-${levelName.toLowerCase()}`);
    if (targetHeaderLink) targetHeaderLink.classList.add("active");

    // NEW: Dynamically build the sidebar for the target level
    renderSidebar(levelName);

    const subsectionLinks = document.querySelectorAll(".subsection-link");
    subsectionLinks.forEach(l => l.classList.remove("active"));

    if (startEmpty) {
        currentSubsection = null;
        const workspace = document.getElementById("workspace");
        document.querySelector(".current-topic-title").textContent = "Üdvözlünk a Dashboardon!";
        
        // Ensure breadcrumbs reflect the general section without a specific sub-topic
        const breadcrumbs = document.querySelector(".breadcrumb-list");
        if (breadcrumbs) {
            const levelLabel = levelName === "A1" ? "A1 Kezdő" : levelName === "A2" ? "A2 Alapfok" : levelName;
            breadcrumbs.innerHTML = `
                <li>${levelLabel}</li>
                <li aria-current="page">Áttekintés</li>
            `;
        }

        workspace.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 400px; text-align: center; padding: 2rem;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">👋</div>
                <h2 style="color: var(--color-text-main); margin-bottom: 1rem;">Válassz egy leckét a folytatáshoz!</h2>
                <p style="color: var(--color-text-muted); max-width: 500px; line-height: 1.6;">
                    A bal oldali menüben találod a tananyagokat. Kezdésként kattints a <strong>${ProgressManager.isGuest ? 'Szavak' : 'Magyarázat'}</strong> menüpontra az első modulban.
                </p>
            </div>
        `;
    } else {
        currentSubsection = "explanation";
        const firstLink = document.querySelector('.subsection-link[data-subsection="explanation"]');
        if (firstLink) firstLink.classList.add("active");
        
        // Run core engine to paint the chosen view
        renderSubsection(currentLevel, currentSection, currentSubsection);
    }
    
    updateProgressUI();
}

// 4. CORE SUBSECTION RENDERING MACHINERY
function renderSubsection(level, section, subsection) {
    const workspace = document.getElementById("workspace");
    const moduleData = learningContent[level]?.[section];

    // Synchronize breadcrumbs position trail tracking strip text strings
    const breadcrumbs = document.querySelector(".breadcrumb-list");
    const subsectionData = moduleData?.subsections?.[subsection];
    const subsectionTitle = subsectionData?.title || subsection;

    if (breadcrumbs) {
        const levelLabel = level === "A1" ? "A1 Kezdő" : level === "A2" ? "A2 Alapfok" : level;
        breadcrumbs.innerHTML = `
            <li>${levelLabel}</li>
            <li>${moduleData?.title || 'Lecke'}</li>
            <li aria-current="page">${subsectionTitle}</li>
        `;
    }

    if (!moduleData || !subsectionData) {
        document.querySelector(".current-topic-title").textContent = "Tananyag Nem Található";
        workspace.innerHTML = `<p class="error-text" style="color: var(--color-error); padding: 2rem;">Sajnáljuk, ehhez a részhez még nem töltöttek fel feladatokat.</p>`;
        return;
    }

    if (!isContentAccessible(level, section, subsection)) {
        if (ProgressManager.isGuest) {
            openPaywallModal();
            // If they land directly on a blocked page (e.g. via direct load), fallback safely to "words" if it was "explanation"
            if (subsection === "explanation" || subsection === "sectionExam") {
                // To avoid an infinite loop or broken UI state, manually render the "words" section instead
                const safeSubsection = "words";
                const safeData = moduleData?.subsections?.[safeSubsection];
                if (safeData) {
                    currentSubsection = safeSubsection;
                    document.querySelector(".current-topic-title").textContent = `${safeData.icon} ${safeData.title}`;
                    
                    // Sync sidebar active link
                    const links = document.querySelectorAll(".subsection-link");
                    links.forEach(l => l.classList.remove("active"));
                    const accordion = document.querySelector(`.course-accordion[data-level="${level}"][data-section="${section}"]`);
                    if (accordion) {
                        const targetLink = accordion.querySelector(`.subsection-link[data-subsection="${safeSubsection}"]`);
                        if (targetLink) targetLink.classList.add("active");
                    }

                    renderWordsTemplate(workspace, safeData, moduleData);
                }
            }
            return;
        }
    }

    // Reset exercise attempts tracking for the new view
    exerciseAttempts = {};

    // Setup stopwatch and success rate display
    if (isExercise(subsectionData) || isExam(subsectionData)) {
        startStopwatch();
        updateSuccessRateDisplay(true);
    } else {
        stopStopwatch();
        stopwatchSeconds = 0;
        updateStopwatchDisplay();
        updateSuccessRateDisplay(false);
    }

    document.querySelector(".current-topic-title").textContent = `${subsectionData.icon} ${subsectionData.title}`;

    // Render different template based on subsection type
    switch (subsectionData.type) {
        case "explanation":
            renderExplanationTemplate(workspace, subsectionData, moduleData);
            break;
        case "words":
            renderWordsTemplate(workspace, subsectionData, moduleData);
            break;
        case "fill_blanks":
        case "word_order":
        case "true_false":
            renderQuizCardTemplate(workspace, subsectionData);
            break;
        case "section_exam":
            renderSectionExamTemplate(workspace, subsectionData);
            break;
        default:
            workspace.innerHTML = `<p class="error-text" style="color: var(--color-error); padding: 2rem;">Ismeretlen feladattípus.</p>`;
    }
}

// =====================================================================
//   TEMPLATE RENDERERS — Each creates a section-specific layout
// =====================================================================

// MAGYARÁZAT (Explanation) — Grammar explanation article
function renderExplanationTemplate(workspace, data, moduleData) {
    if (currentSection === "ToBe") {
        workspace.innerHTML = `
            <div class="lesson-view">
                <!-- INTRO SECTION -->
                <article class="explanation-intro">
                    <h2>📚 A Nagy Titok: A "Lenni" Ige (The Verb "TO BE")</h2>
                    <p>Az angolban a legfontosabb szó a <strong>TO BE</strong>, ami azt jelenti: <strong>VAN</strong> (létezik).</p>
                    <p>Magyarul sokszor elhagyjuk (pl. „Én Ladislav <em>vagyok</em>", de „Ő okos" – nem mondjuk, hogy „Ő <em>van</em> okos").</p>

                    <div class="golden-rule">
                        <span class="golden-rule-icon">⚡</span>
                        <div>
                            <p><strong>Aranyszabály:</strong> Az angolban <strong>NEM hagyhatod el a „VAN"-t</strong>. Mindig ki kell mondanod, hogy ki milyen <em>van</em>, vagy hol <em>van</em>.</p>
                        </div>
                    </div>

                    <p>A „TO BE" egy <strong>alakváltó ige</strong>. 3 formája van – úgy képzeld el, mint három testvért, akik szétosztották maguk között a személyeket:</p>

                    <div class="three-brothers">
                        <div class="brothers-title">A három testvér</div>
                        <div class="brothers-chips">
                            <span class="brother-chip brother-am">AM</span>
                            <span class="brother-chip brother-is">IS</span>
                            <span class="brother-chip brother-are">ARE</span>
                        </div>
                    </div>
                    
                    <div class="explanation-image-container" style="margin-top: 2rem; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 30px oklch(0.12 0.01 260 / 0.5); border: 1px solid oklch(1 0 0 / 0.1);">
                        <img src="assets/images/tobe_verb_visual.png" alt="The Verb 'TO BE' - Simple Present" style="width: 100%; height: auto; display: block; object-fit: contain; cursor: pointer; transition: transform 0.2s ease;" onclick="openLightbox(this.src)" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                    </div>
                </article>

                <!-- STEP TABS -->
                <div class="step-tabs">
                    <button class="step-tab active" data-step="1">
                        <span class="step-tab-number">1</span> Kijelentés
                    </button>
                    <button class="step-tab" data-step="2">
                        <span class="step-tab-number">2</span> Tagadás
                    </button>
                    <button class="step-tab" data-step="3">
                        <span class="step-tab-number">3</span> Kérdés
                    </button>
                </div>

                <!-- STEP PANELS -->
                <div class="step-panels">

                    <!-- STEP 1: Kijelentés -->
                    <div class="step-panel active" id="step-1">
                        <h3>✅ A "VAN" (Kijelentés / Affirmative)</h3>
                        <p>Csak össze kell párosítani a szereplőket a megfelelő alakváltó formával. Tanuljátok meg ritmusra!</p>
                        <p class="flip-hint"><span>👆 Kattints a kártyákra a magyar jelentés megjelenítéséhez!</span></p>

                        <div class="flip-cards-grid">
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">I am <span class="contraction">(I'm)</span></div>
                                        <div class="example-sentence">I am a teacher.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Én vagyok</div>
                                        <div class="hu-example">Én tanár vagyok.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">You are <span class="contraction">(You're)</span></div>
                                        <div class="example-sentence">You are happy.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Te vagy</div>
                                        <div class="hu-example">Te boldog vagy.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">He is <span class="contraction">(He's)</span></div>
                                        <div class="example-sentence">He is smart.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Ő van (fiú)</div>
                                        <div class="hu-example">Ő okos.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">She is <span class="contraction">(She's)</span></div>
                                        <div class="example-sentence">She is nice.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Ő van (lány)</div>
                                        <div class="hu-example">Ő kedves.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">It is <span class="contraction">(It's)</span></div>
                                        <div class="example-sentence">It is a car.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Ez/Az van</div>
                                        <div class="hu-example">Ez egy autó.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">We are <span class="contraction">(We're)</span></div>
                                        <div class="example-sentence">We are here.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Mi vagyunk</div>
                                        <div class="hu-example">Mi itt vagyunk.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">They are <span class="contraction">(They're)</span></div>
                                        <div class="example-sentence">They are tired.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Ők vannak</div>
                                        <div class="hu-example">Ők fáradtak.</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="tip-callout">
                            <span class="tip-callout-icon">💡</span>
                            <p><strong>Tipp:</strong> A való életben a rövidített alakokat fogod hallani (I'm, You're, He's, We're). Próbáld meg te is így kimondani!</p>
                        </div>
                    </div>

                    <!-- STEP 2: Tagadás -->
                    <div class="step-panel" id="step-2">
                        <h3>❌ A "NEM VAN" (Tagadás / Negative)</h3>
                        <p>A tagadás az angolban a legegyszerűbb dolog a világon. Nem kell semmit átrendezni, csak fogni a <span class="not-highlight">NOT</span> (NEM) szócskát, és odarakni a "VAN" mögé.</p>
                        <p class="flip-hint"><span>👆 Kattints a kártyákra a magyar jelentés megjelenítéséhez!</span></p>

                        <div class="flip-cards-grid">
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">I am <span class="not-highlight">not</span></div>
                                        <div class="example-sentence">I am not sad.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Én nem vagyok</div>
                                        <div class="hu-example">Én nem vagyok szomorú.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">You are <span class="not-highlight">not</span> <span class="contraction">(aren't)</span></div>
                                        <div class="example-sentence">You aren't late.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Te nem vagy</div>
                                        <div class="hu-example">Te nem vagy késésben.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">He is <span class="not-highlight">not</span> <span class="contraction">(isn't)</span></div>
                                        <div class="example-sentence">He isn't home.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Ő nem van (fiú)</div>
                                        <div class="hu-example">Ő nincs otthon.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">She is <span class="not-highlight">not</span> <span class="contraction">(isn't)</span></div>
                                        <div class="example-sentence">She isn't hungry.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Ő nem van (lány)</div>
                                        <div class="hu-example">Ő nem éhes.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">It is <span class="not-highlight">not</span> <span class="contraction">(isn't)</span></div>
                                        <div class="example-sentence">It isn't cold.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Az nem van</div>
                                        <div class="hu-example">Nincs hideg.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">We are <span class="not-highlight">not</span> <span class="contraction">(aren't)</span></div>
                                        <div class="example-sentence">We aren't ready.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Mi nem vagyunk</div>
                                        <div class="hu-example">Mi nem vagyunk készen.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">They are <span class="not-highlight">not</span> <span class="contraction">(aren't)</span></div>
                                        <div class="example-sentence">They aren't English.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Ők nem vannak</div>
                                        <div class="hu-example">Ők nem angolok.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- STEP 3: Kérdés -->
                    <div class="step-panel" id="step-3">
                        <h3>❓ A Kérdés (Question) – A Helycsere-trükk</h3>
                        <p>A magyarban a hanglejtéssel kérdezünk („Ő boldog." vs. „Ő boldog?"). Az angolban ez nem elég.</p>
                        <p><strong>A trükk:</strong> Kérdésnél a szereplő (I, you, he...) és a "VAN" (am, is, are) <strong>helyet cserélnek</strong>. A "VAN" előreugrik a mondat elejére, mint egy testőr. 🛡️</p>

                        <div class="question-comparison">
                            <div class="comparison-row" style="animation-delay: 0s">
                                <div class="comparison-card">
                                    <div class="comparison-label">Kijelentés</div>
                                    <div class="comparison-en"><strong>You are</strong> English.</div>
                                    <div class="comparison-hu">Te angol vagy.</div>
                                </div>
                                <span class="comparison-arrow">→</span>
                                <div class="comparison-card question-card">
                                    <div class="comparison-label">Kérdés</div>
                                    <div class="comparison-en"><strong>Are you</strong> English?</div>
                                    <div class="comparison-hu">Angol vagy?</div>
                                </div>
                            </div>
                            <div class="comparison-row" style="animation-delay: 0.1s">
                                <div class="comparison-card">
                                    <div class="comparison-label">Kijelentés</div>
                                    <div class="comparison-en"><strong>He is</strong> a doctor.</div>
                                    <div class="comparison-hu">Ő orvos.</div>
                                </div>
                                <span class="comparison-arrow">→</span>
                                <div class="comparison-card question-card">
                                    <div class="comparison-label">Kérdés</div>
                                    <div class="comparison-en"><strong>Is he</strong> a doctor?</div>
                                    <div class="comparison-hu">Ő orvos?</div>
                                </div>
                            </div>
                            <div class="comparison-row" style="animation-delay: 0.2s">
                                <div class="comparison-card">
                                    <div class="comparison-label">Kijelentés</div>
                                    <div class="comparison-en"><strong>It is</strong> hot.</div>
                                    <div class="comparison-hu">Meleg van.</div>
                                </div>
                                <span class="comparison-arrow">→</span>
                                <div class="comparison-card question-card">
                                    <div class="comparison-label">Kérdés</div>
                                    <div class="comparison-en"><strong>Is it</strong> hot?</div>
                                    <div class="comparison-hu">Meleg van?</div>
                                </div>
                            </div>
                        </div>

                        <div class="tip-callout">
                            <span class="tip-callout-icon">💡</span>
                            <p><strong>Megjegyzés:</strong> Figyeld meg, hogy a „VAN" (is/are/am) mindig előre ugrik a kérdésnél! Ez a „helycsere-trükk" az angol nyelvtan egyik legalapvetőbb szabálya.</p>
                        </div>
                    </div>
                </div>

                <!-- Next Hint -->
                <div class="explanation-next-hint">
                    <p>Ha megértetted a magyarázatot, lépj tovább a <strong>Szavak</strong> szekcióra! →</p>
                </div>
                ${getCompleteButtonHtml(currentLevel, currentSection, currentSubsection, false)}
            </div>
        `;
        initExplanationTabs();
    } else if (currentSection === "ToHave") {
        workspace.innerHTML = `
            <div class="lesson-view">
                <!-- INTRO SECTION -->
                <article class="explanation-intro">
                    <h2>📚 A Másik "VAN": A birtoklás (The Verb To Have)</h2>
                    <p>A “TO HAVE” igét úgy kell megjegyezni, hogy azonnal lásd a kontrasztot a To Be-vel. A magyar nyelv itt egy óriási csapdát állít, mert nekünk nincs külön "birtokolni" igénk (nem mondjuk, hogy „Én birtoklok egy autót”), hanem azt mondjuk: „Van egy autóm”.</p>

                    <p>Múltkor megtanultuk a <strong>TO BE</strong> igét, ami azt jelenti, hogy valaki/valami LÉTEZIK (milyen vagy hol van).<br>
                    Most jön a <strong>TO HAVE</strong>, ami szintén „VAN”-nak fordítható magyarra, de ez <strong>BIRTOKLÁST</strong> jelent. Azt fejezi ki, hogy <strong>MI VAN NEKED</strong>.</p>
                    
                    <div class="golden-rule">
                        <span class="golden-rule-icon">⚡</span>
                        <div>
                            <p><strong>Így válaszd szét a fejedben:</strong></p>
                            <ul style="margin-top: 0.5rem; padding-left: 1.5rem; list-style-type: disc;">
                                <li><strong>To Be (am/is/are):</strong> Én magam vagyok valamilyen. <br><em>I am hot. (Melegem van)</em></li>
                                <li style="margin-top: 0.5rem;"><strong>To Have (have/has):</strong> Van valamim, ami az enyém, amit meg tudok fogni. <br><em>I have a car. (Van egy autóm)</em></li>
                            </ul>
                        </div>
                    </div>

                    <p>A TO HAVE is egy alakváltó, de neki csak 2 formája van: <strong>HAVE</strong> és <strong>HAS</strong>.</p>

                    <div class="three-brothers">
                        <div class="brothers-title">A két forma</div>
                        <div class="brothers-chips">
                            <span class="brother-chip brother-am" style="background:var(--color-accent-in);">HAVE</span>
                            <span class="brother-chip brother-is" style="background:var(--color-accent-out);">HAS</span>
                        </div>
                    </div>
                </article>

                <!-- STEP TABS -->
                <div class="step-tabs">
                    <button class="step-tab active" data-step="1">
                        <span class="step-tab-number">1</span> Kijelentés
                    </button>
                    <button class="step-tab" data-step="2">
                        <span class="step-tab-number">2</span> Tagadás
                    </button>
                    <button class="step-tab" data-step="3">
                        <span class="step-tab-number">3</span> Kérdés
                    </button>
                </div>

                <!-- STEP PANELS -->
                <div class="step-panels">

                    <!-- STEP 1: Kijelentés -->
                    <div class="step-panel active" id="step-1">
                        <h3>✅ 1. LÉPÉS: A Birtoklás (Kijelentés / Affirmative)</h3>
                        <p>Itt szinte mindenki a <strong>HAVE</strong> alakot kapja, egyetlen egy kivétellel: a "Királyi Háromság" (He, She, It) most is különcködik, ők a <strong>HAS</strong> alakot kapják.</p>
                        <p class="flip-hint"><span>👆 Kattints a kártyákra a magyar jelentés megjelenítéséhez!</span></p>

                        <div class="flip-cards-grid">
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">I have</div>
                                        <div class="example-sentence">I have a dog.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Nekem van</div>
                                        <div class="hu-example">Van egy kutyám.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">You have</div>
                                        <div class="example-sentence">You have a nice phone.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Neked van</div>
                                        <div class="hu-example">Van egy jó telefonod.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">He has</div>
                                        <div class="example-sentence">He has a big house.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Neki van (fiú)</div>
                                        <div class="hu-example">Van egy nagy háza.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">She has</div>
                                        <div class="example-sentence">She has blue eyes.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Neki van (lány)</div>
                                        <div class="hu-example">Kék szemei vannak.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">It has</div>
                                        <div class="example-sentence">The laptop has a good battery.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Ennek/Annak van</div>
                                        <div class="hu-example">A laptopnak jó akkumulátora van.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">We have</div>
                                        <div class="example-sentence">We have a meeting.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Nekünk van</div>
                                        <div class="hu-example">Van egy találkozónk.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">They have</div>
                                        <div class="example-sentence">They have a lot of time.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Nekik van</div>
                                        <div class="hu-example">Sok idejük van.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- STEP 2: Tagadás -->
                    <div class="step-panel" id="step-2">
                        <h3>❌ 2. LÉPÉS: Amikor "NINCS" (Tagadás / Negative)</h3>
                        <p>A To Be-nél csak mögé raktuk a not-ot (is not). A To Have viszont egy "lusta" ige, egyedül nem tud tagadni. Kell mellé egy segédmunkás (segédige), aki elvégzi a piszkos munkát. Ez a segédmunkás a <span class="not-highlight">DON'T</span> vagy a <span class="not-highlight">DOESN'T</span>.</p>
                        
                        <div class="tip-callout">
                            <span class="tip-callout-icon">💡</span>
                            <p><strong>Aranyszabály:</strong> Ha a segédmunkás megérkezik, a HAS visszaalakul az eredeti HAVE formájára! Tagadásban már csak HAVE-et hallunk. <em>(Figyelj: doesn't HAS nem létezik!)</em></p>
                        </div>

                        <p class="flip-hint"><span>👆 Kattints a kártyákra a magyar jelentés megjelenítéséhez!</span></p>

                        <div class="flip-cards-grid">
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">I don't have</div>
                                        <div class="example-sentence">I don't have a car.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Nekem nincs</div>
                                        <div class="hu-example">Nincs autóm.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">You don't have</div>
                                        <div class="example-sentence">You don't have time.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Neked nincs</div>
                                        <div class="hu-example">Nincs időd.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">He doesn't have</div>
                                        <div class="example-sentence">He doesn't have a job.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Neki nincs (fiú)</div>
                                        <div class="hu-example">Nincs munkája.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">She doesn't have</div>
                                        <div class="example-sentence">She doesn't have a sister.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Neki nincs (lány)</div>
                                        <div class="hu-example">Nincs lánytestvére.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">It doesn't have</div>
                                        <div class="example-sentence">It doesn't have a screen.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Ennek/Annak nincs</div>
                                        <div class="hu-example">Nincs képernyője.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">We don't have</div>
                                        <div class="example-sentence">We don't have a problem.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Nekünk nincs</div>
                                        <div class="hu-example">Nincs problémánk.</div>
                                    </div>
                                </div>
                            </div>
                            <div class="flip-card" onclick="this.classList.toggle('flipped')">
                                <div class="flip-card-inner">
                                    <div class="flip-card-front">
                                        <div class="pronoun-verb">They don't have</div>
                                        <div class="example-sentence">They don't have money.</div>
                                    </div>
                                    <div class="flip-card-back">
                                        <div class="hu-meaning">Nekik nincs</div>
                                        <div class="hu-example">Nincs pénzük.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- STEP 3: Kérdés -->
                    <div class="step-panel" id="step-3">
                        <h3>❓ 3. LÉPÉS: A Kérdés (Question) – A Segédmunkás előreugrik</h3>
                        <p>Mivel a To Have lusta, a kérdésnél sem tud helyet cserélni, mint a To Be. Ide is be kell hívni a segédmunkást (<strong>DO</strong> vagy <strong>DOES</strong>), aki beáll a mondat legelejére, mint egy testőr. 🛡️</p>
                        
                        <div class="tip-callout">
                            <span class="tip-callout-icon">💡</span>
                            <p><strong>A szabály itt is él:</strong> Ha a DOES ott van a mondatban, az összeszippantja a különlegességet, így a He/She/It után is <strong>HAVE</strong> áll a kérdésben!</p>
                        </div>

                        <div class="question-comparison">
                            <div class="comparison-row" style="animation-delay: 0s">
                                <div class="comparison-card">
                                    <div class="comparison-label">Kijelentés</div>
                                    <div class="comparison-en"><strong>You have</strong> a pen.</div>
                                    <div class="comparison-hu">Van tollad.</div>
                                </div>
                                <span class="comparison-arrow">→</span>
                                <div class="comparison-card question-card">
                                    <div class="comparison-label">Kérdés</div>
                                    <div class="comparison-en"><strong>Do you have</strong> a pen?</div>
                                    <div class="comparison-hu">Van tollad?</div>
                                </div>
                            </div>
                            <div class="comparison-row" style="animation-delay: 0.1s">
                                <div class="comparison-card">
                                    <div class="comparison-label">Kijelentés</div>
                                    <div class="comparison-en"><strong>She has</strong> a key.</div>
                                    <div class="comparison-hu">Van kulcsa.</div>
                                </div>
                                <span class="comparison-arrow">→</span>
                                <div class="comparison-card question-card">
                                    <div class="comparison-label">Kérdés</div>
                                    <div class="comparison-en"><strong>Does she have</strong> a key?</div>
                                    <div class="comparison-hu">Van kulcsa? <br><small>(NEM Does she has!)</small></div>
                                </div>
                            </div>
                            <div class="comparison-row" style="animation-delay: 0.2s">
                                <div class="comparison-card">
                                    <div class="comparison-label">Kijelentés</div>
                                    <div class="comparison-en"><strong>They have</strong> a meeting.</div>
                                    <div class="comparison-hu">Van megbeszélésük.</div>
                                </div>
                                <span class="comparison-arrow">→</span>
                                <div class="comparison-card question-card">
                                    <div class="comparison-label">Kérdés</div>
                                    <div class="comparison-en"><strong>Do they have</strong> a meeting?</div>
                                    <div class="comparison-hu">Van megbeszélésük?</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Next Hint -->
                <div class="explanation-next-hint">
                    <p>Ha megértetted a magyarázatot, lépj tovább a <strong>Szavak</strong> szekcióra! →</p>
                </div>
                ${getCompleteButtonHtml(currentLevel, currentSection, currentSubsection, false)}
            </div>
        `;
        initExplanationTabs();
    } else {
        workspace.innerHTML = `
            <div class="lesson-view">
                <article class="explanation-box explanation-main">
                    <h2>📚 ${moduleData.title}</h2>
                    <div class="explanation-content">
                        <p>${data.content || moduleData.explanation || 'Ehhez a leckéhez hamarosan feltöltjük a magyarázatot.'}</p>
                    </div>
                </article>
                <div class="explanation-next-hint">
                    <p>Ha megértetted a magyarázatot, lépj tovább a <strong>Szavak</strong> szekcióra! →</p>
                </div>
                ${getCompleteButtonHtml(currentLevel, currentSection, currentSubsection, false)}
            </div>
        `;
    }
}

function initExplanationTabs() {
    document.querySelectorAll('.step-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.step-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const stepId = `step-${tab.dataset.step}`;
            const targetPanel = document.getElementById(stepId);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
}

// SZAVAK (Words) — Vocabulary table loaded asynchronously from JSON with caching
async function renderWordsTemplate(workspace, data, moduleData) {
    // Show a loading state
    workspace.innerHTML = `
        <div class="empty-state-section" style="min-height: 200px;">
            <div class="empty-state">
                <div class="empty-state-icon">⏳</div>
                <h2>Szavak betöltése...</h2>
                <div class="empty-state-pulse"></div>
            </div>
        </div>
    `;

    const source = data.dataSource;
    let items = [];

    if (!source) {
        items = data.items || [];
    } else if (vocabCache[source]) {
        items = vocabCache[source];
    } else {
        try {
            // Append version parameter to bust browser caches for static content updates
            const response = await fetch(source + "?v=1.0.6");
            if (!response.ok) throw new Error("HTTP error " + response.status);
            items = await response.json();
            vocabCache[source] = items;
        } catch (error) {
            console.error("Hiba a szavak betöltésekor:", error);
            workspace.innerHTML = renderEmptyState("Szavak", "Nem sikerült betölteni a szókincset a szerverről. Kérjük, próbáld újra később!");
            return;
        }
    }

    if (items.length === 0) {
        workspace.innerHTML = renderEmptyState("Szavak", "Ehhez a leckéhez hamarosan feltöltjük a szókincset.");
        return;
    }

    let rowsHtml = "";
    items.forEach((item, i) => {
        rowsHtml += `
            <tr class="word-row" style="animation-delay: ${i * 0.05}s">
                <td class="word-en">${item.en}</td>
                <td class="word-hu">${item.hu}</td>
                <td class="word-example"><em>${item.example}</em></td>
            </tr>
        `;
    });

    workspace.innerHTML = `
        <div class="lesson-view">
            <section class="practice-box words-section">
                <h2>📖 Szókincs – Tanuld meg ezeket a szavakat!</h2>
                
                <div class="vocab-mode-toggle">
                    <button id="mode-list" class="vocab-mode-btn active">Lista</button>
                    <button id="mode-swipe" class="vocab-mode-btn">Tanulókártyák</button>
                </div>

                <div class="words-table-wrapper" id="words-table-view">
                    <table class="words-table">
                        <thead>
                            <tr>
                                <th>🇬🇧 Angol</th>
                                <th>🇭🇺 Magyar</th>
                                <th>📝 Példamondat</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                </div>

                <div class="swipe-deck-wrapper" id="words-swipe-view">
                    <div class="swipe-deck-container" id="swipe-deck">
                        <!-- Cards injected by JS -->
                    </div>
                    <div class="swipe-controls">
                        <div class="swipe-control-btn btn-swipe-left" id="btn-swipe-left">❌</div>
                        <div class="swipe-control-btn btn-swipe-right" id="btn-swipe-right">✅</div>
                    </div>
                </div>

            </section>
            ${getCompleteButtonHtml(currentLevel, currentSection, currentSubsection, false)}
        </div>
    `;

    // Initialize toggle behavior
    const modeListBtn = document.getElementById('mode-list');
    const modeSwipeBtn = document.getElementById('mode-swipe');
    const tableView = document.getElementById('words-table-view');
    const swipeView = document.getElementById('words-swipe-view');

    modeListBtn.addEventListener('click', () => {
        modeListBtn.classList.add('active');
        modeSwipeBtn.classList.remove('active');
        tableView.style.display = 'block';
        swipeView.classList.remove('active');
    });

    modeSwipeBtn.addEventListener('click', () => {
        modeSwipeBtn.classList.add('active');
        modeListBtn.classList.remove('active');
        tableView.style.display = 'none';
        swipeView.classList.add('active');
        // Initialize swipe deck if not yet initialized
        if (!swipeView.dataset.initialized) {
            initSwipeDeck(items, 'swipe-deck');
            swipeView.dataset.initialized = "true";
        }
    });
}

// ==========================================================================
// SWIPE DECK FLASHCARDS LOGIC
// ==========================================================================
function initSwipeDeck(items, containerId) {
    const container = document.getElementById(containerId);
    let remainingDeck = [...items];
    let retryPile = [];
    
    function renderDeck() {
        container.innerHTML = '';
        
        if (remainingDeck.length === 0) {
            if (retryPile.length > 0) {
                remainingDeck = [...retryPile];
                retryPile = [];
                renderDeck();
                return;
            } else {
                container.innerHTML = `
                    <div class="swipe-end-screen active">
                        <div class="swipe-end-icon">🎉</div>
                        <h2>Minden szót átnéztél!</h2>
                        <p style="color: var(--color-text-muted); margin-top: 10px;">Visszamehetsz a Listanézetbe, vagy lépj a következő leckére.</p>
                    </div>
                `;
                document.getElementById('btn-swipe-left').style.display = 'none';
                document.getElementById('btn-swipe-right').style.display = 'none';
                return;
            }
        }

        // Render top 3 cards max
        const cardsToRender = remainingDeck.slice(0, 3).reverse();
        
        cardsToRender.forEach((item, index) => {
            // The top card is the last one in the reversed array
            const isTop = index === cardsToRender.length - 1;
            const cardEl = document.createElement('div');
            cardEl.className = 'swipe-card';
            if (isTop) cardEl.classList.add('is-top');
            else if (index === cardsToRender.length - 2) cardEl.classList.add('is-behind-1');
            else if (index === cardsToRender.length - 3) cardEl.classList.add('is-behind-2');

            cardEl.innerHTML = `
                <div class="swipe-overlay swipe-overlay-know">TUDOM</div>
                <div class="swipe-overlay swipe-overlay-practice">MÉG GYAKORLOM</div>
                <div class="swipe-card-inner">
                    <div class="swipe-card-front">
                        <div class="swipe-card-word">${item.en}</div>
                        <div class="tap-hint">👆 Kattints a fordításért</div>
                    </div>
                    <div class="swipe-card-back">
                        <div class="swipe-card-word">${item.en}</div>
                        <div class="swipe-card-hu">${item.hu}</div>
                        <div class="swipe-card-example">"${item.example}"</div>
                    </div>
                </div>
            `;
            container.appendChild(cardEl);

            if (isTop) {
                attachDragEvents(cardEl, item);
            }
        });
    }

    function attachDragEvents(card, item) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;

        const knowOverlay = card.querySelector('.swipe-overlay-know');
        const practiceOverlay = card.querySelector('.swipe-overlay-practice');

        function startDrag(e) {
            if (e.target.closest('.swipe-control-btn')) return; // Ignore if clicked on buttons
            isDragging = true;
            card.classList.add('dragging');
            startX = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
            startY = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;
        }

        function drag(e) {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.type.includes('mouse') ? e.pageX : e.touches[0].clientX;
            const y = e.type.includes('mouse') ? e.pageY : e.touches[0].clientY;
            currentX = x - startX;
            currentY = y - startY;

            const rotate = currentX * 0.05;
            card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;

            // Overlays
            if (currentX > 50) {
                knowOverlay.style.opacity = Math.min(currentX / 100, 1);
                practiceOverlay.style.opacity = 0;
            } else if (currentX < -50) {
                practiceOverlay.style.opacity = Math.min(Math.abs(currentX) / 100, 1);
                knowOverlay.style.opacity = 0;
            } else {
                knowOverlay.style.opacity = 0;
                practiceOverlay.style.opacity = 0;
            }
        }

        function endDrag() {
            if (!isDragging) return;
            isDragging = false;
            card.classList.remove('dragging');

            const threshold = 100;
            if (currentX > threshold) {
                swipeOut('right', card);
            } else if (currentX < -threshold) {
                swipeOut('left', card, item);
            } else {
                // Snap back
                card.style.transform = '';
                knowOverlay.style.opacity = 0;
                practiceOverlay.style.opacity = 0;
            }
        }

        // Mouse events
        card.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);

        // Touch events
        card.addEventListener('touchstart', startDrag, {passive: false});
        document.addEventListener('touchmove', drag, {passive: false});
        document.addEventListener('touchend', endDrag);

        // Click to flip (only if not dragged)
        card.addEventListener('click', (e) => {
            if (Math.abs(currentX) < 5 && Math.abs(currentY) < 5) {
                card.classList.toggle('flipped');
            }
        });

        // Store cleanup function
        card._cleanupDrag = () => {
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', drag);
            document.removeEventListener('touchend', endDrag);
        };
    }

    function swipeOut(direction, card, item = null) {
        if (card._cleanupDrag) card._cleanupDrag();
        
        const moveOutWidth = document.body.clientWidth;
        const endX = direction === 'right' ? moveOutWidth : -moveOutWidth;
        card.style.transform = `translate(${endX}px, 0) rotate(${direction === 'right' ? 30 : -30}deg)`;
        card.style.opacity = 0;
        card.style.transition = 'transform 0.4s ease-out, opacity 0.4s ease-out';

        if (direction === 'left' && item) {
            retryPile.push(item);
        }

        setTimeout(() => {
            remainingDeck.shift(); // Remove top item
            renderDeck();
        }, 400);
    }

    // Button controls
    const btnLeft = document.getElementById('btn-swipe-left');
    const btnRight = document.getElementById('btn-swipe-right');

    const handleLeftClick = () => {
        const topCard = container.querySelector('.swipe-card.is-top');
        if (topCard && remainingDeck.length > 0) swipeOut('left', topCard, remainingDeck[0]);
    };

    const handleRightClick = () => {
        const topCard = container.querySelector('.swipe-card.is-top');
        if (topCard && remainingDeck.length > 0) swipeOut('right', topCard);
    };

    // Replace handlers to avoid duplicates if called multiple times
    const newBtnLeft = btnLeft.cloneNode(true);
    const newBtnRight = btnRight.cloneNode(true);
    btnLeft.replaceWith(newBtnLeft);
    btnRight.replaceWith(newBtnRight);

    newBtnLeft.addEventListener('click', handleLeftClick);
    newBtnRight.addEventListener('click', handleRightClick);

    // Initial render
    renderDeck();
}


// ==========================================================================
// MULTIPLE-CHOICE QUIZ ENGINE (UNIFIED PHASE 5)
// ==========================================================================
let quizState = {
    questions: [],
    currentIdx: 0,
    answers: [],
    type: null,
    level: null,
    section: null,
    subsection: null
};

// Map old exercise formats to unified multiple choice questions
function convertItemsToQuizQuestions(type, items) {
    if (type === 'fill_blanks') {
        return items.map(item => {
            const answer = item.answer.split('/')[0];
            let opts = ["am", "is", "are", "am not", "isn't", "aren't"];
            if (!opts.includes(answer)) {
                opts = [answer, "is", "are", "do"];
            }
            opts = opts.sort(() => 0.5 - Math.random()).slice(0, 4);
            if (!opts.includes(answer)) {
                opts[0] = answer;
                opts = opts.sort(() => 0.5 - Math.random());
            }
            return {
                q: item.sentence.replace(/_{3,}/, "___"),
                opts: opts,
                correctIdx: opts.indexOf(answer),
                explain: item.hint ? "Tipp: " + item.hint + ". A helyes megoldás: " + answer : "A helyes megoldás: " + answer
            };
        });
    } else if (type === 'word_order') {
        return items.map(item => {
            const correct = item.correct;
            const words = item.scrambled;
            let opts = [correct];
            for(let i=0; i<3; i++) {
                let scrambled = [...words].sort(() => 0.5 - Math.random()).join(" ");
                if (correct.endsWith(".")) scrambled += ".";
                else if (correct.endsWith("?")) scrambled += "?";
                
                if (scrambled !== correct && !opts.includes(scrambled)) {
                    opts.push(scrambled);
                } else {
                    scrambled = [...words].sort(() => 0.5 - Math.random()).join(" ") + (correct.endsWith("?") ? "?" : ".");
                    opts.push(scrambled);
                }
            }
            opts = opts.sort(() => 0.5 - Math.random());
            return {
                q: 'Rakd sorba: <strong style="color: var(--color-accent-in)">' + item.hu + '</strong>',
                opts: opts,
                correctIdx: opts.indexOf(correct),
                explain: 'A helyes szórend: ' + correct
            };
        });
    } else if (type === 'true_false') {
        return items.map(item => {
            return {
                q: 'Igaz vagy hamis? <br><br><strong>"' + item.question + '"</strong>',
                opts: ["Igaz", "Hamis"],
                correctIdx: item.answer === true ? 0 : 1,
                explain: item.explanation
            };
        });
    }
    return [];
}

async function renderQuizCardTemplate(workspace, data) {
    const source = data.dataSource;
    if (source && !data.items) {
        if (vocabCache[source]) {
            data.items = vocabCache[source].items || [];
        } else {
            workspace.innerHTML = `
                <div class="empty-state-section" style="min-height: 200px;">
                    <div class="empty-state">
                        <div class="empty-state-icon">⏳</div>
                        <h2>Kvíz betöltése...</h2>
                        <div class="empty-state-pulse"></div>
                    </div>
                </div>
            `;
            try {
                const response = await fetch(source + "?v=1.0.6");
                if (!response.ok) throw new Error("HTTP error");
                const fetched = await response.json();
                vocabCache[source] = fetched;
                data.items = fetched.items || [];
            } catch (error) {
                workspace.innerHTML = renderEmptyState("Kvíz", "Nem sikerült betölteni a feladatokat.");
                return;
            }
        }
    }

    if (!data.items || data.items.length === 0) {
        workspace.innerHTML = renderEmptyState("Kvíz", "Hamarosan feltöltjük a feladatokat.");
        return;
    }

    quizState = {
        questions: convertItemsToQuizQuestions(data.type, data.items),
        currentIdx: 0,
        answers: [],
        type: data.type,
        level: currentLevel,
        section: currentSection,
        subsection: currentSubsection
    };

    let headerIcon = "📝";
    let headerText = "Gyakorló Kvíz";
    if (data.type === "fill_blanks") { headerIcon = "✏️"; headerText = "Lyukas mondatok"; }
    else if (data.type === "word_order") { headerIcon = "🧩"; headerText = "Szórendezés"; }
    else if (data.type === "true_false") { headerIcon = "⚖️"; headerText = "Igaz vagy Hamis"; }

    workspace.innerHTML = `
        <div class="lesson-view">
            <section class="practice-box">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2>${headerIcon} ${headerText}</h2>
                    <span id="quiz-question-counter" style="font-size: 0.9rem; color: var(--color-accent-in); font-weight: bold;">Kérdés: 1/${quizState.questions.length}</span>
                </div>
                
                <div class="quiz-card-wrapper" id="quiz-card-container">
                    <!-- Loaded dynamically by JS -->
                </div>
            </section>
        </div>
    `;

    renderQuizCardQuestion();
}

function renderQuizCardQuestion() {
    const container = document.getElementById('quiz-card-container');
    if (!container) return;
    
    const qData = quizState.questions[quizState.currentIdx];
    
    const counter = document.getElementById('quiz-question-counter');
    if (counter) counter.textContent = `Kérdés: ${quizState.currentIdx + 1}/${quizState.questions.length}`;

    if (!qData) {
        // Quiz complete
        let score = quizState.answers.filter(a => a.correct).length;
        let isFlawless = score === quizState.questions.length;
        
        // Mark subsection completed if they got at least 50%
        let passed = score / quizState.questions.length >= 0.5;
        
        // Ensure userProgress is updated
        if (passed) {
            const key = `${quizState.level}_${quizState.section}_${quizState.subsection}`;
            if (!userProgress.completed[key]) {
                userProgress.completed[key] = new Date().toISOString();
                saveUserProgress();
                syncSidebarRoadmapNodes();
            }
            if (isFlawless && typeof updateQuestProgress === 'function') {
                updateQuestProgress('perfect_quiz', 1);
            }
        }
        
        let completionBtnHtml = passed 
            ? getCompleteButtonHtml(quizState.level, quizState.section, quizState.subsection, true)
            : `<button class="btn btn-primary" onclick="restartQuiz()">Újrapróbálkozás</button>`;

        container.innerHTML = `
            <div style="text-align: center; padding: 2rem; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
                <span style="font-size: 4rem;">🎯</span>
                <h3 style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: bold;">Kvíz befejezve!</h3>
                <div style="font-size: 3rem; font-weight: bold; color: ${isFlawless ? 'var(--color-success)' : 'var(--color-text-main)'};">
                    ${score} / ${quizState.questions.length}
                </div>
                <p style="color: var(--color-text-muted); max-width: 400px; font-size: 1.1rem; line-height: 1.6;">
                    ${isFlawless ? 'Zseniális! Minden válaszod tökéletes lett.' : passed ? 'Szép munka! Folytathatod a következő leckével.' : 'Ezt még gyakorolni kell. Nézd át a hibákat és próbáld újra!'}
                </p>
                <div style="margin-top: 2rem;">
                    ${completionBtnHtml}
                </div>
            </div>
        `;
        return;
    }

    const optsHtml = qData.opts.map((opt, i) => `
        <button class="quiz-opt-btn" onclick="submitQuizAnswer(this, ${i})">
            <span class="quiz-opt-badge">${String.fromCharCode(65 + i)}</span>
            <span>${opt}</span>
        </button>
    `).join('');

    container.innerHTML = `
        <div class="quiz-question-box">${qData.q}</div>
        <div class="quiz-answers-grid">${optsHtml}</div>
        <div id="quiz-explanation" style="display: none; margin-top: 1.5rem; padding: 1.5rem; border-radius: 12px; font-size: 1rem; line-height: 1.5; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
            <strong style="color: var(--color-accent-in);">💡 Magyarázat:</strong> <span id="quiz-explanation-text"></span>
            <div style="margin-top: 1.5rem; text-align: right;">
                <button class="btn btn-primary" onclick="nextQuizQuestion()">Tovább →</button>
            </div>
        </div>
    `;
}

window.submitQuizAnswer = function(btnEl, chosenIdx) {
    const buttons = document.querySelectorAll('.quiz-answers-grid button');
    buttons.forEach(btn => btn.disabled = true);

    const qData = quizState.questions[quizState.currentIdx];
    const isCorrect = chosenIdx === qData.correctIdx;

    quizState.answers.push({ questionIdx: quizState.currentIdx, correct: isCorrect });
    
    // Support legacy exercise attempts tracker
    exerciseAttempts[quizState.currentIdx] = isCorrect;
    updateSuccessRateDisplay(true);

    if (isCorrect) {
        btnEl.classList.add('correct');
        AudioSynth.playCorrect();
        addXP(1, btnEl, quizState.type);
        
        setTimeout(() => {
            window.nextQuizQuestion();
        }, 1000);
    } else {
        btnEl.classList.add('incorrect');
        buttons[qData.correctIdx].classList.add('correct');
        
        AudioSynth.playIncorrect();

        const explanationBox = document.getElementById('quiz-explanation');
        const explanationText = document.getElementById('quiz-explanation-text');
        explanationText.innerHTML = qData.explain;
        explanationBox.style.display = 'block';
    }
};

window.nextQuizQuestion = function() {
    quizState.currentIdx++;
    renderQuizCardQuestion();
};

window.restartQuiz = function() {
    quizState.currentIdx = 0;
    quizState.answers = [];
    exerciseAttempts = {};
    updateSuccessRateDisplay(true);
    renderQuizCardQuestion();
};

async function renderSectionExamTemplate(workspace, data) {
    const source = data.dataSource;
    if (source && !data.items) {
        if (vocabCache[source]) {
            const cached = vocabCache[source];
            data.items = cached.items || [];
            if (cached.description) data.description = cached.description;
        } else {
            workspace.innerHTML = `
                <div class="empty-state-section" style="min-height: 200px;">
                    <div class="empty-state">
                        <div class="empty-state-icon">⏳</div>
                        <h2>Vizsga betöltése...</h2>
                        <div class="empty-state-pulse"></div>
                    </div>
                </div>
            `;
            try {
                const response = await fetch(source + "?v=1.0.6");
                if (!response.ok) throw new Error("HTTP error " + response.status);
                let fetched = await response.json();
                
                // --- DYNAMIC EXAM INJECTION ---
                if (fetched.isDynamicExam && fetched.examConfig) {
                    let combinedItems = [];
                    for (const sourceConfig of fetched.examConfig.sources) {
                        try {
                            const srcRes = await fetch(sourceConfig.file + "?v=1.0.6");
                            if (!srcRes.ok) continue;
                            const srcData = await srcRes.json();
                            let itemsPool = srcData.items || srcData; 
                            
                            // Randomize
                            itemsPool = itemsPool.sort(() => 0.5 - Math.random());
                            let selected = itemsPool.slice(0, sourceConfig.count);
                            
                            // MAP TO EXAM FORMAT
                            selected = selected.map(item => {
                                if (sourceConfig.type === "fill_blanks") {
                                    let q = item.sentence;
                                    if (item.hint) q += ` ${item.hint}`;
                                    return {
                                        question: q,
                                        type: "fill",
                                        answer: item.answer
                                    };
                                } else if (sourceConfig.type === "true_false") {
                                    let q = item.question || `"${item.statement}" – Ez a mondat helyes?`;
                                    let ans = item.answer !== undefined ? item.answer : item.isCorrect;
                                    return {
                                        question: q,
                                        type: "tf",
                                        answer: ans,
                                        explanation: item.explanation || item.correction
                                    };
                                } else if (sourceConfig.type === "word_order") {
                                    let scrambledArr = item.scrambled || item.shuffled || [];
                                    // Handle cases where words are mistakenly put into a single comma-separated string
                                    if (scrambledArr.length === 1 && scrambledArr[0].includes(',')) {
                                        scrambledArr = scrambledArr[0].split(',').map(s => s.trim());
                                    }
                                    return {
                                        question: `Rakd sorrendbe a mondatot: <strong style="color:var(--color-accent-in);">${item.hu || scrambledArr.join(" / ")}</strong>`,
                                        type: "order",
                                        correct: item.correct || item.sentence,
                                        scrambled: scrambledArr
                                    };
                                }
                                return item;
                            });
                            
                            combinedItems = combinedItems.concat(selected);
                        } catch(e) {
                            console.error("Error fetching dynamic source:", sourceConfig.file, e);
                        }
                    }
                    // Shuffle the combined items
                    combinedItems = combinedItems.sort(() => 0.5 - Math.random());
                    fetched.items = combinedItems;
                    
                    // Because this is a brand new randomly generated exam, we MUST clear any old saved answers from localStorage!
                    const dynamicAnswersKey = `${currentLevel}_${currentSection}_${currentSubsection}_answers`;
                    if (userProgress.completed[dynamicAnswersKey]) {
                        delete userProgress.completed[dynamicAnswersKey];
                        saveUserProgress();
                    }
                }
                // ------------------------------

                vocabCache[source] = fetched;
                data.items = fetched.items || [];
                if (fetched.description) data.description = fetched.description;
            } catch (error) {
                console.error("Hiba a vizsga betöltésekor:", error);
                workspace.innerHTML = renderEmptyState("Fejezet vizsga", "Nem sikerült betölteni a vizsgát a szerverről. Kérjük, próbáld újra később!");
                return;
            }
        }
    }

    if (!data.items || data.items.length === 0) {
        workspace.innerHTML = renderEmptyState("Fejezet vizsga", "A vizsga hamarosan elérhető lesz. Addig gyakorolj a többi feladattal!");
        return;
    }

    const lockedKey = `${currentLevel}_${currentSection}_${currentSubsection}_locked`;
    const isLocked = userProgress.completed[lockedKey] || false;
    const disabledAttr = isLocked ? "disabled" : "";

    const answersKey = `${currentLevel}_${currentSection}_${currentSubsection}_answers`;
    const savedAnswers = userProgress.completed[answersKey] || {};

    let questionsHtml = "";
    data.items.forEach((item, i) => {
        let questionContentHtml = "";
        const savedAnswer = savedAnswers[i];

        if (item.type === "fill") {
            const escapedAnswer = savedAnswer ? savedAnswer.replace(/"/g, '&quot;') : "";
            questionContentHtml = `
                <p class="exam-question"><span class="question-number">${i + 1}.</span> ${item.question.replace(/_{3,}/, `<input type="text" class="fill-blank-input exam-input" id="exam-input-${i}" placeholder="..." autocomplete="off" value="${escapedAnswer}" oninput="saveExerciseAnswer('${currentLevel}', '${currentSection}', '${currentSubsection}', ${i}, this.value)" ${disabledAttr}>`)}</p>
            `;
        } else if (item.type === "tf") {
            questionContentHtml = `
                <p class="exam-question"><span class="question-number">${i + 1}.</span> ${item.question}</p>
                <div class="quiz-buttons">
                    <button class="btn btn-tf btn-true" onclick="checkExamTF(${i}, true)" ${disabledAttr}>
                        <span class="tf-icon">✓</span> IGAZ
                    </button>
                    <button class="btn btn-tf btn-false" onclick="checkExamTF(${i}, false)" ${disabledAttr}>
                        <span class="tf-icon">✗</span> HAMIS
                    </button>
                </div>
            `;
        } else if (item.type === "order") {
            const scrambledArray = item.scrambled || [];
            const shuffled = [...scrambledArray].sort(() => Math.random() - 0.5);
            const chipsHtml = shuffled.map(word =>
                `<button class="word-chip" onclick="selectWordChip(this, ${i}, true)" ${disabledAttr}>${word}</button>`
            ).join("");
            questionContentHtml = `
                <p class="exam-question"><span class="question-number">${i + 1}.</span> ${item.question}</p>
                <div class="word-chips-source" id="chips-source-${i}">${chipsHtml}</div>
                <div class="word-order-answer" id="answer-zone-${i}" data-correct="${item.correct}">
                    <span class="answer-placeholder">Kattints a szavakra...</span>
                </div>
            `;
        }

        questionsHtml += `
            <div class="exam-item" data-index="${i}" data-type="${item.type}" style="animation-delay: ${i * 0.04}s">
                ${questionContentHtml}
                <div class="quiz-feedback" id="exam-feedback-${i}"></div>
            </div>
        `;
    });

    workspace.innerHTML = `
        <div class="lesson-view">
            <section class="practice-box exam-section">
                <div class="exam-header">
                    <h2>🏆 Fejezet vizsga</h2>
                    <p class="section-instruction">${data.description || 'Ez a fejezet összefoglaló vizsgája. Válaszolj az összes kérdésre, majd nyomj az értékelésre!'}</p>
                </div>
                <div class="exam-list">${questionsHtml}</div>
                <div class="exam-footer">
                    ${isLocked 
                        ? `<button class="btn btn-reset" onclick="retakeExam()">🔄 Újraírás (Retake Exam)</button>`
                        : `<button class="btn btn-submit-exam" onclick="gradeExam()">📋 Vizsga értékelése</button>`
                    }
                    <div class="exam-result" id="exam-result"></div>
                </div>
            </section>
        </div>
    `;

    // Restore Exam UI state
    setTimeout(() => {
        data.items.forEach((item, i) => {
            const savedAns = savedAnswers[i];
            if (savedAns !== undefined) {
                if (item.type === "tf") {
                    const container = document.querySelector(`.exam-item[data-index="${i}"] .quiz-buttons`);
                    if (container) {
                        const btnTrue = container.querySelector(".btn-true");
                        const btnFalse = container.querySelector(".btn-false");
                        if (savedAns === true) {
                            btnTrue.classList.add("selected");
                        } else {
                            btnFalse.classList.add("selected");
                        }
                    }
                } else if (item.type === "order") {
                    try {
                        const savedWords = JSON.parse(savedAns);
                        savedWords.forEach(word => {
                            const sourceZone = document.getElementById(`chips-source-${i}`);
                            if (!sourceZone) return;
                            const chips = sourceZone.querySelectorAll(".word-chip:not(.used)");
                            for (let chip of chips) {
                                if (chip.textContent === word) {
                                    selectWordChip(chip, i, true);
                                    break;
                                }
                            }
                        });
                    } catch(e) {}
                }
            }
        });

        if (isLocked) {
            const scoreKey = `${currentLevel}_${currentSection}_${currentSubsection}`;
            const savedScore = userProgress.scores[scoreKey] || 0;
            const resultDiv = document.getElementById("exam-result");
            resultDiv.innerHTML = `Eredmény: ${savedScore} / ${data.items.length}`;
            resultDiv.style.display = "block";
            resultDiv.className = "exam-result correct";
            
            // Ensure placed word chips are disabled
            document.querySelectorAll(".exam-item .word-chip.placed").forEach(chip => {
                chip.style.pointerEvents = "none";
            });
        }
    }, 50);
}

// Renders an empty/placeholder state for sections without data
function renderEmptyState(title, message) {
    return `
        <div class="lesson-view">
            <section class="practice-box empty-state-section">
                <div class="empty-state">
                    <div class="empty-state-icon">🚧</div>
                    <h2>${title}</h2>
                    <p>${message}</p>
                    <div class="empty-state-pulse"></div>
                </div>
            </section>
        </div>
    `;
}

// =====================================================================
//   ANSWER CHECKING FUNCTIONS
// =====================================================================

// Fill in the blanks checker
function checkFillBlank(index) {
    const data = learningContent[currentLevel][currentSection].subsections.fillBlanks;
    const item = data.items[index];
    const correctAnswer = item.answer;
    const input = document.getElementById(`fill-input-${index}`);
    const feedback = document.getElementById(`fill-feedback-${index}`);
    const userAnswer = input.value.trim().toLowerCase();

    // Support multiple options split by '/' (e.g. "isn't/is not")
    const possibleAnswers = correctAnswer.toLowerCase().split("/").map(ans => ans.trim());

    let isCorrect = false;
    const cleanUserAnswer = userAnswer.replace(/'/g, "");
    const cleanPossibleAnswers = possibleAnswers.map(ans => ans.replace(/'/g, ""));
    if (cleanPossibleAnswers.includes(cleanUserAnswer)) {
        feedback.innerHTML = `✓ Helyes válasz! Ügyes vagy!`;
        feedback.className = "quiz-feedback correct";
        input.classList.add("input-correct");
        input.classList.remove("input-incorrect");
        isCorrect = true;
    } else {
        const displayAnswer = correctAnswer.replace(/\//g, " / ");
        feedback.innerHTML = `✗ Nem jó. A helyes válasz: <strong>${displayAnswer}</strong>`;
        feedback.className = "quiz-feedback incorrect";
        input.classList.add("input-incorrect");
        input.classList.remove("input-correct");
    }
    
    exerciseAttempts[index] = isCorrect;
    updateSuccessRateDisplay(true);

    const completeBtn = document.querySelector(".btn-complete-section");
    const totalQuestions = data.items.length;
    if (completeBtn && Object.keys(exerciseAttempts).length === totalQuestions) {
        completeBtn.disabled = false;
    }
}

// True/False checker
function checkTrueFalse(index, studentAnswer) {
    const data = learningContent[currentLevel][currentSection].subsections.trueFalse;
    const item = data.items[index];
    const feedback = document.getElementById(`tf-feedback-${index}`);
    
    const container = document.querySelector(`.quiz-item[data-index="${index}"] .quiz-buttons`);
    if (container) {
        const btnTrue = container.querySelector(".btn-true");
        const btnFalse = container.querySelector(".btn-false");
        if (studentAnswer === true) {
            btnTrue.classList.add("selected");
            btnFalse.classList.remove("selected");
        } else {
            btnFalse.classList.add("selected");
            btnTrue.classList.remove("selected");
        }
    }

    saveExerciseAnswer(currentLevel, currentSection, currentSubsection, index, studentAnswer);

    const isCorrect = (studentAnswer === item.answer);
    if (isCorrect) {
        feedback.innerHTML = `✓ ${item.explanation}`;
        feedback.className = "quiz-feedback correct";
    } else {
        feedback.innerHTML = `✗ ${item.explanation}`;
        feedback.className = "quiz-feedback incorrect";
    }
    
    exerciseAttempts[index] = isCorrect;
    updateSuccessRateDisplay(true);

    const completeBtn = document.querySelector(".btn-complete-section");
    const totalQuestions = data.items.length;
    if (completeBtn && Object.keys(exerciseAttempts).length === totalQuestions) {
        completeBtn.disabled = false;
    }
}

// Word Order — select chips to build sentence
function selectWordChip(chipEl, questionIndex, isExam = false) {
    const answerZone = document.getElementById(`answer-zone-${questionIndex}`);
    
    // Remove placeholder text if present
    const placeholder = answerZone.querySelector(".answer-placeholder");
    if (placeholder) placeholder.remove();

    // Move chip to answer zone
    const clone = chipEl.cloneNode(true);
    clone.classList.add("placed");
    clone.onclick = function() {
        // Click to remove from answer zone and restore to source
        clone.remove();
        chipEl.style.display = "";
        chipEl.disabled = false;
        chipEl.classList.remove("used");

        // If answer zone is empty, add placeholder back
        if (answerZone.children.length === 0) {
            answerZone.innerHTML = `<span class="answer-placeholder">Kattints a szavakra a helyes sorrendben...</span>`;
        }
        saveWordOrderState(questionIndex);
    };
    answerZone.appendChild(clone);

    // Visually disable original chip
    chipEl.classList.add("used");
    chipEl.disabled = true;
    saveWordOrderState(questionIndex);
}

// Helper to save word order state dynamically
function saveWordOrderState(index) {
    const answerZone = document.getElementById(`answer-zone-${index}`);
    if (!answerZone) return;
    const placedChips = answerZone.querySelectorAll(".word-chip.placed");
    const words = Array.from(placedChips).map(c => c.textContent);
    saveExerciseAnswer(currentLevel, currentSection, currentSubsection, index, JSON.stringify(words));
}

// Check word order correctness
function checkWordOrder(index) {
    const data = learningContent[currentLevel][currentSection].subsections.wordOrder;
    const answerZone = document.getElementById(`answer-zone-${index}`);
    const feedback = document.getElementById(`order-feedback-${index}`);
    const correctAnswer = answerZone.getAttribute("data-correct");

    const placedChips = answerZone.querySelectorAll(".word-chip.placed");
    const userAnswer = Array.from(placedChips).map(c => c.textContent).join(" ");

    // Normalize both user input and correct answer (remove trailing punctuation & collapse whitespace)
    const cleanUser = userAnswer.toLowerCase().replace(/[.?!,]/g, "").replace(/\s+/g, " ").trim();
    const cleanCorrect = correctAnswer.toLowerCase().replace(/[.?!,]/g, "").replace(/\s+/g, " ").trim();

    let isCorrect = false;
    if (cleanUser === cleanCorrect) {
        feedback.innerHTML = `✓ Helyes! A mondat: "${correctAnswer}"`;
        feedback.className = "quiz-feedback correct";
        isCorrect = true;
    } else {
        feedback.innerHTML = `✗ Nem jó. A helyes sorrend: "${correctAnswer}"`;
        feedback.className = "quiz-feedback incorrect";
    }
    
    exerciseAttempts[index] = isCorrect;
    updateSuccessRateDisplay(true);

    const completeBtn = document.querySelector(".btn-complete-section");
    const totalQuestions = data.items.length;
    if (completeBtn && Object.keys(exerciseAttempts).length === totalQuestions) {
        completeBtn.disabled = false;
    }
}

// Reset word order question
function resetWordOrder(index) {
    const source = document.getElementById(`chips-source-${index}`);
    const answerZone = document.getElementById(`answer-zone-${index}`);
    const feedback = document.getElementById(`order-feedback-${index}`);

    // Re-enable all source chips
    source.querySelectorAll(".word-chip").forEach(chip => {
        chip.classList.remove("used");
        chip.disabled = false;
        chip.style.display = "";
    });

    // Clear answer zone
    answerZone.innerHTML = `<span class="answer-placeholder">Kattints a szavakra a helyes sorrendben...</span>`;
    feedback.className = "quiz-feedback";
    feedback.innerHTML = "";
}

// Exam T/F selection handler (does not grade immediately)
function checkExamTF(index, studentAnswer) {
    const container = document.querySelector(`.exam-item[data-index="${index}"] .quiz-buttons`);
    if (container) {
        container.setAttribute("data-user-answer", studentAnswer);
        
        // Highlight active button selection
        const btnTrue = container.querySelector(".btn-true");
        const btnFalse = container.querySelector(".btn-false");
        
        if (studentAnswer === true) {
            btnTrue.classList.add("selected");
            btnFalse.classList.remove("selected");
        } else {
            btnFalse.classList.add("selected");
            btnTrue.classList.remove("selected");
        }
    }
}

// Grade the full exam
function gradeExam() {
    const data = learningContent[currentLevel][currentSection].subsections.sectionExam;
    let correct = 0;
    let total = data.items.length;

    // Stop stopwatch timer
    stopStopwatch();

    data.items.forEach((item, i) => {
        const feedback = document.getElementById(`exam-feedback-${i}`);

        if (item.type === "fill") {
            const input = document.getElementById(`exam-input-${i}`);
            const userAnswer = input ? input.value.trim().toLowerCase() : "";
            const possibleAnswers = item.answer.toLowerCase().split("/").map(ans => ans.trim());

            const cleanUserAnswer = userAnswer.replace(/'/g, "");
            const cleanPossibleAnswers = possibleAnswers.map(ans => ans.replace(/'/g, ""));
            if (cleanPossibleAnswers.includes(cleanUserAnswer)) {
                correct++;
                feedback.innerHTML = `✓ Helyes!`;
                feedback.className = "quiz-feedback correct";
                if (input) { input.classList.add("input-correct"); input.classList.remove("input-incorrect"); }
            } else {
                const displayAnswer = item.answer.replace(/\//g, " / ");
                feedback.innerHTML = `✗ A helyes válasz: <strong>${displayAnswer}</strong>`;
                feedback.className = "quiz-feedback incorrect";
                if (input) { input.classList.add("input-incorrect"); input.classList.remove("input-correct"); }
            }
        } else if (item.type === "tf") {
            const container = document.querySelector(`.exam-item[data-index="${i}"] .quiz-buttons`);
            const userAnswerStr = container ? container.getAttribute("data-user-answer") : "";
            const userAnswer = userAnswerStr === "true" ? true : userAnswerStr === "false" ? false : null;

            if (userAnswer === item.answer) {
                correct++;
                feedback.innerHTML = `✓ Helyes! ${item.explanation || ""}`;
                feedback.className = "quiz-feedback correct";
            } else {
                const displayCorrect = item.answer ? "IGAZ" : "HAMIS";
                feedback.innerHTML = `✗ Helytelen! A helyes válasz: <strong>${displayCorrect}</strong>. ${item.explanation || ""}`;
                feedback.className = "quiz-feedback incorrect";
            }
        } else if (item.type === "order") {
            const answerZone = document.getElementById(`answer-zone-${i}`);
            const correctAnswer = answerZone?.getAttribute("data-correct") || "";
            const placedChips = answerZone?.querySelectorAll(".word-chip.placed") || [];
            const userAnswer = Array.from(placedChips).map(c => c.textContent).join(" ");

            // Normalize both user input and correct answer (remove trailing punctuation & collapse whitespace)
            const cleanUser = userAnswer.toLowerCase().replace(/[.?!,]/g, "").replace(/\s+/g, " ").trim();
            const cleanCorrect = correctAnswer.toLowerCase().replace(/[.?!,]/g, "").replace(/\s+/g, " ").trim();

            if (cleanUser === cleanCorrect) {
                correct++;
                feedback.innerHTML = `✓ Helyes!`;
                feedback.className = "quiz-feedback correct";
            } else {
                feedback.innerHTML = `✗ A helyes sorrend: "${correctAnswer}"`;
                feedback.className = "quiz-feedback incorrect";
            }
        }
    });

    const percentage = Math.round((correct / total) * 100);
    const resultEl = document.getElementById("exam-result");
    
    let grade = "";
    if (percentage >= 90) grade = "Kiváló! 🌟";
    else if (percentage >= 70) grade = "Jó munka! 👍";
    else if (percentage >= 50) grade = "Átment, de gyakorolj tovább! 📚";
    else grade = "Sajnos nem sikerült. Próbáld újra! 💪";

    // Show result locally below the exam questions
    resultEl.innerHTML = `
        <div class="exam-result-card ${percentage >= 50 ? 'passed' : 'failed'}">
            <span class="exam-score">${correct} / ${total}</span>
            <span class="exam-percentage">(${percentage}%)</span>
            <p class="exam-grade">${grade}</p>
        </div>
    `;

    // Swap the submit button for the retake button
    const submitBtn = document.querySelector(".btn-submit-exam");
    if (submitBtn) {
        submitBtn.outerHTML = `<button class="btn btn-reset" onclick="retakeExam()">🔄 Újraírás (Retake Exam)</button>`;
    }

    // Update the success rate metric in the header
    const successRateDisplay = document.getElementById("success-rate-display");
    if (successRateDisplay) {
        successRateDisplay.textContent = `${percentage}%`;
    }

    // Award points dynamically on exam grading
    const examKey = `${currentLevel}_${currentSection}_sectionExam`;
    if (percentage >= 50) {
        userProgress.completed[examKey] = true;
        
        const previousBest = userProgress.scores[examKey] || 0;
        if (correct > previousBest) {
            const diff = correct - previousBest;
            userProgress.points = (userProgress.points || 0) + diff;
            userProgress.scores[examKey] = correct;
            
            // Trigger floating points animation on the results card
            const resultCard = resultEl.querySelector(".exam-result-card");
            if (resultCard) {
                const pop = document.createElement("div");
                pop.className = "floating-points-pop";
                pop.style.top = "20px";
                pop.textContent = `+${diff} Pont! 🎉`;
                resultCard.appendChild(pop);
                setTimeout(() => pop.remove(), 1200);
            }
        }
        
        saveUserProgress(); // This triggers updateProgressUI which updates the CTA Hero
        
        // Scroll to the top of the page smoothly to show the Hero CTA congratulation message
        // Scroll to the top of the page smoothly to show the Hero CTA congratulation message
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        saveUserProgress();
    }

    // Lock the exam after grading
    const lockedKey = `${currentLevel}_${currentSection}_sectionExam_locked`;
    userProgress.completed[lockedKey] = true;
    saveUserProgress();

    // Visually lock the inputs without re-rendering the template
    // This preserves our beautiful result card instead of replacing it with the cached "Highest Score" from localStorage
    document.querySelectorAll(".exam-list input, .exam-list button:not(.btn-reset)").forEach(el => {
        el.setAttribute("disabled", "true");
        el.style.pointerEvents = "none";
        el.classList.add("disabled");
    });
}

// Retake Exam Handler
function retakeExam() {
    const lockedKey = `${currentLevel}_${currentSection}_sectionExam_locked`;
    const answersKey = `${currentLevel}_${currentSection}_sectionExam_answers`;
    
    userProgress.completed[lockedKey] = false;
    userProgress.completed[answersKey] = {};
    saveUserProgress();
    
    const data = learningContent[currentLevel][currentSection].subsections.sectionExam;
    
    // If it's a dynamic exam, clear the cached items to force a re-fetch and fresh randomization
    if (data.dataSource && vocabCache[data.dataSource] && vocabCache[data.dataSource].isDynamicExam) {
        data.items = null;
        delete vocabCache[data.dataSource];
    }
    
    // Re-render the exam UI to unlock inputs
    const workspace = document.getElementById("workspace");
    renderSectionExamTemplate(workspace, data);
    
    // Smooth scroll back to the top of the exam
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =====================================================================
//   LEGACY COMPATIBILITY — Old checkAnswer for backward compat
// =====================================================================
function checkAnswer(level, section, quizIndex, studentAnswer) {
    checkTrueFalse(quizIndex, studentAnswer);
}

// 5. MODAL SYSTEM STATE CONTROLLERS
function initModalListeners() {
    const wipModal = document.getElementById("wip-modal");
    const closeWipBtn = document.getElementById("close-wip-btn");

    if (closeWipBtn && wipModal) {
        closeWipBtn.addEventListener("click", closeWipModal);
    }

    const lockedModal = document.getElementById("locked-modal");
    const closeLockedBtn = document.getElementById("close-locked-btn");

    if (closeLockedBtn && lockedModal) {
        closeLockedBtn.addEventListener("click", closeLockedModal);
    }

    const paywallModal = document.getElementById("paywall-modal");
    const closePaywallBtn = document.getElementById("close-paywall-btn");
    const paywallRegisterBtn = document.getElementById("btn-paywall-register");

    if (closePaywallBtn && paywallModal) {
        closePaywallBtn.addEventListener("click", closePaywallModal);
    }

    if (paywallRegisterBtn) {
        paywallRegisterBtn.addEventListener("click", () => {
            // Reusing the same flow as the guest profile registration button
            localStorage.setItem("forceRegisterModal", "true");
            window.location.href = "index.html";
        });
    }
}

function openWipModal() {
    const wipModal = document.getElementById("wip-modal");
    if (wipModal) {
        wipModal.classList.add("is-active");
        wipModal.setAttribute("aria-hidden", "false");
    }
}

function closeWipModal() {
    const wipModal = document.getElementById("wip-modal");
    if (wipModal) {
        wipModal.classList.remove("is-active");
        wipModal.setAttribute("aria-hidden", "true");
    }
}

function openLockedModal() {
    const lockedModal = document.getElementById("locked-modal");
    if (lockedModal) {
        lockedModal.classList.add("is-active");
        lockedModal.setAttribute("aria-hidden", "false");
    }
}

function closeLockedModal() {
    const lockedModal = document.getElementById("locked-modal");
    if (lockedModal) {
        lockedModal.classList.remove("is-active");
        lockedModal.setAttribute("aria-hidden", "true");
    }
}

function openPaywallModal() {
    const paywallModal = document.getElementById("paywall-modal");
    if (paywallModal) {
        paywallModal.classList.add("is-active");
        paywallModal.setAttribute("aria-hidden", "false");
    }
}

function closePaywallModal() {
    const paywallModal = document.getElementById("paywall-modal");
    if (paywallModal) {
        paywallModal.classList.remove("is-active");
        paywallModal.setAttribute("aria-hidden", "true");
    }
}

// =====================================================================
//   USER PROFILE & PASSWORD MANAGEMENT
// =====================================================================

function initProfileListeners() {
    const profileBtn = document.getElementById("user-profile-btn");
    const closeProfileBtn = document.getElementById("close-profile-btn");
    const profileModal = document.getElementById("profile-modal");
    const passwordForm = document.getElementById("password-change-form");

    if (profileBtn) {
        profileBtn.addEventListener("click", () => {
            openProfileModal();
        });
    }

    if (closeProfileBtn) {
        closeProfileBtn.addEventListener("click", () => {
            closeProfileModal();
        });
    }

    // Handle Password Change Form Submit
    if (passwordForm) {
        passwordForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await handlePasswordChange();
        });
    }

    // Handle Guest Data Clear
    const btnClearGuest = document.getElementById("btn-clear-guest-data");
    if (btnClearGuest) {
        btnClearGuest.addEventListener("click", () => {
            if (confirm("Biztosan törölni szeretnéd az eddigi haladásodat? Ez a művelet nem vonható vissza.")) {
                ProgressManager.clearGuestData();
            }
        });
    }

    // Handle Guest Register Redirect
    const btnGuestRegister = document.getElementById("btn-guest-register");
    if (btnGuestRegister) {
        btnGuestRegister.addEventListener("click", () => {
            // Set flag so landing.js opens register modal
            localStorage.setItem("forceRegisterModal", "true");
            window.location.href = "index.html";
        });
    }
}

async function openProfileModal() {
    const profileModal = document.getElementById("profile-modal");
    if (!profileModal) return;

    // Reset password form fields and messages
    const passwordForm = document.getElementById("password-change-form");
    if (passwordForm) passwordForm.reset();
    document.getElementById("password-error-msg").textContent = "";
    document.getElementById("password-success-msg").textContent = "";

    // 1. Render Account Info
    const usernameDisplay = document.getElementById("profile-username-display");
    const emailDisplay = document.getElementById("profile-email-display");
    const subDisplay = document.getElementById("profile-subscription-display");
    
    if (usernameDisplay) usernameDisplay.textContent = userProgress.username;
    
    if (subDisplay) {
        const tier = userProgress.subscription_tier || "free";
        const role = userProgress.role || "user";
        
        if (role === "admin") {
            subDisplay.textContent = "Örökös Prémium (Admin)";
            subDisplay.style.background = "oklch(0.65 0.2 25 / 0.15)";
            subDisplay.style.color = "var(--color-accent-in)";
            subDisplay.style.border = "1px solid var(--color-accent-in)";
        } else if (tier === "lifetime") {
            subDisplay.textContent = "Örökös Prémium";
            subDisplay.style.background = "oklch(0.65 0.2 25 / 0.15)";
            subDisplay.style.color = "var(--color-accent-in)";
            subDisplay.style.border = "1px solid var(--color-accent-in)";
        } else {
            subDisplay.textContent = "Ingyenes Béta";
            subDisplay.style.background = "oklch(0.6 0.05 250 / 0.15)";
            subDisplay.style.color = "var(--color-text-muted)";
            subDisplay.style.border = "1px solid oklch(0.6 0.05 250 / 0.3)";
        }
    }
    
    let isGuest = ProgressManager.isGuest;
    if (!isGuest) {
        if (emailDisplay) {
            emailDisplay.innerHTML = `${userProgress.email || ""} <span style="color: var(--color-success); font-size: 0.85rem; font-weight: 600; margin-left: 0.5rem;">(✓ Hitelesítve)</span>`;
        }
    } else {
        if (emailDisplay) emailDisplay.textContent = "Nincs (Vendég fiók)";
        if (subDisplay) {
            subDisplay.textContent = "Vendég Limitált";
            subDisplay.style.background = "transparent";
            subDisplay.style.color = "var(--color-text-muted)";
            subDisplay.style.border = "1px solid var(--color-text-muted)";
        }
    }

    // 1.5. Manage Guest Password Form State
    const currentPassInput = document.getElementById("current-password");
    const newPassInput = document.getElementById("new-password");
    const repeatPassInput = document.getElementById("repeat-password");
    const btnChangePass = document.getElementById("btn-change-password");
    const errorMsg = document.getElementById("password-error-msg");
    const guestDataContainer = document.getElementById("guest-data-clear-container");
    const guestRegPrompt = document.getElementById("guest-registration-prompt");

    if (isGuest) {
        if (currentPassInput) { currentPassInput.disabled = true; currentPassInput.style.cursor = "not-allowed"; }
        if (newPassInput) { newPassInput.disabled = true; newPassInput.style.cursor = "not-allowed"; }
        if (repeatPassInput) { repeatPassInput.disabled = true; repeatPassInput.style.cursor = "not-allowed"; }
        if (btnChangePass) { btnChangePass.disabled = true; btnChangePass.style.cursor = "not-allowed"; btnChangePass.style.opacity = "0.5"; }
        if (errorMsg) {
            errorMsg.textContent = "Vendégként ez a funkció nem elérhető.";
            errorMsg.style.color = "var(--color-text-muted)";
        }
        if (guestDataContainer) guestDataContainer.style.display = "block";
        if (guestRegPrompt) guestRegPrompt.style.display = "block";
    } else {
        if (currentPassInput) { currentPassInput.disabled = false; currentPassInput.style.cursor = "text"; }
        if (newPassInput) { newPassInput.disabled = false; newPassInput.style.cursor = "text"; }
        if (repeatPassInput) { repeatPassInput.disabled = false; repeatPassInput.style.cursor = "text"; }
        if (btnChangePass) { btnChangePass.disabled = false; btnChangePass.style.cursor = "pointer"; btnChangePass.style.opacity = "1"; }
        if (errorMsg) {
            errorMsg.style.color = "var(--color-error)"; // Restore original color
        }
        if (guestDataContainer) guestDataContainer.style.display = "none";
        if (guestRegPrompt) guestRegPrompt.style.display = "none";
    }

    // 2. Render Statistics
    renderProfileStatistics();

    // 3. Show Modal
    profileModal.classList.add("is-active");
    profileModal.setAttribute("aria-hidden", "false");
}

function closeProfileModal() {
    const profileModal = document.getElementById("profile-modal");
    if (profileModal) {
        profileModal.classList.remove("is-active");
        profileModal.setAttribute("aria-hidden", "true");
    }
}

function renderProfileStatistics() {
    // A. Started Courses (Look through completed keys)
    const startedLevels = new Set();
    if (userProgress.completed) {
        for (const key in userProgress.completed) {
            if (userProgress.completed[key]) {
                const levelStr = key.split('_')[0]; // e.g. A1, A2
                startedLevels.add(levelStr);
            }
        }
    }

    const startedCoursesContainer = document.getElementById("profile-started-courses");
    if (startedCoursesContainer) {
        if (startedLevels.size === 0) {
            startedCoursesContainer.innerHTML = `<p class="empty-state-text">Még nem kezdtél el tanfolyamot.</p>`;
        } else {
            let html = "";
            const levelNames = {
                "A1": "A1 Kezdő",
                "A2": "A2 Alapfok",
                "B1": "B1 Középfok",
                "B2": "B2 Haladó"
            };
            
            startedLevels.forEach(level => {
                // Determine percentage roughly based on DOM progress bar or simple check
                // For a more precise check, we could duplicate the updateProgressUI logic per level.
                // Since this is a simple dashboard, we will just say "Folyamatban" (In Progress).
                html += `
                    <div class="course-progress-item">
                        <span>${levelNames[level] || level}</span>
                        <span style="color: var(--color-accent-in);">Folyamatban</span>
                    </div>
                `;
            });
            startedCoursesContainer.innerHTML = html;
        }
    }

    // B. Average Time
    const avgTimeDisplay = document.getElementById("profile-avg-time");
    if (avgTimeDisplay) {
        const totalTime = (userProgress.scores && userProgress.scores.totalTimeSpent) ? userProgress.scores.totalTimeSpent : 0;
        const totalExercises = (userProgress.scores && userProgress.scores.exercisesCompleted) ? userProgress.scores.exercisesCompleted : 0;
        
        if (totalExercises > 0 && totalTime > 0) {
            const avgSeconds = Math.round(totalTime / totalExercises);
            const mins = Math.floor(avgSeconds / 60);
            const secs = avgSeconds % 60;
            const formatted = `${mins > 0 ? mins + 'p ' : ''}${secs}mp`;
            avgTimeDisplay.textContent = formatted;
        } else {
            avgTimeDisplay.textContent = "-";
        }
    }

    // C. Total Points
    const totalPointsDisplay = document.getElementById("profile-total-points");
    if (totalPointsDisplay) {
        totalPointsDisplay.textContent = userProgress.points || 0;
    }
    
    // Update active theme
    if (userProgress.active_theme && userProgress.active_theme !== 'default') {
        document.documentElement.setAttribute('data-theme', userProgress.active_theme);
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
    
    // Update shop buttons
    document.querySelectorAll('.shop-item button').forEach(btn => {
        const onclick = btn.getAttribute('onclick');
        if (!onclick) return;
        
        if (onclick.includes("unlockShopItem('cyberpunk'")) {
            if (userProgress.active_theme === 'cyberpunk') {
                btn.textContent = 'Aktiválva';
                btn.disabled = true;
            } else if (userProgress.unlocked_items?.includes('cyberpunk')) {
                btn.textContent = 'Aktivál';
                btn.disabled = false;
            } else {
                btn.textContent = 'Feloldás';
                btn.disabled = false;
            }
        }
        else if (onclick.includes("unlockShopItem('nature'")) {
            if (userProgress.active_theme === 'nature') {
                btn.textContent = 'Aktiválva';
                btn.disabled = true;
            } else if (userProgress.unlocked_items?.includes('nature')) {
                btn.textContent = 'Aktivál';
                btn.disabled = false;
            } else {
                btn.textContent = 'Feloldás';
                btn.disabled = false;
            }
        }
    });
}

async function handlePasswordChange() {
    const errorMsg = document.getElementById("password-error-msg");
    const successMsg = document.getElementById("password-success-msg");
    errorMsg.textContent = "";
    successMsg.textContent = "";

    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    const repeatPassword = document.getElementById("repeat-password").value;

    if (newPassword !== repeatPassword) {
        errorMsg.textContent = "A két új jelszó nem egyezik meg!";
        return;
    }

    // Regex Check: 8-16 chars, Lowercase, Uppercase, Number, Symbol
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,16}$/;
    if (!passwordRegex.test(newPassword)) {
        errorMsg.textContent = "A jelszónak 8-16 karakter hosszúnak kell lennie, és tartalmaznia kell kisbetűt, nagybetűt, számot és speciális karaktert.";
        return;
    }

    if (ProgressManager.isGuest) {
        errorMsg.textContent = "Hiba 403 (Forbidden): Vendég munkamenet nem módosíthat jelszót.";
        console.error("403 Forbidden: Password update rejected for guest session.");
        return;
    }

    // Now update password on PHP backend
    const btn = document.getElementById("btn-change-password");
    btn.disabled = true;
    btn.textContent = "Kérjük várj...";

    try {
        const res = await fetch(`${API_URL}?action=update_password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword
            })
        });

        btn.disabled = false;
        btn.textContent = "Mentés";

        if (res.ok) {
            const data = await res.json();
            if (data.error) {
                errorMsg.textContent = data.error;
            } else {
                successMsg.textContent = "Jelszó sikeresen frissítve!";
                document.getElementById("password-change-form").reset();
            }
        } else {
            errorMsg.textContent = "Hiba történt a jelszó módosításakor. Próbáld újra.";
        }
    } catch (err) {
        btn.disabled = false;
        btn.textContent = "Mentés";
        errorMsg.textContent = "Hálózati hiba történt a jelszó módosításakor.";
        console.error("Password update error:", err);
    }
}

// ==========================================================================
// IMAGE LIGHTBOX LOGIC
// ==========================================================================
window.openLightbox = function(src) {
    const lightbox = document.getElementById("image-lightbox");
    const lightboxImg = document.getElementById("lightbox-img");
    if (lightbox && lightboxImg) {
        lightboxImg.src = src;
        lightbox.classList.add("is-active");
        lightbox.setAttribute("aria-hidden", "false");
    }
};

window.closeLightbox = function(event) {
    if (event) event.stopPropagation();
    const lightbox = document.getElementById("image-lightbox");
    if (lightbox) {
        lightbox.classList.remove("is-active");
        lightbox.setAttribute("aria-hidden", "true");
        // Clear src after animation so it doesn't flash the old image next time
        setTimeout(() => {
            const img = document.getElementById("lightbox-img");
            if (img) img.src = "";
        }, 300);
    }
};

// Auto-open profile modal if requested via URL search param
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("action") === "profile") {
        setTimeout(() => {
            if (typeof openProfileModal === "function") {
                openProfileModal();
            }
        }, 300);
        
        // Clean up URL
        window.history.replaceState(null, null, window.location.pathname);
    }
});


function checkStreakOnLoad() {
    if (ProgressManager.isGuest) return;
    
    if (!userProgress.streak_last_date) {
        userProgress.streak_last_date = new Date().toISOString().split("T")[0];
        userProgress.streak_count = 0;
        userProgress.streak_shields = userProgress.streak_shields || 0;
        saveUserProgress();
        return;
    }
    
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    const lastDate = new Date(userProgress.streak_last_date);
    
    // Normalize to midnight UTC for pure day diff
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const utcLast = Date.UTC(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());
    
    const diffDays = Math.floor((utcToday - utcLast) / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
        let shieldsUsed = 0;
        let daysToCover = diffDays - 1; // 1 day gap means yesterday was missed
        
        while (daysToCover > 0 && userProgress.streak_shields > 0) {
            userProgress.streak_shields--;
            shieldsUsed++;
            daysToCover--;
        }
        
        if (daysToCover > 0) {
            // Lost streak
            userProgress.streak_count = 0;
            userProgress.streak_last_date = todayStr; // reset to today so we don't spam them, but they still need 15 XP to get 1 streak? No, leave as yesterday so they can earn it today.
            
            // Actually, if they lost it, we set last_date to yesterday so they can earn 1 streak today.
            const yesterday = new Date(utcToday - 86400000);
            userProgress.streak_last_date = yesterday.toISOString().split("T")[0];
            
            showStreakModal("Sajnos megszakadt a napi szériád! 😢", "Nem baj, kezdd újra ma!");
        } else {
            // Saved by shields!
            // Update last_date to yesterday so they can still earn today's streak
            const yesterday = new Date(utcToday - 86400000);
            userProgress.streak_last_date = yesterday.toISOString().split("T")[0];
            
            showStreakModal("A Pajzsod megmentett!", `Kihagytál ${shieldsUsed} napot, de a pajzsaid megvédték a szériádat! 🛡️`);
        }
        
        saveUserProgress();
        updateProgressUI();
    }
}

function showStreakModal(title, text) {
    // Create an animated modal overlay
    const overlay = document.createElement("div");
    overlay.className = "auth-modal-overlay";
    overlay.style.display = "flex";
        if(typeof syncShopButtonsUI === "function") syncShopButtonsUI();
    overlay.style.zIndex = "10000";
    
    overlay.innerHTML = `
        <div class="auth-modal-card proto-card" style="text-align: center; max-width: 400px; animation: popIn 0.5s ease-out;">
            <h2 style="color: var(--color-accent-in); margin-bottom: 1rem;">${title}</h2>
            <p style="margin-bottom: 1.5rem;">${text}</p>
            <button class="btn btn-primary" onclick="this.closest('.auth-modal-overlay').remove()">Rendben</button>
        </div>
    `;
    
    document.body.appendChild(overlay);
}


// ==========================================================================
// PHASE 8: SHOP & ACCESSIBILITY LOGIC
// ==========================================================================

window.toggleSound = function(enabled) {
    if (!userProgress.scores) userProgress.scores = {};
    userProgress.scores.sound_enabled = enabled;
    saveUserProgress();
    if(enabled && window.AudioSynth) AudioSynth.playSuccess();
};

window.toggleReducedMotion = function(enabled) {
    if (!userProgress.scores) userProgress.scores = {};
    userProgress.scores.reduced_motion = enabled;
    saveUserProgress();
    
    if (enabled) {
        document.body.classList.add('reduced-motion');
    } else {
        document.body.classList.remove('reduced-motion');
    }
};

window.unlockShopItem = function(itemId, cost, btnEl) {
    if (!userProgress.unlocked_items) userProgress.unlocked_items = [];
    
    if (userProgress.unlocked_items.includes(itemId)) {
        activateTheme(itemId);
        return;
    }
    
    if ((userProgress.points || 0) < cost) {
        alert("Nincs elég XP-d!");
        return;
    }
    
    // Deduct cost
    userProgress.points -= cost;
    userProgress.unlocked_items.push(itemId);
    saveUserProgress();
    
    if(window.AudioSynth) if(typeof AudioSynth.playLevelUp === 'function') AudioSynth.playLevelUp(); else AudioSynth.playComplete();;
    
    if (typeof syncShopButtonsUI === 'function') syncShopButtonsUI();
};

window.activateTheme = function(themeName) {
    userProgress.active_theme = themeName;
    saveUserProgress();
    updateProgressUI();
};

window.buyStreakShield = function(cost, btnEl) {
    if ((userProgress.points || 0) < cost) {
        alert("Nincs elég XP-d!");
        return;
    }
    
    // Limit to 3 shields
    userProgress.streak_shields = userProgress.streak_shields || 0;
    if (userProgress.streak_shields >= 3) {
        alert("Maximum 3 pajzsod lehet egyszerre!");
        return;
    }
    
    // Deduct cost
    userProgress.points -= cost;
    userProgress.streak_shields++;
    saveUserProgress();
    updateProgressUI();
    
    if(window.AudioSynth) AudioSynth.playSuccess();
};

window.openShopModal = function() {
    let overlay = document.getElementById("shop-modal-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "auth-modal-overlay";
        overlay.id = "shop-modal-overlay";
        overlay.style.display = "flex";
        if(typeof syncShopButtonsUI === "function") syncShopButtonsUI();
        overlay.style.zIndex = "10000";
        
        overlay.innerHTML = `
            <div class="auth-modal-card proto-card" style="text-align: center; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <h2 style="color: var(--color-accent-in); margin-bottom: 1rem; font-size: 2rem;">🛍️ Jutalom Bolt</h2>
                <p style="margin-bottom: 2rem; color: var(--color-text-muted);">Költsd el a nehezen megszerzett XP-det extra funkciókra és témákra!</p>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; text-align: left;">
                    
                    <!-- Cyberpunk -->
                    <div class="shop-item" style="padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎛️</div>
                        <h3 style="font-size: 1.2rem; margin-bottom: 0.2rem;">Cyberpunk Neon Téma</h3>
                        <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 1rem;">Neon színek és sötét kontrasztok.</p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: bold; color: var(--color-accent-in);">0 XP (Test)</span>
                            <button class="btn btn-secondary" onclick="unlockShopItem('cyberpunk', 0, this)">Feloldás</button>
                        </div>
                    </div>
                    
                    <!-- Nature -->
                    <div class="shop-item" style="padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🌿</div>
                        <h3 style="font-size: 1.2rem; margin-bottom: 0.2rem;">Természet Téma</h3>
                        <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 1rem;">Nyugtató zöld árnyalatok.</p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: bold; color: var(--color-accent-in);">0 XP (Test)</span>
                            <button class="btn btn-secondary" onclick="unlockShopItem('nature', 0, this)">Feloldás</button>
                        </div>
                    </div>
                    
                    <!-- Shield -->
                    <div class="shop-item" style="padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🛡️</div>
                        <h3 style="font-size: 1.2rem; margin-bottom: 0.2rem;">Streak Pajzs</h3>
                        <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 1rem;">Megvéd, ha kihagysz egy napot.</p>
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: bold; color: var(--color-accent-in);">0 XP (Test)</span>
                            <button class="btn btn-secondary" onclick="buyStreakShield(0, this)">Vásárlás</button>
                        </div>
                    </div>
                    
                </div>
                
                <button class="btn btn-primary" onclick="this.closest('.auth-modal-overlay').style.display='none'" style="margin-top: 2rem; width: 100%; justify-content: center;">Vissza</button>
            </div>
        `;
        document.body.appendChild(overlay);
        if(typeof syncShopButtonsUI === "function") syncShopButtonsUI();
    } else {
        overlay.style.display = "flex";
        if(typeof syncShopButtonsUI === "function") syncShopButtonsUI();
    }
};

window.initSettingsUI = function() {
    if (userProgress.scores) {
        const soundTgl = document.getElementById("sound-toggle");
        if (soundTgl) soundTgl.checked = userProgress.scores.sound_enabled !== false;
        
        const motionTgl = document.getElementById("reduced-motion-toggle");
        if (motionTgl) {
            motionTgl.checked = userProgress.scores.reduced_motion === true;
            if (motionTgl.checked) document.body.classList.add('reduced-motion');
        }
    }
};


// ==========================================================================
// PHASE 8.3: DAILY QUESTS LOGIC
// ==========================================================================
let allQuestsPool = [];

async function initDailyQuests() {
    // 1. Fetch the quest pool
    try {
        const res = await fetch('data/quests.json');
        if (res.ok) {
            allQuestsPool = await res.json();
        }
    } catch (e) {
        console.warn('Failed to load quests.json', e);
        return;
    }
    
    if (allQuestsPool.length === 0) return;
    
    // 2. Check if it's a new day
    const today = new Date().toISOString().split('T')[0];
    if (userProgress.daily_quests_date !== today) {
        userProgress.daily_quests_date = today;
        userProgress.quest_progress = {};
        userProgress.completed_quests_today = [];
        
        // Pick 3 random quests
        let shuffled = [...allQuestsPool].sort(() => 0.5 - Math.random());
        userProgress.active_quests = shuffled.slice(0, 3).map(q => q.id);
        
        // Initialize progress
        userProgress.active_quests.forEach(qId => {
            userProgress.quest_progress[qId] = 0;
        });
        
        saveUserProgress();
    }
    
    // Check login quest immediately
    updateQuestProgress('login', 1);
}

window.updateQuestProgress = function(type, amount) {
    if (!userProgress.active_quests) return;
    
    let updated = false;
    userProgress.active_quests.forEach(qId => {
        const questData = allQuestsPool.find(q => q.id === qId);
        if (!questData || questData.type !== type) return;
        
        if (!userProgress.completed_quests_today.includes(qId)) {
            let current = userProgress.quest_progress[qId] || 0;
            current += amount;
            if (current > questData.target) current = questData.target;
            userProgress.quest_progress[qId] = current;
            updated = true;
        }
    });
    
    if (updated) {
        saveUserProgress();
        renderQuestModalContent(); // Refresh UI if open
    }
};

window.claimQuestReward = function(questId) {
    if (userProgress.completed_quests_today.includes(questId)) return;
    
    const questData = allQuestsPool.find(q => q.id === questId);
    if (!questData) return;
    
    const current = userProgress.quest_progress[questId] || 0;
    if (current >= questData.target) {
        // Reward
        userProgress.completed_quests_today.push(questId);
        addXP(questData.reward, document.querySelector(`#btn-claim-${questId}`) || document.body);
        
        if (window.AudioSynth) if(typeof AudioSynth.playLevelUp === 'function') AudioSynth.playLevelUp(); else AudioSynth.playComplete();;
        
        saveUserProgress();
        renderQuestModalContent();
    }
};

window.openQuestsModal = function() {
    let overlay = document.getElementById("quests-modal-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.id = "quests-modal-overlay";
        if(typeof syncShopButtonsUI === "function") syncShopButtonsUI();
        
        // When clicking the overlay background, close the modal
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.classList.remove('is-active');
            }
        });
        
        overlay.innerHTML = `
            <div class="modal-content drawer-modal-content proto-card" style="text-align: center; max-width: 500px; padding: 2rem;">
                <h2 style="color: var(--color-accent-in); margin-bottom: 1rem; font-size: 2rem;">🎯 Napi Küldetések</h2>
                <p style="margin-bottom: 2rem; color: var(--color-text-muted);">Teljesítsd a küldetéseket, és szerezz bónusz XP-t minden nap!</p>
                
                <div id="quests-container" style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                    <!-- Dynamically populated -->
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Force reflow before adding is-active
        overlay.offsetHeight;
        overlay.classList.add('is-active');
    } else {
        overlay.classList.add('is-active');
    }
    if(typeof syncShopButtonsUI === "function") syncShopButtonsUI();
    
    // Auto-populate quests if empty
    setTimeout(() => {
        if (!userProgress.active_quests || userProgress.active_quests.length === 0) {
            checkAndGenerateDailyQuests();
        }
        renderQuestModalContent();
    }, 50);
};
function renderQuestModalContent() {
    const container = document.getElementById("quests-container");
    if (!container) return;
    
    if (!userProgress.active_quests || userProgress.active_quests.length === 0) {
        container.innerHTML = "<p style='text-align:center;'>Nincsenek elérhető küldetések.</p>";
        return;
    }
    
    let html = "";
    userProgress.active_quests.forEach(qId => {
        const qData = allQuestsPool.find(q => q.id === qId);
        if (!qData) return;
        
        const current = userProgress.quest_progress[qId] || 0;
        const target = qData.target;
        const isCompleted = userProgress.completed_quests_today.includes(qId);
        const canClaim = current >= target && !isCompleted;
        
        const progressPercent = Math.min(100, Math.round((current / target) * 100));
        
        let buttonHtml = `<div style="font-weight:bold; color:var(--color-text-muted);">${current} / ${target}</div>`;
        
        if (isCompleted) {
            buttonHtml = `<button class="btn btn-secondary" disabled style="border-color:var(--color-success); color:var(--color-success);">Begyűjtve ✓</button>`;
        } else if (canClaim) {
            buttonHtml = `<button id="btn-claim-${qId}" class="btn btn-primary" onclick="claimQuestReward('${qId}')">Begűjtés (+${qData.reward} XP)</button>`;
        }
        
        html += `
            <div style="padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div>
                        <h3 style="font-size: 1.1rem; margin-bottom: 0.2rem;">${qData.title}</h3>
                        <p style="font-size: 0.8rem; color: var(--color-text-muted);">${qData.desc}</p>
                    </div>
                    ${buttonHtml}
                </div>
                <!-- Progress bar -->
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden; margin-top: 0.5rem;">
                    <div style="height: 100%; width: ${progressPercent}%; background: ${isCompleted ? 'var(--color-success)' : 'var(--color-accent-in)'}; transition: width 0.3s ease;"></div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}
