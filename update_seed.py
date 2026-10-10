import re

with open('backend/prisma/seed.js', 'r', encoding='utf-8') as f:
    seed = f.read()

seed = seed.replace(
    "'CREATE_INVOICE', 'VIEW_PRODUCTS', 'VIEW_PATIENTS', 'CREATE_DEPOSIT'",
    "'CREATE_INVOICE', 'VIEW_PRODUCTS', 'VIEW_PATIENTS', 'CREATE_DEPOSIT', 'VIEW_TREASURY', 'VIEW_REPORTS', 'MANAGE_PURCHASES'"
)

with open('backend/prisma/seed.js', 'w', encoding='utf-8') as f:
    f.write(seed)
