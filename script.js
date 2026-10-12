document.addEventListener('DOMContentLoaded', () => {
    let globalResults = [];

    function parseMasterCSV(text) {
        const lines = text.split('\n');
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"(.*)"$/, '$1'));
        
        const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('tarikh'));
        const siteIdx = headers.findIndex(h => h.includes('site') || h.includes('name'));
        const urlIdx = headers.findIndex(h => h.includes('url') || h.includes('link') || h.includes('live'));
        const vendorIdx = headers.findIndex(h => h.includes('vendor') || h.includes('vandar'));
        const clientIdx = headers.findIndex(h => h.includes('client'));
        const vPriceIdx = headers.findIndex(h => h.includes('vendor price') || (h.includes('price') && !h.includes('client')));
        const cPriceIdx = headers.findIndex(h => h.includes('client price'));

        const result = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
            const liveUrl = urlIdx !== -1 ? cols[urlIdx] : (cols[2] || cols[1] || '');
            if (!liveUrl || !liveUrl.toLowerCase().startsWith('http')) continue;

            result.push({
                date: dateIdx !== -1 ? cols[dateIdx] : (cols[0] || ''),
                site_name: siteIdx !== -1 ? cols[siteIdx] : (cols[1] || ''),
                live_url: liveUrl,
                vendor_name: vendorIdx !== -1 ? cols[vendorIdx] : (cols[3] || ''),
                client_name: clientIdx !== -1 ? cols[clientIdx] : (cols[4] || ''),
                vendor_price: parseFloat(vPriceIdx !== -1 ? cols[vPriceIdx] : cols[5]) || 0,
                client_price: parseFloat(cPriceIdx !== -1 ? cols[cPriceIdx] : cols[6]) || 0
            });
        }
        return result;
    }

    function parseVendorCSV(text) {
        const lines = text.split('\n');
        const vendorInputMap = new Map();
        if (lines.length === 0) return vendorInputMap;

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"(.*)"$/, '$1'));
        let urlColIdx = headers.findIndex(h => h.includes('url') || h.includes('link') || h.includes('live'));
        let priceColIdx = headers.findIndex(h => h.includes('price') || h.includes('rate') || h.includes('amount'));

        if (urlColIdx === -1) urlColIdx = 0;
        if (priceColIdx === -1) priceColIdx = 1;
        const startIndex = (headers[urlColIdx]?.includes('url') || headers[urlColIdx]?.includes('link')) ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1'));
            const rawUrl = cols[urlColIdx] || '';
            const price = parseFloat(cols[priceColIdx]) || 0;

            if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
                vendorInputMap.set(rawUrl.toLowerCase(), { originalUrl: rawUrl, price: price });
            }
        }
        return vendorInputMap;
    }

    function renderTable(filterType = 'ALL') {
        const tbody = document.getElementById('reportTableBody');
        if (!tbody) return;
        
        let filtered = filterType === 'ALL' ? globalResults : globalResults.filter(r => r.status === filterType);

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-slate-400">Koi data mojood nahi.</td></tr>';
            return;
        }

        let html = '';
        filtered.forEach(r => {
            let badgeClass = r.status === 'Verified' ? 'bg-emerald-100 text-emerald-700' : r.status === 'Missing' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700';
            html += `
                <tr class="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                    <td class="py-3 px-4 font-mono text-xs text-slate-700 truncate max-w-xs" title="${r.url}">${r.url}</td>
                    <td class="py-3 px-4"><span class="px-2.5 py-1 text-xs rounded-full font-semibold ${badgeClass}">${r.status}</span></td>
                    <td class="py-3 px-4 text-slate-700">${r.dbPrice > 0 ? '$' + r.dbPrice : '-'}</td>
                    <td class="py-3 px-4 font-semibold text-slate-600">${r.vendorPrice > 0 ? '$' + r.vendorPrice : '-'}</td>
                    <td class="py-3 px-4 text-center">
                        <button onclick="navigator.clipboard.writeText('${r.url}'); alert('Copy ho gaya');" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded text-xs font-medium cursor-pointer">Copy</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

        const titleEl = document.getElementById('tableTitle');
        const showAllBtn = document.getElementById('showAllBtn');
        if (titleEl && showAllBtn) {
            if (filterType === 'ALL') {
                titleEl.textContent = 'Verification Report (All Results)';
                showAllBtn.classList.add('hidden');
            } else {
                titleEl.textContent = `Verification Report - Filter: ${filterType}`;
                showAllBtn.classList.remove('hidden');
            }
        }
    }

    // --- 1. MASTER CSV UPLOAD ---
    const uploadMasterBtn = document.getElementById('uploadMasterBtn');
    if (uploadMasterBtn) {
        uploadMasterBtn.addEventListener('click', async function() {
            const fileInput = document.getElementById('masterCsvFile');
            const progressDiv = document.getElementById('uploadProgress');

            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                alert('Pehle master sheet ki CSV file select karein!');
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();
            if (progressDiv) progressDiv.textContent = 'File read ho rahi hai...';

            reader.onload = async function(e) {
                const records = parseMasterCSV(e.target.result);
                if (records.length === 0) {
                    alert('File mein koi valid data nahi mila!');
                    if (progressDiv) progressDiv.textContent = '';
                    return;
                }

                if (progressDiv) progressDiv.textContent = `Kul ${records.length} records upload ho rahe hain...`;
                try {
                    const response = await fetch('/api/links', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(records)
                    });

                    const textResponse = await response.text();
                    let result;
                    try { result = JSON.parse(textResponse); } catch (err) { throw new Error('Invalid server response'); }

                    if (response.ok) {
                        if (progressDiv) progressDiv.textContent = `Kamiyabi! ${result.count} records database mein save ho gaye ✅`;
                        fileInput.value = '';
                    } else {
                        alert('Upload Error: ' + (result.error || 'Unknown'));
                        if (progressDiv) progressDiv.textContent = '';
                    }
                } catch (err) {
                    alert('Connection Failed: ' + err.message);
                    if (progressDiv) progressDiv.textContent = '';
                }
            };
            reader.readAsText(file);
        });
    }

    // --- 2. VENDOR CSV VERIFICATION ---
    const verifyCsvBtn = document.getElementById('verifyCsvBtn');
    if (verifyCsvBtn) {
        verifyCsvBtn.addEventListener('click', async function() {
            const vendorInputEl = document.getElementById('vendorNameInput');
            const fileInput = document.getElementById('vendorCsvFile');
            const progressDiv = document.getElementById('verifyProgress');

            const inputVendor = vendorInputEl ? vendorInputEl.value.trim().toLowerCase() : '';

            if (!inputVendor || !fileInput || !fileInput.files[0]) {
                alert('Vendor ka naam aur CSV file dono lazmi hain!');
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();
            if (progressDiv) progressDiv.textContent = 'Vendor file process ho rahi hai...';

            reader.onload = async function(e) {
                try {
                    const vendorMap = parseVendorCSV(e.target.result);
                    if (vendorMap.size === 0) {
                        alert('File mein koi valid URL nahi mila!');
                        if (progressDiv) progressDiv.textContent = '';
                        return;
                    }

                    const response = await fetch('/api/links');
                    if (!response.ok) throw new Error(`Server Error: ${response.status}`);
                    
                    const textResponse = await response.text();
                    let dbRecords;
                    try { dbRecords = JSON.parse(textResponse); } catch (err) { throw new Error('Database read error'); }

                    const dbMap = new Map();
                    if (Array.isArray(dbRecords)) {
                        dbRecords.forEach(rec => {
                            const dbVendor = (rec.vendor_name || '').trim().toLowerCase();
                            if (dbVendor.includes(inputVendor) || inputVendor.includes(dbVendor)) {
                                if (rec.live_url) dbMap.set(rec.live_url.trim().toLowerCase(), rec);
                            }
                        });
                    }

                    let vCount = 0, mCount = 0, misCount = 0;
                    globalResults = [];

                    vendorMap.forEach((vData, cleanUrl) => {
                        const dbRec = dbMap.get(cleanUrl);
                        if (!dbRec) {
                            mCount++;
                            globalResults.push({ url: vData.originalUrl, status: 'Missing', dbPrice: 0, vendorPrice: vData.price });
                        } else {
                            const dbPrice = parseFloat(dbRec.vendor_price || 0);
                            if (vData.price > 0 && dbPrice > 0 && vData.price !== dbPrice) {
                                misCount++;
                                globalResults.push({ url: vData.originalUrl, status: 'Mismatch', dbPrice, vendorPrice: vData.price });
                            } else {
                                vCount++;
                                globalResults.push({ url: vData.originalUrl, status: 'Verified', dbPrice, vendorPrice: vData.price });
                            }
                        }
                    });

                    const vEl = document.getElementById('verifiedCount'); if(vEl) vEl.textContent = vCount;
                    const mEl = document.getElementById('missingCount'); if(mEl) mEl.textContent = mCount;
                    const misEl = document.getElementById('mismatchCount'); if(misEl) misEl.textContent = misCount;

                    const copyMissingBtn = document.getElementById('copyMissingBtn');
                    if (copyMissingBtn) {
                        if (mCount > 0) {
                            copyMissingBtn.classList.remove('hidden');
                            copyMissingBtn.onclick = () => { navigator.clipboard.writeText(globalResults.filter(r => r.status === 'Missing').map(r => r.url).join('\n')); alert('Missing links copy ho gaye!'); };
                        } else { copyMissingBtn.classList.add('hidden'); }
                    }

                    const copyMismatchBtn = document.getElementById('copyMismatchBtn');
                    if (copyMismatchBtn) {
                        if (misCount > 0) {
                            copyMismatchBtn.classList.remove('hidden');
                            copyMismatchBtn.onclick = () => { navigator.clipboard.writeText(globalResults.filter(r => r.status === 'Mismatch').map(r => `${r.url}, ${r.vendorPrice}`).join('\n')); alert('Price differences copy ho gaye!'); };
                        } else { copyMismatchBtn.classList.add('hidden'); }
                    }

                    renderTable('ALL');
                    if (progressDiv) progressDiv.textContent = 'Verification mukammal ho gayi! ✅';
                    if (fileInput) fileInput.value = '';

                } catch (err) {
                    alert('Error aagaya: ' + err.message);
                    if (progressDiv) progressDiv.textContent = 'Process fail ho gaya.';
                }
            };
            reader.readAsText(file);
        });
    }

    // --- 3. FILTERS ---
    const filterVerified = document.getElementById('filterVerified'); if(filterVerified) filterVerified.addEventListener('click', () => renderTable('Verified'));
    const filterMissing = document.getElementById('filterMissing'); if(filterMissing) filterMissing.addEventListener('click', () => renderTable('Missing'));
    const filterMismatch = document.getElementById('filterMismatch'); if(filterMismatch) filterMismatch.addEventListener('click', () => renderTable('Mismatch'));
    const showAllBtn = document.getElementById('showAllBtn'); if(showAllBtn) showAllBtn.addEventListener('click', () => renderTable('ALL'));

});
