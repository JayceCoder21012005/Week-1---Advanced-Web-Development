// Trang /docs: Scalar API Reference đọc /openapi.json (có nút "Test Request" để gửi request thật).
const html = `<!doctype html>
<html>
  <head>
    <title>Cart API — Docs</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', { url: '/openapi.json', hideClientButton: false });
    </script>
  </body>
</html>`;

export function GET() {
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
