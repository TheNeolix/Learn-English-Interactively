// js/dashboard.js

document.addEventListener("DOMContentLoaded", async () => {
    // Start listening for sidebar accordion clicks, top navbar clicks, and modal events
    initAccordionListeners();
    initTopNavbarListeners();
    initModalListeners();
    
    // Initialize progression tracking for the logged-in user
    await initUserProgress();
    
    // Read what level was clicked on index.html (fallback to A1 if empty)
    const levelToLoad = localStorage.getItem("selectedLevel") || "A1";
    
    // Automatically launch the workspace with the correct level data context
    switchGlobalLevel(levelToLoad);
});

// Track the currently active module context
let currentLevel = "A1";
let currentSection = "ToBe";
let currentSubsection = "explanation";

// Individual user progress state tracking
let userProgress = {
    username: "Vendég",
    points: 0,
    completed: {},
    scores: {}
};

// Global cache for fetched vocabulary data to prevent redundant network hits
const vocabCache = {};

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

// Loads progression from backend PHP API with LocalStorage fallback
async function initUserProgress() {
    const username = getLoggedInUser();
    
    try {
        const response = await fetch(`api/progress.php?user=${encodeURIComponent(username)}`);
        if (response.ok) {
            const data = await response.json();
            if (data && data.completed) {
                userProgress = data;
                if (typeof userProgress.points === "undefined") userProgress.points = 0;
                updateProgressUI();
                return;
            }
        }
    } catch (err) {
        console.warn("Backend API nem érhető el, localStorage fallback használata:", err);
    }

    const localData = localStorage.getItem(`progress_${username}`);
    if (localData) {
        userProgress = JSON.parse(localData);
        if (typeof userProgress.points === "undefined") userProgress.points = 0;
    } else {
        userProgress = {
            username: username,
            points: 0,
            completed: {},
            scores: {}
        };
    }
    updateProgressUI();
}

// Saves progression to backend database and updates local cache
async function saveUserProgress() {
    const username = userProgress.username;
    
    // Always update local cache for instant client validation
    localStorage.setItem(`progress_${username}`, JSON.stringify(userProgress));
    
    try {
        await fetch('api/progress.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userProgress)
        });
    } catch (err) {
        console.warn("Sikertelen mentés a szerverre:", err);
    }
    
    updateProgressUI();
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

// Action handler for manual section completion
function completeSubsectionAction(level, section, subsection, buttonEl) {
    const key = `${level}_${section}_${subsection}`;
    
    // Prevent duplicate point claims
    if (userProgress.completed[key]) return;
    
    // Reward points
    userProgress.points = (userProgress.points || 0) + 5;
    
    // Mark as completed
    userProgress.completed[key] = true;
    
    // Trigger floating +5 points pop animation
    const container = buttonEl.closest(".completion-button-container");
    if (container) {
        const pop = document.createElement("div");
        pop.className = "floating-points-pop";
        pop.textContent = "+5 Pont! 🎉";
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
}

// Scans the sidebar links to display completion checkmarks and update the level completion meter
function updateProgressUI() {
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

        // Only count subsections belonging to the current visual level track
        if (level === currentLevel) {
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

    const percentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const progressBar = document.querySelector(".progress-bar-fill");
    const progressPercentageText = document.querySelector(".progress-percentage");

    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
    }
    if (progressPercentageText) {
        progressPercentageText.textContent = `${percentage}% Kész`;
    }

    // Update global points counter
    const pointsEl = document.getElementById("points-counter");
    if (pointsEl) {
        pointsEl.textContent = userProgress.points || 0;
    }
}

// 1. LISTEN TO SIDEBAR ACCORDION SUBSECTION LINKS
function initAccordionListeners() {
    const subsectionLinks = document.querySelectorAll(".subsection-link");

    subsectionLinks.forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault();

            const subsectionKey = link.getAttribute("data-subsection");
            if (!subsectionKey) return;

            // Clear previous active states from all subsection links
            subsectionLinks.forEach(l => l.classList.remove("active"));
            link.classList.add("active");

            // Update current subsection and render
            currentSubsection = subsectionKey;
            renderSubsection(currentLevel, currentSection, currentSubsection);
        });
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

            if (level === "A1") {
                // Trigger live context layout switch without page refreshes
                switchGlobalLevel(level);
            } else if (level === "A2" || level === "B1" || level === "B2") {
                // Call premium glowing overlay alert module
                openWipModal();
            }
        });
    });
}

