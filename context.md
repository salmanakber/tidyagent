# AI Customer Service Employee for Wix — Project Context

**App name: tidyAgent**
**Backend/dashboard brand color: deep gradient of amber and deep navy**

## 1. Project Overview

We are building a **Wix App** called **tidyAgent** that provides an intelligent AI customer-service and sales employee for Wix websites.

This is **not just an FAQ chatbot**.

The AI should understand a Wix business, answer customer questions using verified business information, help customers make decisions, perform permitted actions through Wix APIs, handle support and complaints, generate leads, and escalate to humans when necessary.

The product goal is:

> Connect your Wix website → answer a few simple questions → the system understands your business → your AI employee is ready to help customers 24/7.

The business owner should not need to understand:

- RAG
- Embeddings
- Vector databases
- Prompts
- Agents
- Tool calling
- Complex conditional logic
- AI model configuration

The platform should automate these technical decisions wherever possible.

---

# 2. Current Scope

## IMPORTANT

The current product is **Wix-only**.

Do not implement Shopify, Webflow, WooCommerce, or other platform integrations at this stage.

The architecture should be clean and modular, but all current integration work should target Wix.

Future platform support can be added later.

---

# 3. Technology Stack

## Backend

- TypeScript
- Next.js
- Node.js runtime where required

## Database

- PostgreSQL
- Prisma ORM
- pgvector for semantic/vector search

## Frontend/Admin

- Next.js
- Responsive UI
- Desktop, tablet, and mobile support

## AI

Use an AI provider abstraction.

Possible initial providers:

- Google Gemini
- Groq

Potential future provider:

- OpenAI

Do not tightly couple application logic to one AI provider.

Use an abstraction similar to:

```
AIProvider (interface)
```

Possible implementations:

```
GeminiProvider
GroqProvider
OpenAIProvider
```

---

# 4. Core Architecture

```text
                         WIX
                          |
          +---------------+---------------+
          |               |               |
          v               v               v
       Install         Billing         Website
          |               |               |
          +---------------+---------------+
                          |
                          v
                 OUR NEXT.JS BACKEND
                          |
       +------------------+------------------+
       |                  |                  |
       v                  v                  v
   AI Agent         Knowledge Engine      Wix APIs
     Engine               |                  |
       |                  |                  |
       +------------------+------------------+
                          |
                          v
                    PostgreSQL
                       Prisma
                     + pgvector
```

Wix handles Wix-side platform functionality.

Our backend handles:

- AI
- Business understanding
- Knowledge
- RAG
- Agent orchestration
- Conversations
- Customer memory
- Business rules
- Tools
- Permissions
- Wix API interaction
- Analytics
- Usage
- Subscription entitlements

---

# 5. Wix Integration

Wix is the only external platform currently supported.

The integration should support the appropriate Wix capabilities required by the product, including where available:

- App installation
- Wix authentication/OAuth
- Site identification
- Website/content access
- Product data
- Cart functionality
- Orders
- Customer information
- Bookings/appointments
- Other relevant Wix APIs
- Wix app billing

Do not assume every Wix site has every capability.

The system must detect which capabilities are available.

### Dev environment note (added)

Wix currently offers two ways to build apps: the **Wix CLI** (JS SDK + REST, self-hosted/external backend — this is us) and **Blocks** (Velo, in-editor). Since this app runs its own Next.js + Postgres backend, scaffold with the **Wix CLI app framework**, not Blocks/Velo — Blocks is for in-editor widgets and isn't the right fit for an externally hosted service.

Prefer the **Wix JavaScript SDK** (`@wix/*` npm modules) over hand-rolled REST calls wherever a module exists (Stores, Bookings, CRM/Contacts) — it has simpler built-in auth handling than raw REST.

Wix publishes an `llms.txt` index of its developer docs specifically for AI coding assistants. Point the coding agent at it (or periodically re-fetch relevant pages) so generated code reflects current Wix API shapes rather than stale training data — Wix's APIs move faster than most platforms.

---

# 6. Wix Billing

## IMPORTANT

Do not initially build a separate Stripe subscription system.

For the Wix App Market version, Wix should handle the app subscription/billing relationship.

Wix is the **billing source of truth**.

Our backend maintains a local subscription/entitlement representation for application access and limits.

Conceptually:

```text
Wix Billing
     |
     v
Subscription status
     |
     v
Our Backend
     |
     v
Subscription / Entitlement Service
     |
     +-- Plan
     +-- Status
     +-- Limits
     +-- Features
```

Example database model:

```text
Subscription

id
organizationId
wixSubscriptionId
plan
status
trialEndsAt
currentPeriodEnd
createdAt
updatedAt
```

The exact Wix billing event/API implementation must follow current Wix documentation.

Our backend should use subscription state to control:

