import re

with open('backend/src/routes.js', 'r', encoding='utf-8') as f:
    routes = f.read()

# Add the import at the top
routes = routes.replace(
    "const express = require('express');",
    "const express = require('express');\nconst { authMiddleware } = require('./common/middleware/auth');"
)

with open('backend/src/routes.js', 'w', encoding='utf-8') as f:
    f.write(routes)
