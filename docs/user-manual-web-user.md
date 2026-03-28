**AlgoHerbarium Web User Manual**

**End-to-End User Flow**
1. Start at the landing page (`/` or `/landing`) to understand the platform and choose `Register` or `Sign in`.
2. Create your account or log in via `/auth` (or `/register`, `/login`), then complete email verification if prompted at `/verify-email`.
3. Arrive at Home (`/home`) and, if prompted, add your birth date and gender so personalized features unlock.
4. Use the sidebar and top navbar to move between Herb Library, Compare, Recommendations, Safety, Map, Blog, and Settings.
5. Save favorites, keep track of recommendations, and return anytime to continue where you left off.

**Home → Discover Your Next Action (`/home`)**
1. Logged‑out users see the hero section with clear entry points.
2. Logged‑in users see a dashboard card with activity stats.
3. If demographics are missing, a banner appears to complete your profile.
4. Quick Actions route you to Recommendations, Image Identification, Map, and Herb Library.
5. Favorite Herbs displays saved herbs for fast access.

**Browse Herbs → Learn Details (`/herbs` → `/herbs/:slug`)**
1. Browse the herb grid, search by name, and filter by gender or safety.
2. Open a herb card to view the detail page.
3. Review images, description, traditional uses, and properties.
4. Check active compounds, interactions, contraindications, and severity.
5. Read dosage guidance and preparation tips when available.
6. Add the herb to favorites for quick access later.

**Compare Herbs (`/compare`)**
1. Choose two herbs using the search selectors.
2. Optionally add a symptom and age group to refine the comparison.
3. Review the “better option” banner and side‑by‑side summaries.
4. Scan differences in symptom coverage, preparation, evidence, and safety.

**Get Recommendations (`/recommendation`) — Login Required**
1. Open the Generate tab and decide whether it’s for you or someone else.
2. Enter symptoms, severity, and optional medical context.
3. Provide age and gender (required for “someone else”).
4. Submit to receive ranked recommendations and warnings.
5. Switch to History to filter past recommendations and open details.

**Run Safety Checks (`/safety`) — Login Required**
1. Search and select a herb to evaluate.
2. Provide age, conditions, medications, and optional combinations.
3. Review Interactions for matched drug/herb conflicts.
4. Review Contraindications for warnings and blockers.

**Identify a Plant (`/image-processing`) — Login Required**
1. Upload a clear plant image.
2. Run identification and review confidence results.
3. If uncertain, compare alternative matches.
4. Submit feedback (correct/incorrect, correction, rating).
5. Reset to start a new identification.

**Find Locations (`/map`)**
1. Open the full‑screen map and expand the side panel.
2. Use “Use My Location” to enable nearby search.
3. Filter by herb, location type, search query, and radius.
4. Tap markers for details, reviews, and photos.
5. Review the floating results summary for nearby locations.

**Join the Community (`/blog` → `/blog/:slug` → `/blog/create`)**
1. Browse featured and trending posts or filter by category.
2. Open a post to read, like, bookmark, and comment.
3. Create a blog with title, excerpt, category, tags, content, and image.
4. Track your posts in “My Blogs” and request approvals when ready.

**Manage Your Profile (`/settings`)**
1. Update name, bio, avatar, and banner in the Account tab.
2. Set location details (region, province, city).
3. Change password if not signed in with Google.
4. Adjust theme, dark mode, notifications, and profile visibility.
5. Toggle the chatbot widget on or off.

**Access Rules**
1. Public access: landing, home, herb library, comparison, and blog browsing.
2. Login required: recommendations, safety checks, and image identification.
3. Admin pages are role‑restricted and documented separately.

**Troubleshooting Flow**
1. No results? Clear filters and broaden search terms.
2. Recommendations blocked? Review red‑flag warnings before retrying.
3. Identification uncertain? Upload a clearer photo and compare alternatives.
4. Map locked? Enable browser location permissions and try again.
