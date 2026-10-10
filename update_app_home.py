import re

with open('frontend/src/App.jsx', 'r', encoding='utf-8') as f:
    app_jsx = f.read()

# Add import
app_jsx = app_jsx.replace(
    "import ReportsPage from './features/reports/ReportsPage';",
    "import ReportsPage from './features/reports/ReportsPage';\nimport HomePage from './features/home/HomePage';"
)

# Replace the dummy Home route
app_jsx = re.sub(
    r"<Route path=\"/\" element=\{\s*<ProtectedRoute>\s*<MainLayout>\s*<div className=\"text-center text-xl mt-10\">مرحباً بك في نظام الكانتين\.</div>\s*</MainLayout>\s*</ProtectedRoute>\s*\} />",
    """<Route path="/" element={
            <ProtectedRoute>
              <MainLayout>
                <HomePage />
              </MainLayout>
            </ProtectedRoute>
          } />""",
    app_jsx
)

with open('frontend/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(app_jsx)
