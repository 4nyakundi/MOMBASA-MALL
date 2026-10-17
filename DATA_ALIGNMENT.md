# Data alignment and deployment

The website and dashboard now use one PHP/MySQL data source. Firebase content
reads/writes and browser caches no longer decide live content or sign-in access.
No production database has been migrated by this change.

## Existing production installation

1. Export the existing MySQL database, Firebase data, uploaded media, and any
   historical dashboard JSON exports. Keep an untouched copy of each export.
2. Use a PHP-enabled host (PHP 7.4+ with PDO MySQL and Fileinfo). Static Firebase
   Hosting alone does not execute PHP. Keep the website and API on the same
   origin. Configure DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASS through the
   host's environment. PHP does not automatically load `.env` files. Rotate the
   database password previously embedded in the repository.
3. Apply **only** `database/migrations/001_data_alignment.sql` to the existing
   database. It adds metadata, request-deduplication, site settings, and historical
   import archives. It does not delete or renumber existing business records.
   Do not run `mombasam_mall.sql`, `stores_seed.sql`, or `content_seed.sql` against
   a populated production database: those are new-install snapshots.
4. Deploy the updated files together. Make `uploads/` writable by PHP; retain its
   `.htaccess` protections. Apache must permit these access rules. On Nginx,
   configure equivalent protection for hidden files, `database/`, `tests/`,
   `scripts/`, `tmp/`, and executable files under `uploads/`. Set the server's
   upload limits to at least 20 MB if staff need video uploads.
5. Sign in with an existing account's actual password. The old master-password
   bypass has been removed. If necessary, use the CLI-only recovery tool below
   from a trusted server terminal. This resets only the specified account.
6. As a super administrator, use **Import Historical Content** to choose a
   historical JSON export. Review its preview before applying the merge. Matching
   unit numbers, article slugs, event titles/dates, review author/text, media URLs,
   and lead references preserve existing numeric IDs. Ambiguous matches reject
   the whole import. New records receive server IDs. No existing rows are deleted.
7. Verify forms, published pages, staff permissions, uploads, and counts from a
   separate clean browser. Keep a rollback copy of the previous application and
   SQL/media backups. Do not restore browser caches as the live database.

## Historical data reconciliation

The importer accepts the dashboard's `data` object with `shops`, `events`, `blog`
(or `blogPosts`), `gallery`, `reviews`, `contactLeads`, `ledLeads`,
`activationLeads`, `playonBookings`, and optional `site` content. Use arrays of
plain records. Firebase document IDs should be included as each record's `id`;
the importer maps records by business identity rather than treating Firebase IDs
as SQL primary keys. Export Firebase collections into this shape before importing.

Every import first runs inside a transaction that is rolled back to generate the
preview. Applying the merge stores the entire original payload in `legacy_imports`
as well as the mapped records. Repeating the same import updates matching records
instead of inserting duplicates. Unmapped legacy fields remain in that archive.
Staff passwords and accounts are deliberately skipped: manage accounts through
Users & Roles to avoid restoring historical credentials or privileges.

Legacy Play-On inquiries stored in `contactLeads.message` are preserved there;
they cannot safely be converted into structured bookings by guessing values from
free text. Move them to `playonBookings` in a reviewed export with explicit date,
session, child/adult counts, parent details, and requests before import.

The importer rejects invalid dates, ambiguous identities, unsupported media URLs,
and data URLs that cannot fit URL fields. Upload legacy embedded media first and
replace its data URL in a working copy of the export; retain the original export.
The JSON content export is not a full disaster-recovery backup. Back up MySQL and
`uploads/` separately, including credentials, metadata, and import archives.

## New installation / administrator recovery

For a new empty database, import `database/mombasam_mall.sql`, then the alignment
migration and `database/metadata_seed.sql`. The rebuild already contains the
store and content seeds; do not also import `stores_seed.sql` or
`content_seed.sql`. New installs contain no default staff passwords.

In a trusted terminal, configure the DB environment above and set
`MALL_ADMIN_EMAIL` and `MALL_ADMIN_PASSWORD` (at least 12 characters), then run:

```
php database/admin-account.php
```

Remove `MALL_ADMIN_PASSWORD` from the environment afterward. The tool creates a
super administrator when the email is new, or changes the password of a matching
existing account without changing its role. It cannot be invoked over HTTP.

## Snapshot maintenance

`json/*.json` contains published fallback snapshots. Run:

```
node scripts/build-content-snapshots.cjs
```

This regenerates the dashboard/default directory snapshot and new-install SQL
seeds from the same content. It never connects to a database. An optional
`SNAPSHOT_DATE=YYYY-MM-DD` environment variable fixes event classification for
reproducible builds. Successful empty server responses stay empty; snapshots are
used only when the data service is unavailable, with a visible notice.

Default-content import is an explicit, previewed merge. It can overwrite matching
content with snapshot values; it does not run automatically during deployment.

## Verification

`npm test` checks submission acknowledgement, retries, canonical IDs, failed-save
behavior, confirmation safety, and JavaScript parsing.

`npm run test:integration` runs PHP/MySQL integration checks. It requires PHP and
an isolated MariaDB/MySQL instance on `127.0.0.1:33317`. Setup is restricted to
the database named `mall_alignment_test`; that test database is rebuilt each run.
Set `PHP_BIN` and `MALL_TEST_DB_PASSWORD` if needed. The PHP test server uses port
18817. For environments that restrict child processes, start the isolated server
separately and set `MALL_EXTERNAL_TEST_SERVER=1` and the same `MALL_TEST_PASSWORD`.

Firebase remains available for optional analytics and the separate notification
function. Its existing records are not deleted. Retire legacy public content
rules after exporting any required records; the SQL application does not need
Firestore write permissions. The notification function now requires an operator
Firebase ID token with an `admin` claim and is not tied to SQL staff sessions.