- AI access
- Conversation limits
- Knowledge limits
- Advanced tools
- Voice availability
- Automation features
- Usage limits

Never rely only on frontend subscription state.

All entitlement checks must happen server-side.

---

# 7. Multi-Tenant Architecture

Every Wix business/site is a separate tenant.

Conceptual hierarchy:

```text
User
  |
  v
Organization
  |
  +-- Wix Site
  +-- Subscription
  +-- Business Profile
  +-- Knowledge Base
  +-- AI Agent
  +-- Customers
  +-- Conversations
  +-- Business Rules
  +-- Tool Permissions
  +-- Analytics
```

Every tenant-owned record must be associated with the correct organization/site.

## Critical Security Requirement

Customer A must never access Customer B's:

- Knowledge
- Conversations
- Customers
- Products
- Orders
- Embeddings
- AI configuration
- Business rules
- Subscription data

Every query must be tenant-scoped.

Vector searches must also filter by organization/site before ranking results.

Never trust a tenant ID supplied by the browser without server-side authorization.

**Added:** don't just state this as a rule — write it as a test. Before this app touches a real customer, there should be an automated test that deliberately tries to retrieve Tenant A's knowledge/conversation data from a Tenant B session and asserts it fails. Treat this test as a release gate, not a nice-to-have.

---

# 8. Product Positioning

The product should be positioned as:

> **AI Customer Service Employee for Your Wix Website**

rather than simply:

> AI Chatbot

The AI should eventually provide:

- 24/7 customer support
- Sales assistance
- Product recommendations
- Service recommendations
- Lead generation
- Booking assistance
- Ecommerce assistance
- Order support
- Complaint handling
- Human handoff
- Voice support

---

# 9. Smart Onboarding

The owner should not manually configure a complicated AI agent.

The onboarding should be wizard-based.

Ideal flow:

```text
Install App
    |
    v
Connect / Authorize Wix Site
    |
    v
Analyze Website
    |
    v
Understand Business
    |
    v
Detect Capabilities
    |
    v
Ask a Few Questions
    |
    v
Automatically Configure AI Agent
    |
    v
Test Agent
    |
    v
Publish
```

The default setup should require minimal manual configuration.

---

# 10. Website Understanding

The system should understand the business rather than merely copy website text.

Analyze relevant Wix website content such as:

- Homepage
- About
- Products
- Services
- Pricing
- FAQ
- Contact
- Locations
- Opening hours
- Policies
- Shipping
- Returns
- Blog
- Booking pages
- Forms
- Calls to action

The system should identify:

- Business name
- Business type
- Industry
- Business model
- Products
- Services
- Pricing
- Locations
- Opening hours
- Policies
- Target customers
- Customer journey
- Sales opportunities
- Support requirements
- Available Wix capabilities

---

# 11. Website Crawling / Content Ingestion

Do not simply send raw website HTML to an LLM.

The ingestion pipeline should be:

```text
Wix Website / Wix APIs
        |
        v
Content Collection
        |
        v
Extraction
        |
        v
Cleaning
        |
        v
Deduplication
        |
        v
Business Understanding
        |
        +--> Structured Business Data
        |
        +--> Semantic Knowledge
        |
        v
Chunking
        |
        v
Embeddings
        |
        v
PostgreSQL + pgvector
```

Avoid indexing:

- CSS
- JavaScript
- Tracking scripts
- Duplicate navigation
- Duplicate footers
- Cookie banners
- Irrelevant markup

Where Wix APIs provide authoritative structured information, prefer API data over scraped text for live business facts.

---

# 12. Business Understanding Engine

The system should infer the concept of the business.

Example:

```text
Website
  |
  v
Business Analyzer
  |
  +-- Ecommerce
  +-- Fashion
  +-- Product catalog
  +-- Cart
  +-- Checkout
  +-- Customer accounts
  +-- Orders
  |
  v
Recommended AI Capabilities
```

Another example:

```text
Website
  |
  v
Cleaning Company
  |
  +-- Residential cleaning
  +-- Commercial cleaning
  +-- Service areas
  +-- Booking
  +-- Quote requests
  |
  v
Recommended AI Capabilities
```

The system should automatically recommend what the AI needs based on the detected business.

---

# 13. Knowledge Architecture

Use two complementary knowledge layers.

## A. Structured Business Knowledge

Use structured data for deterministic information:

- Business name
- Contact information
- Locations
- Hours
- Products
- Services
- Prices
- Policies
- Categories
- Other business facts

Example:

```json
{
  "business": {
    "name": "Example Business",
    "locations": [],
    "hours": {}
  },
  "products": [],
  "services": [],
  "policies": {}
}
```

## B. Semantic Knowledge

Store cleaned text chunks with metadata.

Each knowledge chunk should contain information similar to:

