console.log("AP Classroom Helper Content Script Loaded (v0.9 - Listener Debug).");

const learnosityOrigin = "https://items-va.learnosity.com";
let latestActivityDataFromMessage = null;
let checkUIAdded = false;

function injectStyles() {
    const styleId = 'apc-helper-styles';
    if (document.getElementById(styleId)) return;
    const css = `
        .apc-nav-feedback { display: inline-flex; align-items: center; margin-right: 10px; padding: 0 5px; font-size: 14px; font-weight: bold; min-height: 30px; min-width: 90px; text-align: center; border-radius: 4px; box-sizing: border-box; }
        .apc-feedback-correct { color: #1a7e1a; }
        .apc-feedback-incorrect { color: #b71c1c; }
        .apc-feedback-noselection { color: #e65100; }
        .apc-check-current-button { font-normal font-content cursor-pointer rounded-20 px-4.2 py-2.8 h-12 whitespace-nowrap bg-bluebook-green focus:outline-none text-white border-[1px] border-bluebook-green transition-shadow duration-[250ms] ease-in-out hover:border-bluebook-dark-green focus:shadow-[0_0_0_2px] focus:shadow-bluebook-green focus:underline focus:border-white h-[40px] !font-bold text-[14px] inline-flex items-center justify-center padding-left: 12px; padding-right: 12px; }
    `;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = css.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
    document.head.appendChild(style);
    console.log("[APC Helper] Styles injected.");
}

function addCheckUI() {
    if (!latestActivityDataFromMessage) {
        console.warn("[APC Helper] addCheckUI called but latestActivityDataFromMessage is null. Aborting UI add.");
        return;
    }
    if (checkUIAdded) {
        return;
    }
    console.log("[APC Helper] Attempting to add Check UI...");
    injectStyles();
    const navContainer = document.querySelector('div[data-test-id="navigation-container"]');
    let referenceButton = navContainer?.querySelector('button[data-test-id="back-button"]');
    if (!referenceButton) {
        referenceButton = navContainer?.querySelector('button[data-test-id="next-button"]');
    }
    if (!navContainer || !referenceButton) {
        console.warn("[APC Helper] Could not find nav container or reference button (Back/Next) for Check UI.");
        return;
    }
    if (document.getElementById('apc-nav-feedback-area') || navContainer.querySelector('.apc-check-current-button')) {
        console.log("[APC Helper] Check UI elements already seem to exist. Setting flag.");
        checkUIAdded = true;
        return;
    }
    try {
        const feedbackSpan = document.createElement('span');
        feedbackSpan.id = 'apc-nav-feedback-area';
        feedbackSpan.className = 'apc-nav-feedback';
        feedbackSpan.textContent = '';
        const checkButton = document.createElement('button');
        checkButton.textContent = 'Check Current Answer';
        checkButton.className = 'apc-check-current-button';
        checkButton.type = 'button';
        checkButton.addEventListener('click', handleCheckCurrentClick);
        navContainer.insertBefore(feedbackSpan, referenceButton);
        navContainer.insertBefore(checkButton, referenceButton);
        checkUIAdded = true;
        console.log("[APC Helper] 'Check Current Answer' button and feedback area ADDED.");
    } catch (error) {
        console.error("[APC Helper] Error adding Check UI:", error);
        checkUIAdded = false;
    }
}