// 3. SEAMLESSLY SWITCH LEVEL DOMAIN WINDOW
function switchGlobalLevel(levelName) {
    currentLevel = levelName;
    currentSection = "ToBe";
    currentSubsection = "explanation";

    // Update active visual status anchors across top header links
    const navbarLinks = document.querySelectorAll(".site-header .nav-link");
    navbarLinks.forEach(link => link.classList.remove("active"));
    
    const targetHeaderLink = document.getElementById(`nav-${levelName.toLowerCase()}`);
    if (targetHeaderLink) targetHeaderLink.classList.add("active");

    // Update accordion data attributes
    const accordion = document.querySelector(".course-accordion");
    if (accordion) {
        accordion.setAttribute("data-level", levelName);
    }

    // Reset active subsection link to the first one (Szavak)
    const subsectionLinks = document.querySelectorAll(".subsection-link");
    subsectionLinks.forEach(l => l.classList.remove("active"));
    const firstLink = document.querySelector('.subsection-link[data-subsection="explanation"]');
    if (firstLink) firstLink.classList.add("active");

    // Run core engine to paint the chosen view
    renderSubsection(currentLevel, currentSection, currentSubsection);
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
            <li>A "Lenni" Ige</li>
            <li aria-current="page">${subsectionTitle}</li>
        `;
    }

    if (!moduleData || !subsectionData) {
        document.querySelector(".current-topic-title").textContent = "Tananyag Nem Található";
        workspace.innerHTML = `<p class="error-text" style="color: var(--color-error); padding: 2rem;">Sajnáljuk, ehhez a részhez még nem töltöttek fel feladatokat.</p>`;
        return;
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
            renderFillBlanksTemplate(workspace, subsectionData);
            break;
        case "word_order":
            renderWordOrderTemplate(workspace, subsectionData);
            break;
        case "true_false":
            renderTrueFalseTemplate(workspace, subsectionData);
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
            const response = await fetch(source + "?v=1.0.2");
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
                <div class="words-table-wrapper">
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
            </section>
            ${getCompleteButtonHtml(currentLevel, currentSection, currentSubsection, false)}
        </div>
    `;
}

// LYUKAS MONDATOK (Fill in the blanks) — Input fields
function renderFillBlanksTemplate(workspace, data) {
    if (data.items.length === 0) {
        workspace.innerHTML = renderEmptyState("Lyukas mondatok", "Ehhez a leckéhez hamarosan feltöltjük a feladatokat.");
        return;
    }

    let questionsHtml = "";
    data.items.forEach((item, i) => {
        questionsHtml += `
            <div class="fill-blank-item" data-index="${i}" style="animation-delay: ${i * 0.06}s">
                <p class="fill-blank-sentence">
                    <span class="question-number">${i + 1}.</span>
                    ${item.sentence.replace(/_{3,}/, `<input type="text" class="fill-blank-input" id="fill-input-${i}" placeholder="..." autocomplete="off">`) }
                    <span class="fill-hint">${item.hint}</span>
                </p>
                <div class="fill-blank-actions">
                    <button class="btn btn-check" onclick="checkFillBlank(${i})">Ellenőrzés</button>
                </div>
                <div class="quiz-feedback" id="fill-feedback-${i}"></div>
            </div>
        `;
    });

    workspace.innerHTML = `
        <div class="lesson-view">
            <section class="practice-box">
                <h2>✏️ Lyukas mondatok – Töltsd ki a hiányzó szót!</h2>
                <p class="section-instruction">${data.description || 'Írd be a megfelelő alakját a "to be" igének (am, is, are) a hiányzó helyre.'}</p>
                <div class="fill-blanks-list">${questionsHtml}</div>
            </section>
            ${getCompleteButtonHtml(currentLevel, currentSection, currentSubsection, true)}
        </div>
    `;
}

// SZÓRENDEZÉS (Word Ordering) — Draggable word chips
function renderWordOrderTemplate(workspace, data) {
    if (data.items.length === 0) {
        workspace.innerHTML = renderEmptyState("Szórendezés", "Ehhez a leckéhez hamarosan feltöltjük a feladatokat.");
        return;
    }

    let questionsHtml = "";
    data.items.forEach((item, i) => {
        // Shuffle the scrambled array for display
        const shuffled = [...item.scrambled].sort(() => Math.random() - 0.5);
        const chipsHtml = shuffled.map(word => 
            `<button class="word-chip" onclick="selectWordChip(this, ${i})">${word}</button>`
        ).join("");

        questionsHtml += `
            <div class="word-order-item" data-index="${i}" style="animation-delay: ${i * 0.06}s">
                <p class="word-order-instruction">
                    <span class="question-number">${i + 1}.</span>
                    Rakd helyes sorrendbe! <span class="fill-hint">${item.hu}</span>
                </p>
                <div class="word-chips-source" id="chips-source-${i}">${chipsHtml}</div>
                <div class="word-order-answer" id="answer-zone-${i}" data-correct="${item.correct}">
                    <span class="answer-placeholder">Kattints a szavakra a helyes sorrendben...</span>
                </div>
                <div class="word-order-actions">
                    <button class="btn btn-check" onclick="checkWordOrder(${i})">Ellenőrzés</button>
                    <button class="btn btn-reset" onclick="resetWordOrder(${i})">Újrakezdés</button>
                </div>
                <div class="quiz-feedback" id="order-feedback-${i}"></div>
            </div>
        `;
    });

    workspace.innerHTML = `
        <div class="lesson-view">
            <section class="practice-box">
                <h2>🔀 Szórendezés – Rakd össze a mondatot!</h2>
                <p class="section-instruction">Kattints a szavakra a helyes sorrendben, hogy kiadják az angol mondatot.</p>
                <div class="word-order-list">${questionsHtml}</div>
            </section>
            ${getCompleteButtonHtml(currentLevel, currentSection, currentSubsection, true)}
        </div>
    `;
}

