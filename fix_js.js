const fs = require('fs');

// Fix auth.js
let authCode = fs.readFileSync('d:/Christ work/GO/web/auth.js', 'utf8');
authCode = authCode.replace("if (res.access_token) {\n        localStorage.setItem('access_token', res.access_token);", "if (res.message) {");
fs.writeFileSync('d:/Christ work/GO/web/auth.js', authCode);

// Fix dashboard.js
let dashCode = fs.readFileSync('d:/Christ work/GO/web/dashboard.js', 'utf8');
dashCode = dashCode.replace(/const token = localStorage\.getItem\('access_token'\);\s*if \(!token\) \{\s*window\.location = '\/auth\.html';\s*return;\s*\}/g, '');
dashCode = dashCode.replace(/const token = localStorage\.getItem\('access_token'\);/g, '');
dashCode = dashCode.replace(/,\s*HEADERS_BEARER/g, ''); // I will use a custom function to clean up headers

// Manually replace the headers object in api calls
dashCode = dashCode.replace(/headers:\s*\{\s*'Authorization': 'Bearer '\s*\+\s*token\s*\}/g, "headers: {}");
dashCode = dashCode.replace(/headers:\s*\{\s*'Authorization': 'Bearer '\s*\+\s*token,\s*'Content-Type': 'application\/json'\s*\}/g, "headers: { 'Content-Type': 'application/json' }");
dashCode = dashCode.replace(/localStorage\.removeItem\('access_token'\);/g, '');

fs.writeFileSync('d:/Christ work/GO/web/dashboard.js', dashCode);
console.log("Fixed files successfully");
