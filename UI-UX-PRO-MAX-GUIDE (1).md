UI UX PRO MAX — COMPLETE USAGE & IMPLEMENTATION GUIDE
Purpose: A reusable step-by-step guide for using UI UX Pro Max to design, improve, redesign, and implement existing or new websites and applications.
Repository: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
________________________________________
1. OBJECTIVE
Use UI UX Pro Max as the primary UI/UX design intelligence skill throughout the project.
The goal is to deliver a professional, functional, responsive, accessible, and MVP-ready interface.
Support two project types:
●	Existing Project: Analyze, audit, improve, and redesign the existing application.
●	New Project: Analyze requirements, generate a design system, plan pages, and build the application.
Follow an MVP-first approach. Future enhancements must remain outside the approved MVP scope.
2. INSTALLATION & ENVIRONMENT SETUP
Step 1 — Detect the environment
Before installation:
1.	Identify the active AI coding agent.
2.	Inspect the project root.
3.	Check whether UI UX Pro Max is already installed.
4.	Check the installed skill version and location.
5.	Check Node.js, npm, and Python 3 availability.
6.	Identify whether project-level or global installation is appropriate.
7.	Check existing agent instruction files.
Do not reinstall an existing working skill unnecessarily.
Step 2 — Install using the official repository method
Recommended CLI installation:
bash
npm install -g ui-ux-pro-max-cli
For project-level installation, navigate to the project directory:
bash
cd /path/to/your/project
Select the appropriate agent:
bash
uipro init --ai cursor
uipro init --ai claude
uipro init --ai windsurf
uipro init --ai antigravity
uipro init --ai copilot
uipro init --ai codex
For supported universal agent environments:
bash
uipro init --ai universal
For global installation, use the appropriate supported option:
bash
uipro init --ai cursor --global
Replace cursor with the detected supported agent identifier.
For Claude Code, the official marketplace installation is also available:
text
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
Important installation rules:
●	Verify the platform identifier against the current official README.
●	Do not assume every agent uses the same installation mechanism.
●	Do not run multiple installation methods unnecessarily.
●	Do not overwrite existing agent configuration without checking it.
●	Ask the user before installing software or changing global machine configuration.
●	If Python 3 is missing, inform the user and request installation. Do not install it automatically.
Step 3 — Verify installation
Check the installed skill files.
Verify:
●	SKILL.md exists.
●	Required reference files are available.
●	Search script exists.
●	Agent configuration points to the correct skill location.
●	Python 3 is available.
●	The agent can read and activate the skill.
If the skill is unavailable, stop design implementation and report the issue.
Step 4 — Activate the skill
For Skill Mode agents, make a natural UI/UX request.
Example:
text
Use the ui-ux-pro-max skill to analyze and redesign my existing website.
For agents using Workflow Mode, use the documented slash command:
text
/ui-ux-pro-max Build a landing page for my SaaS product.
Only use slash commands for agents that officially support Workflow Mode.
Restart or reload the AI agent when required by its installation method.
3. HOW TO USE THE SKILL
The skill provides searchable design intelligence.
Use its actual installed SKILL.md, companion instructions, and search script.
The design workflow should use relevant recommendations for:
●	Product and industry category.
●	UI styles.
●	Color palettes.
●	Typography.
●	Landing page patterns.
●	UX guidelines.
●	Icons.
●	Charts where relevant.
●	Framework-specific implementation.
Do not rely on memory when the skill's searchable data can provide relevant recommendations.
Design System Generation
The official skill supports design-system generation.
Example:
bash
python3 <SKILL_DIRECTORY>/scripts/search.py \
  "SaaS dashboard" \
  --design-system \
  -p "Project Name"
Markdown output:
bash
python3 <SKILL_DIRECTORY>/scripts/search.py \
  "SaaS dashboard" \
  --design-system \
  -f markdown
Domain-specific searches:
bash
python3 <SKILL_DIRECTORY>/scripts/search.py \
  "minimal dashboard" --domain style

python3 <SKILL_DIRECTORY>/scripts/search.py \
  "professional typography" --domain typography

