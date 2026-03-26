# EasyHeals Profile Pages Redesign — Design Document

> **Scope:** Hospital listing + detail, Doctor listing + detail, Treatment listing + detail  
> **Theme:** White-based (matching homepage), optimistic health vibes  
> **Date:** 2026-03-21  

---

## 1. Current State Analysis

### 1.1 What Exists

| Page | Component | CSS | Theme |
|------|-----------|-----|-------|
| `/hospitals` | [DirectorySearchList](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/DirectorySearchList.tsx#27-94) (shared) | [profiles.module.css](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/profiles.module.css) | **Dark** (#030a16 bg) |
| `/hospitals/[slug]` | [HospitalProfileClient](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/HospitalProfileClient.tsx#109-488) | [profiles.module.css](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/profiles.module.css) | **Dark** |
| `/doctors` | [DirectorySearchList](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/DirectorySearchList.tsx#27-94) (shared) | [profiles.module.css](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/profiles.module.css) | **Dark** |
| `/doctors/[slug]` | [DoctorProfileClient](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/DoctorProfileClient.tsx#89-379) | [profiles.module.css](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/profiles.module.css) | **Dark** |
| `/treatments` | [TreatmentsClient](file:///c:/Biswajit/Codex/easyheals-next/src/app/treatments/TreatmentsClient.tsx#16-112) | **Inline styles** | **Dark** |
| `/treatments/[slug]` | [TreatmentProfileClient](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/TreatmentProfileClient.tsx#59-250) | [profiles.module.css](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/profiles.module.css) | **Dark** |

### 1.2 Critical Gaps

> [!WARNING]
> **Theme mismatch:** All profile pages use a dark sci-fi theme (`#030a16` background, `#4dffd8` accents) while the homepage is now white-based (`#F8FAF9`, `#1B8A4A`). This breaks visual consistency.

| Area | Gap | Impact |
|------|-----|--------|
| **Visual consistency** | Dark theme on profiles vs white homepage | Users feel like different websites |
| **Information density** | Large padding, sparse cards | Wasted screen space; users scroll too much |
| **Mobile readiness** | Limited responsive design, no bottom sheet patterns | Poor mobile UX, not ready for React Native parity |
| **SEO structure** | Missing semantic HTML landmarks, no FAQ section on listings | Lower search rankings |
| **Multilingual** | Translation keys exist but UI labels are hardcoded | Breaks i18n for new languages (Kannada, Telugu, etc.) |
| **Accessibility** | No ARIA landmarks beyond `role="tablist"` | Screen reader experience is poor |
| **Scalability** | [TreatmentsClient](file:///c:/Biswajit/Codex/easyheals-next/src/app/treatments/TreatmentsClient.tsx#16-112) uses 100% inline styles | Impossible to maintain or theme |
| **Search within pages** | Only basic text filter on listings | No specialty filter, no rating sort, no pagination |
| **Performance** | Hospital listing loads 1000 items at once | DOM bloat, slow initial paint |

---

## 2. Design Principles

1. **White-first** — Match homepage palette: `#FFFFFF` base, `#F8FAF9` sections, `#1B8A4A` primary, `#E6F5EC` accent fills  
2. **Dense but readable** — Reduce whitespace 30-40%, use compact card layouts, maximize info per viewport  
3. **Mobile-first** — Design for 375px viewport first; desktop is a graceful expansion  
4. **Component parity** — Every UI pattern must map 1:1 to a future React Native component  
5. **Multilingual-native** — All visible text via [t()](file:///c:/Biswajit/Codex/easyheals-next/src/i18n/translations.ts#16-224), RTL-ready layout with `gap` (no margin-left)  
6. **SEO-rich** — Semantic HTML5 (`<article>`, `<aside>`, `<nav>`), breadcrumbs, FAQ schema  

---

## 3. Shared Design System

### 3.1 Color Tokens (matching Homepage)

```css
--bg-page:        #FFFFFF;
--bg-section:     #F8FAF9;
--bg-card:        #FFFFFF;
--border-light:   #D0E4D8;
--border-hover:   #1B8A4A;
--text-primary:   #1A2B23;
--text-secondary: #5A7367;
--text-muted:     #8FA39A;
--accent:         #1B8A4A;
--accent-soft:    #E6F5EC;
--accent-hover:   #136836;
--rating-star:    #F59E0B;
--verified-bg:    #E6F5EC;
--verified-text:  #1B8A4A;
--cta-danger:     #E8401C;
```

### 3.2 Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page title (h1) | `--font-serif` | `clamp(28px, 4vw, 44px)` | 400 |
| Section title (h2) | `--font-bricolage` | `20px` | 700 |
| Card title (h3/h4) | `--font-bricolage` | `16px` | 700 |
| Body text | `--font-sans` | `14px` | 400 |
| Label/caption | `--font-bricolage` | `11px` | 700 |
| Tag/badge | `--font-sans` | `11px` | 500 |

### 3.3 Spacing Scale

```
4px → 8px → 12px → 16px → 20px → 24px → 32px → 48px
```

### 3.4 Card Pattern (Reusable)

```
┌─────────────────────────────────┐
│ [Icon/Avatar]  Name        [★]  │
│               Subtitle    4.8   │
│ [Tag] [Tag] [Tag]               │
│                                 │
│ Key info row (fee, exp, city)   │
│ ─────────────────────────────── │
│ [View Profile]    [Book / Call] │
└─────────────────────────────────┘

border-radius: 16px
border: 1.5px solid var(--border-light)
padding: 14px
hover: translateY(-2px) + shadow
```

---

## 4. Page-by-Page Redesign

### 4.1 Hospital Listing (`/hospitals`)

```
┌─────────────────────────────────────────────────────────┐
│ [SiteNav - white]                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  HOSPITAL DIRECTORY                                     │
│  Find verified hospitals near you                       │
│                                                         │
│  [🔍 Search hospitals...    ] [📍 City ▼] [⭐ Sort ▼]  │
│                                                         │
│  Filter: [All] [Cardiology] [Ortho] [Neuro] [Onco] ... │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ 🏥 Fortis Mumbai │  │ 🏥 Apollo Pune   │            │
│  │ Mumbai, MH       │  │ Pune, MH         │            │
│  │ [Cardio] [Ortho] │  │ [Neuro] [Onco]   │            │
│  │ ★4.8 · 1.8k rev  │  │ ★4.7 · 1.2k rev  │            │
│  │ ──────────────── │  │ ──────────────── │            │
│  │ [View]  [Book]   │  │ [View]  [Book]   │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │ ...              │  │ ...              │            │
│  └──────────────────┘  └──────────────────┘            │
│                                                         │
│  [Show more ↓]  Showing 20 of 1,234                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ FAQ Section (SEO)                                       │
│ Footer                                                  │
└─────────────────────────────────────────────────────────┘
```

**Key improvements:**
- **Sort dropdown** — Rating (high→low), Name (A→Z), Reviews (most), Newest
- **Specialty filter pills** — Horizontal scroll, counts shown  
- **Pagination** — Show 20 per page (virtual scroll or "Show more")
- **Card density** — 2 columns on desktop, 1 on mobile
- **FAQ section** — "How to find the best hospital near me?" etc.

---

### 4.2 Hospital Detail (`/hospitals/[slug]`)

```
┌─────────────────────────────────────────────────────────┐
│ [SiteNav]                                               │
├─────────────────────────────────────────────────────────┤
│ Home / Hospitals / Fortis Hospital Mumbai                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  PRIVATE HOSPITAL                                       │
│  Fortis Hospital Mumbai                                 │
│  Mumbai, Maharashtra · ★4.8 (1,800)                    │
│  ✅ Verified · 📍 Map Ready                             │
│                                                         │
│  [Book Appointment]  [📞 Call]  [🗺 Directions]  [✏ Edit] │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ [Overview] [Doctors] [Packages] [Services] [Reviews] [📍] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────┐ ┌────────────────────────┐│
│  │ About                   │ │ Quick Info             ││
│  │ Description text...     │ │ 📞 +91-22-xxxx        ││
│  │                         │ │ 🌐 fortis.com         ││
│  │ Address: ...            │ │ ⏰ 24/7                ││
│  │ Working hours: ...      │ │ Specialties:          ││
│  │                         │ │ [Cardio] [Ortho]      ││
│  │ [Suggest an edit ✏]     │ │ Accreditations:       ││
│  │                         │ │ NABH, JCI             ││
│  └─────────────────────────┘ └────────────────────────┘│
│                                                         │
├─────────────────────────────────────────────────────────┤
│ Mobile bottom bar:  [Book Appointment]  [📞 Call]       │
└─────────────────────────────────────────────────────────┘
```

**Key improvements:**
- White card backgrounds with green accents
- Compact hero with essential info (no "ISR 1h" or "Bidirectional" — those are dev labels)
- Sticky tab bar on scroll
- Compact inline field editors
- Quick info sidebar always visible on desktop

---

### 4.3 Doctor Listing (`/doctors`)

Same layout as Hospital listing with adaptations:
- **Specialty filter** instead of city filter as primary  
- **Experience badge** on each card ("15+ yrs")  
- **Fee indicator** where available ("₹500 - ₹1,000")
- **Affiliated hospital name** shown on card

---

### 4.4 Doctor Detail (`/doctors/[slug]`)

Same structure as Hospital detail with:
- **Avatar placeholder** (initials-based, colored circle)  
- **Qualification badges** (MBBS, MD, etc.)
- **Affiliation cards** linking to hospitals
- **AI Review Summary** panel (already exists, just re-styled)

---

### 4.5 Treatment Listing (`/treatments`)

```
┌─────────────────────────────────────────────────────────┐
│ [SiteNav]                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  HEALTHCARE DIRECTORY                                   │
│  Treatments, Specialties & Procedures                   │
│  247 healthcare categories                              │
│                                                         │
│  [🔍 Search treatments, conditions...]                  │
│                                                         │
│  Type: [All] [Specialty] [Treatment] [Procedure]        │
│        [Condition] [Department]                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  SPECIALTIES                                            │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐             │
│  │ Cardiology│ │ Neurology │ │ Oncology  │             │
│  │ desc...   │ │ desc...   │ │ desc...   │             │
│  │ View →    │ │ View →    │ │ View →    │             │
│  └───────────┘ └───────────┘ └───────────┘             │
│                                                         │
│  TREATMENTS                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐             │
│  │ Angioplasty││ Knee Repl │ │ Dialysis  │             │
│  └───────────┘ └───────────┘ └───────────┘             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key improvements:**
- **Search box** for filtering treatments by name  
- **Type filter pills** to narrow by category  
- **CSS Module** instead of inline styles  
- **Compact grid** with 3-4 columns  

---

### 4.6 Treatment Detail (`/treatments/[slug]`)

Same as existing but with white theme and:
- **Hospital comparison cards** with fee range
- **Doctor cards** with experience + fee
- **Book appointment CTA** integrated into cards

---

## 5. Technical Architecture

### 5.1 File Structure

```
src/components/profiles/
├── profiles.module.css          ← REWRITE to white theme
├── DirectorySearchList.tsx      ← REWRITE with filters, sort, pagination
├── HospitalProfileClient.tsx    ← REWRITE with white theme
├── DoctorProfileClient.tsx      ← REWRITE with white theme
├── TreatmentProfileClient.tsx   ← REWRITE with white theme
├── InlineFieldEditor.tsx        ← Update styling only
├── ProfileCard.tsx              ← NEW: Shared card component
├── FilterBar.tsx                ← NEW: Shared filter/sort bar
└── ProfileHero.tsx              ← NEW: Shared hero header

src/app/treatments/
├── page.tsx                     ← Keep as-is
└── TreatmentsClient.tsx         ← REWRITE (remove inline styles)
```

### 5.2 Shared Components for React Native Parity

| Web Component | Future RN Component | Shared Logic |
|---------------|---------------------|-------------|
| `ProfileCard` | `ProfileCardNative` | Types, data transforms |
| `FilterBar` | `FilterBarNative` | Filter logic, state |
| `ProfileHero` | `ProfileHeroNative` | Data display logic |
| [DirectorySearchList](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/DirectorySearchList.tsx#27-94) | `DirectoryScreenNative` | Search, filter, pagination |

### 5.3 Performance Plan

- **Virtual pagination:** Show 20 items, "Load more" button
- **Skeleton loading:** Show placeholder cards while data loads
- **Image lazy loading:** Hospital/doctor photos
- **ISR:** Already at `revalidate = 3600` (1 hour)

### 5.4 SEO Improvements

- Add FAQ schema on listing pages
- Add `<nav>` breadcrumbs with structured data
- Ensure single `<h1>` per page
- Add `<article>` wrapping for each profile card
- Meta descriptions already good ✅

---

## 6. Implementation Order

| Phase | Task | Est. Effort |
|-------|------|-------------|
| **1** | Rewrite [profiles.module.css](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/profiles.module.css) → white theme | 1 hour |
| **2** | Rewrite [DirectorySearchList](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/DirectorySearchList.tsx#27-94) with filters, sort, pagination | 1.5 hours |
| **3** | Rewrite [HospitalProfileClient](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/HospitalProfileClient.tsx#109-488) with white theme + compact layout | 1 hour |
| **4** | Rewrite [DoctorProfileClient](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/DoctorProfileClient.tsx#89-379) with white theme + compact layout | 45 min |
| **5** | Rewrite [TreatmentsClient](file:///c:/Biswajit/Codex/easyheals-next/src/app/treatments/TreatmentsClient.tsx#16-112) → CSS modules + search + type filter | 45 min |
| **6** | Rewrite [TreatmentProfileClient](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/TreatmentProfileClient.tsx#59-250) with white theme | 30 min |
| **7** | Add FAQ sections to listing pages for SEO | 30 min |
| **8** | Mobile responsive polish + bottom sheets | 30 min |

**Total estimated:** ~6-7 hours

---

## 7. Visual Reference

### Color Palette Applied

| Element | Color | Use Case |
|---------|-------|----------|
| Page bg | `#FFFFFF` | Main background |
| Section bg | `#F8FAF9` | Alternating sections |
| Card bg | `#FFFFFF` | All cards |
| Card border | `#D0E4D8` | Default state |
| Card hover border | `#1B8A4A` | Hover + focus |
| Primary button | `#1B8A4A` | Book Appointment, CTA |
| Secondary button | `#E6F5EC` bg + `#1B8A4A` text | View Profile, Filter |
| Star rating | `#F59E0B` | ★ rating display |
| Verified badge | `#E6F5EC` bg + `#1B8A4A` text | ✅ Verified |
| Text primary | `#1A2B23` | Headings, names |
| Text secondary | `#5A7367` | Descriptions, meta |
| Tag chip | `#E6F5EC` bg + `#1B8A4A` text | Specialty tags |

### Mobile-First Cards

```
┌─────────────────────────────┐
│ Fortis Hospital Mumbai      │  ← 16px, bold
│ Mumbai, Maharashtra         │  ← 13px, secondary
│ [Cardiology] [Orthopaedics] │  ← 11px pills
│ ★ 4.8 (1,800) · ✅ Verified │  ← 13px, with star color
│ ─────────────────────────── │
│ [📄 View Profile] [📅 Book] │  ← 12px action buttons
└─────────────────────────────┘
min-height: auto (content-driven)
padding: 14px
gap: 6px between rows
```

---

> [!IMPORTANT]
> **Before implementation:** This document should be reviewed and approved. The redesign rewrites [profiles.module.css](file:///c:/Biswajit/Codex/easyheals-next/src/components/profiles/profiles.module.css) which affects ALL profile pages simultaneously. The implementation should be done in one go to avoid inconsistent states.

> [!TIP]
> **React Native parity:** By keeping data-fetching in server components and UI in client components with CSS modules, the migration to RN will only require replacing the CSS module references with StyleSheet.create() equivalents. The component structure, props, and logic can be shared via a monorepo.
