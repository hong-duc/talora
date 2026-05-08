# Talora — AI Coding Rules & Guidelines

> These rules describe the patterns, conventions, and architecture of the **Talora** project.
> Follow them precisely when generating or modifying code.

---

## 1. Core Philosophy

1. **Prefer simple solutions over complex ones.** If a simpler approach achieves the same result, always choose it.
2. **Divide changes into small, manageable increments.** Apply them one logical step at a time.
3. **Use a modular approach — never put everything in one file.** Each file should have a single, clear responsibility.
4. **Comment code to explain *how* it works and *why* — not just *what* it does.** Focus on non-obvious decisions.
5. **Group related logic into named functions.** Call those functions from a clear orchestration point (e.g., a main handler).

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Astro](https://astro.build) v6 (`output: "server"`, SSR) |
| **UI Components** | [Svelte 5](https://svelte.dev) (runes syntax) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) (via `@tailwindcss/vite`) |
| **State Management** | [Redux Toolkit](https://redux-toolkit.js.org) |
| **Database / Auth** | [Supabase](https://supabase.com) (PostgreSQL + RLS) |
| **Deployment** | [Vercel](https://vercel.com) (`@astrojs/vercel` adapter) |
| **Language** | TypeScript (strict mode) |
| **Package Manager** | `pnpm` |
| **Rich Text Editor** | Tiptap v3 |
| **UI Library** | Skeleton UI + bits-ui |

---

## 3. Project Structure

```
src/
  components/       # Astro (.astro) and Svelte (.svelte) UI components
  lib/              # Pure utility / business-logic modules (no UI)
  pages/            # Astro pages & file-based API routes
    api/            # Server-side API route handlers (.ts files)
  scripts/          # Client-side TypeScript scripts (not Svelte)
  styles/           # Global CSS (global.css uses Tailwind v4 @theme)
  types/            # Global TypeScript type augmentations
schema/             # PostgreSQL schema & migrations
design/             # Static HTML design references (do not modify)
ai-stuf/            # AI configuration files
public/             # Static assets
```

---

## 4. TypeScript Rules

- **Always use TypeScript.** No plain `.js` files in `src/`.
- **Use `interface` for object shapes** and `type` for unions, aliases, and function signatures.
- **Export all shared types** from `src/lib/types.ts` (domain models) or `src/lib/api-types.ts` (API-specific shapes).
- **Use discriminated unions** for result types and error types — never throw raw strings.
- The canonical `Result<T>` pattern lives in `src/lib/error.ts`:
  ```ts
  // Use this pattern for functions that can fail
  export type Result<T, E = AppError> =
    | { success: true; data: T; error: null }
    | { success: false; data: null; error: E };
  ```
- **Never use `any`** unless absolutely necessary and you add a `// TODO: type this properly` comment.
- **Use `as const`** for constant objects (e.g., `COLORS`, `API` in `src/lib/constants.ts`).
- Put all magic values (colours, limits, timeouts) in `src/lib/constants.ts` as `as const` objects.

---

## 5. Astro Page Rules

- All pages live in `src/pages/`.
- Use the frontmatter (`---`) block for server-side data fetching and component imports.
- **Pages that need SSR** must have `export const prerender = false` (or omit it since `output: "server"` is the default).
- **Static pages** (no auth/data) may use `export const prerender = true`.
- Astro pages are the **integration layer**: fetch data, check auth, pass props to Svelte components.
- Do not put business logic in `.astro` pages — delegate to `src/lib/` functions.
- Always include proper `<meta>` tags (charset, viewport, description) in page `<head>`.
- Always load `global.css` on every page: `import '../styles/global.css'`.
- Material Symbols icons are loaded globally via Google Fonts. Use `<span class="material-symbols-outlined">icon_name</span>`.

### Astro Component Props Pattern

```astro
---
interface Props {
  variant?: "default" | "chat";
  showNav?: boolean;
  activeSection?: "archive" | "social";
}
const { variant = "default", showNav = true } = Astro.props;
---
```

---

## 6. API Route Rules

All API routes live under `src/pages/api/` and follow the Astro file-based routing convention.

### Structure Pattern

Every API route file should be divided into clearly labelled sections:

```ts
// src/pages/api/my-route.ts
export const prerender = false;

// ============================================================================
// TYPES  (local to this file)
// ============================================================================

// ============================================================================
// UTILITY FUNCTIONS  (pure helpers, ordered by dependency)
// ============================================================================

// ============================================================================
// MAIN API HANDLER(S)
// ============================================================================
export const POST: APIRoute = async ({ request }) => { ... };
```

### Authentication

- **Every protected route** must call `requireAuth` from `src/lib/api-auth.ts` first.
- Always create an **authenticated Supabase client** using the token so RLS policies work:
  ```ts
  const auth = await requireAuth(request);
  if (auth.error) return auth.error; // returns a ready-made 401 Response
  const db = createAuthedClient(auth.token);
  ```
- Never use the shared `supabase` anon client to write user-owned data — RLS will block it.

### Response Pattern

Use the helpers from `src/lib/api-utils.ts` for consistent responses:

```ts
import { createApiResponse, sendResponse } from '../../lib/api-utils';
import { errors } from '../../lib/error';

// Success
return sendResponse(createApiResponse(true, data));

// Error
return sendResponse(createApiResponse(false, errors.notFound('Story not found', 'story')));
```

- For simple routes, a `buildResponse(status, data)` local helper is acceptable.
- Always set `Content-Type: application/json`.
- Use correct HTTP status codes: `200` (OK), `201` (Created), `207` (Partial success), `400` (Bad Request), `401` (Unauthorized), `404` (Not Found), `500` (Server Error).

### Validation

Use `src/lib/validation.ts` validators for all request input:

```ts
import { validators, validateSchema } from '../../lib/validation';

const result = validateSchema({
  title: validators.string('title', { minLength: 1, maxLength: 255 }),
  author_id: validators.uuid('author_id'),
}, body);

if (!result.valid) {
  return sendResponse(createApiResponse(false, result.error));
}
```

---

## 7. Error Handling Rules

- **Never throw raw strings.** Always use typed errors from `src/lib/error.ts`.
- Use the `errors.*` factory functions:
  ```ts
  errors.validation('Title is required', { field: 'title' })
  errors.notFound('Story not found', 'story')
  errors.unauthorized('Not logged in')
  errors.database('Insert failed', originalError)
  ```
- Wrap async operations with `safeAsync` when you want a `Result<T>` without a try/catch:
  ```ts
  const result = await safeAsync(() => supabase.from('stories').select('*'));
  if (!result.success) return sendResponse(createApiResponse(false, result.error));
  ```
- In API routes, always wrap the top-level handler in `try/catch` and return a 500 for unexpected errors.
- **Log errors server-side** with `console.error('[RouteName] message:', error)` including the route name prefix.

---

## 8. Svelte 5 Component Rules

Use **Svelte 5 runes syntax exclusively**. Do not use the old Svelte 4 reactive stores or `$:` syntax.

### Props

```svelte
<script lang="ts">
  let {
    label = "Default",
    onClose,
  } = $props<{
    label?: string;
    onClose?: () => void;
  }>();
</script>
```

### State & Derived

```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);

  // For complex derived values
  let result = $derived.by(() => {
    return expensiveComputation(count);
  });
</script>
```

### Effects

```svelte
<script lang="ts">
  $effect(() => {
    // Runs when reactive state in the callback changes
    console.log('count changed:', count);
  });
</script>
```

### Component Organisation (within a .svelte file)

Order the `<script>` block sections clearly:

```svelte
<script lang="ts">
  // 1. Imports
  // 2. Types (local to this component)
  // 3. Props ($props)
  // 4. Constants
  // 5. State ($state)
  // 6. Derived ($derived)
  // 7. Functions (helpers first, then event handlers)
  // 8. Lifecycle ($effect, onMount, onDestroy)
</script>

<!-- Template -->

<style>
  /* Scoped styles only — prefer Tailwind utility classes */
</style>
```

### Event Handling

Use Svelte 5 inline event handlers (no `on:` directive):

```svelte
<button onclick={() => handleClick()}>Click me</button>
<input oninput={handleInput} onblur={handleBlur} />
```

### Custom Events (for Astro ↔ Svelte communication)

Dispatch `CustomEvent` on the root element when the Svelte component needs to communicate outward:

```ts
rootelement.dispatchEvent(new CustomEvent("change", {
  detail: $state.snapshot(data),
  bubbles: true,
  composed: true,
}));
```

### Loading / Error States

Every Svelte component that fetches data must handle three states:
- `isLoading` — show a skeleton or spinner
- `loadError` — show an inline error message with a "Try again" button
- Loaded — show the actual content

---

## 9. State Management Rules (Redux Toolkit)

The Redux store lives in `src/lib/store.ts`. It has three slices:

| Slice | Purpose |
|---|---|
| `auth` | Authenticated user profile (`Profile | null`) |
| `story` | Current story ID |
| `storyForm` | The create/edit story form data (persisted to `localStorage`) |

### When to use Redux vs local Svelte state

- Use **Redux** for data that must be shared across multiple components or pages (auth profile, story form).
- Use **local `$state`** for UI-only state within a single component (open/close, loading flags, input values).

### Store access in Svelte

```ts
import { store, setProfile } from '../lib/store';

// Read
const profile = store.getState().auth.profile;

// Write
store.dispatch(setProfile(newProfile));

// Subscribe (clean up in onDestroy)
const unsubscribe = store.subscribe(() => {
  // re-read state
});
onDestroy(unsubscribe);
```

### Story Form Persistence

The `storyForm` slice uses a `localStorageMiddleware` that automatically saves changes to `localStorage` under the key `storyFormDraft`. Always call `initializeForm` before starting an edit session.

---

## 10. Styling Rules

### Tailwind CSS v4

- All styles are utility-first TailwindCSS v4.
- The design tokens are defined in `src/styles/global.css` under `@theme`:

| Token | Value | Usage |
|---|---|---|
| `--color-primary` | `#7311d4` (purple) | Interactive elements, brand color |
| `--color-accent-gold` | `#d4af37` (gold) | Highlights, secondary actions |
| `--color-background-dark` | `#191022` | Page background |
| `--font-display` | `"Newsreader", serif` | Headings and brand text |

- Use `bg-primary`, `text-primary`, `border-primary` etc. (not hardcoded hex) in all Tailwind classes.
- Use `bg-background-dark` for the main dark background.
- Use `text-accent-gold` for the gold accent.

### Design Pattern

The app uses a **dark, mystical library aesthetic**:
- Dark backgrounds (`bg-background-dark`, `bg-[#191022]`, `bg-primary/5`)
- Glass-morphism cards (`bg-primary/10 backdrop-blur-md border border-primary/20`)
- Gold and purple accents
- `rounded-xl` or `rounded-2xl` for most containers
- `font-display` (`Newsreader`) for headings; `text-slate-100/300/400` for body text
- Hover animations: `hover:scale-105`, `hover:-translate-y-1`, `transition-all`

### Utility Classes

These global utility classes are defined in `global.css` and should be reused:

```html
<div class="ethereal-glow">...</div>   <!-- purple glow shadow -->
<span class="gold-shimmer">Ra</span>  <!-- gold gradient text -->
<div class="glass-card">...</div>     <!-- glass morphism card -->
<div class="custom-scrollbar">...</div> <!-- styled scrollbar -->
```

### Material Symbols

Icons are loaded via Google Fonts (Material Symbols Outlined). Always use:
```html
<span class="material-symbols-outlined">icon_name</span>
```
Set fill with inline style when needed: `style="font-variation-settings:'FILL' 1"`.

---

## 11. Database & Supabase Rules

### Client Usage

- **`supabase` (anon client)** — Use only for: public data reads, `auth.getSession()`, `auth.getUser(token)`.
- **`createAuthedClient(token)`** — Use for all user-owned data writes/reads. This forwards the JWT so RLS works.

### Query Pattern

```ts
const { data, error } = await db
  .from('stories')
  .select('id, title, author_id')
  .eq('author_id', userId)
  .single();

if (error) throw error; // or return an error result
```

### Row Level Security (RLS)

- The database uses RLS. Always use `createAuthedClient` for operations that require the user's identity.
- Server-side API routes receive the Bearer token and pass it to `createAuthedClient`.
- Never trust `author_id` from the request body — always use the `userId` returned by `requireAuth`.

### Schema Conventions

- Table names: `snake_case` (e.g., `story_tags`, `story_sessions`)
- Column names: `snake_case` (e.g., `cover_image_url`, `created_at`)
- IDs: UUID strings
- Timestamps: ISO 8601 strings (`created_at`, `updated_at`)
- Optional fields in TypeScript interfaces use `?`

---

## 12. File Naming & Organisation

| Type | Convention | Example |
|---|---|---|
| Astro pages | `kebab-case.astro` | `create-story.astro` |
| Astro components | `PascalCase.astro` | `SiteHeader.astro` |
| Svelte components | `PascalCase.svelte` | `TagInput.svelte` |
| API routes | `kebab-case.ts` or `index.ts` | `create-story.ts` |
| Lib modules | `kebab-case.ts` | `api-utils.ts`, `ai-client.ts` |
| Scripts | `kebab-case.ts` | `profile-sync.ts` |
| Types | `kebab-case.ts` | `types.ts`, `api-types.ts` |

### Lib Module Responsibilities

| File | Responsibility |
|---|---|
| `types.ts` | Domain model interfaces (Story, Character, Message, etc.) |
| `api-types.ts` | API request/response shapes |
| `api-utils.ts` | Response helpers, pagination, rate limiting, sanitization |
| `api-auth.ts` | `requireAuth`, `jsonResponse`, `json401` |
| `error.ts` | `AppError` type, `errors.*` factories, `Result<T>`, `safeAsync` |
| `validation.ts` | `validators.*`, `validateSchema`, `patterns` |
| `constants.ts` | Application-wide constants (`COLORS`, `API`, `VALIDATION`, etc.) |
| `store.ts` | Redux store, slices, selectors, actions |
| `supabase.ts` | `supabase` anon client + `createAuthedClient` |
| `auth.ts` | Supabase auth helpers (signUp, signIn, signOut, getSession) |
| `stories.ts` | Story CRUD functions |
| `ai-client.ts` | AI reply generation (system prompt builder + API call) |

---

## 13. API Route Design Patterns

### RESTful URL Conventions

```
GET    /api/stories              — list
GET    /api/stories/[id]         — get one
POST   /api/stories              — create
PUT    /api/stories/[id]         — replace
PATCH  /api/stories/[id]         — partial update
DELETE /api/stories/[id]         — delete

# Nested resources
GET    /api/sessions/[id]/messages
POST   /api/sessions/[id]/messages
PATCH  /api/sessions/[id]/messages/[msgId]
DELETE /api/sessions/[id]/messages/[msgId]
```

### Handler Decomposition

Break API handlers into small single-purpose functions:

```ts
// BAD: monolithic handler
export const POST: APIRoute = async ({ request }) => {
  // 200 lines of mixed parsing, validation, DB, file upload...
};

// GOOD: decomposed
async function parseFormData(request): Promise<FormDataResult> { ... }
function validateStoryData(data): { isValid: boolean; error?: string } { ... }
async function createStoryRecord(data, db): Promise<{ story, error }> { ... }
async function uploadCoverImageIfProvided(file, story, db) { ... }
async function processTags(storyId, tags, authorId, db) { ... }

export const POST: APIRoute = async ({ request }) => {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    const db = createAuthedClient(auth.token);
    const { storyData, coverImageFile } = await parseFormData(request);
    // ...numbered steps 1–N
};
```

### Partial Success (207)

When the primary operation succeeds but secondary operations partially fail (e.g., story created but tags failed), return `207` with a `warnings` array:

```ts
return buildResponse(207, {
  success: true,
  story,
  warnings: ['Failed to process tags: ...']
});
```

---

## 14. Authentication Flow

1. **Client**: `supabase.auth.signInWithPassword()` → receives JWT access token.
2. **Client**: Stores token in `localStorage` (Supabase default) and writes `sb-access-token` cookie.
3. **API Routes**: Read the `Authorization: Bearer <token>` header (or `sb-access-token` cookie) via `requireAuth`.
4. **API Routes**: Call `createAuthedClient(token)` to get an RLS-aware DB client.
5. **Profile Sync**: `src/scripts/profile-sync.ts` listens for auth state changes and syncs the Redux store + updates DOM nodes with `data-auth`, `data-profile-name`, `data-profile-avatar` attributes.

### Data Attributes for Auth-Aware DOM

Use these data attributes in `.astro` components for the profile-sync script to update:

```html
<div data-auth="signed-out">...</div>   <!-- hidden when signed in -->
<div data-auth="signed-in">...</div>    <!-- hidden when signed out -->
<span data-profile-name>Guest</span>    <!-- replaced with username -->
<img data-profile-avatar src="..." />   <!-- replaced with avatar URL -->
<a data-profile-link href="#">...</a>   <!-- href set to /user/<id> -->
```

---

## 15. AI Integration Rules

### AI Client (`src/lib/ai-client.ts`)

- Supports DeepSeek, OpenRouter, LangDB, and custom OpenAI-compatible backends.
- The entry point is `generateReply(history, story, config, sceneState?)`.
- The system prompt is built by `buildSystemPrompt(story, sceneState)` — it injects setting, tone, world rules, lore, character registry, and scene context.
- Always call from the server side (API routes) — **never from the browser**.

### API Keys

- API keys are encrypted at rest in the `ai_configs` table.
- The plaintext key is **never** returned to the client — only a masked version (`api_key_masked`).
- Decryption happens server-side only (`src/lib/ai-crypto.ts`).

### AI Config Types

```ts
type AiProvider = 'deepseek' | 'openrouter' | 'langdb' | 'custom';
```

---

## 16. Svelte ↔ Astro Integration

- Svelte components are rendered inside Astro pages using the `<Component client:load />` directive.
- Pass server-fetched data from the Astro frontmatter as props to Svelte components.
- For two-way communication (Svelte → Astro/page), use `CustomEvent` with `bubbles: true, composed: true`.
- The `data-arcane-skip` attribute on a root element marks it as a container that Svelte owns (used internally).

---

## 17. Content Language & Tone

The Talora app has a distinctive **mystical, literary fantasy aesthetic** in its UI copy.  
When writing user-facing text (labels, placeholders, messages), match this tone:

- Use evocative language: "Infuse essence", "Summoning essences...", "Seek forbidden knowledge"
- Error messages may be practical but have a flavourful framing where appropriate
- Navigation labels use the in-world vocabulary: "The Great Archive", "Seekers", "Keepers"
- Avoid dry generic text like "Loading..." — prefer "Summoning..." or "Consulting the library..."

---

## 18. Performance & Security Guidelines

- **Always sanitise user input** using `sanitizeString` / `sanitizeObject` from `src/lib/api-utils.ts` before storing.
- **Rate limiting** is implemented via `checkRateLimit` in `api-utils.ts`. Apply it on sensitive endpoints (sign-in, message send).
- **Never expose `originalError`** details in API responses (only log server-side).
- **Image proxying**: Use `wsrv.nl` for resizing external images on-the-fly:
  ```ts
  `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=64&h=64&fit=cover&output=webp&q=85`
  ```
- **File uploads**: Max 5 MB. Allowed types: `image/jpeg`, `image/png`, `image/webp`. Validate with `FILE_UPLOAD` constants.
- **Pagination**: Always paginate list endpoints. Default limit: 20, max: 100. Use `parsePagination` and `createPaginationMeta` from `api-utils.ts`.

---

## 19. Do Not Break These Patterns

- Do **not** use Svelte 4 syntax (`$:`, `export let`, `on:click`). Always use Svelte 5 runes.
- Do **not** write business logic directly in `.astro` pages — put it in `src/lib/`.
- Do **not** use the anon Supabase client for user-owned writes — RLS will silently block them.
- Do **not** return raw Supabase errors to the client — wrap them in `AppError`.
- Do **not** hardcode colours or magic numbers — use `COLORS`, `VALIDATION`, `API` from `constants.ts` or Tailwind tokens.
- Do **not** create new slices in the Redux store without a clear justification — prefer local Svelte `$state` for component-scoped data.
- Do **not** store the decrypted API key anywhere client-accessible — it must stay server-side only.