```text
id
organizationId
siteId
documentId
content
sourceUrl
title
contentType
metadata
embedding
createdAt
updatedAt
```

---

# 14. RAG

Do not train a separate AI model for each customer.

Use Retrieval-Augmented Generation.

Basic flow:

```text
Customer Question
       |
       v
Intent Detection
       |
       v
Knowledge Retrieval
       |
       v
Tenant Filtering
       |
       v
Evidence Ranking
       |
       v
Business Rules
       |
       v
AI Reasoning
       |
       v
Answer or Tool Action
```

---

# 15. Hallucination Prevention

This is one of the most important requirements.

The AI must not invent business-specific information.

Example:

If the website says:

> Deep cleaning starts at $150.

The AI may answer:

> Deep cleaning starts at $150.

But if a customer asks:

> Do you clean hospitals?

and there is no reliable information confirming this, the AI must not answer:

> Yes, we clean hospitals.

Instead it should respond with something similar to:

> I couldn't find information confirming that service. I can connect you with the team to confirm.

The system must prefer uncertainty over unsupported claims.

**Added:** turn this principle into a concrete eval set — a fixed list of ~20-30 adversarial questions with no supporting knowledge (e.g. "do you offer X you never mentioned", "what's your guarantee policy" when none exists) — and run it against every prompt/model change before shipping. A rule stated in a doc is not the same as a rule that's tested.

---

# 16. Business Information Authority

Use an authority hierarchy:

```text
1. Owner-verified information
2. Live Wix API data
3. Official structured business data
4. Official Wix website content
5. Official FAQ/policies
6. Conversation-derived information
7. General AI knowledge
```

Business-specific claims must prioritize higher-authority sources.

General AI knowledge must never be used to invent:

- Prices
- Policies
- Availability
- Services
- Discounts
- Guarantees
- Business rules

---

# 17. Evidence and Confidence

The retrieval system should evaluate evidence quality.

Conceptually:

```text
Strong evidence
    -> Answer directly

Moderate evidence
    -> Answer carefully / qualify

Weak evidence
    -> Ask clarification

No reliable evidence
    -> Do not guess
    -> Escalate when appropriate
```

Exact confidence thresholds should be determined through testing and evaluation.

Store useful evidence/retrieval information for debugging and quality evaluation.

---

# 18. AI Agent Builder

The system should automatically create an initial agent.

Example:

```text
Create Your AI Employee

We analyzed your website.

Business:
Online Fashion Store

Recommended capabilities:

✓ Customer support
✓ Product recommendations
✓ Product search
✓ Cart assistance
✓ Order support
✓ Returns support
✓ Lead generation
```

The owner may be asked:

> What would you like your AI employee to focus on?

Options:

- Customer support
- Sales
- Lead generation
- Product recommendations
- Bookings
- Everything recommended

The platform should recommend sensible defaults.

---

# 19. Agent Personality

Keep configuration simple.

Example options:

- Friendly
- Professional
- Casual
- Custom

The system should infer additional personality settings automatically.

The AI should support multiple customer languages where possible and preferably respond in the customer's language.

---

# 20. Automatically Generated Agent Configuration

The platform should automatically determine:

- Agent name
- Agent role
- Personality
- Tone
- Knowledge sources
- Tools
- Workflows
- Permissions
- Business rules
- Escalation behavior
- Goals

The owner can review and modify these later.

---

# 21. Business-Type Adaptation

Do not create a completely separate hardcoded AI system for every industry.

Use a common agent runtime with dynamically enabled capabilities.

Examples:

## Ecommerce

Recommended:

- Product search
- Product recommendations
- Product comparison
- Product questions
- Cart assistance
- Order tracking
- Returns support
- Lead capture
- Human escalation

## Cleaning Business

Recommended:

- Service discovery
- Service recommendations
- Service-area checking
- Quote requests
- Booking
- Lead capture
- FAQ
- Complaint handling
- Human escalation

## Clinic / Dentist

Recommended:

- Service information
- Location/hours
- Appointment booking
- FAQs
- Lead capture
- Human escalation

## Real Estate

Recommended:

- Property search
- Property recommendations
- Property comparison
- Viewing scheduling
- Lead qualification
- Human handoff

The system should infer these capabilities automatically.

**Added:** don't build the general capability-inference engine first. Pick **one vertical to prove end-to-end** before generalizing — ecommerce is the strongest candidate since Wix Stores has the richest, most stable API surface (product search, cart, orders). Hardcode the ecommerce capability set, get it working and evidence-based end-to-end, then generalize the pattern to other verticals. Building a business-type classifier before any vertical is fully proven is premature generalization.

---

# 22. Tool-Based AI

The AI must perform actions through explicit tools.

Examples:

