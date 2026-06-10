const fs = require('fs');
const path = require('path');

const nodes = [
  {
    "id": "trigger-id",
    "name": "Schedule Trigger",
    "type": "n8n-nodes-base.scheduleTrigger",
    "typeVersion": 1.1,
    "position": [0, 300],
    "parameters": {
      "rule": {
        "interval": [{"field": "hours", "hoursInterval": 4}]
      }
    }
  },
  {
    "id": "rss-node",
    "name": "RSS Feed Read",
    "type": "n8n-nodes-base.rssFeedRead",
    "typeVersion": 1,
    "position": [200, 300],
    "parameters": {
      "url": "https://hnrss.org/front"
    }
  },
  {
    "id": "item-list",
    "name": "Limit 1 Article",
    "type": "n8n-nodes-base.itemLists",
    "typeVersion": 3,
    "position": [400, 300],
    "parameters": {
      "operation": "limit",
      "maxItems": 1
    }
  },
  {
    "id": "github-list-cat",
    "name": "List Categories",
    "type": "n8n-nodes-base.github",
    "typeVersion": 1,
    "position": [600, 300],
    "parameters": {
      "authentication": "oAuth2",
      "resource": "file",
      "operation": "list",
      "owner": "havedev-com",
      "repository": "havedev-web-page-astro",
      "filePath": "src/pages/blog/category"
    },
    "credentials": { "githubOAuth2Api": { "id": "YOUR_GITHUB_CREDENTIAL_ID", "name": "GitHub account" } }
  },
  {
    "id": "code-prep-cat",
    "name": "Prepare Categories",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [800, 300],
    "parameters": {
      "jsCode": "const items = $input.all();\nconst folders = items.filter(item => item.json.type === 'dir').map(item => item.json.name);\nconst news = $('Limit 1 Article').first().json;\n\nreturn { json: { folders: folders.join(', '), newsTitle: news.title, newsContent: news.contentSnippet || news.content || news.description, newsLink: news.link, slug: 'update-' + Date.now() } };"
    }
  },
  {
    "id": "ai-categorize",
    "name": "Categorize News (9router)",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.1,
    "position": [1000, 300],
    "parameters": {
      "method": "POST",
      "url": "={{ $env.OPENAI_API_BASE_URL + '/chat/completions' }}",
      "sendHeaders": true,
      "headerParameters": { "parameters": [{ "name": "Content-Type", "value": "application/json" }, { "name": "Authorization", "value": "={{ 'Bearer ' + $env.OPENAI_API_KEY }}" }] },
      "sendBody": true,
      "specifyBody": "json",
      "jsonBody": "={\n  \"model\": \"default\",\n  \"messages\": [\n    {\"role\": \"system\", \"content\": \"You are an AI that categorizes news. Given a list of categories, output ONLY the exact name of the best matching category from the list. Do not explain.\"},\n    {\"role\": \"user\", \"content\": \"News Title: {{ $json.newsTitle }}\\nNews Content: {{ $json.newsContent }}\\n\\nAvailable Categories: {{ $json.folders }}\"}\n  ]\n}"
    }
  },
  {
    "id": "code-extract-cat",
    "name": "Extract Category",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1200, 300],
    "parameters": {
      "jsCode": "const response = $input.item.json;\nconst categoryRaw = response.choices[0].message.content.trim();\nconst validFolders = $('Prepare Categories').first().json.folders.split(', ');\n\n// Find exact match or fallback\nlet category = validFolders.find(f => categoryRaw.includes(f)) || validFolders[0];\nif(!category) category = 'technology';\n\nconst prevData = $('Prepare Categories').first().json;\nreturn { json: { ...prevData, category: category } };"
    }
  },
  {
    "id": "github-list-files",
    "name": "List Files in Category",
    "type": "n8n-nodes-base.github",
    "typeVersion": 1,
    "position": [1400, 300],
    "parameters": {
      "authentication": "oAuth2",
      "resource": "file",
      "operation": "list",
      "owner": "havedev-com",
      "repository": "havedev-web-page-astro",
      "filePath": "={{ 'src/pages/blog/category/' + $json.category }}"
    },
    "credentials": { "githubOAuth2Api": { "id": "YOUR_GITHUB_CREDENTIAL_ID", "name": "GitHub account" } },
    "onError": "continueErrorOutput"
  },
  {
    "id": "github-read-file",
    "name": "Read Example File",
    "type": "n8n-nodes-base.github",
    "typeVersion": 1,
    "position": [1600, 300],
    "parameters": {
      "authentication": "oAuth2",
      "resource": "file",
      "operation": "get",
      "owner": "havedev-com",
      "repository": "havedev-web-page-astro",
      "filePath": "={{ $input.first().json.path }}"
    },
    "credentials": { "githubOAuth2Api": { "id": "YOUR_GITHUB_CREDENTIAL_ID", "name": "GitHub account" } },
    "onError": "continueErrorOutput"
  },
  {
    "id": "code-extract-fm",
    "name": "Extract Frontmatter",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [1800, 300],
    "parameters": {
      "jsCode": "let frontmatter = '---\\ntitle: \"Placeholder\"\\ndate: \"2023-01-01\"\\n---';\nif ($input.first().json.content) {\n  const content = Buffer.from($input.first().json.content, 'base64').toString('utf8');\n  const match = content.match(/^---\\s*[\\s\\S]*?\\s*---/);\n  if (match) frontmatter = match[0];\n}\n\nconst prevData = $('Extract Category').first().json;\nreturn { json: { ...prevData, frontmatter: frontmatter } };"
    }
  },
  {
    "id": "ai-write",
    "name": "Write Article (9router)",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.1,
    "position": [2000, 300],
    "parameters": {
      "method": "POST",
      "url": "={{ $env.OPENAI_API_BASE_URL + '/chat/completions' }}",
      "sendHeaders": true,
      "headerParameters": { "parameters": [{ "name": "Content-Type", "value": "application/json" }, { "name": "Authorization", "value": "={{ 'Bearer ' + $env.OPENAI_API_KEY }}" }] },
      "sendBody": true,
      "specifyBody": "json",
      "jsonBody": "={\n  \"model\": \"default\",\n  \"messages\": [\n    {\"role\": \"system\", \"content\": \"Anda adalah penulis teknis profesional Havedev. Anda akan menerima sebuah template frontmatter dan sebuah berita. Tugas Anda: 1) Pertahankan EXACT format frontmatter yang diberikan (hanya ubah isinya seperti title dan date). 2) Tulis artikel dalam bahasa Indonesia dengan tone profesional Havedev berdasarkan berita. 3) Sisipkan gambar dengan format `![Cover](/images/blog/{{ $json.slug }}.jpg)` tepat di bawah frontmatter. 4) Output langsung markdown secara utuh tanpa penjelasan tambahan.\"},\n    {\"role\": \"user\", \"content\": \"Template Frontmatter:\\n{{ $json.frontmatter }}\\n\\nBerita Hari Ini:\\nTitle: {{ $json.newsTitle }}\\nContent: {{ $json.newsContent }}\\nLink: {{ $json.newsLink }}\"}\n  ]\n}"
    }
  },
  {
    "id": "ai-image",
    "name": "Generate Image (9router)",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.1,
    "position": [2200, 300],
    "parameters": {
      "method": "POST",
      "url": "={{ $env.OPENAI_API_BASE_URL + '/images/generations' }}",
      "sendHeaders": true,
      "headerParameters": { "parameters": [{ "name": "Content-Type", "value": "application/json" }, { "name": "Authorization", "value": "={{ 'Bearer ' + $env.OPENAI_API_KEY }}" }] },
      "sendBody": true,
      "specifyBody": "json",
      "jsonBody": "={\n  \"model\": \"dall-e-3\",\n  \"prompt\": \"{{ $('Extract Frontmatter').first().json.newsTitle }}, high quality illustration, technology, professional, digital art\",\n  \"n\": 1,\n  \"size\": \"1024x1024\"\n}",
      "options": {}
    },
    "onError": "continueErrorOutput"
  },
  {
    "id": "code-image-fallback",
    "name": "Check Image & Fallback",
    "type": "n8n-nodes-base.code",
    "typeVersion": 2,
    "position": [2400, 300],
    "parameters": {
      "jsCode": "let imageUrl = '';\nif ($input.first().json && $input.first().json.data && $input.first().json.data[0]) {\n  imageUrl = $input.first().json.data[0].url;\n}\n\n// Fallback to pollinations.ai (free, no API key needed)\nif (!imageUrl) {\n  const title = encodeURIComponent($('Extract Frontmatter').first().json.newsTitle);\n  imageUrl = `https://image.pollinations.ai/prompt/${title}?width=1024&height=1024&nologo=true`;\n}\n\nconst articleResponse = $('Write Article (9router)').first().json;\nconst articleMarkdown = articleResponse.choices[0].message.content;\nconst prevData = $('Extract Frontmatter').first().json;\n\nreturn { json: { ...prevData, markdown: articleMarkdown, imageUrl: imageUrl } };"
    }
  },
  {
    "id": "download-image",
    "name": "Download Image",
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.1,
    "position": [2600, 300],
    "parameters": {
      "url": "={{ $json.imageUrl }}",
      "responseFormat": "file",
      "options": {}
    }
  },
  {
    "id": "github-push-image",
    "name": "Push Image",
    "type": "n8n-nodes-base.github",
    "typeVersion": 1,
    "position": [2800, 300],
    "parameters": {
      "authentication": "oAuth2",
      "resource": "file",
      "operation": "create",
      "owner": "havedev-com",
      "repository": "havedev-web-page-astro",
      "filePath": "={{ 'public/images/blog/' + $node['Check Image & Fallback'].json.slug + '.jpg' }}",
      "commitMessage": "={{ 'docs: add image for ' + $node['Check Image & Fallback'].json.slug }}",
      "binaryPropertyName": "data"
    },
    "credentials": { "githubOAuth2Api": { "id": "YOUR_GITHUB_CREDENTIAL_ID", "name": "GitHub account" } }
  },
  {
    "id": "github-push-article",
    "name": "Push Article",
    "type": "n8n-nodes-base.github",
    "typeVersion": 1,
    "position": [3000, 300],
    "parameters": {
      "authentication": "oAuth2",
      "resource": "file",
      "operation": "create",
      "owner": "havedev-com",
      "repository": "havedev-web-page-astro",
      "filePath": "={{ 'src/pages/blog/category/' + $node['Check Image & Fallback'].json.category + '/' + $node['Check Image & Fallback'].json.slug + '.md' }}",
      "fileContent": "={{ $node['Check Image & Fallback'].json.markdown }}",
      "commitMessage": "={{ 'docs: add auto article ' + $node['Check Image & Fallback'].json.slug }}"
    },
    "credentials": { "githubOAuth2Api": { "id": "YOUR_GITHUB_CREDENTIAL_ID", "name": "GitHub account" } }
  }
];

