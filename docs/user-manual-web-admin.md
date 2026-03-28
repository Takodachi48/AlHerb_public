**AlgoHerbarium Web Admin Manual**

**Disclaimer**
Enabling Cloudflare protection/Turnstile will prevent mobile users from logging in because mobile support for Turnstile is not fully implemented.

**End-to-End Admin Flow**
1. Sign in with an admin account to access admin routes.
2. Start at the Dashboard to review system health and attention items.
3. Dive into Analytics for deeper monitoring and exports.
4. Manage core data domains: Herbs, Phytochemicals, Users, Locations.
5. Moderate community content and maintain landing assets.
6. Use ML Management for training and chatbot controls.

**Start Here: Dashboard (`/admin/dashboard`)**
1. System Overview summarizes totals and missing data.
2. Attention Required highlights items needing action.
3. Quick Actions jump to high‑priority areas.
4. Activity Trends show daily activity and growth.
5. Infrastructure includes Turnstile control and Cloudinary usage.

**Monitor Health: Analytics (`/admin/analytics`)**
1. Pick a date range and open the relevant tab.
2. Review SLO/SLA, endpoints, governance, operations, and ML insights.
3. Filter error logs by status class, endpoint, or search text.
4. Export CSV or PDF reports for compliance and reporting.

**Manage Herbs (`/admin/herbs` → `/admin/herbs/:slug/edit`)**
1. Filter and search the herb list, then select records.
2. Bulk activate/deactivate or add a new herb.
3. Open the editor to update images, descriptions, uses, and safety.
4. Maintain dosage, preparations, cultivation info, and publication status.
5. Save changes with deletion confirmation for removed images.

**Manage Phytochemicals (`/admin/phytochemicals`)**
1. Browse and search phytochemicals by category and status.
2. Select a phytochemical to review details and assignments.
3. Create or edit phytochemicals with effects tags.
4. Assign compounds to herbs with concentration, unit, and confidence.
5. Archive compounds or update assignments as needed.

**Manage Users (`/admin/users`)**
1. Filter users by role and status.
2. Bulk activate/deactivate selected users.
3. Change user roles with confirmation.
4. Apply deactivation templates for email notices.
5. Track user statistics from the control panel.

**Manage Locations (`/admin/herb-locations`)**
1. Filter by type or status and search by name.
2. Select locations and toggle active status.
3. Use the map modal to validate locations.
4. Add new locations with coordinates and details.

**Moderate Blogs (`/admin/blog`)**
1. Filter the moderation queue by status.
2. Review post cards and open history if needed.
3. Approve, reject, archive, or restore posts.
4. Monitor queue counts and moderation activity.

**Manage Assets (`/admin/assets`)**
1. Upload landing section images for light and dark themes.
2. Choose static or animated welcome mode (upload a gif for animated).
3. Maintain the carousel images.
4. Save to publish updated assets.

**ML & Chatbot Controls (`/admin/dataset`, `/admin/ml-model`)**
1. Trigger image‑classifier retraining when needed. (non-functional due to unfinished implementation)
2. Review queue health and monitoring metrics.
3. View chatbot usage and provider status.
4. Enable or disable the chatbot globally.

**Operational Notes**
1. Some actions are irreversible (archiving, deactivations, asset replacements).
2. Monitoring views may take a few seconds to refresh.
3. If actions fail, check alerts and retry after verifying inputs.
