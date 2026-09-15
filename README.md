# tag-watch

A compact React Native stopwatch app for Windows, Android and iOS. The application lives in `app/`.

## Behavior

- Starts with one paused stopwatch. Start begins timing it.
- Add stopwatch creates the next numbered stopwatch and immediately starts it, pausing the previous one.
- Starting any stopwatch pauses the running stopwatch. Pausing preserves its accumulated time.
- Tap/click a name to edit inline; Enter or leaving the field saves it. Empty names keep the previous name.
- Reset confirms, pauses and zeroes the selected stopwatch. Delete confirms and removes it; the last stopwatch cannot be deleted.
- Cards fill rows from left to right, wrapping into a vertical scroll pane.
- Dark mode is the default. Light mode, names, order and elapsed times are saved locally, with no account required.
- Elapsed time displays hours, minutes and seconds, including durations longer than 24 hours.

## Run

Requires Node 22.11 or newer. From the project directory:

```powershell
cd C:\dev\projects\tag-watch\app
npm ci
npm start
```

Leave Metro running and use a second terminal in `app/`:

```powershell
npm run windows
# or, with an Android emulator or device connected:
npm run android
```

For a standalone Windows installation that does not need Metro, run `npm run windows:release` from `app/`. This builds, installs and launches the `Release` configuration, which already enables `UseBundle=true`. Do **not** add `--bundle`: that older CLI option requests a `ReleaseBundle` solution configuration, which this RNW 0.84 project does not define.

Verified on 2026-09-15: `npm run windows:release -- --no-telemetry` successfully built, deployed and launched the Release executable, with no listener on Metro port 8081. The app project quotes the Hermes compiler path so NuGet folders under user profiles containing spaces work. Visual interaction and lifecycle verification remain outstanding; desktop app access timed out during verification.

Windows requires the Visual Studio C++/Windows SDK and .NET development prerequisites documented in the [React Native Windows setup guide](https://microsoft.github.io/react-native-windows/docs/rnw-dependencies). The generated solution is `app/windows/TagWatch.sln`. For a standalone app, build the Release configuration and package using `TagWatch.Package`; a debug build uses Metro.

Android requires Android Studio, its SDK and an emulator or physical device. See [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment).

iOS requires macOS and Xcode. On a Mac, install the project's Ruby dependencies, then CocoaPods:

```sh
cd app
npm ci
bundle install
cd ios
bundle exec pod install
cd ..
npm run ios
```

App-store signing and distribution are not configured. Windows uses the custom tag-watch icon; mobile launcher icons remain scaffold placeholders.

The editable icon source is `app/assets/tag-watch.svg`. Run `npm run icons` from `app` after editing it to regenerate the Windows PNG/ICO assets and preview.

Windows startup uses an app-owned child view (`StartupSplash.h`) with the embedded SVG rendered by Direct2D at the current DPI and an animated spinner. The React composition root stays hidden until React mounts, preventing the framework's green loading bar and second spinner from appearing over the splash. On bundle-load failure, the root is revealed and the splash dismissed so diagnostics remain accessible. The React loading view uses a generated SVG data URI on Windows. The native title bar uses multi-size ICO frames rendered individually from the SVG (Windows title bars do not accept SVG directly). Native branding changes require rebuilding the Windows executable; Metro refresh alone is insufficient.

## Closing and minimizing

Elapsed time derives from a monotonic clock, not the number of UI ticks. Minimizing/backgrounding does not pause the in-memory timer; returning to the same process catches up immediately. Checkpoints are saved every second while JavaScript executes, on state changes and on app-state transitions.

On Windows, a native closing handler requests a final pause/save and closes only after storage confirms success. A failed save leaves the window open with a retry message. This native handler still needs a real Windows build/device test.

Every fresh launch restores timers paused. Time spent while the app was closed is never added. Abrupt process termination can lose time since the last successful checkpoint. On mobile, the OS can suspend JavaScript in the background and kill the suspended process without a final callback. In that case, the background interval after the last checkpoint cannot be recovered reliably. Returning while the process is still alive includes that interval. Exact force-quit timestamps are not promised; see [Apple's termination callback documentation](https://developer.apple.com/documentation/uikit/uiapplicationdelegate/applicationwillterminate(_:)) and [React Native AppState](https://reactnative.dev/docs/appstate).

## Development and validation

Windows build update (2026-09-14): the native Debug x64 solution now compiles and produces `app/windows/x64/Debug/TagWatch.exe` and an MSIX under `app/windows/TagWatch.Package/AppPackages/` with Visual Studio 2026. AsyncStorage 3.1.1 needs the compatibility patch in `app/patches/`, automatically applied by `npm install`/`npm ci`. It removes the stale legacy NuGet list, fixes its codegen configuration, and selects the installed VS 2026 toolset. The solution also supplies its older `UseFabric` flag. See `app/patches/README.md` for details. Native runtime/lifecycle testing is still required; a successful build alone does not verify those behaviors.

```sh
npm run typecheck
npm run lint
npm test -- --runInBand
```

The test suite checks exclusivity, pause/resume, background catch-up, safe restoration, reset/delete rules, naming, time formatting, ordered/coalesced writes, failed saves, and UI interactions.

Implementation verification in the initial development environment: TypeScript, lint and 14 tests pass; Metro release JavaScript bundles build for Windows, Android and iOS. Native toolchains were unavailable (Visual Studio/.NET and Android SDK absent, Windows host cannot build iOS). JavaScript bundle checks and mocked bridge tests do not substitute for compiling the native projects or testing lifecycle behavior on devices.

Before distribution, test on each target: create/switch timers rapidly; rename with the keyboard; resize/rotate and scroll many cards; minimize and return; close/relaunch; reset/delete/cancel; verify theme persistence; and check save failures. On Windows, test ordinary close and forced termination separately. On mobile, test returning to a live background process and relaunching after a force-quit separately.

The initial npm audit reports 11 upstream tooling advisories (10 moderate, 1 high), involving the React Native CLI's XML parsing dependencies. Resolve these with compatible upstream releases before distribution; do not apply `npm audit fix --force`, which proposes an incompatible React Native Windows version.

## Structure

- `app/App.tsx`: shared native UI and themes.
- `app/src/stopwatches.ts`: pure timer state transitions and snapshot validation.
- `app/src/useStopwatches.ts`: session clock, checkpoints and lifecycle integration.
- `app/src/persistence.ts`: local storage and serialized writes.
- `app/src/lifecycle.windows.ts` and `app/windows/TagWatch/TagWatch.cpp`: save-before-close coordination.
- `app/android`, `app/ios`, `app/windows`: generated native projects.

React Native 0.84.1 / React 19.2.3 / React Native Windows 0.84.0 were selected as a compatible combination. AsyncStorage supplies persistence on all three targets. The shared UI uses React Native primitives and keeps native lifecycle behavior separate, so a React Native Web entry point can be added later. Browser support is not enabled in this version.
