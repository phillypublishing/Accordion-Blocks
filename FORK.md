# LebTown compatibility fork

This is a compatibility bridge for existing `pb/accordion-item` content, with an
explicit editor transform to WordPress core Accordion. It is not a bulk migration
and does not change posts at installation time. The installed plugin directory
remains `accordion-blocks`; replace the upstream plugin, do not activate both.

Based on upstream master `ecee6ddb1b49d73daf1410458480b4e0402cd01a` (1.5.0).
Phil Buchanan's attribution and GPLv2-or-later license remain intact. The conversion
was informed by [upstream PR #179](https://github.com/philbuchanan/Accordion-Blocks/pull/179)
at `be731007d64ca38a224c6bd75ba6e3e88fc3b91f`, but is a smaller implementation:
no content-dropping error fallbacks, no partitioning nested content out of order.

## Legacy compatibility

The parser recognizes one additional legacy shape: current title/content wrappers
with all five settings data attributes missing. Gutenberg's normal deprecation
validation still rejects unrelated markup damage. Recovery preserves block
comment settings, rich titles, UUIDs, custom anchors/classes and inner blocks;
the current serializer writes the normal canonical markup on the next save.
This does not establish what produced a particular malformed article.

REST defaults are normalized to typed values. New blocks apply resolved defaults
once, respecting settings changed while the response was pending. Existing blocks
keep their saved settings and UUIDs; later duplicate IDs receive unused IDs.
Copyeditor's invalid-block and native-identity guards are unchanged.

## Explicit conversion

Select one or more legacy accordion blocks and choose **Accordion** in the block
transform menu. The action only appears when the core Accordion family is
registered (normally WordPress 6.9+, or a compatible Gutenberg plugin). Confirm
the warning to convert; Cancel leaves the selection unchanged. Invalid selected
blocks must be recovered first.

Rich and empty headings, heading levels, initially-open state, authored child
order and nested content are retained. Descendants inside ordinary containers are
converted in place; synced patterns are not traversed. Adjacent items with the
same auto-close setting and heading level combine. Different settings or heading levels and explicit wrapper anchors
start separate core accordions. Custom classes move to the core item, excluding
legacy JavaScript activation classes. Generated `at-<uuid>` heading anchors and
`ac-<uuid>` panel anchors are retained; a native Group inside each panel supplies
the latter because core panels do not support anchors.

The confirmation explains differences that need editorial/frontend checking:

- Scroll/scroll-offset and prevent-click-to-close behavior do not carry over.
- Core auto-close is scoped to each converted group, rather than the legacy
  page-level event behavior. Anchor/settings splits can therefore change it.
- Core markup and styling differ. Preserving anchor IDs does not guarantee that
  a collapsed panel will automatically open when a deep link is followed.
- Existing Note associations need checking. Do not convert during an active
  Copyeditor review. Save a revision before conversion and use Undo or restore
  that revision if the result is unsuitable.

No theme CSS migration, automatic post rewrite, frontend jQuery replacement,
API-v3 iframe migration or database rollback is included.

## Build and install candidate

Use Node 24 and Python 3: `npm ci`, `npm test`, then `npm run package`. The ZIP is written to
`dist/accordion-blocks-1.5.1-lebtown.1.zip` and contains runtime assets, not Node
packages or tests. The PHP header requires WordPress 6.6 because the new build
uses the registered React JSX runtime. Core conversion still requires the core
Accordion blocks. The fork disables WordPress.org replacement updates with
`Update URI: false`; updates must be built and installed deliberately.

The build tools are pinned with a lockfile. Their npm audit currently reports
transitive vulnerabilities, including high-severity dev dependencies. This is not
a clean dependency audit; those Node packages are not shipped in the plugin ZIP.
Do not run `npm audit fix --force` as a substitute for compatibility testing.

## Verification and remaining acceptance

Automated tests exercise actual WordPress block parsing, the production legacy
serializer/deprecations, the registered core block serializers, and the public
single/multiple/cancelled transformation API. Defaults lifecycle tests mock editor
selectors/UI; identity tests mount competing editors against real WordPress data
registries. Core heading editor tests verify mixed heading levels after conversion.
All 20 tests pass, along with the production build, ZIP packaging, and PHP 8.3
syntax check. These tests do not prove live RTC convergence or frontend
theme/accessibility behavior.

Before production use, test a staging copy with the actual installed WP,
Gutenberg and PHP versions: open/save/reload the affected legacy post, convert
representative nested/rich-content accordions, compare the frontend, test keyboard
and deep links, undo/restore, and exercise two editor participants plus Copyeditor
Notes after conversion. No site installation, bulk conversion, or live acceptance
is claimed by this repository change.
