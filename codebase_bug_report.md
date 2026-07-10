# Codebase Bug & Audit Report 🕵️‍♂️

I have performed a comprehensive scan of the key routes, database queries, and utility scripts in the `virtual-gender-reveal` codebase. Below is a structured summary of critical bugs, performance/scalability bottlenecks, date/timezone parsing errors, and responsiveness issues, along with actionable recommendations.

---

## 1. Critical Defects & Data Loss 🔴

### A. Photo Upload Data Loss on Creation
* **File:** [new-reveal/page.tsx](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/new-reveal/page.tsx#L341)
* **Description:** In `handleSubmit`, the component successfully validates and uploads guest photos to Firebase Storage via `uploadPhotos()`, which returns the download URLs in `photoUrls`. However, in the POST request body to `/api/create-reveal`, the `photos` field is hardcoded as an empty array:
  ```typescript
  const res = await fetch("/api/create-reveal", {
    method: "POST",
    headers: { ... },
    body: JSON.stringify({
      enquiryId,
      mode,
      parentName: parentName.trim(),
      photos: [], // <--- BUG: Hardcoded empty array
      revealAtMs: mode === "announcement" ? Date.now() : new Date(revealAt).getTime(),
      ...
  ```
* **Consequence:** Photos uploaded by the user are saved in Firebase Storage but are never recorded on the Firestore `enquiries` document during creation. This causes silent data loss.
* **Fix Recommendation:** Change `photos: []` to `photos: photoUrls` in the request payload.

---

## 2. Timezone & Date Shifting Bugs 🕒

### A. Client Local Timezone Shift During Creation/Editing
* **Files:** 
  * [new-reveal/page.tsx](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/new-reveal/page.tsx#L342)
  * [dashboard/page.tsx](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/dashboard/page.tsx#L935)
* **Description:** The `<input type="datetime-local" />` element returns a timezone-naive date-time string (e.g., `2026-07-10T17:00`). The client calculates the milliseconds epoch time using:
  * `new Date(revealAt).getTime()`
  * `new Date(editForm.revealAt).getTime()`
  
  Since the string has no offset information, JavaScript parses it relative to the **client browser's local timezone**, completely ignoring the user's selected `timezone` dropdown setting (e.g. `America/Los_Angeles`).
* **Consequence:** If a host currently in New York (EST) schedules a reveal for Los Angeles (PST) at 9:00 AM, the code parses the time as 9:00 AM EST, saving it in the database 3 hours earlier than intended.
* **Fix Recommendation:** Send the raw timezone-naive datetime string and selected timezone to the backend API, then parse it securely using timezone helpers (or a library) to compute the correct epoch milliseconds.

### B. Timezone Shift on `dueDate`
* **Files:**
  * [create-reveal/route.ts](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/api/create-reveal/route.ts)
  * [reveal/update/route.ts](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/api/reveal/update/route.ts#L191)
* **Description:** In both create and update routes, the `dueDate` is parsed directly via `new Date(dueDate)` on the server.
* **Consequence:** The server runtime timezone parses the YYYY-MM-DD string as UTC, which can shift the display date by a day depending on the viewer's location when formatted on the client.

---

## 3. Database & Performance Scaling Issues ⚡

### A. High-Cost Firestore Collection Scans During Polling
* **Files:** 
  * [guest/[token]/page.tsx](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/guest/%5Btoken%5D/page.tsx#L152)
  * [api/guest/[token]/route.ts](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/api/guest/%5Btoken%5D/route.ts#L48-L80)
* **Description:** The guest page polls `/api/guest/[token]` every 3 seconds. To construct the feed and count vote totals, the GET handler queries the database:
  ```typescript
  const feedSnap = await getAdminDb().collection("guest_invites").where("enquiryId", "==", payload.enquiryId).get();
  const predictionsSnap = await getAdminDb().collection("predictions").where("enquiryId", "==", payload.enquiryId).get();
  ```
  It then sorts and filters these documents **in-memory** on every request.
* **Consequence:** 
  * If a reveal has 100 online guests polling every 3 seconds, and 100 guests invited, this triggers `100 * (2 + 100 + 100) = 20,200` database reads every 3 seconds. 
  * This will quickly exhaust Firestore limits and rack up high bills, while also slowing down response times due to in-memory processing.
* **Fix Recommendation**: 
  * Store aggregated boy/girl vote counters directly on the `enquiries` document and update them atomically using Firestore `FieldValue.increment` when a guest votes.
  * For the guest wishes feed, add database pagination and limit queries directly: `.where("enquiryId", "==", enquiryId).orderBy("updatedAt", "desc").limit(20)`.
  * Increase the client polling interval to 15–30 seconds, or transition the client page to use Firestore client-side real-time listeners (`onSnapshot`) instead of HTTP polling.

---

## 4. Severe Server Reliability Bugs 💥

### A. Vercel Execution Timeout Due to Blocking Loops
* **File:** [api/guest/send-invites/route.ts](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/api/guest/send-invites/route.ts#L172-L189)
* **Description:** The `/api/guest/send-invites` endpoint iterates through guests and sends SMS (Twilio) and emails (Resend) sequentially using a blocking `for` loop:
  ```typescript
  for (const g of normalizedGuests) {
    const ok = await writeAndSendInvite({ ... });
  }
  ```
  Inside `writeAndSendInvite`, it waits for external API calls:
  ```typescript
  await sendInviteSms({ ... });
  await sendGuestInviteEmail(emailParams);
  ```
* **Consequence:** Sequential HTTP requests to external APIs (Twilio/Resend) typically take 200ms–500ms each. Sending invites to 50 guests will take 20–30+ seconds, exceeding the Vercel Serverless Function timeout limit (15s on Hobby, 30s on Pro) and crashing mid-run. Only some guests will receive invites.
* **Fix Recommendation:** Send the invites in parallel using `Promise.all` or offload the notification tasks to a background queue system (e.g. Upstash QStash, Inngest).

---

## 5. UI & Responsiveness Bugs 📱

### A. Broken Container Queries
* **Files:**
  * [guest/[token]/page.tsx](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/guest/%5Btoken%5D/page.tsx#L579)
  * [tailwind.config.js](file:///Users/akshita/Downloads/virtual-gender-reveal/tailwind.config.js#L62)
* **Description:** The countdown card container relies on `@container` and container width query units (`8.5cqw`) to fluidly scale the numbers. However, the `@tailwindcss/container-queries` plugin is not installed in `package.json` and is not configured in `tailwind.config.js`.
* **Consequence:** The `@container` utility class does not compile, container query styling is broken, and countdown numbers will not scale correctly, causing alignment and overflow issues on mobile screens.
* **Fix Recommendation:** Install `@tailwindcss/container-queries` and add it to `plugins` in `tailwind.config.js`.

### B. Distorted/Stretched Background Video
* **File:** [guest/[token]/page.tsx](file:///Users/akshita/Downloads/virtual-gender-reveal/src/app/guest/%5Btoken%5D/page.tsx#L404)
* **Description:** The class `.party-bg-video` has `object-fit: fill;` set on the desktop background video.
* **Consequence:** The background video will stretch to fit the viewport dimensions, distorting its aspect ratio.
* **Fix Recommendation:** Change `object-fit: fill;` to `object-fit: cover;` to preserve the video's original aspect ratio.

---

## 6. Authentication/Middleware Gaps 🔒

### A. Missing Protection for `/new-reveal`
* **File:** [middleware.ts](file:///Users/akshita/Downloads/virtual-gender-reveal/src/middleware.ts#L4)
* **Description:** The route `/new-reveal` requires authentication (verified via `useAuth` client-side), but it is missing from both the middleware `PROTECTED_ROUTES` list and the Next.js config matcher block.
* **Consequence:** Unauthenticated users can load the `/new-reveal` HTML shell before the client-side redirect triggers, causing a flash of private page layout.
* **Fix Recommendation:** Add `/new-reveal` to the `PROTECTED_ROUTES` array and matcher config in `middleware.ts`.