function handleCheckCurrentClick() {
    console.log("[APC Helper] 'Check Current Answer' clicked.");
    const feedbackSpan = document.getElementById('apc-nav-feedback-area');
    if (!feedbackSpan) {
        console.error("[APC Helper] CRITICAL ERROR: Feedback area 'apc-nav-feedback-area' not found!");
        alert("Error: Feedback UI missing.");
        return;
    }
    feedbackSpan.textContent = '';
    feedbackSpan.className = 'apc-nav-feedback';
    if (!latestActivityDataFromMessage?.data?.apiActivity?.items) {
        console.error("[APC Helper] Check Current Error: Missing activity data.");
        feedbackSpan.textContent = 'Data Error';
        feedbackSpan.classList.add('apc-feedback-incorrect');
        return;
    }
    let questionIndex = -1;
    try {
        const navigatorButton = document.querySelector('button[aria-label*="Question "][aria-label*=" of "]');
        if (!navigatorButton) throw new Error("Navigator button not found.");
        const label = navigatorButton.getAttribute('aria-label');
        if (!label) throw new Error("Navigator button missing aria-label.");
        const match = label.match(/Question\s+(\d+)\s+of\s+\d+/);
        if (!match || !match[1]) throw new Error(`Cannot parse label: "${label}"`);
        const currentQuestionNumber = parseInt(match[1], 10);
        if (isNaN(currentQuestionNumber) || currentQuestionNumber < 1) throw new Error(`Invalid number: "${match[1]}"`);
        questionIndex = currentQuestionNumber - 1;
        console.log(`[APC Helper] Determined current question index: ${questionIndex} (Question ${currentQuestionNumber})`);
    } catch (error) {
        console.error("[APC Helper] Error determining current question index:", error);
        feedbackSpan.textContent = 'Index Error';
        feedbackSpan.classList.add('apc-feedback-incorrect');
        return;
    }
    const items = latestActivityDataFromMessage.data.apiActivity.items;
    if (questionIndex < 0 || questionIndex >= items.length) {
        console.error(`[APC Helper] Check Current Error: Index ${questionIndex} out of bounds (${items.length} items).`);
        feedbackSpan.textContent = 'Index Error';
        feedbackSpan.classList.add('apc-feedback-incorrect');
        return;
    }
    const item = items[questionIndex];
    const questionData = item?.questions?.[0];
    const correctAnswerValue = questionData?.validation?.valid_response?.value?.[0];
    const options = questionData?.options;
    if (!correctAnswerValue || !options) {
        console.error(`[APC Helper] Data Error: Missing validation/options for Q ${questionIndex + 1}.`);
        feedbackSpan.textContent = 'Data Error';
        feedbackSpan.classList.add('apc-feedback-incorrect');
        return;
    }
    const currentMcqGroup = document.querySelector(`div[data-index="${questionIndex}"]`);
    if (!currentMcqGroup) {
        console.error(`[APC Helper] DOM Error: Cannot find MCQ group element with data-index="${questionIndex}"`);
        feedbackSpan.textContent = 'DOM Error';
        feedbackSpan.classList.add('apc-feedback-incorrect');
        return;
    }
    console.log(`[APC Helper] Found MCQ group with data-index="${questionIndex}"`);
    const choiceElements = currentMcqGroup.querySelectorAll('input[type="radio"]');
    console.log(`[APC Helper] Found ${choiceElements.length} radio input elements in MCQ group`);
    console.log(`[APC Helper] MCQ group structure (truncated):`, 
        currentMcqGroup.innerHTML.substring(0, 200) + (currentMcqGroup.innerHTML.length > 200 ? '...' : ''));
    let selectedIndex = -1;
    choiceElements.forEach((input, index) => {
        const isSelected = input.getAttribute('aria-checked') === 'true' || input.checked;
        console.log(`[APC Helper] Option ${index}: aria-checked=${input.getAttribute('aria-checked')}, checked=${input.checked}`);
        if (isSelected) {
            selectedIndex = index;
            console.log(`[APC Helper] Found selected radio input at index ${index}`);
        }
    });
    if (selectedIndex === -1) {
        feedbackSpan.textContent = `Not selected. Answer: ${correctAnswerValue.charAt(correctAnswerValue.length - 1)}`;
        feedbackSpan.classList.add('apc-feedback-noselection');
        return;
    }
    if (selectedIndex >= options.length) {
        console.error(`[APC Helper] Index Error: Selected index ${selectedIndex} out of bounds for options (len ${options.length}) for Q ${questionIndex + 1}.`);
        feedbackSpan.textContent = 'Index Error';
        feedbackSpan.classList.add('apc-feedback-incorrect');
        return;
    }
    const selectedValue = options[selectedIndex].value;
    console.log(`[APC Helper] Checking Q ${questionIndex + 1}: Selected=${selectedValue}, Correct=${correctAnswerValue}`);
    if (selectedValue === correctAnswerValue) {
        feedbackSpan.textContent = `${questionIndex + 1}. Correct`;
        feedbackSpan.classList.add('apc-feedback-correct');
    } else {
        feedbackSpan.textContent = `${questionIndex + 1}. Incorrect`;
        feedbackSpan.classList.add('apc-feedback-incorrect');
    }
}

console.log("[APC Helper] Adding message listener...");
window.addEventListener('message', (event) => {
    if (event.origin !== learnosityOrigin) {
        return;
    }
    console.log("[APC Helper] Message origin MATCHES.");
    if (typeof event.data !== 'string') {
        console.log("[APC Helper] Ignoring message: Data is not a string.", event.data);
        return;
    }
    let messageData;
    try {
        messageData = JSON.parse(event.data);
        console.log("[APC Helper] Message data successfully parsed as JSON:", messageData);
    } catch (e) {
        console.log("[APC Helper] Ignoring message: Data is not valid JSON.", event.data.substring(0, 200));
        return;
    }
    if (messageData && typeof messageData.responseText === 'string') {
        console.log(`[APC Helper] Message structure MATCHES xdomain response (ID: ${messageData.id}, Status: ${messageData.status}).`);
        try {
            const responseBody = JSON.parse(messageData.responseText);
            console.log("[APC Helper] Successfully parsed messageData.responseText:", responseBody);
            if (responseBody?.data?.apiActivity?.items) {
                console.log("[APC Helper] Activity data STRUCTURE CONFIRMED in responseBody.");
                latestActivityDataFromMessage = responseBody;
                console.log("[APC Helper] latestActivityDataFromMessage updated.");
                checkUIAdded = false;
                console.log("[APC Helper] checkUIAdded flag reset.");
                setTimeout(() => {
                    addCheckUI();
                }, 0);
                chrome.storage.local.set({ 'latestActivityDataFromMessage': latestActivityDataFromMessage })
                    .then(() => console.log("[APC Helper] Activity data saved to local storage."))
                    .catch(err => console.error("[APC Helper] Error saving to storage:", err));
            } else {
                console.log(`[APC Helper] Message responseText parsed, but NOT the expected activity data structure.`);
            }
        } catch (e) {
            console.error(`[APC Helper] FAILED to parse messageData.responseText (ID: ${messageData.id}):`, e);
            console.error("[APC Helper] Raw responseText (start):", messageData.responseText?.substring(0, 500));
        }
    } else if (messageData && messageData.ready) {
        console.log("[APC Helper] Learnosity xdomain iframe reported READY.");
    } else {
        console.log("[APC Helper] Ignoring message: Doesn't match xdomain response structure or 'ready' message.", messageData);
    }
});
console.log("[APC Helper] Message listener ADDED.");