```text
searchProducts()
getProduct()
compareProducts()
getCart()
addToCart()
removeFromCart()
getOrder()
getCustomer()
createLead()
createAppointment()
createSupportTicket()
notifyBusinessOwner()
handoffToHuman()
```

The AI must never directly manipulate the database or Wix APIs.

Tool execution must happen through a controlled backend layer.

---

# 23. Tool Execution Architecture

```text
AI Agent
   |
   v
Tool Request
   |
   v
Authentication
   |
   v
Tenant Check
   |
   v
Permission Check
   |
   v
Input Validation
   |
   v
Wix API
   |
   v
Validate Result
   |
   v
Audit Log
   |
   v
AI
```

---

# 24. Wix Capability Detection

Not every Wix website will support the same capabilities.

After connection, detect available capabilities.

Example:

```text
Connected Wix Site

✓ Website content
✓ Products
✓ Product search
✓ Cart
✓ Orders
✓ Customer data
✓ Bookings
```

The agent should only expose tools that are actually available and authorized.

---

# 25. Ecommerce AI Experience

For ecommerce sites, the AI should eventually be able to help customers complete shopping tasks.

Example:

Customer:

> I need a black shirt under $50 for a wedding.

AI:

```text
searchProducts()
```

AI recommends suitable products.

Customer:

> I like the second one.

AI:

```text
getProduct()
checkVariants()
checkAvailability()
```

Customer:

> Medium.

AI:

```text
addToCart()
```

AI:

> I've added the Medium black shirt to your cart.

Sensitive actions should require appropriate confirmation.

The AI should not silently place orders, issue refunds, change prices, or perform other high-impact actions without permission.

---

# 26. Customer Support

The AI should support customers 24/7.

Possible intents:

```text
Question
Product inquiry
Service inquiry
Order issue
Booking
Complaint
Refund request
Lead
Human request
```

The system should classify intent and route to the correct workflow.

---

# 27. Complaint Handling

Complaints require special handling.

Example:

```text
Customer:
I've been waiting three weeks and nobody is helping me.
```

System:

```text
Intent: Complaint
Sentiment: Negative
Priority: High
```

Workflow:

```text
Acknowledge
    |
Apologize appropriately
    |
Gather information
    |
Check live information if available
    |
Attempt permitted resolution
    |
Escalate if necessary
```

Never promise refunds, discounts, compensation, or policy exceptions without authorization.

---

# 28. Human Handoff

Human escalation is a core product capability.

Escalate when:

- AI cannot find reliable information
- Customer explicitly requests a human
- Complaint is serious
- Refund requires approval
- Customer requests a policy exception
- Required Wix capability is unavailable
- Tool/API fails
- Customer becomes highly frustrated
- Business rules require human intervention

Preserve relevant conversation context for the human.

---

# 29. Customer Memory

Separate memory into:

## Conversation Memory

Current conversation context.

## Customer Memory

Useful authorized information from previous interactions.

## Business Memory

Business information, policies, preferences, rules, and configuration.

Conceptually:

```text
Business Memory
      +
Customer Memory
      +
Current Conversation
      +
Live Wix Data
      +
Business Rules
      |
      v
AI Agent
```

Memory must be tenant-isolated.

Avoid storing unnecessary sensitive information.

---

# 30. AI Voice

Voice is a future capability.

Do not create a separate intelligence system for voice.

Use the same agent:

```text
             AI Agent
                |
        +-------+-------+
        |               |
        v               v
     Text Chat        Voice
```

Voice should reuse:

- Knowledge
- Customer memory
- Conversation context
- Tools
- Permissions
- Business rules
- Agent configuration

Potential voice components:

- Speech-to-text
- AI reasoning
- Tool execution
- Text-to-speech

Implement voice only after the core text agent is stable.

---

# 31. AI Improvement System

The platform should identify repeated unanswered questions.

Example:

Customers repeatedly ask:

> Do you deliver to my area?

The system detects that the business does not have clear knowledge about delivery areas.

The owner sees:

```text
AI Improvement Suggestion

Customers frequently ask about delivery areas.

We could not find clear information on your website.

[ Add Information ]
[ Ignore ]
```

Owner approval should be required for meaningful changes to business knowledge or policies.

---

# 32. Admin Dashboard

The backend panel must be responsive.

It must work well on:

- Desktop
- Tablet
- Mobile

Core navigation:

```text
Dashboard
Conversations
Customers
AI Agent
Knowledge
Automations
Business Rules
Analytics
Settings
Billing
```

Wix-specific settings should be contained inside the relevant integration/settings area.

---

# 33. Dashboard

Example:

```text
AI Employee
--------------------------------

Status: Active

Today

Conversations       128
Resolved by AI       94
Human escalations    12
Leads                18
Sales assisted       21

Top Questions

1. Shipping
2. Product sizing
3. Returns
4. Pricing
5. Availability

AI Health

Knowledge coverage: 94%
Unanswered questions: 8
Improvement suggestions: 3
```

