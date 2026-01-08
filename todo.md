# CochitoCorp iTCP - TODO

## ✅ COMPLETED (1/7/2026)

### Tariff Calculator ✅ FIXED
- [x] Fix tariff calculator - now returns proper results with real duty rates
- [x] Make it work for ALL countries (dropdown supports 200+ countries)
- [x] Replace country text inputs with dropdown lists
- [x] Add comprehensive country list with ISO codes (shared/countries.ts)
- [x] Improved AI prompt with explicit JSON structure and examples
- [x] Tested: China→USA, HTS 6109.10.0012 returns 16.5% + $2,500 Section 301 = $15,300.90 landed cost

### Regulations & Checklists ✅ IMPROVED
- [x] Update AI prompts with explicit JSON structures
- [x] Add detailed field definitions and examples
- [x] Regulations now returns 5-10 relevant items with authority, risk level, penalties
- [x] Checklists now returns 8-15 actionable items with deadlines and consequences

### CochitoCorp iTCP Branding ✅ COMPLETE
- [x] Generate robot dolphin logo (cochitocorp-logo.png)
- [x] Update navigation bar with logo and "CochitoCorp iTCP" text
- [x] Update homepage hero with branding
- [x] Change tagline to "Intelligent Trade Compliance"

### Workflow Progress Indicators ✅ IMPLEMENTED
- [x] Create WorkflowStepper component with visual progress tracking
- [x] Add stepper to HTS Search (Step 1)
- [x] Add stepper to Tariff Calculator (Step 2)
- [x] Add stepper to Documents (Step 3)
- [x] Add stepper to Checklists (Step 4)
- [x] Show completed steps with checkmarks
- [x] Highlight current step
- [x] Gray out upcoming steps

### Core Features Working
- [x] HTS Code Search - AI-powered with risk assessment
- [x] Tariff Calculator - Real duty rates with Section 301 tariffs
- [x] AI Chat Assistant - Comprehensive trade compliance guidance
- [x] Documents - S3 storage with shipment linking
- [x] Regulations - Country-specific requirements (improved prompts)
- [x] Checklists - Actionable compliance items (improved prompts)
- [x] Utilities - HTS lookup, HS code converter, duty estimator
- [x] Alerts - Real-time notifications

## 🔄 WORKFLOW

**Step 1: HTS Code Search** → Find the right classification code
**Step 2: Tariff Calculator** → Calculate duties and landed costs
**Step 3: Documents** → Upload and manage trade documents
**Step 4: Compliance** → Generate and complete checklists

Progress is visually tracked with the workflow stepper on each page.

## 📋 FUTURE ENHANCEMENTS

### Export & Reporting
- [ ] PDF export for tariff calculations
- [ ] PDF export for compliance checklists
- [ ] CSV export for HTS search results
- [ ] Batch operations for multiple products

### Workflow Improvements
- [ ] Save workflow state to database
- [ ] Resume workflow from any step
- [ ] Workflow history and audit trail
- [ ] Risk level indicators (red/yellow/green) throughout UI

### Data & Analytics
- [ ] Dashboard with shipment analytics
- [ ] Cost trends and duty rate history
- [ ] Compliance score tracking
- [ ] Automated alerts for regulation changes

## 🎨 DESIGN NOTES

