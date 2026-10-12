// 2. Vendor Bulk CSV Upload & Verification
document.getElementById('verifyCsvBtn').addEventListener('click', async function() {
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
            if (!response.ok) throw new Error(`Server ne ${response.status} error diya`);
            
            const textResponse = await response.text();
            let dbRecords;
            try {
                dbRecords = JSON.parse(textResponse);
            } catch (err) {
                throw new Error('Database response theek nahi hai.');
            }

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

            // Update Counts Securely
            const vEl = document.getElementById('verifiedCount'); if(vEl) vEl.textContent = vCount;
            const mEl = document.getElementById('missingCount'); if(mEl) mEl.textContent = mCount;
            const misEl = document.getElementById('mismatchCount'); if(misEl) misEl.textContent = misCount;

            // Handle Buttons Securely (Agar HTML mein nahi hain to error nahi aayega)
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

            if (typeof renderTable === 'function') renderTable('ALL');
            
            if (progressDiv) progressDiv.textContent = 'Verification mukammal ho gayi! ✅';
            if (fileInput) fileInput.value = '';

        } catch (err) {
            console.error('Processing Error:', err);
            alert('Error aagaya: ' + err.message);
            if (progressDiv) progressDiv.textContent = 'Process fail ho gaya.';
        }
    };

    reader.onerror = function() {
        alert('File read karne mein masla aaya!');
        if (progressDiv) progressDiv.textContent = '';
    };

    reader.readAsText(file);
});