Metrics are examples and should be implemented based on actual available data.

---

# 34. Knowledge Dashboard

The owner should see simple business-oriented information.

Example:

```text
Knowledge

Website
✓ 47 pages

Products
✓ 126 products

FAQs
✓ 18 FAQs

Policies
✓ 7 policies

Custom Knowledge
+ Add Knowledge

Last synced:
Today
```

Do not expose technical concepts such as:

- embeddings
- vector dimensions
- chunking strategy
- similarity scores

unless an advanced/debugging interface is intentionally added later.

---

# 35. Agent Dashboard

Example:

```text
Your AI Employee

Name:
Sarah

Role:
Customer Assistant

Status:
Active

Capabilities:

✓ Customer questions
✓ Product recommendations
✓ Cart assistance
✓ Order tracking
✓ Lead capture
✓ Support

Voice:
Off

[ Test AI ]
[ Edit Agent ]
[ Pause Agent ]
```

---

# 36. Business Rules

The platform should automatically create sensible default rules.

Examples:

```text
Never invent prices.
Never invent availability.
Never invent services.
Never promise unsupported outcomes.
Never make policy exceptions.
Ask before important actions.
Escalate complaints.
Escalate when reliable information is unavailable.
```

Advanced business owners can customize rules later.

Avoid forcing users to manually construct complex conditional logic.

---

# 37. AI Orchestration

Use a shared AI orchestrator.

Conceptually:

```text
                    Customer
                       |
                       v
                 AI Orchestrator
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
    Sales           Support         Shopping
       |               |               |
       v               v               v
    Tools           Tools           Tools
```

Additional workflows may include:

- Booking
- Lead qualification
- Complaint handling
- Order support
- Human handoff

Do not create unnecessary independent AI systems.

All workflows should share:

- Knowledge
- Customer context
- Conversation context
- Tools
- Permissions
- Business rules

---

# 38. AI Response Pipeline

The core response pipeline should conceptually be:

```text
Customer Message
       |
       v
Identify Wix Site / Tenant
       |
       v
Load Conversation Context
       |
       v
Detect Intent
       |
       v
Determine Required Capabilities
       |
       v
Retrieve Business Knowledge
       |
       v
Retrieve Customer Context
       |
       v
Load Business Rules
       |
       v
Determine Available Tools
       |
       v
AI Reasoning
       |
       +----> Tool Needed?
       |          |
       |          v
       |      Permission Check
       |          |
       |          v
       |      Execute Wix Tool
       |          |
       |          v
       |      Validate Result
       |
       v
Generate Response
       |
       v
Final Validation
       |
       v
Customer
```

---

# 39. Human-Like Behavior

The goal is not to blindly imitate a human.

The goal is to be:

- Helpful
- Natural
- Fast
- Consistent
- Context-aware
- Accurate
- Honest about uncertainty
- Action-capable
- Professional

The agent should ask appropriate follow-up questions.

It should not be unnecessarily verbose.

It should not pretend to know something it does not know.

---

# 40. Security Requirements

Required:

- Strong tenant isolation
- Server-side authorization
- Secure Wix authentication/OAuth
- Secure credential/token storage
- Encryption where appropriate
- No Wix access tokens exposed to the browser
- Input validation
- Rate limiting
- Abuse prevention
- Secure webhook verification
- Tool authorization
- Audit logging
- Secure environment variables
- Backend entitlement enforcement

Never trust frontend claims for:

- Organization
- Site
- Subscription
- Permissions
- Plan
- Tool access

---

# 41. Audit Logging

Important AI actions must be auditable.

Record information similar to:

```text
organizationId
siteId
agentId
customerId
conversationId
tool
action
input
result
permissionDecision
timestamp
```

Example:

```text
Agent:
Shopping Assistant

Tool:
addToCart

Product:
#482

Variant:
Medium

Result:
Success
```

Audit logs are important for:

- Debugging
- Security
- Customer support
- AI evaluation
- Trust
- Compliance

---

# 42. Background Jobs

Long-running tasks should not block normal API requests.

Examples:

- Website crawling
- Content extraction
- Knowledge processing
- Embedding generation
- Wix data synchronization
- Conversation analysis
- Analytics processing
- Knowledge-gap detection

Use a background queue/worker architecture.

Potential implementation:

```text
Redis
+
BullMQ
```

Conceptually:

```text
Next.js API
    |
    v
Queue
    |
    +-- crawlWebsite()
    +-- processKnowledge()
    +-- generateEmbeddings()
    +-- syncWixData()
    +-- analyzeConversations()
    +-- generateImprovementSuggestions()
```

---

# 43. AI Provider Abstraction