// IGAZ VAGY HAMIS (True or False) — Two-button quiz
function renderTrueFalseTemplate(workspace, data) {
    if (data.items.length === 0) {
        workspace.innerHTML = renderEmptyState("Igaz vagy Hamis", "Ehhez a leckéhez hamarosan feltöltjük a feladatokat.");
        return;
    }

    let quizHtml = "";
    data.items.forEach((item, i) => {
        quizHtml += `
            <div class="quiz-item" data-index="${i}" style="animation-delay: ${i * 0.06}s">
                <p class="quiz-question"><span class="question-number">${i + 1}.</span> ${item.question}</p>
                <div class="quiz-buttons">
                    <button class="btn btn-tf btn-true" onclick="checkTrueFalse(${i}, true)">
                        <span class="tf-icon">✓</span> IGAZ
                    </button>
                    <button class="btn btn-tf btn-false" onclick="checkTrueFalse(${i}, false)">
                        <span class="tf-icon">✗</span> HAMIS
                    </button>
                </div>
                <div class="quiz-feedback" id="tf-feedback-${i}"></div>
            </div>
        `;
    });

    workspace.innerHTML = `
        <div class="lesson-view">
            <section class="practice-box">
                <h2>✅ Igaz vagy Hamis – Döntsd el!</h2>
                <p class="section-instruction">Olvasd el az állítást, és döntsd el, hogy igaz vagy hamis!</p>
                <div class="quiz-list">${quizHtml}</div>
            </section>
            ${getCompleteButtonHtml(currentLevel, currentSection, currentSubsection, true)}
        </div>
    `;
}

