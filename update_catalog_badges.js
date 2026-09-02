const fs = require('fs');

let html = fs.readFileSync('herb-catalog.html', 'utf8');

// Add badge CSS before closing style tag
const cssToAdd = `
        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 0.75em;
            font-weight: bold;
            margin-bottom: 8px;
        }
        
        .status-verified {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .status-pending_verification {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeeba;
        }
        
        .status-insufficient_data {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }`;

html = html.replace('</style>', cssToAdd + '\n    </style>');

// Add badge function to JavaScript before renderHerbsList
const functionToAdd = `
        function getBadgeText(status) {
            const badges = {
                'verified': '✅ Verified',
                'pending_verification': '⏳ Being Researched',
                'insufficient_data': '❌ Limited Data'
            };
            return badges[status] || '❓ Unknown';
        }`;

html = html.replace('function renderHerbsList(herbList) {', functionToAdd + '\n\n        function renderHerbsList(herbList) {');

// Update the renderHerbsList function to include badges
const oldCardStart = `<div class="herb-card ${selectedHerb?.id === herb.id ? 'selected' : ''}" data-id="${herb.id}">
                    <div class="herb-id">#${herb.id}</div>`;

const newCardStart = `<div class="herb-card ${selectedHerb?.id === herb.id ? 'selected' : ''}" data-id="${herb.id}">
                    <div class="status-badge status-${herb.status || 'insufficient_data'}">${getBadgeText(herb.status || 'insufficient_data')}</div>
                    <div class="herb-id">#${herb.id}</div>`;

html = html.replace(oldCardStart, newCardStart);

fs.writeFileSync('herb-catalog.html', html);
console.log('✅ Updated herb-catalog.html with status badges');
console.log('📝 Added:');
console.log('   - Badge CSS styling (3 statuses)');
console.log('   - getBadgeText() function');
console.log('   - Status badges to each herb card');
