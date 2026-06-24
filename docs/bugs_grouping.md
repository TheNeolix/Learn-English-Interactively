Direct Duplicates Found
The following issues are duplicates of each other and can be closed/ignored:

Label/Input association: #132 is a duplicate of #81.
Form label association: #133 is a duplicate of #82.
Optional Chaining smell: #135 is a duplicate of #98.
Cognitive Complexity: #136 is a duplicate of #99.
Helper Preferences: #137 is a duplicate of #100 and #138 is a duplicate of #101.
Cognitive Complexity: #139 is a duplicate of #103.
Unreachable Code: #140 is a duplicate of #105.
Cognitive Complexity: #142 is a duplicate of #109 and #141 is a duplicate of #107.
📦 Proposed Groupings for Bulk PRs
Batch 1: HTML Accessibility & Semantics
Files:

dashboard.html
Description: Address SonarCloud rules concerning HTML tags, interactive components, labels, and roles.
Issues included:
#81 (and #132): Associate a valid label to input slider #sound-slider (line 207).
#82 (and #133): Associate form label with a control for .switch (line 212).
#83 (and #127): Add proper roles and keyboard support for custom interactive elements (onclick on divs/spans at lines 282, 308, 363).
#84: Avoid tabIndex on non-interactive elements (tooltip span at line 308).
#119, #121, #123, #125, #126: Convert anchor tags (<a>) used as action triggers with no href into semantic <button> elements.
Batch 2: Simple JavaScript Syntax Improvements
Files:

js/dashboard.js
Description: Address syntax preferences, performance smells, and unused expressions.
Issues included:
#85: Prefer Number.parseFloat over the global parseFloat (lines 487, 526).
#87: Simplify the regex /Szia,?\s+(.+)!/ to avoid super-linear backtracking risks (line 865).
#88 & #129: Fix unused expressions like overlay.offsetHeight; and card.offsetHeight; (typically used to trigger CSS reflows) by prefixing them with void to satisfy the static analysis (lines 4908, 4929).
#112: Extract nested ternary operator into separate declarations for readability (line 3306).
Batch 3: Optional Chaining (?.) Refactoring
Files:

js/dashboard.js
Description: Streamline checks for deep properties to prevent runtime TypeError issues.
Issues included:
#98 (and #135): Use optional chaining at line 273.
#106: Use optional chaining at line 3835.
#108: Use optional chaining at line 3847.
#110: Use optional chaining at line 3867.
#134: Use optional chaining at line 22.
Batch 4: Dead & Unreachable Code Removal
Files:

js/dashboard.js
Description: Safely refactor code placed after unconditional returns.
Issues included:
#86 (and #105, #140): Remove or refactor the unreachable blocks below the return true; fallback check in the beta access guard (line 655).
Batch 5: Sonar Sync Tool Cleanups
Files:

js/sync_sonar_issues.js
Description: Clean up minor code smells within your automation script.
Issues included:
#155: Prefer using optional chaining (line 69).
#156: Remove unnecessary escape character \- in the regex matching issue names (line 158).
Batch 6: PHP Engine Cleanups
Files:

api.php
Description: Refactor controller functions to keep returns clean and code flow clear.
Issues included:
#115: Reduce the number of return statements in the routing target (line 98).
#117: Reduce cognitive complexity of the handler at line 98.
#130: Reduce cognitive complexity of the handler at line 246.
#131: Reduce cognitive complexity of the handler at line 317.
Batch 7: Cognitive Complexity Reductions
Files:

js/dashboard.js
Description: Refactor longer helper methods by breaking them down into smaller sub-functions.
Issues included:
#96, #97, #99 (and #136), #102, #103 (and #139), #107 (and #141), #109 (and #142), #114, #128, #157.
