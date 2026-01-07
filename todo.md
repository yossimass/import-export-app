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