Business logic must not directly depend on a specific AI SDK.

Bad:

```ts
await openai.chat(...)
```

inside random application services.

Instead:

```ts
const ai = aiProviderFactory.getProvider(...);

await ai.generate(...);
```

The abstraction should allow:

- Provider switching
- Fallback providers
- Different models for different tasks
- Cost optimization
- Future provider support

**Added:** build the interface now, but don't build multi-model fallback/routing logic before launch. Wire it to one real provider, get real cost and latency numbers from production traffic, then build failover/routing against actual data. Early abstraction is good; early failover complexity is speculative.

---

# 44. AI Model Strategy

Do not use the most expensive model for every task.

Possible allocation:

```text
Small/cheap model:
- intent classification
- simple extraction
- basic classification

Embedding model:
- semantic search

Stronger model:
- complex customer conversations
- difficult reasoning
- tool decisions

Voice models:
- speech-to-text
- text-to-speech
```

Provider/model choices should be configurable.

---

# 45. Cost Management

Track:

- Input tokens
- Output tokens
- Embedding usage
- AI requests
- Tool calls
- Conversations
- Voice usage
- Tenant usage

Usage should be associated with the organization/site.

Subscription plans should control limits.

---

# 46. Subscription Entitlements

Wix handles payment/billing.

Our backend handles application entitlements.

Conceptually:

```text
Wix Subscription
       |
       v
Subscription Service
       |
       v
Organization Entitlements
       |
       +-- conversationLimit
       +-- knowledgeLimit
       +-- voiceEnabled
       +-- advancedToolsEnabled
       +-- automationEnabled
```

Backend checks must happen before protected operations.

---

# 47. Database Models

Initial database planning should include:

```text
User
Organization
OrganizationMember

WixSite
WixCredential

Subscription
Plan
UsageRecord

BusinessProfile

KnowledgeSource
KnowledgeDocument
KnowledgeChunk

Agent
AgentCapability
AgentRule
AgentToolPermission
AgentWorkflow

Customer
Conversation
Message
ConversationEvent

Tool
ToolExecution
HumanEscalation

Product
Order
Appointment

AnalyticsEvent
AuditLog
```

These are planning-level models.

Final Prisma schema design should consider:

- Normalization
- Relations
- Indexes
- Constraints
- Tenant isolation
- Wix API requirements
- Data lifecycle
- Soft deletion where appropriate

---

# 48. Suggested Project Structure

Use domain-oriented modules.

Example:

```text
src/
  app/
    api/

  modules/
    auth/
    organizations/
    wix/
    knowledge/
    ai/
    agents/
    conversations/
    customers/
    tools/
    workflows/
    business-rules/
    analytics/
    billing/

  services/
    ai/
    embeddings/
    retrieval/
    crawling/
    wix/
    agents/
    memory/
    permissions/

  lib/
    prisma/
    redis/
    security/
```

The exact structure may change during implementation.

Avoid giant API route files containing all business logic.

---

# 49. API Domains

Suggested API domains:

```text
/api/auth
/api/organizations
/api/wix
/api/knowledge
/api/ai
/api/agents
/api/conversations
/api/customers
/api/tools
/api/workflows
/api/business-rules
/api/analytics
/api/billing
```

Exact endpoint names should be finalized during implementation.

---

# 50. Development Phases

## Phase 1 — Wix Foundation

Build:

- Wix app
- Wix authentication
- Wix installation flow
- External Next.js backend
- PostgreSQL
- Prisma
- Responsive admin dashboard
- Wix site identification
- Basic subscription state

## Phase 2 — Website Intelligence

Build:

- Website/content ingestion
- Content extraction
- Business analyzer
- Structured business profile
- Knowledge documents
- Knowledge chunks
- pgvector
- Embeddings

## Phase 3 — AI Agent

Build:

- AI provider abstraction
- RAG
- Evidence-based responses
- Confidence handling
- Basic AI agent
- Chat interface
- Conversation storage

## Phase 4 — Smart Onboarding

Build:

- Business detection
- Capability detection
- Wizard
- Automatic agent configuration
- Agent preview/test
- Publish flow

## Phase 5 — Wix Actions

Build:

- Product search
- Product details
- Cart actions
- Order lookup
- Lead capture
- Appointment/booking workflows where supported
- Tool permissions
- Human escalation

## Phase 6 — Intelligence

Build:

- Customer memory
- Business rules
- Conversation analytics
- Knowledge-gap detection
- AI improvement recommendations

## Phase 7 — Advanced Features

Build:

- Voice
- More advanced orchestration
- Advanced automation
- More autonomous assistance

---

# 51. MVP Priorities

The first usable product should NOT attempt to build the entire vision.

The first meaningful MVP should prove:

