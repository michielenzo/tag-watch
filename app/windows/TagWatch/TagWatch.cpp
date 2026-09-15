// TagWatch.cpp : Defines the entry point for the application.
//

#include "pch.h"
#include "TagWatch.h"

#include "AutolinkedNativeModules.g.h"

#include "NativeModules.h"
#include "StartupSplash.h"
#include <functional>

// Delay an ordinary window close until JavaScript has paused and persisted timers.
// A process kill still falls back to the last periodic checkpoint.
static std::function<void()> requestClose;
static winrt::Microsoft::UI::Windowing::AppWindow mainWindow{nullptr};
static winrt::Microsoft::UI::Composition::Visual reactRoot{nullptr};

static void FinishStartup() noexcept {
  if (reactRoot) reactRoot.IsVisible(true);
  StartupSplash::Hide();
}

REACT_MODULE(TagWatchLifecycle)
struct TagWatchLifecycle {
  winrt::Microsoft::ReactNative::ReactContext context;

  REACT_INIT(Initialize)
  void Initialize(winrt::Microsoft::ReactNative::ReactContext const &value) noexcept {
    context = value;
  }

  REACT_METHOD(setEnabled)
  void setEnabled(bool enabled) noexcept {
    context.UIDispatcher().Post([ctx = context, enabled]() {
      if (enabled) {
        FinishStartup();
        requestClose = [ctx]() {ctx.EmitJSEvent(L"RCTDeviceEventEmitter", L"tagwatchClosing", nullptr);};
      } else {
        requestClose = nullptr;
      }
    });
  }

  REACT_METHOD(completeClose)
  void completeClose() noexcept {
    context.UIDispatcher().Post([]() {
      requestClose = nullptr;
      if (mainWindow) {mainWindow.Destroy();}
    });
  }
};

// A PackageProvider containing any turbo modules you define within this app project
struct CompReactPackageProvider
    : winrt::implements<CompReactPackageProvider, winrt::Microsoft::ReactNative::IReactPackageProvider> {
 public: // IReactPackageProvider
  void CreatePackage(winrt::Microsoft::ReactNative::IReactPackageBuilder const &packageBuilder) noexcept {
    AddAttributedModules(packageBuilder, true);
  }
};