function logAnswers(activityData) {
    if (!activityData?.data?.apiActivity?.items) return;
    console.log("[APC Helper] --- Correct Answers ---");
    activityData.data.apiActivity.items.forEach((item, index) => {
        try {
            const validResponseValue = item.questions?.[0]?.validation?.valid_response?.value?.[0];
            console.log(`[APC Helper] Question ${index + 1}: Correct value = ${validResponseValue || 'N/A'}`);
        } catch (e) {
            console.log(`[APC Helper] Question ${index + 1}: Error accessing answer data - ${e.message}`);
        }
    });
    console.log("[APC Helper] -----------------------");
}

function runAutoCompleter() {
    const activityData = latestActivityDataFromMessage;
    if (!activityData?.data?.apiActivity?.items) {
        console.error("[APC Helper] Autocompleter: No activity data found.");
        alert("Error: No activity data captured.");
        return;
    }
    console.log("[APC Helper] Starting autocompletion process using data from message...");
    logAnswers(activityData);
    const items = activityData.data.apiActivity.items;
    let questionIndex = 0, completedCount = 0, totalQuestions = items.length;
    const intervalId = setInterval(() => {
        if (questionIndex >= totalQuestions) {
            clearInterval(intervalId);
            console.log(`[APC Helper] Autocompletion finished. Completed ${completedCount} of ${totalQuestions} questions.`);
            return;
        }
        const item = items[questionIndex];
        try {
            const questionData = item.questions?.[0];
            const validResponseValue = questionData?.validation?.valid_response?.value?.[0];
            const options = questionData?.options;
            if (!validResponseValue || !options) {
                console.error(`[APC Helper] Skipping Q ${questionIndex + 1}: No valid response or options.`);
                questionIndex++;
                return;
            }
            const correctOption = options.find(opt => opt.value === validResponseValue);
            if (!correctOption) {
                console.error(`[APC Helper] Skipping Q ${questionIndex + 1}: Correct option not found.`);
                questionIndex++;
                return;
            }
            const correctOptionArrayIndex = options.indexOf(correctOption);
            const mcqGroups = document.querySelectorAll(".lrn_mcqgroup");
            if (questionIndex >= mcqGroups.length) {
                console.error(`[APC Helper] Skipping Q ${questionIndex + 1}: MCQ group not found.`);
                questionIndex++;
                return;
            }
            const currentMcqGroup = mcqGroups[questionIndex];
            const choiceElements = currentMcqGroup.childNodes;
            if (correctOptionArrayIndex >= choiceElements.length) {
                console.error(`[APC Helper] Skipping Q ${questionIndex + 1}: Choice index ${correctOptionArrayIndex} out of bounds.`);
                questionIndex++;
                return;
            }
            const clickableElement = choiceElements[correctOptionArrayIndex]?.childNodes[0];
            if (clickableElement?.click) {
                clickableElement.click();
                completedCount++;
                console.log(`[APC Helper] Q ${questionIndex + 1}: Clicked option ${correctOptionArrayIndex}`);
            } else {
                console.error(`[APC Helper] Q ${questionIndex + 1}: Clickable element not found.`);
            }
        } catch (e) {
            console.error(`[APC Helper] Error in autocompletion for Q ${questionIndex + 1}:`, e);
        } finally {
            questionIndex++;
        }
    }, 100);
}

window.addEventListener('keydown', (event) => {
    if (event.key === '\\') {
        console.log("[APC Helper] Backslash key pressed. Attempting autocompletion...");
        event.preventDefault();
        runAutoCompleter();
    }
    if (event.key === '#') {
        console.log("[APC Helper] '#' key pressed. Forcing UI check/add attempt...");
        event.preventDefault();
        if (latestActivityDataFromMessage) {
            checkUIAdded = false;
            addCheckUI();
        } else {
            console.log("[APC Helper] Cannot add UI, latestActivityDataFromMessage is still null.");
        }
    }
});

injectStyles();
console.log("[APC Helper] Initial script execution finished. Waiting for messages...");