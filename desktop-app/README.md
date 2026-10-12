# Cleanroom Control Windows apps

The Windows desktop apps (a window around the live Cleanroom Control website):
**Cleanroom Control** for customers and **Cleanroom Control Support** for Service Providers.
A copy of `cleanroom-cloud/apps/desktop`; change both if you change one.

You don't build these by hand. When this folder changes and you `git push`,
GitHub builds both installers on its own Windows computers (about 5 minutes,
see the **Actions** tab) and puts them on the release that the website's
**Download for Windows** buttons use.

New version: raise `"version"` in `package.json` (e.g. `1.0.1`) and push.
Rebuild without changes: GitHub -> **Actions** -> **Windows apps** -> **Run workflow**.
