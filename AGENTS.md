# Local development

- Do not install, deploy, or register TagWatch on the user's laptop unless they explicitly ask for installation. Building and launching an unpackaged development executable is allowed.
- Use `app/scripts/start-windows-dev.ps1` for development runs without installation. The standard `react-native run-windows` command may deploy a package; do not use it by default.
- For title-editor changes, verify real Windows mouse/keyboard behavior as well as unit tests. The React test renderer does not exercise native text rendering or caret placement.
