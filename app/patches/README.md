# AsyncStorage 3.1.1 / React Native Windows 0.84 compatibility

`postinstall` applies this patch with patch-package. It only affects the Windows native project:

- Remove the obsolete `packages.config` (and its project entry). React Native Windows already restores the complete SDK dependency graph using PackageReference; the old CppWinRT-only file incorrectly triggers the Windows App SDK 1.8 legacy dependency check. The SDK check itself stays enabled.
- Disable React Native JS codegen for this handwritten, attributed Windows backend. Its inherited codegen target runs in the dependency's package directory, where the app's Windows CLI platform is not registered. Native C++/WinRT metadata generation remains enabled.
- Use the v145 compiler with Visual Studio 2026, preserving v143 for older Visual Studio versions.

`windows/ExperimentalFeatures.props` also maps `UseFabric` to `RnwNewArch`, because this dependency still uses the older flag to select its desktop configuration and register TurboModules.

Reassess/remove the patch when upgrading AsyncStorage. Do not disable WindowsAppSDKVerifyTransitiveDependencies globally to work around the legacy package list.