1. Wix installation works.
2. Wix site is securely identified.
3. Website/business information can be ingested.
4. Knowledge is stored correctly.
5. RAG retrieves correct information.
6. AI answers customer questions accurately.
7. AI refuses to invent unsupported business facts.
8. Owner can configure/publish the agent through a simple wizard.
9. Customer can chat with the agent.
10. Conversations are stored.
11. Human escalation works.
12. Subscription entitlements work.
13. Tenant isolation is secure.

Only after this foundation is stable should advanced actions and autonomous behavior be added.

### Recommended tighter breakdown of Phase 1 (added)

Even within Phase 1, sequence it further before writing any AI code:

1. Wix CLI app scaffold + OAuth install flow working on a real test site — nothing else.
2. One Wix site's identity synced into Postgres via Prisma; dashboard shows "Connected" with real site data.
3. Only once install/auth/tenant-provisioning is solid, start Phase 2 ingestion.

This validates the highest-risk, hardest-to-debug-later part (Wix auth, webhooks, tenant creation) before any AI spend or complexity is added on top of it.

---

# 52. Non-Negotiable Architecture Rules

1. Wix-only for the current implementation.
2. Backend uses TypeScript + Next.js.
3. Database uses PostgreSQL + Prisma.
4. pgvector is used for semantic knowledge retrieval.
5. Wix handles app billing/subscription payments.
6. Backend maintains subscription entitlements and usage.
7. Every Wix site is tenant-isolated.
8. Never trust frontend tenant IDs.
9. Never trust frontend subscription state.
10. AI must not invent business information.
11. Business-specific answers must be evidence-based.
12. Live Wix API data should be preferred for live information.
13. AI actions must use explicit tools.
14. Tools require server-side permission checks.
15. Sensitive actions require confirmation or appropriate approval.
16. Human escalation is a first-class capability.
17. Owners should not need to build complex conditional workflows manually.
18. Website analysis should automatically recommend AI capabilities.
19. Agent configuration should adapt to the detected business.
20. Admin panel must be responsive.
21. AI providers must be abstracted.
22. Long-running work must use background jobs.
23. Important AI actions must be audited.
24. Voice must reuse the same core AI agent.
25. Secrets and Wix credentials must never be exposed to the browser.
26. Server-side authorization is mandatory.
27. Every database query must respect tenant boundaries.
28. Vector retrieval must be tenant-scoped.
29. AI-generated actions must pass through backend validation.
30. Correctness is more important than sounding confident.
31. **(Added)** Build with the Wix CLI app framework + JS SDK — not Blocks/Velo — since this app runs an external Next.js/Postgres backend.
32. **(Added)** Tenant isolation and hallucination-prevention must each have an automated test suite, not just a documented principle, before any real customer data is handled.
33. **(Added)** Prove the agent end-to-end on one vertical (recommended: ecommerce, via Wix Stores) before building the general business-type capability inference engine.

---

# 53. Final Product Mental Model

```text
                    WIX WEBSITE
                         |
                         v
                    INSTALL APP
                         |
                         v
                AI ANALYZES BUSINESS
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
      Business        Products       Customer
      Model           Services       Journey
          |              |              |
          +--------------+--------------+
                         |
                         v
                AI CONFIGURATOR
                         |
                         v
                  AI EMPLOYEE
                         |
       +-----------------+------------------+
       |                 |                  |
       v                 v                  v
   Knowledge           Tools            Workflows
       |                 |                  |
       v                 v                  v
    Answers          Actions            Automation
       |                 |                  |
       +-----------------+------------------+
                         |
                         v
                  HUMAN ESCALATION
                         |
                         v
                   BUSINESS OWNER
```

## Product Promise

> **Connect your Wix website. Answer a few simple questions. Your AI employee understands your business and starts helping your customers 24/7.**

The AI should continuously become more useful through authorized business data, customer conversations, live Wix data, and owner-approved improvements, while never silently inventing business facts or performing unauthorized actions.

---

# 54. Coding Agent Notes — How To Work Through This Doc

This section is for the coding agent itself, not the product.

- **Don't build sections in document order.** This doc is a reference/spec, not a build sequence. Follow Section 50/51 phases, and within Phase 1, follow the tighter breakdown in Section 51.
- **Treat Sections 15 and 40 (hallucination prevention, security) as test requirements, not prose.** Write the adversarial eval set and the tenant-isolation test before declaring either "done."
- **Use the Wix CLI + JS SDK**, not Velo/Blocks — this is an externally hosted app (see Section 5 note and Rule 31).
- **Reference Wix's current API docs/llms.txt when generating Wix integration code** — Wix APIs change faster than most platforms, and training data on Wix specifics should not be trusted as current.
- **Build one vertical (ecommerce) fully before generalizing** the business-type capability engine (Section 21, Rule 33).
- **Keep the AI provider abstraction simple at first** — real interface, single real provider, no speculative fallback/routing logic until production data exists (Section 43 note).
- When in doubt about scope for a given week of work, default to the narrowest thing that moves the MVP checklist (Section 51) forward — not the most complete section of this document.