python3 <SKILL_DIRECTORY>/scripts/search.py \
  "dashboard layout" --domain product

python3 <SKILL_DIRECTORY>/scripts/search.py \
  "form validation accessibility" --domain ux
Stack-specific search:
bash
python3 <SKILL_DIRECTORY>/scripts/search.py \
  "responsive layout" --stack react
Replace <SKILL_DIRECTORY> with the actual installed skill path. Never assume that every agent installs the skill into the same directory.
Use additional searches only when relevant to the current project.
4. PROJECT ANALYSIS
Before designing or modifying anything, inspect the complete project.
Existing Website
Analyze:
●	Project structure.
●	Framework and versions.
●	Styling system.
●	Routes and pages.
●	Existing components.
●	Backend and API integrations.
●	Database dependencies.
●	Authentication and authorization.
●	Current UI/UX.
●	Existing design tokens.
●	Functional problems.
●	Responsive issues.
Preserve existing working functionality, business logic, backend, database, and technology stack.
Identify useful existing design elements that should remain.
New Website
Analyze:
●	Product concept.
●	Business objectives.
●	Target users.
●	User problems.
●	Main user journeys.
●	Required pages.
●	MVP functionality.
●	Technology requirements.
●	Design preferences, if provided.
Do not invent business requirements.
5. MVP SCOPE DEFINITION
Separate all proposed features into:
Must Have
Features required for the initial working product.
Should Have
Useful improvements that can follow after MVP delivery.
Future Enhancements
Optional advanced functionality.
Identify essential pages, user journeys, components, and integrations.
Do not implement future enhancements without approval.
6. DESIGN DIRECTIONS
Use UI UX Pro Max to generate appropriate design recommendations.
Present 2–3 distinct design directions before final design selection.
Each direction should include:
●	Visual style.
●	Color palette.
●	Typography.
●	Layout approach.
●	Component appearance.
●	Interaction style.
●	Relevant skill recommendations.
●	Advantages and disadvantages.
Include a recommended direction and explain why it suits the product.
Wait for user approval before finalizing the design direction.
When references or screenshots are provided, analyze them. Otherwise, use project requirements and skill recommendations.
7. DESIGN SYSTEM
Generate and document the approved design system.
Include:
●	Primary and secondary colors.
●	Background and surface colors.
●	Text and muted text colors.
●	Border colors.
●	Success, warning, and error colors.
●	Typography and font pairings.
●	Heading hierarchy.
●	Body text.
●	Spacing scale.
●	Container widths.
●	Grid system.
●	Border radius.
●	Shadows.
●	Breakpoints.
●	Interaction states.
●	Motion guidelines.
Use existing semantic tokens where possible.
Avoid creating conflicting or duplicate design systems.
8. PAGE & COMPONENT PLANNING
Create a page-by-page plan.
For every page, define:
●	Page purpose.
●	Target user.
●	Content hierarchy.
●	Main layout.
●	Required sections.
●	Components.
●	User interactions.
●	Responsive behavior.
●	Empty and error states.
Create a reusable component inventory.
Include only components required by the approved MVP.
9. IMPLEMENTATION PLANNING
Prepare a complete implementation roadmap.
Include:
●	Implementation sequence.
●	Files to create.
●	Files to modify.
●	Existing components to reuse.
●	Dependencies required.
●	Backend integration requirements.
●	Testing requirements.
●	Risks and assumptions.
The agent should select the most suitable implementation sequence based on project architecture.
Wait for approval of the complete analysis and design plan before coding.
10. IMPLEMENTATION
After approval:
1.	Follow the approved design system.
2.	Use UI UX Pro Max at every relevant design and implementation stage.
3.	Follow framework-specific skill recommendations.
4.	Preserve existing architecture and functionality.
5.	Reuse existing components where practical.
6.	Create reusable components for new functionality.
7.	Implement only approved MVP requirements.
8.	Make the interface responsive.
9.	Implement real interactions.
10.	Add appropriate loading, error, success, and empty states.
Verify each page or logical implementation batch before proceeding.
Do not replace working functionality with static mockups.
11. RESPONSIVE DESIGN
Verify the interface at:
●	375px — Mobile.
●	768px — Tablet.
●	1024px — Laptop.
●	1440px — Desktop.
Check:
●	Navigation.
●	Grid layouts.
●	Typography.
●	Content overflow.
●	Images.
●	Forms.
●	Tables.
●	Buttons.
●	Dialogs.
●	Touch interactions.
Do not simply shrink desktop layouts.
12. ACCESSIBILITY & UX
Apply relevant skill recommendations and professional accessibility practices.
Verify:
●	Semantic HTML.
●	Keyboard navigation.
●	Visible focus indicators.
●	Accessible form labels.
●	Color contrast.
●	Screen-reader support.
●	Meaningful image alt text.
●	Dialog accessibility.
●	Reduced-motion preferences.
●	Clear interaction feedback.
●	Error prevention and recovery.
Do not sacrifice accessibility for visual appearance.
13. VISUAL VERIFICATION
When browser or screenshot tools are available:
●	Capture important page previews.
●	Compare implementation with the approved design.
●	Review desktop and mobile layouts.
●	Identify visual inconsistencies.
●	Fix spacing and alignment issues.
●	Verify typography and colors.
●	Check component consistency.
Save important screenshots and final audit previews in:
text
docs/ui-ux/screenshots/
If screenshot tools are unavailable, report the limitation. Never claim visual testing was completed without evidence.
14. FINAL PRODUCTION READINESS AUDIT
Perform a full audit.
UI/UX
●	Consistent design system.
●	Proper visual hierarchy.
●	Correct spacing and alignment.
●	Consistent components.
●	Professional appearance.
Functionality
●	Navigation works.
●	Buttons work.
●	Forms validate.
●	API integrations work.
●	Existing business logic is preserved.
●	Error handling works.
Responsiveness
●	Mobile.
●	Tablet.
●	Laptop.
●	Desktop.
●	No horizontal overflow.
Accessibility
●	Keyboard support.
●	Focus states.
●	Contrast.
●	Labels.
●	Semantic structure.
Technical Quality
●	No major console errors.
●	No broken imports.
●	No broken links.
●	No missing assets.
●	No unnecessary dependencies.
●	No obvious performance regressions.
Run the project's existing lint, type-check, build, and test commands where available.
Report any tests that could not be executed.
15. PROJECT DOCUMENTATION
Save project-specific planning and design documents in:
text
docs/ui-ux/
Recommended structure:
text
docs/
└── ui-ux/
    ├── project-analysis.md
    ├── mvp-scope.md
    ├── ux-audit.md
    ├── design-directions.md
    ├── design-system.md
    ├── page-layouts.md
    ├── component-inventory.md
    ├── implementation-roadmap.md
    ├── testing-checklist.md
    ├── final-audit.md
    └── screenshots/
Create only relevant documents, preserve existing documentation, and update documents when approved decisions change.
16. FINAL DELIVERY
Provide:
1.	Completed MVP summary.
2.	Implemented pages.
3.	Completed functionality.
4.	Design system summary.
5.	Modified and created files.
6.	Testing results.
7.	Screenshot locations.
8.	Remaining bugs or limitations.
9.	Recommended future improvements.
Never claim unverified functionality or production readiness.
________________________________________
REUSABLE PROJECT CONFIGURATION
Use these optional details when starting a new project or redesign:
text
PROJECT NAME:
PROJECT TYPE:
TASK: Existing Website / New Website
TARGET AUDIENCE:
PRODUCT PURPOSE:
TECHNOLOGY STACK:
DESIGN PREFERENCES:
REFERENCE WEBSITES:
REQUIRED PAGES:
MVP FEATURES:
SPECIAL REQUIREMENTS:
If information is missing, analyze the project first and ask only for essential missing decisions.
MASTER EXECUTION RULE
Analyze first → Define MVP → Generate design directions → Get approval → Finalize design system → Plan implementation → Get complete plan approval → Implement → Verify → Refine → Final production audit.
Do not start implementation before approval of the complete analysis and design plan.