// FEJEZET VIZSGA (Section Exam) — Mixed question types
function renderSectionExamTemplate(workspace, data) {
    if (data.items.length === 0) {
        workspace.innerHTML = renderEmptyState("Fejezet vizsga", "A vizsga hamarosan elérhető lesz. Addig gyakorolj a többi feladattal!");
        return;
    }

    let questionsHtml = "";
    data.items.forEach((item, i) => {
        let questionContentHtml = "";

        if (item.type === "fill") {
            questionContentHtml = `
                <p class="exam-question"><span class="question-number">${i + 1}.</span> ${item.question.replace(/_{3,}/, `<input type="text" class="fill-blank-input exam-input" id="exam-input-${i}" placeholder="..." autocomplete="off">`)}</p>
            `;
        } else if (item.type === "tf") {
            questionContentHtml = `
                <p class="exam-question"><span class="question-number">${i + 1}.</span> ${item.question}</p>
                <div class="quiz-buttons">
                    <button class="btn btn-tf btn-true" onclick="checkExamTF(${i}, true)">
                        <span class="tf-icon">✓</span> IGAZ
                    </button>
                    <button class="btn btn-tf btn-false" onclick="checkExamTF(${i}, false)">
                        <span class="tf-icon">✗</span> HAMIS
                    </button>
                </div>
            `;
        } else if (item.type === "order") {
            const shuffled = [...item.scrambled].sort(() => Math.random() - 0.5);
            const chipsHtml = shuffled.map(word =>
                `<button class="word-chip" onclick="selectWordChip(this, ${i}, true)">${word}</button>`
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
                    <p class="section-instruction">Ez a fejezet összefoglaló vizsgája. Válaszolj az összes kérdésre, majd nyomj az értékelésre!</p>
                </div>
                <div class="exam-list">${questionsHtml}</div>
                <div class="exam-footer">
                    <button class="btn btn-submit-exam" onclick="gradeExam()">📋 Vizsga értékelése</button>
                    <div class="exam-result" id="exam-result"></div>
                </div>
            </section>
            ${getCompleteButtonHtml(currentLevel, currentSection, currentSubsection, true)}
        </div>
    `;
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

    if (possibleAnswers.includes(userAnswer)) {
        feedback.innerHTML = `✓ Helyes válasz! Ügyes vagy!`;
        feedback.className = "quiz-feedback correct";
        input.classList.add("input-correct");
        input.classList.remove("input-incorrect");
    } else {
        const displayAnswer = correctAnswer.replace(/\//g, " / ");
        feedback.innerHTML = `✗ Nem jó. A helyes válasz: <strong>${displayAnswer}</strong>`;
        feedback.className = "quiz-feedback incorrect";
        input.classList.add("input-incorrect");
        input.classList.remove("input-correct");
    }
    const completeBtn = document.querySelector(".btn-complete-section");
    if (completeBtn) completeBtn.disabled = false;
}

// True/False checker
function checkTrueFalse(index, studentAnswer) {
    const data = learningContent[currentLevel][currentSection].subsections.trueFalse;
    const item = data.items[index];
    const feedback = document.getElementById(`tf-feedback-${index}`);

    if (studentAnswer === item.answer) {
        feedback.innerHTML = `✓ ${item.explanation}`;
        feedback.className = "quiz-feedback correct";
    } else {
        feedback.innerHTML = `✗ ${item.explanation}`;
        feedback.className = "quiz-feedback incorrect";
    }
    const completeBtn = document.querySelector(".btn-complete-section");
    if (completeBtn) completeBtn.disabled = false;
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
    };
    answerZone.appendChild(clone);

    // Visually disable original chip
    chipEl.classList.add("used");
    chipEl.disabled = true;
}

// Check word order correctness
function checkWordOrder(index) {
    const answerZone = document.getElementById(`answer-zone-${index}`);
    const feedback = document.getElementById(`order-feedback-${index}`);
    const correctAnswer = answerZone.getAttribute("data-correct");

    const placedChips = answerZone.querySelectorAll(".word-chip.placed");
    const userAnswer = Array.from(placedChips).map(c => c.textContent).join(" ") + ".";

    if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
        feedback.innerHTML = `✓ Helyes! A mondat: "${correctAnswer}"`;
        feedback.className = "quiz-feedback correct";
    } else {
        feedback.innerHTML = `✗ Nem jó. A helyes sorrend: "${correctAnswer}"`;
        feedback.className = "quiz-feedback incorrect";
    }
    const completeBtn = document.querySelector(".btn-complete-section");
    if (completeBtn) completeBtn.disabled = false;
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

// Exam T/F checker
function checkExamTF(index, studentAnswer) {
    const data = learningContent[currentLevel][currentSection].subsections.sectionExam;
    const item = data.items[index];
    const feedback = document.getElementById(`exam-feedback-${index}`);

    if (studentAnswer === item.answer) {
        feedback.innerHTML = `✓ ${item.explanation || "Helyes!"}`;
        feedback.className = "quiz-feedback correct";
    } else {
        feedback.innerHTML = `✗ ${item.explanation || "Helytelen!"}`;
        feedback.className = "quiz-feedback incorrect";
    }
}

// Grade the full exam
function gradeExam() {
    const data = learningContent[currentLevel][currentSection].subsections.sectionExam;
    let correct = 0;
    let total = data.items.length;

    data.items.forEach((item, i) => {
        const feedback = document.getElementById(`exam-feedback-${i}`);

        if (item.type === "fill") {
            const input = document.getElementById(`exam-input-${i}`);
            const userAnswer = input ? input.value.trim().toLowerCase() : "";
            const possibleAnswers = item.answer.toLowerCase().split("/").map(ans => ans.trim());

            if (possibleAnswers.includes(userAnswer)) {
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
            // Already handled by checkExamTF click handler
            if (feedback.classList.contains("correct")) correct++;
        } else if (item.type === "order") {
            const answerZone = document.getElementById(`answer-zone-${i}`);
            const correctAnswer = answerZone?.getAttribute("data-correct") || "";
            const placedChips = answerZone?.querySelectorAll(".word-chip.placed") || [];
            const userAnswer = Array.from(placedChips).map(c => c.textContent).join(" ") + ".";

            if (userAnswer.toLowerCase() === correctAnswer.toLowerCase()) {
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

    resultEl.innerHTML = `
        <div class="exam-result-card ${percentage >= 50 ? 'passed' : 'failed'}">
            <span class="exam-score">${correct} / ${total}</span>
            <span class="exam-percentage">(${percentage}%)</span>
            <p class="exam-grade">${grade}</p>
        </div>
    `;
    if (percentage >= 50) {
        const completeBtn = document.querySelector(".btn-complete-section");
        if (completeBtn) completeBtn.disabled = false;
    }
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
        wipModal.addEventListener("click", (e) => {
            if (e.target === wipModal) closeWipModal();
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
