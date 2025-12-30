# Import Export Trade Assistant - Production Rebuild

## Critical Issues Identified

### Workflow Continuity (PRIORITY 1)
- [x] Create unified Shipment entity that connects HTS → Tariff → Docs → Compliance
- [x] Implement workflow state machine (Draft → Calculating → Documenting → Reviewing → Complete)
- [x] Add "Start Workflow" button that creates shipment from HTS results
- [x] Shipment workflow connects HTS → Tariff → Docs → Compliance
- [ ] Show workflow progress indicator across all pages (future enhancement)

### Tariff Calculator Enhancement (PRIORITY 1)
- [x] Add Incoterms selection (FOB, CIF, DDP, etc.) - backend
- [x] Add quantity and weight fields - backend
- [x] Show duty breakdown: MFN rate, preferential rate, additional duties - backend
- [x] Display applicable trade agreements (USMCA, GSP, FTA) - backend
- [x] Show exclusion status and expiration dates - backend
- [x] Add insurance and freight cost fields - backend
- [x] Calculate landed cost with all fees - backend
- [x] Update frontend to display all new fields (Tariff Calculator rebuilt)

### Audit Trail & Memory (PRIORITY 1)
- [x] Create shipments table with full history
- [x] Save calculations to shipment.lastCalculation field
- [x] Backend API for recent shipments
- [x] User overrides tracked in shipment.userOverrides
- [x] Show "Recent Shipments" on home page
- [ ] Export audit trail to PDF/CSV (future)
- [ ] Show "Last updated" timestamps on all AI data (frontend)

### Explainability (PRIORITY 2)
- [x] Show AI reasoning for every HTS code recommendation - backend
- [x] Display alternative HTS codes with pros/cons - backend
- [x] Explain tariff rate sources (MFN, FTA, Section 301) - backend
- [x] Show regulation citation sources - backend
- [x] Add rationale field to all AI responses - backend
- [x] Display confidence scores for AI recommendations - backend
- [x] Update frontend to show explainability UI (HTS Search and Tariff Calculator)

### Semantic Color Coding (PRIORITY 2)
- [ ] Red = High risk (restricted items, high duties, missing docs)
- [ ] Yellow = Conditional (requires license, preferential rate available)
- [ ] Green = Low risk (compliant, low duties, docs complete)
- [ ] Apply color coding to HTS results, tariff rates, compliance status
- [ ] Add risk score (0-100) to every shipment

### Document Management Fixes (PRIORITY 2)
- [ ] Fix S3 upload functionality
- [ ] Auto-generate document checklist from HTS + country
- [ ] Link documents to specific shipments
- [ ] Add document status tracking (Missing → Uploaded → Verified)
- [ ] Generate document templates with pre-filled data
- [ ] Add document expiration tracking

### Empty State Improvements (PRIORITY 3)
- [ ] Show example scenarios on calculator empty state
- [ ] Display recent calculations with quick-load
- [ ] Show regulatory alerts for recently used HTS codes
- [ ] Add "Popular HTS Codes" on search empty state
- [ ] Show compliance tips and best practices

### Data Authority Features (PRIORITY 3)
- [ ] Add data source citations (CBP, USTR, WTO)
- [ ] Show effective dates for all rates
- [ ] Display historical rate changes
- [ ] Add "Report Incorrect Data" button
- [ ] Show last AI model update timestamp
- [ ] Add disclaimer text for legal compliance

## Database Schema Changes Needed
- [x] Create shipments table with workflow state and user inputs
- [x] Create documents table linked to shipments
- [x] Create chatMessages table for AI assistant history
- [x] Create alerts table for user notifications
- [x] Simplified schema - only user-generated content stored locally

## UI/UX Improvements
- [ ] Add workflow progress bar component
- [ ] Create risk badge component (red/yellow/green)
- [ ] Add "Explain" button component for AI outputs
- [ ] Create shipment dashboard showing all active shipments
- [ ] Add quick actions: "New Shipment", "Continue Shipment", "View History"
- [ ] Implement breadcrumb navigation showing workflow position

## Testing Requirements
- [ ] Test complete workflow: HTS search → Tariff calc → Doc generation → Compliance check
- [ ] Test audit trail: verify all actions are logged
- [ ] Test explainability: verify AI shows reasoning
- [ ] Test memory: verify saved shipments persist and reload correctly
- [ ] Test risk scoring: verify color coding matches risk levels

## Previously Completed
- [x] HTS code search with AI-powered real-time lookup
- [x] Basic tariff calculator with AI rates
- [x] Trade regulations with AI lookup
- [x] Document upload UI (needs S3 fix)
- [x] Checklist generator (needs workflow integration)
- [x] AI chatbot for trade questions
- [x] Currency converter
- [x] Shipping estimator
- [x] Alert system
- [x] International Typographic Style design
- [x] SEO optimization
