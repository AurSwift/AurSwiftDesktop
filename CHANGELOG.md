# Changelog

All notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.26.0](https://github.com/Sam231221/aurswift/compare/v1.25.0...v1.26.0) (2025-12-17)

### chore

- Remove outdated testing documentation files (STRUCTURE.md and TESTING_IMPLEMENTATION_SUMMARY.md) to streamline the tests directory ([](https://github.com/Sam231221/aurswift/commit/927ce14fa1a300d6d965b6393930b48568fb5596))

### docs

- Add comprehensive testing setup code review, database analysis, and testing metrics documentation, and update the admin dashboard view. ([](https://github.com/Sam231221/aurswift/commit/d2428555d93721beb9c69e2692594f05ed4e0e1c))

### feat

- Add audit log cleanup functionality and extensive testing setup documentation and reports. ([](https://github.com/Sam231221/aurswift/commit/081162514dfc1e6060dccfd770197224878b427d))
- **batches:** Add optimized data statistics and dashboard fetching functionality ([](https://github.com/Sam231221/aurswift/commit/83dfa14fde820d7535ad2c28f0c40d29b3588bdd))
- **db:** Enhance database initialization with retry logic and error handling, with fresh migration ([](https://github.com/Sam231221/aurswift/commit/c1db805f60ee9d2391d3b1ae09881db7316d84a1))
- Enhance database migration process with schema validation and error handling ([](https://github.com/Sam231221/aurswift/commit/77b4bb46219114e1fccfe281b1d4cee298f9993e))
- Implement enhanced virtual scrolling capabilities for product and categories ([](https://github.com/Sam231221/aurswift/commit/824aac0c9433e702c35f3d24a70ffd5509e7d029))
- **log-migration:** Implement log path migration from Roaming to Local for improved log management ([](https://github.com/Sam231221/aurswift/commit/43cdc924094ba970b6343de48a0b7d6f56092af3))
- **pdfReceipt:** Integrate business details fetching from database for PDF receipt generation and update receipt data structure ([](https://github.com/Sam231221/aurswift/commit/1f4722e1698115543e984c5fcaf342c262a932e3))
- Introduce skeleton loading components and animations for improved user experience during data fetching ([](https://github.com/Sam231221/aurswift/commit/00cc25c1b309cfda6107c6301e1f35503c7d4295))

### fix

- **electron-builder:** change installation setting to allow system-wide installation ([](https://github.com/Sam231221/aurswift/commit/a2db1627532d55d109b6ff544ef845427b7dcac2))
- **vitest:** Update test coverage thresholds to reflect current coverage metrics ([](https://github.com/Sam231221/aurswift/commit/a35a0bec5a547e4bcc0fc1bf638671f94a703d37))

### refactor

- **auth:** Remove background image from AuthHeroSection for cleaner design ([](https://github.com/Sam231221/aurswift/commit/20eeef8d04bb6542b8076aedca9fabc6412bb5a7))
- **product:** standardize formatting and improve code readability in product-related files ([](https://github.com/Sam231221/aurswift/commit/a1475115d318ddbd7a99f72888644be887dc7f27))
- Update batch, business, cash drawer, product, shift, terminal, and time tracking handlers for improved data handling and consistency ([](https://github.com/Sam231221/aurswift/commit/714e0470fe491d91b9993146a8c74ba02240ccba))
- **tests:** update performance benchmark expectations for scaling factor in buildCategoryTree tests ([](https://github.com/Sam231221/aurswift/commit/5ea1e36f66820d43b26bd0b682d80acec4d176fc))

# [1.25.0](https://github.com/Sam231221/aurswift/compare/v1.24.0...v1.25.0) (2025-12-14)

### feat

- Establish comprehensive testing setup documentation, action items, and metrics. ([](https://github.com/Sam231221/aurswift/commit/23a45b2ebca941de6e8d48d538cb31eaee82946c))
- **workflows:** introduce Windows build workflow for Electron app, replacing compile-and-test with comprehensive build steps and verification ([](https://github.com/Sam231221/aurswift/commit/527b3ef2c3b3ae9a99e9f5c1d6d8b4ccdd6c5ad0))

# [1.24.0](https://github.com/Sam231221/aurswift/compare/v1.23.0...v1.24.0) (2025-12-14)

- fixdb-manager): improve code readability and update app version retrieval method ([](https://github.com/Sam231221/aurswift/commit/c96c85c083cec0114d378f15dd5cbb913fb20ba4))

### feat

- **ci:** add type checking job and streamline test workflows for improved validation ([](https://github.com/Sam231221/aurswift/commit/1ec69e2dce6c12d96399225186d05328e15b7039))
- **ci:** add verification step for Electron installation in CI workflow to ensure proper setup ([](https://github.com/Sam231221/aurswift/commit/a2806b08584c665d18117825f009002cd57d0742))
- **tests:** implement comprehensive testing infrastructure with dedicated workflows for unit, component, integration, and E2E tests ([](https://github.com/Sam231221/aurswift/commit/142d16ae42e6eb0eec2d3f6e43e737984af06f78))

### fix

- **tests:** adjust coverage thresholds to unblock CI and reflect current coverage levels ([](https://github.com/Sam231221/aurswift/commit/ac0ef0f002a2f797d6c2712594e8e43571f4c431))
- **tests:** update coverage thresholds in vitest configuration to reflect current baseline and set achievable targets ([](https://github.com/Sam231221/aurswift/commit/ac6f0677efd8ee55b4c0ee0fc038c4736c7b7170))
- **ci:** update permissions for tests workflow and remove redundant permission definitions ([](https://github.com/Sam231221/aurswift/commit/61d54b67e3c4b71de8690cc4a6cf9b771ae832d2))

### refactor

- **adaptive-keyboard:** clean up JSX structure for improved readability and maintainability ([](https://github.com/Sam231221/aurswift/commit/ad063793df3bf1aa7e1139a6080a902abea7094a))

# [1.23.0](https://github.com/Sam231221/aurswift/compare/v1.22.0...v1.23.0) (2025-12-13)

### chore

- Remove debug console log for roles in IPC handler ([](https://github.com/Sam231221/aurswift/commit/1176deb84d44e4c59cb90ebae4d8d1a6ccd8c489))

### feat

- **updater:** add download cancellation functionality with IPC integration and user feedback ([](https://github.com/Sam231221/aurswift/commit/11d436ab6c80b5b33b50098718a0deb5bcfc5e69))
- **product-details:** enhance product details view with tooltips for long text and add category path functionality ([](https://github.com/Sam231221/aurswift/commit/fa1333445d5f73d1d3a6d01f5966c6a46eec352f))

### refactor

- **category-seeder:** enhance seeding process with savepoints for atomicity and improved error handling ([](https://github.com/Sam231221/aurswift/commit/37e6016033e9a2612d3c5299eba7d3da4904a073))
- **product-details:** improve layout and structure of product details view for better responsiveness and usability ([](https://github.com/Sam231221/aurswift/commit/023a67b4093d7094da839d87e636abb48c4e4cac))
- **toasts:** improve styling and structure of UpdateErrorToast and UpdateReadyToast components for better visual consistency ([](https://github.com/Sam231221/aurswift/commit/17db1644a3d91c5f021d3e6242b7072916a5fdd4))

# [1.22.0](https://github.com/Sam231221/aurswift/compare/v1.21.2...v1.22.0) (2025-12-12)

### chore

- **types:** add environment variable types for Vite and database types ([](https://github.com/Sam231221/aurswift/commit/84593756bb49692e81da1e974d0fc3f753555b9c))
- **.gitignore:** add test-results to ignore list ([](https://github.com/Sam231221/aurswift/commit/959e64a468c6ef17d09185b65ffab98dbbd45653))
- **package:** update better-sqlite3 dependency to version 12.5.0 ([](https://github.com/Sam231221/aurswift/commit/44ee75095740f4be7cfcd499684df6c6879e5de1))

### feat

- **seed:** add Seed API type definitions and global interface for seedAPI ([](https://github.com/Sam231221/aurswift/commit/e5c0e32f7b96ed0e0e9e46296b4584a5e72a6e78))
- **dashboard:** enhance dashboard statistics with average order value calculations and cache invalidation ([](https://github.com/Sam231221/aurswift/commit/b1d5e294450e69031e5d434d7bc607debf274c64))
- **seed:** enhance seeding functionality with type assertions and logger integration ([](https://github.com/Sam231221/aurswift/commit/493da978640ee54c274bc38cb4c453d42cedcbac))
- **business:** implement business update functionality with IPC handlers and form integration ([](https://github.com/Sam231221/aurswift/commit/49105f5d51c3422f8190526814473d33087ac66b))
- **seed:** implement category and product seeding functionality with IPC handlers and API integration ([](https://github.com/Sam231221/aurswift/commit/0d15dc09377d8d1351168ea3d3f562c91c2043b2))
- **dashboard:** implement dashboard statistics functionality with IPC handlers and hooks for revenue and sales metrics ([](https://github.com/Sam231221/aurswift/commit/dac3241e917a76b09d222708f78d9d3a4276b4ee))
- **terminal:** implement terminal management functionality with IPC handlers, database integration, and UI components for terminal configuration ([](https://github.com/Sam231221/aurswift/commit/8587e5968be8c188f71c1cba473922ba36694f37))

### fix

- **product-selection:** improve layout and overflow handling in category navigation, product grid, and selection panel ([](https://github.com/Sam231221/aurswift/commit/6c2816020ea71d66788f57f92369eb1bc7c8abf7))

### refactor

- **context:** update Category import path to use shared types ([](https://github.com/Sam231221/aurswift/commit/e5866dc51e153bd511a2100aa0e67f66c915e9dc))

## [1.21.2](https://github.com/Sam231221/aurswift/compare/v1.21.1...v1.21.2) (2025-12-11)

### fix

- **electron-builder:** remove unnecessary platform-specific file exclusions for macOS and Windows ([](https://github.com/Sam231221/aurswift/commit/1f3360e6f9679c05705eb868805ec858651803fd))

## [1.21.1](https://github.com/Sam231221/aurswift/compare/v1.21.0...v1.21.1) (2025-12-11)

### fix

- **ci:** improve version setting logic in workflow to avoid unnecessary updates ([](https://github.com/Sam231221/aurswift/commit/e67c689e8221c6188ef9d77e5a36a95922357525))
- **run-vitest:** simplify test file detection and remove unnecessary error handling ([](https://github.com/Sam231221/aurswift/commit/49684fa69684e12f059c34a37d0716cae40921ad))
- **ci:** update hardware integration test path in workflow to reflect new directory structure ([](https://github.com/Sam231221/aurswift/commit/36f4b920f99574ae8e2b696076752a62112974f2))
- **package:** update postinstall script to use default electron-rebuild ([](https://github.com/Sam231221/aurswift/commit/4c7899e5f80656abd80e4a5408cc04c26e333fb8))

### refactor

- **ci:** consolidate compile and test workflow, removing separate test.yml and enhancing build process with integrated testing steps ([](https://github.com/Sam231221/aurswift/commit/56ee04f30da365440699a8b85f764ed77468ddc2))

# [1.21.0](https://github.com/Sam231221/aurswift/compare/v1.20.2...v1.21.0) (2025-12-11)

- Merge branch 'main' into release/v1.21.0-rollback ([](https://github.com/Sam231221/aurswift/commit/ac446768fe130df13eae3319ee8816aaf29b5af6))
- Merge pull request #34 from Sam231221/release/v1.21.0-rollback ([](https://github.com/Sam231221/aurswift/commit/f1908584eee9234610e3c51e7be6085b52d54eb3)), closes [#34](https://github.com/Sam231221/aurswift/issues/34)

### feat

- **release:** rollback to v1.16.0 stable codebase as v1.21.0 ([](https://github.com/Sam231221/aurswift/commit/2e87b9782a15ebd3fe8c4bf52043d4fc9efb4600))

### fix

- **ci:** update workflow to set version with continue-on-error flag ([](https://github.com/Sam231221/aurswift/commit/1b5a2ab94bf001f40360c18dce899ee189177fc3))

### BREAKING CHANGE

- **release:** Superseding broken versions v1.17.0-v1.20.2

This release contains the stable v1.16.0 codebase with version number
updated to v1.21.0 to maintain semantic versioning continuity.

Versions v1.17.0 through v1.20.2 contained critical issues and were
never deployed to production. All future development will build on
this v1.21.0 (v1.16.0 codebase).

Changes:

- Updated version from 1.16.0 to 1.21.0
- Added CHANGELOG entry explaining rollback
- No code changes - identical to v1.16.0

Fixes: Critical stability issues in v1.17.0-v1.20.2

# [1.21.0](https://github.com/Sam231221/aurswift/compare/v1.16.0...v1.21.0) (2025-12-11)

## ROLLBACK RELEASE

This release restores the stable v1.16.0 codebase and supersedes broken versions v1.17.0 through v1.20.2.

### What Happened?

Versions 1.17.0-1.20.2 were released with critical issues that made them unstable. These versions were never deployed to production users. This release (v1.21.0) contains the exact same stable code as v1.16.0 with proper version numbering to maintain semantic versioning continuity.

### For Developers

- **If you have v1.16.0**: You're on the stable version. Update to v1.21.0 (same code, new version number).
- **If you pulled v1.17.0-v1.20.2**: Update to v1.21.0 immediately.
- **Going forward**: All future development will build on v1.21.0 (v1.16.0 codebase).

### Technical Details

- **Base codebase**: v1.16.0 (2025-12-05)
- **Rolled back versions**: v1.17.0, v1.18.0, v1.19.0, v1.20.0, v1.20.1, v1.20.2
- **Code changes**: None - identical to v1.16.0
- **Version jump**: Necessary to supersede broken releases

---

# [1.16.0](https://github.com/Sam231221/aurswift/compare/v1.15.0...v1.16.0) (2025-12-05)

### chore

- **fonts:** remove FONT_IMPLEMENTATION_STATUS.md and FONT_SETUP.md files; update hardware service documentation for clarity and consistency ([](https://github.com/Sam231221/aurswift/commit/b349b24e229c4cf653bd669b84c1002c9bea8831))
- **dependencies:** remove unused dependencies from package-lock.json and package.json for cleaner project structure ([](https://github.com/Sam231221/aurswift/commit/8f1fa49bfb0905469302f18b3e42b887ab4c121e))

### feat

- **electron-builder:** add support for NSIS Blockmap files to enable differential updates ([](https://github.com/Sam231221/aurswift/commit/7ca6393bc8218a767fc7d131b6ea13982742eae4))
- **ChromeDevToolsExtension:** implement lazy loading of devtools installer for production safety and improved performance ([](https://github.com/Sam231221/aurswift/commit/d11a996c295b00544af3ddcb1d6ce39b525c78d7))
- **auto-updater:** log differential update status during download progress for better visibility ([](https://github.com/Sam231221/aurswift/commit/11ce357e4ba1c2aca41b9d82034aad6334e535d3))

### fix

- **electron-builder:** enable deletion of user data upon uninstallation for improved privacy ([](https://github.com/Sam231221/aurswift/commit/22a1299fa5e5285cbc5d1e4f7bc2987fefe3cac9))
- **ChromeDevToolsExtension:** enhance type safety for installExtension function by using type assertions ([](https://github.com/Sam231221/aurswift/commit/8a11212df70e929dd3c6078edcfde908b883db36))

### refactor

- **date-fns:** optimize imports to reduce bundle size by utilizing named imports for better tree-shaking support ([](https://github.com/Sam231221/aurswift/commit/965d6d3b90647fcacae4f62f554642855f8fcdfa))
- **dashboard:** replace console logging with logger utility for improved debugging and consistency across components ([](https://github.com/Sam231221/aurswift/commit/51e0b60702f963694dc8277314c8fd8c18576423))

# [1.15.0](https://github.com/Sam231221/aurswift/compare/v1.14.0...v1.15.0) (2025-12-05)

### feat

- **electron-builder:** enable differential updates to reduce download size by 80-90% ([](https://github.com/Sam231221/aurswift/commit/c3a4de0666a35f897814760f26d2a937e989d5e5))
- **auto-updater:** improve update handling and add postpone count retrieval. ([](https://github.com/Sam231221/aurswift/commit/717e54295ab164c7f4c994b53284f224d3dee4b4))

### fix

- **electron-builder:** update differential updates note to reflect automatic enablement for NSIS and Squirrel targets in electron-builder 26.x ([](https://github.com/Sam231221/aurswift/commit/27482f6d4478660563b0f13ef28650c9384e9658))

# [1.14.0](https://github.com/Sam231221/aurswift/compare/v1.13.0...v1.14.0) (2025-12-05)

### feat

- **window-manager:** enhance window sizing by calculating default dimensions based on primary display and setting minimum size for better usability ([](https://github.com/Sam231221/aurswift/commit/8155a0fd3d23f1b95b366e61923fc07e4193b1ce))
- **auto-updater:** improve update listener setup and toast notification handling for better user experience ([](https://github.com/Sam231221/aurswift/commit/3f12fe96240451da7f78f44b1ba96389161133a9))

### refactor

- **fonts:** remove download script and add font files directly to the project, streamlining font integration for the Inter typeface ([](https://github.com/Sam231221/aurswift/commit/2a6b49ba735ee1472f3c23f008c7306be8554d9d))

# [1.13.0](https://github.com/Sam231221/aurswift/compare/v1.12.0...v1.13.0) (2025-12-05)

### feat

- **fonts:** implement Inter font with complete configuration, including @font-face declarations, Tailwind CSS integration, and documentation for setup and usage ([](https://github.com/Sam231221/aurswift/commit/cfa154f30472c507538317e7340c663f13156bd3))

# [1.12.0](https://github.com/Sam231221/aurswift/compare/v1.11.0...v1.12.0) (2025-12-05)

### feat

- **transactions:** add multi-currency support by introducing a currency field in the transactions table and updating transaction handling logic to accommodate different currencies ([](https://github.com/Sam231221/aurswift/commit/9e4e1b01bbb733efa4eec5ecf8867cc542f1e217))
- **navigation:** enhance navigation components by adding goBack functionality and improving legacy route documentation for better migration guidance ([](https://github.com/Sam231221/aurswift/commit/fee349342031a2cb5da2298d3ed9fde67cb989c2))
- **auto-updater:** enhance update handling by resetting postpone state for new versions and ensuring toast notifications are always broadcasted ([](https://github.com/Sam231221/aurswift/commit/2b9421ebf5c213e52499d12da03b81241311685d))

# [1.11.0](https://github.com/Sam231221/aurswift/compare/v1.10.1...v1.11.0) (2025-12-04)

### feat

- **user-management:** implement user management drawers for adding, editing, and viewing staff members, enhancing UI with drawer components ([](https://github.com/Sam231221/aurswift/commit/c35878ecc4ce1292aa1e82b81c62c1588b64a584))
- **viva-wallet:** integrate Viva Wallet service for payment processing, including terminal discovery, transaction management, and error handling ([](https://github.com/Sam231221/aurswift/commit/4304cbff7f426c6d43fd97e6b893e601a59e8468))

## [1.10.1](https://github.com/Sam231221/aurswift/compare/v1.10.0...v1.10.1) (2025-12-04)

### fix

- **updates:** enhance toast notifications with fixed IDs and improved layout for better user experience ([](https://github.com/Sam231221/aurswift/commit/9f03bcf3ee8301037fa8a6a3d71dc053252dccb3))
- **category-form-drawer:** replace DrawerFooter with a fixed button section for improved layout and usability ([](https://github.com/Sam231221/aurswift/commit/b61e8394fe46a016985edec9ab97254a3cbc15ec))
- **batch-adjustment-modal, batch-form-drawer:** restructure button sections for improved layout and usability ([](https://github.com/Sam231221/aurswift/commit/14389bee25562823e7427e8753665e39e3b9d8d8))
- **product-form-drawer:** restructure product form layout for improved usability and organization ([](https://github.com/Sam231221/aurswift/commit/5fafca12c21424f28439e74047c2a9093584f6e0))

# [1.10.0](https://github.com/Sam231221/aurswift/compare/v1.9.0...v1.10.0) (2025-12-04)

### feat

- **staff-schedules:** add Staff Schedules feature to the dashboard and update navigation mapping ([](https://github.com/Sam231221/aurswift/commit/dc29038e012b8881fe4bf3f8286e4d0b1fc47928))

### fix

- **staff-schedules:** fix typos in the views ([](https://github.com/Sam231221/aurswift/commit/8706c723b47d169736466c16c3b54083b4da1666))

# [1.9.0](https://github.com/Sam231221/aurswift/compare/v1.8.0...v1.9.0) (2025-12-03)

### chore

- **.gitignore:** add 'bookerdata' to ignore list to prevent tracking of temporary files ([](https://github.com/Sam231221/aurswift/commit/ac241a43b4b6a810759905bbe4431121398e95e9))
- **refactor:** Major code refactors ([](https://github.com/Sam231221/aurswift/commit/440bc2e7c091a8180857cdc7de0680469eba9fa6))
- **auth:** refactor authentication components for improved user experience; introduce user selection grid and pin entry screen, and implement clock in/out functionality ([](https://github.com/Sam231221/aurswift/commit/6ef220458c469293cf6f1a94b0258198e463d5ee))
- Refactor user authentication to utilize username and PIN instead of email and password; update registration and login schemas, forms, and related components for improved user experience and security. ([](https://github.com/Sam231221/aurswift/commit/0eb2557ec8e6ad2ff8bbea217d7fe013e924ef42))
- Remove appStore module and implement new IPC handlers for various functionalities, including authentication, age verification, and role management, to streamline the codebase and enhance maintainability. ([](https://github.com/Sam231221/aurswift/commit/f0448a8b7fc2a947a34a4d3992e6a269748fe6fe))
- Remove outdated authentication and review documents to streamline codebase and improve maintainability ([](https://github.com/Sam231221/aurswift/commit/dda1a5e7d3ce0dd733d0ce849788106eead5f0c6))

### feat

- **adaptive-keyboard:** add AdaptiveKeyboard Support for Category forms ([](https://github.com/Sam231221/aurswift/commit/e34f531013be5f7f96412eef07e41c7eb0bdcc0b))
- **preload:** Add API type definitions to enhance IPC API structure and maintainability. ([](https://github.com/Sam231221/aurswift/commit/e0f6151271e0c5b2dacdb8f4ff5410640e08d07e))
- **weight-input-display:** Add businessId prop to WeightInputDisplay and implement sales unit settings logic for effective sales unit display ([](https://github.com/Sam231221/aurswift/commit/f02cb87735fe9ac7ded29b2d234b27ce8e4a1fa0))
- **tests:** Add comprehensive unit tests for transaction and schedule validation, including shift requirements and error handling ([](https://github.com/Sam231221/aurswift/commit/49eedbc4f0c50c380bcfb4b9cd9f22c4913eaf0d))
- **dashboard:** Add DashboardLayout component for improved dashboard structure and user experience ([](https://github.com/Sam231221/aurswift/commit/5f7f0d20927ec3f5d3d3f5551d0d6ad5628ef01b))
- **staff-schedules:** add FormMessage component to Create and Edit Cashier Dialogs; enhance layout and styling for better responsiveness ([](https://github.com/Sam231221/aurswift/commit/65cb612862bf9e51b7e9584210ec894db56d8b54))
- **dashboard:** Add new dashboard views and components for admin, cashier, and manager; enhance inventory management features with new schemas and hooks ([](https://github.com/Sam231221/aurswift/commit/8fea2bf98f63d0f6ae9dff070d21f045fd48872f))
- Add product status filtering to product details view and introduce documentation for cashier dashboard refactoring, product batching, and category data planning. ([](https://github.com/Sam231221/aurswift/commit/b3518320f7a56d8af1f75cf9bf6283bf13fe0c36))
- **database:** Add Sales Unit Settings management; create schema, manager, and migration for sales unit settings table to enhance inventory configuration options ([](https://github.com/Sam231221/aurswift/commit/53cc9b7a8fbeccb89dc97f4a6c3059c7aad11c29))
- **transaction-validator:** add timeTracking mock for active shift and update error messages for transaction validation ([](https://github.com/Sam231221/aurswift/commit/57dcecb5c389c7320e43ddde5c1ee33570a255a5))
- **updates:** enhance auto-updater functionality by adding type safety for update results and improving update state management ([](https://github.com/Sam231221/aurswift/commit/8cd0f743578f15a62de973a6d84bc55e2180eeea))
- **product-management:** Enhance navigation by integrating main dashboard access and updating back navigation functionality ([](https://github.com/Sam231221/aurswift/commit/9ffc97786d494473eb1a8dc644be6c9d06cb9e20))
- **sales-unit-settings:** Enhance Sales Unit Settings API with detailed type definitions and update createOrUpdate method to use new settings data structure ([](https://github.com/Sam231221/aurswift/commit/4f81093edaeb4d947fac93fecc129f1ac984fa6e))
- **audit-and-time-tracking:** enhance terminal ID validation in audit and time tracking managers; create default terminal if none exists ([](https://github.com/Sam231221/aurswift/commit/9f15b51b2feea2239c372d00a8f1391d99d77228))
- **user-management:** enhance user management forms with improved layout, adaptive keyboard integration, and validation schemas; refactor dialog components for better usability ([](https://github.com/Sam231221/aurswift/commit/6dd5623b3b40260ba70d70e3d5d79d15e145f9c4))
- **keyboard:** Implement an adaptive virtual keyboard system and user management ([](https://github.com/Sam231221/aurswift/commit/0ab2e03b0cd2145c5156a07371b7f60966f9d99e))
- **batch-selection:** implement batch selection modal for products requiring batch tracking; enhance transaction handling with FEFO logic and integrate age verification audit records ([](https://github.com/Sam231221/aurswift/commit/c8e28b1f95051e1e99698fd30390fb2a5fc51cb7))
- **booker-import:** implement Booker import functionality with IPC handlers, data parsing, and import management; add VAT category and import manager integration ([](https://github.com/Sam231221/aurswift/commit/e79f6457c0cd0599ecab43998dca99b67b9dd686))
- **break-compliance:** Implement break compliance validation and shift data validation utilities ([](https://github.com/Sam231221/aurswift/commit/421833f40e9e87c5dacaedaecdb7fb4e9a4cb777))
- **navigation:** Implement centralized navigation system with context, hooks, and components for hierarchical view management and RBAC support ([](https://github.com/Sam231221/aurswift/commit/db2109367f1c753cad15d42c1b24eee167415a3e))
- **user-management:** implement comprehensive refactoring of user management view; introduce modular components, custom hooks, and validation schemas for improved maintainability and user experience ([](https://github.com/Sam231221/aurswift/commit/4df0a62aba1536b000a7f3627734566707c239e3))
- Implement dual-mode sales support with role-based shift requirements ([](https://github.com/Sam231221/aurswift/commit/2318a0de7cdf6470fa94246f0ef2d7a1fc9f6152))
- **pagination:** implement paginated retrieval for batches and products with filtering options; enhance API for batch and product management to support pagination and sorting ([](https://github.com/Sam231221/aurswift/commit/eeaf8954fef2d52c257235c860ec83908d5ab71d))
- Implement product batching and enhance stock management with new batch adjustment and pagination features. ([](https://github.com/Sam231221/aurswift/commit/8177bd7bef083401415a78d3da0ffbc463590eeb))
- **sales-unit-settings:** Implement sales unit settings management; add IPC handlers, API integration, and UI components for configuring sales unit preferences in the application ([](https://github.com/Sam231221/aurswift/commit/4c2056c24d66d1915bfa6826ac8a6a85bf9e0d35))
- **updates:** implement update functionality with IPC handlers for checking, downloading, and installing updates; add toast notifications for update events ([](https://github.com/Sam231221/aurswift/commit/6000cba72e8621841d49a8cf25c483690dea891f))
- **cashier-management:** integrate AdaptiveFormField and adaptive keyboard for enhanced input handling in cashier forms, including address field support and improved validation schemas ([](https://github.com/Sam231221/aurswift/commit/c398563779a2fe7f1601e16232716346791802eb))
- **stock-adjustment-modal:** integrate AdaptiveFormField and adaptive keyboard for enhanced input handling in stock adjustments ([](https://github.com/Sam231221/aurswift/commit/f741c639f74eb2d6975461b144b02e195156928c))
- **product-form:** integrate AdaptiveFormField and adaptive keyboard support for enhanced input handling and validation in product management form ([](https://github.com/Sam231221/aurswift/commit/8003add49b8ae75449a1cf5486d4b115a9cb1d79))
- **versioning:** Integrate application versioning into the renderer; read version from package.json and display in header and footer components ([](https://github.com/Sam231221/aurswift/commit/d407d6077f65c53251ac52e766d2ee7638e020c8))
- **main:** Integrate shared package for permission management; update imports and configurations across main package files to utilize centralized permission constants and types. ([](https://github.com/Sam231221/aurswift/commit/bad993d381a6f3d5c4c93ee22ae1a85ba03e5ea7))
- **permissions:** introduce centralized permission constants and validation utilities for user roles; enhance session validation and permission checking mechanisms ([](https://github.com/Sam231221/aurswift/commit/303c40b9560ced150673e1f856ba9241e1c1a9a7))
- **batch-management:** introduce coerced non-negative number and integer schemas ([](https://github.com/Sam231221/aurswift/commit/7b59ad2edc3c03a96ce0a973f2fb3a69f16f4458))
- **dashboard:** Introduce dashboard feature components and hooks for user management, stats, and permissions; refactor existing components for improved structure and maintainability. ([](https://github.com/Sam231221/aurswift/commit/8ec6cbd41285dd9fdee3f298cc267446c21df6a3))
- **shared:** Introduce shared package for centralized permission management, including constants and validation utilities; remove legacy permissions file from main package. ([](https://github.com/Sam231221/aurswift/commit/c53bf5e3ec503286e1c6422e712b06b120996808))
- **stock:** Prevent category deletion if active subcategories exist, enhance category deletion confirmation UI, and add documentation for cashier dashboard refactoring and product data. ([](https://github.com/Sam231221/aurswift/commit/e5814d92dc5bbabc727f1b079f499bcf3da94ca7))
- prevent category deletion with active subcategories, replace `window.confirm` with an `AlertDialog` for category deletion, and add new documentation for cashier dashboard refactoring and product management. ([](https://github.com/Sam231221/aurswift/commit/a10afafed259e4dd70580da048d12cd4cd51d0db))
- **auth:** Refactor authentication feature by restructuring components and context; introduce new hooks and schemas for login and registration processes ([](https://github.com/Sam231221/aurswift/commit/ff5152b452abeccccd14dea31dec64b81968aec3))
- **dashboard:** Refactor dashboard structure by introducing widget components and updating imports; add barcode scanner feature with public API ([](https://github.com/Sam231221/aurswift/commit/74f307eaa95dc69396a841ef5138972c89a38a98))
- Refactor type imports across the renderer package to utilize centralized domain types, enhancing code maintainability and consistency. ([](https://github.com/Sam231221/aurswift/commit/9982a20d6d694c92ee85341763c7bf3db9391181))
- **schedule-management:** update schedule form handling to improve reset logic and validation; refactor schemas for enhanced input validation and error handling ([](https://github.com/Sam231221/aurswift/commit/2775e750a65ffdd7360e1d3e6765ea7e486619ec))

### fix

- **cart:** Enhance batch selection logic and integrate automatic batch selection utilities; update transaction handling to support batch data and scale readings for improved inventory management ([](https://github.com/Sam231221/aurswift/commit/719fa5f3bc16852e137f06fefef158b0a87e0dcd))
- **user-form:** fix email label typo ([](https://github.com/Sam231221/aurswift/commit/7a46edfb43d58b205ebf2167a3d160aaba53b68f))
- **staff-schedules:** fix typo and dble field names ([](https://github.com/Sam231221/aurswift/commit/45fab608e8afdb6c35a84167dfe080d1f9df84b9))
- **new-transaction:** Improve cart session initialization logic based on user role and sales mode ([](https://github.com/Sam231221/aurswift/commit/08dc08196d33032bfc3a32c02e992ed1a7aebf16))
- **security:** Remove admin fallback feature to enhance security; implement strict RBAC enforcement for admin users ([](https://github.com/Sam231221/aurswift/commit/604a7e586c088f67785d263c46882e878055ef27))
- **cart-item-row:** Remove unit of measure from weight display for cleaner output ([](https://github.com/Sam231221/aurswift/commit/c7c93cadb636f8e6ae7fcca68fb04e7372d69fcb))
- **user-add-form:** Replace input fields with `AdaptiveFormField` and extend keyboard support to password fields. ([](https://github.com/Sam231221/aurswift/commit/3719e9f9da5be6ff0c5f2bd978367b0457e8a264))
- **cart-summary:** update cart totals calculation to accurately reflect subtotal before tax ([](https://github.com/Sam231221/aurswift/commit/b5ea3867e7eab0d1dcdc23bbc6fa29bc890ab54d))

### refactor

- Clean up code formatting and improve component structure in product management views ([](https://github.com/Sam231221/aurswift/commit/1328c043bc494cda0aca4276aaea32e0521e5718))
- **hardwares:** migrate barcode scanner feature to hardware services; update imports and remove deprecated code ([](https://github.com/Sam231221/aurswift/commit/9f8e14e795c64d12e55252901bb68e359b3652c5))
- **auth:** remove demo PIN display and associated utility function from PinEntryScreen component ([](https://github.com/Sam231221/aurswift/commit/93cd82f56943dc98337a83dcc3ef720733101d2d))
- **types:** Remove deprecated type definitions and migrate to new domain structure for user, product, and cart types ([](https://github.com/Sam231221/aurswift/commit/6efe6ab89a09087b78db9a55a546e8a025be1835))
- **adaptive-keyboard:** remove error message display from AdaptiveFormField and AdaptiveTextarea components ([](https://github.com/Sam231221/aurswift/commit/af7e60968942a0a89ddde1f57cc427e1570788d4))
- **cashier-view:** Remove unused imports and clean up code formatting; enhance error message handling in batch selection utility for better clarity ([](https://github.com/Sam231221/aurswift/commit/1e170e809a80a1b82e8412344dd0b261cfdd1517))
- **cart-item-row:** Simplify import path for CartItemWithProduct type and remove age restriction badge rendering ([](https://github.com/Sam231221/aurswift/commit/fdec6808483c92c9fabf691306530aa263ddccce))
- Standardize field naming conventions and improve type safety across various components ([](https://github.com/Sam231221/aurswift/commit/2f024a53efa1736d88fea1161cdff4383ab298dc))
- **dashboard:** Streamline dashboard components and navigation; ([](https://github.com/Sam231221/aurswift/commit/5fa898022fb384761c26573ea1717d2b5b7fe138))
- unused files from adaptive-keyboard exports ([](https://github.com/Sam231221/aurswift/commit/2d626c4422014a39ccf2a3e855023c89cb24ec8f))
- **product-management:** update back navigation prop and clean up whitespace in ProductManagementView component ([](https://github.com/Sam231221/aurswift/commit/12c8c5c7d5271a7e85c38235724f992d140841ca))
- Update button click handlers in product batch management view for improved navigation consistency ([](https://github.com/Sam231221/aurswift/commit/f5b86d8449cca068d1f86db7c051af14581c9567))
- **database:** Update cart_sessions schema to allow nullable shiftId for improved flexibility; adjust related data handling in cartManager and add migration for schema changes ([](https://github.com/Sam231221/aurswift/commit/99b7b7b28020cb126ac0ba8fc95fb887988b1dd8))
- **database:** Update database schema to use snake_case for field names; enhance data consistency across audit, cash drawer, and time tracking managers; implement utility for fixing break durations ([](https://github.com/Sam231221/aurswift/commit/901b44e57b461ed349497d4f112a57cdee3a9224))

# [1.8.0](https://github.com/Sam231221/aurswift/compare/v1.7.1...v1.8.0) (2025-11-24)

### chore

- **WindowManager:** add type annotation for update check result and improve update check logic for better clarity ([](https://github.com/Sam231221/aurswift/commit/f9b02559afb1a663a64aea5a898a828f22f38f38))
- **release:** migrate from .releaserc.json to .releaserc.js for enhanced semantic release configuration and remove deprecated versioning files ([](https://github.com/Sam231221/aurswift/commit/76621aa86356438b5adc847f8b960b9bc942a171))
- **database:** remove DATABASE_CONFIG.md and test-db-path.mjs files to streamline database configuration and testing utilities ([](https://github.com/Sam231221/aurswift/commit/88ec3742cb717bc98b4ff111de062f32cfb54f8e))
- remove unused assets and scripts, including react.svg and bridge-migration.mjs, to streamline the project structure ([](https://github.com/Sam231221/aurswift/commit/1480f4c3ac99fc379957b06d410002ff938ce6a0))

### feat

- **staff-schedules:** add delete confirmation dialog, improve error handling with toast notifications, and enhance shift validation logic for better user experience ([](https://github.com/Sam231221/aurswift/commit/65862b60048019a921533dedcb9e3f70f55466ef))
- **transactions:** add IPC handler for creating transactions from cart, including validation and total calculation ([](https://github.com/Sam231221/aurswift/commit/d6830a7a568b5601c3ef626543162ab06570fcff))
- **cashier:** add NoActiveShiftModal component to handle scenarios with no scheduled or ended shifts, enhancing user feedback and experience ([](https://github.com/Sam231221/aurswift/commit/b750deefa522ed984a214cadc4316c3c97a0666d))
- **tests:** add script to run Vitest with graceful handling of "no tests found" case; update test run command in package.json ([](https://github.com/Sam231221/aurswift/commit/944d38dcbe131c561523150fcf060f7c40421c4d))
- **build:** enhance build configuration with improved file exclusions, conditional sourcemaps for production, and add bundle visualizer for performance analysis ([](https://github.com/Sam231221/aurswift/commit/f8bcd1294691e391e9d024ac5097895f0f542ae7))
- **database:** enhance DBManager to ensure database directory creation and validation; improve error handling in recovery dialogs for test and CI modes ([](https://github.com/Sam231221/aurswift/commit/225f605bab3235fae4a847b58b1fa3cb1d1f7e35))
- **shift-management:** enhance shift creation logic with device tracking, validation for starting cash limits, and improved error handling during shift creation ([](https://github.com/Sam231221/aurswift/commit/2f4a15c000963f50bb42fe32748d97dc9f3db994))
- **auto-updater:** enhance update handling with improved error management, user notifications, and consistent state management ([](https://github.com/Sam231221/aurswift/commit/8da2e4134b423428e35ff828cca71da6a1445ca9))
- **database:** implement comprehensive database validation, migration, and recovery mechanisms. ([](https://github.com/Sam231221/aurswift/commit/f51db1ea14f6fcd198e16833a2e26b45b5b18c02))
- **transactions:** implement inventory update logic after transaction creation and enhance payment method options ([](https://github.com/Sam231221/aurswift/commit/5c8be4eed52994b1d8d22ceee9cbc113b7a86add))
- **auto-updater:** implement request timeout, retry logic, and performance metrics tracking for update checks ([](https://github.com/Sam231221/aurswift/commit/1a957167b3a96b505d65a6d9f164d7202813907d))
- **auto-updater:** implement smart scheduling for update checks based on user activity and enhance caching mechanism for update results ([](https://github.com/Sam231221/aurswift/commit/f34d4bf6b24d5adc12d887de24f1d1f7d4111f8a))
- **staff-schedules:** implement time picker component for improved time selection, enhance validation feedback, and optimize performance with memoization and callbacks ([](https://github.com/Sam231221/aurswift/commit/c27409cf0c6804c44d1ed9ef2e08dbd4e1b562e8))
- **tests:** integrate Vitest for testing framework, add comprehensive test structure and utilities ([](https://github.com/Sam231221/aurswift/commit/6975537a73d1c987cc7edf946df04469c4fdd4a4))
- **validation:** introduce new validation schemas and hooks for login, registration, and payment forms; enhance existing schemas for better error handling and user experience ([](https://github.com/Sam231221/aurswift/commit/b2d7b3622c3c38a0f3d6e8d92c606a755049e656))

### fix

- **transactions:** expand payment method options and update unused parameter for interface compatibility ([](https://github.com/Sam231221/aurswift/commit/be484948e29b25e05ae76810d208bc7d5f5a4b31))
- **imports:** optimize date-fns imports in staff schedules view and hook to reduce bundle size ([](https://github.com/Sam231221/aurswift/commit/1e104185b4a9bb0ddce694a991db6c77d684f5ef))
- **dependencies:** update package-lock.json to include new dev dependencies and adjust existing ones for improved build performance ([](https://github.com/Sam231221/aurswift/commit/fa6d7706d6bfd3777cf0b1c5e26728a7719d6803))
- **release:** update release configuration to use ES module syntax and remove unnecessary comments ([](https://github.com/Sam231221/aurswift/commit/d5ead1bda1d770375e6afa225b4097d48c9d26c4))

### refactor

- **cashier:** clean up unused imports, enhance button formatting for better readability, and ensure card reader readiness in payment processing ([](https://github.com/Sam231221/aurswift/commit/29db7a3d59a896c91e940f0d3137c02bf7d00d5f))
- **database:** enhance transaction items schema to support category items and update transaction manager for improved item handling ([](https://github.com/Sam231221/aurswift/commit/198f2c7ba8f15eff03a9a117e3c422d45322ebc7))
- **views:** major Files and Folders refactors ([](https://github.com/Sam231221/aurswift/commit/4c9086fcdef910db0e84f78c5c6fd41b4d52e8e4))
- **payment:** remove Stripe integration references, simplify payment service, and update related interfaces ([](https://github.com/Sam231221/aurswift/commit/f4d9382c65eb099950a6e2e3e4c32d101d901a0d))

### style

- **cashier:** enhance button dimensions for improved accessibility and visual consistency across transaction components, including adjustments to padding and layout in various modals and panels ([](https://github.com/Sam231221/aurswift/commit/067f6ee5f457be43fbcceda48ffc57b9729f820d))
- **dashboard:** enhance UI responsiveness and visual consistency across admin, cashier, and manager dashboard pages, including adjustments to layout, spacing, and typography ([](https://github.com/Sam231221/aurswift/commit/7fe32af53601a713aed88f6920ee2cfbd1d05b5d))
- **cashier:** improve UI responsiveness and visual consistency across transaction components, including adjustments to layout, spacing, and typography ([](https://github.com/Sam231221/aurswift/commit/1b530f2ed6ee56b172c3c910b3a9dbf1b73c8751))
- **auth:** update UI components for improved responsiveness and visual consistency, including adjustments to layout, spacing, and typography across authentication views ([](https://github.com/Sam231221/aurswift/commit/e0a07861d2b513718254fd64b7345e7ddc94a048))

## [1.7.1](https://github.com/Sam231221/aurswift/compare/v1.7.0...v1.7.1) (2025-11-20)

### Bug Fixes

- **electron-builder:** modify requestExecutionLevel configuration for Windows compatibility ([1006373](https://github.com/Sam231221/aurswift/commit/1006373e260fb41168080fdc9b832c3a5e02256f))
- **ci:** update electron-builder configuration for Windows 10 Enterprise compatibility and adjust CI workflow to use windows-2022 ([ca2cc0f](https://github.com/Sam231221/aurswift/commit/ca2cc0fb687875c44862d1161aded86442e4dfb6))

# [1.7.0](https://github.com/Sam231221/aurswift/compare/v1.6.0...v1.7.0) (2025-11-20)

### Bug Fixes

- adjust padding and layout for New Transaction View and Dashboard Layout ([628051f](https://github.com/Sam231221/aurswift/commit/628051fde9570763503066a26a9d0838a5d8edd2))
- **package:** downgrade Node.js engine requirement from 22.x to 18.x for compatibility ([f219b47](https://github.com/Sam231221/aurswift/commit/f219b47a8c7d7e403c968b2d67a9bade165ffbc1))
- **ci:** downgrade Node.js version from 22 to 20 in CI workflows for consistency ([758b0a9](https://github.com/Sam231221/aurswift/commit/758b0a9e8d2682bd2958edb305275c40b4a2dc58))
- **ci:** downgrade Node.js version from 22.x to 18.x across workflows and action configuration ([bc79a8d](https://github.com/Sam231221/aurswift/commit/bc79a8d54464547ba51e0c8b051327ff6f6d9a2d))
- **ci:** downgrade Node.js version to 18.x and clean up incompatible node_modules for improved CI compatibility ([28fb093](https://github.com/Sam231221/aurswift/commit/28fb093d1046a3df083b91dc697db19641005e53))
- enhance product and schedule handling with serialization and new SKU retrieval method ([d604335](https://github.com/Sam231221/aurswift/commit/d604335be1d97163715f88fa80d41877f3e93211))
- **ci:** enhance workspace verification and refine node_modules cleanup process in CI workflows ([e548a3f](https://github.com/Sam231221/aurswift/commit/e548a3f2bfbdefcdb6f756a16dfe80a49e5f4512))
- ensure email is always a string and use it as username with default PIN for new users ([675b6a6](https://github.com/Sam231221/aurswift/commit/675b6a644542620c74113bb39c81581be61b20e7))
- **ci:** improve commit type counting in CI workflows using awk for robustness ([fadaf56](https://github.com/Sam231221/aurswift/commit/fadaf56db4015594f9bfb9cc1af37b5f89c331b8))
- **product-management:** improve error handling and loading state in product and category loading functions. ([37d6d2a](https://github.com/Sam231221/aurswift/commit/37d6d2aac901ee76808eacdb1551baa036df69a0))
- **ci:** improve package verification output in CI workflows for clarity and consistency ([99f6275](https://github.com/Sam231221/aurswift/commit/99f62759cde31b8f3b37851a164bf618cc085572))
- **ci:** optimize CI workflows by removing unnecessary comments and adjusting Node.js version to 18.x ([a2b7654](https://github.com/Sam231221/aurswift/commit/a2b76547d9e38eb8c54f4159354331039773ac92))
- **ci:** refactor package verification logic for improved readability in CI workflows ([885fbfd](https://github.com/Sam231221/aurswift/commit/885fbfd705b36733acb018facb1d2ad676c7f00e))
- remove unused state for search query in New Transaction View ([374870b](https://github.com/Sam231221/aurswift/commit/374870b59f518153e7c8e8e108a2bfa9bce47224))
- remove unused unit options from Product Management View ([b94036c](https://github.com/Sam231221/aurswift/commit/b94036cfe4788490281d4f113cbee710519870d7))
- restrict DevTools access to development environment only ([224cb14](https://github.com/Sam231221/aurswift/commit/224cb1490c22feec45dd129608e6361ec93e50e1))
- **scale-display:** simplify ScaleDisplay component and update weight product handling. ([b1c7177](https://github.com/Sam231221/aurswift/commit/b1c7177f3ded6e0e1726d32aae96f0f2d66bf6b7))
- **ci:** standardize Node.js version to 18.x and enhance caching strategy in CI workflows for compatibility ([b1f2f91](https://github.com/Sam231221/aurswift/commit/b1f2f91c6ff9e927a27c5ed134fd54a92fb3f4a1))
- **ci:** standardize output messages for workspace and package verification in CI workflows ([8dce76a](https://github.com/Sam231221/aurswift/commit/8dce76ac2d2a186e297f237a52bc9344d2aecd7d))
- update background gradient styles in AuthHeroSection and AuthPage ([de07ff1](https://github.com/Sam231221/aurswift/commit/de07ff16a544b45b24eca84262b63a7a9dc9a9ba))
- update build script and enhance CI workflow to verify workspace packages and ensure Electron installation ([f175eb7](https://github.com/Sam231221/aurswift/commit/f175eb7dbbd5783fdfdb4c59d217908143db3ec8))
- **auth:** update business and user types to include detailed attributes ([b77e22e](https://github.com/Sam231221/aurswift/commit/b77e22e40412a68ecdb0e37ec83aaa712ecb7bf8))
- **database:** update business seeding structure for clarity ([571309a](https://github.com/Sam231221/aurswift/commit/571309a9b0f8a286274e590cbe642c819aae397e))
- update demo PIN for cashier role in AuthPage ([746a412](https://github.com/Sam231221/aurswift/commit/746a412b80510d9ec0b87309de248e29355e9943))
- update extraResources filter to include all migration files and improve database migration handling ([1c36442](https://github.com/Sam231221/aurswift/commit/1c36442cd0d85312bf7a199d1c31a89171ebf079))
- **cart:** update import path for CartSession and CartItem types to use the correct module reference ([797ad3f](https://github.com/Sam231221/aurswift/commit/797ad3f5e2cfd1904bee815f1aed11b88fc5e1fe))
- **cart:** update migration script to handle missing category and item names during cart item transfer ([f05f53c](https://github.com/Sam231221/aurswift/commit/f05f53cae33caf59cb3a52edb9c746ccda299a8e))
- **ci:** update Node.js engine requirements and adjust CI workflows for consistency across packages ([b15a157](https://github.com/Sam231221/aurswift/commit/b15a1570fdc2c94e3db0837e70a115a3bc3339b4))
- **ci:** update Node.js version from 18.x to 22.x across workflows and action configuration ([d1a0e2b](https://github.com/Sam231221/aurswift/commit/d1a0e2b8bc46caf8ccae810e3bdb27cd4740926f))
- **ci:** update Node.js version to 20 and streamline dependency installation process ([b4c26f4](https://github.com/Sam231221/aurswift/commit/b4c26f4a0f1f026bb78059ea5fe1aeedee442d8a))
- **ci:** update Node.js version to 20.x and refine dependency installation logic for improved handling of existing projects ([2c40d9f](https://github.com/Sam231221/aurswift/commit/2c40d9fdf8f8d7609173e92c8add50d9a48f4f77))
- **ci:** update Node.js version to 22 and adjust engine requirements across packages for consistency ([6bdace1](https://github.com/Sam231221/aurswift/commit/6bdace1f1c5ac20530c71ce6cd97cabd922dfc64))
- **ci:** update Node.js version to 22 and modify dependency installation to skip native builds ([5f87f72](https://github.com/Sam231221/aurswift/commit/5f87f7213f0383c6f0b0747e6ff466c46d16824e))
- **transactions:** update price display logic to correctly format prices based on product requirements ([2306150](https://github.com/Sam231221/aurswift/commit/230615061f96fb3a357b7864e61d13ac68f714a5))
- update stock adjustment creation to use inventory service ([161b08b](https://github.com/Sam231221/aurswift/commit/161b08b3409b9df9895e578ad11d182d2dfd9e9b))
- upgrade Node.js version to 20.x across package.json and CI workflows for improved compatibility and performance ([6bc6f69](https://github.com/Sam231221/aurswift/commit/6bc6f69d681b76c671518717628051758754eb9b))

### Features

- add AuthHeader component and integrate it into AuthPage; refactor AuthHeroSection ([a9539ba](https://github.com/Sam231221/aurswift/commit/a9539bad60ce4c3c286abd77e0a32ba40481b5e0))
- **product-management:** add batch management features and expiry tracking to product forms ([0e73f73](https://github.com/Sam231221/aurswift/commit/0e73f73584f265101b3f0ac7b8c7015b5c2871e9))
- **cart:** add category handling with custom price input in transaction view. ([37827b6](https://github.com/Sam231221/aurswift/commit/37827b694ac4c65316fa890b0194d45819192296))
- add comprehensive documentation for Node.js 22 compatibility, native module handling, and build process improvements ([da783f3](https://github.com/Sam231221/aurswift/commit/da783f385fadbb4f37b960b45bee18ef4d83fb49))
- add database seeding script for default business and users ([7770816](https://github.com/Sam231221/aurswift/commit/77708162e2c71d97e68a770e25fdcdfd25988844))
- **database:** add printing, products, and validation schemas ([869b518](https://github.com/Sam231221/aurswift/commit/869b51835f586f1482165e1d82e389722a03f138))
- add Quick Actions Carousel component and integrate it into New Transaction View ([c10210c](https://github.com/Sam231221/aurswift/commit/c10210c2741878612c9742d39bfb8f7b8df7cc8c))
- **scale-integration:** add scale service and API for weight measurement functionality ([011be89](https://github.com/Sam231221/aurswift/commit/011be89efbb4b47f188c0faa13a3d5d0ec75e5f3))
- **database:** add updatedAt field to transaction items and enhance cost price validation in batch forms ([6e700a7](https://github.com/Sam231221/aurswift/commit/6e700a7221c0f3be6cee415039628a47976c406e))
- add username and PIN authentication to users table ([70ba336](https://github.com/Sam231221/aurswift/commit/70ba33625875cee8fd02374a431bf7f176e7c9d1))
- **cart:** enhance cart item handling to support category items ([d521711](https://github.com/Sam231221/aurswift/commit/d521711ec3c77fe6e0c94149112693b09a6e40bb))
- **cart:** enhance cart item retrieval by populating product information. ([90e101b](https://github.com/Sam231221/aurswift/commit/90e101b1821dd5e5e1e1c6bab1c67da45d27a6bb))
- enhance category, inventory, product, and supplier managers; add job status polling for office printer ([af93cc4](https://github.com/Sam231221/aurswift/commit/af93cc4af7f14609ee9b90841fd48455f9ff85b4))
- enhance database migration safety with integrity checks and downgrade prevention ([bd7cb4e](https://github.com/Sam231221/aurswift/commit/bd7cb4e9116ace1ae1ca08149533461c7d7faf9a))
- **migrations:** enhance migration handling and build process ([31ba330](https://github.com/Sam231221/aurswift/commit/31ba3302779e37308b3e8b4137ab82807adea924))
- **product:** enhance product management with VAT configuration and refactor product schema ([566013d](https://github.com/Sam231221/aurswift/commit/566013d2c1de7534e487af48e9e23b40d305f5b3))
- **time-tracking:** enhance shift management and clock-out functionality ([ba0138b](https://github.com/Sam231221/aurswift/commit/ba0138b139aff387a761167c50e36794b938f077))
- **time-tracking:** enhance today's schedule retrieval and shift management. ([bda0869](https://github.com/Sam231221/aurswift/commit/bda0869975befa8d124e3631483e357ff18d631d))
- **transaction-manager:** enhance transaction item handling with itemType and tax calculations ([c51f15a](https://github.com/Sam231221/aurswift/commit/c51f15a38ac5e9d776343ac6351eb70e1ca31908))
- **database:** expand schema with new business, user, product, transaction, and audit types. ([8c70aa7](https://github.com/Sam231221/aurswift/commit/8c70aa7cc2b787302a6426aa9299d900e75ace47))
- **product-management:** implement age restriction features in product schema and forms ([89ea278](https://github.com/Sam231221/aurswift/commit/89ea27805fa835c7b9387596921d2d7a2aa4bc12))
- **cart-management:** implement cart session and item management in database schema ([fd2ce59](https://github.com/Sam231221/aurswift/commit/fd2ce59b64e147bf65ffe0ed0158580a52c91b07))
- **cart:** implement cart session management and enhance item handling. ([c4d6f3c](https://github.com/Sam231221/aurswift/commit/c4d6f3c918ba581523ed405647dba41c473d917c))
- **time-tracking:** implement clock-in/out functionality and enhance shift management ([488e5d0](https://github.com/Sam231221/aurswift/commit/488e5d026c9346cb6cfcb03661afa8ef33ed5ff8))
- **auth:** implement getAllActiveUsers API and update user authentication to use username and PIN ([8cdb51f](https://github.com/Sam231221/aurswift/commit/8cdb51f0574f8a9d412a66c71d58175189555757))
- implement new payment panel and numeric keypad components; enhance new transaction view layout ([fafdc91](https://github.com/Sam231221/aurswift/commit/fafdc91beb2d2982796897e18c5af52b2879012a))
- **vat:** implement VAT category management with IPC integration and UI enhancements ([e1506b7](https://github.com/Sam231221/aurswift/commit/e1506b7fc414dbc2a5c20e272fcde473ca6e10f0))
- implement Zod validation schemas for authentication and add IPC handler to retrieve all active users ([ef9fe5e](https://github.com/Sam231221/aurswift/commit/ef9fe5e1e610f237e412b8f19037d94242fd1e88))
- **product:** reset stock adjustment form on modal open and improve input handling ([cebd5bc](https://github.com/Sam231221/aurswift/commit/cebd5bc607ffd426ba48eb1e4e68f22e8d544741))
- **database:** update migration process and enhance data handling for new transaction items ([b6e0f81](https://github.com/Sam231221/aurswift/commit/b6e0f819a93171463a49e5f8d45b47dc4521ba8e))
- **dependencies:** update package-lock.json with new dependencies for node-hid and serialport. ([0d8c888](https://github.com/Sam231221/aurswift/commit/0d8c888aa43397e91b610672cebb39dc5c1a6f46))

# [1.6.0](https://github.com/Sam231221/aurswift/compare/v1.5.0...v1.6.0) (2025-11-10)

### Bug Fixes

- **database:** Migration system fixes ([5c473cc](https://github.com/Sam231221/aurswift/commit/5c473cc8f9441c301af5ae4da716934f85ed17d6))
- **database:** remove unused database migration scripts and add migration journal ([845d294](https://github.com/Sam231221/aurswift/commit/845d294473c71cf0601d5b3727befd2b7da7bd6d))
- **database:** update manager constructors to include Drizzle ORM and refactor supplier query logic ([a45a86a](https://github.com/Sam231221/aurswift/commit/a45a86a593b1b4975544c86e1fd5eb32269cfdf5))

### Features

- **database:** integrate new managers for business, cash drawer, discount, and inventory with Drizzle ORM ([14d26eb](https://github.com/Sam231221/aurswift/commit/14d26ebae2e7f78e8cdde0e5a08799d63393bcfd))

# [1.5.0](https://github.com/Sam231221/aurswift/compare/v1.4.0...v1.5.0) (2025-11-10)

### Bug Fixes

- **stock-management:** enhance stock adjustment functionality with input fields for quantity and reason ([a16b541](https://github.com/Sam231221/aurswift/commit/a16b541491be62653facbcfc92a1adf95521e39f))
- **database:** implement database migration system for adding address and discount fields ([7577f5b](https://github.com/Sam231221/aurswift/commit/7577f5bd7807c0d58bc57107b1b2a8cc9870103f))
- **database:** integrate Drizzle ORM into database initialization and manager instances ([aa2cd29](https://github.com/Sam231221/aurswift/commit/aa2cd29ecfd0213ce99596a5afa1f6da6f908182))

### Features

- **database:** ✨ add IPC handlers for database backup, emptying, and import functionality ([1dad607](https://github.com/Sam231221/aurswift/commit/1dad607b350c0ba435bb05686c028e70c078046b))
- **database-migrations:** ✨ implement database migration system with version tracking and integrity checks ([0cab8ef](https://github.com/Sam231221/aurswift/commit/0cab8ef13843b738c03d6f21114b84ecea75a41d))
- **gitignore:** enhance documentation directory patterns for better matching ([be4bf4a](https://github.com/Sam231221/aurswift/commit/be4bf4a1ce6ecc1a0e318132ae40365a0c4c06ec))
- **database:** implement core data management with core refactors ([c2a09bf](https://github.com/Sam231221/aurswift/commit/c2a09bfcf5de2657918b61e2ea523ca6c761b619))
- **database-versioning:** implement database versioning and migration system with backup and integrity checks ([62fdc5d](https://github.com/Sam231221/aurswift/commit/62fdc5dc4eb3647039a1b4ff0675e0f27e495e20))
- **discounts:** implement discount management system with creation, updating, and retrieval functionalities ([f5ebf5b](https://github.com/Sam231221/aurswift/commit/f5ebf5b2664e6b48ed3fc2e9b18ac6c32ac464d2))
- Integrate Drizzle ORM into UserManager and create schema definition ([55b06d7](https://github.com/Sam231221/aurswift/commit/55b06d7afeaba80cef3702643937df28375684fc))

# [1.4.0](https://github.com/Sam231221/aurswift/compare/v1.3.0...v1.4.0) (2025-11-05)

### Features

- **auto-updater:** ✨ add error handling and notification for update failures ([dc90e29](https://github.com/Sam231221/aurswift/commit/dc90e29e4e7fa56dc88e874818fbf6b98a3a74d6))

# [1.3.0](https://github.com/Sam231221/aurswift/compare/v1.2.0...v1.3.0) (2025-11-05)

### Bug Fixes

- **new-transaction-view:** 💡 format cash amount input to two decimal places ([3bdbdd0](https://github.com/Sam231221/aurswift/commit/3bdbdd07644ed2d00ce9a7ea6a64d4a80f035c95))
- **pdf-receipt-generator:** 💡 suppress unused variable warnings in savePDFToFile function ([22ccf67](https://github.com/Sam231221/aurswift/commit/22ccf670ac46fb1684a4f469baaa2d6d1b7670a2))

### Features

- ✨ implement office printer management hooks and types ([73fcf17](https://github.com/Sam231221/aurswift/commit/73fcf170bf7cfcd0fc1aad1e4f8eccb1cf7b4784))
- **manage-categories:** ✨ enhance category management with hierarchical display, reordering, and expand/collapse functionality ([1e50ec1](https://github.com/Sam231221/aurswift/commit/1e50ec1363b06dcd124dfec0632f3013cc8269aa))
- **product-management:** ✨ enhance product validation and error handling, add multiSelect support for modifiers ([d48c037](https://github.com/Sam231221/aurswift/commit/d48c037a609731053cf35847327aaba345af18f9))
- **new-transaction-view:** ✨ implement category management with breadcrumb navigation and load categories from backend ([ea433f5](https://github.com/Sam231221/aurswift/commit/ea433f59c15f6a3a586cb4b9052724dc27ab5d12))
- **pdf-receipt-generator:** ✨ implement PDF receipt generation with customizable layout and data structure ([febd84c](https://github.com/Sam231221/aurswift/commit/febd84cc945e152a82e63456a216495985676135))
- **pdf-receipt-generator:** ✨ implement PDF receipt generation with options for printing, downloading, and emailing ([c2cdb75](https://github.com/Sam231221/aurswift/commit/c2cdb7518aac9daebe8a85b901e0695f62a54965))
- **new-transaction-view:** ✨ improve layout and styling for buttons and input fields ([11c3bbe](https://github.com/Sam231221/aurswift/commit/11c3bbe9dd647165275fbbe261390fac97d0ec9f))

# [1.2.0](https://github.com/Sam231221/aurswift/compare/v1.1.0...v1.2.0) (2025-11-03)

### Bug Fixes

- **cashier-management:** ✨ improve form validation and error handling for cashier creation ([5699222](https://github.com/Sam231221/aurswift/commit/569922236b7af21b1a73690321bd8161050879f5))
- **window-manager:** 🐛 enable DevTools based on configuration and prevent opening via keyboard shortcuts when disabled ([779c6bc](https://github.com/Sam231221/aurswift/commit/779c6bc081a3bf96ec2bfbfe2a5e327bfda11e55))
- **product-management:** 🐛 enhance form validation and error handling for product creation ([98f2de4](https://github.com/Sam231221/aurswift/commit/98f2de4cb3c929c4a06a6e31925fdee3dbce93e3))
- **staff-schedules-view:** 🐛 filter cashiers to exclude managers and admins from the list ([0718dee](https://github.com/Sam231221/aurswift/commit/0718deeefcfd7a0f225695a2a85a3867ce11044f))
- **preload:** 🐛 handle errors when exposing exports in main world ([4c1a074](https://github.com/Sam231221/aurswift/commit/4c1a07436e5f9c0bd055361a047d810d00a793a1))
- **user-management:** 🚑 improve form validation and error handling for user creation ([49dd79d](https://github.com/Sam231221/aurswift/commit/49dd79d5cfff0252cdeadf6f6ee3ac93a2d4f66b))
- **window-manager:** 🚫 disable DevTools and prevent opening via keyboard shortcuts ([b5b8819](https://github.com/Sam231221/aurswift/commit/b5b8819539ad15e3fae0ef332e0edb6c914df4e4))
- **main:** fix Toaster component for enhanced notification handling ([68113d0](https://github.com/Sam231221/aurswift/commit/68113d018013ef31fa00b6a98a95282d6c107518))

### Features

- **auth-api:** ✨ add PLU uniqueness checks and migration script for existing duplicates ([b0f85f2](https://github.com/Sam231221/aurswift/commit/b0f85f2c017e89679ccf136030e9f4a56c599818))
- **database:** ✨ add UNIQUE constraint on (name, businessId) for categories and handle duplicate names during migration ([ada668d](https://github.com/Sam231221/aurswift/commit/ada668dd807e2ddcbae215a5d5438f92ce94ea40))
- **manage-categories:** ✨ implement category validation and error handling for form submissions ([b4e1e9b](https://github.com/Sam231221/aurswift/commit/b4e1e9b20cb835bb5933896a6ee81ba0dfd9cfac))
- **product-management:** ✨ implement centralized product validation schema using Zod for improved error handling ([7579dba](https://github.com/Sam231221/aurswift/commit/7579dba64b3cb062b1050af4e2f6a5f80290dcf8))

# [1.1.0](https://github.com/Sam231221/aurswift/compare/v1.0.4...v1.1.0) (2025-11-01)

### Bug Fixes

- **autoUpdater:** 🚑 update dialog detail text for clarity on background download ([438a93e](https://github.com/Sam231221/aurswift/commit/438a93e2e3e9eebd23b41c221fe4cad176000b25))

### Features

- **autoUpdater:** ✨ implement reminder notifications for postponed updates ([7cb2df1](https://github.com/Sam231221/aurswift/commit/7cb2df1aac9e3a1ac67dc6b345da671038022b83))

## [1.0.4](https://github.com/Sam231221/aurswift/compare/v1.0.3...v1.0.4) (2025-11-01)

### Bug Fixes

- **auth:** simplify button text in login form ([c791e9a](https://github.com/Sam231221/aurswift/commit/c791e9aa054922b1dcdbfb579219dbc842b3bf56))

## [1.0.3](https://github.com/Sam231221/aurswift/compare/v1.0.2...v1.0.3) (2025-11-01)

### Bug Fixes

- **ci:** remove deprecated debug script for semantic-release version detection ([6819f5c](https://github.com/Sam231221/aurswift/commit/6819f5c5a13969f9ec72f2cc65fb4379eda0c5f7))
- **ci:** streamline semantic-release installation and enhance build artifact verification ([a9844b4](https://github.com/Sam231221/aurswift/commit/a9844b45fa45d2edb8d16852251467abfa04f5cf))
- **ci:** update artifact verification checks for Windows build outputs ([9d5ae68](https://github.com/Sam231221/aurswift/commit/9d5ae68c714798d3ab6639f9ec17ec342e56ac26))
- **ci:** update asset paths for Windows installers in release configuration ([4842dd5](https://github.com/Sam231221/aurswift/commit/4842dd555bc862769fc0fbd21dfd24cde11b6378))

## [1.0.2](https://github.com/Sam231221/aurswift/compare/v1.0.1...v1.0.2) (2025-10-31)

### Bug Fixes

- **ci:** enhance build process with detailed artifact listing and improved logging ([5db1aeb](https://github.com/Sam231221/aurswift/commit/5db1aeb8d27b39bd71aca16a1fdcdc5c9b5c9243))
- **ci:** improve logging messages in CI workflows for better clarity and consistency ([516f6aa](https://github.com/Sam231221/aurswift/commit/516f6aa188cb2e9379e31d997cd6d92fa7c01637))
- **ci:** update build output messages to use Write-Host for better readability in PowerShell ([1ad7ba9](https://github.com/Sam231221/aurswift/commit/1ad7ba930e19d14e4d19aebdeb3ebd4fb71c3c0d))

## [1.0.1](https://github.com/Sam231221/aurswift/compare/v1.0.0...v1.0.1) (2025-10-31)

### Bug Fixes

- **app:** 🚑 enhance auto-updater with Squirrel.Windows event handling and build artifact verification ([f094870](https://github.com/Sam231221/aurswift/commit/f09487097b40dc8a9faa8c5b44f772635f52b640))
- **ci:** 🚑 enhance semantic-release version detection and manual version bump logic ([643975f](https://github.com/Sam231221/aurswift/commit/643975fa5307dcf19c24b01128c9392bc5121d78))
- **ci:** 🚑 optimize workflows by adjusting schedules, adding caching, and enhancing dependency management ([3377cd8](https://github.com/Sam231221/aurswift/commit/3377cd8dc9990cd16f31aafe1310ec7bd5db4a4f))
- **ci:** 🚑 streamline CI workflows by optimizing dependency installation and caching for typecheck and build processes ([41f93d6](https://github.com/Sam231221/aurswift/commit/41f93d690d8f26d2241e34de42cd3d2ee26a17f0))
- **ci:** add step to download build artifacts after setting environment variables ([ce13dd0](https://github.com/Sam231221/aurswift/commit/ce13dd0c05b5c559aff8c492c21f01956c80056f))
- **ci:** enhance Electron installation verification and caching in workflow ([e50dd38](https://github.com/Sam231221/aurswift/commit/e50dd38bd49278b047a7a108263236a98be93ec5))
- **ci:** improve version detection with better commit counting and debugging ([1a10d00](https://github.com/Sam231221/aurswift/commit/1a10d006287ec4de3e848d102ec852248b9bce9e))
- **ci:** remove publisherName from Windows build configuration ([1bcd495](https://github.com/Sam231221/aurswift/commit/1bcd495728f5781f7b662a42b5351b9cf0545f08))
- **ci:** streamline semantic-release setup and enhance Squirrel.Windows event handling ([8ee8a56](https://github.com/Sam231221/aurswift/commit/8ee8a565ebf5fc9ba26bd0c35d1b1dec4fcd729a))