- **Style**: International Typographic Style (Swiss Design)
- **Colors**: Red primary (#DC2626), black text, white background
- **Typography**: System fonts, bold headings, clean hierarchy
- **Layout**: Grid-based, asymmetric, high contrast
- **Branding**: CochitoCorp iTCP with robot dolphin logo


## 🚨 NEW REQUIREMENT: Workflow Persistence (1/7/2026)

### Workflow Save/Resume Functionality
- [ ] Update shipments table to store workflow state (current step, form data)
- [ ] Create workflow save API endpoint
- [ ] Create workflow load API endpoint
- [ ] Implement auto-save on HTS Search page
- [ ] Implement auto-save on Tariff Calculator page
- [ ] Implement auto-save on Documents page
- [ ] Implement auto-save on Checklists page
- [ ] Add "Resume Workflow" buttons on homepage for saved shipments
- [ ] Show workflow progress percentage on shipment cards
- [ ] Test: Navigate away and resume from saved state
- [ ] Test: Multiple workflows can be saved simultaneously


## 🚨 CRITICAL ISSUES TO FIX NOW

### Workflow Navigation Broken
- [ ] Add "Save & Continue to Tariff Calculator" button on HTS Search results
- [ ] Add "Save & Continue to Documents" button on Tariff Calculator results
- [ ] Add "Save & Continue to Compliance" button on Documents page
- [ ] Add "Save & Complete" button on Checklists page
- [ ] Each button should save current state and navigate to next step
- [ ] Show visual feedback when saving

### Regulations ✅ FIXED (1/7/2026)
- [x] Test regulations page - verified it returns actual data
- [x] Fixed frontend to match backend array format
- [x] Now displays 9 detailed regulations with risk badges, requirements, documents
- [x] Tested: United States returns FDA, CBP, OFAC, CITES, etc.


## ✅ WORKFLOW PERSISTENCE COMPLETE (1/7/2026)

### My Shipments Page
- [x] Create "My Shipments" page showing all saved workflows
- [x] Add navigation link to My Shipments in main menu
- [x] Display shipment cards with: HTS code, countries, status, progress, date
- [x] Add "Resume" button on each shipment card
- [x] Add "Delete" button on each shipment card
- [x] Tested: Shows 9 shipments in grid layout with all details

### Context Inheritance Working
- [x] Fix Documents page to accept and load shipmentId from URL
- [x] Fix Checklists page to accept and load shipmentId from URL
- [x] Update "Continue" buttons to pass shipmentId in URL
- [x] Auto-load shipment data when shipmentId is in URL
- [x] Fixed URL parsing to use window.location.search instead of wouter location
- [x] Tested complete flow: My Shipments → Resume → Documents → Checklists
- [x] Verified: HTS code 4201.00.3000, ARG→USA auto-fills on Checklists page


## 📥 NEW FEATURE: Export Functionality (1/7/2026)

### Tariff Calculator Exports ✅ COMPLETE
- [x] Add PDF export button for tariff calculation results
- [x] Add CSV export button for tariff calculation results
- [x] PDF includes: HTS code, countries, all duty breakdowns, cost summary, calculation date
- [x] CSV includes: all numerical data in spreadsheet format
- [x] Tested: Both exports working with success toast notifications

### Compliance Checklist Exports ✅ COMPLETE
- [x] Add PDF export button for generated checklists
- [x] PDF includes: checklist items, requirements, deadlines, consequences
- [x] Format as printable checklist with checkboxes
- [x] Tested: 12-item checklist exported successfully for China→USA cotton t-shirts

### Regulations Export ✅ COMPLETE
- [x] Add PDF export button for regulations search results
- [x] PDF includes: all regulations with descriptions, requirements, documents, risk levels
- [x] Format as comprehensive regulations summary document
- [x] Export button added to Regulations page


## 🚨 CRITICAL ISSUES REPORTED (1/7/2026)

### Checklist PDF Export Broken
- [x] Fix checklist PDF export - now shows all items with descriptions, deadlines, consequences
- [x] Updated exportChecklistPDF to match actual data structure (task, description, priority, etc.)
- [x] Detailed format with checkboxes, metadata, and risk warnings

### Checklist Persistence Issues
- [x] Save generated checklists to database - added complianceChecklist JSON field to shipments
- [x] Store checklist items as JSON in shipments.complianceChecklist
- [x] Add checklist.get endpoint to load saved checklists
- [x] Add checklist.toggleItem mutation to save completion state
- [x] Update shipment workflowStep to 4 when checklist is generated
- [ ] Update frontend to load saved checklist on page load
- [ ] Wire up checkbox onChange to call toggleItem mutation
- [ ] Test: Generate checklist, refresh page, verify it persists

### Missing Export All Functionality
- [ ] Add "Export All" button to shipment pages
- [ ] Create combined PDF with: tariff calculation + checklist + regulations
- [ ] Include shipment summary header with HTS code, countries, date
- [ ] Format as comprehensive compliance package

### Mobile Responsive Design Broken
- [ ] Fix navigation menu visibility on mobile devices
- [ ] Add hamburger menu for mobile navigation
- [ ] Fix viewport meta tag if missing
- [ ] Test responsive breakpoints (mobile, tablet, desktop)
- [ ] Ensure all forms and buttons are accessible on mobile
- [ ] Fix workflow stepper display on mobile


## 🚨 MOBILE RESPONSIVE ISSUES (1/7/2026)

### Navigation Menu Not Visible on Mobile
- [x] Add hamburger menu icon for mobile screens (Menu/X icons from lucide-react)
- [x] Create mobile menu drawer/dropdown with full navigation
- [x] Hide desktop navigation links on small screens (hidden lg:flex)
- [x] Show hamburger menu on screens < 1024px (lg:hidden)
- [x] Implemented menu open/close functionality with useState

### Homepage Layout Broken on Mobile
- [x] Remove overlapping decorative boxes on mobile (hidden lg:block)
- [x] Fix text wrapping with responsive font sizes (text-3xl sm:text-4xl lg:text-5xl)
- [x] Reduce size of decorative boxes on desktop (w-48 xl:w-64)
- [x] Make feature cards stack vertically on mobile (grid sm:grid-cols-2 lg:grid-cols-3)
- [x] Responsive padding throughout (p-4 sm:p-6 md:p-8, py-8 sm:py-12 md:py-20)

### Viewport and Scaling Issues
- [x] Viewport meta tag already present (width=device-width, initial-scale=1.0)
- [x] Container widths are responsive (using Tailwind container class)
- [ ] Test all pages on mobile viewport (375px, 414px) - needs user testing
- [x] Touch targets sized appropriately (buttons use size="sm" with adequate padding)
- [x] No horizontal scrolling (decorative elements hidden on mobile)