const connections = {
  "Schedule Trigger": { "main": [[{ "node": "RSS Feed Read", "type": "main", "index": 0 }]] },
  "RSS Feed Read": { "main": [[{ "node": "Limit 1 Article", "type": "main", "index": 0 }]] },
  "Limit 1 Article": { "main": [[{ "node": "List Categories", "type": "main", "index": 0 }]] },
  "List Categories": { "main": [[{ "node": "Prepare Categories", "type": "main", "index": 0 }]] },
  "Prepare Categories": { "main": [[{ "node": "Categorize News (9router)", "type": "main", "index": 0 }]] },
  "Categorize News (9router)": { "main": [[{ "node": "Extract Category", "type": "main", "index": 0 }]] },
  "Extract Category": { "main": [[{ "node": "List Files in Category", "type": "main", "index": 0 }]] },
  "List Files in Category": { "main": [[{ "node": "Read Example File", "type": "main", "index": 0 }]] },
  "Read Example File": { "main": [[{ "node": "Extract Frontmatter", "type": "main", "index": 0 }]] },
  "Extract Frontmatter": { "main": [[{ "node": "Write Article (9router)", "type": "main", "index": 0 }]] },
  "Write Article (9router)": { "main": [[{ "node": "Generate Image (9router)", "type": "main", "index": 0 }]] },
  "Generate Image (9router)": { "main": [[{ "node": "Check Image & Fallback", "type": "main", "index": 0 }]] },
  "Check Image & Fallback": { "main": [[{ "node": "Download Image", "type": "main", "index": 0 }]] },
  "Download Image": { "main": [[{ "node": "Push Image", "type": "main", "index": 0 }]] },
  "Push Image": { "main": [[{ "node": "Push Article", "type": "main", "index": 0 }]] }
};

const workflow = {
  "name": "Advanced Havedev Article Generator",
  "nodes": nodes,
  "connections": connections,
  "active": false,
  "settings": { "executionOrder": "v1" }
};

const outputPath = path.resolve(__dirname, '..', 'configs', 'n8n', 'n8n-advanced-workflow.json');

fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2));
console.log(`JSON Workflow generated successfully: ${outputPath}`);