// The entry point of the Win32 application
_Use_decl_annotations_ int CALLBACK WinMain(HINSTANCE instance, HINSTANCE, PSTR /* commandLine */, int showCmd) {
  // Initialize WinRT
  winrt::init_apartment(winrt::apartment_type::single_threaded);

  // Enable per monitor DPI scaling
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

  // Find the path hosting the app exe file
  WCHAR appDirectory[MAX_PATH];
  GetModuleFileNameW(NULL, appDirectory, MAX_PATH);
  PathCchRemoveFileSpec(appDirectory, MAX_PATH);

  // Own the island so its built-in loading bar stays hidden behind our splash.
  // Visibility does not stop React from loading and mounting the application.
  auto dispatcher = winrt::Microsoft::UI::Dispatching::DispatcherQueueController::CreateOnCurrentThread();
  auto compositor = winrt::Microsoft::UI::Composition::Compositor();
  auto host = winrt::Microsoft::ReactNative::ReactNativeHost();
  auto settings = host.InstanceSettings();
  settings.Properties().Set(winrt::Microsoft::ReactNative::ReactDispatcherHelper::UIDispatcherProperty(),
      winrt::Microsoft::ReactNative::ReactDispatcherHelper::UIThreadDispatcher());
  winrt::Microsoft::ReactNative::Composition::CompositionUIService::SetCompositor(host.InstanceSettings(), compositor);
  auto reactWindow = winrt::Microsoft::ReactNative::ReactNativeWindow::CreateFromCompositor(compositor);
  reactRoot = reactWindow.ReactNativeIsland().RootVisual();
  reactRoot.IsVisible(false);
  // Register any autolinked native modules
  RegisterAutolinkedNativeModulePackages(settings.PackageProviders());
  // Register any native modules defined within this app project
  settings.PackageProviders().Append(winrt::make<CompReactPackageProvider>());

#if BUNDLE
  // Load the JS bundle from a file (not Metro):
  // Set the path (on disk) where the .bundle file is located
  settings.BundleRootPath(std::wstring(L"file://").append(appDirectory).append(L"\\Bundle\\").c_str());
  // Set the name of the bundle file (without the .bundle extension)
  settings.JavaScriptBundleFile(L"index.windows");
  // Disable hot reload
  settings.UseFastRefresh(false);
#else
  // Load the JS bundle from Metro
  settings.JavaScriptBundleFile(L"index");
  // Enable hot reload
  settings.UseFastRefresh(true);
#endif
#if _DEBUG
  // For Debug builds
  // Enable Direct Debugging of JS
  settings.UseDirectDebugger(true);
  // Enable the Developer Menu
  settings.UseDeveloperSupport(true);
#else
  // For Release builds:
  // Disable Direct Debugging of JS
  settings.UseDirectDebugger(false);
  // Disable the Developer Menu
  settings.UseDeveloperSupport(false);
#endif

  // Get the AppWindow so we can configure its initial title and size
  auto appWindow{reactWindow.AppWindow()};
  appWindow.Title(L"tag-watch");
  auto icon = static_cast<HICON>(LoadImageW(instance, MAKEINTRESOURCEW(IDI_ICON1), IMAGE_ICON, 0, 0, LR_DEFAULTSIZE | LR_SHARED));
  appWindow.SetIcon(winrt::Microsoft::UI::GetIconIdFromIcon(icon));
  auto hwnd = winrt::Microsoft::UI::GetWindowFromWindowId(appWindow.Id());
  auto smallSize = GetSystemMetricsForDpi(SM_CXSMICON, GetDpiForWindow(hwnd));
  auto smallIcon = LoadImageW(instance, MAKEINTRESOURCEW(IDI_ICON1), IMAGE_ICON, smallSize, smallSize, LR_SHARED);
  SendMessageW(hwnd, WM_SETICON, ICON_SMALL, reinterpret_cast<LPARAM>(smallIcon));
  appWindow.Resize({1060, 720});
  mainWindow = appWindow;
  StartupSplash::Show(winrt::Microsoft::UI::GetWindowFromWindowId(appWindow.Id()), instance);
  if (!StartupSplash::window) reactRoot.IsVisible(true);
  settings.InstanceLoaded([](auto const &, auto const &args) {
    if (args.Failed()) {
      args.Context().UIDispatcher().Post([]() { FinishStartup(); });
    }
  });
  appWindow.Closing([](auto const &, auto const &args) {
    if (requestClose) {
      args.Cancel(true);
      requestClose();
    }
  });

  // Get the ReactViewOptions so we can set the initial RN component to load
  auto viewOptions = winrt::Microsoft::ReactNative::ReactViewOptions();
  viewOptions.ComponentName(L"TagWatch");

  appWindow.Destroying([host](auto const &, auto const &) {
    auto unload = host.UnloadInstance();
    unload.Completed([host](auto const &, auto const &) {
      host.InstanceSettings().UIDispatcher().Post([]() { PostQuitMessage(0); });
    });
  });
  appWindow.Show();
  winrt::Microsoft::ReactNative::ReactCoreInjection::SetTopLevelWindowId(
      settings.Properties(), reinterpret_cast<uint64_t>(hwnd));
  host.ReloadInstance();
  reactWindow.ReactNativeIsland().ReactViewHost(
      winrt::Microsoft::ReactNative::ReactCoreInjection::MakeViewHost(host, viewOptions));
  dispatcher.DispatcherQueue().RunEventLoop();
  StartupSplash::Hide();
  reactRoot = nullptr;
  mainWindow = nullptr;
  appWindow.Destroy();
  dispatcher.ShutdownQueue();
  reactWindow.Close();
  compositor.Close();
}
