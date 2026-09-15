#pragma once
#include <d3d11.h>
#include <d2d1_3.h>
#include <dwrite.h>
#include <cmath>
#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "d2d1.lib")
#pragma comment(lib, "dwrite.lib")
#pragma comment(lib, "gdi32.lib")

// Child of the real app window: never creates another top-level window.
namespace StartupSplash {
inline HWND window{};
inline winrt::com_ptr<ID2D1DeviceContext5> canvas;
inline winrt::com_ptr<ID2D1SvgDocument> artwork;
inline winrt::com_ptr<IDWriteFactory> textFactory;
inline void Hide() noexcept {
  if (window) DestroyWindow(window);
  window = nullptr;
  artwork = nullptr;
  canvas = nullptr;
  textFactory = nullptr;
}
inline void Initialize() {
  winrt::com_ptr<ID3D11Device> gpu;
  winrt::check_hresult(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_WARP, nullptr,
      D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0, D3D11_SDK_VERSION, gpu.put(), nullptr, nullptr));
  winrt::com_ptr<ID2D1Factory1> factory;
  winrt::check_hresult(D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, factory.put()));
  winrt::com_ptr<ID2D1Device> device;
  winrt::check_hresult(factory->CreateDevice(gpu.as<IDXGIDevice>().get(), device.put()));
  winrt::com_ptr<ID2D1DeviceContext> context;
  winrt::check_hresult(device->CreateDeviceContext(D2D1_DEVICE_CONTEXT_OPTIONS_NONE, context.put()));
  canvas = context.as<ID2D1DeviceContext5>();
  auto resource = FindResourceW(nullptr, MAKEINTRESOURCEW(1009), RT_RCDATA);
  winrt::check_bool(resource != nullptr);
  winrt::com_ptr<IStream> stream;
  winrt::check_hresult(CreateStreamOnHGlobal(nullptr, TRUE, stream.put()));
  winrt::check_hresult(stream->Write(LockResource(LoadResource(nullptr, resource)), SizeofResource(nullptr, resource), nullptr));
  LARGE_INTEGER start{};
  winrt::check_hresult(stream->Seek(start, STREAM_SEEK_SET, nullptr));
  winrt::check_hresult(canvas->CreateSvgDocument(stream.get(), {512, 512}, artwork.put()));
  winrt::check_hresult(DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED, __uuidof(IDWriteFactory), reinterpret_cast<IUnknown **>(textFactory.put())));
}
inline void Paint(HDC dc, RECT bounds) {
  const float scale = GetDpiForWindow(window) / 96.0f;
  const UINT width = static_cast<UINT>(240 * scale), height = static_cast<UINT>(280 * scale);
  auto props = D2D1::BitmapProperties1(D2D1_BITMAP_OPTIONS_TARGET,
      D2D1::PixelFormat(DXGI_FORMAT_B8G8R8A8_UNORM, D2D1_ALPHA_MODE_PREMULTIPLIED));
  winrt::com_ptr<ID2D1Bitmap1> target, pixels;
  winrt::check_hresult(canvas->CreateBitmap({width, height}, nullptr, 0, props, target.put()));
  props.bitmapOptions = D2D1_BITMAP_OPTIONS_CPU_READ | D2D1_BITMAP_OPTIONS_CANNOT_DRAW;
  winrt::check_hresult(canvas->CreateBitmap({width, height}, nullptr, 0, props, pixels.put()));
  canvas->SetTarget(target.get());
  canvas->BeginDraw();
  canvas->Clear(D2D1::ColorF(0x101315));
  canvas->SetTransform(D2D1::Matrix3x2F::Scale(144.0f / 512, 144.0f / 512) *
      D2D1::Matrix3x2F::Translation(48, 0) * D2D1::Matrix3x2F::Scale(scale, scale));
  canvas->DrawSvgDocument(artwork.get());
  canvas->SetTransform(D2D1::Matrix3x2F::Scale(scale, scale));
  winrt::com_ptr<ID2D1SolidColorBrush> brush;
  winrt::check_hresult(canvas->CreateSolidColorBrush(D2D1::ColorF(0xF1F5F2), brush.put()));
  winrt::com_ptr<IDWriteTextFormat> format;
  winrt::check_hresult(textFactory->CreateTextFormat(L"Segoe UI", nullptr, DWRITE_FONT_WEIGHT_SEMI_BOLD,
      DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL, 24, L"en-US", format.put()));
  format->SetTextAlignment(DWRITE_TEXT_ALIGNMENT_CENTER);
  canvas->DrawTextW(L"tag-watch", 9, format.get(), D2D1::RectF(0, 156, 240, 192), brush.get());
  brush->SetColor(D2D1::ColorF(0xA3AFAA));
  winrt::com_ptr<IDWriteTextFormat> caption;
  winrt::check_hresult(textFactory->CreateTextFormat(L"Segoe UI", nullptr, DWRITE_FONT_WEIGHT_NORMAL,
      DWRITE_FONT_STYLE_NORMAL, DWRITE_FONT_STRETCH_NORMAL, 13, L"en-US", caption.put()));
  caption->SetTextAlignment(DWRITE_TEXT_ALIGNMENT_CENTER);
  canvas->DrawTextW(L"One thing at a time.", 20, caption.get(), D2D1::RectF(0, 194, 240, 218), brush.get());
  const float rotation = static_cast<float>(GetTickCount64() % 1200) / 1200 * 6.2831853f;
  for (int i = 0; i < 12; ++i) {
    const float angle = rotation + i * 6.2831853f / 12;
    brush->SetColor(D2D1::ColorF(0xBAEF72, (i + 1) / 12.0f));
    canvas->FillEllipse(D2D1::Ellipse(D2D1::Point2F(120 + std::cos(angle) * 11, 248 + std::sin(angle) * 11), 2, 2), brush.get());
  }
  winrt::check_hresult(canvas->EndDraw());
  canvas->SetTarget(nullptr);
  winrt::check_hresult(pixels->CopyFromBitmap(nullptr, target.get(), nullptr));
  D2D1_MAPPED_RECT mapped{};
  winrt::check_hresult(pixels->Map(D2D1_MAP_OPTIONS_READ, &mapped));
  BITMAPINFO info{};
  info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  info.bmiHeader.biWidth = static_cast<LONG>(mapped.pitch / 4);
  info.bmiHeader.biHeight = -static_cast<LONG>(height);
  info.bmiHeader.biPlanes = 1;
  info.bmiHeader.biBitCount = 32;
  SetDIBitsToDevice(dc, (bounds.right - static_cast<int>(width)) / 2,
      (bounds.bottom - static_cast<int>(height)) / 2, width, height, 0, 0, 0, height,
      mapped.bits, &info, DIB_RGB_COLORS);
  pixels->Unmap();
}
inline LRESULT CALLBACK Procedure(HWND hwnd, UINT message, WPARAM wp, LPARAM lp) {
  if (message == WM_TIMER) {
    RECT bounds{};
    GetClientRect(GetParent(hwnd), &bounds);
    SetWindowPos(hwnd, HWND_TOP, 0, 0, bounds.right, bounds.bottom, SWP_NOACTIVATE);
    InvalidateRect(hwnd, nullptr, FALSE);
    return 0;
  }
  if (message == WM_ERASEBKGND) return 1;
  if (message == WM_PAINT) {
    PAINTSTRUCT paint{};
    auto dc = BeginPaint(hwnd, &paint);
    RECT bounds{};
    GetClientRect(hwnd, &bounds);
    auto buffer = CreateCompatibleDC(dc);
    auto bitmap = CreateCompatibleBitmap(dc, std::max(1L, bounds.right), std::max(1L, bounds.bottom));
    auto previous = SelectObject(buffer, bitmap);
    auto background = CreateSolidBrush(RGB(16, 19, 21));
    FillRect(buffer, &bounds, background);
    DeleteObject(background);
    try { Paint(buffer, bounds); } catch (...) { /* Leave the app available on graphics failure. */ }
    BitBlt(dc, 0, 0, bounds.right, bounds.bottom, buffer, 0, 0, SRCCOPY);
    SelectObject(buffer, previous);
    DeleteObject(bitmap);
    DeleteDC(buffer);
    EndPaint(hwnd, &paint);
    return 0;
  }
  return DefWindowProcW(hwnd, message, wp, lp);
}
inline void Show(HWND parent, HINSTANCE instance) noexcept {
  try {
    Initialize();
    WNDCLASSW cls{};
    cls.lpfnWndProc = Procedure;
    cls.hInstance = instance;
    cls.lpszClassName = L"TagWatchStartup";
    RegisterClassW(&cls);
    RECT bounds{};
    GetClientRect(parent, &bounds);
    window = CreateWindowExW(0, cls.lpszClassName, L"", WS_CHILD | WS_VISIBLE,
        0, 0, bounds.right, bounds.bottom, parent, nullptr, instance, nullptr);
    if (window) SetTimer(window, 1, 33, nullptr);
  } catch (...) { Hide(); }
}
}