---

# 55. Customer-Facing Chat Widget

Everything above describes the backend agent, knowledge, and admin dashboard. None of it describes the actual thing a website visitor sees and talks to — the **chat widget embedded on the owner's live Wix site**. This is a distinct piece of the product with its own requirements.

## 55.1 Embedding

The owner needs a simple, no-code way to put the widget on their site. Support this as an explicit choice at the end of onboarding, not a hidden default:

```text
Add tidyAgent to your site

○ Auto-install (recommended)
   Adds the widget automatically to every page on install.
   No manual setup required.

○ Manual placement
   Drag the tidyAgent widget element anywhere in the
   Wix Editor / Wix Studio yourself (Blocks widget),
   for owners who want it in a specific spot only.
```

- **Auto-install** — the app injects the widget site-wide on install (standard for Wix chat/support apps), zero owner effort. This should be the default path in the onboarding wizard.
- **Manual placement** — expose the widget as a Wix Blocks element the owner can drag onto specific pages (e.g. only on a booking page, not the blog). Needed for owners who don't want it everywhere.
- Either path, the widget must lazy-load and must not block the host site's page load — treat this as a hard performance requirement, not a nice-to-have, since a slow widget reflects badly on the business owner's whole site.

## 55.2 Branding & color customization

This must be a first-class settings screen, not a buried option — the widget represents the owner's business, so it has to look like *their* brand, not ours.

```text
Customize your AI Employee's look

Widget color
[ Color picker ]        ● Preset: tidyAgent Amber/Navy
                         ● Preset: Match my site
                         ● Custom

Widget avatar
[ Upload image ]  or  [ Use business initial ]

Chat bubble position
( ) Bottom right   ( ) Bottom left

Greeting message
[ "Hi! How can I help you today?" ]

Agent display name
[ Sarah ]   (defaults to the agent name set in onboarding)
```

Minimum required customization:

- **Primary color** — freeform color picker, not just presets, since businesses have exact brand colors
- **"Match my site" option** — auto-detect the site's dominant color/theme from Wix site data where possible, as a one-click default before the owner fine-tunes manually
- **Avatar/logo** — image upload, falls back to a generated initial-based avatar
- **Position** — bottom-left/bottom-right at minimum
- **Greeting text and agent display name** — both editable, both already exist as concepts elsewhere in this doc (Section 18–20) and must flow through to the widget, not just the backend chat interface

Store these as part of the `Agent` model (Section 47) — e.g. `widgetPrimaryColor`, `widgetAvatarUrl`, `widgetPosition`, `widgetGreeting` — scoped per organization/site like everything else.

**tidyAgent's own dashboard** (the admin side the owner logs into) uses tidyAgent's brand identity — a deep gradient of amber and deep navy — but this is strictly separate from the **widget's** branding, which must be fully owner-customizable and should never default to forcing tidyAgent's own colors onto a customer's live site. Amber/navy is our brand, not a constraint on theirs.

## 55.3 Real-time behavior

- WebSocket connection (or equivalent) for live message delivery — polling as a fallback only, not primary
- Typing indicators when the AI is generating a response
- Reconnect handling if the visitor's connection drops mid-conversation
- Message delivery should feel instant for cached/simple answers, with a visible "thinking" state for anything requiring a tool call (e.g. checking order status) so the wait is never silent

## 55.4 Session & state handling

- Anonymous visitor gets a session-scoped `Conversation` immediately, no login required to start chatting
- If the visitor identifies themselves (order lookup, becomes a lead, logs in as a Wix site member), link the session to a `Customer` record (Section 29's Customer Memory)
- Conversation should persist across a page reload / navigating between pages on the same site visit, not reset each time
- Widget UI has at least two states: collapsed bubble and open panel; consider a proactive-open trigger (e.g. after N seconds on a pricing page) as a later enhancement, off by default

## 55.5 Tenant isolation (client side)

Section 7's tenant isolation rule has a client-side half: the widget script embedded on Business A's site must only ever be able to read/write Business A's `organizationId`/`siteId` — this should be baked into the widget's init token at embed time (signed, scoped to one site), never inferred from anything the browser sends afterward.

## 55.6 Non-Negotiable Rules (Widget)

34. **(Added)** The widget must be lazy-loaded and must never materially slow down the host site's page load.
35. **(Added)** Widget branding (color, avatar, position, greeting) must be fully owner-customizable per site — never hardcoded to tidyAgent's own brand colors.
36. **(Added)** Every widget instance is bound to exactly one site/organization via a scoped, signed init token — never a client-trusted ID.